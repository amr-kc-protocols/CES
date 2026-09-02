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
      `export * as A from ${JSON.stringify(join(SRC, 'data/aemtAssessments'))}\n` +
      `export * as N from ${JSON.stringify(join(SRC, 'data/navigateAssets'))}\n` +
      `export * as STD from ${JSON.stringify(join(SRC, 'data/aemtStandards'))}\n` +
      `export * as PH from ${JSON.stringify(join(SRC, 'data/aemtPhases'))}\n`,
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
  m.KC_START_DATE === '2026-10-12',
  'the course starts Monday 12 October 2026',
  m.KC_START_DATE,
)
check(
  m.KC_END_DATE === '2027-02-11',
  'the course ends Thursday 11 February 2027',
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
// Exactly one session is off the Monday/Thursday pattern, and it is a decision
// rather than a slip: Martin Luther King Jr. Day falls on the Monday of week
// 14, and that week's multisystem trauma didactic is what its own trauma lab
// and Gate 3 are built on. Named by date so a SECOND stray row still fails.
const MOVED_FOR_A_HOLIDAY = ['2027-01-19']
const offPattern = m.KC_SCHEDULE.filter(
  (r) =>
    !r.standalone &&
    !MOVED_FOR_A_HOLIDAY.includes(r.date) &&
    !m.KC_CLASS_PATTERN.days.includes(dayOf(r.date)),
)
check(
  offPattern.length === 0,
  `every non-standalone row falls on ${m.KC_CLASS_PATTERN.days.map((d) => WEEKDAY[d]).join('/')}`,
  offPattern.map((r) => `${r.label} ${r.date} (${WEEKDAY[dayOf(r.date)]})`).join(', '),
)

// ACLS and PALS came out of the filed schedule: both operations run them
// through their own AHA classes, so the sixteen hours are not this course's to
// file and the two Saturdays are gone. What is worth asserting now is that they
// are gone CLEANLY — a leftover row would be sixteen hours filed against a
// course nobody here is teaching, and a leftover promise in the syllabus would
// be worse, which is what the document checks cover.
const ahaRows = m.KC_SCHEDULE.filter((r) => r.delivery === 'aha')
check(
  ahaRows.length === 0,
  'no AHA provider course is filed on this cohort',
  ahaRows.map((r) => `${r.short} ${r.date}`).join(', '),
)
// Which leaves the winter break as the only row outside the Monday/Thursday pattern.
const standalone = m.KC_SCHEDULE.filter((r) => r.standalone)
check(
  standalone.every((r) => r.delivery === 'assignment'),
  'every remaining standalone row is student work, not a session in a room',
  standalone.filter((r) => r.delivery !== 'assignment').map((r) => r.label).join(', '),
)

// A session displaced out of its teaching week points at the reading it was
// actually built on. The respiratory laboratory moved a week forward to clear
// Thanksgiving; before this it inherited week 8's cardiovascular chapter, and
// the agenda told whoever ran the lab to assume the cohort had read it.
const displaced = m.KC_SCHEDULE.filter((r) => r.preClassWeek !== undefined)
const badDisplaced = displaced.filter((r) => {
  if (r.preClassWeek === r.week) return true
  const reading = m.KC_SCHEDULE.find(
    (x) => x.week === r.preClassWeek && x.delivery === 'assignment' && !x.standalone,
  )
  return !reading
})
check(
  badDisplaced.length === 0,
  'every session that borrows another week’s reading names a week that has some',
  badDisplaced.map((r) => `${r.label}: preClassWeek ${r.preClassWeek}`).join(', '),
)
// And the converse: a face-to-face session whose short name is carried by a
// different week's block is displaced whether or not anyone said so.
const respiratoryLab = m.KC_SCHEDULE.find((r) => r.short === 'Respiratory lab')
const respiratoryDidactic = m.KC_SCHEDULE.find((r) => r.short === 'Respiratory')
check(
  !respiratoryLab ||
    !respiratoryDidactic ||
    respiratoryLab.week === respiratoryDidactic.week ||
    respiratoryLab.preClassWeek === respiratoryDidactic.week,
  'the respiratory laboratory reads the respiratory week’s chapter, not the week it landed in',
  respiratoryLab
    ? `lab is week ${respiratoryLab.week}, reading week ${respiratoryLab.preClassWeek}, didactic is week ${respiratoryDidactic?.week}`
    : 'no respiratory lab',
)

// A session off the Monday/Thursday pattern is a decision, and the row that
// carries it has to be the row that explains it. The MLK note spent a version
// attached to the Monday one week later: the calendar was right, and the only
// page that said WHY the cohort was in a room on a Tuesday pointed at a
// different day.
{
  const pattern = new Set(m.KC_CLASS_PATTERN.days)
  const offPattern = m.KC_SCHEDULE.filter(
    (r) => r.delivery === 'f2f' && !pattern.has(new Date(`${r.date}T00:00:00Z`).getUTCDay()),
  )
  const unexplained = offPattern.filter((r) => !r.note)
  check(
    unexplained.length === 0,
    'every session off the Monday/Thursday pattern carries its own explanation',
    unexplained.map((r) => `${r.label} ${r.date}`).join(', '),
  )
  // And no session ON the pattern claims to be the exception.
  const misplaced = m.KC_SCHEDULE.filter(
    (r) =>
      r.delivery === 'f2f' &&
      pattern.has(new Date(`${r.date}T00:00:00Z`).getUTCDay()) &&
      /not on a Monday or a Thursday|the one session not on/i.test(r.note ?? ''),
  )
  check(
    misplaced.length === 0,
    'no session on the pattern carries the off-pattern explanation',
    misplaced.map((r) => `${r.label} ${r.date}`).join(', '),
  )
}

// The whole point of absorbing the holidays instead of pushing past them.
const onHoliday = m.holidayCollisions()
check(
  onHoliday.length === 0,
  'no session lands on a holiday',
  onHoliday.map((h) => `${h.date} ${h.holiday}`).join(', '),
)

// Week 8 is the Thanksgiving week and runs Monday only — Thanksgiving takes
// its Thursday. A later edit that "restores" that Thursday puts a session on
// 26 November.
// Week 7 is the Thanksgiving week now that the course starts a week later, and
// it runs Monday only. The respiratory laboratory that would have been its
// Thursday moved to the Monday after rather than being surrendered — a CPAP
// check-off is not a thing to give up to a holiday — so week 8 carries three
// f2f-shaped rows' worth of content across two days.
const week7f2f = m.KC_SCHEDULE.filter((r) => r.week === 7 && r.delivery === 'f2f')
check(
  week7f2f.length === 1 && week7f2f[0].date === '2026-11-23',
  'week 7 is a single Monday session — Thanksgiving is surrendered, not fought',
  week7f2f.map((r) => r.date).join(', '),
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
  const span = mins(r.endTime) - mins(r.startTime) - (r.breakMinutes ?? 0)
  return Math.abs(span / 60 - m.rowHours(r)) > 0.25
})
check(
  clockMismatch.length === 0,
  'every timed row runs for exactly the hours it files, once a declared break is taken off',
  clockMismatch
    .map((r) => `${r.short} ${r.startTime}-${r.endTime} vs ${m.rowHours(r)} h`)
    .join(', '),
)
// No row declares a break any more — the AHA Saturdays were the only ones long
// enough to need one. The rule stays because the arithmetic it protects is the
// point: a row whose clock span exceeds its filed hours must declare the
// difference as a break rather than publish a false end time, which is how a
// student ends up told the day finishes an hour before it does.
check(
  m.KC_SCHEDULE.filter((r) => r.breakMinutes).every(
    (r) => m.rowHours(r) > 0 && r.endTime && r.startTime,
  ),
  'any row declaring a break still publishes its real end time',
  m.KC_SCHEDULE.filter((r) => r.breakMinutes).map((r) => `${r.short} ${r.endTime}`).join(', '),
)

