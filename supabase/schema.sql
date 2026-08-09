-- ---------------------------------------------------------------------------
-- AMR KC Academy — cloud backend schema.
--
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query
-- → paste this whole file → Run. See supabase/README.md for the full setup.
--
-- Design: the app is offline-first. Every domain object syncs as one row in
-- `records` (collection + id + jsonb payload), matching the app's store
-- slices one-to-one. Conflicts resolve last-write-wins per record, which is
-- the right grain here: an FTO marking trainee A's checklist and the admin
-- editing trainee B never touch the same row.
-- ---------------------------------------------------------------------------

-- ----- roles ----------------------------------------------------------------
-- Every signed-in user gets a profile. New signups default to 'newhire'
-- (least privilege); promote FTOs and admins in Table Editor → profiles.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  -- Which operation this account works in. 'all' spans both and gets the
  -- market switcher in the app.
  market text not null default 'kc' check (market in ('kc', 'wichita', 'all')),
  role text not null default 'newhire' check (role in ('admin', 'fto', 'newhire')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read every profile (names/roles are not secret inside the org)
-- but can never change roles — that happens in the dashboard only.
create policy "profiles are readable by signed-in users"
  on public.profiles for select
  to authenticated
  using (true);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_role()
returns text
language sql
stable
as $$
  select role from public.profiles where user_id = auth.uid()
$$;

/**
 * The market this request is acting in.
 *
 * 'all' spans both and is how a multi-market admin works. Every policy below
 * that touches market-owned data reads this, so the fence is one function
 * rather than a condition copied into a dozen places.
 */
create or replace function public.current_market()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select market from public.profiles where user_id = auth.uid()), 'kc')
$$;

/** The AEMT collections. Certification records about identifiable staff. */
create or replace function public.is_aemt_collection(c text)
returns boolean
language sql
immutable
as $$
  select c in (
    'aemtCourses','aemtStudents','aemtSessions','aemtAttendance','aemtEncounters',
    'aemtShifts','aemtDeadlines','aemtSkillChecks','aemtFormResponses',
    'aemtCompletions','aemtRecordDocs','aemtAudit','aemtCandidates'
  );
$$;

-- ----- records ---------------------------------------------------------------

create table if not exists public.records (
  collection text not null,
  id text not null,
  data jsonb not null,
  -- Soft delete: rows are tombstoned, never removed, so offline devices
  -- learn about deletions when they next pull.
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  -- Which operation owns this row. The partition line for the whole app: a
  -- market owns its cohorts, trainees, evaluations, surveys, AEMT program and
  -- QA, and nothing in this table is shared between them.
  market text not null default 'kc' check (market in ('kc', 'wichita')),
  -- Market is part of the key, so the two operations can hold rows with the
  -- same collection and id without colliding.
  primary key (market, collection, id)
);

create index if not exists records_updated_at_idx on public.records (updated_at);
create index if not exists records_market_updated_at_idx on public.records (market, updated_at);

-- Server-side timestamp on every write; clients never supply updated_at.
create or replace function public.stamp_record()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists records_stamp on public.records;
create trigger records_stamp
  before insert or update on public.records
  for each row execute function public.stamp_record();

alter table public.records enable row level security;

-- Reads are SCOPED BY ROLE, not open to everyone signed in.
--
-- A new hire signing in must not be able to read AEMT selection scoring of
-- their own colleagues, or unredacted exit-survey feedback about their FTO.
-- "Signed in" is not an authorisation. Each role gets an explicit list, and a
-- new hire sees only the surveys they themselves wrote.
create policy "records readable by role"
  on public.records for select
  to authenticated
  using (
    public.current_role() = 'admin'
    or (
      public.current_role() = 'fto'
      and collection in ('cohorts','trainees','days','arrangements','customSessions',
                         'attendance','rides','evals','skills','settings')
    )
    or (
      public.current_role() = 'newhire'
      and (
        collection in ('cohorts','days','arrangements','customSessions','settings')
        or (collection = 'surveys' and updated_by = auth.uid())
      )
    )
  );

-- AEMT is admin-only to write.
--
-- RESTRICTIVE on purpose. Permissive policies OR together, so an FTO's
-- ride-along write policy would otherwise grant them the AEMT collections
-- too — which is exactly the privilege escalation this pair closes.
create policy "aemt is admin only for insert"
  on public.records as restrictive for insert
  to authenticated
  with check (not public.is_aemt_collection(collection) or public.current_role() = 'admin');

create policy "aemt is admin only for update"
  on public.records as restrictive for update
  to authenticated
  using (not public.is_aemt_collection(collection) or public.current_role() = 'admin');

-- The market fence. Applies to every operation on the table, on top of the
-- role policies above. RESTRICTIVE for the same reason: permissive policies
-- OR together, so a permissive market policy would fence nothing.
create policy "market separation"
  on public.records as restrictive for all
  to authenticated
  using (public.current_market() = 'all' or market = public.current_market())
  with check (public.current_market() = 'all' or market = public.current_market());

