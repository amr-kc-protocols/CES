// Consistency check for the joint AEMT course schedule.
//
// The schedule is the October 2026 cohort plan that AMR Kansas City and AMR
// Wichita agreed to. Unlike the Wichita filing it replaced, it is DATED AT
// SOURCE: every row carries the day it is delivered on, because those dates are
// a commitment made to students and to the other market. So the assertions here
// are about the dates being what was agreed, not about a planner laying an
// undated shape onto a weekday pattern.
//
// Two defects in the source document are corrected rather than reproduced —
// week 15's ten-hour week, and a summary line that disagrees with its own rows.
// Both corrections are pinned below so a later edit cannot quietly undo them,
// and the distance from the document's own summary is REPORTED so it stays
// visible.
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
    contents:
      `export * from ${JSON.stringify(join(SRC, 'data/aemt'))}\n` +
      `export * as A from ${JSON.stringify(join(SRC, 'data/aemtAssessments'))}\n`,
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
const near = (a, b) => Math.abs(a - b) < 0.01

// ----- the agreed calendar ---------------------------------------------------

check(
  m.KC_START_DATE === '2026-10-06',
  'the course starts Tuesday 6 October 2026',
  m.KC_START_DATE,
)
check(
  m.KC_END_DATE === '2027-02-04',
  'the course ends Thursday 4 February 2027',
  m.KC_END_DATE,
)
check(t.weeks === 16, '16 instructional weeks', `${t.weeks}`)
check(
  m.KC_CALENDAR_WEEKS === 18,
  '18 calendar weeks — the two-week break is what makes up the difference',
  `${m.KC_CALENDAR_WEEKS}`,
)

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dayOf = (iso) => {
  const [y, mo, d] = iso.split('-').map(Number)
  return new Date(y, mo - 1, d).getDay()
}

// Class is Tuesday/Thursday. The AHA provider courses are the deliberate
// exception and are marked `standalone`, so they are checked separately rather
// than being an unexplained hole in the assertion.
const offPattern = m.KC_SCHEDULE.filter(
  (r) => !r.standalone && !m.KC_CLASS_PATTERN.days.includes(dayOf(r.date)),
)
check(
  offPattern.length === 0,
  `every non-standalone row falls on ${m.KC_CLASS_PATTERN.days.map((d) => WEEKDAY[d]).join('/')}`,
  offPattern.map((r) => `${r.label} ${r.date} (${WEEKDAY[dayOf(r.date)]})`).join(', '),
)

const ahaRows = m.KC_SCHEDULE.filter((r) => r.delivery === 'aha')
check(
  ahaRows.length === 2 && ahaRows.every((r) => dayOf(r.date) === 6),
  'both AHA provider courses are Saturdays',
  ahaRows.map((r) => `${r.short} ${r.date} (${WEEKDAY[dayOf(r.date)]})`).join(', '),
)
check(
  ahaRows.map((r) => r.date).join(',') === '2026-12-05,2027-01-09',
  'ACLS is Saturday 5 December and PALS Saturday 9 January',
  ahaRows.map((r) => r.date).join(', '),
)

// The whole point of absorbing the holidays instead of pushing past them.
const onHoliday = m.holidayCollisions()
check(
  onHoliday.length === 0,
  'no session lands on a holiday',
  onHoliday.map((h) => `${h.date} ${h.holiday}`).join(', '),
)

// Week 8 is the Thanksgiving week and runs Tuesday only. This is the single
// most load-bearing irregularity in the calendar: it is why ACLS is on a
// Saturday, and a later edit that "restores" the Thursday breaks both.
const week8f2f = m.KC_SCHEDULE.filter((r) => r.week === 8 && r.delivery === 'f2f')
check(
  week8f2f.length === 1 && week8f2f[0].date === '2026-11-24',
  'week 8 is a single Tuesday session — Thanksgiving is surrendered, not fought',
  week8f2f.map((r) => r.date).join(', '),
)