// ----- pre-class hours come from the publisher -------------------------------
//
// Every assignment row's hours are the sum of its chapters' Navigate module
// run times, from the instructor guide. They used to be typed from the
// October 2026 plan's per-WEEK aggregates, which meant splitting "3.6 hours
// for chapters 1-5" by a proportion invented here — and three of those splits
// were out by a tenth. Asserting it means adding a chapter to a week without
// moving its hours is caught rather than shipped.
const wrongHours = m.KC_SCHEDULE.filter(
  (r) =>
    r.delivery === 'assignment' &&
    (r.chapters ?? []).length > 0 &&
    Math.abs(m.N.moduleHours(r.chapters) - r.didacticHours) > 0.05,
)
check(
  wrongHours.length === 0,
  'every pre-class row files the publisher’s own module run time for its chapters',
  wrongHours
    .map((r) => `${r.short}: files ${r.didacticHours} h, modules run ${m.N.moduleHours(r.chapters)} h`)
    .join('; '),
)

// Every chapter the schedule assigns has to exist in the guide, or its hours
// silently count as zero.
const unknownChapters = [...new Set(m.KC_SCHEDULE.flatMap((r) => r.chapters ?? []))].filter(
  (c) => !m.N.chapterAssets(c),
)
check(
  unknownChapters.length === 0,
  'every chapter the schedule assigns is in the instructor guide',
  unknownChapters.join(', '),
)
check(
  m.N.CHAPTER_ASSETS.length === m.TEXTBOOK_CHAPTERS.length,
  'the guide and the textbook chapter list are the same length',
  `${m.N.CHAPTER_ASSETS.length} vs ${m.TEXTBOOK_CHAPTERS.length}`,
)

