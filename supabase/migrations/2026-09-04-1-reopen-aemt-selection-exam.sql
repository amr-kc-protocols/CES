-- ---------------------------------------------------------------------------
-- Reopen the AEMT selection exam. New close: Sunday 6 September 2026, 11:59 PM
-- Central.
--
-- The old cutoff was 17 August and has passed, so exam_start has been returning
-- 'closed' to every candidate since.
--
-- WHY THIS IS A WHOLE FUNCTION FOR A ONE-LINE CHANGE. The cutoff is a constant
-- inside exam_start, and Postgres replaces a function body whole. This is the
-- definition from 2026-08-19-neop-exam-sections-and-clock.sql with v_cutoff
-- moved and nothing else touched.
--
-- THE CLIENT COPY MOVES WITH IT. src/lib/exam.ts carries deadlineIso so a
-- candidate can be told the date before they start, and that constant is
-- changed in the same commit. The server is what enforces; the client is what
-- explains. They have drifted before — the instructions advertised 40 minutes
-- for a week after the server moved to 25 — and a deadline is worse to get
-- wrong than a duration, because a candidate who reads the old date does not
-- come back.
--
-- exam_submit is deliberately NOT touched. It bounds an attempt on its own
-- window — started_at + limit_seconds + grace — so somebody who starts at 11:55
-- PM on the 6th still gets their full 25 minutes. Adding a second deadline test
-- there would cut them off mid-exam.
--
-- NEOP is unaffected: it is rolling and its cutoff stays null.
-- ---------------------------------------------------------------------------

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
  -- 6 September cutoff, 25 minutes, 50 items drawn at random.
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
    v_cutoff := '2026-09-06 23:59:00-05';   -- Sun 6 Sep 2026, 11:59 PM Central
    v_limit  := 25 * 60;
    v_draw   := 50;
  else
    v_cutoff := null;                       -- rolling
    v_limit  := 35 * 60;
    v_clin   := 12;
    v_ops    := 16;                         -- every preference item is served
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
      -- questions, and a random subset takes that away.
      --
      -- sect_ord 1/2/3 is patient care, then preferences, then our operation.
      -- See the header: the operations section is the one that tells a
      -- candidate what we want to hear, so it comes after we have asked.
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
        select id, 2 from public.exam_questions
         where active and program = 'neop' and section = 'fit'
        union all
        select id, 3 from (
          select id from public.exam_questions
           where active and program = 'neop' and section = 'operations'
           order by random() limit v_ops) o
      )
      select array_agg(id order by sect_ord, random()) into v_qids from picked;
    end if;

    -- Only keyed items count toward the score, so only keyed items count
    -- toward the total. Otherwise a candidate who answers every scored item
    -- correctly is recorded at 68%.
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
