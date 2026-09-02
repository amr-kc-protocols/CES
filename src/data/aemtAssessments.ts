// ---------------------------------------------------------------------------
// What is measured, when, and what it is worth.
//
// The joint October 2026 plan replaced a grading model that put the entire
// graded weight on untimed online work. That model measured a student's ability
// to search the eBook; the certification exam measures retrieval under time
// pressure with no way to go back. Everything in this file exists to close that
// gap, so it is deliberately a schedule of EVENTS rather than a gradebook —
// each one has a date, a form, and a reason it sits where it sits.
//
// Three kinds of thing live here and they are not interchangeable:
//
//   RETRIEVAL QUIZZES are cheap, frequent and cumulative. They are the spacing
//   mechanism. Missing one costs a fraction of 20% of the grade.
//
//   GATES are pass/fail against an 80% minimum passing standard. Failing one
//   does not stop the didactic — it gates the NEXT UNIT'S LAB, which is the
//   part where a student who has not understood the material is a hazard.
//
//   SIMULATIONS are full-length, 135-item, exam-condition runs. Sim #1 is
//   ungraded on purpose: it is a diagnostic, and grading a diagnostic teaches
//   students to protect their score instead of showing you what they do not
//   know. Sim #2 is the final and it counts.
//
// Dates are the ones in the agreed schedule, written out rather than derived,
// because a gate date is a commitment made to students and to Wichita — not
// something that should move because an offset changed.
// ---------------------------------------------------------------------------

import { KC_CLASS_PATTERN, MIN_PASSING_PERCENT } from './aemt'

// ----- the exam blueprint ----------------------------------------------------

/**
 * The NREMT AEMT examination specifications, effective 1 July 2024, against
 * what the prior course actually spent its hours on.
 *
 * This table is the re-allocation instruction the joint schedule was built
 * from, and it is kept because the reasoning has to survive the person who did
 * it. Two numbers do the work: Clinical Judgment is the largest single domain
 * on the exam and had no dedicated instruction at all, and Trauma was
 * over-allocated by roughly 2x and blocked into three consecutive weeks. About
 * ten didactic hours move out of trauma and into airway and structured clinical
 * judgment work; trauma is compressed into weeks 13-14 and medical/OB is taught
 * before the winter break rather than after it.
 */
export interface BlueprintDomain {
  id: string
  label: string
  /** Percent of the certification exam, as the specifications state the range. */
  examMin: number
  examMax: number
  /** Didactic hours the PRIOR course gave it, and what share of its didactic that was. */
  priorHours: number
  priorShare: number
  verdict: string
}

export const EXAM_BLUEPRINT: BlueprintDomain[] = [
  {
    id: 'clinical-judgment',
    label: 'Clinical Judgment',
    examMin: 31,
    examMax: 35,
    priorHours: 0,
    priorShare: 0,
    verdict:
      'Largest single domain, no dedicated instruction. Absorbed into generic "review" days. Now carries a graded scenario rubric line and the six-step cycle is named aloud in every lab debrief.',
  },
  {
    id: 'medical-ob-gyn',
    label: 'Medical / OB / GYN',
    examMin: 25,
    examMax: 29,
    priorHours: 32,
    priorShare: 29,
    verdict:
      'Hours right, sequencing wrong — taught last, in the final three weeks. Now weeks 6-12, fully taught before the winter break.',
  },
  {
    id: 'cardiology',
    label: 'Cardiology & Resuscitation',
    examMin: 11,
    examMax: 15,
    priorHours: 13,
    priorShare: 12,
    // The prior verdict read "Appropriate. ACLS carries much of it." — which
    // stopped being true the moment ACLS came out of the filed schedule. The
    // hours did not change; what changed is that they are now the only
    // cardiology this course delivers, so the allocation has to stand on its
    // own rather than lean on a provider course taught somewhere else.
    verdict:
      'Appropriate, and now load-bearing: with ACLS run separately by each operation, these are the only cardiology hours this course files.',
  },
  {
    id: 'airway',
    label: 'Airway, Respiration & Ventilation',
    examMin: 9,
    examMax: 13,
    priorHours: 6,
    priorShare: 5,
    verdict: 'Under-allocated by roughly half. Receives hours moved out of trauma.',
  },
  {
    id: 'trauma',
    label: 'Trauma',
    examMin: 7,
    examMax: 11,
    priorHours: 22,
    priorShare: 20,
    verdict:
      'Over-allocated by roughly 2x, and blocked into three consecutive weeks. Compressed into weeks 13-14.',
  },
  {
    id: 'ems-operations',
    label: 'EMS Operations',
    examMin: 6,
    examMax: 10,
    priorHours: 6,
    priorShare: 5,
    verdict: 'Slightly light but acceptable. Delivered as one block in week 15.',
  },
]

