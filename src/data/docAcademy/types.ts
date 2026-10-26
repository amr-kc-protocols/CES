// ---------------------------------------------------------------------------
// Ambulance Documentation & Review Academy — the content contract.
//
// This is the data model from section 7 of the build brief, kept apart from
// the screens so the content can be reviewed, versioned and checked without a
// browser (scripts/check-doc-academy.mjs). Everything is keyed by stable id;
// nothing is ever looked up by the title a learner sees.
// ---------------------------------------------------------------------------

/**
 * Where a statement's authority comes from. Every lesson, question rationale
 * and reference card carries one of these, because a federal rule, a MAC's
 * education article and this course's own rubric answer different questions.
 */
export type Authority =
  | 'federal_rule'
  | 'cms_guidance'
  | 'contractor_guidance'
  | 'state_rule'
  | 'payer_rule'
  | 'local_policy'
  | 'training_recommendation'

/**
 * - reviewed: the relevant content was retrieved and read
 * - located_needs_review: an official resource was found; the implementation
 *   text still needs reading before a lesson relies on it
 * - local_pending: an internal policy the course needs and nobody has supplied
 */
export type Verification = 'reviewed' | 'located_needs_review' | 'local_pending'

export interface Source {
  id: string
  title: string
  publisher: string
  url?: string
  /** Section or paragraph — never just a landing page when a lesson cites it. */
  locator?: string
  authority: Authority
  jurisdiction?: string
  payer?: string
  checkedOn: string
  effectiveDate?: string
  verification: Verification
  /** A role, until a named person takes it. */
  owner: string
  nextReviewOn: string
  /** What the 2026-10-26 verification pass found, for the course owner. */
  note?: string
}

/** learner = field crew; the other three also take the leadership practicum. */
export type Track = 'learner' | 'fto' | 'manager' | 'educator'

export type Approval = 'draft' | 'reviewed' | 'published' | 'retired'

export interface LessonSection {
  heading: string
  /** Short paragraphs. A lesson is explanation then decision, not a reading. */
  body: string[]
  /** Source ids this section rests on. */
  sourceIds: string[]
}

export interface Lesson {
  id: string
  version: string
  title: string
  minutes: number
  tracks: Track[]
  objectives: string[]
  prerequisites: string[]
  sourceIds: string[]
  caseIds: string[]
  questionIds: string[]
  /** The in-class activity and what it produces (the brief's "PWA activity / output"). */
  activity: string
  sections: LessonSection[]
  /** Leadership lessons: what each audience is pushed to do differently. */
  emphasis?: { fto: string; manager: string }
  approval: Approval
  /** Who must sign the lesson off before it moves past draft. */
  reviewers: string[]
}

export type ExamDomain =
  | 'accuracy'
  | 'agreement'
  | 'necessity'
  | 'level'
  | 'signatures'
  | 'routing'
  | 'consent'

export interface Question {
  id: string
  lessonId: string
  domain: ExamDomain
  /** Shown before the prompt. Empty for a knowledge item. */
  scenarioFacts: string[]
  prompt: string
  choices: { id: string; text: string }[]
  correctChoiceIds: string[]
  rationaleByChoice: Record<string, string>
  sourceIds: string[]
  /** A miss on a critical concept is listed for remediation even on a pass. */
  criticalConcept: boolean
}

export interface CaseIssue {
  id: string
  /** What the learner picks from the list. */
  label: string
  explanation: string
  sourceIds: string[]
}

export interface TimelineEntry {
  time: string
  event: string
}

export interface TrainingCase {
  id: string
  title: string
  lessonIds: string[]
  /** One line on what the case is built to exercise. */
  seed: string
  learnerTask: string
  answerDirection: string
  /** Six priority cases are fully authored; the rest are seeds awaiting a vignette. */
  authored: boolean
  knownFacts: string[]
  unknownFacts: string[]
  narrative?: string
  structuredFields?: Record<string, string>
  timeline?: TimelineEntry[]
  attachments?: string[]
  /** The findings a reviewer should raise. */
  expectedIssues: CaseIssue[]
  /** Plausible findings that are wrong — picking one costs a point. */
  distractors: CaseIssue[]
  /** Conclusions the facts do not support; the debrief names them. */
  forbiddenInferences: string[]
  reviewerRubric: string[]
  /**
   * Set when the right answer depends on a policy nobody has supplied yet. The
   * lab then ends in "clarification needed" and never issues a definitive
   * legal or payer answer.
   */
  pendingSourceIds?: string[]
}

export type RubricDomainId =
  | 'timeline'
  | 'findings'
  | 'agreement'
  | 'transport'
  | 'care'
  | 'forms'
  | 'integrity'
  | 'coaching'

export interface RubricDomain {
  id: RubricDomainId
  label: string
  evidence: string
}