-- Admin writes everything.
create policy "admin writes all records"
  on public.records for insert
  to authenticated
  with check (public.current_role() = 'admin');

create policy "admin updates all records"
  on public.records for update
  to authenticated
  using (public.current_role() = 'admin');

-- FTOs write the ride-along working set: trainee records (checklist marks,
-- contacts), attendance, ride assignments, daily performance evaluations,
-- skill sheet sign-offs, and exit surveys — not cohorts or schedules.
create policy "fto writes ride-along collections"
  on public.records for insert
  to authenticated
  with check (
    public.current_role() = 'fto'
    and collection in ('trainees', 'attendance', 'rides', 'evals', 'skills', 'surveys')
  );

create policy "fto updates ride-along collections"
  on public.records for update
  to authenticated
  using (
    public.current_role() = 'fto'
    and collection in ('trainees', 'attendance', 'rides', 'evals', 'skills', 'surveys')
  );

-- New hires are read-only except their own working set: the exit survey.
-- The survey filed from the trainee's own signed-in phone must sync — the
-- in-app completion state derives from the survey record (the trainee-record
-- marker stays FTO/admin-written). Checklist marks, contacts, evals, and
-- skill sign-offs remain FTO/admin-only.
create policy "newhire writes surveys"
  on public.records for insert
  to authenticated
  with check (
    public.current_role() = 'newhire'
    and collection = 'surveys'
  );

create policy "newhire updates surveys"
  on public.records for update
  to authenticated
  using (
    public.current_role() = 'newhire'
    and collection = 'surveys'
  );

-- ----- AEMT candidate intake -------------------------------------------------
-- Separate from `records`: the AEMT interest form is filled out by candidates
-- with no account, so it needs an anonymous-insert path, and its answers are
-- selection data only the admin may read. Kept out of the synced workspace.

create table if not exists public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  form text not null default 'aemt',   -- which intake form (future-proofing)
  data jsonb not null,                  -- all answers, keyed by field id
  archived boolean not null default false,
  -- Admin-set selection status: New / Shortlisted / Contacted / Accepted / Declined.
  status text not null default 'New',
  -- Which operation the candidate applied to.
  market text not null default 'kc' check (market in ('kc', 'wichita'))
);

-- For projects created before the status column existed.
alter table public.intake_submissions
  add column if not exists status text not null default 'New';

create index if not exists intake_submissions_created_idx
  on public.intake_submissions (created_at desc);

alter table public.intake_submissions enable row level security;

-- Anyone — including an anonymous candidate — may submit the form.
create policy "anyone can submit intake"
  on public.intake_submissions for insert
  to anon, authenticated
  with check (true);

-- Only admins can read the submissions.
create policy "admin reads intake"
  on public.intake_submissions for select
  to authenticated
  using (
    public.current_role() = 'admin'
    and (public.current_market() = 'all' or market = public.current_market())
  );

-- Only admins can archive (update) or delete them.
create policy "admin updates intake"
  on public.intake_submissions for update
  to authenticated
  using (
    public.current_role() = 'admin'
    and (public.current_market() = 'all' or market = public.current_market())
  );

create policy "admin deletes intake"
  on public.intake_submissions for delete
  to authenticated
  using (
    public.current_role() = 'admin'
    and (public.current_market() = 'all' or market = public.current_market())
  );

-- ----- AEMT selection exam ---------------------------------------------------
-- Cheat-resistant by construction: the question bank (with answers) is never
-- readable by candidates and never sent to the browser. Candidates reach the
-- exam only through two SECURITY DEFINER functions — exam_start (returns a
-- random draw WITHOUT answers) and exam_submit (grades server-side). The anon
-- key can execute those functions but cannot touch the tables directly.

create table if not exists public.exam_questions (
  id bigint generated always as identity primary key,
  domain text not null,
  stem text not null,
  options text[] not null check (array_length(options, 1) = 4),
  answer int not null check (answer between 0 and 3),   -- index into options
  active boolean not null default true
);

alter table public.exam_questions enable row level security;
create policy "admin reads exam bank" on public.exam_questions
  for select to authenticated using (public.current_role() = 'admin');
create policy "admin writes exam bank" on public.exam_questions
  for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  question_ids bigint[] not null,   -- the served set, in served order
  responses jsonb,                  -- { "<question id>": <chosen option 0-3> }
  score int,
  total int not null,
  percent numeric(5,2),
  -- The allowance GRANTED AT START, so changing the cap never reaches
  -- backwards into a sitting already under way.
  limit_seconds int not null default 2400,
  -- The Integrity Statement the candidate agreed to at start. Null means
  -- "not captured" — true of every attempt taken before this was stored.
  attested boolean,
  signature text,
  attested_at timestamptz,
  attestation_hash text,
  -- exam_attempts sits OUTSIDE `records`, so the fence on that table does not
  -- reach it. Without this column a Wichita admin reads every Kansas City
  -- candidate's name, email, responses and score.
  market text not null default 'kc' check (market in ('kc', 'wichita'))
);