/** Domains a gate or the per-student tracker scores against. */
export const BLUEPRINT_DOMAIN_IDS = EXAM_BLUEPRINT.map((d) => d.id)

// ----- graded and gating events ---------------------------------------------

export type AssessmentKind =
  | 'diagnostic'
  | 'retrieval-quiz'
  | 'bridge-quiz'
  | 'testprep'
  | 'gate'
  | 'simulation'
  | 'final'

export interface CourseAssessment {
  /** Matches a `assessmentIds` entry on a schedule row in data/aemt.ts. */
  id: string
  kind: AssessmentKind
  label: string
  /** ISO date it is administered. */
  date: string
  /** Number of items, where the form is fixed. */
  items?: number
  /** Minutes allowed, where it is timed. */
  minutes?: number
  /** What it draws on, in the plan's own words. */
  covers: string
  /** Minimum passing standard, percent. Absent = not scored against a standard. */
  mps?: number
  /** Last date a failed attempt may be retested. */
  retestBy?: string
  /** Which grading component in data/aemt.ts this feeds. */
  gradingComponent: string | null
  /** Closed book, proctored, no notes, no phones. */
  proctored: boolean
  note?: string
}

/**
 * Everything on the calendar that produces a number.
 *
 * The retrieval quizzes are named A-L as the schedule names them, and each one
 * states its own spiral: roughly four items from the last session, three from
 * two to four sessions back, and three from the earliest material. That mix is
 * the point of them — a quiz that only asks about last week is a comprehension
 * check, not spaced retrieval.
 */
