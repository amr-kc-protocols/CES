// ---------------------------------------------------------------------------
// AEMT cohort selection model.
//
// The scoring rules live here as data so that changing a weight or a threshold
// is a reviewable edit to one file rather than a hunt through components. The
// written instruments this implements are docs/aemt-selection-test.md and
// docs/aemt-selection-interview.md; those remain the source of truth for the
// items themselves.
//
// Retention is handled by the service commitment agreement signed at
// acceptance, NOT by selection. Selection measures one thing: who is most
// likely to complete the course and pass the certification examination.
// ---------------------------------------------------------------------------

export interface SelectionWeight {
  id: 'test' | 'interview' | 'qa' | 'attendance'
  label: string
  weight: number
  source: string
}

export const SELECTION_WEIGHTS: SelectionWeight[] = [
  { id: 'test', label: 'Selection test', weight: 40, source: 'docs/aemt-selection-test.md' },
  { id: 'interview', label: 'Structured interview', weight: 30, source: 'Six anchored questions' },
  { id: 'qa', label: 'QA chart review', weight: 20, source: 'Trailing 12 months' },
  { id: 'attendance', label: 'Attendance record', weight: 10, source: 'Trailing 12 months' },
]

/**
 * Demonstrated willingness to take on additional duty — behavioural evidence
 * rather than a stated intention.
 *
 * Deliberately small. It decides a tie and a near-tie; it cannot carry a
 * candidate over the threshold from a weak score, because FTO service predicts
 * effort and not arithmetic.
 */
export type BonusTierId = 'fto' | 'additional' | 'none'

export const BONUS_TIERS: { id: BonusTierId; label: string; points: number }[] = [
  { id: 'fto', label: 'Current EMT Field Training Officer, in good standing', points: 5 },
  {
    id: 'additional',
    label: 'Preceptor, CE instructor, peer mentor, or FTO within the last 24 months',
    points: 3,
  },
  { id: 'none', label: 'None recorded', points: 0 },
]

export const THRESHOLDS = {
  /** Composite, out of 105 with the bonus. */
  composite: 70,
  /** Selection test overall. */
  test: 70,
  /** Structured interview, out of 30. */
  interview: 18,
}

/* ---------------------------------------------------------------------------
 * The selection test
 * ---------------------------------------------------------------------------
 * THE ONLINE EXAM IS THE SELECTION TEST. It is 50 items drawn from a 120-item
 * bank of EMT-level recall, sat at /exam, graded server-side, and it supplies
 * the 40% test component directly — matched to candidates by email.
 *
 * That is a deliberate narrowing. What this component is for is predicting who
 * passes a certification examination, and a certification examination is a
 * multiple-choice knowledge test. The closest available predictor of
 * performance on one is performance on another.
 *
 * docs/aemt-selection-test.md describes a wider four-section instrument — 48
 * items across knowledge, dosage arithmetic, reading comprehension and
 * situational judgment, proctored and closed-book. It was never built, and
 * until now the app asked an administrator to hand-enter marks for all four
 * sections of a test nobody sat, while the exam candidates actually took fed
 * nothing at all. Forty per cent of the composite had no source.
 *
 * The four sections remain below as OPTIONAL SUPPLEMENTS. Run one on paper and
 * enter the marks and it counts; leave it and it does not block anybody. A
 * floor is only checked against a section that was actually scored — a gate on
 * a test that was not administered is not a gate, it is an outage.
 *
 * The section worth building next is B. Its argument still holds: every value
 * is supplied in the stem, so it is pure arithmetic with objective answers,
 * and mid-course maths remediation is the hardest thing to deliver to a
 * working student. It needs Medical Director approval before it is used, which
 * is why it is not being written under a deadline.
 * ------------------------------------------------------------------------ */

export interface TestSection {
  id: string
  label: string
  marks: number
  /** Percentage floor this section must clear on its own, where one applies. */
  floor?: number
  floorNote?: string
}

export const TEST_SECTIONS: TestSection[] = [
  { id: 'a', label: 'A · EMT knowledge retention', marks: 20 },
  {
    id: 'b',
    label: 'B · Dosage arithmetic',
    marks: 20,
    floor: 70,
    floorNote:
      'Hard floor. Every value is supplied in the question, so this is pure arithmetic — and mid-course maths remediation is the hardest thing to deliver to a working student. A candidate who clears the overall bar but fails this floor should not be advanced on interview strength.',
  },
  {
    id: 'c',
    label: 'C · Reading comprehension',
    marks: 15,
    floor: 60,
    floorNote: 'Predicts the ability to self-study from the textbook.',
  },
  { id: 'd', label: 'D · Situational judgment', marks: 16 },
]

export const TEST_TOTAL_MARKS = TEST_SECTIONS.reduce((n, s) => n + s.marks, 0)

