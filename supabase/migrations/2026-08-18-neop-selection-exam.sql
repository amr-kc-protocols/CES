-- ---------------------------------------------------------------------------
-- The NEOP selection exam: a second program on the exam engine.
--
-- WHY A SECOND PROGRAM RATHER THAN A SECOND SET OF TABLES. Everything that
-- makes the AEMT exam trustworthy is in the plumbing, not the questions: the
-- bank and the key never leave the database, grading happens server-side, the
-- clock is enforced where a candidate cannot edit it, one draw per person ever,
-- an attempt is voided rather than deleted, and the signed integrity statement
-- is stored with a hash of its own wording. A parallel set of tables for the
-- new-hire exam would be a second copy of all of that, and the copy would be
-- the one that rots. So exam_questions and exam_attempts both grow a `program`
-- column and the two functions take a program argument.
--
-- WHAT IS ACTUALLY NEW, and it is not cosmetic:
--
--   SECTIONS. The NEOP exam is three sections that are not interchangeable —
--   patient care, understanding of the Kansas City interfacility operation,
--   and what the candidate actually wants from the job. The draw is stratified
--   so every candidate gets the same shape of exam rather than whatever 36
--   random items happened to come up.
--
--   UNSCORED ITEMS. The preference section has no answer key, and cannot be
--   given one: `answer` becomes nullable, `scored` is GENERATED from it, and
--   exam_submit skips anything that is not scored. An item with no key cannot
--   be accidentally scored against a candidate, because there is nothing in
--   the row to score it against.
--
--   `code`. A stable identifier per item. The AEMT bank has none, which is why
--   its corrections file has to match on stem text and says so at length. The
--   interview probes for the preference items are keyed to these codes.
--
-- SAFE TO RE-RUN. One transaction: a half-applied state here would be a
-- stratified draw against a bank with no sections, which fails at the moment a
-- candidate presses Start.
--
-- The AEMT exam is untouched by design. Existing rows default to
-- program = 'aemt'; its draw, cutoff, clock and one-attempt rule behave exactly
-- as before, and an attempt already in flight is unaffected.
-- ---------------------------------------------------------------------------

begin;


-- ============================================================================
-- 1. The bank grows a program, sections, stable codes, and unscored items
-- ============================================================================

alter table public.exam_questions
  add column if not exists program text not null default 'aemt',
  add column if not exists section text,
  add column if not exists code text;

alter table public.exam_questions drop constraint if exists exam_questions_program_check;
alter table public.exam_questions add constraint exam_questions_program_check
  check (program in ('aemt', 'neop'));

alter table public.exam_questions drop constraint if exists exam_questions_section_check;
alter table public.exam_questions add constraint exam_questions_section_check
  check (section is null or section in ('clinical', 'operations', 'fit'));

-- A NEOP item without a section cannot be drawn — the draw is per section —
-- so it would sit in the bank looking loaded and never be served.
alter table public.exam_questions drop constraint if exists exam_questions_neop_has_section;
alter table public.exam_questions add constraint exam_questions_neop_has_section
  check (program <> 'neop' or section is not null);

-- The key becomes optional, and its absence is what makes an item unscored.
alter table public.exam_questions alter column answer drop not null;

-- Unscored items live in the preference section and nowhere else, in both
-- directions: a keyed preference item would be scoring somebody's stated
-- ambitions, and an unkeyed item anywhere else is a question that quietly
-- counts for nothing.
alter table public.exam_questions drop constraint if exists exam_questions_unscored_is_fit;
alter table public.exam_questions add constraint exam_questions_unscored_is_fit
  check ((answer is null) = (section is not distinct from 'fit'));

-- Generated, not maintained. There is no way to have a row whose `scored` flag
-- disagrees with whether it has an answer.
alter table public.exam_questions
  add column if not exists scored boolean
  generated always as (answer is not null) stored;

create unique index if not exists exam_questions_code_idx
  on public.exam_questions (code) where code is not null;

create index if not exists exam_questions_draw_idx
  on public.exam_questions (program, section) where active;


-- ============================================================================
-- 2. Attempts record which exam was sat
-- ============================================================================

