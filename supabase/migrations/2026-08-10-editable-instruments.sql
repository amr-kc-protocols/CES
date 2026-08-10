-- ---------------------------------------------------------------------------
-- Editable skill sheets and evaluation forms.
--
-- Adds one collection, `templates`, holding every published version of every
-- instrument. Two rules, and getting either wrong breaks something quietly:
--
--   READ — everyone who assesses must see it. An FTO who cannot read this
--   collection renders the version bundled with the app while writing records
--   that pin a version number nobody on their device can resolve. The record
--   would then render against the wrong criteria on the very screen that is
--   supposed to prove what was assessed.
--
--   WRITE — administrators only. These instruments are what competency records
--   point at, including the K.A.R. 109-11-8(a)(2) psychomotor record, so an FTO
--   able to edit one could change what a past assessment appears to say.
--
-- Idempotent: drops each policy before creating it, so a repeated apply is
-- safe.
-- ---------------------------------------------------------------------------

-- ----- 1. Read: add `templates` to every role that assesses ------------------

drop policy if exists "records readable by role" on public.records;

create policy "records readable by role"
  on public.records for select
  to authenticated
  using (
    -- Admin sees the whole workspace.
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

-- ----- 2. Write: administrators only -----------------------------------------

create or replace function public.is_template_collection(c text)
returns boolean
language sql
immutable
as $$
  select c = 'templates';
$$;

drop policy if exists "templates are admin only for insert" on public.records;
create policy "templates are admin only for insert"
  on public.records for insert
  to authenticated
  with check (
    not public.is_template_collection(collection)
    or public.current_role() = 'admin'
  );

drop policy if exists "templates are admin only for update" on public.records;
create policy "templates are admin only for update"
  on public.records for update
  to authenticated
  using (
    not public.is_template_collection(collection)
    or public.current_role() = 'admin'
  );

-- ---------------------------------------------------------------------------
-- A note on deletion.
--
-- There is deliberately no delete policy narrowing here, matching how the AEMT
-- collections are handled: `records` is one table and delete permission is
-- granted table-wide, so this cannot be scoped per collection without a
-- rewrite. What protects a version in practice is that the app never deletes
-- one that has been published — the editor only offers deletion for a custom
-- instrument nothing has been assessed against, and hides everything else by
-- publishing an archive marker instead.
--
-- To roll back:
--   drop policy if exists "templates are admin only for insert" on public.records;
--   drop policy if exists "templates are admin only for update" on public.records;
--   drop function if exists public.is_template_collection(text);
--   -- then re-apply the read policy from 2026-08-01-scoped-reads-and-aemt.sql
-- ---------------------------------------------------------------------------
