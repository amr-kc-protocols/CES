// Behaviour check for student work lines against the class schedule.
//
// Every student on this cohort is a working EMT holding a bid line, and the
// course runs on top of it. The four Kansas City students' real lines, read off
// the KC Metro operations roster, are the fixtures below — because the defect
// this exists to catch is not hypothetical:
//
//   Class is Tuesday and Thursday, 0900-1300. Three of the four hold lines that
//   work Thursdays, and one works both class days. Nobody had put the two
//   schedules next to each other, so the collision was going to surface as an
//   attendance-cap failure somewhere around week six.
//
// THE MIDNIGHT CASE is the one worth writing a check for. A 1236 line runs
// 1200 to 0000. Read as a plain interval that is minus twelve hours, and every
// overlap test against it quietly returns false — so the tool would report no
// conflict for two of the four students who actually have one.
//
// Run: node scripts/check-work-pattern.mjs  (or `npm run check:workpattern`)
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')
const OUT = join(tmpdir(), `ces-work-${process.pid}.mjs`)

await build({
  stdin: {
    contents:
      `export * from ${JSON.stringify(join(SRC, 'modules/aemt/workPattern'))}\n` +
      `export * as D from ${JSON.stringify(join(SRC, 'data/aemt'))}\n`,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
})
const m = await import(pathToFileURL(OUT).href)
rmSync(OUT, { force: true })
const { D } = m

let failed = 0
const check = (ok, label, detail) => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok && detail) console.log(`        ${String(detail).split('\n').join('\n        ')}`)
}

// The Sunday that begins week one. Both weeks are identical on all four of
// these lines, so the anchor does not change the answer here — which is why the
// rotation itself is checked separately below, on a line where it does.
const ANCHOR = '2026-10-04'
/** The Sunday that begins week one of the Wichita Pitman, off their calendar. */
const PITMAN_ANCHOR = '2026-09-27'
const LINES = {
  // Kansas City — bid lines off the KC Metro master schedule, both weeks alike.
  'Miranda Burgoon': { line: 'KC105', los: 'ALS', startTime: '10:00', endTime: '20:00', shiftType: '1040', weekOne: [2, 3, 4, 5], weekTwo: [2, 3, 4, 5], anchorSunday: ANCHOR },
  'Abby Schmelzle': { line: 'KC107', los: 'ALS', startTime: '12:00', endTime: '00:00', shiftType: '1236', weekOne: [4, 5, 6], weekTwo: [4, 5, 6], anchorSunday: ANCHOR },
  'Spencer Mayes': { line: 'CM101', los: 'BLS', startTime: '12:00', endTime: '00:00', shiftType: '1236', weekOne: [3, 4, 5], weekTwo: [3, 4, 5], anchorSunday: ANCHOR },
  'Jessica Sexton': { line: 'AD101', los: 'Dedicated', startTime: '06:00', endTime: '18:00', shiftType: '1339', weekOne: [3, 4, 5], weekTwo: [3, 4, 5], anchorSunday: ANCHOR },
  // Wichita — a Pitman 2-2-3 on twelve-hour shifts. Read off the operation's
  // own calendar: Sun/Wed/Thu one week, Mon/Tue/Fri/Sat the next, which is an
  // exact fourteen-day cycle and therefore fits weekOne/weekTwo without
  // remainder. Seven shifts a fortnight, on/off blocks of 2-2-3.
  'Kara (Wichita)': { line: 'Pitman', startTime: '09:00', endTime: '21:00', weekOne: [0, 3, 4], weekTwo: [1, 2, 5, 6], anchorSunday: PITMAN_ANCHOR },
  'Alex (Wichita)': { line: 'Pitman', startTime: '12:00', endTime: '00:00', weekOne: [0, 3, 4], weekTwo: [1, 2, 5, 6], anchorSunday: PITMAN_ANCHOR },
}

// ----- the midnight shift ----------------------------------------------------

check(m.shiftHours(LINES['Abby Schmelzle']) === 12, 'a 1200-0000 line is twelve hours, not minus twelve', `${m.shiftHours(LINES['Abby Schmelzle'])} h`)
check(m.shiftHours(LINES['Jessica Sexton']) === 12, 'a 0600-1800 line is twelve hours')
check(m.shiftHours(LINES['Miranda Burgoon']) === 10, 'a 1000-2000 line is ten hours')