export const COURSE_ASSESSMENTS: CourseAssessment[] = [
  {
    id: 'baseline',
    kind: 'diagnostic',
    label: 'Baseline diagnostic',
    date: '2026-10-05',
    items: 50,
    covers: 'Incoming EMT-level knowledge across all six domains.',
    gradingComponent: null,
    proctored: true,
    note: 'Ungraded. Seeds the per-student domain tracker on day one so every later measurement has something to move against.',
  },
  {
    id: 'quiz-a',
    kind: 'retrieval-quiz',
    label: 'Quiz A',
    date: '2026-10-12',
    items: 10,
    minutes: 15,
    covers: 'Week 1',
    gradingComponent: 'retrieval-quizzes',
    proctored: true,
  },
  {
    id: 'quiz-b',
    kind: 'retrieval-quiz',
    label: 'Quiz B',
    date: '2026-10-19',
    items: 10,
    minutes: 15,
    covers: 'Weeks 1-2',
    gradingComponent: 'retrieval-quizzes',
    proctored: true,
  },
  {
    id: 'quiz-c',
    kind: 'retrieval-quiz',
    label: 'Quiz C',
    date: '2026-10-26',
    items: 10,
    minutes: 15,
    covers: 'Weeks 1-3',
    gradingComponent: 'retrieval-quizzes',
    proctored: true,
  },
  {
    id: 'gate-1',
    kind: 'gate',
    label: 'Gate 1 — Foundations + Airway',
    date: '2026-10-29',
    minutes: 90,
    covers: 'Preparatory, A&P, pathophysiology, patient assessment, airway.',
    mps: MIN_PASSING_PERCENT,
    retestBy: '2026-11-05',
    gradingComponent: 'gates',
    proctored: true,
  },
  {
    id: 'quiz-d',
    kind: 'retrieval-quiz',
    label: 'Quiz D',
    date: '2026-11-02',
    items: 10,
    minutes: 15,
    covers: 'Weeks 2-4, plus spiral items from week 1',
    gradingComponent: 'retrieval-quizzes',
    proctored: true,
  },
  {
    id: 'quiz-e',
    kind: 'retrieval-quiz',
    label: 'Quiz E',
    date: '2026-11-09',
    items: 10,
    minutes: 15,
    covers: 'Weeks 3-5, plus spiral',
    gradingComponent: 'retrieval-quizzes',
    proctored: true,
  },
  {
    id: 'quiz-f',
    kind: 'retrieval-quiz',
    label: 'Quiz F',
    date: '2026-11-16',
    items: 10,
    minutes: 15,
    covers: 'Weeks 4-6, plus spiral',
    gradingComponent: 'retrieval-quizzes',
    proctored: true,
  },
  {
    id: 'quiz-g',
    kind: 'retrieval-quiz',
    label: 'Quiz G',
    date: '2026-11-23',
    items: 10,
    minutes: 15,
    covers: 'Weeks 5-7, plus spiral',
    gradingComponent: 'retrieval-quizzes',
    proctored: true,
  },
  {
    id: 'gate-2',
    kind: 'gate',
    label: 'Gate 2 — Airway + Cardiology + Pharmacology/Vascular Access',
    date: '2026-11-30',
    minutes: 90,
    covers: 'Airway, cardiovascular, pharmacology, vascular access and medication administration.',
    mps: MIN_PASSING_PERCENT,
    retestBy: '2026-12-10',
    gradingComponent: 'gates',
    proctored: true,
    note: 'Deliberately placed AFTER Thanksgiving rather than before it, so nobody is trying to remediate over a holiday weekend.',
  },
  {
    id: 'quiz-h',
    kind: 'retrieval-quiz',
    label: 'Quiz H',
    date: '2026-12-07',
    items: 10,
    minutes: 15,
    covers: 'Weeks 6-9, plus spiral',
    gradingComponent: 'retrieval-quizzes',
    proctored: true,
  },
  {
    id: 'quiz-i',
    kind: 'retrieval-quiz',
    label: 'Quiz I',
    date: '2026-12-14',
    items: 10,
    minutes: 15,
    covers: 'Weeks 7-10, plus spiral',
    gradingComponent: 'retrieval-quizzes',
    proctored: true,
  },
  {
    id: 'bridge',
    kind: 'bridge-quiz',
    label: 'Bridge quiz',
    date: '2026-12-17',
    items: 30,
    covers: 'Every domain taught to date.',
    gradingComponent: 'retrieval-quizzes',
    proctored: true,
    note: 'The last class before the break. Sets the mark that the three TestPrep sets and the 5 January simulation are measured against.',
  },
  {
    id: 'testprep-1',
    kind: 'testprep',
    label: 'Break TestPrep set 1',
    date: '2026-12-26',
    covers: 'By domain, assigned from the bridge-quiz item analysis.',
    gradingComponent: 'navigate',
    proctored: false,
    note: 'An unstructured break causes forgetting; spaced retrieval across a break improves retention. Three dated sets are what makes the fortnight a study block rather than a gap.',
  },
  {
    id: 'testprep-2',
    kind: 'testprep',
    label: 'Break TestPrep set 2',
    date: '2026-12-30',
    covers: 'By domain.',
    gradingComponent: 'navigate',
    proctored: false,
  },
  {
    id: 'testprep-3',
    kind: 'testprep',
    label: 'Break TestPrep set 3',
    date: '2027-01-03',
    covers: 'By domain.',
    gradingComponent: 'navigate',
    proctored: false,
  },
  {
    id: 'sim-1',
    kind: 'simulation',
    label: 'Full-length simulation #1',
    date: '2027-01-04',
    items: 135,
    minutes: 180,
    covers: 'Blueprint-weighted, all six domains, exam conditions, no backtracking.',
    gradingComponent: null,
    proctored: true,
    note: 'UNGRADED, and that is the design. It is the re-entry diagnostic: it measures what survived the break with five weeks left to fix it. Its item analysis drives every individualised assignment from here forward.',
  },
  {
    id: 'quiz-j',
    kind: 'retrieval-quiz',
    label: 'Quiz J',
    date: '2027-01-11',
    items: 10,
    minutes: 15,
    covers: 'Weeks 9-12, plus spiral',
    gradingComponent: 'retrieval-quizzes',
    proctored: true,
  },
  {
    id: 'quiz-k',
    kind: 'retrieval-quiz',
    label: 'Quiz K',
    date: '2027-01-19',
    items: 10,
    minutes: 15,
    covers: 'Weeks 10-13, plus spiral',
    gradingComponent: 'retrieval-quizzes',
    proctored: true,
  },
  {
    id: 'gate-3',
    kind: 'gate',
    label: 'Gate 3 — Medical/OB + Trauma',
    date: '2027-01-21',
    minutes: 90,
    covers: 'Medical, obstetric and gynaecologic emergencies; trauma.',
    mps: MIN_PASSING_PERCENT,
    retestBy: '2027-01-28',
    gradingComponent: 'gates',
    proctored: true,
  },
  {
    id: 'quiz-l',
    kind: 'retrieval-quiz',
    label: 'Quiz L',
    date: '2027-01-25',
    items: 10,
    minutes: 15,
    covers: 'Weeks 11-14, plus spiral',
    gradingComponent: 'retrieval-quizzes',
    proctored: true,
  },
  {
    id: 'final',
    kind: 'final',
    label: 'Final comprehensive exam (simulation #2)',
    date: '2027-02-01',
    items: 135,
    minutes: 180,
    covers: 'Blueprint-weighted, all six domains, no backtracking.',
    mps: MIN_PASSING_PERCENT,
    gradingComponent: 'final',
    proctored: true,
    note: 'Counts toward the 80% course completion threshold. Trains pacing and stamina under the no-backtracking rule, which is a distinct skill from content mastery.',
  },
]

