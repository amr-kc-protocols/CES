-- ---------------------------------------------------------------------------
-- AEMT selection exam: enforce the rules on the server, and tighten the clock.
--
-- The exam was already cheat-resistant in the way that matters most — the bank
-- and the answers never leave the database, and candidates reach it only
-- through two SECURITY DEFINER functions. What was missing is that every rule
-- lived in exam_start and exam_submit re-checked none of them, so the parts a
-- candidate controls were the parts that were trusted.
--
-- THREE HOLES THIS CLOSES
--
-- 1. THE TIME LIMIT WAS CLIENT-SIDE ONLY. exam_submit never compared
--    started_at to now(). The countdown in the browser auto-submits at zero,
--    but that is the candidate's own browser: close the tab, research at
--    leisure, submit tomorrow. The limit is now enforced where it cannot be
--    edited.
--
-- 2. THE BANK COULD BE ENUMERATED. "One attempt per email" only blocked
--    candidates who had already SUBMITTED. The resume branch matched
--    unfinished attempts newer than the limit; once an attempt aged past it,
--    exam_start built a brand-new attempt with a fresh random draw of 50 from
--    120. Wait out the clock, start again, see 50 more — repeat a few times
--    and most of the bank is visible with nothing recorded against you, then
--    submit once with the answers researched. The draw now happens exactly
--    once per email, ever.
--
-- 3. NOTHING BOUNDED A LATE SUBMISSION. The cutoff was checked on start only.
--    It is now bounded by the attempt's own window instead, which is both
--    tighter and fairer — see "the cutoff governs starting" below.
--
-- AND A SHORTER CLOCK
--
-- 40 minutes for 50 recall items is 48 seconds each. The bank asks things like
-- "normal adult resting respiratory rate is" — a candidate who knows the
-- material answers in ten seconds and one who does not is not going to
-- retrieve it in fifty. The generous half of that window was time to look
-- things up. Now 25 minutes, or 30 seconds an item.
--
-- WHAT THIS DOES TO ATTEMPTS ALREADY IN FLIGHT: nothing. The allowance is now
-- recorded ON the attempt when it starts, and enforcement reads that stored
-- value. Anyone who started under the 40-minute rule keeps 40 minutes; only
-- attempts started after this runs get 25. Retroactively shortening someone's
-- exam because an administrator changed a constant mid-sitting would be the
-- wrong kind of correct.
--
-- Apply in the SQL Editor. Safe to re-run. Run top to bottom. The whole file
-- is one transaction, so it either applies completely or not at all — a
-- half-applied state here would mean hardened functions guarding an
-- unconstrained table, which reads as fixed and is not.
-- ---------------------------------------------------------------------------

begin;


-- ============================================================================
-- 0. Preflight: refuse to run if the data cannot satisfy the new constraint
-- ============================================================================
-- Section 2 adds a unique index over submitted attempts per email. If two
-- already exist — the old EXISTS check had a race that could let two
-- simultaneous starts through — CREATE UNIQUE INDEX fails, and it fails in
-- the middle of the file rather than at the start.
--
-- This stops first, and says which candidates are affected. Resolving it means
-- deciding which attempt counts, and that is a decision about a real person's
-- selection score. It is not something a migration should make quietly.

do $$
declare
  v_dupes text;
begin
  select string_agg(email || ' (' || n || ' submitted)', ', ' order by email)
    into v_dupes
    from (select email, count(*) n from public.exam_attempts
           where submitted_at is not null group by email having count(*) > 1) d;
  if v_dupes is not null then
    raise exception
      'Cannot apply: more than one SUBMITTED attempt exists for %. '
      'Decide which attempt stands (normally the earliest — it is the one they '
      'sat), delete the others, then re-run this file. Nothing has been changed.',
      v_dupes;
  end if;
end $$;