// ----- the two-week rotation -------------------------------------------------

const alternating = { startTime: '07:00', endTime: '19:00', weekOne: [1, 2], weekTwo: [4, 5], anchorSunday: ANCHOR }
check(m.rotationWeek(alternating, '2026-10-06') === 1, 'the anchor Sunday begins week one')
check(m.rotationWeek(alternating, '2026-10-13') === 2, 'the following week is week two')
check(m.rotationWeek(alternating, '2026-10-20') === 1, 'and it alternates back')
check(
  m.worksOn(alternating, '2026-10-06') && !m.worksOn(alternating, '2026-10-13'),
  'an alternating line works its week-one days in week one only',
  'a pattern flattened to one week is right half the time, which is worse than wrong',
)
// A date before the anchor still alternates rather than folding back.
check(m.rotationWeek(alternating, '2026-09-27') === 2, 'a date before the anchor still alternates')

// ----- the four real lines against the real schedule -------------------------

// EVERY session a student has to be in a room for, not just the Tuesday and
// Thursday classroom rows — which is what the app counts, and the difference
// matters: the two AHA provider courses run on Saturdays, and a 1236 line
// working Thu/Fri/Sat collides with those as well. Filtering to f2f here
// undercounted her by ten hours and made this check disagree with the screen.
const sessions = D.KC_SCHEDULE.filter(
  (r) => (r.delivery === 'f2f' || r.delivery === 'aha') && r.startTime,
).map((r) => ({
  id: r.label,
  date: r.date,
  startTime: r.startTime,
  endTime: r.endTime,
  title: r.title,
  delivery: r.delivery,
}))
check(sessions.length > 0, 'the filed schedule has dated sessions to compare against')
// The filter stays broader than f2f on purpose. It is written against every
// session a student has to be in a room for, not the Tuesday/Thursday rows,
// because a weekend line collides with a weekend session and with nothing on a
// Tuesday — which is exactly what a narrower filter hid when the two Saturday
// AHA courses were still in the schedule.
check(
  sessions.every((s) => s.delivery === 'f2f'),
  'every session students must attend is now a Tue/Thu classroom row',
  sessions.filter((s) => s.delivery !== 'f2f').map((s) => `${s.date} ${s.delivery}`).join(', '),
)

const results = Object.entries(LINES).map(([name, workPattern]) => ({
  name,
  ...m.workConflicts({ id: name, name, workPattern }, sessions, D.MAX_ABSENT_HOURS),
}))

// Every line has to produce SOME signal — an overlap, or a session butting
// against a shift. A line that produces neither on a six-day-a-fortnight
// rotation against a two-day-a-week class is the engine having silently
// stopped working, which is the failure mode worth guarding: three of these
// students genuinely have no overlap now, and "no overlap" and "not computed"
// look identical from the outside.
for (const r of results) {
  check(
    r.clashes.length + r.tight.length > 0,
    `${r.name}'s line is actually being compared against the schedule`,
    'no overlap AND no tight gap — the rotation or midnight handling has regressed',
  )
}

// The schedule moved to Mondays and Thursdays 0800-1200 BECAUSE of these
// numbers, so the assertions below are the after picture. Three students came
// out clean; the three who did not are the ones whose shifts start before noon.

const of = (name) => results.find((r) => r.name === name)

// Monday is the whole point of the move: none of the four Kansas City students
// works one, and it is inside the primary instructor's filed availability.
const mondayClashes = results.flatMap((r) =>
  r.clashes.filter((c) => new Date(c.session.date + 'T00:00:00').getDay() === 1),
)
check(
  mondayClashes.every((c) => c.session.date >= '2026-10-05'),
  'every Monday clash that remains is real, not an artefact of the anchor',
)
check(
  !['Miranda Burgoon', 'Abby Schmelzle', 'Spencer Mayes', 'Jessica Sexton'].some((n) =>
    of(n).clashes.some((c) => new Date(c.session.date + 'T00:00:00').getDay() === 1),
  ),
  'no Kansas City student loses a Monday hour — that is why the class day moved',
  mondayClashes.map((c) => c.session.date).join(', '),
)

