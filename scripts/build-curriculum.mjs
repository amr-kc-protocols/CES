// Build the curriculum map and lesson plans as a .docx.
//
// K.A.R. 109-17-3 requires a course to retain its curriculum and a lesson plan
// for every lesson. Two different documents are hiding in that sentence and
// this produces both, because they answer questions that are asked by different
// people at different times:
//
//   THE COVERAGE MAP is for a reviewer. K.A.R. 109-10-1c adopts the October
//   2014 Kansas AEMT Education Standards, and approval turns partly on whether
//   the schedule plausibly covers them. The map is every standard against the
//   dated session that teaches it — so the answer to "where do you cover
//   Multisystem Trauma" is a date, not a search.
//
//   THE LESSON PLANS are for whoever teaches the session, which on a joint
//   cohort is not always the person who wrote the schedule. Each one carries
//   what the students were told to do beforehand, the standards it covers, the
//   shape of the four hours, what is checked off, and what is graded.
//
// The lesson plans are DELIBERATELY NOT full lecture notes. The lecture is the
// Navigate module the student did before class; a plan that reproduced it would
// re-create the thing this course removed. What an instructor needs at 0855 is
// what the room is for, what the students have already met, and what has to
// come out of the session — and that is what fits on a page.
//
// Run: npm run doc:curriculum  [-- <output path>]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Document, Packer } from 'docx'
import {
  BULLET, H1, H2, H3, P, PAGE, NUMBERING, ROOT, SPACER, TASK,
  coverBlock, dayDate, footer, loadCourse, longDate, printable, provenance, table,
} from './lib/doc-kit.mjs'

const outPath = resolve(process.argv[2] ?? join(ROOT, 'build', 'AEMT-Curriculum-and-Lesson-Plans-Oct2026.docx'))
const m = await loadCourse()
const { A, N, P: PH, STD } = m

const byDate = (a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1)
const sessions = m.KC_SCHEDULE.filter((r) => r.delivery === 'f2f' || r.delivery === 'aha').sort(byDate)
const preClassFor = (week) =>
  m.KC_SCHEDULE.find((r) => r.week === week && r.delivery === 'assignment' && !r.standalone)

/** Every session that names a standard, so the map can point at real dates. */
function sessionsFor(code) {
  return m.KC_SCHEDULE.filter((r) => (r.sections ?? []).includes(code)).sort(byDate)
}

// ----- the coverage map ------------------------------------------------------

const mapRows = []
for (const [group, name] of Object.entries(STD.STANDARD_GROUPS)) {
  const inGroup = STD.standardsIn(group)
  if (!inGroup.length) continue
  mapRows.push([{ heading: `${group} — ${name}`, span: true }])
  for (const s of inGroup) {
    const rows = sessionsFor(s.code)
    // A standard is assigned on the pre-class row; the week's classroom
    // sessions are where it is actually delivered, so both are named.
    const weeks = [...new Set(rows.map((r) => r.week))]
    const classDays = weeks.flatMap((w) =>
      m.KC_SCHEDULE.filter((r) => r.week === w && r.delivery === 'f2f').sort(byDate),
    )
    mapRows.push([
      s.code,
      s.label,
      weeks.map((w) => (w === 0 ? 'Pre-course' : `Week ${w}`)).join(', '),
      classDays.length ? classDays.map((c) => dayDate(c.date)).join(', ') : 'Pre-course, before 6 Oct',
    ])
  }
}

const mapTable = () => {
  const cols = [1000, 4200, 1600, 3280]
  const rows = []
  for (const r of mapRows) {
    if (r[0]?.heading) {
      rows.push({ heading: r[0].heading })
    } else {
      rows.push(r)
    }
  }
  return rows.map((r) => (r.heading ? [`${r.heading}`, '', '', ''] : r))
}

// ----- lesson plans ----------------------------------------------------------