-- ============================================================================
-- 1. Record the allowance on the attempt
-- ============================================================================
-- Existing rows default to 2400 (the 40 minutes they were granted). New rows
-- get whatever exam_start writes, so changing the cap later never reaches
-- backwards into a sitting that has already begun.

alter table public.exam_attempts
  add column if not exists limit_seconds int not null default 2400;


-- ============================================================================
-- 2. One submitted attempt per email, enforced by the database
-- ============================================================================
-- exam_start tested this with an EXISTS, which two concurrent starts can both
-- pass. The index is what actually makes it true. Partial, so the unfinished
-- attempts an email may accumulate from a resume are unaffected.

create unique index if not exists exam_attempts_one_submitted_per_email
  on public.exam_attempts (email)
  where submitted_at is not null;


-- ============================================================================
-- 3. exam_start — draw once per email, ever
-- ============================================================================

create or replace function public.exam_start(p_name text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text := lower(trim(p_email));
  v_name   text := trim(p_name);
  v_cutoff constant timestamptz := '2026-08-17 17:00:00-05';  -- Aug 17, 5 PM Central
  -- 50 items at 30 seconds each. See the header for why this came down.
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

  -- The most recent attempt this email holds, in any state. One row is the
  -- whole story: there is no path that creates a second one.
  select * into v_attempt from public.exam_attempts a
    where a.email = v_email
    order by a.started_at desc limit 1;

  if found then
    if v_attempt.submitted_at is not null then
      return jsonb_build_object('error', 'already_taken');
    end if;
    -- Unfinished. Resume it with THE SAME QUESTIONS if the clock is still
    -- running; otherwise the attempt is spent. Previously this branch fell
    -- through to a fresh draw, which is what made the bank enumerable.
    if now() > v_attempt.started_at + make_interval(secs => v_attempt.limit_seconds) then
      return jsonb_build_object('error', 'expired');
    end if;
    v_qids := v_attempt.question_ids;
  else
    select array_agg(id) into v_qids
      from (select id from public.exam_questions where active order by random() limit v_draw) s;
    insert into public.exam_attempts (name, email, question_ids, total, limit_seconds)
      values (v_name, v_email, v_qids, coalesce(array_length(v_qids, 1), 0), v_limit)
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
    -- The attempt's own allowance, not the current constant, so a resumed
    -- attempt counts down the window it was actually granted.
    'limitSeconds', v_attempt.limit_seconds,
    'questions', coalesce(v_questions, '[]'::jsonb));
end;
$$;

revoke all on function public.exam_start(text, text) from public;
grant execute on function public.exam_start(text, text) to anon, authenticated;


-- ============================================================================
-- 4. exam_submit — enforce the clock here too
-- ============================================================================
-- THE CUTOFF GOVERNS STARTING, NOT SUBMITTING. A candidate who begins at 4:55
-- PM has legitimately begun, and their window runs past 5:00. Rejecting that
-- submission would punish them for the hour they chose rather than for
-- anything they did. The attempt's own limit is the bound, which caps a late
-- submission at cutoff + limit + grace and needs no second deadline test.
--
-- THE GRACE PERIOD IS NOT SLACK. The browser auto-submits AT zero, so the
-- request is already in flight when the clock runs out; a slow network or a
-- retry would otherwise fail an honest candidate on the last question. Sixty
-- seconds covers transit, not another answer.

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


-- ============================================================================
-- 5. Resetting a candidate after a genuine technical failure
-- ============================================================================
-- One attempt per email is now absolute, so a candidate whose laptop died at
-- minute two is locked out until an admin clears the row. No new tooling is
-- needed — the existing "admin manages exam attempts" policy already allows
-- it. Run as the admin, with the candidate's email:
--
--   delete from public.exam_attempts
--    where email = lower(trim('candidate@example.com'))
--      and submitted_at is null;
--
-- Deliberately not automatic. A reset is a decision about one person, and it
-- should leave a human who made it.

commit;
