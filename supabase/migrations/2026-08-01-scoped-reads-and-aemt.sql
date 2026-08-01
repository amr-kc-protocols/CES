-- ---------------------------------------------------------------------------
-- Scoped reads, and the AEMT program on the server.
--
-- Two changes, both about the same thing: who can see what.
--
-- 1. The read policy was `using (true)` — every signed-in user could read every
--    collection. Write policies were correctly scoped by role; reads were not
--    scoped at all. That matters more than it looks, because the sync engine
--    pulls everything a user can read down onto their device: an FTO's phone
--    held a full copy of anything in the workspace, whatever the UI showed.
--
--    Most visibly, FTOs could read `surveys` — the new-hire exit surveys that
--    carry unredacted feedback about FTOs. The History screen is admin-only in
--    the app for exactly that reason, and the database was undoing it.
--
-- 2. The AEMT collections did not sync at all, so the certification records,
--    the audit trail and the completion verifications lived in one browser's
--    localStorage with a three-year retention obligation on them. They sync
--    now, admin-only for both read and write.
--
-- Apply in the SQL Editor. Safe to re-run. Reversible — the old behaviour is
-- one `using (true)` policy away, and the down-migration is at the bottom.
-- ---------------------------------------------------------------------------

-- ----- 1. scoped reads -------------------------------------------------------

drop policy if exists "records readable by signed-in users" on public.records;

create policy "records readable by role"
  on public.records for select
  to authenticated
  using (
    -- Admin sees the whole workspace.
    public.current_role() = 'admin'

    -- FTOs see the ride-along working set and the schedule around it. Not
    -- `surveys` (feedback about them), not the AEMT program, not QA.
    or (
      public.current_role() = 'fto'
      and collection in (
        'cohorts',
        'trainees',
        'days',
        'arrangements',
        'customSessions',
        'attendance',
        'rides',
        'evals',
        'skills',
        'settings'
      )
    )

    -- New hires see the schedule, and their own survey only. `updated_by` is
    -- stamped server-side by the records_stamp trigger, so this cannot be
    -- spoofed from a client.
    or (
      public.current_role() = 'newhire'
      and (
        collection in ('cohorts', 'days', 'arrangements', 'customSessions', 'settings')
        or (collection = 'surveys' and updated_by = auth.uid())
      )
    )
  );

-- ----- 2. AEMT collections ---------------------------------------------------
--
-- Admin-only, both directions. The AEMT program holds Kansas certification
-- records, student certificate numbers, and cohort-selection data about staff
-- who are peers of the FTOs using this app daily.
--
-- The read policy above already excludes them from every non-admin role by
-- omission. These policies cover writes, which would otherwise fall through to
-- the existing "admin writes all records" policy — correct today, but stated
-- explicitly here so that adding a role later cannot quietly grant AEMT access.

create or replace function public.is_aemt_collection(c text)
returns boolean
language sql
immutable
as $$
  select c in (
    'aemtCourses',
    'aemtStudents',
    'aemtSessions',
    'aemtAttendance',
    'aemtEncounters',
    'aemtShifts',
    'aemtDeadlines',
    'aemtSkillChecks',
    'aemtFormResponses',
    'aemtCompletions',
    'aemtRecordDocs',
    'aemtAudit',
    'aemtCandidates'
  );
$$;

drop policy if exists "aemt is admin only for insert" on public.records;
create policy "aemt is admin only for insert"
  on public.records for insert
  to authenticated
  with check (
    not public.is_aemt_collection(collection)
    or public.current_role() = 'admin'
  );

drop policy if exists "aemt is admin only for update" on public.records;
create policy "aemt is admin only for update"
  on public.records for update
  to authenticated
  using (
    not public.is_aemt_collection(collection)
    or public.current_role() = 'admin'
  );

-- ----- notes -----------------------------------------------------------------
--
-- The audit trail is append-only by design in the app. Postgres cannot express
-- that here without a per-collection rule, because `records` is one table for
-- everything and update permission is granted collection-wide. An admin can
-- still overwrite an audit row through the API. That is a known limit, not an
-- oversight — closing it properly means a separate append-only table with no
-- update policy, which is worth doing before the first real KBEMS submission.
--
-- Candidate selection data (`aemtCandidates`) is employment data with a
-- different retention obligation from the program records, and it is in this
-- shared workspace only because that is where the app's sync lives. Consider
-- whether it belongs here at all.

-- ----- down ------------------------------------------------------------------
-- To revert:
--
--   drop policy if exists "records readable by role" on public.records;
--   drop policy if exists "aemt is admin only for insert" on public.records;
--   drop policy if exists "aemt is admin only for update" on public.records;
--   create policy "records readable by signed-in users"
--     on public.records for select to authenticated using (true);
