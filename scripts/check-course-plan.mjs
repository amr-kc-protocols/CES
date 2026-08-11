// Consistency check for the AEMT course schedule.
//
// The schedule is transcribed from the AEMT course approval EagleMed filed for
// Wichita, which Kansas City runs as the same template. Two numbers in that
// source disagree with each other and one set of chapters is assigned twice;
// both are reproduced deliberately, and the assertions below pin the decisions
// so a later edit cannot quietly undo them.
//
// It also loads the module for its own sake. Deriving the targets once
// introduced a temporal dead zone — the hour targets called a function whose
// data was declared below them — and that is a crash on app startup that `tsc`
// and `vite build` both pass clean. Importing the module here is the cheapest
// way to never ship it twice.
//
// Run: node scripts/check-course-plan.mjs
import { rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src')
const OUT = join(tmpdir(), `ces-plan-check-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `export * from ${JSON.stringify(join(SRC, 'data/aemt'))}`,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
})

let m
try {
  m = await import(pathToFileURL(OUT).href)
} catch (err) {
  console.log('FAIL  data/aemt.ts throws on load — the app would not start')
  console.log(`      ${err.message}`)
  rmSync(OUT, { force: true })
  process.exit(1)
}

let failed = 0
const check = (ok, label, detail) => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok && detail) console.log(`        ${detail}`)
}

check(true, 'data/aemt.ts loads without throwing')

const t = m.scheduleTotals()
const plan = m.buildClassPlan()

// ----- the filing's own numbers ---------------------------------------------

// 116, not the 110 its summary line states. Decided 11 Aug 2026: the schedule
// is what KBEMS reviews against.
check(t.didactic === 116, 'didactic totals 116 h — the sum of the filed rows', `${t.didactic} h`)
check(t.lab === 50, 'lab totals 50 h, as filed', `${t.lab} h`)
check(
  m.KC_HOUR_TARGETS.find((h) => h.id === 'didactic').hours === t.didactic &&
    m.KC_HOUR_TARGETS.find((h) => h.id === 'lab').hours === t.lab,
  'filed targets equal the schedule',
)
check(
  m.KC_CLASSROOM_TARGET === t.classroom,
  'classroom target equals didactic + lab',
  `${m.KC_CLASSROOM_TARGET} vs ${t.classroom}`,
)

// Wichita duplicates chapters 17 and 18. Reproduced on purpose — this asserts
// the known set so a NEW duplicate still shows up as a change.
const dupes = m.duplicatedChapters()
check(
  dupes.join(',') === '17,18',
  'the only duplicated chapters are the filing’s own 17 and 18',
  `duplicated: ${dupes.join(', ') || 'none'}`,
)

const un = m.unscheduledChapters()
check(
  un.length === 0,
  'every chapter of the text is assigned somewhere',
  un.map((c) => `ch ${c.n} ${c.title}`).join('; '),
)

// ----- the eight-hour cap ----------------------------------------------------

// Every face-to-face row is one Tue/Thu pair. This is the shape the budget is
// set by, and the reason assignment hours are tracked separately at all.
const badF2f = m.KC_SCHEDULE.filter(
  (r) => r.delivery === 'f2f' && r.didacticHours + r.labHours !== m.CLASS_HOURS_PER_WEEK,
)
check(
  badF2f.length === 0,
  `every face-to-face row is exactly ${m.CLASS_HOURS_PER_WEEK} h`,
  badF2f.map((r) => `${r.label} = ${r.didacticHours + r.labHours} h`).join(', '),
)

const f2fByDate = new Map()
for (const s of plan) {
  if (s.delivery !== 'f2f') continue
  f2fByDate.set(s.date, (f2fByDate.get(s.date) ?? 0) + s.hours)
}
const longDays = [...f2fByDate].filter(([, h]) => h > m.KC_CLASS_PATTERN.hoursPerDay + 1e-9)
check(
  longDays.length === 0,
  `no class day exceeds ${m.KC_CLASS_PATTERN.hoursPerDay} h`,
  longDays.map(([d, h]) => `${d} = ${h} h`).join(', '),
)

const f2fByWeek = new Map()
for (const s of plan) {
  if (s.delivery !== 'f2f') continue
  f2fByWeek.set(s.calendarWeek, (f2fByWeek.get(s.calendarWeek) ?? 0) + s.hours)
}
const longWeeks = [...f2fByWeek].filter(([, h]) => h > m.CLASS_HOURS_PER_WEEK + 1e-9)
check(
  longWeeks.length === 0,
  `no week exceeds ${m.CLASS_HOURS_PER_WEEK} h of instructor-led time`,
  longWeeks.map(([w, h]) => `week ${w} = ${h} h`).join(', '),
)

// ----- dates -----------------------------------------------------------------

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dayOf = (iso) => {
  const [y, mo, d] = iso.split('-').map(Number)
  return new Date(y, mo - 1, d).getDay()
}
const offPattern = plan.filter((s) => !m.KC_CLASS_PATTERN.days.includes(dayOf(s.date)))
check(
  offPattern.length === 0,
  `every session falls on ${m.KC_CLASS_PATTERN.days.map((d) => WEEKDAY[d]).join('/')}`,
  offPattern.map((s) => `${s.date} (${WEEKDAY[dayOf(s.date)]})`).join(', '),
)

// A class on a holiday is the failure the shifting exists to prevent.
const onHoliday = plan.filter((s) => s.delivery === 'f2f' && m.holidayOn(s.date))
check(
  onHoliday.length === 0,
  'no class lands on a holiday',
  onHoliday.map((s) => `${s.date} ${m.holidayOn(s.date)}`).join(', '),
)

check(
  plan[0].date === m.KC_START_DATE,
  `the first session is the filed start date, ${m.KC_START_DATE}`,
  `first session ${plan[0].date}`,
)

// ----- the plan carries the filing ------------------------------------------

const laidDidactic = plan.filter((s) => s.kind === 'didactic').reduce((n, s) => n + s.hours, 0)
const laidLab = plan.filter((s) => s.kind === 'lab').reduce((n, s) => n + s.hours, 0)
check(
  Math.abs(laidDidactic - t.didactic) < 0.01 && Math.abs(laidLab - t.lab) < 0.01,
  'the dated calendar carries the filed hours exactly',
  `laid ${laidDidactic}/${laidLab}, filed ${t.didactic}/${t.lab}`,
)

const missingRows = m.KC_SCHEDULE.filter((r) => !plan.some((s) => s.rowOrder === r.order))
check(
  missingRows.length === 0,
  'every filed row appears on the calendar',
  missingRows.map((r) => r.label).join(', '),
)

// ----- cross-check against the instructor guide ------------------------------
//
// Reported, never failed. The filing is the measure by decision; the guide's
// lecture timings are kept so the gap between the two is visible rather than
// forgotten.
const guideMinutes = m.KC_SCHEDULE.reduce((n, r) => n + m.lectureMinutesFor(r.chapters ?? []), 0)

console.log(`
  ${t.weeks} course weeks over ${m.KC_CALENDAR_WEEKS} calendar weeks · ${m.KC_START_DATE} to ${m.KC_END_DATE}
  didactic ${t.didactic} · lab ${t.lab} · classroom ${t.classroom} h
  face-to-face ${t.f2f} h over ${t.f2fWeeks} class weeks · assignments ${t.assignment} h
  ${plan.length} sessions · ${m.holidayShifts().length} week(s) pushed by a holiday

  cross-check — publisher lecture time for the chapters assigned: ${(guideMinutes / 60).toFixed(1)} h
  (the filing allots ${t.didactic} h of didactic across them; the guide is not the measure here)`)

console.log(
  failed === 0 ? '\nCourse schedule is internally consistent.' : `\n${failed} check(s) failed.`,
)
rmSync(OUT, { force: true })
process.exit(failed === 0 ? 0 : 1)
