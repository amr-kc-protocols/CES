// ---------------------------------------------------------------------------
// The chart review questionnaire, transcribed from the Ninth Brain Suite form
// it replaces.
//
// Kept as data rather than JSX so the question set is one reviewable list. The
// form in Ninth Brain grows a section at a time as review categories are added,
// and every one of those is an edit to this file and nothing else.
//
// SCORING IS NOT UNIFORM, and this is the part a spreadsheet built by hand gets
// wrong. Most questions are compliant when answered Yes, but three at the end
// of the Overall Evaluation are not:
//
//   - a near miss and a safety concern INVERT. Yes is the failure, and counting
//     those Yes answers as compliance would report a crew's worst charts as
//     their best.
//   - escalation to clinical leadership is a FLAG, scored neither way. A
//     reviewer escalating appropriately is doing the job.
//
// Each question therefore carries its own `scoring`, and the tally reads that
// rather than assuming.
// ---------------------------------------------------------------------------

/** What a Yes answer means for the compliance tally. */
export type Scoring =
  /** Yes is the compliant answer. The default, and most of the form. */
  | 'yes-good'
  /** No is the compliant answer — the question asks whether something is wrong. */
  | 'no-good'
  /**
   * Neither. Counted and reported, never scored. "Does this chart need further
   * review by clinical leadership?" is a routing decision, not a failure: a
   * reviewer escalating appropriately is doing the job, and folding it into a
   * percentage punishes them for it.
   */
  | 'flag'

export type QuestionKind = 'yesno' | 'text' | 'select' | 'multi'

export interface ReviewQuestion {
  id: string
  prompt: string
  /** The smaller explanatory line beneath the prompt on the Ninth Brain form. */
  help?: string
  kind: QuestionKind
  /** For 'select' and 'multi'. */
  options?: string[]
  /** Only meaningful for 'yesno'. */
  scoring?: Scoring
  /** A 'multi' or 'select' answer of this value reveals a free-text box. */
  otherOption?: string
  required?: boolean
}

/**
 * When a section appears.
 *
 * Declarative rather than a predicate function so the check script can walk it,
 * and so this file stays serialisable if the question set later becomes
 * administrator-editable the way the skill sheets did.
 */
export type SectionCondition =
  /** Shown when this review type is selected at the top of the form. */
  | { reviewType: ReviewType }
  /** Shown when this CQM review category is ticked. */
  | { category: string }

export interface ReviewSection {
  id: string
  title: string
  intro?: string
  when?: SectionCondition
  questions: ReviewQuestion[]
}

export type ReviewType = 'newhire' | 'cqm'

export const REVIEW_TYPES: { id: ReviewType; label: string }[] = [
  { id: 'newhire', label: 'New Hire' },
  { id: 'cqm', label: 'CQM (Clinical Quality Management)' },
]

/**
 * CQM review categories. Ticking one appends its section to the end of the
 * form, which is how Ninth Brain does it — the category blocks come after the
 * Overall Evaluation, not beside their subject matter.
 */
export const REVIEW_CATEGORIES = [
  'Altered Mental Status',
  'Advanced Airway',
  'Overdose Management',
  'Trauma',
  'Stroke',
  'Cardiac Arrest',
  'Lights and Sirens',
  'STEMI',
  'Other',
] as const

/**
 * Categories whose question block has not been transcribed yet.
 *
 * Ticking one of these still records the category on the review and still
 * counts it in the tally — it simply adds no extra questions. Listed
 * explicitly so check-chart-review.mjs can tell "not yet supplied" from
 * "silently dropped during a paste", which look identical otherwise.
 *
 * Each is removed from this list as its block arrives.
 */
export const CATEGORIES_WITHOUT_SECTIONS: string[] = [
  'Overdose Management',
  'Trauma',
  'Stroke',
  'Cardiac Arrest',
  'Lights and Sirens',
  'STEMI',
]

const yn = (
  id: string,
  prompt: string,
  opts: { help?: string; scoring?: Scoring } = {},
): ReviewQuestion => ({
  id,
  prompt,
  kind: 'yesno',
  scoring: opts.scoring ?? 'yes-good',
  help: opts.help,
  required: true,
})

