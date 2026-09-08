// The student calendar says what the schedule says.
//
// This is the only document in the set that a student plans their life around,
// and the only one where being wrong is invisible until somebody drives to a
// classroom on the wrong morning. Every date on it is generated, so the risk is
// not a typo — it is the generator quietly dropping a session, mislabelling a
// weekday, or printing an internal id where a title belongs. All three have
// happened in this repo's documents before.
//
// Run: node scripts/check-student-calendar.mjs  (or `npm run check:calendar`)
import { loadCourse } from './lib/doc-kit.mjs'
import { buildCalendarHtml, NAVIGATE_COURSE_ID, NAVIGATE_SITE, topicsOf } from './build-student-calendar.mjs'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const d0 = (iso) => new Date(`${iso}T00:00:00Z`)

let failures = 0
const fail = (msg, detail) => {
  failures++
  console.log(`FAIL  ${msg}`)
  if (detail) console.log(`      ${detail}`)
}
const pass = (msg) => console.log(`ok    ${msg}`)

const m = await loadCourse()
const html = await buildCalendarHtml()
const text = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

// ----- every class day is on it ---------------------------------------------
const classDays = m.KC_SCHEDULE.filter((r) => r.delivery === 'f2f')
const missing = classDays.filter((r) => {
  const d = d0(r.date)
  return !text.includes(`${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`)
})
if (missing.length)
  fail(
    `${missing.length} classroom session(s) are not on the calendar`,
    missing.map((r) => `${r.date} ${r.short}`).join('; '),
  )
else pass(`all ${classDays.length} classroom sessions appear on the calendar`)

// ----- the weekday beside each date is that date's weekday -------------------
// "Sunday, August 17" when the 17th was a Monday is the bug this exists for.
// It reached candidates once already, in the exam instructions.
let checked = 0
let weekdayBad = 0
for (const r of classDays) {
  const d = d0(r.date)
  const stamp = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`
  const want = WEEKDAYS[d.getUTCDay()]
  const near = new RegExp(`${stamp}\\s+(\\w+day)`).exec(text)
  if (!near) continue
  checked++
  if (near[1] !== want) {
    weekdayBad++
    fail(`${r.date} is a ${want} but the calendar prints ${near[1]}`)
  }
}
if (checked < classDays.length)
  fail(
    `only ${checked} of ${classDays.length} sessions had a weekday to check`,
    'a weekday that is not printed cannot be verified — this check would pass an empty document',
  )
else if (checked && !weekdayBad) pass(`every printed weekday matches its date (${checked} checked)`)

// ----- assessments are named, not identified --------------------------------
// The generator read `.title` on a record whose field is `.label`, fell back to
// the id, and printed "gate-1" and "quiz-a" on a handout.
const ids = [...new Set(m.KC_SCHEDULE.flatMap((r) => r.assessmentIds ?? []))]
// Only ids that could not be ordinary prose. "final" and "bridge" are English
// words that appear in the labels themselves, so a bare word-boundary match on
// them reports a defect that is not there. Every id that has ever leaked —
// gate-1, quiz-a, testprep-1, sim-1 — carries a hyphen or a digit.
const rawIds = ids.filter((id) => /[-\d]/.test(id) && new RegExp(`\\b${id}\\b`).test(text))
if (rawIds.length)
  fail(
    'internal assessment ids are printed on a student document',
    `${rawIds.join(', ')} — the calendar should print each assessment's label`,
  )
else pass(`all ${ids.length} assessment ids resolve to a label`)

const unlabelled = ids.filter((id) => {
  const label = m.A.assessment?.(id)?.label
  return !label || !text.includes(label)
})
if (unlabelled.length)
  fail('assessments on the schedule whose label never reaches the calendar', unlabelled.join(', '))
else pass('every scheduled assessment is named on the calendar')

// ----- the Navigate half is complete ----------------------------------------
const navBefore = failures
for (const [what, needle] of [
  ['the Course ID', NAVIGATE_COURSE_ID],
  ['the redemption site', NAVIGATE_SITE],
  ['the Redeem step', 'Redeem an Access Code'],
  ['the account setup step', 'email address and password'],
  ['the Products tab', 'Products'],
  ['tech support', `${NAVIGATE_SITE}/techsupport`],
])
  if (!text.includes(needle)) fail(`${what} is missing from the Navigate instructions`, needle)
if (failures === navBefore)
  pass(`the Navigate instructions carry course ID ${NAVIGATE_COURSE_ID}, the site and every step`)

// A student sent to jblearning.com finds no Redeem link — Public Safety Group
// is the imprint that hosts Navigate. The first version of this check looked
// for the sentence warning students off jblearning.com, which stayed in the
// document when the site constant itself was changed to jblearning.com: it
// passed a calendar that sent every student to the wrong place. Check the
// destination, not the disclaimer.
if (!/(^|\.)psglearning\.com$/.test(NAVIGATE_SITE))
  fail(
    `students are sent to ${NAVIGATE_SITE}, which is not the Navigate redemption site`,
    'Navigate is redeemed at psglearning.com; jblearning.com has no Redeem link',
  )
else if (!text.includes(`Go to ${NAVIGATE_SITE}`))
  fail('the first step does not name the site to go to', `expected "Go to ${NAVIGATE_SITE}"`)
else pass(`step one sends students to ${NAVIGATE_SITE}`)

// ----- pre-class work is the schedule's, not a retyped list ------------------
const preRows = m.KC_SCHEDULE.filter(
  (r) => r.delivery === 'assignment' && !r.informational && r.week > 0,
)
const lostTopics = preRows.filter((r) => {
  const first = topicsOf(r.title).split(/[;.]/)[0].trim()
  return first && !text.includes(first)
})
if (lostTopics.length)
  fail(
    `${lostTopics.length} week(s) of pre-class work did not reach the calendar`,
    lostTopics.map((r) => `week ${r.week}`).join(', '),
  )
else pass(`all ${preRows.length} weeks of pre-class reading are on the calendar`)

// ----- the pre-course gate is stated ----------------------------------------
const firstClass = classDays[0]
const fd = d0(firstClass.date)
if (!text.includes(`${WEEKDAYS[fd.getUTCDay()]} ${fd.getUTCDate()} ${MONTHS[fd.getUTCMonth()]}`))
  fail('the first class date is not written out in full anywhere on the document')
else pass('the pre-course deadline names the first class date in full')

// ----- placeholders are visible, not shipped by accident ---------------------
const placeholders = text.match(/\[[^\]]{3,60}\]/g) ?? []
if (placeholders.length)
  console.log(
    `note  ${placeholders.length} placeholder(s) still on the student calendar: ${placeholders.join(
      '; ',
    )}`,
  )

console.log(failures ? `\n${failures} check(s) failed` : '\nStudent calendar: all checks passed')
process.exit(failures ? 1 : 0)
