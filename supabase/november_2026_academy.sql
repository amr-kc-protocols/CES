-- ---------------------------------------------------------------------------
-- November 2026 Academy (Kansas City): roster and schedule.
--
-- WHAT THIS DOES
--
--   1. Adds the four Kansas City hires from the 11-8-2026 onboarding sheet to
--      the November 2026 Academy, with their name and WD number. All four
--      are EMT Basic, external hires, based at Kansas City. Personal phone
--      and email are deliberately not in this file (it lives in the repo);
--      add them on each hire's record in the app.
--   2. Sets the academy schedule:
--        HR & Systems Onboarding .......... Tue Nov 10, 0900  (first day)
--        EVOC Road Course ................. Mon Nov 16, 0800  (confirmed;
--                                           note changed to "Meet HQ 8 AM")
--        EVOC Classroom ................... date open, 0900
--        Documentation (PCR / ImageTrend) . date open, 0900
--        Stretcher / patient movement lab
--          + equipment check-off .......... date open, 0900
--
-- WHAT IT LEAVES ALONE
--
--   The cohort's own start date (Nov 9), any other sessions, and any date
--   already set on the three open sessions. A hire whose name is already on
--   the roster is not added twice, so the file is safe to re-run.
--
-- HOW TO RUN
--
--   Supabase dashboard -> SQL Editor. Run PART 1 by itself and check it finds
--   one November cohort and the five sessions. Then run PART 2 with
--   v_commit := false (it reports and writes nothing), then again with
--   v_commit := true. Devices pick the changes up on their next sync.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- PART 1 — LOOK FIRST. Read-only.
-- ===========================================================================

-- The November cohort(s) in Kansas City.
select id as cohort_id, data ->> 'label' as label, data ->> 'startDate' as starts,
       data ->> 'endDate' as ends
from public.records
where market = 'kc' and collection = 'cohorts' and not deleted
  and data ->> 'startDate' between '2026-11-01' and '2026-11-30';

-- The sessions that cohort runs (from its copy of the KC NEOP), with any date
-- and start time already set.
select s ->> 'id' as session_id, s ->> 'week' as week, s ->> 'mode' as mode,
       s ->> 'title' as title, a.data ->> 'date' as date, a.data ->> 'startTime' as start
from public.records c
cross join lateral jsonb_array_elements(c.data -> 'plan' -> 'schedule' -> 'sessions') s
left join public.records a
  on a.market = 'kc' and a.collection = 'arrangements' and not a.deleted
 and a.id = c.id || ':' || (s ->> 'id')
where c.market = 'kc' and c.collection = 'cohorts' and not c.deleted
  and c.data ->> 'startDate' between '2026-11-01' and '2026-11-30'
order by (s ->> 'order')::int;

-- Who is on the roster already.
select t.data ->> 'name' as name, t.data ->> 'credential' as cred,
       t.data ->> 'phone' as phone, t.data ->> 'email' as email
from public.records t
join public.records c
  on c.market = 'kc' and c.collection = 'cohorts' and not c.deleted
 and c.id = t.data ->> 'cohortId'
where t.market = 'kc' and t.collection = 'trainees' and not t.deleted
  and c.data ->> 'startDate' between '2026-11-01' and '2026-11-30';


-- ===========================================================================
-- PART 2 — WRITE. Dry run first (v_commit = false), then set it to true.
-- ===========================================================================

do $$
declare
  -- Leave blank to use the one Kansas City cohort starting in November 2026.
  -- Paste the id from Part 1 if there is more than one.
  v_cohort text := '';

  v_commit boolean := false;

  v_cohort_row record;
  v_sessions jsonb;
  v_target int;
  v_hire jsonb;
  v_name text;
  v_sched record;
  v_sid text;
  v_matches int;
  v_arr_id text;
  v_existing jsonb;
  v_patch jsonb;
  v_blocks jsonb;
