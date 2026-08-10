-- ---------------------------------------------------------------------------
-- Editable skill sheets and evaluation forms.
--
-- Adds one collection, `templates`, holding every published version of every
-- instrument (AEMT skill sheets, AEMT evaluation forms, NEOP check-off sheets,
-- the FTO daily evaluation). Two rules, and getting either wrong breaks
-- something quietly:
--
--   READ — everyone who assesses must see it. An FTO who cannot read this
--   collection renders the version bundled with the app while writing records
--   that pin a version number nobody on their device can resolve. The record
--   would then render against the wrong criteria on the very screen that is
--   supposed to prove what was assessed.
--
--   WRITE — administrators only. These instruments are what competency records
--   point at, including the K.A.R. 109-11-8(a)(2) psychomotor record, so anyone
--   able to edit or delete one could change what a past assessment appears to
--   say.
--
-- WRITE POLICIES ARE `as restrictive` ON PURPOSE. Permissive policies for the
-- same command OR together, so a permissive "templates are admin only" clause
-- would be satisfied for an FTO by the existing "fto writes ride-along
-- collections" policy and grant exactly what it was written to prevent. This
-- is the same trap 2026-08-06-markets.sql section 0 fixed for the AEMT
-- collections; the reasoning is spelled out there.
--
-- Idempotent: every policy is dropped before it is created, so a repeated
-- apply is safe.
-- ---------------------------------------------------------------------------


-- ============================================================================
-- 1. Read: add `templates` to every role that assesses
-- ============================================================================
--
-- This restates the policy as it stands after 2026-08-06 section 4, with
-- 'templates' added to the FTO and new-hire lists. Nothing else changes.
--
-- The market fence is a SEPARATE restrictive policy ("market separation",
-- `for all`), so dropping and recreating this permissive read policy does not
-- touch it — an FTO in Wichita still sees only Wichita.

drop policy if exists "records readable by signed-in users" on public.records;
drop policy if exists "records readable by role" on public.records;
drop policy if exists "records readable by role and market" on public.records;

create policy "records readable by role"
  on public.records for select
  to authenticated
  using (
    -- Admin sees the whole of their market.
    public.current_role() = 'admin'

    -- FTOs see the ride-along working set and the schedule around it, plus the
    -- instruments they assess against. Not `surveys` (feedback about them),
    -- not the AEMT program, not QA.
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
        'templates',
        'settings'
      )
    )

    -- New hires see the schedule, and their own survey only. `updated_by` is
    -- stamped server-side by the records_stamp trigger, so this cannot be
    -- spoofed from a client. `templates` is included so a hire reviewing their
    -- own check-off sheet sees the wording it was actually assessed against.
    or (
      public.current_role() = 'newhire'
      and (
        collection in ('cohorts', 'days', 'arrangements', 'customSessions', 'templates', 'settings')
        or (collection = 'surveys' and updated_by = auth.uid())
      )
    )
  );


-- ============================================================================
-- 2. Write: administrators only, restrictively
-- ============================================================================

create or replace function public.is_template_collection(c text)
returns boolean
language sql
immutable
as $$
  select c = 'templates';
$$;

drop policy if exists "templates are admin only for insert" on public.records;
create policy "templates are admin only for insert"
  on public.records as restrictive for insert
  to authenticated
  with check (
    not public.is_template_collection(collection)
    or public.current_role() = 'admin'
  );

drop policy if exists "templates are admin only for update" on public.records;
create policy "templates are admin only for update"
  on public.records as restrictive for update
  to authenticated
  using (
    not public.is_template_collection(collection)
    or public.current_role() = 'admin'
  );

-- Deletion is fenced here, unlike the AEMT collections.
--
-- The reason is the version pin. Every competency record stores the version it
-- was assessed under and resolves it out of this collection; delete a published
-- version and every record pinned to it silently falls back to the current
-- wording — the precise failure the versioning exists to prevent, and one that
-- leaves no trace. The app itself only ever deletes a custom instrument nothing
-- has been assessed against, so this costs nothing and closes the API path.
drop policy if exists "templates are admin only for delete" on public.records;
create policy "templates are admin only for delete"
  on public.records as restrictive for delete
  to authenticated
  using (
    not public.is_template_collection(collection)
    or public.current_role() = 'admin'
  );


-- ============================================================================
-- 3. Verify
-- ============================================================================
--
-- Run these after applying. Expected results are in the comments.

-- Three restrictive template policies, one permissive read policy.
--   templates are admin only for delete | RESTRICTIVE | DELETE
--   templates are admin only for insert | RESTRICTIVE | INSERT
--   templates are admin only for update | RESTRICTIVE | UPDATE
--   records readable by role            | PERMISSIVE  | SELECT
--
-- select policyname, permissive, cmd
--   from pg_policies
--  where schemaname = 'public'
--    and tablename  = 'records'
--    and (policyname like 'templates%' or policyname = 'records readable by role')
--  order by policyname;

-- The market fence must still be there — it is a separate policy and section 1
-- above must not have disturbed it. Expect exactly one row, RESTRICTIVE / ALL.
--
-- select policyname, permissive, cmd
--   from pg_policies
--  where schemaname = 'public' and tablename = 'records' and policyname = 'market separation';

-- The FTO read list must now contain 'templates'. Expect true.
--
-- select pg_get_expr(polqual, polrelid) like '%templates%' as fto_can_read_templates
--   from pg_policy
--  where polrelid = 'public.records'::regclass
--    and polname  = 'records readable by role';


-- ---------------------------------------------------------------------------
-- To roll back:
--   drop policy if exists "templates are admin only for insert" on public.records;
--   drop policy if exists "templates are admin only for update" on public.records;
--   drop policy if exists "templates are admin only for delete" on public.records;
--   drop function if exists public.is_template_collection(text);
--   -- then re-apply section 4 of 2026-08-06-markets.sql to restore the read
--   -- policy without 'templates'.
-- ---------------------------------------------------------------------------