// Nothing is scheduled inside the winter break except the break block itself.
const inBreak = m.KC_SCHEDULE.filter(
  (r) =>
    r.date >= m.WINTER_BREAK.start &&
    r.date <= m.WINTER_BREAK.end &&
    r.short !== 'Break block',
)
check(
  inBreak.length === 0,
  `nothing is scheduled between ${m.WINTER_BREAK.start} and ${m.WINTER_BREAK.end}`,
  inBreak.map((r) => `${r.label} ${r.date}`).join(', '),
)

// ----- the pre-course block --------------------------------------------------

check(
  m.PRE_COURSE.date < m.KC_START_DATE,
  'the pre-course block is due before the first session',
  `${m.PRE_COURSE.date} vs ${m.KC_START_DATE}`,
)
check(
  m.PRE_COURSE_CHAPTERS.join(',') === '1,2,3,4',
  'chapters 1-4 are the pre-course block',
  m.PRE_COURSE_CHAPTERS.join(', '),
)
check(
  m.PRE_COURSE.week === 0 && t.weeks === 16,
  'it is week zero and does not add an instructional week',
  `week ${m.PRE_COURSE.week}, ${t.weeks} instructional weeks`,
)
// The point of moving it: no class day spends time re-covering this material.
check(
  !m.KC_SCHEDULE.some(
    (r) => r.delivery === 'f2f' && (r.chapters ?? []).some((c) => c <= 4),
  ),
  'no class session re-covers a pre-course chapter',
)
// And the first session opens on medical terminology, which is what the block
// was moved to make room for.
const firstClass = m.KC_SCHEDULE.filter((r) => r.delivery === 'f2f').sort((a, b) =>
  a.date < b.date ? -1 : 1,
)[0]
check(
  /medical terminology/i.test(firstClass.title),
  'the first session gets into medical terminology',
  firstClass.short,
)
check(
  (m.KC_SCHEDULE.find((r) => r.week === 1 && r.delivery === 'assignment').chapters ?? []).includes(5),
  'and chapter 5 is its pre-class reading',
)

// The pre-course row is dated before the course opens, which every date
// validator in the app would otherwise report as a filing error. `buildClassPlan`
// marks it week 0 and the seeder carries that onto the session; these two pin
// the mechanism, because the symptom is a permanent red flag on every seeded
// course and the cause is one missing field.
const preSessions = plan.filter((s) => s.rowOrder === m.PRE_COURSE.order)
check(
  preSessions.length === 1 && preSessions[0].week === 0,
  'the pre-course block reaches the calendar as week 0, which is what exempts it from the date check',
  preSessions.map((s) => `week ${s.week}`).join(', '),
)
check(
  plan.filter((s) => s.date < m.KC_START_DATE).every((s) => s.week === 0),
  'nothing but the pre-course block is dated before the course starts',
  plan.filter((s) => s.date < m.KC_START_DATE && s.week !== 0).map((s) => `${s.date} ${s.short}`).join(', '),
)

// ----- rows that carry no hours ----------------------------------------------
//
// The winter break and the week 16 remediation block are on the calendar
// deliberately with nothing on the clock. Everything else with no hours is a
// row somebody started and did not finish, and the session validator reports
// it — so the marker has to be on exactly the two rows that mean it.
const zeroHour = m.KC_SCHEDULE.filter((r) => m.rowHours(r) === 0)
check(
  zeroHour.length === 2 && zeroHour.every((r) => r.informational),
  'the only rows with no hours are the two marked informational',
  zeroHour.map((r) => `${r.short}${r.informational ? '' : ' (UNMARKED)'}`).join(', '),
)
check(
  m.KC_SCHEDULE.filter((r) => r.informational).every((r) => m.rowHours(r) === 0),
  'and nothing marked informational is carrying hours it would not be counted for',
)

// Times and hours are filed together and a KBEMS reviewer reads both, so a row
// whose clock span disagrees with its filed hours is a defect in the filing.
// The AHA Saturdays were 08:00-17:00 against 8 filed hours — an hour of lunch
// that the schedule claimed as instruction.
const clockMismatch = m.KC_SCHEDULE.filter((r) => {
  if (!r.startTime || !r.endTime) return false
  const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  return Math.abs((mins(r.endTime) - mins(r.startTime)) / 60 - m.rowHours(r)) > 0.25
})
check(
  clockMismatch.length === 0,
  'every timed row runs for exactly the hours it files',
  clockMismatch
    .map((r) => `${r.short} ${r.startTime}-${r.endTime} vs ${m.rowHours(r)} h`)
    .join(', '),
)