// Three students the move cleared outright. Worth asserting by name: if a
// future schedule change puts hours back on them, it should have to be noticed.
for (const name of ['Abby Schmelzle', 'Spencer Mayes', 'Alex (Wichita)']) {
  const r = of(name)
  check(
    r.hoursLost === 0 && !r.overCap,
    `${name} loses no class hours on the Monday/Thursday schedule`,
    `${r.hoursLost} h across ${r.clashes.length} sessions`,
  )
}

// ...and all three finish class at 1200 and start a shift at 1200. Zero
// overlap, zero minutes to travel. Not an absence, and not nothing.
for (const name of ['Abby Schmelzle', 'Spencer Mayes', 'Alex (Wichita)']) {
  const r = of(name)
  check(
    r.tight.length > 0 && r.tight.every((c) => c.tightAgainstShift === 'on-after'),
    `${name} is flagged as going straight from class onto a shift`,
    `${r.tight.length} tight sessions — a day reported clean here would be the tool missing the handover`,
  )
}

// The three the move did not fix, and by how much. Each is a Thursday problem:
// a shift that starts before class ends.
const REMAINING = {
  'Jessica Sexton': { hours: 60, why: '0600-1800 swallows every Thursday session whole' },
  'Kara (Wichita)': { hours: 45, why: '0900 start takes three of the four hours, alternating Mon and Thu' },
  // 15 Thursdays at two hours, plus the one session moved to Tuesday 19
  // January off MLK Day — she works Tuesdays too, which is the cost of that
  // move and the reason it is worth seeing rather than assuming.
  'Miranda Burgoon': { hours: 32, why: 'a 1000 start takes the last two hours of every Thursday, and of the Tuesday moved off MLK Day' },
}
for (const [name, exp] of Object.entries(REMAINING)) {
  const r = of(name)
  check(
    r.hoursLost === exp.hours,
    `${name} still loses ${exp.hours} h — ${exp.why}`,
    `${r.hoursLost} h`,
  )
}

// Jessica's is the only one where the whole session goes.
check(
  of('Jessica Sexton').clashes.every((c) => c.whole),
  'a 0600-1800 line loses the whole four-hour session, not part of it',
)
check(
  of('Miranda Burgoon').clashes.every((c) => !c.whole && c.overlapHours === 2),
  'a 1000 start loses exactly the two hours between 1000 and 1200',
)
// The session moved off MLK Day lands on a Tuesday, and Miranda works those.
// Two hours is what that decision cost; naming it here is what stops it being
// re-litigated from memory.
check(
  of('Miranda Burgoon').clashes.some((c) => c.session.date === '2027-01-19'),
  'the session moved off MLK Day costs Miranda two hours, and the roster says so',
)

// The Pitman alternates, so Kara loses a Monday one fortnight and a Thursday
// the next — which a pattern flattened to a single week would get wrong half
// the time, and is the reason the rotation is anchored rather than guessed.
const karaDays = new Set(
  of('Kara (Wichita)').clashes.map((c) => new Date(c.session.date + 'T00:00:00').getDay()),
)
check(
  karaDays.has(1) && karaDays.has(4),
  'the Pitman costs Kara both a Monday and a Thursday across the fortnight',
  `weekdays hit: ${[...karaDays].join(', ')}`,
)

// A student with no line recorded reports as unknown, not as clean.
const blank = m.workConflicts({ id: 'x', name: 'No line recorded' }, sessions, D.MAX_ABSENT_HOURS)
check(
  blank.pattern === undefined && blank.clashes.length === 0 && !blank.overCap,
  'a student with no line recorded reports nothing rather than a clean sheet',
  'every screen that reads this has to say "not recorded" rather than "no conflict"',
)

console.log(`
  ${sessions.length} dated classroom sessions — Mondays and Thursdays, 0800-1200
${results
  .map(
    (r) =>
      `  ${r.name.padEnd(18)} ${m.patternLabel(r.pattern)}
  ${''.padEnd(18)} ${r.clashes.length} sessions hit · ${r.hoursLost} h of class lost · cap is ${D.MAX_ABSENT_HOURS} h`,
  )
  .join('\n')}`)

console.log(
  failed === 0
    ? '\ncheck-work-pattern: the line and the class schedule are compared correctly, midnight included.'
    : `\n${failed} check(s) failed.`,
)
process.exit(failed === 0 ? 0 : 1)
