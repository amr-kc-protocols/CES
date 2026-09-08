// Build the student course calendar and Navigate access sheet.
//
// This is the one document in the set that goes to students rather than to
// KBEMS, and it is generated for the same reason the filed ones are: the
// calendar moved three times before it was agreed, and every hand-typed copy
// of it was wrong within a week. Every date, weekday, time and reading below
// is read out of KC_SCHEDULE. Nothing here restates a date.
//
// The Navigate half is transcribed from the Jones & Bartlett access-code card
// bound into the fourth-edition text — the wording students actually have in
// front of them — plus this cohort's Course ID.
//
// Run: npm run doc:calendar  [-- <output path>]
//
// Writes HTML always. Renders a PDF too when Playwright's Chromium is
// available, which is how the printable copy is produced. The HTML is the
// source of truth for both, so a rendering environment without a browser
// still produces something a student can read.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { loadCourse, ROOT } from './lib/doc-kit.mjs'

// The Course ID that connects a student's Navigate account to this cohort's
// shell. Issued by Jones & Bartlett per course, not per student.
export const NAVIGATE_COURSE_ID = 'C957BC'

// Public Safety Group is Jones & Bartlett's EMS imprint, and psglearning.com
// is the address printed on the access-code card. Students who go to
// jblearning.com instead end up on the trade site with no Redeem link, which
// is the single most common way this goes wrong.
export const NAVIGATE_SITE = 'www.psglearning.com'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const d0 = (iso) => new Date(`${iso}T00:00:00Z`)
const weekday = (iso) => WEEKDAYS[d0(iso).getUTCDay()]
const dayMon = (iso) => { const d = d0(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}` }
const longDate = (iso) => { const d = d0(iso); return `${weekday(iso)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` }

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 08:00 -> 8:00 am. Students read a clock, not a filing. */
const clock = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  const ap = h < 12 ? 'am' : 'pm'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`
}

const chapterList = (ch = []) => {
  if (!ch.length) return ''
  const sorted = [...ch].sort((a, b) => a - b)
  const runs = []
  for (const c of sorted) {
    const last = runs[runs.length - 1]
    if (last && c === last[1] + 1) last[1] = c
    else runs.push([c, c])
  }
  return runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ')
}

/**
 * The topics inside an assignment row's title, without the module scaffolding.
 *
 * Source reads "Navigate Modules 8-9 (Ch 8-9): Pathophysiology (PR10); Life
 * Span Development (PR11)" — module numbers, chapter numbers and Kansas
 * standards codes, all of which the student already has in the chapter list
 * beside it. What they want is the subject. Sentences that cross-reference
 * another week are course bookkeeping and come out too.
 */
export const topicsOf = (t) =>
  t
    .replace(/^Navigate\s+/i, '')
    .replace(/\bModules?\s+[\d,\s&and\u2013-]+\s*(?:\(Ch[^)]*\))?\s*:?\s*/gi, '')
    .replace(/\s*\((?:PR|MT|ST|OP|SP|AM|PA)\d+[^)]*\)/g, '')
    .split(/(?<=\.)\s+/)
    .filter((sentence) => !/\bin week \d/i.test(sentence))
    .join(' ')
    .replace(/\s*;\s*/g, '; ')
    .replace(/^[\s:;.]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

export async function buildCalendarHtml() {
  const m = await loadCourse()
  const A = m.A
  // The field is `label`. Reading `.title` silently fell back to the raw id
  // and printed "gate-1" on a student handout.
  const label = (id) => {
    const a = A.assessment?.(id)
    if (!a) throw new Error(`no assessment "${id}" — the calendar cannot label it`)
    return a.label
  }
  const kindOf = (id) => A.assessment?.(id)?.kind ?? ''

  const rows = [...m.KC_SCHEDULE].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const classDays = rows.filter((r) => r.delivery === 'f2f')
  const holidayByDate = new Map(m.KC_HOLIDAYS.map((h) => [h.date, h]))

  // Weeks in teaching order. A week's assignment row is its pre-class work; a
  // session displaced out of its own teaching week (the respiratory lab, moved
  // by Thanksgiving) says which week's reading it drills.
  const weeks = new Map()
  for (const r of rows) {
    if (r.week === 0) continue
    if (!weeks.has(r.week)) weeks.set(r.week, { week: r.week, pre: [], sessions: [], info: [] })
    const w = weeks.get(r.week)
    if (r.informational) w.info.push(r)
    else if (r.delivery === 'assignment') w.pre.push(r)
    else w.sessions.push(r)
  }
  /** Monday of the ISO week a date falls in — how a holiday finds its week. */
  const mondayOf = (iso) => {
    const d = d0(iso)
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    return d.toISOString().slice(0, 10)
  }
  const firstDate = (w) =>
    [...w.sessions, ...w.pre, ...w.info].map((r) => r.date).sort()[0] ?? '9999-99-99'
  const holidaysForWeek = (w) => {
    const mondays = new Set([...w.sessions, ...w.pre].map((r) => mondayOf(r.date)))
    return m.KC_HOLIDAYS.filter((h) => mondays.has(mondayOf(h.date)))
  }

  const ordered = [...weeks.values()].sort(
    (a, b) => (firstDate(a) < firstDate(b) ? -1 : 1),
  )

  const gates = classDays.filter((r) => (r.assessmentIds ?? []).some((id) => kindOf(id) === 'gate'))
  const finalDay = classDays.find((r) => (r.assessmentIds ?? []).some((id) => kindOf(id) === 'final'))
  const first = classDays[0]
  const last = classDays[classDays.length - 1]
  const preCourse = m.PRE_COURSE

  const badge = (r) =>
    (r.assessmentIds ?? [])
      .map((id) => {
        const k = kindOf(id)
        const cls = k === 'gate' ? 'gate' : k === 'final' ? 'final' : 'quiz'
        return `<span class="badge ${cls}">${esc(label(id))}</span>`
      })
      .join('')

  const sessionRow = (r, w) => {
    const offPattern = !['Monday', 'Thursday'].includes(weekday(r.date))
    // The row already carries WHY it moved. A student seeing a Tuesday on a
    // Monday/Thursday course needs that sentence, not a footnote elsewhere.
    const why = offPattern && r.note ? `<div class="drills">${esc(r.note.split(/(?<=\.)\s+/).slice(0, 2).join(' '))}</div>` : ''
    const drills =
      r.preClassWeek && r.preClassWeek !== r.week
        ? `<div class="drills">Drills week ${r.preClassWeek}'s material.</div>`
        : ''
    return `
      <tr>
        <td class="date"><span class="dm">${esc(dayMon(r.date))}</span><span class="wd">${esc(weekday(r.date))}</span></td>
        <td class="time">${r.startTime ? esc(`${clock(r.startTime)} – ${clock(r.endTime)}`) : ''}</td>
        <td class="what">
          <div class="short">${esc(r.short)}</div>
          ${badge(r)}
          ${drills}
          ${why}
        </td>
      </tr>`
  }

  const weekBlock = (w) => {
    const pre = w.pre
      .map((p) => {
        const ch = chapterList(p.chapters)
        return `<div class="pre"><span class="pill">Before class</span> ${
          ch ? `Navigate, chapter${ch.includes(',') || ch.includes('\u2013') ? 's' : ''} ${esc(ch)}` : 'Navigate'
        }<span class="pretext">${esc(topicsOf(p.title))}</span></div>`
      })
      .join('')
    const hols = holidaysForWeek(w)
      .map((h) => `<div class="pre nocls"><span class="pill off">No class</span> ${esc(
        longDate(h.date),
      )} — ${esc(h.name)}</div>`)
      .join('')
    const info = w.info
      .filter((r) => r.date > m.WINTER_BREAK.end || r.date < m.WINTER_BREAK.start)
      .map((r) => `<div class="pre"><span class="pill">${esc(dayMon(r.date))}</span> ${esc(r.short)}</div>`)
      .join('')
    return `
      <section class="week">
        <h3>Week ${w.week}</h3>
        ${pre}
        ${hols}
        ${info}
        <table class="days">
          <tbody>${w.sessions.map((r) => sessionRow(r, w)).join('')}</tbody>
        </table>
      </section>`
  }

  const breakWork = rows.filter(
    (r) => r.informational && r.date >= m.WINTER_BREAK.start && r.date <= m.WINTER_BREAK.end,
  )
  const breakRow = `
    <section class="week break">
      <h3>Winter break</h3>
      <div class="pre"><span class="pill">${esc(dayMon(m.WINTER_BREAK.start))} – ${esc(
        dayMon(m.WINTER_BREAK.end),
      )}</span> No classroom sessions. ${esc(m.WINTER_BREAK.note)}</div>
      ${breakWork.map((r) => `<div>${badge(r)}</div>`).join('')}
    </section>`

  // Christmas and New Year sit inside the winter break. Listing them here as
  // well pads the list to seven entries and buries the one that actually moves
  // a class — the January holiday. The break goes in as one entry, in date
  // order with the rest, so the list reads down the calendar.
  const noClass = [
    ...m.KC_HOLIDAYS.filter(
      (h) =>
        h.date >= m.KC_START_DATE &&
        h.date <= m.KC_END_DATE &&
        !(h.date >= m.WINTER_BREAK.start && h.date <= m.WINTER_BREAK.end),
    ).map((h) => ({ date: h.date, html: `<strong>${esc(longDate(h.date))}</strong> — ${esc(h.name)}` })),
    {
      date: m.WINTER_BREAK.start,
      html: `<strong>${esc(longDate(m.WINTER_BREAK.start))}</strong> to <strong>${esc(
        longDate(m.WINTER_BREAK.end),
      )}</strong> — winter break`,
    },
  ].sort((a, b) => (a.date < b.date ? -1 : 1))
  const holidayList = noClass.map((h) => `<li>${h.html}</li>`).join('')

  const title = 'Advanced EMT — Course Calendar & Navigate Access'

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: letter; margin: 0.6in 0.55in 0.7in; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.38 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #16202b; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 2px; letter-spacing: -0.01em; }
  h2.newpage { break-before: page; margin-top: 0; }
  h2 { font-size: 12.5pt; margin: 16px 0 7px; padding-bottom: 4px; border-bottom: 2px solid #0f2f52; color: #0f2f52; }
  h3 { font-size: 10pt; margin: 0 0 4px; color: #0f2f52; text-transform: uppercase; letter-spacing: 0.06em; }
  .sub { color: #55636f; font-size: 10pt; margin: 0 0 14px; }
  .facts { display: flex; gap: 0; border: 1px solid #ccd4dc; border-radius: 5px; overflow: hidden; margin-bottom: 18px; }
  .facts div { flex: 1; padding: 8px 10px; border-right: 1px solid #e3e8ed; }
  .facts div:last-child { border-right: 0; }
  .facts .k { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7885; }
  .facts .v { font-weight: 600; font-size: 10pt; }
  .callout { border: 1px solid #0f2f52; border-left-width: 5px; border-radius: 4px; padding: 11px 14px; margin: 0 0 16px; background: #f6f9fc; }
  .callout p { margin: 0 0 6px; }
  .callout p:last-child { margin-bottom: 0; }
  .courseid { display: inline-block; font-family: "SFMono-Regular", Consolas, monospace; font-size: 17pt; font-weight: 700;
              letter-spacing: 0.12em; background: #0f2f52; color: #fff; padding: 5px 14px; border-radius: 4px; }
  ol.steps { margin: 6px 0 0; padding-left: 18px; }
  ol.steps > li { margin-bottom: 7px; }
  .note { font-size: 9pt; color: #55636f; font-style: italic; }
  section.week { break-inside: avoid; margin-bottom: 7px; padding-bottom: 5px; border-bottom: 1px solid #eef1f4; }
  section.week.break { background: #f6f9fc; border: 1px dashed #b9c4cf; border-radius: 4px; padding: 9px 11px; }
  .pre { font-size: 9.2pt; color: #3d4a56; margin-bottom: 5px; }
  .pill.off { background: #f3e2d5; color: #8a3d10; }
  .nocls { color: #8a3d10; }
  .pill { display: inline-block; background: #e8eef4; color: #0f2f52; font-size: 7.5pt; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em; padding: 1.5px 6px; border-radius: 3px; margin-right: 5px; }
  .pretext { display: block; color: #55636f; }
  table.days { width: 100%; border-collapse: collapse; }
  table.days td { padding: 3px 6px; vertical-align: top; border-top: 1px solid #eef1f4; }
  td.date { width: 108px; white-space: nowrap; }
  td.date .dm { font-weight: 700; }
  td.date .wd { display: block; font-size: 8.5pt; color: #6b7885; }
  td.time { width: 118px; white-space: nowrap; color: #3d4a56; font-size: 9.5pt; }
  .short { font-weight: 600; }
  .drills { font-size: 8.5pt; color: #6b7885; }
  .badge { display: inline-block; font-size: 7.5pt; font-weight: 700; padding: 1.5px 6px; border-radius: 3px; margin: 3px 4px 0 0; }
  .badge.quiz { background: #eef1f4; color: #3d4a56; }
  .badge.gate { background: #b4531b; color: #fff; }
  .badge.final { background: #0f2f52; color: #fff; }
  ul.keys { margin: 0; padding-left: 18px; }
  ul.keys li { margin-bottom: 3px; }
  .two { display: flex; gap: 22px; }
  .two > div { flex: 1; }
  .closing { break-inside: avoid; }
  .foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid #ccd4dc; font-size: 8.5pt; color: #6b7885; }
  .tbd { background: #fff2cc; padding: 0 2px; border-radius: 2px; }
</style></head><body>

<h1>Advanced EMT — October 2026 Cohort</h1>
<p class="sub">AMR Kansas City &amp; AMR Wichita · Course calendar and Navigate access</p>

<div class="facts">
  <div><div class="k">Class days</div><div class="v">Mondays &amp; Thursdays<br>${esc(
    `${clock(first.startTime)} – ${clock(first.endTime)}`,
  )}</div></div>
  <div><div class="k">First class</div><div class="v">${esc(longDate(first.date))}</div></div>
  <div><div class="k">Last class</div><div class="v">${esc(longDate(last.date))}</div></div>
  <div><div class="k">Classroom sessions</div><div class="v">${classDays.length}</div></div>
</div>

<h2>Start here — getting into Navigate</h2>

<div class="callout">
  <p><strong>Your Course ID</strong> — this is what puts you in our course rather than an empty shelf of books. You will be asked for it during setup.</p>
  <p><span class="courseid">${esc(NAVIGATE_COURSE_ID)}</span></p>
</div>

<p>You need two things: a valid email address and the <strong>10-digit access code</strong> printed under the
scratch-off panel on the card inside your textbook. The access code works <strong>once</strong>, on one account, so
do not scratch a card you are not going to use.</p>

<ol class="steps">
  <li>Go to <strong>${esc(NAVIGATE_SITE)}</strong>. (Not jblearning.com — that is the parent site and has no Redeem link.)</li>
  <li>Click <strong>Redeem an Access Code</strong>.</li>
  <li>Read and accept the terms, enter your 10-digit access code, click <strong>Redeem</strong>, and confirm.</li>
  <li>Follow the prompts to create your Jones &amp; Bartlett account. You will set an <strong>email address and password</strong> — this is what you log in with from now on, so use an address you will still have in February.</li>
  <li>Validate your email address when prompted.</li>
  <li>When you are asked for a <strong>Course ID</strong>, enter <strong>${esc(NAVIGATE_COURSE_ID)}</strong>.</li>
  <li>Your product appears on the <strong>Products</strong> tab. Click the Navigate product name to open it.</li>
</ol>

<p class="note">Coming back later: go to ${esc(NAVIGATE_SITE)} and click <em>My Account</em>. Technical problems with
the site, a code that will not redeem, or a lost password: ${esc(NAVIGATE_SITE)}/techsupport. Tell your instructor too,
so a Navigate problem does not become a missed deadline.</p>

<div class="callout">
  <p><strong>Due before the first class — ${esc(longDate(first.date))}</strong></p>
  <p>Chapters ${esc(chapterList(preCourse.chapters))}, with the Navigate modules, flashcards, practice activities
  and chapter quizzes. Roughly ${preCourse.didacticHours} hours of work. This is a requirement, not a suggestion:
  week 1 opens on medical terminology and the quizzes are cumulative from day one.</p>
</div>

<h2 class="newpage">Course calendar</h2>
<p class="sub">All classroom sessions run ${esc(clock(first.startTime))} to ${esc(clock(first.endTime))}. Read the
week's Navigate work <em>before</em> the Monday session — class time is spent applying it, not covering it.</p>

${(() => {
  const resumes = ordered.find((w) => firstDate(w) > m.WINTER_BREAK.end)
  return ordered.map((w) => (w === resumes ? breakRow + weekBlock(w) : weekBlock(w))).join('')
})()}

<div class="closing">
<h2>Dates worth putting in your phone</h2>
<div class="two">
  <div>
    <h3>Gate exams and the final</h3>
    <ul class="keys">
      ${gates
        .map(
          (g) =>
            `<li><strong>${esc(longDate(g.date))}</strong> — ${esc(
              label((g.assessmentIds ?? []).find((id) => kindOf(id) === 'gate')),
            )}</li>`,
        )
        .join('')}
      ${finalDay ? `<li><strong>${esc(longDate(finalDay.date))}</strong> — final comprehensive exam, full-length 135-item mock</li>` : ''}
    </ul>
    <p class="note">Gates are proctored and must be passed to continue. A cumulative retrieval quiz opens most
    Monday sessions.</p>
  </div>
  <div>
    <h3>No class on</h3>
    <ul class="keys">${holidayList}</ul>
    <p class="note">Week 13 moves to <strong>Tuesday ${esc(dayMon('2027-01-19'))}</strong> rather than being
    surrendered to the holiday — it carries the trauma material that week's laboratory is built on.</p>
  </div>
</div>

<h2>Questions</h2>
<p><strong>Kansas City — ${esc(m.PRIMARY_INSTRUCTOR.name)}, ${esc(m.PRIMARY_INSTRUCTOR.credential)}</strong>,
${esc(m.PRIMARY_INSTRUCTOR.email)}. ${esc(m.PRIMARY_INSTRUCTOR.officeHours)}</p>
<p><strong>Wichita — Cassandra Powell, Paramedic</strong>, <span class="tbd">[contact to be added]</span>.</p>

</div>

<div class="foot">
  Text: ${esc(m.COURSE_TEXT.title)}, ${esc(m.COURSE_TEXT.edition)} edition (${esc(m.COURSE_TEXT.publisher)}),
  ISBN ${esc(m.COURSE_TEXT.isbn)}. Calendar generated from the filed course schedule — if a date here disagrees
  with something you were told, this document is the one that was checked.
</div>

</body></html>`
}

// ----- write ----------------------------------------------------------------
// Only when run as a script. check-student-calendar.mjs imports buildCalendarHtml
// to read the document without writing one.
const invokedDirectly =
  process.argv[1] && process.argv[1].endsWith('build-student-calendar.mjs')

if (invokedDirectly) {
  const outArg = process.argv[2]
  const base = resolve(outArg ?? join(ROOT, 'build', 'AEMT-Student-Calendar-Oct2026.pdf'))
  const htmlPath = base.replace(/\.pdf$/i, '.html')
  const html = await buildCalendarHtml()

  mkdirSync(dirname(base), { recursive: true })
  writeFileSync(htmlPath, html)
  console.log(`Wrote ${htmlPath}`)

  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    console.log('Playwright not installed — HTML written, PDF skipped.')
    console.log('  To render the PDF: npm i -D playwright && npx playwright install chromium')
  }
  if (chromium) {
    // CES_CHROMIUM lets an environment that already has a browser point at it
    // rather than downloading a second copy — the sandboxes this runs in ship
    // Chromium at a pinned path that rarely matches Playwright's expected build.
    const executablePath = process.env.CES_CHROMIUM || undefined
    const browser = await chromium.launch(executablePath ? { executablePath } : {})
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    await page.pdf({
      path: base,
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.6in', bottom: '0.7in', left: '0.55in', right: '0.55in' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="width:100%;font:8pt Helvetica,Arial,sans-serif;color:#6b7885;padding:0 0.55in;' +
        'display:flex;justify-content:space-between;">' +
        '<span>AEMT — October 2026 cohort · course calendar</span>' +
        '<span class="pageNumber"></span></div>',
    })
    await browser.close()
    console.log(`Wrote ${base}`)
  }
}