create index if not exists exam_attempts_email_idx on public.exam_attempts (email);
-- One submitted attempt per email, enforced by the database rather than by an
-- EXISTS that two concurrent starts can both pass.
create unique index if not exists exam_attempts_one_submitted_per_email
  on public.exam_attempts (email) where submitted_at is not null;

alter table public.exam_attempts enable row level security;
create policy "admin reads exam attempts" on public.exam_attempts
  for select to authenticated
  using (
    public.current_role() = 'admin'
    and (public.current_market() = 'all' or market = public.current_market())
  );
create policy "admin manages exam attempts" on public.exam_attempts
  for all to authenticated
  using (
    public.current_role() = 'admin'
    and (public.current_market() = 'all' or market = public.current_market())
  )
  with check (
    public.current_role() = 'admin'
    and (public.current_market() = 'all' or market = public.current_market())
  );

-- Start (or resume) an attempt. Returns the drawn questions WITHOUT answers.
create or replace function public.exam_start(
  p_name text,
  p_email text,
  p_attested boolean default null,
  p_signature text default null,
  p_attestation_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text := lower(trim(p_email));
  v_name   text := trim(p_name);
  v_sign   text := nullif(trim(coalesce(p_signature, '')), '');
  v_cutoff constant timestamptz := '2026-08-17 17:00:00-05';  -- Aug 17, 5 PM Central
  v_limit  constant int := 25 * 60;
  v_draw   constant int := 50;
  v_attempt public.exam_attempts;
  v_qids bigint[];
  v_questions jsonb;
begin
  if v_name = '' or v_email = '' then
    return jsonb_build_object('error', 'Name and email are required.');
  end if;
  if now() > v_cutoff then
    return jsonb_build_object('error', 'closed');
  end if;

  select * into v_attempt from public.exam_attempts a
    where a.email = v_email
    order by a.started_at desc limit 1;

  if found then
    if v_attempt.submitted_at is not null then
      return jsonb_build_object('error', 'already_taken');
    end if;
    if now() > v_attempt.started_at + make_interval(secs => v_attempt.limit_seconds) then
      return jsonb_build_object('error', 'expired');
    end if;
    v_qids := v_attempt.question_ids;
  else
    select array_agg(id) into v_qids
      from (select id from public.exam_questions where active order by random() limit v_draw) s;
    insert into public.exam_attempts (
      name, email, question_ids, total, limit_seconds,
      attested, signature, attested_at, attestation_hash)
      values (
        v_name, v_email, v_qids, coalesce(array_length(v_qids, 1), 0), v_limit,
        p_attested, v_sign,
        case when p_attested is true then now() else null end,
        nullif(trim(coalesce(p_attestation_hash, '')), ''))
      returning * into v_attempt;
  end if;

  select jsonb_agg(
           jsonb_build_object('id', q.id, 'domain', q.domain, 'stem', q.stem, 'options', q.options)
           order by array_position(v_qids, q.id))
    into v_questions
    from public.exam_questions q
    where q.id = any(v_qids);

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'startedAt', v_attempt.started_at,
    'limitSeconds', v_attempt.limit_seconds,
    'questions', coalesce(v_questions, '[]'::jsonb));
end;
$$;

revoke all on function public.exam_start(text, text, boolean, text, text) from public;
grant execute on function public.exam_start(text, text, boolean, text, text) to anon, authenticated;

-- Grade an attempt server-side against the bank. Never returns the answers.
create or replace function public.exam_submit(p_attempt uuid, p_responses jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grace constant int := 60;
  v_attempt public.exam_attempts;
  v_score int := 0;
  v_qid bigint;
  v_ans int;
  v_chosen int;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt;
  if not found then
    return jsonb_build_object('error', 'Attempt not found.');
  end if;
  if v_attempt.submitted_at is not null then
    return jsonb_build_object('error', 'already_submitted');
  end if;
  if now() > v_attempt.started_at
             + make_interval(secs => v_attempt.limit_seconds + v_grace) then
    return jsonb_build_object('error', 'expired');
  end if;

  foreach v_qid in array v_attempt.question_ids loop
    select answer into v_ans from public.exam_questions where id = v_qid;
    v_chosen := nullif(p_responses ->> v_qid::text, '')::int;
    if v_chosen is not null and v_chosen = v_ans then
      v_score := v_score + 1;
    end if;
  end loop;

  update public.exam_attempts
     set submitted_at = now(),
         responses = p_responses,
         score = v_score,
         percent = round(100.0 * v_score / nullif(v_attempt.total, 0), 1)
   where id = p_attempt;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.exam_submit(uuid, jsonb) from public;
grant execute on function public.exam_submit(uuid, jsonb) to anon, authenticated;