// ----- the four-hour day and the eight-hour week -----------------------------

const byDate = new Map()
for (const r of m.KC_SCHEDULE) {
  if (r.delivery !== 'f2f') continue
  byDate.set(r.date, (byDate.get(r.date) ?? 0) + m.rowHours(r))
}
const longDays = [...byDate].filter(([, h]) => h > m.KC_CLASS_PATTERN.hoursPerDay + 1e-9)
check(
  longDays.length === 0,
  `no class day exceeds ${m.KC_CLASS_PATTERN.hoursPerDay} h`,
  longDays.map(([d, h]) => `${d} = ${h} h`).join(', '),
)

const byWeek = new Map()
for (const r of m.KC_SCHEDULE) {
  if (r.delivery !== 'f2f') continue
  byWeek.set(r.week, (byWeek.get(r.week) ?? 0) + m.rowHours(r))
}
const longWeeks = [...byWeek].filter(([, h]) => h > m.CLASS_HOURS_PER_WEEK + 1e-9)
check(
  longWeeks.length === 0,
  `no week exceeds ${m.CLASS_HOURS_PER_WEEK} h of instructor-led time`,
  longWeeks.map(([w, h]) => `week ${w} = ${h} h`).join(', '),
)

// Week 15 is filed 4 + 4, not the document's 6 + 4. Pinned because it is a
// deliberate departure from the source and reads like a typo from the outside.
check(
  byWeek.get(15) === 8,
  'week 15 is 8 h, not the document’s 10 — filed as 4 didactic + 4 lab',
  `week 15 = ${byWeek.get(15)} h`,
)

// 15 full weeks of 8 h, plus the Thanksgiving week's single 4 h session.
check(
  near(t.f2f, 15 * m.CLASS_HOURS_PER_WEEK + m.KC_CLASS_PATTERN.hoursPerDay),
  'face-to-face totals 124 h — fifteen 8 h weeks plus the Thanksgiving Tuesday',
  `${t.f2f} h`,
)

// ----- the hours ------------------------------------------------------------

check(near(t.lab, 52), 'lab totals 52 h, as the plan states', `${t.lab} h`)
check(near(t.aha, 16), 'AHA provider courses total 16 h, as the plan states', `${t.aha} h`)
check(
  near(t.f2fDidactic + t.lab, t.f2f),
  'face-to-face splits exactly into didactic and lab',
  `${t.f2fDidactic} + ${t.lab} vs ${t.f2f}`,
)
check(
  near(t.didactic, t.f2fDidactic + t.assignment),
  'didactic is face-to-face didactic plus pre-class work',
  `${t.didactic} vs ${t.f2fDidactic} + ${t.assignment}`,
)
check(
  near(m.KC_HOUR_TARGETS.find((h) => h.id === 'didactic').hours, t.didactic) &&
    near(m.KC_HOUR_TARGETS.find((h) => h.id === 'lab').hours, t.lab) &&
    near(m.KC_HOUR_TARGETS.find((h) => h.id === 'aha').hours, t.aha),
  'filed targets equal the schedule',
)
check(
  near(m.KC_CLASSROOM_TARGET, t.classroom),
  'classroom target equals didactic + lab + AHA',
  `${m.KC_CLASSROOM_TARGET} vs ${t.classroom}`,
)
check(
  m.KC_CLINICAL_TARGET === 72 && m.KC_FIELD_TARGET === 144,
  'clinical 72 h and field internship 144 h — 18 twelve-hour shifts',
  `${m.KC_CLINICAL_TARGET} / ${m.KC_FIELD_TARGET}`,
)

// ----- the text --------------------------------------------------------------

// §10 of the joint plan asks for the chapter-to-topic mapping to be rebuilt
// from the Fourth Edition table of contents, because Wichita's filing assigned
// chapters 17 and 18 in two different weeks. This is that fix, guarded.
const dupes = m.duplicatedChapters()
check(
  dupes.length === 0,
  'no chapter is assigned twice — the 17/18 duplication is fixed, not reproduced',
  `duplicated: ${dupes.join(', ')}`,
)

