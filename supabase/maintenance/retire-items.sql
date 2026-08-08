-- ---------------------------------------------------------------------------
-- Retiring exam items.  NOT A MIGRATION — read it, then run it deliberately.
--
-- This lives apart from supabase/migrations on purpose. A migration is a
-- structural change that should run the same way everywhere. Deciding which
-- questions a selection exam asks is a content judgement about a live
-- instrument, and it should be made by a person looking at the items, not
-- applied by anything that runs automatically.
--
-- WHY RETIRE RATHER THAN EDIT: rewriting a clinical item means deciding what
-- the correct answer is. That is a Medical Director's call, not a developer's
-- and not a tool's. Setting `active = false` removes an item from the draw
-- without anybody having to invent a replacement key, and it is reversible.
--
-- WHAT RETIRING DOES NOT DO: it does not touch attempts already taken.
-- exam_attempts.question_ids still references retired items, and their scores
-- still stand — which is correct, because those candidates really were asked
-- those questions. It only stops the item being served again.
-- ---------------------------------------------------------------------------


-- ============================================================================
-- STEP 1 — LOOK AT THEM FIRST
-- ============================================================================
-- Item numbers come from the review export and are the database ids. Run this
-- and read every stem before running step 2. If a stem does not match what the
-- review described, the numbering has drifted and the id list is wrong — stop,
-- and match on the text instead.

select id,
       domain,
       stem,
       options[answer + 1] as keyed_answer,
       active
  from public.exam_questions
 where id in (123, 162, 191, 192, 197, 203, 204, 217, 228, 232, 236, 237)
 order by id;


-- ============================================================================
-- STEP 2 — RETIRE THEM
-- ============================================================================
-- The twelve items the content review flagged as requiring revision before
-- use. Several key an answer that is out of step with current guidance — a
-- candidate who knows the current standard is marked WRONG, which is the worst
-- failure a selection item can have. The rest are structurally unsound
-- (an answer that restates the stem, a ratio expression better written as a
-- concentration, an "only if" that is not only-if).
--
-- Uncomment to run.

-- update public.exam_questions
--    set active = false
--  where id in (123, 162, 191, 192, 197, 203, 204, 217, 228, 232, 236, 237);


-- ============================================================================
-- STEP 3 — CHECK WHAT IS LEFT
-- ============================================================================
-- exam_start draws 50. The active pool must stay at or above that or the draw
-- returns short and candidates sit different-length exams.

select count(*) filter (where active)     as active_items,
       count(*) filter (where not active) as retired_items,
       count(*)                           as total,
       case when count(*) filter (where active) < 50
            then 'TOO FEW — the draw of 50 will come up short'
            when count(*) filter (where active) = 50
            then 'EXACTLY 50 — every candidate now sits the SAME fixed form'
            else 'above 50 — candidates still receive different random draws'
       end as draw_status
  from public.exam_questions;


-- ============================================================================
-- A FIXED FORM NEEDS NO CODE CHANGE
-- ============================================================================
-- The content review recommends that, for a pilot, every candidate sit the
-- same 50 questions with answer order shuffled. That already happens for free
-- once the ACTIVE POOL EQUALS THE DRAW SIZE: exam_start selects 50 at random
-- from the active items, so with exactly 50 active there is only one possible
-- set and everyone gets it.
--
-- Verified: with 50 active items, three candidates received one distinct
-- question set between them, 50 items each, and the serving ORDER still
-- differed per candidate — as do the answer options, which the app shuffles
-- per attempt. That is a fixed form with randomised presentation, which is
-- what was asked for.
--
-- The 50 have to be CHOSEN, though, and that is the subject-matter panel's
-- job, not a query's. Export the bank from the review screen, have the panel
-- classify every item, then retire everything outside the agreed form:
--
--   update public.exam_questions set active = false
--    where id <> all (array[ ...the fifty agreed ids... ]);
--
-- Until that panel has met, leaving the pool above 50 is the honest state:
-- candidates receive different draws, the scores are not strictly comparable,
-- and the cycle should be treated as a pilot rather than a ranking.
