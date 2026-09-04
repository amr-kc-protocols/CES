-- ---------------------------------------------------------------------------
-- Bring Wichita's AEMT students into the joint October 2026 cohort.
--
-- THE SITUATION. The joint cohort is one class run by two operations, and the
-- course record lives in the KANSAS CITY market by design — see the long note
-- above KC_SCHEDULE in src/data/aemt.ts. `records.market` plus the RLS policy
-- hard-partitions the two operations, so a course row written under 'wichita'
-- is not readable from a Kansas City device and vice versa. A cohort cannot
-- straddle that line, so it sits on the side that files the KBEMS approval.
--
-- The Wichita instructor could not see that course, so she built her own under
-- 'wichita' and entered her students into it. Both halves of that are exactly
-- what the design predicted; what was never done is the one line the design
-- also called for — giving her a market assignment of 'all' so she can reach
-- the Kansas City side at all.
--
-- SO THIS FILE DOES TWO THINGS:
--
--   1. Sets her profile market to 'all'. She keeps Wichita and gains Kansas
--      City, with the market switcher in the app header.
--   2. Copies her students, and everything hanging off them, out of the
--      Wichita partition and into the joint Kansas City course — tagged
--      campus = 'wichita' so the placement board still routes them to Sedgwick
--      and Butler rather than sending them to Merriam for twelve-hour shifts.
--
-- IT IS NON-DESTRUCTIVE BY CONSTRUCTION. The primary key on `records` is
-- (market, collection, id), so writing her rows under 'kc' creates NEW rows and
-- leaves every Wichita row exactly where it is. If this goes wrong, her
-- original course is still there and still hers. Nothing is deleted and nothing
-- is tombstoned.
--
-- IT DOES NOT MOVE THE COURSE ITSELF. The joint cohort already exists on the
-- Kansas City side with its schedule, its gates and its filed hours. Copying
-- her course across would give the program two courses and two rosters, and the
-- KBEMS application names one. Her course row, her sessions, her deadlines and
-- her generated documents stay in Wichita as the record of what she built.
--
-- RUN PART 1 FIRST. It writes nothing and tells you the ids Part 2 needs.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- PART 1 — LOOK BEFORE YOU MOVE. Read-only. Run this on its own first.
-- ===========================================================================
--
-- Run as a Supabase service role (SQL editor), which bypasses RLS. From an
-- app session you would only ever see your own market, which is the whole
-- problem this file exists to solve.

select
  r.market,
  r.id                                as course_id,
  r.data ->> 'name'                   as course_name,
  r.data ->> 'startDate'              as starts,
  r.data ->> 'organization'           as organization,
  (
    select count(*)
    from public.records s
    where s.market = r.market
      and s.collection = 'aemtStudents'
      and not s.deleted
      and s.data ->> 'courseId' = r.id
  )                                   as students
from public.records r
where r.collection = 'aemtCourses'
  and not r.deleted
order by r.market, starts;

-- The instructor accounts on the Wichita side. Her address is not in the course
-- record — COURSE_STAFF carries a name and an operation for her but no email —
-- so this is where to confirm it, and to check she has signed in at all.
select email, market, role
from public.profiles
where market in ('wichita', 'all')
order by market, email;

-- What would actually move, per collection, for a given Wichita course.
-- Replace the course id and run it to see the shape of the move.
--
--   select collection, count(*)
--   from public.records
--   where market = 'wichita'
--     and not deleted
--     and data ->> 'courseId' = 'PASTE_WICHITA_COURSE_ID'
--   group by collection order by collection;


-- ===========================================================================
-- PART 2 — THE MOVE. Fill in the three values, then set v_commit := true.
-- ===========================================================================

do $$
declare
  -- Her sign-in address. Gets market 'all' so she can reach Kansas City.
  -- Matched case-insensitively below: Supabase auth lowercases the address on
  -- signup, so an exact match on a capitalised spelling finds nothing and
  -- reads as "she has no account" when she plainly does.
  v_instructor_email text := 'Cassandra.powell@gmr.net';

  -- The course she built, under 'wichita'. From Part 1.
  v_from_course text := '';

  -- The joint cohort, under 'kc'. From Part 1.
  v_to_course text := '';

  -- Safety. Nothing is written while this is false: the file reports what it
  -- WOULD do and stops. Set it to true only once Part 1 looks right.
  v_commit boolean := false;

  -- Student-scoped collections. Everything here is about a person, so it
  -- follows the person to the joint course. Deliberately NOT listed:
  -- aemtCourses, aemtSessions, aemtDeadlines, aemtProgramDocs, aemtRecordDocs
  -- — those describe a COURSE, and the joint course already has its own.
  v_collections text[] := array[
    'aemtStudents',
    'aemtAttendance',
    'aemtEncounters',
    'aemtShifts',
    'aemtSkillChecks',
    'aemtFormResponses',
    'aemtCompletions',
    'aemtConferences'
  ];

  v_uid uuid;
  v_collection text;
  v_n int;
  v_total int := 0;
  v_students int;
