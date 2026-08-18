// ---------------------------------------------------------------------------
// The chart review questionnaire, transcribed from the Ninth Brain Suite form
// it replaces.
//
// Kept as data rather than JSX so the question set is one reviewable list. The
// form in Ninth Brain grows a section at a time as review categories are added,
// and every one of those is an edit to this file and nothing else.
//
// THIS IS A DOCUMENTATION REVIEW, not a care-quality audit. Every question asks
// whether the chart records something — "Blood Glucose Measurement Documented"
// is worded that way on purpose and the rest read the same way. A No is a
// charting gap, so the compliance percentage measures how completely the crew
// documented, which is the thing a reviewer reading a PCR can actually judge.
//
// That is why the cardiac arrest and lights-and-sirens blocks score like
// everything else. Read as care questions they look unfair — a crew cannot
// cause bystander CPR to have happened — but the reviewer is not asking whether
// it happened, they are asking whether the chart says.
//
// SCORING IS STILL NOT UNIFORM, and this is the part a spreadsheet built by hand
// gets wrong. Most questions are compliant when answered Yes, but three at the
// end of the Overall Evaluation are not:
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
   * A finding or a routing decision. Counted and reported, never scored.
   * "Does this chart need further review by clinical leadership?" is not a
   * failure: a reviewer escalating appropriately is doing the job, and folding
   * it into a percentage punishes them for it.
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
  /**
   * Shown when any of these types is selected. The patient-care backbone uses
   * this: it applies to a new-hire or CQM review but not to a call where no
   * patient was found, which has no destination, exam, treatment or transport
   * to ask about.
   */
  | { anyReviewType: ReviewType[] }
  /** Shown when this CQM review category is ticked. */
  | { category: string }

export interface ReviewSection {
  id: string
  title: string
  intro?: string
  when?: SectionCondition
  /**
   * Written here rather than transcribed from Ninth Brain.
   *
   * Everything else in this file is a copy of a form that already exists, and
   * that provenance is the reason anyone trusts it. A block we wrote is a
   * different kind of thing — defensible, but ours — and it has to be labelled
   * so that whoever later compares this against the real Ninth Brain form knows
   * which questions to expect not to find.
   */
  authored?: boolean
  questions: ReviewQuestion[]
}

export type ReviewType = 'newhire' | 'cqm' | 'nopatient'

export const REVIEW_TYPES: { id: ReviewType; label: string; note?: string }[] = [
  { id: 'newhire', label: 'New Hire' },
  { id: 'cqm', label: 'CQM (Clinical Quality Management)' },
  {
    id: 'nopatient',
    label: 'No Patient Contact',
    note: 'A call cleared without a patient — cancelled, no patient found, refusal before assessment.',
  },
]

/** Types that review actual patient care, and so get the full backbone. */
export const PATIENT_CARE_TYPES: ReviewType[] = ['newhire', 'cqm']

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
export const CATEGORIES_WITHOUT_SECTIONS: string[] = []

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
      // Two values only, by decision. The dropdown came through empty in the
      // Ninth Brain PDF export, so the earlier list here was a guess that also
      // carried Critical Care and Other.
      prompt: 'Responding Unit Care Level',
      kind: 'select',
      options: ['BLS', 'ALS'],
    },
  ],
}

// ----- the common backbone ---------------------------------------------------
//
// Every review answers these twenty-one, whichever type it is.

const DEMOGRAPHICS: ReviewSection = {
  id: 'demographics',
  title: 'Demographics',
  when: { anyReviewType: PATIENT_CARE_TYPES },
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
  when: { anyReviewType: PATIENT_CARE_TYPES },
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
  when: { anyReviewType: PATIENT_CARE_TYPES },
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

const NO_PATIENT: ReviewSection = {
  id: 'nopatient',
  title: 'No Patient Contact Review',
  intro:
    'The patient-care sections are not asked. A call cleared without a patient has no destination, exam, treatment or transport to document, and answering those Yes to get through the form is how a tally stops meaning anything.',
  when: { reviewType: 'nopatient' },
  questions: [
    yn('np.location', 'Is the Incident Location recorded correctly and specifically?', {
      help: 'Specific, not a generalization.',
    }),
    yn('np.disposition', 'Does the recorded crew disposition match what the narrative describes?'),
    yn('np.narrative', 'Does the narrative explain why no patient care was provided?'),
    yn('np.signatures', 'Did all crew members sign the PCR?'),
    yn('np.decisions', 'Were the on-scene decisions appropriate and timely given what the crew found?'),
  ],
}

const OVERALL: ReviewSection = {
  id: 'overall',
  title: 'Overall Evaluation',
  when: { anyReviewType: PATIENT_CARE_TYPES },
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
  ],
}

/**
 * Asked on every review, whatever its type.
 *
 * Split out of the Overall Evaluation so a no-patient-contact call still gets
 * asked them under the SAME question ids. Duplicating them per review type
 * would split the near-miss count across two rows of the tally, which is the
 * one number nobody should have to add up by hand.
 */
