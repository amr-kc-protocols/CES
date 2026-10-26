-- ---------------------------------------------------------------------------
-- Documentation Academy: learners keep their own records.
--
-- The course syncs three collections through `records` (src/lib/records.ts):
--
--   docLearners  a learner's own working record — track, lessons done, case work
--   docAttempts  one row per exam attempt, written once
--   docReviews   the reviewer's side — practical score, sign-offs, completion
--
-- Without this file all three are admin-only in both directions, which is
-- what a new collection gets by default here (the read policy names every
-- collection the other roles may see). That is right for CQMP and wrong for a
-- course every FTO and new hire takes: their progress would be refused on push
-- and discarded.
--
-- Ownership is `data->>'userId'`, NOT `updated_by`. The stamp trigger rewrites
-- updated_by on every write, so the first time an educator touched a learner's
-- row the learner would lose sight of it. userId is set by the app when the
-- learner enrols, and the restrictive policies below stop a non-admin from
-- writing any row that does not carry their own id — so it cannot be spoofed.
--
-- What each role gets:
--
--   admin      everything, as before
--   fto,       read their own docLearners, docAttempts and docReviews;
--   newhire    write their own docLearners and docAttempts; never docReviews;
--              never change an attempt after it is submitted
--
-- All existing policies are left as they are. Permissive policies OR together,
-- so the new reads and writes are added alongside; the restrictions are
-- RESTRICTIVE so no other permissive policy can widen them.
--
-- Apply in the SQL Editor. Safe to re-run. Down-migration at the bottom.
-- ---------------------------------------------------------------------------

create or replace function public.is_doc_academy_collection(c text)
returns boolean
language sql
immutable
as $$
  select c in ('docLearners', 'docAttempts', 'docReviews');
$$;

-- ----- reads -----------------------------------------------------------------

drop policy if exists "doc academy learners read their own" on public.records;
create policy "doc academy learners read their own"
  on public.records for select
  to authenticated
  using (
    public.is_doc_academy_collection(collection)
    and data->>'userId' = auth.uid()::text
  );

-- ----- writes ----------------------------------------------------------------

drop policy if exists "doc academy learners write their own" on public.records;
create policy "doc academy learners write their own"
  on public.records for insert
  to authenticated
  with check (
    public.current_role() in ('fto', 'newhire')
    and collection in ('docLearners', 'docAttempts')
    and data->>'userId' = auth.uid()::text
  );

-- Update is granted because the app's push is an upsert (ON CONFLICT DO
-- UPDATE). Attempts are still immutable: see the trigger below.
drop policy if exists "doc academy learners update their own" on public.records;
create policy "doc academy learners update their own"
  on public.records for update
  to authenticated
  using (
    public.current_role() in ('fto', 'newhire')
    and collection in ('docLearners', 'docAttempts')
    and data->>'userId' = auth.uid()::text
  )
  with check (
    public.current_role() in ('fto', 'newhire')
    and collection in ('docLearners', 'docAttempts')
    and data->>'userId' = auth.uid()::text
  );

-- ----- restrictions ------------------------------------------------------------
--
-- A non-admin may only ever write a Documentation Academy row that is theirs,
-- and never a review. Restrictive, so a future permissive policy that names
-- these collections cannot grant more than this.

drop policy if exists "doc academy rows are owner or admin for insert" on public.records;
create policy "doc academy rows are owner or admin for insert"
  on public.records as restrictive for insert
  to authenticated
  with check (
    not public.is_doc_academy_collection(collection)
    or public.current_role() = 'admin'
    or (collection <> 'docReviews' and data->>'userId' = auth.uid()::text)
  );

drop policy if exists "doc academy rows are owner or admin for update" on public.records;
create policy "doc academy rows are owner or admin for update"
  on public.records as restrictive for update
  to authenticated
  using (
    not public.is_doc_academy_collection(collection)
    or public.current_role() = 'admin'
    or (collection <> 'docReviews' and data->>'userId' = auth.uid()::text)
  )
  with check (
    not public.is_doc_academy_collection(collection)
    or public.current_role() = 'admin'
    or (collection <> 'docReviews' and data->>'userId' = auth.uid()::text)
  );

-- ----- submitted attempts do not change ------------------------------------
--
-- An exam attempt is a result. RLS cannot compare the old row with the new
-- one, so a trigger does: a non-admin may re-send an attempt unchanged (the
-- sync engine's upsert does exactly that after a dropped connection) but may
-- not alter one. The error code is 42501 so the app treats it as a permission
-- refusal — discards the edit and re-pulls the server's copy — rather than
-- retrying it forever.

create or replace function public.doc_attempts_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.collection = 'docAttempts'
     and coalesce(public.current_role(), '') <> 'admin'
     and (old.data is distinct from new.data or old.deleted is distinct from new.deleted) then
    raise exception 'A submitted Documentation Academy attempt cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists doc_attempts_immutable on public.records;
create trigger doc_attempts_immutable
  before update on public.records
  for each row execute function public.doc_attempts_immutable();

-- ----- verify ----------------------------------------------------------------
--
-- Expect five rows: two PERMISSIVE write policies, one PERMISSIVE read, two
-- RESTRICTIVE.
--
-- select policyname, permissive, cmd
--   from pg_policies
--  where schemaname = 'public' and tablename = 'records' and policyname like 'doc academy%'
--  order by policyname;
--
-- The market fence must still be there. Expect one row, RESTRICTIVE / ALL.
--
-- select policyname, permissive, cmd
--   from pg_policies
--  where schemaname = 'public' and tablename = 'records' and policyname = 'market separation';

-- ----- known limits ------------------------------------------------------------
--
-- * Removing a learner tombstones their rows with empty data, which no longer
--   carries their userId, so their own device does not learn of the deletion
--   and keeps a local copy. The server copy is gone. Acceptable for a course
--   record; revisit if removal ever needs to reach the learner's device.
-- * The exam's answer key ships in the app bundle and attempts are scored on
--   the device. Moving scoring into an RPC, as the selection exams do, is the
--   next step before results are used for anything formal.

-- ----- down ------------------------------------------------------------------
-- DO NOT RUN unless undoing this migration. Afterwards the collections fall
-- back to admin-only, and non-admin progress is refused on push.
--
--   drop trigger if exists doc_attempts_immutable on public.records;
--   drop function if exists public.doc_attempts_immutable();
--   drop policy if exists "doc academy learners read their own" on public.records;
--   drop policy if exists "doc academy learners write their own" on public.records;
--   drop policy if exists "doc academy learners update their own" on public.records;
--   drop policy if exists "doc academy rows are owner or admin for insert" on public.records;
--   drop policy if exists "doc academy rows are owner or admin for update" on public.records;
--   drop function if exists public.is_doc_academy_collection(text);