// ----- the header sections ---------------------------------------------------

const NEW_HIRE: ReviewSection = {
  id: 'newhire',
  title: 'New Hire Review',
  intro: 'These questions determine which sections appear below.',
  when: { reviewType: 'newhire' },
  questions: [
    {
      id: 'nh.phase',
      prompt: 'Employee Phase',
      help: 'Indicate the training phase of the employee. Phase 1: New Hire 100% Review.',
      kind: 'select',
      options: ['Phase 1'],
      required: true,
    },
  ],
}

const CQM: ReviewSection = {
  id: 'cqm',
  title: 'Clinical Quality Management',
  when: { reviewType: 'cqm' },
  questions: [
    {
      id: 'cqm.categories',
      prompt: 'Review Category',
      help: 'A category adds its own question block to the end of the form.',
      kind: 'multi',
      options: [...REVIEW_CATEGORIES],
      otherOption: 'Other',
      required: true,
    },
    yn('cqm.copa', 'Is this part of a CO/PA meeting review?', { scoring: 'flag' }),
    {
      id: 'cqm.setting',
      prompt: 'Scene or IFT',
      kind: 'select',
      options: ['911 (Scene)', 'Interfacility (IFT)'],
      required: true,
    },
    {
      id: 'cqm.careLevel',
      prompt: 'Responding Unit Care Level',
      kind: 'select',
      options: ['BLS', 'ALS', 'Critical Care', 'Other'],
      otherOption: 'Other',
    },
  ],
}

// ----- the common backbone ---------------------------------------------------
//
// Every review answers these twenty-one, whichever type it is.

const DEMOGRAPHICS: ReviewSection = {
  id: 'demographics',
  title: 'Demographics',
  questions: [
    yn('dem.locations', 'Are the Incident Location and Destination Location recorded correctly?', {
      help: 'Are the locations specific and not generalizations?',
    }),
    yn(
      'dem.destinationRationale',
      'Is there clear documentation to support why the patient was transported to the destination facility?',
    ),
    yn('dem.appropriateFacility', 'Was the patient transported to an appropriate receiving facility?'),
    yn(
      'dem.contact',
      "Were the patient's phone number (preferably cell phone number) and email address included in the PCR?",
    ),
    yn('dem.signatures', 'Did all crew members sign the PCR?', {
      help: 'Ninth Brain defaults this to Yes during development; answer it for real here.',
    }),
  ],
}

const ASSESSMENT: ReviewSection = {
  id: 'assessment',
  title: 'Assessment and Exam',
  questions: [
    yn('asm.reasonSupported', 'Is the Reason for Transport supported by the documented physical exam?'),
    yn('asm.history', 'Is the Patient History documented in the Patient History section?'),
    yn(
      'asm.monitoring',
      'Is there documentation that the patient was appropriately monitored during transport?',
    ),
    yn(
      'asm.examMatches',
      'Does the documented exam and treatment match the documented Reason for Transport?',
    ),
  ],
}

const TREATMENT: ReviewSection = {
  id: 'treatment',
  title: 'Treatment / Procedures / Medications',
  questions: [
    yn(
      'trt.standards',
      'Were the actions/decisions made within the local standards of care/clinical practice guidelines?',
    ),
    yn('trt.timely', "Were the actions/decisions timely given the patient's condition/complaint?"),
    yn('trt.procedures', 'Were all procedures documented in the Treatment and Response section?', {
      help: 'If there were no procedures, select Yes.',
    }),
    yn(
      'trt.medications',
      'Were all medications, including those given by other caregivers, documented in the Medications Section?',
      { help: 'If there were no medications, select Yes.' },
    ),
    yn('trt.assessmentFields', 'Were additional assessment fields used to support the reason for transport?', {
      help: 'Were the Physical Assessment fields used correctly? Were AVPU/GCS used when appropriate? Were neuro assessments used for CVA/stroke chief complaints?',
    }),
    yn('trt.mode', 'Was the mode of transport (air, ground etc) appropriate for patient condition?'),
  ],
}