const un = m.unscheduledChapters()
check(
  un.length === 0,
  'every chapter of the text is assigned somewhere',
  un.map((c) => `ch ${c.n} ${c.title}`).join('; '),
)

check(
  m.COURSE_TEXT.edition === '4th' && m.COURSE_TEXT.copyright === 2023,
  'the adopted text is the Fourth Edition, 2023 — the edition mismatch is resolved',
  `${m.COURSE_TEXT.edition} ${m.COURSE_TEXT.copyright}`,
)

// Wichita's standards coverage carried onto the new calendar. Losing a code
// here is losing an argument to KBEMS about what the course covers.
check(
  m.SCHEDULE_SECTIONS.length === 61,
  'all 61 Kansas AEMT Education Standards codes carry over from the Wichita filing',
  `${m.SCHEDULE_SECTIONS.length} codes`,
)

// ----- assessments -----------------------------------------------------------

check(
  m.GRADING_WEIGHT_TOTAL === 100,
  'the grading model sums to 100%',
  `${m.GRADING_WEIGHT_TOTAL}%`,
)

const A = m.A
const assessed = new Set(m.KC_SCHEDULE.flatMap((r) => r.assessmentIds ?? []))
const orphanRows = [...assessed].filter((id) => !A.assessment(id))
check(
  orphanRows.length === 0,
  'every assessment a schedule row names exists',
  orphanRows.join(', '),
)
const unplaced = A.COURSE_ASSESSMENTS.filter((a) => !assessed.has(a.id))
check(
  unplaced.length === 0,
  'every assessment is placed on a schedule row',
  unplaced.map((a) => a.id).join(', '),
)

// An assessment dated differently from the session that administers it is the
// failure that puts a gate on the wrong day in front of six students.
const rowDateOf = new Map()
for (const r of m.KC_SCHEDULE) for (const id of r.assessmentIds ?? []) rowDateOf.set(id, r.date)
const misdated = A.COURSE_ASSESSMENTS.filter(
  (a) => a.kind !== 'testprep' && rowDateOf.get(a.id) !== a.date,
)
check(
  misdated.length === 0,
  'every assessment is dated the same as the session that administers it',
  misdated.map((a) => `${a.id}: ${a.date} vs row ${rowDateOf.get(a.id)}`).join(', '),
)

check(
  A.MASTERY_GATES.length === 3 &&
    A.MASTERY_GATES.map((g) => g.date).join(',') === '2026-10-29,2026-12-01,2027-01-21',
  'three gates, on 29 October, 1 December and 21 January',
  A.MASTERY_GATES.map((g) => g.date).join(', '),
)
check(
  A.MASTERY_GATES.every((g) => g.mps === m.MIN_PASSING_PERCENT && g.retestBy > g.date),
  `every gate is scored at ${m.MIN_PASSING_PERCENT}% with a retest window after it`,
)
check(
  A.RETRIEVAL_QUIZZES.length === 12,
  'twelve cumulative retrieval quizzes, A through L',
  `${A.RETRIEVAL_QUIZZES.length}`,
)
check(
  A.SESSION_TEMPLATE.reduce((n, b) => n + b.minutes, 0) === 240,
  'the standard session template fills the 4-hour class day',
  `${A.SESSION_TEMPLATE.reduce((n, b) => n + b.minutes, 0)} min`,
)

// ----- the plan carries the schedule ----------------------------------------

const laid = (kind) =>
  plan.filter((s) => s.kind === kind).reduce((n, s) => n + s.hours, 0)
check(
  near(laid('didactic'), t.didactic) && near(laid('lab'), t.lab) && near(laid('aha'), t.aha),
  'the dated calendar carries the filed hours exactly',
  `laid ${laid('didactic')}/${laid('lab')}/${laid('aha')}, filed ${t.didactic}/${t.lab}/${t.aha}`,
)
// An AHA Saturday bucketed as didactic is sixteen hours the hours
// reconciliation would report as an over-run against a target nobody missed.
check(
  plan.every((s) => (s.delivery === 'aha') === (s.kind === 'aha')),
  'AHA hours are their own kind, not folded into didactic',
  plan
    .filter((s) => (s.delivery === 'aha') !== (s.kind === 'aha'))
    .map((s) => `${s.date} ${s.short} (${s.delivery}/${s.kind})`)
    .join(', '),
)

