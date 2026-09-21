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
  /**
   * Review types this question is NOT asked on, although its section is shown.
   *
   * The alternative was a Refusal section carrying its own copies of the
   * questions that still apply — and a second 'was the history documented'
   * under a second id splits the tally in two, which is the one thing the
   * outcome questions were pulled out of Overall Evaluation to avoid. A
   * refusal is a patient-care review with four questions that have no subject:
   * there is no destination to justify, no facility to have been appropriate,
   * no ride to be monitored during and no transport mode to have suited the
   * patient.
   */
  notForTypes?: ReviewType[]
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

export type ReviewType = 'newhire' | 'cqm' | 'nopatient' | 'nonpatient' | 'refusal' | 'necessity'

export const REVIEW_TYPES: { id: ReviewType; label: string; note?: string }[] = [
  { id: 'newhire', label: 'New Hire' },
  { id: 'cqm', label: 'CQM (Clinical Quality Management)' },
  {
    id: 'nopatient',
    label: 'No Patient Contact',
    note: 'A call cleared without a patient — cancelled, no patient found, refusal before assessment.',
  },
  {
    id: 'necessity',
    label: 'Medical Necessity (MNC)',
    note: 'Ticked alongside another type, not instead of it. A non-emergent interfacility transport billed to Medicare has to be certified as medically necessary, and nothing upstream checks that the certification says what the chart says.',
  },
  {
    id: 'refusal',
    label: 'Refusal',
    note: 'A patient who was assessed and declined transport. The chart is judged on capacity, risks, alternatives and the signature — not on a transport that never happened.',
  },
  {
    id: 'nonpatient',
    label: 'Non-Patient Transport',
    note: 'A transport with nobody to assess — a flight crew returned to the airport, an organ, a standby. It ran, it has a destination and it has mileage.',
  },
]

/**
 * Types that review actual patient care, and so get the full backbone.
 *
 * A refusal is one of them. The patient was assessed, and the exam, the
 * history, the standards of care and the narrative are all reviewable — it is
 * only the four questions about a transport that have no subject, and those
 * are withheld per question rather than by leaving the sections out.
 */
export const PATIENT_CARE_TYPES: ReviewType[] = ['newhire', 'cqm', 'refusal']

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
    {
      ...yn(
        'dem.destinationRationale',
        'Is there clear documentation to support why the patient was transported to the destination facility?',
      ),
      notForTypes: ['refusal'],
    },
    {
      ...yn('dem.appropriateFacility', 'Was the patient transported to an appropriate receiving facility?'),
      notForTypes: ['refusal'],
    },
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
    {
      ...yn(
        'asm.monitoring',
        'Is there documentation that the patient was appropriately monitored during transport?',
      ),
      notForTypes: ['refusal'],
    },
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
    {
      ...yn('trt.mode', 'Was the mode of transport (air, ground etc) appropriate for patient condition?'),
      notForTypes: ['refusal'],
    },
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

/**
 * A transport with nobody to assess.
 *
 * Written for AMR Kansas City rather than transcribed — Ninth Brain has no
 * block for these, and running them through either of the others reports a
 * fault on every one. They are not No Patient Contact calls: that section is
 * for a run that ended on scene, and it asks why no care was provided. These
 * ran. A flight crew was carried back to the airport, an organ was moved, a
 * unit stood by at an event. There is a destination, there is mileage, there
 * is a bill — and there is no patient, so no vital signs, no exam and no
 * impression were ever going to be recorded.
 *
 * So what is actually reviewable is whether the run itself is documented: does
 * the chart say what was carried and why, do the ends of the trip match the
 * narrative, and are the numbers a claim depends on present.
 */
const NON_PATIENT: ReviewSection = {
  id: 'nonpatient',
  title: 'Non-Patient Transport Review',
  when: { reviewType: 'nonpatient' },
  authored: true,
  intro:
    'A transport with nobody to assess — a flight crew returned to base, an organ, a standby. The patient-care questions are not asked, because there was no patient: answering them Yes to get through the form is how a tally stops meaning anything.',
  questions: [
    yn('npt.purpose', 'Does the narrative say what was transported and why?', {
      help: 'Flight crew returning to base, organ or tissue, equipment, a standby assignment. This is the only place the reason for the trip is recorded.',
    }),
    yn('npt.disposition', 'Is the disposition recorded as a non-patient transport?', {
      help: 'Rather than left as a patient transport or a cancellation, either of which sends the chart to the wrong place downstream.',
    }),
    yn('npt.locations', 'Are the origin and destination both recorded correctly and specifically?'),
    yn('npt.mileage', 'Are the odometer readings and loaded miles recorded?', {
      help: 'A non-patient transport still bills on mileage, and there is no patient record to reconstruct it from afterwards.',
    }),
    yn('npt.times', 'Are the unit times complete — dispatch through back in service?'),
    yn('npt.signatures', 'Did all crew members sign the PCR?'),
    yn('npt.noPatientFields', 'Is the chart free of patient care documented in error?', {
      // The failure worth catching on these: a template or a copied chart that
      // leaves vitals or an impression on a run that had no patient.
      help: 'No vitals, assessments or impressions carried over from another chart. If there is nothing of the kind, select Yes.',
    }),
  ],
}

/**
 * A patient who was assessed and declined transport.
 *
 * Written for AMR Kansas City rather than transcribed — Ninth Brain has no
 * block for these, and a refusal reviewed as an ordinary CQM chart is marked
 * against a destination, a facility and a ride that never happened. It is also
 * the chart most likely to be read by a lawyer: the whole defence of a refusal
 * is that a patient with capacity was told what could happen to them, was
 * offered something else, and decided anyway. None of that is a transport
 * question, and none of it is asked anywhere else on this form.
 */
