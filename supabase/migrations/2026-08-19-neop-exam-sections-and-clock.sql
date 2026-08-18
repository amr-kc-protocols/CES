-- ---------------------------------------------------------------------------
-- NEOP selection exam: ask what they want BEFORE we spend a quarter of an hour
-- telling them what we want, and give the sitting five more minutes.
--
-- Follows 2026-08-18-neop-selection-exam.sql, which built the exam. Nothing
-- structural changes here — one function is replaced.
--
-- WHY THE ORDER MATTERS. The sections were served patient care, our operation,
-- preferences. The operations section is sixteen questions whose correct
-- answers all describe what this operation values and what it is wary of:
-- that nobody moves onto a 911 truck by waiting here, that a shift where you
-- used no emergency skills is a good day, that we would rather hear it now if
-- scene work is what somebody wants. A candidate reaches the preference items
-- having just been coached, at length and with a score attached, on the
-- answers we would like.
--
-- So the preference items now come second: patient care first as a neutral
-- warm-up that gives nothing away, then what they want, then the operations
-- section. The briefing still precedes all of it and still says plainly what
-- this job is not — that is a deliberate trade, because letting somebody
-- withdraw before the interview is worth more than a clean measurement, and it
-- is why those items lean on what an applicant has already done rather than on
-- what they say they intend.
--
-- AND THE CLOCK. 28 scored items and 13 preference items in 30 minutes was
-- tight enough that a slow reader would be answering the last operations items
-- against a timer, which measures reading speed rather than comprehension. 35.
--
-- The AEMT exam is untouched: its branch of this function is unchanged, and an
-- attempt already in flight keeps the allowance recorded on it when it started.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

begin;

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

revoke all on function public.exam_start(text, text, boolean, text, text, text) from public;
grant execute on function public.exam_start(text, text, boolean, text, text, text) to anon, authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Then re-run supabase/neop_exam_questions_seed.sql: the patient-care section
-- has been rewritten to newly-qualified-EMT scope and the preference items
-- replaced. The seed upserts on `code` and retires what is no longer in the
-- bank, so no attempt already on record is orphaned.
--
-- Revert: re-create exam_start from the 2026-08-18 migration.
-- ---------------------------------------------------------------------------
