import type { TrainingCase } from './types'

// ---------------------------------------------------------------------------
// Case bank (brief §5). Fictional teaching cases — not patient records. Names,
// facilities, times and values are invented; nothing here was derived from a
// real chart, and nothing real may be pasted in.
//
// K01, K02, K03, K07, K08 and K12 are fully authored: vignette, structured
// fields, timeline, expected issues, distractors and reviewer key. The rest
// carry the seed facts and the required answer direction, and the chart lab
// lists them as "seed — vignette not yet written".
//
// A case whose right answer depends on a policy nobody has supplied carries
// pendingSourceIds; the lab then ends in "clarification needed" rather than a
// definitive legal or payer answer.
// ---------------------------------------------------------------------------

const seed = (
  id: string,
  title: string,
  lessonIds: string[],
  seedText: string,
  learnerTask: string,
  answerDirection: string,
): TrainingCase => ({
  id,
  title,
  lessonIds,
  seed: seedText,
  learnerTask,
  answerDirection,
  authored: false,
  knownFacts: [],
  unknownFacts: [],
  expectedIssues: [],
  distractors: [],
  forbiddenInferences: [],
  reviewerRubric: [],
})

export const CASES: TrainingCase[] = [
  {
    id: 'K01',
    title: 'Everything is normal',
    lessonIds: ['C02'],
    seed: 'Narrative describes inability to maintain sitting balance and a known limb deficit; the examination is globally normal.',
    learnerTask: 'Identify the contradictory fields and write a clarification request.',
    answerDirection: 'Reconcile only the findings actually assessed. Do not assume the narrative or the checkboxes are right.',
    authored: true,
    knownFacts: [
      '78-year-old discharged from an acute rehab unit to a long-term care facility.',
      'Prior stroke with residual right-sided weakness, per the sending RN.',
      'Crew documented a full structured exam using the default-normal template.',
    ],
    unknownFacts: [
      'Which exam components the crew actually performed.',
      'Whether the patient can bear weight or transfer.',
    ],
    narrative:
      'Dispatched for nonemergency transfer, rehab unit to LTC. Pt found supine in bed, awake, follows commands. Per sending RN, pt has R-sided weakness from prior CVA and requires 2-person assist for transfers. Pt unable to maintain sitting balance when sat at edge of bed — leaned to R and required crew support. Moved to stretcher via draw sheet with 3 assist. Transported supine, HOB 30°, without change. Report given to receiving RN.',
    structuredFields: {
      'Mental status': 'Alert, oriented ×4',
      'Neuro exam': 'Normal — no focal deficits',
      'Extremities': 'Normal — moves all extremities equally',
      'Musculoskeletal': 'Normal',
      'Vitals 1 (1032)': 'BP 138/78 · HR 76 · RR 16 · SpO2 96% RA',
      'Vitals 2 (1058)': 'BP 134/80 · HR 74 · RR 16 · SpO2 96% RA',
      'Disposition': 'Transported, no change',
    },
    timeline: [
      { time: '1015', event: 'Dispatched' },
      { time: '1030', event: 'At patient' },
      { time: '1046', event: 'Depart sending facility' },
      { time: '1104', event: 'At destination; transfer of care 1112' },
    ],
    expectedIssues: [
      {
        id: 'neuro_conflict',
        label: 'Neuro exam "no focal deficits" contradicts the documented right-sided weakness',
        explanation: 'The narrative reports a focal deficit. A normal neuro field and a focal deficit cannot both be true; ask what was assessed.',
        sourceIds: ['R14'],
      },
      {
        id: 'extremity_conflict',
        label: '"Moves all extremities equally" contradicts the weakness and loss of sitting balance',
        explanation: 'This is the default-normal template disagreeing with the crew’s own observation.',
        sourceIds: ['R14'],
      },
      {
        id: 'attribution',
        label: 'The weakness is attributed to the sending RN, but it is unclear whether the crew assessed strength itself',
        explanation: 'Outside history is attributed correctly. The clarification should establish what the crew itself examined.',
        sourceIds: ['R09'],
      },
    ],
    distractors: [
      {
        id: 'mark_all_abnormal',
        label: 'All exam categories should be changed to abnormal',
        explanation: 'An abnormal narrative does not justify marking every category abnormal. Mental status, for example, was not described as abnormal.',
        sourceIds: ['R14'],
      },
      {
        id: 'vitals_missing',
        label: 'The chart is missing a second set of vital signs',
        explanation: 'Two sets are documented (1032 and 1058).',
        sourceIds: [],
      },
    ],
    forbiddenInferences: [
      'That the narrative is correct and the fields are simply wrong — ask.',
      'That the patient is bed-confined. Sitting balance alone does not establish the three elements.',
    ],
    reviewerRubric: [
      'Names both field contradictions specifically.',
      'Asks what was assessed rather than prescribing the answer.',
      'Does not supply findings.',
    ],
  },
  {
    id: 'K02',
    title: 'Home to inpatient hospice',
    lessonIds: ['C06'],
    seed: 'Hospice patient moved from home to an inpatient unit for symptom management; election date and payment arrangement missing.',
    learnerTask: 'Build a missing-information list and a documentation plan.',
    answerDirection: 'Clinical transport rationale plus hospice/billing coordination; no automatic PCS demand or payment promise.',
    authored: true,
    knownFacts: [
      '84-year-old with metastatic lung cancer, enrolled with a hospice, per the spouse.',
      'Hospice nurse called for transport to the hospice’s inpatient unit for uncontrolled pain and dyspnea.',
      'Pt moans with any movement; dyspneic at rest.',
    ],
    unknownFacts: [
      'Effective date of hospice election.',
      'Whether the hospice arranged and is responsible for the transport.',
      'Whether the destination is a hospice inpatient unit within a hospital or a freestanding facility.',
    ],
    narrative:
      'Called by hospice RN for transport from home to inpatient hospice unit. Pt found in hospital bed in living room, moaning with movement, RR 28, speaking 2–3 words. Spouse states pt has been "on hospice for a while". DNR form present, reviewed. Pt moved to stretcher by sheet with 3 assist; pt unable to sit up or bear weight. O2 2 L NC continued. Transported without incident.',
    structuredFields: {
      'Chief complaint': 'Pain, dyspnea',
      'Hospice': 'Yes',
      'Hospice election date': '—',
      'Destination type': 'Hospital',
      'Pain score': '—',
      'Vitals 1 (1410)': 'BP 102/64 · HR 112 · RR 28 · SpO2 91% 2 L',
      'Vitals 2 (1438)': 'BP 100/60 · HR 110 · RR 26 · SpO2 92% 2 L',
      'Payment': 'Medicare',
    },
    timeline: [
      { time: '1350', event: 'Dispatched (request from hospice RN)' },
      { time: '1405', event: 'At patient' },
      { time: '1425', event: 'Depart residence' },
      { time: '1446', event: 'At destination; transfer of care 1452' },
    ],
    expectedIssues: [
      {
        id: 'election_missing',
        label: 'Hospice election date and the hospice’s name or arrangement are not recorded',
        explanation: 'Billing needs them to route responsibility. Transports related to the terminal illness after the election date are generally the hospice’s (BPM ch. 9, §40.1.9).',
        sourceIds: ['R12'],
      },
      {
        id: 'relatedness',
        label: 'Whether the trip relates to the terminal illness is not stated, or is stated without a source',
        explanation: 'Record the purpose as reported and by whom (the hospice RN). The crew does not decide coverage.',
        sourceIds: ['R12'],
      },
      {
        id: 'destination_type',
        label: '"Hospital" is recorded as the destination type without confirming what the facility actually is',
        explanation: 'A hospice inpatient unit is not automatically a hospital destination. Record the actual setting and let billing classify it.',
        sourceIds: ['R03', 'R12'],
      },
      {
        id: 'pain_score',
        label: 'Pain is the reason for transport, but no pain assessment is recorded',
        explanation: 'The clinical rationale needs the finding that drove the trip.',
        sourceIds: ['R03'],
      },
    ],
    distractors: [
      {
        id: 'pcs_required',
        label: 'The crew must obtain a PCS before leaving',
        explanation: 'This is not a repetitive scheduled transport, and the family cannot provide one. Whether any certification applies is billing’s routing question.',
        sourceIds: ['R02'],
      },
      {
        id: 'less_documentation',
        label: 'Less documentation is needed because the hospice is responsible',
        explanation: 'Hospice enrollment does not eliminate assessment or documentation.',
        sourceIds: ['R12'],
      },
    ],
    forbiddenInferences: [
      'That Medicare Part B will or will not pay.',
      'That the "same-day exception" applies — the election date is unknown.',
    ],
    reviewerRubric: [
      'Missing-information list includes the election date, the hospice, relatedness and the actual destination type.',
      'Keeps the clinical rationale (dyspnea at rest, unable to sit or bear weight) in the plan.',
      'Makes no coverage promise.',
    ],
    pendingSourceIds: ['LP05'],
  },
  {
    id: 'K03',
    title: '"Bedbound" but sitting',
    lessonIds: ['C03'],
    seed: 'The PCS says bedbound; the crew observes the patient sitting in a wheelchair.',
    learnerTask: 'Evaluate the inconsistency.',
    answerDirection: 'Clarify function and other transport needs; one fact is neither automatic approval nor automatic denial.',
    authored: true,
    knownFacts: [
      'Scheduled nonrepetitive transport, SNF to outpatient wound clinic.',
      'PCS signed by the attending physician, checkbox "bed confined".',
      'Crew found pt sitting in a wheelchair at the nurses’ station.',
    ],
    unknownFacts: [
      'Whether the patient can stand or walk.',
      'How long the patient tolerates sitting, and whether the wound limits positioning.',
    ],
    narrative:
      'Pt found sitting in wheelchair at nurses’ station. Sacral wound dressing in place per staff. Pt transferred wheelchair to stretcher with 1 assist, stand-pivot. Pt states sitting "hurts my bottom after a while." Transported lying on L side per pt preference. PCS on file indicates bed confined.',
    structuredFields: {
      'Bed confined': 'Yes',
      'Ambulatory status': 'Non-ambulatory',
      'Mobility': '—',
      'Wound': 'Sacral, dressed — not visualized',
      'Vitals 1 (0915)': 'BP 128/72 · HR 84 · RR 16 · SpO2 97% RA',
      'Vitals 2 (0940)': 'BP 126/70 · HR 82 · RR 16 · SpO2 97% RA',
    },
    timeline: [
      { time: '0900', event: 'At patient' },
      { time: '0920', event: 'Depart SNF' },
      { time: '0942', event: 'At clinic; transfer of care 0948' },
    ],
    expectedIssues: [
      {
        id: 'bed_confined_conflict',
        label: '"Bed confined: Yes" conflicts with the crew’s observation of the patient sitting in a wheelchair',
        explanation: 'Bed-confined requires all three elements, including inability to sit in a chair or wheelchair. The crew documents what it observed; the PCS does not override it.',
        sourceIds: ['R02'],
      },
      {
        id: 'stand_pivot',
        label: 'A stand-pivot transfer is recorded, but "non-ambulatory" is not explained',
        explanation: 'Describe what the patient can and cannot do — how far, with what assistance.',
        sourceIds: ['R03'],
      },
      {
        id: 'other_need',
        label: 'Sitting tolerance and the sacral wound, a possible positioning need, are not described',
        explanation: 'The actual transport need may be positioning or pressure-related. Ask for the facts that would show it.',
        sourceIds: ['R03', 'R04'],
      },
    ],
    distractors: [
      {
        id: 'deny',
        label: 'The transport was not medically necessary',
        explanation: 'One fact is not a denial. Insufficient information is the honest call until function and positioning are described.',
        sourceIds: ['R03'],
      },
      {
        id: 'pcs_settles',
        label: 'The signed PCS settles medical necessity',
        explanation: 'A signed certification does not alone demonstrate necessity.',
        sourceIds: ['R02'],
      },
    ],
    forbiddenInferences: ['That the patient is bed-confined.', 'That the patient could safely travel by wheelchair van.'],
    reviewerRubric: [
      'Flags the bed-confined field against the observation.',
      'Asks about sitting tolerance, the wound and positioning rather than concluding.',
      'Does not suggest documenting "bedbound".',
    ],
  },
  seed(
    'K04',
    'Routine discharge',
    ['C03'],
    'A discharged patient walks independently, has no stated monitoring need, and the family has no car.',
    'Identify whether the stated facts support ambulance necessity.',
    'Social inconvenience alone does not supply a clinical rationale; use the local escalation process.',
  ),
  seed(
    'K05',
    'Stable ventilator transfer',
    ['C04', 'L04'],
    'No deterioration during the transfer; the chart omits settings, airway checks, monitoring and the care performed.',
    'Identify the missing clinical documentation.',
    'A stable outcome does not erase support needs. Document the observed care and refer the service-level question for review.',
  ),
  seed(
    'K06',
    'Infusion handoff',
    ['C04', 'L04'],
    'Transfer paperwork and the pump display disagree on concentration and rate.',
    'Identify the safety and documentation concerns.',
    'Escalate the clinical discrepancy. Document verification, actions, communication and response without guessing.',
  ),
  {
    id: 'K07',
    title: 'GCS and AVPU mismatch',
    lessonIds: ['C02', 'C08'],
    seed: 'GCS 15, AVPU verbal, narrative says baseline drowsiness; no structured glucose entry.',
    learnerTask: 'Apply the approved assessment and ePCR policy.',
    answerDirection: 'Establish the actual status and assessments; do not change a score just to clear a validation message.',
    authored: true,
    knownFacts: [
      '81-year-old SNF resident to ED for evaluation of "increased sleepiness" per facility.',
      'Facility reports pt is "usually drowsy in the afternoon".',
    ],
    unknownFacts: [
      'The patient’s actual eye, verbal and motor responses.',
      'Whether a glucose was checked.',
      'What the facility means by baseline, and who said it.',
    ],
    narrative:
      'Pt found in bed, eyes closed, opens eyes to voice, answers name but not date or place. Per facility, pt is at baseline drowsiness. No acute distress. Moved to stretcher with 2 assist. Transported without change.',
    structuredFields: {
      'GCS': '15 (E4 V5 M6)',
      'AVPU': 'Verbal',
      'Orientation': 'Oriented ×1',
      'Blood glucose': '— (validation warning overridden)',
      'Vitals 1 (1522)': 'BP 146/82 · HR 88 · RR 18 · SpO2 95% RA',
      'Vitals 2 (1550)': 'BP 144/80 · HR 86 · RR 18 · SpO2 95% RA',
    },
    timeline: [
      { time: '1510', event: 'At patient' },
      { time: '1530', event: 'Depart SNF' },
      { time: '1552', event: 'At ED; transfer of care 1558' },
    ],
    expectedIssues: [
      {
        id: 'gcs_avpu',
        label: 'GCS 15 (E4 V5) conflicts with AVPU "Verbal", eyes opening to voice, and orientation ×1',
        explanation: 'Eyes opening to voice is E3, and oriented to name only is not V5. The record contradicts itself on mental status.',
        sourceIds: ['R14'],
      },
      {
        id: 'baseline_attribution',
        label: '"Baseline drowsiness" is reported without naming who said it or what the baseline is',
        explanation: 'Attribute it (which staff member) and describe the baseline if it is known.',
        sourceIds: ['R09'],
      },
      {
        id: 'glucose',
        label: 'Altered mental status with no glucose documented and the validation warning overridden',
        explanation: 'Whether glucose was required is local protocol (pending). Either way, the chart must say whether it was obtained and, if not, why.',
        sourceIds: ['R14', 'LP03'],
      },
    ],
    distractors: [
      {
        id: 'change_gcs',
        label: 'Change GCS to 14 so the fields agree',
        explanation: 'Picking a number to make fields agree is not establishing status. Ask the author what the patient did.',
        sourceIds: ['R09'],
      },
      {
        id: 'baseline_ok',
        label: 'Baseline drowsiness means no further assessment was needed',
        explanation: 'The transport is for increased sleepiness. A reported baseline is context, not a reason to stop assessing.',
        sourceIds: ['R09'],
      },
    ],
    forbiddenInferences: ['A specific GCS value — only the author can supply what was observed.', 'That a glucose was checked.'],
    reviewerRubric: [
      'Identifies the internal contradiction specifically.',
      'Asks for the observed responses rather than a corrected number.',
      'Treats the glucose rule as local policy pending.',
    ],
    pendingSourceIds: ['LP03'],
  },
  {
    id: 'K08',
    title: 'Cannot sign',
    lessonIds: ['C05'],
    seed: 'Patient cannot physically sign; spouse present; form lacks an explanation and the signer’s relationship.',
    learnerTask: 'Select the appropriate claim-signature workflow.',
    answerDirection: 'Document the incapacity and verify an authorized signer under the applicable rule.',
    authored: true,
    knownFacts: [
      'Pt with severe rheumatoid arthritis and hand contractures, alert and oriented.',
      'Spouse rode along and arranged the appointment.',
      'Claim authorization shows a signature in the patient box, with no explanation and no relationship recorded.',
    ],
    unknownFacts: ['Who actually signed.', 'Whether the patient could make a mark.', 'The signer’s relationship to the patient.'],
    narrative:
      'Scheduled transport home to rheumatology clinic. Pt A&O×4, unable to grip pen due to contractures. Signature obtained. Spouse accompanied pt.',
    structuredFields: {
      'Patient signature': 'Signed',
      'Reason patient unable to sign': '—',
      'Authorized representative': '—',
      'Relationship': '—',
      'Consent to treat': 'Verbal, patient',
    },
    expectedIssues: [
      {
        id: 'who_signed',
        label: 'The signature is in the patient box, but the narrative says the patient could not grip a pen',
        explanation: 'The record must show who signed. If someone signed the patient’s name, that is not an authorized pathway.',
        sourceIds: ['R07'],
      },
      {
        id: 'reason_missing',
        label: 'The reason the patient could not sign is not recorded on the form',
        explanation: 'The representative and exception pathways both depend on documenting why the patient could not sign.',
        sourceIds: ['R07'],
      },
      {
        id: 'relationship_missing',
        label: 'The representative’s name and relationship are not recorded',
        explanation: 'A relative who arranges treatment may qualify under 42 CFR 424.36(b). Record who they are.',
        sourceIds: ['R07'],
      },
    ],
    distractors: [
      {
        id: 'consent_enough',
        label: 'Verbal consent to treat covers the claim authorization',
        explanation: 'Consent to treat is clinical. Claim authorization is a separate signature for a separate purpose.',
        sourceIds: ['R07'],
      },
      {
        id: 'crew_sign',
        label: 'The crew should sign under the ambulance exception',
        explanation: 'The (b)(6) exception applies when no authorized representative is available or willing. Here the spouse was present.',
        sourceIds: ['R07'],
      },
    ],
    forbiddenInferences: ['That the spouse signed.', 'That a patient mark was attempted.'],
    reviewerRubric: [
      'Separates consent from claim authorization.',
      'Identifies the representative pathway and the documentation it needs.',
      'Would not instruct an unauthorized person to sign (critical error).',
    ],
    pendingSourceIds: ['LP04'],
  },
  seed(
    'K09',
    'Repetitive dialysis',
    ['C06'],
    'Repeated scheduled trips; the certification is old; daily function varies.',
    'Identify the scheduling, authorization and encounter-specific evidence needs.',
    'Route certification/authorization problems; do not copy the prior trip’s condition.',
  ),
  seed(
    'K10',
    'Distant destination',
    ['C04'],
    'A closer facility exists; the sending team cites an unavailable specialist service.',
    'Explain what needs documenting.',
    'Record the required service, capability/availability information, its source, and the destination rationale.',
  ),
  seed(
    'K11',
    'Declines one intervention',
    ['C07'],
    'Patient accepts transport but declines a recommended assessment.',
    'Document the partial refusal.',
    'Describe the assessment offered, the explanation, the response, alternatives, consultation and reassessment under local policy.',
  ),
  {
    id: 'K12',
    title: 'Chart signed yesterday',
    lessonIds: ['C01'],
    seed: 'The author notices a mistaken medication time after finalization.',
    learnerTask: 'Correct the record.',
    answerDirection: 'Preserve the original and use a dated, attributable amendment; route any care issue separately.',
    authored: true,
    knownFacts: [
      'Interfacility transfer finalized yesterday at 1730.',
      'Ondansetron 4 mg IV documented at 1421; the author is certain it was given at 1412, before departure.',
      'No adverse effect.',
    ],
    unknownFacts: [],
    narrative:
      '… Pt nauseated at sending facility; ondansetron 4 mg IV given. Nausea resolved by departure at 1418. …',
    structuredFields: {
      'Medication': 'Ondansetron 4 mg IV',
      'Time given': '1421',
      'Departure': '1418',
      'Finalized': 'Yesterday 1730 by author',
    },
    timeline: [
      { time: '1405', event: 'At patient' },
      { time: '1412', event: 'Ondansetron given (author’s recollection)' },
      { time: '1418', event: 'Depart sending facility' },
      { time: '1421', event: 'Ondansetron (as documented)' },
    ],
    expectedIssues: [
      {
        id: 'time_conflict',
        label: 'The medication time (1421) falls after departure (1418), although the narrative says it was given before',
        explanation: 'The record contradicts itself, and the author has identified the error.',
        sourceIds: ['R09'],
      },
      {
        id: 'amendment',
        label: 'Correct it with an amendment that is labeled, dated today, signed by the author, and keeps 1421 visible',
        explanation: 'PIM ch. 3, §3.3.2.5: identified as an amendment, dated and authored, original content preserved.',
        sourceIds: ['R09'],
      },
    ],
    distractors: [
      {
        id: 'overwrite',
        label: 'Overwrite 1421 with 1412 — the error is minor',
        explanation: 'A silent overwrite is a critical integrity error, whatever the size of the change.',
        sourceIds: ['R09'],
      },
      {
        id: 'backdate',
        label: 'Date the amendment yesterday so it matches the chart',
        explanation: 'Backdating is a critical error. The amendment is dated when it is made.',
        sourceIds: ['R09'],
      },
      {
        id: 'incident',
        label: 'File a medication error report',
        explanation: 'The drug, dose and route were right; only the documented time was wrong. Route a care issue separately only if one exists.',
        sourceIds: [],
      },
    ],
    forbiddenInferences: ['That a care error occurred.'],
    reviewerRubric: ['Amendment shows date, author and the original value.', 'No backdating or overwrite.'],
  },
  seed(
    'K13',
    'Trip canceled',
    ['C07'],
    'The crew assesses the patient; the transport is canceled before loading.',
    'Select the actual disposition and complete the record.',
    'Record the encounter and outcome. Do not imply a transport or automatically apply transport billing.',
  ),
  seed(
    'K14',
    'Same-campus transfer',
    ['C04', 'L04'],
    'Movement between buildings within a hospital campus.',
    'Identify the billing-review flag.',
    'Document locations and care; route the institutional/bundling issue instead of assuming a separate Part B trip.',
  ),
  seed(
    'K15',
    'Coaching under pressure',
    ['L02', 'L04'],
    'A reviewer says "add bedbound so we can bill"; the provider recalls assisted walking.',
    'Write a neutral response and escalation.',
    'Preserve truthful findings; clarify facts without coaching toward a claim result.',
  ),
  seed(
    'K16',
    'Reviewer disagreement',
    ['L01'],
    'Two FTOs score the same chart differently.',
    'Cite evidence and reconcile the scores.',
    'Agree on observable criteria and record unresolved questions rather than averaging away a critical issue.',
  ),
]

export const CASE_BY_ID: Record<string, TrainingCase> = Object.fromEntries(CASES.map((c) => [c.id, c]))

/** Built first: they exercise the most reusable workflow patterns (brief §5). */
export const PRIORITY_CASE_IDS = ['K01', 'K02', 'K03', 'K07', 'K08', 'K12']
