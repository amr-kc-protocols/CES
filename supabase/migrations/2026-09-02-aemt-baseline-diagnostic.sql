-- ---------------------------------------------------------------------------
-- The AEMT day-one baseline diagnostic: a third program on the exam engine.
--
-- WHY A THIRD PROGRAM. The same reasoning as the NEOP migration — the value is
-- in the plumbing, not the questions. The bank and the key never leave the
-- database, grading is server-side, the clock is enforced where a candidate
-- cannot reach it. A separate mechanism for the diagnostic would be a second
-- copy of that, and the copy is the one that rots.
--
-- WHAT MAKES IT DIFFERENT FROM THE OTHER TWO. Both existing banks are
-- SELECTION instruments: they decide who gets in. This one decides nothing. It
-- is given on the first morning to students already enrolled, it is ungraded by
-- design, and its only job is to seed the per-student domain tracker so every
-- later measurement has a zero point to move against. A diagnostic that counted
-- would teach students to protect a score instead of showing what they do not
-- know, which is the opposite of what it is for.
--
-- Its domains are the six certification-exam blueprint domains rather than the
-- ad-hoc labels the AEMT selection bank uses, because the tracker scores
-- against the blueprint and a per-domain number that does not map to it means
-- nothing.
--
-- ADDITIVE and REVERSIBLE. No existing row is touched. exam_questions.id is
-- referenced by exam_attempts.question_ids, so nothing here deletes.
-- ---------------------------------------------------------------------------

alter table public.exam_questions drop constraint if exists exam_questions_program_check;
alter table public.exam_questions add constraint exam_questions_program_check
  check (program in ('aemt', 'neop', 'aemt-baseline'));

alter table public.exam_attempts drop constraint if exists exam_attempts_program_check;
alter table public.exam_attempts add constraint exam_attempts_program_check
  check (program in ('aemt', 'neop', 'aemt-baseline'));

-- The existing section constraint only ever applied to NEOP, and a baseline
-- item carries no section. Restated here so the intent survives a reader who
-- arrives at this file first.
--   exam_questions_neop_has_section:   program <> 'neop' or section is not null
--   exam_questions_unscored_is_fit:    (answer is null) = (section is 'fit')
-- A baseline item has a key and no section, which satisfies both.
