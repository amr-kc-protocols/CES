-- ---------------------------------------------------------------------------
-- Resetting an exam attempt should VOID it, not delete it.
--
-- Resetting is the right feature — one attempt per email means a candidate
-- whose sitting went wrong is locked out until somebody clears it, and that
-- should be a button rather than a hand-written DELETE.
--
-- What it should not be is destructive. A hard delete takes with it:
--
--   * the integrity agreement — the tick, the typed signature, the timestamp
--     and the hash of the wording, all added in #89 for precisely the case
--     where an attempt is later questioned;
--   * the responses and the score;
--   * any record that the reset happened at all, or who decided it.
--
-- For an instrument that decides who gets a seat on a course, "an admin
-- cleared this candidate's attempt" is exactly the event you want to be able
-- to point at afterwards. Deleting the row means the strongest evidence
-- disappears at the moment somebody exercises discretion over it — which is
-- the moment it is most likely to matter.
--
-- So: a voided attempt stays in the table, stops counting anywhere, and stops
-- blocking the candidate from sitting again. Nothing is lost and the reset
-- itself is now a fact on the record rather than an absence.
--
-- Apply in the SQL Editor. Safe to re-run. Run top to bottom.
-- ---------------------------------------------------------------------------

begin;


-- ============================================================================
-- 1. Columns
-- ============================================================================

alter table public.exam_attempts
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users (id),
  -- Free text. Why an attempt was reset is the part a future reader needs and
  -- the part nobody remembers six weeks later.
  add column if not exists void_reason text;


-- ============================================================================
-- 2. The stamp is the database's job, not the client's
-- ============================================================================
-- voided_by is the account that pressed the button, and an account should not
-- be able to name a different one. The client sends the reason; the server
-- decides the who and the when — the same division as stamp_record().

create or replace function public.stamp_void()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.voided_at is null and new.voided_at is not null then
    -- Being voided now. Stamp it.
    new.voided_at := now();
    new.voided_by := auth.uid();
  elsif old.voided_at is not null and new.voided_at is not null then
    -- ALREADY voided and staying voided: the original stamp is the record and
    -- is not rewritable. Guarding only the transition left it editable by any
    -- later update — including an accidental second press of Reset, which
    -- would quietly replace when the attempt was actually set aside. The
    -- reason stays editable, because correcting or adding one is legitimate.
    new.voided_at := old.voided_at;
    new.voided_by := old.voided_by;
  elsif old.voided_at is not null and new.voided_at is null then
    -- Un-voiding is deliberately allowed — a reset pressed by mistake should
    -- be recoverable — and it clears the stamp rather than keeping a stale one.
    new.voided_by := null;
    new.void_reason := null;
  end if;
  return new;
end;
$$;

drop trigger if exists exam_attempts_stamp_void on public.exam_attempts;
create trigger exam_attempts_stamp_void
  before update on public.exam_attempts
  for each row execute function public.stamp_void();


-- ============================================================================
-- 3. A voided attempt must stop blocking the next one
-- ============================================================================
-- The unique index enforces one SUBMITTED attempt per email. A voided
-- submitted attempt would otherwise keep the candidate locked out for good —
-- the reset would record itself and change nothing.

drop index if exists public.exam_attempts_one_submitted_per_email;
create unique index if not exists exam_attempts_one_submitted_per_email
  on public.exam_attempts (email)
  where submitted_at is not null and voided_at is null;


-- ============================================================================
-- 4. exam_start ignores voided attempts
-- ============================================================================
-- Same function as 2026-08-08-2, with one added condition on the lookup: a
-- voided attempt is not "the attempt this email holds". Without this the
-- candidate is still told already_taken, or resumes the sitting that was just
-- reset.

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
      and a.voided_at is null          -- a reset attempt no longer counts
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
    -- A bank that cannot fill a draw is a setup problem, and it should say so
    -- rather than fail on a not-null constraint. Reachable by a project that
    -- has not run the seed, or a pool retired below the draw size.
    if v_qids is null or array_length(v_qids, 1) < v_draw then
      return jsonb_build_object('error', 'bank_too_small');
    end if;
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


-- ============================================================================
-- 5. exam_submit refuses a voided attempt
-- ============================================================================
-- A candidate holding a page open when an admin resets them would otherwise
-- submit into the voided row minutes later, quietly resurrecting a score that
-- was supposed to be set aside.

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
  if v_attempt.voided_at is not null then
    return jsonb_build_object('error', 'voided');
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

commit;