export interface InterviewQuestion {
  id: string
  label: string
  question: string
  /** What the question is actually measuring. */
  predicts: string
  probes: string[]
  /** Behavioural anchors at 1, 3 and 5. Use 2 and 4 for answers in between. */
  anchors: { 1: string; 3: string; 5: string }
  /** Shown as a warning on the scoring form where one applies. */
  guardRail?: string
  /**
   * Distinctive lowercase fragments of the asked question, used only to locate
   * where in an uploaded transcript this question begins so the candidate's
   * answer can be lifted out. Matching is a convenience for pre-filling the
   * scoring form; the interviewer confirms and edits every answer and score.
   */
  matchPhrases: string[]
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'q1',
    label: 'Self-directed learning',
    question:
      "Tell me about something you've learned or gotten better at in the last year that nobody required you to. Walk me through how you actually went about it.",
    predicts: 'Capacity to study without being chased — the largest single demand of this program.',
    probes: ['How did you find the time?', 'What did you use?', 'How did you know it was working?'],
    anchors: {
      1: 'No example, or something entirely passive with no structure behind it.',
      3: 'A genuine example with some structure, but time was found ad hoc.',
      5: 'A specific example, a deliberate plan, protected time they can describe, and a way they knew it was working.',
    },
    matchPhrases: ['learned or gotten better', 'nobody required', 'gotten better at'],
  },
  {
    id: 'q2',
    label: 'Competing demands',
    question:
      "Describe a stretch when work, home, and something else you'd committed to all landed at once. What did you actually do?",
    predicts: 'The exact failure mode of a working student. The highest-value question in the set.',
    probes: ['What did you drop?', 'Who did you tell, and when?', 'What would you do differently?'],
    anchors: {
      1: 'Overwhelmed with no strategy, or claims this has never happened.',
      3: 'Coped reactively — managed it by working harder rather than by deciding anything.',
      5: 'Triage, explicit trade-offs, and telling the affected people early rather than after the fact.',
    },
    matchPhrases: ['work, home', 'landed at once', 'all landed'],
  },
  {
    id: 'q3',
    label: 'Response to failure',
    question: 'Tell me about a time you failed at something that mattered to you. What happened next?',
    predicts:
      'Response to a failed exam or skill check-off, which most students will have at least once.',
    probes: ['What did you change?', 'How long before you acted?'],
    anchors: {
      1: 'Blames circumstances or other people, or offers no example.',
      3: 'Owns it and recovered, but what actually changed is vague.',
      5: 'Owns it specifically, names the change, and can say how they knew it worked.',
    },
    matchPhrases: ['time you failed', 'failed at something', 'what happened next'],
  },
  {
    id: 'q4',
    label: 'Commitment and planning',
    question:
      "You've heard what the schedule is. Looking at that against your next six months, where do you see the pressure points, and what's your plan for them?",
    predicts:
      'Realism. A candidate who says "no problem" is a worse bet than one who names a real constraint and a plan.',
    probes: ['What have you already arranged?', 'What if that fell through?'],
    anchors: {
      1: 'Dismisses the difficulty, or cannot identify a single pressure point.',
      3: 'Identifies real pressure points, but the plan is general.',
      5: 'Specific pressure points and specific arrangements already thought through or made.',
    },
    matchPhrases: ['pressure points', 'next six months', 'plan for them'],
    guardRail:
      'Ask about the PLAN, never the reason. If a candidate volunteers a personal circumstance, acknowledge it and return to the plan — do not record it, do not follow it up, and do not let it affect the score. You are scoring the quality of the planning, not the shape of anyone’s life.',
  },
  {
    id: 'q5',
    label: 'Receiving correction',
    question:
      'Tell me about a time someone corrected you on a call or on a report. How did you take it, and what happened after?',
    predicts: 'How they will handle preceptor feedback and a failed skill sheet criterion.',
    probes: ['What did you say at the time?', 'What did you do differently afterwards?'],
    anchors: {
      1: 'Defensive framing, or presents the correction as unfair.',
      3: 'Accepted it; whether anything changed afterwards is unclear.',
      5: 'Sought clarification, changed their practice, and can name the change.',
    },
    matchPhrases: ['corrected you', 'someone corrected', 'on a report'],
  },
  {
    id: 'q6',
    label: 'Motivation',
    question: 'Why AEMT, and why now?',
    predicts: 'Durability of motivation through week eleven.',
    probes: ['What made now the right time?', 'What do you want to be doing in three years?'],
    anchors: {
      1: 'Pay alone, or an answer that could apply to any program.',
      3: 'A clear personal reason.',
      5: 'A clear reason tied to how they want to practise, and to staying in the role.',
    },
    matchPhrases: ['why aemt', 'why now'],
  },
]

export const INTERVIEW_MAX = INTERVIEW_QUESTIONS.length * 5

/** Pass/fail before anyone is scored. */
export const ELIGIBILITY_GATES: { id: string; label: string; note: string }[] = [
  {
    id: 'cert',
    label: 'Kansas EMT certification current',
    note: 'And not expiring part-way through the course.',
  },
  {
    id: 'tenure',
    label: 'Minimum continuous full-time tenure',
    note: '12 months suggested; 6 if the applicant pool is thin.',
  },
  { id: 'discipline', label: 'No active corrective action or PIP', note: '' },
  { id: 'attendance', label: 'Attendance within policy, trailing 12 months', note: '' },
  {
    id: 'availability',
    label: 'Available for the scheduled class days',
    note: 'Availability as a fact. Never ask the reasons behind it.',
  },
  { id: 'agreement', label: 'Willing to sign the service commitment agreement', note: '' },
]

/**
 * Never asked, by anyone, at any stage — not as small talk and not as a
 * follow-up. Surfaced in the UI because the notes are discoverable.
 */
export const PROHIBITED_TOPICS = [
  'Family arrangements, childcare, dependants',
  'Pregnancy, or plans to have children',
  'Age, or when they graduated',
  'Health, disability, or fitness',
  'Religion, national origin, ethnicity',
  'Marital or relationship status',
  'Arrest record',
  'Second jobs — reads as availability, functions as an economic-status proxy',
]