const missingRows = m.KC_SCHEDULE.filter((r) => !plan.some((s) => s.rowOrder === r.order))
check(
  missingRows.length === 0,
  'every row appears on the calendar',
  missingRows.map((r) => r.label).join(', '),
)

// Re-dating a later cohort must not scramble the weekdays.
const shifted = m.buildClassPlan('2027-10-05')
check(
  shifted.every(
    (s) => dayOf(s.date) === dayOf(plan.find((p) => p.rowOrder === s.rowOrder).date),
  ),
  're-dating a later cohort keeps every session on its own weekday',
)

// A cohort seeded with a different start date re-dates the plan by whole weeks,
// so anything that answers "when is this taught" has to move with it. This
// returned the October-2026 date verbatim, which put a 2026 date beside a
// correct week label on a 2027 cohort.
{
  const here = m.sessionForSheet('iv-start', 'lifepak-15')
  const later = m.sessionForSheet('iv-start', 'lifepak-15', '2027-10-05')
  check(
    here.plannedDate === here.date && later.plannedDate !== here.date,
    'sessionForSheet re-dates for a later cohort instead of returning the filed date',
    `${here?.plannedDate} vs ${later?.plannedDate}`,
  )
  const laid = m.buildClassPlan('2027-10-05').find((s) => s.rowOrder === here.order).date
  check(
    later.plannedDate === laid,
    'and agrees with buildClassPlan for the same cohort',
    `${later.plannedDate} vs ${laid}`,
  )
  check(
    m.sessionForSheet('@monitor') === undefined &&
      m.sessionForSheet('lifepak-15', 'lifepak-15') !== undefined,
    'the monitor placeholder resolves through the course’s own monitor, not by its literal name',
  )
}

// ----- reported, never failed ------------------------------------------------
//
// The distance from the source document's own summary line, and from the
// publisher's lecture timings. Both are kept visible rather than reconciled
// away: the document says in terms to tune the didactic split to whatever
// totals are filed, and the publisher's guide is a cross-check, not the measure.
const guideMinutes = m.KC_SCHEDULE.reduce((n, r) => n + m.lectureMinutesFor(r.chapters ?? []), 0)
const f = m.FILED_SUMMARY
const delta = (a, b) => `${a > b ? '+' : ''}${Math.round((a - b) * 10) / 10}`

console.log(`
  ${t.weeks} instructional weeks over ${m.KC_CALENDAR_WEEKS} calendar weeks · ${m.KC_START_DATE} to ${m.KC_END_DATE}
  didactic ${t.didactic} · lab ${t.lab} · AHA ${t.aha} · classroom ${t.classroom} h
  face-to-face ${t.f2f} h over ${t.f2fWeeks} class weeks · pre-class ${t.assignment} h
  clinical ${m.KC_CLINICAL_TARGET} h · field ${m.KC_FIELD_TARGET} h · ${plan.length} sessions

  against the plan's own summary line (${f.source}):
    face-to-face didactic  ${t.f2fDidactic} vs ${f.f2fDidactic}  (${delta(t.f2fDidactic, f.f2fDidactic)})
    pre-class              ${t.assignment} vs ${f.assignment}  (${delta(t.assignment, f.assignment)})
    didactic total         ${t.didactic} vs ${f.didactic}  (${delta(t.didactic, f.didactic)})
    lab                    ${t.lab} vs ${f.lab}  (${delta(t.lab, f.lab)})
    AHA                    ${t.aha} vs ${f.aha}  (${delta(t.aha, f.aha)})

  cross-check — publisher lecture time for the chapters assigned: ${(guideMinutes / 60).toFixed(1)} h
  (the schedule allots ${t.didactic} h of didactic across them; the guide is not the measure here)`)

console.log(
  failed === 0 ? '\nCourse schedule is internally consistent.' : `\n${failed} check(s) failed.`,
)
rmSync(OUT, { force: true })
process.exit(failed === 0 ? 0 : 1)