const OUTCOME: ReviewSection = {
  id: 'outcome',
  title: 'Review Outcome',
  questions: [
    // The two below invert. A Yes here is a finding, not a pass.
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
  {
    id: 'cat.overdose',
    title: 'Overdose Management Review',
    when: { category: 'Overdose Management' },
    questions: [
      yn('od.alert', 'Is patient alert after Narcan Dose?'),
      yn('od.vitals', 'Were vitals done after administration of narcan?'),
    ],
  },
  {
    id: 'cat.stroke',
    title: 'Stroke Review',
    when: { category: 'Stroke' },
    questions: [
      yn('str.notification', 'Was a prehospital notification done?'),
      yn('str.glucose', 'Was a blood glucose measured?'),
      yn('str.assessment', 'Was an appropriate prehospital stroke assessment done?'),
      yn('str.destination', 'Was the patient transported to the appropriate hospital/stroke designation?'),
      yn('str.lastKnownWell', 'Was a Last Known Well time documented?'),
    ],
  },
  {
    id: 'cat.arrest',
    title: 'Cardiac Arrest Review',
    when: { category: 'Cardiac Arrest' },
    // The Utstein fields. Scored like the rest because the reviewer is judging
    // whether the chart captured them, not whether they happened.
    questions: [
      yn('ca.bystanderCpr', 'Did the patient receive bystander CPR?'),
      yn('ca.aedPrior', 'Was an AED used prior to EMS arrival?'),
      yn('ca.rosc', 'Did the patient get a sustained ROSC?'),
      yn('ca.calledInField', 'Was the patient called in the field?'),
      {
        // The only question on the whole form without an asterisk in Ninth
        // Brain — it is about the dispatcher, and the reviewer may not be able
        // to tell from the PCR.
        id: 'ca.dispatcherCpr',
        prompt: 'Were dispatcher CPR instructions given?',
        kind: 'yesno',
        scoring: 'yes-good',
        required: false,
      },
      yn('ca.itd', 'Was an ITD used?'),
      yn('ca.advancedAirway', 'Was an advanced airway placed?'),
      yn('ca.compressionDevice', 'Was an automatic compression device used?'),
    ],
  },
  {
    id: 'cat.lightsSirens',
    title: 'Lights and Sirens Review',
    when: { category: 'Lights and Sirens' },
    // Whether the chart records the response and transport mode. Lights-and-
    // sirens use carries crash risk and is reported on; an unrecorded mode is
    // the gap, not the mode itself.
    questions: [
      yn('ls.respond', 'Did the crew respond to the call Lights and Sirens?'),
      yn('ls.transport', 'Did the crew transport Lights and Sirens?'),
    ],
  },
  {
    id: 'cat.trauma',
    title: 'Trauma Review',
    when: { category: 'Trauma' },
    authored: true,
    intro:
      'Written for AMR Kansas City rather than transcribed from Ninth Brain, which has not supplied a Trauma block. Modelled on the Stroke and STEMI blocks — assessment, notification, destination — plus the trauma triage fields ImageTrend already carries.',
    questions: [
      yn('tr.triageCriteria', 'Were the trauma triage criteria documented?', {
        // ImageTrend carries "Trauma Triage Criteria (High Risk-Red)" and
        // "(Moderate-Yellow)" as their own fields; both were empty on the stab
        // wound chart. They drive destination, so a blank is a real gap even
        // when no criterion was met.
        help: 'The High Risk (Red) and Moderate (Yellow) criteria fields, whether or not any were met.',
      }),
      yn('tr.mechanism', 'Is the mechanism of injury documented?'),
      yn('tr.assessment', 'Was a full trauma assessment documented?', {
        help: 'Head-to-toe or rapid full-body scan, as the patient’s condition called for.',
      }),
      yn('tr.gcs', 'Was a GCS documented?'),
      yn('tr.hemorrhage', 'Was hemorrhage control documented?', {
        help: 'Where bleeding was present — direct pressure, packing or tourniquet, with the time applied. If there was no bleeding to control, select Yes.',
      }),
      yn('tr.notification', 'Was a prehospital notification or trauma activation done?', {
        help: 'Where the patient met trauma criteria. If they did not, select Yes.',
      }),
      yn('tr.destination', 'Was the patient transported to the appropriate trauma designation?'),
    ],
  },
  {
    id: 'cat.stemi',
    // Titled without "Review" in Ninth Brain, unlike every other block.
    title: 'STEMI',
    when: { category: 'STEMI' },
    questions: [
      yn('stemi.twelveLead', 'Was a 12 Lead done?'),
      yn('stemi.notification', 'Was there a prehospital notification?'),
      yn('stemi.destination', 'Did patient go to a STEMI receiving facility?'),
      yn('stemi.painScale', 'Were pain scales/scores documented appropriately?'),
    ],
  },
]

/** Every section, in the order the form presents them. */
export const REVIEW_SECTIONS: ReviewSection[] = [
  NEW_HIRE,
  CQM,
  NO_PATIENT,
  DEMOGRAPHICS,
  ASSESSMENT,
  TREATMENT,
  OVERALL,
  OUTCOME,
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
    if ('anyReviewType' in s.when) return s.when.anyReviewType.some((t) => types.includes(t))
    return types.includes('cqm') && categories.includes(s.when.category)
  })
}

/** Sections written here rather than transcribed, for the provenance note. */
export const AUTHORED_SECTIONS: ReviewSection[] = REVIEW_SECTIONS.filter((s) => s.authored)

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

/**
 * The answer that means "nothing wrong here", or undefined where there isn't
 * one. Yes for most questions, No for the two that ask whether something went
 * wrong, nothing for the flags and the non-yes/no questions.
 *
 * This is what a bulk "mark the rest compliant" has to read. Filling every
 * unanswered question with Yes would tick the near-miss and safety-concern
 * boxes on every chart, turning a time-saver into a machine for fabricating
 * incident reports.
 */
export function compliantAnswer(q: ReviewQuestion): boolean | undefined {
  if (q.kind !== 'yesno') return undefined
  if (q.scoring === 'flag') return undefined
  return q.scoring !== 'no-good'
}

/** Whether a question contributes to the compliance percentage at all. */
export function isScored(q: ReviewQuestion): boolean {
  return q.kind === 'yesno' && q.scoring !== 'flag'
}