const REFUSAL: ReviewSection = {
  id: 'refusal',
  title: 'Refusal Review',
  when: { reviewType: 'refusal' },
  authored: true,
  intro:
    'Asked alongside the exam, history and treatment questions, which still apply. The four questions about the transport are not asked: there was none.',
  questions: [
    yn('ref.capacity', 'Is the patient’s capacity to refuse documented?', {
      help: 'Orientation or GCS, and nothing recorded that would impair the decision — intoxication, head injury, hypoglycaemia — or an explanation of why it does not.',
    }),
    yn('ref.risks', 'Does the narrative record the risks of refusing being explained?', {
      help: 'Including death or serious disability where the presentation warrants it. "Advised to seek care" is not a risk.',
    }),
    yn('ref.alternatives', 'Were alternatives offered and documented?', {
      help: 'Other transport, seeing their own doctor, calling back — and what to come back for.',
    }),
    yn('ref.signature', 'Is there a patient signature, or a recorded reason there is none?', {
      help: 'A witness where the patient would not sign.',
    }),
    yn('ref.vitals', 'Is there at least one full set of vital signs, or a documented refusal of them?', {
      help: 'A refusal with no vitals at all is the one that cannot be defended afterwards.',
    }),
    yn('ref.handover', 'Does the narrative say who the patient was left with and where?', {
      help: 'Left alone, with family, with police, at the scene or at home — and their condition when the crew left.',
    }),
  ],
}

/**
 * Medical necessity on a non-emergent interfacility transport.
 *
 * Written for AMR Kansas City. Ninth Brain has no block for it, and neither
 * does Elite: in live testing a non-emergent Medicare hospital-to-SNF transfer
 * fired no rule about the certification at all. That makes this the one
 * clinical check the tool genuinely owns rather than duplicates.
 *
 * The questions are about AGREEMENT, not about paperwork existing. A signed
 * certification saying the patient is bed confined, on a chart whose narrative
 * says they walked to the cot, is worse than a missing one: it is a signed
 * statement contradicted by the record it travels with.
 *
 * Ticked alongside CQM or New Hire rather than instead of them, because a
 * Medicare IFT is still an ordinary chart with an ordinary exam.
 */
const MEDICAL_NECESSITY: ReviewSection = {
  id: 'necessity',
  title: 'Medical Necessity',
  when: { reviewType: 'necessity' },
  authored: true,
  intro:
    'Asked of a non-emergent interfacility transport billed to Medicare. Written here rather than transcribed — neither Ninth Brain nor ImageTrend checks the certification against the chart it travels with.',
  questions: [
    yn('mnc.present', 'Is a Medical Necessity Certification present, complete and signed?', {
      help: 'Section I answered, the condition stated in II.1, an attestation in Section III, and a printed name, credential and date.',
    }),
    yn('mnc.consistent', 'Does the certification agree with the chart?', {
      help: 'A bed-confined claim against a narrative describing the patient ambulating or sitting up; "cardiac monitoring required en route" on a BLS unit; conditions with nothing in the assessment to support them.',
    }),
    yn('mnc.notCarOrVan', 'Does the certification say the patient could NOT go by car or wheelchair van?', {
      help: 'A Yes to the worksheet\u2019s own II.3 defeats necessity — answer No here if the worksheet says the patient could have gone by van.',
      scoring: 'yes-good',
    }),
    yn('mnc.narrative', 'Does the narrative say why an ambulance was required rather than a van?', {
      help: 'In the crew\u2019s own words, about this patient on this day. The certification is the physician\u2019s statement; this is the record of what the crew found.',
    }),
    yn('mnc.signature', 'Is the signature valid for this kind of transport?', {
      help: 'Scheduled repetitive transports need an MD or DO signature dated within 60 days before the service. Unscheduled ones may be signed after, within 48 hours, and after 21 days the attempts to obtain it must be documented.',
    }),
    yn('mnc.aba', 'Is the patient (or representative) Authorized Billing Agreement in order?', {
      help: 'Signed, or — where the patient could not sign — a representative\u2019s signature with witness name and title, and the certification\u2019s second attestation answered.',
    }),
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
    // Counted, never scored. Lights-and-sirens use carries crash risk and is
    // reported on, so the numbers matter — but a No is the GOOD answer here as
    // often as not, and scoring it either way turns every properly run
    // non-emergent transport into a finding on the crew's record.
    questions: [
      yn('ls.respond', 'Did the crew respond to the call Lights and Sirens?', { scoring: 'flag' }),
      yn('ls.transport', 'Did the crew transport Lights and Sirens?', { scoring: 'flag' }),
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
  NON_PATIENT,
  DEMOGRAPHICS,
  ASSESSMENT,
  TREATMENT,
  MEDICAL_NECESSITY,
  REFUSAL,
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

/**
 * The questions of one section that this review is actually asked.
 *
 * Everything that counts a question — the form, the tally, the export, the
 * unanswered list — goes through here or through visibleQuestions(), so a
 * question withheld from a review type is withheld everywhere at once rather
 * than hidden on screen and still counted in the denominator.
 */
export function sectionQuestions(section: ReviewSection, types: ReviewType[]): ReviewQuestion[] {
  return section.questions.filter((q) => !q.notForTypes?.some((t) => types.includes(t)))
}

/** Every question a review is expected to answer, in form order. */
export function visibleQuestions(types: ReviewType[], categories: string[]): ReviewQuestion[] {
  return visibleSections(types, categories).flatMap((s) => sectionQuestions(s, types))
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
