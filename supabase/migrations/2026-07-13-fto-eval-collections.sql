-- Migration for projects that already ran schema.sql before July 2026.
-- Widens the FTO write policies to the new collections: daily performance
-- evaluations ('evals'), clinical skill sheets ('skills'), and locally
-- stored exit surveys ('surveys').
--
-- Run this once in the Supabase SQL editor. Safe to re-run.

drop policy if exists "fto writes ride-along collections" on public.records;
create policy "fto writes ride-along collections"
  on public.records for insert
  to authenticated
  with check (
    public.current_role() = 'fto'
    and collection in ('trainees', 'attendance', 'rides', 'evals', 'skills', 'surveys')
  );

drop policy if exists "fto updates ride-along collections" on public.records;
create policy "fto updates ride-along collections"
  on public.records for update
  to authenticated
  using (
    public.current_role() = 'fto'
    and collection in ('trainees', 'attendance', 'rides', 'evals', 'skills', 'surveys')
  );
