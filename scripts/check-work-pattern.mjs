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
const LINES = {
  'Miranda Burgoon': { line: 'KC105', los: 'ALS', startTime: '10:00', endTime: '20:00', shiftType: '1040', weekOne: [2, 3, 4, 5], weekTwo: [2, 3, 4, 5], anchorSunday: ANCHOR },
  'Abby Schmelzle': { line: 'KC107', los: 'ALS', startTime: '12:00', endTime: '00:00', shiftType: '1236', weekOne: [4, 5, 6], weekTwo: [4, 5, 6], anchorSunday: ANCHOR },
  'Spencer Mayes': { line: 'CM101', los: 'BLS', startTime: '12:00', endTime: '00:00', shiftType: '1236', weekOne: [3, 4, 5], weekTwo: [3, 4, 5], anchorSunday: ANCHOR },
  'Jessica Sexton': { line: 'AD101', los: 'Dedicated', startTime: '06:00', endTime: '18:00', shiftType: '1339', weekOne: [3, 4, 5], weekTwo: [3, 4, 5], anchorSunday: ANCHOR },
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

for (const r of results) {
  check(
    r.clashes.length > 0,
    `${r.name}'s line collides with the class schedule`,
    'if this passes as "no conflict" the midnight or rotation handling has regressed',
  )
}

/** Only the Tuesday/Thursday 0900-1300 rows, where the arithmetic is uniform. */
const classroom = (r) => r.clashes.filter((c) => c.session.delivery === 'f2f')

// Miranda's 1000-2000 covers 0900-1300 from 1000, on both class days.
const miranda = results.find((r) => r.name === 'Miranda Burgoon')
check(
  classroom(miranda).every((c) => c.overlapHours === 3 && !c.whole),
  'a 1000-2000 line loses three of the four class hours, not all four',
  classroom(miranda).slice(0, 2).map((c) => `${c.session.date} ${c.overlapHours}h whole=${c.whole}`).join(' · '),
)

// Jessica's 0600-1800 swallows the session whole.
const jessica = results.find((r) => r.name === 'Jessica Sexton')
check(
  classroom(jessica).every((c) => c.whole && c.overlapHours === 4),
  'a 0600-1800 line loses the whole four-hour session',
  classroom(jessica).slice(0, 2).map((c) => `${c.session.date} ${c.overlapHours}h whole=${c.whole}`).join(' · '),
)

// Abby and Spencer start at noon: one hour of a 0900-1300 session.
for (const name of ['Abby Schmelzle', 'Spencer Mayes']) {
  const r = results.find((x) => x.name === name)
  check(
    classroom(r).every((c) => c.overlapHours === 1 && !c.whole),
    `${name}'s noon start loses the last hour of each classroom session it lands on`,
    classroom(r).slice(0, 2).map((c) => `${c.session.date} ${c.overlapHours}h`).join(' · '),
  )
}

// Taking ACLS and PALS out of the filed schedule cost Abby's Saturdays their
// only collision — ten of her twenty-five hours. It is the one thing that
// change improved for anybody, and it is worth holding onto: if a weekend
// session is ever filed again, this stops being true and somebody should have
// to notice.
const abbyWeekend = results
  .find((r) => r.name === 'Abby Schmelzle')
  .clashes.filter((c) => [0, 6].includes(new Date(c.session.date + 'T00:00:00').getDay()))
check(
  abbyWeekend.length === 0,
  'a Thu/Fri/Sat line no longer collides with anything at the weekend',
  abbyWeekend.map((c) => `${c.session.date} ${c.overlapHours}h`).join(' · '),
)

// The finding this was written for.
for (const r of results) {
  check(
    r.overCap,
    `${r.name} is over the ${D.MAX_ABSENT_HOURS}-hour absence cap on their line alone`,
    `${r.hoursLost} h — if this ever passes, either the line changed or the check has stopped working`,
  )
}

// A student with no line recorded reports as unknown, not as clean.
const blank = m.workConflicts({ id: 'x', name: 'No line recorded' }, sessions, D.MAX_ABSENT_HOURS)
check(
  blank.pattern === undefined && blank.clashes.length === 0 && !blank.overCap,
  'a student with no line recorded reports nothing rather than a clean sheet',
  'every screen that reads this has to say "not recorded" rather than "no conflict"',
)

console.log(`
  ${sessions.length} dated classroom sessions students must attend — Tuesdays and Thursdays
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