alter table public.exam_attempts
  add column if not exists program text not null default 'aemt';

alter table public.exam_attempts drop constraint if exists exam_attempts_program_check;
alter table public.exam_attempts add constraint exam_attempts_program_check
  check (program in ('aemt', 'neop'));

-- One attempt per email PER PROGRAM. Without the program in the key, an
-- internal EMT who sat the AEMT selection exam could never sit the new-hire
-- exam, and the failure would look like "you have already taken this" to
-- somebody who has not.
drop index if exists public.exam_attempts_one_submitted_per_email;
create unique index if not exists exam_attempts_one_submitted_per_email_program
  on public.exam_attempts (email, program)
  where submitted_at is not null and voided_at is null;

create index if not exists exam_attempts_program_idx on public.exam_attempts (program);


-- ============================================================================
-- 3. exam_start — per-program configuration and a stratified draw
-- ============================================================================
-- The old five-argument signature is DROPPED rather than left in place.
-- Creating the six-argument version beside it would leave two overloads, and
-- every call would fail with "function exam_start(unknown, unknown) is not
-- unique" — the exact failure the migration README warns about. p_program
-- defaults to 'aemt', so a browser still running the previous build calls the
-- new function successfully and gets the AEMT exam it asked for.

drop function if exists public.exam_start(text, text, boolean, text, text);

create or replace function public.exam_start(
  p_name text,
  p_email text,
  p_attested boolean default null,
  p_signature text default null,
  p_attestation_hash text default null,
  p_program text default 'aemt'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email   text := lower(trim(p_email));
  v_name    text := trim(p_name);
  v_sign    text := nullif(trim(coalesce(p_signature, '')), '');
  v_program text := coalesce(nullif(trim(p_program), ''), 'aemt');
  -- Per-program configuration. The AEMT row is the existing behavior,
  -- unchanged: 17 August cutoff, 25 minutes, 50 items drawn at random.
  --
  -- NEOP has NO CUTOFF because hiring is rolling — a new-hire exam that closes
  -- on a date is an exam that silently stops working for every applicant after
  -- it, which is worse than any deadline it was meant to enforce.
  v_cutoff  timestamptz;
  v_limit   int;
  v_draw    int;
  v_clin    int;
  v_ops     int;
  v_have    int;
  v_attempt public.exam_attempts;
  v_qids    bigint[];
  v_total   int;
  v_questions jsonb;
begin
  if v_program not in ('aemt', 'neop') then
    return jsonb_build_object('error', 'Unknown exam.');
  end if;
  if v_name = '' or v_email = '' then
    return jsonb_build_object('error', 'Name and email are required.');
  end if;

  if v_program = 'aemt' then
    v_cutoff := '2026-08-17 17:00:00-05';   -- Aug 17, 5 PM Central
    v_limit  := 25 * 60;
    v_draw   := 50;
  else
    v_cutoff := null;                       -- rolling
    v_limit  := 30 * 60;
    v_clin   := 12;
    v_ops    := 16;                         -- every fit item is served
  end if;

  if v_cutoff is not null and now() > v_cutoff then
    return jsonb_build_object('error', 'closed');
  end if;

  select * into v_attempt from public.exam_attempts a
    where a.email = v_email
      and a.program = v_program
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
    if v_program = 'aemt' then
      select array_agg(id) into v_qids
        from (select id from public.exam_questions
               where active and program = 'aemt'
               order by random() limit v_draw) s;
      if v_qids is null or array_length(v_qids, 1) < v_draw then
        return jsonb_build_object('error', 'bank_too_small');
      end if;
    else
      -- Stratified: a fixed number from each scored section, then EVERY
      -- preference item. The preference items are not sampled — an interviewer
      -- comparing two candidates needs them to have answered the same
      -- questions, and a random subset of eleven takes that away.
      select count(*) into v_have from public.exam_questions
        where active and program = 'neop' and section = 'clinical';
      if v_have < v_clin then return jsonb_build_object('error', 'bank_too_small'); end if;
      select count(*) into v_have from public.exam_questions
        where active and program = 'neop' and section = 'operations';
      if v_have < v_ops then return jsonb_build_object('error', 'bank_too_small'); end if;
      select count(*) into v_have from public.exam_questions
        where active and program = 'neop' and section = 'fit';
      if v_have < 1 then return jsonb_build_object('error', 'bank_too_small'); end if;

      with picked as (
        select id, 1 as sect_ord from (
          select id from public.exam_questions
           where active and program = 'neop' and section = 'clinical'
           order by random() limit v_clin) c
        union all
        select id, 2 from (
          select id from public.exam_questions
           where active and program = 'neop' and section = 'operations'
           order by random() limit v_ops) o
        union all
        select id, 3 from public.exam_questions
         where active and program = 'neop' and section = 'fit'
      )
      select array_agg(id order by sect_ord, random()) into v_qids from picked;
    end if;

    -- Only keyed items count toward the score, so only keyed items count
    -- toward the total. Otherwise a candidate who answers every scored item
    -- correctly is recorded at 78%.
    select count(*) into v_total from public.exam_questions
      where id = any(v_qids) and scored;
    if coalesce(v_total, 0) = 0 then
      return jsonb_build_object('error', 'bank_too_small');
    end if;

    insert into public.exam_attempts (
      name, email, question_ids, total, limit_seconds, program,
      attested, signature, attested_at, attestation_hash)
      values (
        v_name, v_email, v_qids, v_total, v_limit, v_program,
        p_attested, v_sign,
        case when p_attested is true then now() else null end,
        nullif(trim(coalesce(p_attestation_hash, '')), ''))
      returning * into v_attempt;
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'id', q.id, 'domain', q.domain, 'stem', q.stem, 'options', q.options,
             'section', q.section, 'scored', q.scored)
           order by array_position(v_qids, q.id))
    into v_questions
    from public.exam_questions q
    where q.id = any(v_qids);

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'startedAt', v_attempt.started_at,
    'limitSeconds', v_attempt.limit_seconds,
    'program', v_attempt.program,
    'questions', coalesce(v_questions, '[]'::jsonb));
