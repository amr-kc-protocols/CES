-- ---------------------------------------------------------------------------
-- AEMT selection exam: actually store the integrity agreement.
--
-- The start screen shows an Integrity Statement, a tick box reading "I have
-- read, understand, and agree to this statement", and a field headed "Sign by
-- typing your full name". Above them it says:
--
--     "Starting this exam is your signed agreement to the following"
--
-- Neither the tick nor the signature was ever sent anywhere. exam_start took a
-- name and an email and nothing else, so the browser collected both and threw
-- them away.
--
-- That is worse than not asking. The page asserts to a candidate that a record
-- exists, and if an attempt is ever questioned — a disqualification, a dispute
-- over somebody's place in a cohort — there is nothing to produce. An
-- agreement nobody kept is not an agreement; it is a screenshot of one.
--
-- This stores what the screen already claims to be capturing, and records the
-- wording it was given against, so a future edit to the statement cannot
-- silently rewrite what a past candidate agreed to.
--
-- ATTEMPTS ALREADY SUBMITTED CANNOT BE BACKFILLED. Their agreement was
-- collected in a browser and discarded; no amount of schema recovers it. Those
-- rows keep a null attestation, which is the honest record: it says the
-- agreement was not captured rather than implying one was.
--
-- Apply in the SQL Editor. Safe to re-run. Run top to bottom.
-- ---------------------------------------------------------------------------

begin;


-- ============================================================================
-- 1. Columns
-- ============================================================================
-- Null means "not captured", which is exactly true of every attempt taken
-- before this ran. A default of false would claim the candidate declined,
-- which is a different and untrue statement.

alter table public.exam_attempts
  add column if not exists attested boolean,
  add column if not exists signature text,
  add column if not exists attested_at timestamptz,
  -- The statement text the candidate actually saw, hashed. Storing the hash
  -- rather than the prose keeps the row small while still making it provable
  -- that the wording has not changed underneath them.
  add column if not exists attestation_hash text;


-- ============================================================================
-- 2. exam_start accepts and records the agreement
-- ============================================================================
-- Optional parameters with defaults, so the function keeps working for any
-- client that has not been updated yet and this migration can be applied
-- before the app is deployed rather than after.
--
-- The agreement is recorded ON THE ATTEMPT AT START, because that is the
-- moment the screen describes: "starting this exam is your signed agreement".
-- A resumed attempt keeps the agreement it began with; it is not re-signed.

-- The old two-argument version must GO, not sit alongside.
--
-- Adding the five-argument form next to it creates an overload set, and a
-- two-argument call then matches both: PostgreSQL answers "function
-- exam_start(unknown, unknown) is not unique" and refuses to pick. Every
-- attempt to start the exam would fail — for every candidate, immediately, on
-- a live window. Testing caught it; reading would not have.
--
-- Dropping it is also the better compatibility story. One function with
-- defaults accepts BOTH call shapes, so a client that sends only a name and
-- an email still starts an exam and simply records no attestation.
drop function if exists public.exam_start(text, text);

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


commit;
