-- ---------------------------------------------------------------------------
-- FTO exit-survey pushes: stop refusing them.
--
-- The bug. A new hire often fills in the exit survey on their FTO's device, so
-- FTOs may write `surveys` ("fto writes ride-along collections"). FTOs may not
-- read surveys, on purpose — they carry unredacted feedback about the FTO
-- (2026-08-01-scoped-reads-and-aemt.sql). But the sync engine pushes with an
-- upsert, INSERT … ON CONFLICT DO UPDATE, and Postgres refuses an upsert
-- whose row the writer cannot see. So every survey pushed from an FTO's
-- signed-in device was refused; the app treated the refusal as permanent,
-- dropped it from the queue and showed "needed permissions this account
-- doesn't have". The survey stayed on that one device and never reached the
-- administrator. Surveys from a new hire's own phone were unaffected: a new
-- hire can read the surveys they wrote.
--
-- The fix gives an FTO the same thing a new hire already has: read access to
-- the survey rows their own account wrote. That is content already on their
-- device, because it was typed there. It is not access to surveys in general:
--
--   * a survey a trainee filed on their own phone is stamped with the
--     trainee's id and stays invisible to every FTO
--   * so does any survey an administrator has since edited or removed —
--     updated_by moves to the administrator — and because an upsert also
--     needs the EXISTING row to be visible, an FTO's device cannot overwrite
--     or resurrect it
--
-- `updated_by` is stamped by the records_stamp trigger before any policy is
-- checked, so it cannot be supplied by a client.
--
-- The app re-sends the surveys earlier refusals left stranded on FTO devices,
-- once, after this is applied (lib/sync.ts, requeueStrandedSurveys).
--
-- Apply in the SQL Editor after 2026-10-26-1. Safe to re-run.
-- ---------------------------------------------------------------------------

drop policy if exists "fto reads surveys they filed" on public.records;
create policy "fto reads surveys they filed"
  on public.records for select
  to authenticated
  using (
    public.current_role() = 'fto'
    and collection = 'surveys'
    and updated_by = auth.uid()
  );

-- ----- verify ----------------------------------------------------------------
--
-- Expect one row, PERMISSIVE / SELECT.
--
-- select policyname, permissive, cmd
--   from pg_policies
--  where schemaname = 'public' and tablename = 'records'
--    and policyname = 'fto reads surveys they filed';

-- ----- down ------------------------------------------------------------------
-- DO NOT RUN unless undoing this migration. FTO survey pushes are refused
-- again afterwards.
--
--   drop policy if exists "fto reads surveys they filed" on public.records;