begin
  -- ---- the cohort ---------------------------------------------------------
  if v_cohort = '' then
    select count(*) into v_matches
    from public.records
    where market = 'kc' and collection = 'cohorts' and not deleted
      and data ->> 'startDate' between '2026-11-01' and '2026-11-30';
    if v_matches <> 1 then
      raise exception 'Found % Kansas City cohorts starting in November 2026. Paste the right id into v_cohort.', v_matches;
    end if;
    select id into v_cohort
    from public.records
    where market = 'kc' and collection = 'cohorts' and not deleted
      and data ->> 'startDate' between '2026-11-01' and '2026-11-30';
  end if;

  select * into v_cohort_row
  from public.records
  where market = 'kc' and collection = 'cohorts' and id = v_cohort and not deleted;
  if not found then
    raise exception 'No Kansas City cohort with id %.', v_cohort;
  end if;

  raise notice 'Cohort: % (%), starts %', v_cohort_row.data ->> 'label', v_cohort,
    v_cohort_row.data ->> 'startDate';

  v_sessions := v_cohort_row.data -> 'plan' -> 'schedule' -> 'sessions';
  v_target := coalesce((v_cohort_row.data -> 'plan' -> 'release' ->> 'defaultTarget')::int, 25);

  -- ---- the roster ---------------------------------------------------------
  -- From the 11-8-2026 onboarding sheet. WD # goes in the employee number.
  -- No phone or email here: enter those in the app.
  for v_hire in select * from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('name', 'Athanasius Bono',   'employeeNumber', '26144621'),
    jsonb_build_object('name', 'Sean Marsmaker',    'employeeNumber', '26144618'),
    jsonb_build_object('name', 'Jadelynne Russell', 'employeeNumber', '26144633'),
    jsonb_build_object('name', 'Johnathan Reiss',   'employeeNumber', '26144730')
  ))
  loop
    v_name := v_hire ->> 'name';
    if exists (
      select 1 from public.records
      where market = 'kc' and collection = 'trainees' and not deleted
        and data ->> 'cohortId' = v_cohort
        and lower(data ->> 'name') = lower(v_name)
    ) then
      raise notice 'Roster: % is already on it — skipped.', v_name;
      continue;
    end if;

    raise notice 'Roster: add % (EMT, Kansas City).', v_name;
    if v_commit then
      v_sid := 'trainee_' || gen_random_uuid()::text;
      insert into public.records (market, collection, id, data)
      values ('kc', 'trainees', v_sid, v_hire || jsonb_build_object(
        'id', v_sid,
        'cohortId', v_cohort,
        'operation', 'kc',
        'credential', 'emt',
        'hireDate', '2026-11-08',
        'checklist', '{}'::jsonb,
        'contacts', 0,
        'contactTarget', v_target
      ));
    end if;
  end loop;

  -- ---- the schedule -------------------------------------------------------
  -- Each session is found by its title in the cohort's copy of the NEOP, so a
  -- renamed or re-numbered session still resolves. The fallback id is the
  -- shipped template's, for a cohort with no stored plan.
  for v_sched in
    select * from (values
      ('HR onboarding',      '%onboarding%',    'p1s1', '2026-11-10', '0900'),
      ('EVOC road course',   '%evoc road%',     'p1s3', '2026-11-16', '0800'),
      ('EVOC classroom',     '%evoc class%',    'p1s2', null,         '0900'),
      ('Documentation',      '%documentation%', 'p1s4', null,         '0900'),
      ('Stretcher lab',      '%stretcher%',     'p1s5', null,         '0900')
    ) as x(label, pattern, fallback, date, start)
  loop
    if v_sessions is null then
      v_sid := v_sched.fallback;
    else
      select count(*) into v_matches
      from jsonb_array_elements(v_sessions) s
      where s ->> 'title' ilike v_sched.pattern and s ->> 'mode' = 'in-person';
      if v_matches <> 1 then
        raise exception '% matched % in-person sessions in this cohort (expected 1). Check Part 1.',
          v_sched.label, v_matches;
      end if;
      select s ->> 'id' into v_sid
      from jsonb_array_elements(v_sessions) s
      where s ->> 'title' ilike v_sched.pattern and s ->> 'mode' = 'in-person';
    end if;

    v_arr_id := v_cohort || ':' || v_sid;
    select data into v_existing
    from public.records
    where market = 'kc' and collection = 'arrangements' and id = v_arr_id and not deleted;

    v_patch := jsonb_build_object('cohortId', v_cohort, 'sessionId', v_sid, 'startTime', v_sched.start);
    if v_sched.date is not null then
      v_patch := v_patch || jsonb_build_object('date', v_sched.date);
    end if;

    -- The road-course note was written for the summer 0700 start ("Starts
    -- 0700 to beat the heat. Meet HQ 7 AM") and prints on the agenda. Give
    -- this class its own copy of the blocks with the 0800 wording, unless the
    -- class already has edited blocks for that day.
    if v_sched.label = 'EVOC road course' and v_existing -> 'blocks' is null
       and v_sessions is not null then
      select s -> 'blocks' into v_blocks
      from jsonb_array_elements(v_sessions) s where s ->> 'id' = v_sid;
      if v_blocks is not null then
        v_blocks := replace(replace(v_blocks::text,
          'Starts 0700 to beat the heat. ', ''), 'Meet HQ 7 AM', 'Meet HQ 8 AM')::jsonb;
        v_patch := v_patch || jsonb_build_object('blocks', v_blocks);
        raise notice 'Schedule: EVOC road course note now reads "Meet HQ 8 AM".';
      end if;
    end if;

    raise notice 'Schedule: % (%) -> %, %', v_sched.label, v_sid,
      coalesce(v_sched.date, coalesce(v_existing ->> 'date', 'date open') || ' (unchanged)'),
      v_sched.start;

    if v_commit then
      insert into public.records (market, collection, id, data, deleted)
      values ('kc', 'arrangements', v_arr_id, coalesce(v_existing, '{}'::jsonb) || v_patch, false)
      on conflict (market, collection, id)
      do update set data = excluded.data, deleted = false;
    end if;
  end loop;

  if not v_commit then
    raise notice 'Dry run: nothing written. Set v_commit := true and run again.';
  end if;
end $$;
