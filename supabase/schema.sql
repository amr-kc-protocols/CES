-- ---------------------------------------------------------------------------
-- AMR KC Academy — cloud backend schema.
--
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query
-- → paste this whole file → Run. See supabase/README.md for the full setup.
--
-- Design: the app is offline-first. Every domain object syncs as one row in
-- `records` (collection + id + jsonb payload), matching the app's store
-- slices one-to-one. Conflicts resolve last-write-wins per record, which is
-- the right grain here: an FTO marking trainee A's checklist and the admin
-- editing trainee B never touch the same row.
-- ---------------------------------------------------------------------------

-- ----- roles ----------------------------------------------------------------
-- Every signed-in user gets a profile. New signups default to 'newhire'
-- (least privilege); promote FTOs and admins in Table Editor → profiles.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'newhire' check (role in ('admin', 'fto', 'newhire')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read every profile (names/roles are not secret inside the org)
-- but can never change roles — that happens in the dashboard only.
create policy "profiles are readable by signed-in users"
  on public.profiles for select
  to authenticated
  using (true);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_role()
returns text
language sql
stable
as $$
  select role from public.profiles where user_id = auth.uid()
$$;

-- ----- records ---------------------------------------------------------------

create table if not exists public.records (
  collection text not null,
  id text not null,
  data jsonb not null,
  -- Soft delete: rows are tombstoned, never removed, so offline devices
  -- learn about deletions when they next pull.
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  primary key (collection, id)
);

create index if not exists records_updated_at_idx on public.records (updated_at);

-- Server-side timestamp on every write; clients never supply updated_at.
create or replace function public.stamp_record()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists records_stamp on public.records;
create trigger records_stamp
  before insert or update on public.records
  for each row execute function public.stamp_record();

alter table public.records enable row level security;

-- Everyone signed in can read the workspace.
create policy "records readable by signed-in users"
  on public.records for select
  to authenticated
  using (true);

-- Admin writes everything.
create policy "admin writes all records"
  on public.records for insert
  to authenticated
  with check (public.current_role() = 'admin');

create policy "admin updates all records"
  on public.records for update
  to authenticated
  using (public.current_role() = 'admin');

-- FTOs write the ride-along working set: trainee records (checklist marks,
-- contacts), attendance, ride assignments, daily performance evaluations,
-- skill sheet sign-offs, and exit surveys — not cohorts or schedules.
create policy "fto writes ride-along collections"
  on public.records for insert
  to authenticated
  with check (
    public.current_role() = 'fto'
    and collection in ('trainees', 'attendance', 'rides', 'evals', 'skills', 'surveys')
  );

create policy "fto updates ride-along collections"
  on public.records for update
  to authenticated
  using (
    public.current_role() = 'fto'
    and collection in ('trainees', 'attendance', 'rides', 'evals', 'skills', 'surveys')
  );

-- New hires are read-only except their own working set: the exit survey.
-- The survey filed from the trainee's own signed-in phone must sync — the
-- in-app completion state derives from the survey record (the trainee-record
-- marker stays FTO/admin-written). Checklist marks, contacts, evals, and
-- skill sign-offs remain FTO/admin-only.
create policy "newhire writes surveys"
  on public.records for insert
  to authenticated
  with check (
    public.current_role() = 'newhire'
    and collection = 'surveys'
  );

create policy "newhire updates surveys"
  on public.records for update
  to authenticated
  using (
    public.current_role() = 'newhire'
    and collection = 'surveys'
  );