const OVERALL: ReviewSection = {
  id: 'overall',
  title: 'Overall Evaluation',
  questions: [
    yn(
      'ovr.narrativeMatches',
      'Does the narrative documentation match the documented assessments, treatments, and procedures?',
    ),
    yn(
      'ovr.narrativeClear',
      'Is the narrative documentation clear, concise, and supports the reason the patient needed to be transported by ambulance?',
    ),
    yn(
      'ovr.safeDecisions',
      "Were the clinical decisions/interventions safe and appropriate given the patient's presentation and the situation necessitating transport?",
    ),
    // The three below invert. A Yes here is a finding, not a pass.
    yn(
      'ovr.nearMiss',
      'Were there any near misses, errors, and/or patient events that should be reported in Baldwin?',
      { scoring: 'no-good' },
    ),
    yn('ovr.safetyConcerns', 'Are there any additional safety concerns with this transport?', {
      scoring: 'no-good',
    }),
    yn('ovr.escalate', 'Does this chart need further review by clinical leadership?', {
      scoring: 'flag',
      help: 'A routing decision, not a failure. Counted and listed, never scored.',
    }),
  ],
}

// ----- category blocks -------------------------------------------------------
//
// Appended after the Overall Evaluation, one per ticked CQM category.

const CATEGORY_SECTIONS: ReviewSection[] = [
  {
    id: 'cat.ams',
    title: 'Altered Mental Status Review',
    when: { category: 'Altered Mental Status' },
    questions: [
      yn('ams.glucose', 'Blood Glucose Measurement Documented'),
      yn('ams.narcan', 'Narcan Administration Considered', {
        help: 'If opioid overdose was suspected/known, was Narcan considered during treatment?',
      }),
      yn('ams.oxygen', 'Oxygen Administered or Airway Managed'),
    ],
  },
  {
    id: 'cat.airway',
    title: 'Advanced Airway Review',
    when: { category: 'Advanced Airway' },
    questions: [
      yn('aw.placement', 'Verification of Placement'),
      yn('aw.capnography', 'Waveform Capnography'),
      yn('aw.restraints', 'Were soft wrist restraints placed on patient with advanced airway?'),
    ],
  },
]

/** Every section, in the order the form presents them. */
export const REVIEW_SECTIONS: ReviewSection[] = [
  NEW_HIRE,
  CQM,
  DEMOGRAPHICS,
  ASSESSMENT,
  TREATMENT,
  OVERALL,
  ...CATEGORY_SECTIONS,
]

export const ALL_QUESTIONS: ReviewQuestion[] = REVIEW_SECTIONS.flatMap((s) => s.questions)

const QUESTION_BY_ID = new Map(ALL_QUESTIONS.map((q) => [q.id, q]))

export function question(id: string): ReviewQuestion | undefined {
  return QUESTION_BY_ID.get(id)
}

/** Answers keyed by question id. Yes/No are booleans; the rest are strings. */
export type ReviewAnswers = Record<string, boolean | string | string[] | undefined>

/**
 * The sections a review actually shows, given what has been selected so far.
 *
 * An unconditional section is always in. A `reviewType` section needs that type
 * ticked at the top; a `category` section needs that category ticked under CQM
 * — and CQM itself ticked, since the categories are meaningless without it.
 */
export function visibleSections(types: ReviewType[], categories: string[]): ReviewSection[] {
  return REVIEW_SECTIONS.filter((s) => {
    if (!s.when) return true
    if ('reviewType' in s.when) return types.includes(s.when.reviewType)
    return types.includes('cqm') && categories.includes(s.when.category)
  })
}

/** Every question a review is expected to answer, in form order. */
export function visibleQuestions(types: ReviewType[], categories: string[]): ReviewQuestion[] {
  return visibleSections(types, categories).flatMap((s) => s.questions)
}

/**
 * Whether an answer is the compliant one.
 *
 * Returns undefined for anything not scored: unanswered questions, non-Yes/No
 * questions, and the flags. A tally that treated those as failures would report
 * an unfinished review as a bad one.
 */
export function isCompliant(q: ReviewQuestion, answer: unknown): boolean | undefined {
  if (q.kind !== 'yesno' || typeof answer !== 'boolean') return undefined
  if (q.scoring === 'flag') return undefined
  return q.scoring === 'no-good' ? answer === false : answer === true
}