// ----- the standards coverage argument ---------------------------------------
//
// K.A.R. 109-10-1c adopts the October 2014 Kansas AEMT Education Standards, and
// approval turns partly on whether the schedule covers them. The curriculum
// document prints that coverage as a map, so a code on a row with no entry —
// or an entry no row uses — is a hole in the argument rather than a typo.
const undefinedCodes = m.SCHEDULE_SECTIONS.filter((c) => !m.STD.standard(c))
check(
  undefinedCodes.length === 0,
  'every standards code the schedule names has a definition',
  undefinedCodes.join(', '),
)
const unusedCodes = m.STD.STANDARDS.filter((s) => !m.SCHEDULE_SECTIONS.includes(s.code))
check(
  unusedCodes.length === 0,
  'every defined standard is taught in a session',
  unusedCodes.map((s) => s.code).join(', '),
)
check(
  m.STD.STANDARDS.every((s) => m.STD.STANDARD_GROUPS[s.group]),
  'every standard belongs to a named instructional area',
  m.STD.STANDARDS.filter((s) => !m.STD.STANDARD_GROUPS[s.group]).map((s) => s.code).join(', '),
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

// ----- the dates the prose states --------------------------------------------
//
// KBEMS deadlines are stored as offsets from the first or last session, so they
// recompute when the course moves. Their NOTES are prose, and prose does not
// recompute: moving the start from Tuesday 6 October to Monday 5 October left
// two notes explaining that thirty days before the first session is "Sunday 6
// September", which had become Saturday 5 September. Same practical deadline,
// wrong arithmetic, in the note about the one date that can sink the cohort.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const spell = (iso) => {
  const [y, mo, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[mo - 1]}`
}
const offsetDate = (d) => {
  const anchorISO = d.anchor === 'last-session' ? m.KC_END_DATE : m.KC_START_DATE
  const [y, mo, dd] = anchorISO.split('-').map(Number)
  const t = new Date(Date.UTC(y, mo - 1, dd) + d.offsetDays * 86_400_000)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

// Any note that spells out a date must spell out one this cohort actually has.
const KNOWN_DATES = new Set([
  ...m.KBEMS_DEADLINES.map(offsetDate).map(spell),
  spell(m.KC_START_DATE),
  spell(m.KC_END_DATE),
  spell(m.PRE_COURSE_POLICY.dueBy),
])
const staleNotes = []
for (const d of m.KBEMS_DEADLINES) {
  // A date carrying its own year is a citation of something outside this
  // cohort — "NREMT retired the ALS psychomotor examination on 30 June 2024" —
  // and has nothing to do with when this course runs. Only bare dates are
  // claims about this cohort's calendar.
  for (const said of d.note.matchAll(
    /\b(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December)(?! \d{4})\b/g,
  )) {
    const spelled = `${Number(said[1])} ${said[2]}`
    // A practical deadline pulled back off a weekend is a real date this cohort
    // has too, so a computed date and the working day before it both pass. Three
    // days covers a Sunday pulled back to Friday; a week was loose enough to
    // accept the very error this was written to catch.
    const near = [...KNOWN_DATES].some((k) => {
      const [kd, km] = k.split(' ')
      const drift = Number(kd) - Number(said[1])
      return km === said[2] && drift >= 0 && drift <= 3
    })
    if (!near) staleNotes.push(`${d.id}: "${spelled}"`)
  }
}
check(
  staleNotes.length === 0,
  'no deadline note spells out a date this cohort does not have',
  staleNotes.join(', '),
)

// The same rule for the holiday notes, which say how each holiday is absorbed
// and are read straight onto the Sessions tab. One of them said the course
// ended on 4 February for a fortnight after it ended on the 11th.
const HOLIDAY_DATES = new Set([
  ...m.KC_HOLIDAYS.map((h) => spell(h.date)),
  ...m.KC_SCHEDULE.map((r) => spell(r.date)),
  spell(m.WINTER_BREAK.start),
  spell(m.WINTER_BREAK.end),
])
const SPELLED = /\b(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December)(?! \d{4})\b/g
const staleHolidays = []
for (const h of m.KC_HOLIDAYS) {
  for (const said of h.absorbedBy.matchAll(SPELLED)) {
    const spelled = `${Number(said[1])} ${said[2]}`
    if (!HOLIDAY_DATES.has(spelled)) staleHolidays.push(`${h.name}: "${spelled}"`)
  }
}
check(
  staleHolidays.length === 0,
  'no holiday note spells out a date this cohort does not have',
  staleHolidays.join(', '),
)

// A date is a real cohort date and still the wrong one: "after the 4 February
// course end" named a real class day while the course ran to the 11th. Where a
// note dates the end of the course, it has to be the end of the course.
const misdatedEnd = []
for (const [where, text] of [
  ...m.KC_HOLIDAYS.map((h) => [h.name, h.absorbedBy]),
  ...m.KBEMS_DEADLINES.map((d) => [d.id, d.note]),
]) {
  for (const said of text.matchAll(SPELLED)) {
    const around = text.slice(Math.max(0, said.index - 40), said.index + said[0].length + 40)
    if (!/course end|end of the course|course ends|last class/i.test(around)) continue
    const spelled = `${Number(said[1])} ${said[2]}`
    if (spelled !== spell(m.KC_END_DATE)) misdatedEnd.push(`${where}: "${spelled}"`)
  }
}
check(
  misdatedEnd.length === 0,
  `every note that dates the end of the course names ${spell(m.KC_END_DATE)}`,
  misdatedEnd.join(', '),
)

const approval = m.KBEMS_DEADLINES.find((d) => d.id === 'course-approval')
check(
  approval && approval.note.includes(spell(offsetDate(approval))),
  'the filing deadline note states the date the offset actually computes',
  approval ? `note does not mention ${spell(offsetDate(approval))} (30 days before ${m.KC_START_DATE})` : 'no course-approval deadline',
)

// ----- who teaches which day -------------------------------------------------
//
// The two instructors of record split the week: Mondays are the primary
// instructor's, Thursdays the co-instructor's. It is filed per row rather than
// derived, so the thing worth checking is that the rows and the agreement still
// say the same thing — a printed schedule naming the wrong person is a promise
// broken in front of students.

const unstaffed = m.KC_SCHEDULE.filter((r) => r.delivery === 'f2f' && !r.instructor)
check(
  unstaffed.length === 0,
  'every classroom session names the instructor who teaches it',
  unstaffed.map((r) => `${r.label} ${r.date}`).join(', '),
)
// A row may depart from the weekday split, but it has to say why. An exception
// list living in this file would grow until nobody remembered which entries
// were decisions; a reason on the row travels with it.
const MOVED = ['2027-01-19']
const offPatternStaffing = m.KC_SCHEDULE.filter(
  (r) =>
    r.delivery === 'f2f' &&
    !MOVED.includes(r.date) &&
    (dayOf(r.date) === 1) !== (r.instructor === 'primary'),
)
const unexplainedSwap = offPatternStaffing.filter((r) => !r.instructorNote?.trim())
check(
  unexplainedSwap.length === 0,
  'every session that departs from the Monday/Thursday split says why',
  unexplainedSwap.map((r) => `${r.date} ${WEEKDAY[dayOf(r.date)]} -> ${r.instructor}`).join(', '),
)
check(
  m.KC_SCHEDULE.every((r) => !r.instructorNote || r.instructor),
  'no row explains a swap it did not make',
)
const staffed = new Set(m.KC_SCHEDULE.filter((r) => r.instructor).map((r) => r.instructor))
check(
  staffed.size === 2,
  'both instructors of record actually teach',
  `only ${[...staffed].join(', ')} appears on the schedule`,
)

// ----- the hours ------------------------------------------------------------

check(near(t.lab, 52), 'lab totals 52 h, as the plan states', `${t.lab} h`)
check(near(t.aha, 0), 'no AHA hours are filed', `${t.aha} h`)
// The joint plan's own summary counted 16 h of AHA. That number is still in
// FILED_SUMMARY because it records what the source document said; the distance
// from it is now deliberate rather than drift, and saying so here is what stops
// somebody "fixing" the schedule back.
check(
  m.FILED_SUMMARY.aha === 16 && t.aha === 0,
  'the 16 h the source document filed for AHA is recorded as a deliberate departure',
  `filed ${m.FILED_SUMMARY.aha} h, scheduled ${t.aha} h`,
)
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
  ['didactic', 'lab', 'aha'].every((id) => {
    const target = m.KC_HOUR_TARGETS.find((h) => h.id === id)
    // A category the cohort does not file has no target row, and that is the
    // right answer rather than a row reading zero — but it has to agree with a
    // schedule that lays out none of it.
    return target ? near(target.hours, t[id]) : t[id] === 0
  }),
  'filed targets equal the schedule, and a category with no target lays out none',
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
    A.MASTERY_GATES.map((g) => g.date).join(',') === '2026-11-05,2026-12-07,2027-01-28',
  'three gates, on 5 November, 7 December and 28 January',
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

// The monitor placeholder, and the one row that answers for it.
//
// `@monitor` appears on more than one row — week 3 introduces the device and
// week 6 checks it off — so "the first row that names it" was the wrong
// answer: it told instructors the monitor sheet, 12-lead section and all, was
// due three weeks before ECG is taught and before the lab that grants the ECG
// clearance.
{
  const monitorRows = m.KC_SCHEDULE.filter((r) => (r.sheetIds ?? []).includes('@monitor'))
  check(
    monitorRows.length === 1 && monitorRows[0].week === 6,
    'exactly one row checks the cardiac monitor off, and it is the week 6 ECG lab',
    monitorRows.map((r) => `${r.label} (week ${r.week})`).join(', '),
  )
  check(
    m.sessionForSheet('lifepak-15', 'lifepak-15')?.week === 6 &&
      m.sessionForSheet('ekg-acquisition')?.week === 6,
    'the monitor and the ECG sheet resolve to the same lab',
    `${m.sessionForSheet('lifepak-15', 'lifepak-15')?.short} / ${m.sessionForSheet('ekg-acquisition')?.short}`,
  )
  check(
    m.sessionForSheet('@monitor') === undefined,
    'and the placeholder itself resolves to nothing — it is not a sheet',
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

// ----- the printed book, as against the modules --------------------------------
//
// Page extents come off the book's own table of contents. They are the only
// measure of what a student is actually holding: module run time says how long
// the Navigate lecture plays, and the two disagree by a lot — chapter 5 is
// eleven minutes of module against 36 pages of text.
{
  const byNum = [...m.N.CHAPTER_ASSETS].sort((a, b) => a.chapter - b.chapter)
  check(byNum.length === 42, `all 42 chapters carry page extents, got ${byNum.length}`)
  const bad = byNum.filter((c) => !(c.startPage > 0) || !(c.pages > 0))
  check(bad.length === 0, 'every chapter has a start page and an extent', bad.map((c) => c.chapter).join(', '))

  // The extents have to CHAIN: each chapter starts where the last one ended.
  // A mistyped page number is invisible on its own and obvious here.
  const gaps = []
  for (let i = 1; i < byNum.length; i++) {
    const prevEnd = byNum[i - 1].startPage + byNum[i - 1].pages
    if (prevEnd !== byNum[i].startPage) {
      gaps.push(`ch${byNum[i - 1].chapter} ends p${prevEnd}, ch${byNum[i].chapter} starts p${byNum[i].startPage}`)
    }
  }
  check(gaps.length === 0, 'the chapter page extents chain without gap or overlap', gaps.join('; '))
  check(byNum[0].startPage === 2, `chapter 1 starts on page 2, got ${byNum[0].startPage}`)
  const lastEnd = byNum[41].startPage + byNum[41].pages
  check(lastEnd === 2027, `chapter 42 ends where the glossary begins, p2027, got p${lastEnd}`)

  // pageRange collapses a contiguous run, which is the whole reason it exists.
  check(
    m.N.pageRange([30, 31, 32]) === '1395-1530',
    `three consecutive chapters read as one range, got "${m.N.pageRange([30, 31, 32])}"`,
  )
  check(
    m.N.pageRange([5, 7]).includes(','),
    `two chapters that are not adjacent read as two ranges, got "${m.N.pageRange([5, 7])}"`,
  )
}

// ----- instruments that exist, and instruments that do not --------------------
//
// gradingComponent says where a SCORE goes. It says nothing about whether the
// form exists. The baseline diagnostic sat on day one as a 50-item proctored
// exam nobody had, under a heading reading "Graded today" — on an event whose
// own record says it is ungraded. Provenance is now its own field.
{
  const bad = A.COURSE_ASSESSMENTS.filter(
    (a) => !['navigate', 'program', 'unsourced'].includes(a.source),
  )
  check(bad.length === 0, 'every assessment says where its instrument comes from', bad.map((a) => a.id).join(', '))

  const unsourced = A.unsourcedAssessments()
  check(
    unsourced.every((a) => a.sourceNote),
    'an instrument nobody has says what closing it would take',
    unsourced.filter((a) => !a.sourceNote).map((a) => a.id).join(', '),
  )
  // An unsourced instrument may not carry weight. A form that does not exist
  // cannot be a graded component of somebody's course grade.
  const weighted = unsourced.filter((a) => a.gradingComponent)
  check(
    weighted.length === 0,
    'nothing that does not exist yet counts toward a grade',
    weighted.map((a) => `${a.id} → ${a.gradingComponent}`).join(', '),
  )
  // Navigate holds its own scores. Anything routed to the navigate component
  // has to actually be a Navigate instrument, or the gradebook is being read
  // from a system that never saw it.
  const misrouted = A.COURSE_ASSESSMENTS.filter(
    (a) => a.gradingComponent === 'navigate' && a.source !== 'navigate',
  )
  check(
    misrouted.length === 0,
    'every assessment graded in Navigate is an instrument Navigate hosts',
    misrouted.map((a) => a.id).join(', '),
  )
}

// ----- re-dating the plan for a cohort that is not this one -------------------
//
// buildClassPlan shifts the filed plan by whole weeks so a later cohort can
// run the same shape. seedKcSchedule's own note says a shifted plan has to be
// re-checked against its year's holidays — and nothing was calling the
// function that answers that. A course created before this plan moved rebuilds
// to its OWN start date, which produces a plausible Monday/Thursday calendar,
// a week wrong, with sessions on Thanksgiving, New Year's Eve and MLK Day.
{
  check(
    m.holidayCollisions().length === 0,
    'the cohort as filed puts no session on a holiday',
    m.holidayCollisions().map((c) => `${c.date} ${c.holiday}`).join(', '),
  )
  // The shift is real and it does collide — the case the UI has to warn about.
  // Asserting it means the warning cannot be quietly deleted as unreachable.
  const shifted = m.holidayCollisions('2026-10-05')
  check(
    shifted.length > 0,
    'a plan re-dated off its own calendar still collides, so the warning has work to do',
  )
  const back = m.buildClassPlan('2026-10-05').filter((s) => s.startTime)
  check(
    back[0].date === '2026-10-05' && back[0].date !== m.KC_START_DATE,
    `re-dating moves the first class — ${back[0].date} against the filed ${m.KC_START_DATE}`,
  )
  // Whole weeks, so the meeting pattern survives a shift even when the dates
  // do not. A shift that broke the pattern would be a different bug wearing
  // the same clothes.
  const offPattern = back.filter(
    (s) => !m.KC_CLASS_PATTERN.days.includes(new Date(`${s.date}T00:00:00Z`).getUTCDay()),
  )
  check(
    offPattern.length === m.KC_SCHEDULE.filter(
      (r) => r.delivery === 'f2f' && !m.KC_CLASS_PATTERN.days.includes(new Date(`${r.date}T00:00:00Z`).getUTCDay()),
    ).length,
    're-dating by whole weeks keeps the meeting pattern',
    offPattern.map((s) => s.date).join(', '),
  )
}

// ----- prerequisites that have been settled ----------------------------------
//
// A closed prerequisite stays on the page rather than being deleted: what was
// settled, and when, is part of the filing record. So it has to carry a real
// date, and the sentence must not ALSO say "done" in prose — two conventions
// for the same fact is how one of them goes stale.
{
  const all = m.KBEMS_DEADLINES.flatMap((d) =>
    (d.prerequisites ?? []).map((p) => [d.id, m.prerequisite(p)]),
  )
  check(all.length > 10, `there are prerequisites to check — ${all.length}`)
  check(
    all.some(([, p]) => p.done),
    'and at least one is settled, so the settled-item assertions below are not vacuous',
  )
  const badDate = all.filter(
    ([, p]) => p.done !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(p.done),
  )
  check(
    badDate.length === 0,
    'every settled prerequisite carries an ISO date',
    badDate.map(([id, p]) => `${id}: ${p.done}`).join(', '),
  )
  // Nothing is settled in the future, and nothing before this work began.
  const outOfRange = all.filter(([, p]) => p.done && (p.done > new Date().toISOString().slice(0, 10) || p.done < '2026-01-01'))
  check(
    outOfRange.length === 0,
    'no prerequisite is settled on a date that has not happened',
    outOfRange.map(([id, p]) => `${id}: ${p.done}`).join(', '),
  )
  const prosaic = all.filter(([, p]) => /\b(done|complete|signed|confirmed)\b[^.]{0,20}\d{4}/i.test(p.what))
  check(
    prosaic.length === 0,
    'no prerequisite records being settled in its own sentence instead of in `done`',
    prosaic.map(([id, p]) => `${id}: "${p.what.slice(0, 70)}"`).join('\n        '),
  )
  // The application asserts lab-simulated IO satisfies the regulation. It may
  // only do that while the requirement actually allows the lab setting.
  const io = m.CLINICAL_REQUIREMENTS.find((r) => r.id === 'io')
  const ioAnswered = all.find(([, p]) => /intraosseous/i.test(p.what))?.[1]
  check(
    !ioAnswered?.done || (io && io.allowedSettings.includes('lab')),
    'the IO question is only closed while the requirement still allows the lab setting',
    io ? `io allows ${io.allowedSettings.join(', ')}` : 'no io requirement',
  )
  check(
    !ioAnswered?.done || !!ioAnswered.evidence,
    'a prerequisite closed on someone’s answer says what is retained as the record of it',
  )
}

// ----- every authored date, everywhere ----------------------------------------
//
// The narrow checks above each guard one field that went stale once. This
// sweeps every string the course record holds and asks the same question of
// all of them: does this spelled-out date exist in this cohort?
//
// It is here because the narrow checks kept being written one bug too late.
// The grading model — the table a student reads to know when they sit an exam
// — said "Gate exams — 3 (29 Oct, 1 Dec, 21 Jan)" and "Final comprehensive
// exam, 2 February". All four were wrong, and all four named a real class day,
// so nothing that compared against the calendar would have caught them.
{
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const known = new Set([
    ...m.KC_SCHEDULE.map((r) => spell(r.date)),
    ...A.COURSE_ASSESSMENTS.filter((a) => a.date).map((a) => spell(a.date)),
    ...A.COURSE_ASSESSMENTS.filter((a) => a.retestBy).map((a) => spell(a.retestBy)),
    ...m.KC_HOLIDAYS.map((h) => spell(h.date)),
    ...m.KBEMS_DEADLINES.flatMap((d) => {
      const x = m.deadlineDates(d)
      return [spell(x.due), spell(x.filedBy)]
    }),
    spell(m.KC_START_DATE),
    spell(m.KC_END_DATE),
    spell(m.WINTER_BREAK.start),
    spell(m.WINTER_BREAK.end),
  ])

  const strings = []
  const seenObj = new WeakSet()
  const walk = (v, path, depth) => {
    if (depth > 6) return
    if (typeof v === 'string') strings.push([path, v])
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1))
    else if (v && typeof v === 'object') {
      if (seenObj.has(v)) return
      seenObj.add(v)
      for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, depth + 1)
    }
  }
  for (const [ns, mod] of [['aemt', m], ['assessments', m.A], ['phases', m.PH]]) {
    for (const [k, v] of Object.entries(mod)) {
      if (typeof v === 'function') continue
      walk(v, `${ns}.${k}`, 0)
    }
  }

  // A date carrying its own year cites something outside this cohort — a
  // regulation's effective date, a certification retired in 2024 — and says
  // nothing about when this course runs. Only bare dates are calendar claims.
  // Both spellings the record uses: "2 February" and "29 Oct". The first
  // version of this sweep matched only full month names, and so passed the
  // grading model's "Gate exams — 3 (29 Oct, 1 Dec, 21 Jan)" — three wrong
  // dates — while catching the "2 February" beside it.
  const MONTH_ALT = MONTHS.flatMap((mo) => [mo, mo.slice(0, 3)]).join('|')
  const bare = new RegExp(`\\b(\\d{1,2}) (${MONTH_ALT})\\.?(?! \\d{4})\\b`, 'g')
  const stale = new Set()
  for (const [path, text] of strings) {
    for (const said of text.matchAll(bare)) {
      // Normalise "29 Oct" and "29 October" to the same key before comparing.
      const full = MONTHS.find((mo) => mo.startsWith(said[2]))
      const spelled = `${Number(said[1])} ${full}`
      if (!known.has(spelled)) stale.add(`${said[0]} — ${path.slice(0, 70)}`)
    }
  }
  // A sweep is worth exactly what it walked. If an import shape changes and
  // the modules come back empty, every assertion below is vacuously true and
  // the check goes on reporting a pass — the failure main's check-kit was
  // written about. Floor it well under the real figure, so it catches "almost
  // nothing" without breaking every time a note is added.
  check(
    strings.length > 400,
    `the sweep walked the course record, not an empty object — ${strings.length} strings`,
  )
  check(
    strings.some(([, t]) => bare.test(t)) || (bare.lastIndex = 0) === 0,
    'and at least one of them spells out a date, so the pattern still matches',
  )
  check(
    stale.size === 0,
    'no authored string names a date this cohort does not have',
    [...stale].join('\n        '),
  )

  // And a weekday written next to a date has to be that date's weekday.
  const withDay = /\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) (\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December)\b/g
  const wrongDay = new Set()
  const years = [...new Set([m.KC_START_DATE, m.KC_END_DATE].map((d) => Number(d.slice(0, 4))))]
  for (const [path, text] of strings) {
    for (const said of text.matchAll(withDay)) {
      const day = Number(said[2])
      const mon = MONTHS.indexOf(said[3]) + 1
      const ok = years.some((y) => DAYS[new Date(Date.UTC(y, mon - 1, day)).getUTCDay()] === said[1])
      if (!ok) wrongDay.add(`${said[0]} — ${path.slice(0, 70)}`)
    }
  }
  check(
    wrongDay.size === 0,
    'no authored string names a weekday that is not that date’s weekday',
    [...wrongDay].join('\n        '),
  )
}


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
