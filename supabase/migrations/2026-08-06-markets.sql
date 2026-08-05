-- ---------------------------------------------------------------------------
-- Two markets: AMR Kansas City and AMR Wichita.
-- Plus a fix for a privilege escalation introduced in 2026-08-01.
--
-- One database, one app, two sets of data. A market owns everything in
-- `records`: its own cohorts, trainees, FTO evaluations, exit surveys, AEMT
-- program, QA and settings. Nothing in this table is shared between them.
--
-- What IS shared needed no mechanism, because it was never in here. Skill
-- sheets, check sheets, the K.A.R. rule sets, the AEMT curriculum and the
-- how-to guides are static data compiled into the app bundle. The partition
-- line falls exactly on this table, which is why this is a column and a policy
-- rather than a second deployment.
--
-- WHAT THIS DOES TO EXISTING DATA: nothing, beyond labelling it. Every row
-- already in `records` becomes Kansas City, and every existing profile becomes
-- a Kansas City user. The NEOP cohort in progress and the AEMT selection work
-- keep running exactly as they are. Wichita starts empty.
--
-- Apply in the SQL Editor. Safe to re-run. Run this file top to bottom. The
-- down-migration at the bottom is commented out — do not run that section.
-- ---------------------------------------------------------------------------


-- ============================================================================
-- 0. FIRST: close the write hole from 2026-08-01
-- ============================================================================
--
-- The AEMT policies in that migration were written PERMISSIVE, which is the
-- default. Postgres ORs permissive policies together for the same command, so
--
--     with check (not public.is_aemt_collection(collection)
--                 or public.current_role() = 'admin')
--
-- did not restrict anything. `not is_aemt_collection(collection)` is TRUE for
-- every collection that is not part of the AEMT program, so that clause alone
-- granted insert and update on `trainees`, `cohorts`, `days`, `evals`,
-- `skills`, `rides`, `attendance`, `surveys`, `settings` and the rest to ANY
-- authenticated user — including a new hire, who is supposed to be read-only
-- apart from their own exit survey.
--
-- The AEMT collections themselves were never exposed: for those, the clause is
-- false for a non-admin and no other policy grants them either. The intended
-- effect held. The side effect did not.
--
-- The fix is `as restrictive`, which ANDs with the permissive set instead of
-- ORing with it. This section is the whole reason to run this file promptly
-- even if the market split can wait.

drop policy if exists "aemt is admin only for insert" on public.records;
create policy "aemt is admin only for insert"
  on public.records as restrictive for insert
  to authenticated
  with check (
    not public.is_aemt_collection(collection)
    or public.current_role() = 'admin'
  );

drop policy if exists "aemt is admin only for update" on public.records;
create policy "aemt is admin only for update"
  on public.records as restrictive for update
  to authenticated
  using (
    not public.is_aemt_collection(collection)
    or public.current_role() = 'admin'
  );


-- ============================================================================
-- 1. profiles: who belongs to which market
-- ============================================================================

alter table public.profiles add column if not exists market text;

-- Everyone who exists today is Kansas City. This runs before the constraint so
-- that no existing row can fail it.
update public.profiles set market = 'kc' where market is null;

alter table public.profiles alter column market set default 'kc';
alter table public.profiles alter column market set not null;

-- 'all' spans both operations and gets the market switcher in the app header.
alter table public.profiles drop constraint if exists profiles_market_check;
alter table public.profiles add constraint profiles_market_check
  check (market in ('kc', 'wichita', 'all'));

-- The default is 'kc' rather than null because a null market matches nothing
-- and would show a new user a working app with no data in it — the hardest
-- kind of wrong to diagnose. The cost is that a new Wichita hire lands in
-- Kansas City until someone moves them, so setting the market belongs in the
-- same step as setting the role. Section 5 has the statements.

create or replace function public.current_market()
returns text
language sql
stable
as $$
  select market from public.profiles where user_id = auth.uid()
$$;


-- ============================================================================
-- 2. records: which market a row belongs to
-- ============================================================================

alter table public.records add column if not exists market text;
update public.records set market = 'kc' where market is null;
alter table public.records alter column market set default 'kc';
alter table public.records alter column market set not null;

alter table public.records drop constraint if exists records_market_check;
alter table public.records add constraint records_market_check
  check (market in ('kc', 'wichita'));

