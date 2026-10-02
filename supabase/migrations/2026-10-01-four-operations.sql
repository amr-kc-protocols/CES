-- ---------------------------------------------------------------------------
-- Four operations: Kansas City, Wichita, Independence and Topeka.
--
-- Independence and Topeka each run their own new-hire program (NEOP) — their
-- own FTOs, shifts, facilities and protocols — so each is a market in its own
-- right rather than a location inside Kansas City. The market fence written in
-- 2026-08-06-markets.sql already separates any number of markets: its policies
-- compare `market = current_market()` and never name a market. What stops a
-- third and fourth one existing is only the CHECK constraint on each table that
-- carries the column, and that is all this migration changes.
--
-- Safe to re-run. Every statement drops the constraint before re-adding it.
--
-- AFTER RUNNING THIS, to give someone access to a new operation:
--
--   update public.profiles set market = 'topeka'       where user_id = '…';
--   update public.profiles set market = 'independence' where user_id = '…';
--
-- or 'all' for someone who works across operations (they get the switcher).
-- ---------------------------------------------------------------------------

-- Who belongs to which operation. 'all' spans every operation.
alter table public.profiles drop constraint if exists profiles_market_check;
alter table public.profiles add constraint profiles_market_check
  check (market in ('kc', 'wichita', 'independence', 'topeka', 'all'));

-- Which operation a synced record belongs to.
alter table public.records drop constraint if exists records_market_check;
alter table public.records add constraint records_market_check
  check (market in ('kc', 'wichita', 'independence', 'topeka'));

-- Selection-exam attempts sit outside `records`, with their own column.
alter table public.exam_attempts drop constraint if exists exam_attempts_market_check;
alter table public.exam_attempts add constraint exam_attempts_market_check
  check (market in ('kc', 'wichita', 'independence', 'topeka'));

-- So do public intake submissions.
alter table public.intake_submissions drop constraint if exists intake_submissions_market_check;
alter table public.intake_submissions add constraint intake_submissions_market_check
  check (market in ('kc', 'wichita', 'independence', 'topeka'));

notify pgrst, 'reload schema';