begin
  -- ---- checks that stop the file rather than half-doing the job ----------

  if v_from_course = '' or v_to_course = '' then
    raise exception
      'Fill in v_from_course and v_to_course from Part 1 before running Part 2.';
  end if;

  if v_from_course = v_to_course then
    raise exception 'The source and destination course are the same id.';
  end if;

  select user_id into v_uid from public.profiles
  where lower(email) = lower(v_instructor_email);
  if v_uid is null then
    raise exception
      'No profile for %. She must have signed in at least once. See add_admin_mary_glover.sql for creating an account.',
      v_instructor_email;
  end if;

  if not exists (
    select 1 from public.records
    where market = 'wichita' and collection = 'aemtCourses'
      and id = v_from_course and not deleted
  ) then
    raise exception 'No Wichita course %', v_from_course;
  end if;

  if not exists (
    select 1 from public.records
    where market = 'kc' and collection = 'aemtCourses'
      and id = v_to_course and not deleted
  ) then
    raise exception 'No Kansas City course % to enroll them into', v_to_course;
  end if;

  select count(*) into v_students
  from public.records
  where market = 'wichita' and collection = 'aemtStudents'
    and not deleted and data ->> 'courseId' = v_from_course;

  if v_students = 0 then
    raise exception 'Course % has no students to move.', v_from_course;
  end if;

  -- ---- the move ----------------------------------------------------------

  foreach v_collection in array v_collections loop
    if v_commit then
      insert into public.records (market, collection, id, data, deleted)
      select
        'kc',
        r.collection,
        r.id,
        -- Re-point at the joint course, and mark students as Wichita campus so
        -- the placement board keeps sending them to their own sites.
        case when r.collection = 'aemtStudents'
          then jsonb_set(
                 jsonb_set(r.data, '{courseId}', to_jsonb(v_to_course)),
                 '{campus}', '"wichita"'::jsonb, true)
          else jsonb_set(r.data, '{courseId}', to_jsonb(v_to_course))
        end,
        false
      from public.records r
      where r.market = 'wichita'
        and r.collection = v_collection
        and not r.deleted
        and r.data ->> 'courseId' = v_from_course
      on conflict (market, collection, id) do update
        set data = excluded.data, deleted = false;
      get diagnostics v_n = row_count;
    else
      select count(*) into v_n
      from public.records r
      where r.market = 'wichita'
        and r.collection = v_collection
        and not r.deleted
        and r.data ->> 'courseId' = v_from_course;
    end if;

    v_total := v_total + v_n;
    raise notice '  % — % row(s)', rpad(v_collection, 20), v_n;
  end loop;

  -- ---- her access --------------------------------------------------------

  if v_commit then
    update public.profiles set market = 'all' where user_id = v_uid;
  end if;

  raise notice '';
  if v_commit then
    raise notice 'MOVED % row(s) into course %, and % now spans both markets.',
      v_total, v_to_course, v_instructor_email;
    raise notice 'Her Wichita course % is untouched and still readable there.',
      v_from_course;
    raise notice 'She should sign out and back in to pick up the market switcher.';
  else
    raise notice 'DRY RUN — nothing was written. % row(s) would move.', v_total;
    raise notice 'Set v_commit := true to do it.';
  end if;
end $$;


-- ===========================================================================
-- AFTERWARDS
-- ===========================================================================
--
-- 1. Cassie signs out and back in. Her profile is read at sign-in, so the
--    market switcher does not appear until she does.
-- 2. She switches to Kansas City and confirms her students are on the joint
--    roster, each showing the Wichita campus.
-- 3. Her local device still holds the Wichita mirror. That is correct and it
--    is the fallback: nothing was removed from Wichita.
--
-- IF IT NEEDS UNDOING. Delete the copies, which is safe precisely because the
-- originals were never touched:
--
--   delete from public.records
--   where market = 'kc'
--     and collection = any(array['aemtStudents','aemtAttendance','aemtEncounters',
--                                'aemtShifts','aemtSkillChecks','aemtFormResponses',
--                                'aemtCompletions','aemtConferences'])
--     and id in (select id from public.records
--                where market = 'wichita' and data ->> 'courseId' = 'PASTE_WICHITA_COURSE_ID');
--
--   update public.profiles set market = 'wichita' where email = '...';