end;
$$;

revoke all on function public.exam_start(text, text, boolean, text, text, text) from public;
grant execute on function public.exam_start(text, text, boolean, text, text, text) to anon, authenticated;


-- ============================================================================
-- 4. exam_submit — grade the keyed items, keep the rest
-- ============================================================================
-- Unscored responses are STORED and not graded. They are the whole point of
-- the preference section: the interviewer reads them beside the candidate's
-- name, and nothing about them touches the score.

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
    -- No key, no marks. A preference item cannot be scored even by accident.
    if v_ans is null then
      continue;
    end if;
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


-- ============================================================================
-- Load the questions
-- ============================================================================
-- Then run supabase/neop_exam_questions_seed.sql, which loads only
-- program = 'neop' rows and leaves the AEMT bank alone.


-- ============================================================================
-- Revert
-- ============================================================================
-- Removes the NEOP program and restores the previous behavior. It deletes the
-- NEOP bank and any NEOP attempts with it, so take a copy of exam_attempts
-- first if anybody has sat it.
--
-- begin;
-- delete from public.exam_attempts where program = 'neop';
-- delete from public.exam_questions where program = 'neop';
-- alter table public.exam_questions
--   drop constraint if exists exam_questions_unscored_is_fit,
--   drop constraint if exists exam_questions_neop_has_section,
--   drop constraint if exists exam_questions_section_check,
--   drop constraint if exists exam_questions_program_check,
--   drop column if exists scored,
--   drop column if exists code,
--   drop column if exists section,
--   drop column if exists program;
-- alter table public.exam_questions alter column answer set not null;
-- drop index if exists public.exam_attempts_one_submitted_per_email_program;
-- create unique index if not exists exam_attempts_one_submitted_per_email
--   on public.exam_attempts (email) where submitted_at is not null and voided_at is null;
-- alter table public.exam_attempts
--   drop constraint if exists exam_attempts_program_check,
--   drop column if exists program;
-- -- then re-create exam_start / exam_submit from schema.sql as they stood before.
-- commit;
