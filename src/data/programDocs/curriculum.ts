// ---------------------------------------------------------------------------
// The curriculum map and the lesson plans.
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
// ---------------------------------------------------------------------------

import {
  bullet, cover, dayDate, h1, h2, h3, longDate, p, printable, spacer, table, task,
  type Block, type DocCell,
} from '../../lib/docBlocks'
import * as A from '../aemtAssessments'
import * as N from '../navigateAssets'
import * as K from '../aemtSkills'
import * as STD from '../aemtStandards'
import {
  COURSE_TEXT,
  GRADING_MODEL,
  KC_COURSE_WEEKS,
  KC_END_DATE,
  KC_SCHEDULE,
  KC_START_DATE,
} from '../aemt'
import type { ScheduleRow } from '../aemt'

export const CURRICULUM_TITLE = 'AEMT Curriculum and Lesson Plans — October 2026 Cohort'

export function curriculumBlocks(): Block[] {
  const byDate = (a: ScheduleRow, b: ScheduleRow) =>
    a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1
  const sessions = KC_SCHEDULE.filter((r) => r.delivery === 'f2f' || r.delivery === 'aha').sort(byDate)
  // The scenario rubric's weight is asserted in the prose below. Reading it off
  // the grading model rather than typing it is the point; naming the fallback
  // is what stops a reorganised model turning that sentence into a crash at
  // build time, where the .mjs version would simply have thrown.
  const scenarioWeight = GRADING_MODEL.find((c) => c.id === 'scenario')?.weight
  const preClassFor = (week: number) =>
    KC_SCHEDULE.find((r) => r.week === week && r.delivery === 'assignment' && !r.standalone)

  /** Every session that names a standard, so the map can point at real dates. */
  const sessionsFor = (code: string) =>
    KC_SCHEDULE.filter((r) => (r.sections ?? []).includes(code)).sort(byDate)

  // ----- the coverage map ----------------------------------------------------
  //
  // A group heading is a row whose first cell carries the heading and whose
  // others are blank, rather than a spanned cell — the two renderers agree on
  // that shape, and a spanned cell would have to be special-cased in both.

  const mapRows: DocCell[][] = []
  for (const [group, name] of Object.entries(STD.STANDARD_GROUPS)) {
    const inGroup = STD.standardsIn(group)
    if (!inGroup.length) continue
    mapRows.push([`${group} — ${name}`, '', '', ''])
    for (const st of inGroup) {
      // A standard is assigned on the pre-class row; the week's classroom
      // sessions are where it is actually delivered, so both are named.
      const weeks = [...new Set(sessionsFor(st.code).map((r) => r.week))]
      const classDays = weeks.flatMap((w) =>
        KC_SCHEDULE.filter((r) => r.week === w && r.delivery === 'f2f').sort(byDate),
      )
      mapRows.push([
        st.code,
        st.label,
        weeks.map((w) => (w === 0 ? 'Pre-course' : `Week ${w}`)).join(', '),
        classDays.length ? classDays.map((c) => dayDate(c.date)).join(', ') : 'Pre-course, before 6 Oct',
      ])
    }
  }

  // ----- lesson plans ----------------------------------------------------------
  
  function lessonPlan(r: ScheduleRow): Block[] {
    const pre = preClassFor(r.week)
    const chapters = pre?.chapters ?? []
    const drills = N.skillDrills(chapters)
    const events = (r.assessmentIds ?? [])
      .map((id) => A.assessment(id))
      .filter((e): e is A.CourseAssessment => !!e)
    const sheets = (r.sheetIds ?? []).map((id: string) =>
      id === '@monitor' ? 'The operation’s own cardiac monitor sheet' : (K.skillSheet(id)?.title ?? id),
    )
    const out: Block[] = []
  
    out.push(h2(`${r.label} — ${dayDate(r.date)}, ${r.startTime}–${r.endTime}`))
    out.push(p(r.title))
  
    if (r.delivery === 'aha') {
      out.push(
        p(
          'Delivered to the American Heart Association provider curriculum by an AHA-certified instructor. Not lesson-planned here; the AHA course materials govern.',
          { italics: true },
        ),
      )
      if (r.note) out.push(p(printable(r.note), { italics: true }))
      return out
    }
  
    out.push(h3('Standards covered'))
    const codes = pre?.sections ?? []
    if (codes.length) {
      for (const c of codes) out.push(bullet(STD.standardLabel(c)))
    } else {
      out.push(p('Consolidation, assessment or remediation — no new standard is introduced.', { italics: true }))
    }
  
    out.push(h3('What the students were told to do first'))
    if (chapters.length) {
      const mins = chapters.reduce((n, c) => n + (N.chapterAssets(c)?.moduleMinutes ?? 0), 0)
      out.push(
        p(
          `Chapters ${chapters.join(', ')} — read, module, flashcards and practice activity. ${mins} minutes of module time. ASSUME THEY HAVE MET THIS MATERIAL; do not re-deliver it.`,
        ),
      )
      if (drills.length) {
        out.push(p(`Skill Drills read in advance: ${drills.map((d) => `${d.n} (p. ${d.page})`).join(', ')}.`))
      }
    } else {
      out.push(p('Nothing new — this session draws on earlier weeks.', { italics: true }))
    }
  
    out.push(h3('Shape of the session'))
    if (events.some((e) => e.kind === 'gate' || e.kind === 'final' || e.kind === 'simulation')) {
      const timed = events.find((e) => e.minutes)
      out.push(
        p(
          `Non-standard: this session carries ${events.map((e) => e.label).join(' and ')}${
            timed ? `, ${timed.minutes} minutes under examination conditions` : ''
          }. Run the examination as scheduled and use the remaining time as the title describes.`,
        ),
      )
    } else {
      for (const b of A.SESSION_TEMPLATE) {
        out.push(bullet(`${b.start}–${b.end}  ${b.label}${b.what ? ` — ${b.what}` : ''}`))
      }
    }
  
    if (sheets.length) {
      out.push(h3('Checked off this session'))
      for (const s of sheets) out.push(task(s))
      out.push(
        p(
          'Every student is signed off individually, on the sheet, with the evaluator named. A sheet marked complete for the group is not a record.',
          { italics: true },
        ),
      )
    }
    if ((r.taughtNotChecked ?? []).length) {
      out.push(h3('Taught but not checked off'))
      for (const t of r.taughtNotChecked ?? []) out.push(bullet(printable(t)))
    }
  
    if (events.length) {
      out.push(h3('Graded'))
      for (const e of events) {
        const bits = [
          e.items ? `${e.items} items` : null,
          e.minutes ? `${e.minutes} min` : null,
          e.proctored ? 'proctored, closed book' : null,
          e.mps ? `MPS ${e.mps}%` : null,
          e.retestBy ? `retest window closes ${longDate(e.retestBy)}` : null,
        ].filter(Boolean)
        out.push(bullet(`${e.label} — ${e.covers}${bits.length ? ` (${bits.join('; ')})` : ''}`))
      }
    }
  
    if (r.note) out.push(p(printable(r.note), { italics: true }))
    return out
  }

  return [
    cover(
      'Curriculum and Lesson Plans',
      'Advanced Emergency Medical Technician',
      `AMR Kansas City with AMR Wichita  ·  ${longDate(KC_START_DATE)} to ${longDate(KC_END_DATE)}`,
    ),

    h1('The curriculum this course teaches'),
    p(
      `K.A.R. 109-10-1c adopts the Kansas AEMT Education Standards of October 2014. This course covers all ${STD.STANDARDS.length} standards those describe, mapped below to the dated session that delivers each. Content is sequenced against the National Registry AEMT examination specifications effective 1 July 2024, which is a different document with a different purpose: the standards say what must be taught, the specifications say what will be tested and in what proportion.`,
    ),
    p(
      `The adopted text is ${COURSE_TEXT.title}, ${COURSE_TEXT.edition} edition (${COURSE_TEXT.copyright}), and every one of its ${N.CHAPTER_ASSETS.length} chapters is assigned to a week.`,
    ),

    h1('Standards coverage map'),
    p(
      'A standard is assigned on its week’s pre-class row and delivered in that week’s classroom sessions, so both are named. Where a week holds a laboratory, the standard is also practised there.',
      { italics: true },
    ),
    spacer(120),
    table([1000, 4200, 1600, 3280], ['Code', 'Standard', 'Week', 'Delivered'], mapRows),

    h1('The standard session'),
    p(
      `Every Tuesday and Thursday runs to the same shape unless it is an AHA provider course, a gate examination or a full-length simulation. The 0930–1100 block is explicitly NOT lecture — the lecture was the Navigate module the student completed beforehand, and re-delivering it in the room is how a flipped course collapses back into an ordinary one.`,
    ),
    spacer(120),
    table(
      [1500, 2200, 6380],
      ['Time', 'Block', 'What happens and why'],
      A.SESSION_TEMPLATE.map((b) => [`${b.start}–${b.end}`, b.label, b.what || '—']),
    ),
    spacer(),
    p(
      `Every laboratory debrief runs the six-step clinical judgment cycle with the student naming each step aloud: ${A.CLINICAL_JUDGMENT_CYCLE.join(' → ')}.${
        scenarioWeight == null
          ? ''
          : ` The scenario rubric is ${scenarioWeight}% of the course grade and scores against those steps, so the wording is the same in the debrief, on the rubric and in the tracker.`
      }`,
    ),

    h1('Lesson plans'),
    p(
      `One per scheduled session, in date order. These are not lecture notes and are not meant to be: what an instructor needs before a session is what the room is for, what the students have already met, what gets checked off and what is graded.`,
      { italics: true },
    ),
    ...sessions.flatMap((r) => lessonPlan(r)),
    {
      k: 'provenance',
      command: 'npm run doc:curriculum',
      startDate: KC_START_DATE,
      endDate: KC_END_DATE,
      weeks: KC_COURSE_WEEKS,
    },
  ]
}