-- The primary key has to include the market, and this is not cosmetic.
-- `settings` is a singleton with a fixed id, so under the old (collection, id)
-- key Wichita's settings row and Kansas City's would be the same row, and each
-- side would overwrite the other's on every save.
alter table public.records drop constraint if exists records_pkey;
alter table public.records add primary key (market, collection, id);

-- The sync engine pulls with `market = ?` ordered by updated_at.
create index if not exists records_market_updated_at_idx
  on public.records (market, updated_at);


-- ============================================================================
-- 3. the market fence — RESTRICTIVE, and the thing that actually separates them
-- ============================================================================
--
-- One restrictive policy across every command. Restrictive means it ANDs with
-- whatever permissive policies exist now or are added later, so no future
-- "…for select using (true)" can quietly reopen the boundary. Given that is
-- exactly how the hole in section 0 happened, the market fence gets the
-- stronger construction from the start.
--
-- `using` covers select, update and delete; `with check` covers insert and
-- update. Both are needed: without the check, an admin could read only their
-- own market but still write a row stamped with the other market's name.

drop policy if exists "market separation" on public.records;
create policy "market separation"
  on public.records as restrictive for all
  to authenticated
  using (
    public.current_market() = 'all'
    or market = public.current_market()
  )
  with check (
    public.current_market() = 'all'
    or market = public.current_market()
  );


-- ============================================================================
-- 4. reads by role (unchanged from 2026-08-01, restated so this file is whole)
-- ============================================================================
--
-- Permissive, and now ANDed with the market fence above. An FTO in Wichita
-- sees the Wichita ride-along working set and nothing of Kansas City's.

drop policy if exists "records readable by signed-in users" on public.records;
drop policy if exists "records readable by role" on public.records;
drop policy if exists "records readable by role and market" on public.records;