function lessonPlan(r) {
  const pre = preClassFor(r.week)
  const chapters = pre?.chapters ?? []
  const drills = N.skillDrills(chapters)
  const events = (r.assessmentIds ?? []).map((id) => A.assessment(id)).filter(Boolean)
  const sheets = (r.sheetIds ?? []).map((id) =>
    id === '@monitor' ? 'The operation’s own cardiac monitor sheet' : (m.K.skillSheet(id)?.title ?? id),
  )
  const out = []

  out.push(H2(`${r.label} — ${dayDate(r.date)}, ${r.startTime}–${r.endTime}`))
  out.push(P(r.title))

  if (r.delivery === 'aha') {
    out.push(
      P(
        'Delivered to the American Heart Association provider curriculum by an AHA-certified instructor. Not lesson-planned here; the AHA course materials govern.',
        { italics: true },
      ),
    )
    if (r.note) out.push(P(printable(r.note), { italics: true }))
    return out
  }

  out.push(H3('Standards covered'))
  const codes = pre?.sections ?? []
  if (codes.length) {
    for (const c of codes) out.push(BULLET(STD.standardLabel(c)))
  } else {
    out.push(P('Consolidation, assessment or remediation — no new standard is introduced.', { italics: true }))
  }

  out.push(H3('What the students were told to do first'))
  if (chapters.length) {
    const mins = chapters.reduce((n, c) => n + (N.chapterAssets(c)?.moduleMinutes ?? 0), 0)
    out.push(
      P(
        `Chapters ${chapters.join(', ')} — read, module, flashcards and practice activity. ${mins} minutes of module time. ASSUME THEY HAVE MET THIS MATERIAL; do not re-deliver it.`,
      ),
    )
    if (drills.length) {
      out.push(P(`Skill Drills read in advance: ${drills.map((d) => `${d.n} (p. ${d.page})`).join(', ')}.`))
    }
  } else {
    out.push(P('Nothing new — this session draws on earlier weeks.', { italics: true }))
  }

  out.push(H3('Shape of the session'))
  if (events.some((e) => e.kind === 'gate' || e.kind === 'final' || e.kind === 'simulation')) {
    const timed = events.find((e) => e.minutes)
    out.push(
      P(
        `Non-standard: this session carries ${events.map((e) => e.label).join(' and ')}${
          timed ? `, ${timed.minutes} minutes under examination conditions` : ''
        }. Run the examination as scheduled and use the remaining time as the title describes.`,
      ),
    )
  } else {
    for (const b of A.SESSION_TEMPLATE) {
      out.push(BULLET(`${b.start}–${b.end}  ${b.label}${b.what ? ` — ${b.what}` : ''}`))
    }
  }

  if (sheets.length) {
    out.push(H3('Checked off this session'))
    for (const s of sheets) out.push(TASK(s))
    out.push(
      P(
        'Every student is signed off individually, on the sheet, with the evaluator named. A sheet marked complete for the group is not a record.',
        { italics: true },
      ),
    )
  }
  if ((r.taughtNotChecked ?? []).length) {
    out.push(H3('Taught but not checked off'))
    for (const t of r.taughtNotChecked) out.push(BULLET(printable(t)))
  }

  if (events.length) {
    out.push(H3('Graded'))
    for (const e of events) {
      const bits = [
        e.items ? `${e.items} items` : null,
        e.minutes ? `${e.minutes} min` : null,
        e.proctored ? 'proctored, closed book' : null,
        e.mps ? `MPS ${e.mps}%` : null,
        e.retestBy ? `retest window closes ${longDate(e.retestBy)}` : null,
      ].filter(Boolean)
      out.push(BULLET(`${e.label} — ${e.covers}${bits.length ? ` (${bits.join('; ')})` : ''}`))
    }
  }

  if (r.note) out.push(P(printable(r.note), { italics: true, before: 100 }))
  return out
}

// ----- the document ----------------------------------------------------------

const doc = new Document({
  creator: 'AMR Kansas City — Clinical Education',
  title: 'AEMT Curriculum and Lesson Plans — October 2026 Cohort',
  description: 'Kansas AEMT Education Standards coverage map and per-session lesson plans',
  numbering: NUMBERING,
  sections: [
    {
      properties: { page: PAGE },
      footers: { default: footer('AEMT Curriculum and Lesson Plans — October 2026 cohort') },
      children: [
        ...coverBlock(
          'Curriculum and Lesson Plans',
          'Advanced Emergency Medical Technician',
          `AMR Kansas City with AMR Wichita  ·  ${longDate(m.KC_START_DATE)} to ${longDate(m.KC_END_DATE)}`,
        ),

        H1('The curriculum this course teaches'),
        P(
          `K.A.R. 109-10-1c adopts the Kansas AEMT Education Standards of October 2014. This course covers all ${STD.STANDARDS.length} standards those describe, mapped below to the dated session that delivers each. Content is sequenced against the National Registry AEMT examination specifications effective 1 July 2024, which is a different document with a different purpose: the standards say what must be taught, the specifications say what will be tested and in what proportion.`,
        ),
        P(
          `The adopted text is ${m.COURSE_TEXT.title}, ${m.COURSE_TEXT.edition} edition (${m.COURSE_TEXT.copyright}), and every one of its ${N.CHAPTER_ASSETS.length} chapters is assigned to a week.`,
        ),

        H1('Standards coverage map'),
        P(
          'A standard is assigned on its week’s pre-class row and delivered in that week’s classroom sessions, so both are named. Where a week holds a laboratory, the standard is also practised there.',
          { italics: true },
        ),
        SPACER(120),
        table(
          [1000, 4200, 1600, 3280],
          ['Code', 'Standard', 'Week', 'Delivered'],
          mapTable(),
        ),

        H1('The standard session'),
        P(
          `Every Tuesday and Thursday runs to the same shape unless it is an AHA provider course, a gate examination or a full-length simulation. The 0930–1100 block is explicitly NOT lecture — the lecture was the Navigate module the student completed beforehand, and re-delivering it in the room is how a flipped course collapses back into an ordinary one.`,
        ),
        SPACER(120),
        table(
          [1500, 2200, 6380],
          ['Time', 'Block', 'What happens and why'],
          A.SESSION_TEMPLATE.map((b) => [`${b.start}–${b.end}`, b.label, b.what || '—']),
        ),
        SPACER(),
        P(
          `Every laboratory debrief runs the six-step clinical judgment cycle with the student naming each step aloud: ${A.CLINICAL_JUDGMENT_CYCLE.join(' → ')}. The scenario rubric is ${
            m.GRADING_MODEL.find((c) => c.id === 'scenario').weight
          }% of the course grade and scores against those steps, so the wording is the same in the debrief, on the rubric and in the tracker.`,
        ),

        H1('Lesson plans'),
        P(
          `One per scheduled session, in date order. These are not lecture notes and are not meant to be: what an instructor needs before a session is what the room is for, what the students have already met, what gets checked off and what is graded.`,
          { italics: true },
        ),
        ...sessions.flatMap((r) => lessonPlan(r)),

        provenance(m, 'npm run doc:curriculum'),
      ],
    },
  ],
})

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, await Packer.toBuffer(doc))
console.log(`Wrote ${outPath}`)
console.log(
  `  ${STD.STANDARDS.length} standards mapped · ${sessions.length} lesson plans · ` +
    `${sessions.filter((r) => (r.sheetIds ?? []).length).length} with check-offs`,
)