const BY_ID = new Map(COURSE_ASSESSMENTS.map((a) => [a.id, a]))

export function assessment(id: string): CourseAssessment | undefined {
  return BY_ID.get(id)
}

export const MASTERY_GATES = COURSE_ASSESSMENTS.filter((a) => a.kind === 'gate')

export const RETRIEVAL_QUIZZES = COURSE_ASSESSMENTS.filter((a) => a.kind === 'retrieval-quiz')

/**
 * What happens when a student is below the standard on a gate.
 *
 * Written down because the tempting move — hold the student out of the whole
 * course until they pass — is the wrong one. Didactic continues; what is gated
 * is the NEXT UNIT'S LAB, where a student who has not understood the material
 * is a hazard to a manikin at best and a patient at worst.
 */
export const GATE_REMEDIATION = {
  belowStandard:
    'A targeted deliberate-practice session within seven days, built from the student’s own missed-item domains, then a retest on a parallel form.',
  whatContinues: 'Didactic continues. The next unit’s lab is what is gated.',
  twoFailedRetests:
    'Triggers the private progress conference the syllabus already requires — early, while there is still course left to fix it in.',
}

// ----- the standard session --------------------------------------------------

export interface SessionBlock {
  start: string
  end: string
  minutes: number
  label: string
  what: string
}

/**
 * The shape of an ordinary class day.
 *
 * Applies to every session that is not a gate exam or a full-length simulation.
 * The opening quiz is the highest-yield fifteen minutes in the course and it is
 * first on purpose: a quiz that slips to the end of a session is a quiz that
 * gets dropped when the session runs long.
 *
 * The ninety-minute application block is explicitly NOT lecture. The lecture was
 * the Navigate module the student did before class. Re-delivering it in the room
 * is the single most common way a flipped classroom collapses back into a normal
 * one, and the benefit collapses with it.
 *
 * THE CLOCK TIMES ARE DERIVED, not typed. They were typed, against a 0900 start,
 * and when the class day moved to 0800 the printed agenda went on saying 0900 —
 * a session header reading 08:00-12:00 above a timetable starting at 09:00, in
 * the one document an instructor reads on the way into the room. The lengths are
 * the decision; the clock is arithmetic from whatever time the class pattern
 * says the day begins.
 */
const BLOCK_PLAN: { minutes: number; label: string; what: string }[] = [
  {
    minutes: 15,
    label: 'Cumulative retrieval quiz',
    what: '10 items, closed book, no notes, no phones. Roughly 4 items from last session, 3 from two to four sessions back, 3 spiral items from the earliest material.',
  },
  {
    minutes: 15,
    label: 'Quiz debrief',
    what: 'Missed items only. Have the student reconstruct the reasoning aloud before you give the answer. Log every miss against its domain in the tracker.',
  },
  {
    minutes: 90,
    label: 'Application block',
    what: 'Not lecture — the lecture was the pre-class module. Worked cases, the progressive case studies from the Navigate chapter placards, and drilling of NREMT item formats: multiple-response, build-list, drag-and-drop, options box, capnography graphics.',
  },
  { minutes: 15, label: 'Break', what: '' },
  {
    minutes: 90,
    label: 'Lab / scenario',
    what: 'Skill drills or full scenarios. Every debrief runs through the six-step clinical judgment cycle with the student naming each step aloud.',
  },
  {
    minutes: 15,
    label: 'Close-out',
    what: 'Three questions previewing the next session’s pre-work. Confirm the Navigate assignment is open and that clinical hour logging is current.',
  },
]

const clock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export const SESSION_TEMPLATE: SessionBlock[] = (() => {
  let at = KC_CLASS_PATTERN.startMinute
  return BLOCK_PLAN.map((b) => {
    const start = at
    at += b.minutes
    return { start: clock(start), end: clock(at), minutes: b.minutes, label: b.label, what: b.what }
  })
})()

/**
 * The six-step clinical judgment cycle, named in every lab debrief.
 *
 * Kept as data because it is scored: the scenario rubric is 10% of the grade
 * and it scores against these steps, so the wording has to be the same in the
 * debrief, on the rubric and in the tracker.
 */
export const CLINICAL_JUDGMENT_CYCLE = [
  'Recognize cues',
  'Analyze cues',
  'Define hypothesis',
  'Generate solutions',
  'Take action',
  'Evaluate outcomes',
]

// ----- what to do after the course ------------------------------------------

/**
 * Days after the final session by which students should sit the NREMT cognitive
 * exam.
 *
 * The Authorization to Test is valid 90 days, so this is not a deadline. It is
 * a recommendation with a reason: retention decays and momentum is real, and a
 * cohort that drifts to April sits the exam having forgotten the winter.
 */
export const NREMT_SIT_WITHIN_DAYS = 21