create policy "records readable by role"
  on public.records for select
  to authenticated
  using (
    -- Admin sees the whole of their market.
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


-- ============================================================================
-- 4b. the exam tables — outside `records`, so the fence above does not reach
-- ============================================================================
--
-- The AEMT selection exam does not use the `records` table. It has its own
-- `exam_questions` and `exam_attempts`, so section 3's policy — scoped to
-- `public.records` — leaves them completely unfenced. Without this section a
-- Wichita admin would read every Kansas City candidate's name, email,
-- responses and score, which is precisely the data the split exists to
-- separate.
--
-- `exam_questions` is deliberately left shared. It is a 120-item curriculum
-- bank, identical for both operations, and duplicating it would mean
-- maintaining two copies of the same questions.

alter table public.exam_attempts add column if not exists market text;
update public.exam_attempts set market = 'kc' where market is null;
alter table public.exam_attempts alter column market set default 'kc';
alter table public.exam_attempts alter column market set not null;

alter table public.exam_attempts drop constraint if exists exam_attempts_market_check;
alter table public.exam_attempts add constraint exam_attempts_market_check
  check (market in ('kc', 'wichita'));

drop policy if exists "admin reads exam attempts" on public.exam_attempts;
create policy "admin reads exam attempts"
  on public.exam_attempts for select
  to authenticated
  using (
    public.current_role() = 'admin'
    and (public.current_market() = 'all' or market = public.current_market())
  );

drop policy if exists "admin manages exam attempts" on public.exam_attempts;
create policy "admin manages exam attempts"
  on public.exam_attempts for all
  to authenticated
  using (
    public.current_role() = 'admin'
    and (public.current_market() = 'all' or market = public.current_market())
  )
  with check (
    public.current_role() = 'admin'
    and (public.current_market() = 'all' or market = public.current_market())
  );

-- LEFT OPEN, on purpose. A candidate sitting the exam is anonymous —
-- `exam_start(p_name, p_email)` is granted to `anon`, so there is no
-- `current_market()` to read and new attempts take the column default of 'kc'.
--
-- That is correct today: every attempt on record is a Kansas City one and
-- Wichita has no candidates. It stops being correct the day Wichita runs a
-- selection round, which needs `exam_start` to take a market and the candidate
-- link to carry it. Not done here because it changes a function signature and
-- the client, and it is not needed until Wichita has someone to test.
--
-- The one-attempt-per-email rule inside exam_start is also market-blind, and
-- should probably stay that way: one person, one attempt.


-- ============================================================================
-- 4c. intake_submissions — same story as the exam
-- ============================================================================
--
-- The public AEMT candidate intake form writes here, and like the exam it is
-- its own table rather than a `records` collection, so section 3 does not
-- reach it. `data` holds a candidate's name, contact details and employment
-- answers behind nothing but `current_role() = 'admin'`.
--
-- Same anonymous-submitter caveat as 4b: "anyone can submit intake" is granted
-- to `anon`, so a submission has no current_market() to read and takes the
-- column default. Correct while every applicant is a Kansas City one; the
-- public /intake link needs to carry a market before Wichita advertises it.

alter table public.intake_submissions add column if not exists market text;
update public.intake_submissions set market = 'kc' where market is null;
alter table public.intake_submissions alter column market set default 'kc';
alter table public.intake_submissions alter column market set not null;

alter table public.intake_submissions drop constraint if exists intake_submissions_market_check;
alter table public.intake_submissions add constraint intake_submissions_market_check
  check (market in ('kc', 'wichita'));

drop policy if exists "admin reads intake" on public.intake_submissions;
create policy "admin reads intake"
  on public.intake_submissions for select
  to authenticated
  using (
    public.current_role() = 'admin'
    and (public.current_market() = 'all' or market = public.current_market())
  );

drop policy if exists "admin updates intake" on public.intake_submissions;
create policy "admin updates intake"
  on public.intake_submissions for update
  to authenticated
  using (
    public.current_role() = 'admin'
    and (public.current_market() = 'all' or market = public.current_market())
  );

drop policy if exists "admin deletes intake" on public.intake_submissions;
create policy "admin deletes intake"
  on public.intake_submissions for delete
  to authenticated
  using (
    public.current_role() = 'admin'
    and (public.current_market() = 'all' or market = public.current_market())
  );


-- ============================================================================
-- 5. assigning people — the decisions, left for you to make
-- ============================================================================
--
-- Everything above is structural and applies itself. These name real people,
-- so they are commented. Uncomment what you need, set the addresses, and run.
--
-- Cassandra is the one existing account that is NOT Kansas City. Section 1 has
-- already made her a Kansas City admin along with everyone else, which means
-- she currently reads the Kansas City workspace — the NEOP cohort, the FTO
-- evaluations, the exit surveys. Moving her is the point of this migration and
-- is worth doing in the same sitting.
--
--   update public.profiles
--   set market = 'wichita'
--   where email = 'cassandra.powell@gmr.net';
--
-- Whoever runs both operations needs 'all' — that account gets the switcher in
-- the app header and can work either side:
--
--   update public.profiles
--   set market = 'all'
--   where email = 'YOUR-ADDRESS-HERE';
--
-- To check where everyone landed:
--
--   select email, role, market from public.profiles order by market, role, email;
--
-- To confirm section 0 did what it should — this must return 0 rows:
--
--   select polname, polpermissive
--   from pg_policy
--   where polrelid = 'public.records'::regclass
--     and polname like 'aemt%'
--     and polpermissive;


-- ============================================================================
-- notes
-- ============================================================================
--
-- Wichita starts genuinely empty. There is no seed step and there should not
-- be: a cohort, a course or a settings row copied across from Kansas City
-- would carry Kansas City's dates, sites and people into a market that has
-- none of them.
--
-- The static program data — skill sheets, check sheets, K.A.R. rule sets, the
-- AEMT curriculum, the selection test — is in the app bundle rather than in
-- this table, so Wichita has all of it on day one without anything being
-- copied. That is why the empty start is cheap.
--
-- The audit-trail caveat from 2026-08-01 still stands: `records` is one table
-- for everything, so update permission is granted collection-wide and an admin
-- can still overwrite an audit row through the API. Markets do not change
-- that, and it still wants a separate append-only table before the first real
-- KBEMS submission.


-- ============================================================================
-- down
-- ============================================================================
-- DO NOT RUN unless you are undoing this. Reverting merges the two markets
-- back into one workspace: Wichita's rows become readable from Kansas City and
-- the reverse.
--
-- Note the primary key restore FAILS if both markets hold the same
-- (collection, id) — which they will, because `settings` is a singleton. Delete
-- or re-key one market's duplicates first. Nothing here deletes data.
--
--   drop policy if exists "market separation" on public.records;
--   alter table public.records drop constraint records_pkey;
--   alter table public.records add primary key (collection, id);
--   drop index if exists records_market_updated_at_idx;
--   alter table public.records drop column if exists market;
--   alter table public.profiles drop column if exists market;
--   drop function if exists public.current_market();
--
-- The section 0 fix should NOT be reverted — the permissive form was a bug.
