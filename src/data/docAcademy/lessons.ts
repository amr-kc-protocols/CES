import type { Lesson, RubricDomain, Track } from './types'

// ---------------------------------------------------------------------------
// The agenda (brief §3): a 360-minute common core every track takes, and a
// 120-minute leadership practicum for FTOs, managers and educators.
//
// Every lesson ships as `draft`. The text below is the teaching outline the
// clinical educator, billing/compliance and the medical director review and
// expand — it is written to be accurate as far as it goes and to stop where a
// local policy or an unread source would have to take over. A lesson moves to
// `reviewed` only when everyone in `reviewers` has signed it; the player shows
// the draft banner until then.
// ---------------------------------------------------------------------------

export const COURSE_ID = 'ADRA'
export const COURSE_TITLE = 'Ambulance Documentation & Review Academy'
/** Bumped whenever a scored item or a pass rule changes. Old results keep the version they were earned on. */
export const COURSE_VERSION = '1.0.0-draft'
export const COMPLETION_WORDING = 'Internal training completed'

const ALL: Track[] = ['learner', 'fto', 'manager', 'educator']
const LEAD: Track[] = ['fto', 'manager', 'educator']
const EDU = 'Clinical educator'
const BILL = 'Billing/compliance lead'
const MD = 'Medical director'

export const TRACK_LABEL: Record<Track, string> = {
  learner: 'Field provider',
  fto: 'FTO',
  manager: 'Manager',
  educator: 'Clinical educator',
}

export const LESSONS: Lesson[] = [
  {
    id: 'C00',
    version: '1.0.0',
    title: 'Baseline assessment and orientation',
    minutes: 15,
    tracks: ALL,
    objectives: ['Separate observations, reported information, assumptions and missing facts.'],
    prerequisites: [],
    sourceIds: ['R01', 'R09'],
    caseIds: [],
    questionIds: ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10'],
    activity: 'Ten ungraded baseline questions and one brief chart review.',
    sections: [
      {
        heading: 'What this course is — and is not',
        body: [
          'An internal course on writing and reviewing ambulance records that are accurate, complete and honest about what is unknown. Completion is recorded as "Internal training completed".',
          'It is not CADS certification and is not endorsed by NAAC. CADS is NAAC’s separate credential; its public outline was used only as a benchmark of topics a documentation course should cover.',
        ],
        sourceIds: ['R01'],
      },
      {
        heading: 'The one task the whole course practices',
        body: [
          'Explain what happened, what you found, why the care and the transport were appropriate, and what remains unknown.',
          'A record that merely makes a claim easier to bill is not the goal and scores nothing here. A record that says "not assessed" when that is the truth scores well.',
        ],
        sourceIds: ['R09'],
      },
      {
        heading: 'Four kinds of statement',
        body: [
          'Observed: what you saw, heard, measured or did. Reported: what someone else told you — attribute it ("per the charge RN"). Assumed: what you inferred — say so, or leave it out. Missing: what was not assessed or not known — write that down rather than filling the gap.',
        ],
        sourceIds: ['R09'],
      },
    ],
    approval: 'draft',
    reviewers: [EDU],
  },
  {
    id: 'C01',
    version: '1.0.0',
    title: 'An accurate, defensible record',
    minutes: 30,
    tracks: ALL,
    objectives: [
      'Explain who reads a PCR and what each reader needs from it.',
      'Distinguish a documentation error from absent documentation.',
      'Make a correction that is traceable to its author and date.',
    ],
    prerequisites: ['C00'],
    sourceIds: ['R09', 'R10', 'R11', 'R15'],
    caseIds: ['K12'],
    questionIds: ['Q01', 'Q02', 'Q03', 'Q04'],
    activity: 'Compare an original entry, a legitimate addendum, and an improper overwrite.',
    sections: [
      {
        heading: 'Who reads the record',
        body: [
          'The receiving clinician, who needs the care given and the patient’s course. QA and the medical director, who need to see the reasoning. Billing and auditors, who need the facts that support the transport and its level. And, sometimes, a court. One honest record serves all of them; a record written for any one of them fails the others.',
          'Kansas requires patient care documentation for every request for service and every patient assessed, cared for or transported, and retention for at least three years (K.A.R. 109-2-5 — confirm current text).',
        ],
        sourceIds: ['R10', 'R11', 'R15'],
      },
      {
        heading: 'Error versus absence',
        body: [
          'An error is an entry that is wrong — a time, a dose, a finding. It is fixed by an amendment that leaves the original visible.',
          'An absence is something that happened but was never written down, or something that never happened at all. The first may be added as a late entry, dated now, if you genuinely remember it. The second must stay absent. A reviewer asking for it does not change that.',
        ],
        sourceIds: ['R09'],
      },
      {
        heading: 'What a legitimate correction looks like',
        body: [
          'CMS medical review accepts an amendment, correction or delayed entry only when it is clearly and permanently identified as one, shows the date and author of the change, and leaves all original content identifiable without deletion (PIM ch. 3, §3.3.2.5).',
          'So: never backdate, never silently overwrite, never "tidy" a finalized chart. In the ePCR, use the agency’s addendum workflow (local policy pending).',
        ],
        sourceIds: ['R09'],
      },
    ],
    approval: 'draft',
    reviewers: [EDU, BILL],
  },
  {
    id: 'C02',
    version: '1.0.0',
    title: 'Narrative and structured-field agreement',
    minutes: 45,
    tracks: ALL,
    objectives: [
      'Build a chronology from dispatch to transfer of care.',
      'Attribute outside information to its source.',
      'Reconcile assessment fields, vital signs, procedures and the narrative so they describe one encounter.',
    ],
    prerequisites: ['C01'],
    sourceIds: ['R09', 'R14', 'LP02'],
    caseIds: ['K01', 'K07'],
    questionIds: ['Q05', 'Q06', 'Q07', 'Q08', 'Q09'],
    activity: 'Highlight contradictions in a synthetic report, then rewrite it.',
    sections: [
      {
        heading: 'Two halves of one record',
        body: [
          'The structured fields (NEMSIS eExam, eVitals, eProcedures and the rest) and the narrative are read separately — by different people and different software. When they disagree, a reader cannot tell which one is true, and usually assumes neither.',
          'A reassuring narrative does not cure an incompatible exam field. An abnormal narrative does not justify marking every exam category abnormal.',
        ],
        sourceIds: ['R14'],
      },
      {
        heading: 'Four entries that are not the same',
        body: [
          '"Normal" means you assessed it and it was normal. "Not assessed" means you did not look. "Unable to assess" means you tried and could not, and should say why. An abnormal finding should say what was abnormal.',
          'Default-normal templates are the commonest source of contradiction: a patient described as unable to hold sitting balance cannot also have a globally normal neuro and musculoskeletal exam.',
        ],
        sourceIds: ['R14', 'LP02'],
      },
      {
        heading: 'Chronology and attribution',
        body: [
          'Write events in the order they happened, with times that match the timestamps. Separate what you found from what the sending facility reported, and name who reported it.',
        ],
        sourceIds: ['R09'],
      },
    ],
    approval: 'draft',
    reviewers: [EDU, MD],
  },
  {
    id: 'C03',
    version: '1.0.0',
    title: 'Ambulance medical necessity',
    minutes: 50,
    tracks: ALL,
    objectives: [
      'Identify patient-specific findings that explain why other transportation was contraindicated.',
      'Identify the facts still missing before necessity can be judged.',
    ],
    prerequisites: ['C02'],
    sourceIds: ['R02', 'R03', 'R04'],
    caseIds: ['K03', 'K04'],
    questionIds: ['Q10', 'Q11', 'Q12', 'Q13', 'Q14', 'Q15'],
    activity: 'Sort cases into supported, insufficient information, or not supported by the stated facts.',
    sections: [
      {
        heading: 'The test',
        body: [
          'Medicare covers an ambulance transport only when the patient’s condition is such that other means of transportation are contraindicated — that is, transport by any other means could endanger the patient’s health — and the level of service is itself necessary (42 CFR 410.40; BPM ch. 10, §10.2).',
          'The record has to show the condition. It is the crew’s observations at this encounter that do it.',
        ],
        sourceIds: ['R02', 'R03'],
      },
      {
        heading: 'Bed-confined is one route, not the rule',
        body: [
          'Bed-confined has three elements, all required: unable to get up from bed without assistance, unable to ambulate, and unable to sit in a chair or wheelchair (42 CFR 410.40(a)).',
          'It is neither automatic approval nor a universal prerequisite. A patient who is not bed-confined may still need an ambulance (for monitoring, for example); one who is may still be described too thinly to support it.',
        ],
        sourceIds: ['R02', 'R03'],
      },
      {
        heading: 'What does not establish necessity by itself',
        body: [
          'A diagnosis, age, oxygen use, the destination, a facility request, or a signed certification statement. Each should prompt the question "what about this patient, today, made other transport unsafe?" — not stand in for the answer.',
          'Distinguish the reason the patient needs medical care from the reason they needed an ambulance to get to it. Lack of a car or family availability is a social reason, not a clinical one.',
        ],
        sourceIds: ['R02', 'R03', 'R04'],
      },
      {
        heading: 'The prompt to use',
        body: [
          '"Which observed findings explain the transport need, and what facts are still missing?" Never invent a limitation to make a chart pass. "Insufficient information" is a correct answer when it is true.',
        ],
        sourceIds: ['R04'],
      },
    ],
    approval: 'draft',
    reviewers: [EDU, BILL],
  },
  {
    id: 'C04',
    version: '1.0.0',
    title: 'Service level and reason for transfer',
    minutes: 35,
    tracks: ALL,
    objectives: ['Distinguish dispatch facts, staffing, care delivered and destination rationale.'],
    prerequisites: ['C03'],
    sourceIds: ['R03', 'R05', 'R06'],
    caseIds: ['K05', 'K10', 'K14'],
    questionIds: ['Q16', 'Q17', 'Q18', 'Q19'],
    activity: 'Compare BLS, ALS and ventilator transfers without guessing the final claim code.',
    sections: [
      {
        heading: 'The level follows the patient, not the truck',
        body: [
          'An ALS crew on board does not make a transport ALS. Payment follows the level of service the patient’s condition required and the crew furnished (42 CFR 414.605; BPM ch. 10).',
          'An ALS assessment counts only as defined: performed by an ALS crew as part of an emergency response that was necessary because the patient’s reported condition at dispatch was such that only an ALS crew was qualified to perform the assessment (42 CFR 414.605).',
        ],
        sourceIds: ['R03', 'R05'],
      },
      {
        heading: 'Specialty care transport',
        body: [
          'SCT is interfacility transport of a critically injured or ill patient at a level of service beyond the scope of the EMT-Paramedic, needing ongoing care from one or more health professionals in an appropriate specialty area (42 CFR 414.605). A ventilator on board does not establish it by itself.',
          'Document the care actually given: settings, checks, monitoring, titrations, the reasons for them, and who gave them.',
        ],
        sourceIds: ['R05'],
      },
      {
        heading: 'Four things that are not interchangeable',
        body: [
          'Clinical urgency, lights-and-sirens use, the emergency-response classification and the claim level answer different questions. Document each as what it was. Crews document; billing codes.',
          'For the destination, record why this facility: the service the patient needed and the source of any statement that a closer facility could not provide it.',
        ],
        sourceIds: ['R03', 'R05', 'R06'],
      },
    ],
    approval: 'draft',
    reviewers: [EDU, BILL],
  },
  {
    id: 'C05',
    version: '1.0.0',
    title: 'Signatures, certification and notices',
    minutes: 45,
    tracks: ALL,
    objectives: [
      'Distinguish clinical consent, claim authorization, PCR authentication, physician certification and the ABN.',
      'Choose the signature pathway the rule actually provides when a patient cannot sign.',
    ],
    prerequisites: ['C03'],
    sourceIds: ['R02', 'R04', 'R07', 'R08', 'R09', 'LP04'],
    caseIds: ['K08'],
    questionIds: ['Q20', 'Q21', 'Q22', 'Q23'],
    activity: 'Branch through form-purpose and signer-eligibility exercises.',
    sections: [
      {
        heading: 'Five signatures, five purposes',
        body: [
          'Consent to treatment is clinical. Claim authorization lets a claim be filed on the patient’s behalf (42 CFR 424.36). Authentication is the crew author signing their own record (PIM ch. 3, §3.3.2.4). A physician certification statement (PCS) is a practitioner’s statement about necessity (42 CFR 410.40). The ABN is a notice of likely non-coverage under Original Medicare (CMS-R-131). One signature does not do another’s job.',
        ],
        sourceIds: ['R02', 'R07', 'R08', 'R09'],
      },
      {
        heading: 'The PCS rules as written',
        body: [
          'Repetitive, scheduled nonemergency transport: a written order from the attending physician, obtained before the service and dated no earlier than 60 days before it.',
          'Unscheduled or nonrepetitive nonemergency transport of a facility resident under a physician’s care: certification within 48 hours after the transport. If the attending physician’s cannot be obtained, certain other staff with knowledge of the patient’s condition who are employed by the hospital or facility where the patient is being treated may sign. If none is obtained within 21 calendar days, the supplier may bill with documented attempts.',
          'A PCS is not required for every transport, and a signed PCS does not by itself prove necessity. Teach the rule, not "missing PCS = violation".',
        ],
        sourceIds: ['R02', 'R04'],
      },
      {
        heading: 'When the patient cannot sign',
        body: [
          'Record why the patient could not sign. Then follow the pathway: an authorized representative under 42 CFR 424.36(b), or the ambulance exception in (b)(6) — a contemporaneous statement from a crew member present, the transport date and time and receiving facility, and a statement or secondary record from that facility. Getting "any available signature" is not the rule.',
          'Branch status: located, needs review against the current regulation text and billing’s workflow before it is scored.',
        ],
        sourceIds: ['R07', 'LP04'],
      },
      {
        heading: 'The ABN, briefly',
        body: [
          'Original Medicare only. Given before the service, with time for a meaningful choice, never in a medical emergency or under duress. Not a general consent form and not a retrospective repair for a denied claim. Workflow pending billing review.',
        ],
        sourceIds: ['R08', 'LP04'],
      },
    ],
    approval: 'draft',
    reviewers: [EDU, BILL],
  },
  {
    id: 'C06',
    version: '1.0.0',
    title: 'Hospice, SNF, repetitive trips and payer routing',
    minutes: 40,
    tracks: ALL,
    objectives: [
      'Identify the facts billing needs before a payment question can be routed.',
      'Recognize when a question is outside the crew’s scope and route it.',
    ],
    prerequisites: ['C05'],
    sourceIds: ['R06', 'R12', 'R13', 'R19', 'R20', 'R21', 'R22', 'LP05'],
    caseIds: ['K02', 'K09'],
    questionIds: ['Q24', 'Q25', 'Q26'],
    activity: 'Home-to-hospice case and repetitive-dialysis case.',
    sections: [
      {
        heading: 'Hospice does not switch off documentation',
        body: [
          'Assess and document a hospice patient as fully as any other. CMS assigns transports related to the terminal illness after the effective date of hospice election to the hospice (BPM ch. 9, §40.1.9), and the section treats a transport on the day care begins, before the initial assessment, differently. Do not generalize that exception to every hospice admission.',
          'Record what billing needs to route it: whether and when the patient elected hospice, which hospice, the purpose of the trip, whether it relates to the terminal illness (as reported, and by whom), and what the destination actually is.',
        ],
        sourceIds: ['R12'],
      },
      {
        heading: 'Destinations are not labels',
        body: [
          'A building called a "hospice house" is not automatically a covered hospital or SNF destination. The benefit, the facility’s classification and the contract decide it, and billing resolves them. The crew’s job is the facts — never a promise of coverage to the family.',
        ],
        sourceIds: ['R03', 'R06', 'R12'],
      },
      {
        heading: 'Repetitive trips',
        body: [
          'Repetitive scheduled nonemergency transports need a PCS before service, dated within 60 days, and in Kansas and Missouri may fall under the RSNAT prior-authorization program. Each trip still needs that day’s findings. Copying the prior trip’s condition forward is not documentation.',
        ],
        sourceIds: ['R02', 'R13'],
      },
      {
        heading: 'Payers are not one manual',
        body: [
          'Medicare rules are not a universal payer manual. Kansas Medicaid (KMAP and KanCare plans), MO HealthNet and commercial plans have their own rules. The J5 Medicare contractor’s contract term ended in August 2026; confirm who is operating before citing contractor education.',
        ],
        sourceIds: ['R19', 'R20', 'R21', 'R22'],
      },
    ],
    approval: 'draft',
    reviewers: [EDU, BILL],
  },
  {
    id: 'C07',
    version: '1.0.0',
    title: 'Consent, declined care and unusual dispositions',
    minutes: 30,
    tracks: ALL,
    objectives: ['Document the actual encounter, options discussed, the patient’s response and consultations.'],
    prerequisites: ['C02'],
    sourceIds: ['R15', 'R16', 'LP03', 'LP08'],
    caseIds: ['K11', 'K13'],
    questionIds: ['Q27'],
    activity: 'Review partial refusal, canceled transfer, and DNR scenarios.',
    sections: [
      {
        heading: 'Refusal is not all-or-nothing',
        body: [
          'A patient who accepts transport may decline a particular assessment or intervention. Document it like a refusal: what was offered, the explanation given, the patient’s response in their words where possible, alternatives offered, any consultation, and reassessment.',
          'A patient refusing is different from the agency declining a request. A local "no refusals" phrase needs a precise operational definition; it never means disregarding a patient’s valid refusal.',
        ],
        sourceIds: ['LP03', 'LP08'],
      },
      {
        heading: 'Canceled and no-transport encounters',
        body: [
          'If you assessed a patient and the trip was canceled, you still had an encounter. Record what you found, what you did, and the actual disposition. Do not imply a transport happened.',
        ],
        sourceIds: ['R15', 'R16'],
      },
      {
        heading: 'Pending medical/legal content',
        body: [
          'Capacity, surrogates, involuntary transport, minors and DNR differ between Kansas and Missouri and need approved medical/legal policy before this course teaches a rule. Until then, scenarios end in "consult medical control / follow agency policy".',
        ],
        sourceIds: ['LP08'],
      },
    ],
    approval: 'draft',
    reviewers: [EDU, MD],
  },
  {
    id: 'C08',
    version: '1.0.0',
    title: 'Local ePCR workflow and privacy',
    minutes: 25,
    tracks: ALL,
    objectives: ['Apply the approved agency field requirements.', 'Use training data appropriately.'],
    prerequisites: ['C02'],
    sourceIds: ['R14', 'R15', 'R16', 'R17', 'R18', 'LP01', 'LP02', 'LP07'],
    caseIds: [],
    questionIds: ['Q28', 'Q29', 'Q30'],
    activity: 'Mock ImageTrend-style form and missing-attachment checklist.',
    sections: [
      {
        heading: 'Validation rules are not clinical findings',
        body: [
          'A required-field rule is there to prompt an assessment, not to be satisfied. If a validation rule fires for something you did not assess, the honest entry is "not assessed" (with the reason), not a value that clears the warning.',
          'Field names, validation rules, attachment workflow and finalization behaviour are being collected from the ePCR administrator (local policy pending).',
        ],
        sourceIds: ['R14', 'LP02'],
      },
      {
        heading: 'Privacy in training',
        body: [
          'This course uses synthetic cases only. Removing a name is not de-identification — dates, places, rare conditions and free text can identify a patient (HHS de-identification guidance).',
          'Never paste real PCR content into this app, a personal device, a chat tool or an AI prompt. The narrative workspace refuses text that looks like an identifier.',
        ],
        sourceIds: ['R17', 'R18', 'LP07'],
      },
    ],
    approval: 'draft',
    reviewers: [EDU, 'Privacy officer'],
  },
  {
    id: 'C09',
    version: '1.0.0',
    title: 'Core assessment and chart capstone',
    minutes: 45,
    tracks: ALL,
    objectives: ['Apply the principles to a complete record and explain the corrections.'],
    prerequisites: ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08'],
    sourceIds: [],
    caseIds: ['K01', 'K02', 'K03', 'K07', 'K08', 'K12'],
    questionIds: [],
    activity: 'Thirty-question exam, synthetic chart review, and debrief.',
    sections: [
      {
        heading: 'How the capstone is scored',
        body: [
          'Knowledge: 30 items, pass at 80%. A miss gives source-linked remediation and a different, equivalent retest.',
          'Practical: one synthetic chart scored by a reviewer on eight domains, 0–2 each. Pass at 85% of applicable points with no unresolved critical error.',
        ],
        sourceIds: [],
      },
    ],
    approval: 'draft',
    reviewers: [EDU],
  },

  // --- Leadership practicum ------------------------------------------------
  {
    id: 'L01',
    version: '1.0.0',
    title: 'Reviewer calibration',
    minutes: 35,
    tracks: LEAD,
    objectives: ['Score the same chart independently, then reconcile disagreements against observable criteria.'],
    prerequisites: ['C09'],
    sourceIds: ['LP06'],
    caseIds: ['K16'],
    questionIds: [],
    activity: 'Independently score two identical synthetic charts, then reconcile.',
    emphasis: {
      fto: 'Identify teachable gaps without rewriting the trainee’s account.',
      manager: 'Set consistent audit definitions and escalation thresholds.',
    },
    sections: [
      {
        heading: 'Agreement is a measurement',
        body: [
          'Two reviewers who score the same chart differently have found a problem in the rubric or in themselves. Reconcile on the evidence and record what stays unresolved — do not average away a critical issue.',
        ],
        sourceIds: ['LP06'],
      },
    ],
    approval: 'draft',
    reviewers: [EDU],
  },
  {
    id: 'L02',
    version: '1.0.0',
    title: 'Coaching and clarification',
    minutes: 35,
    tracks: LEAD,
    objectives: ['Write a neutral clarification request and conduct a short coaching conversation.'],
    prerequisites: ['L01'],
    sourceIds: ['R09', 'R10'],
    caseIds: ['K15'],
    questionIds: [],
    activity: 'Write a neutral clarification request; role-play a coaching conversation.',
    emphasis: {
      fto: 'Ask what was observed, then coach an accurate entry.',
      manager: 'Separate documentation weakness, care concerns, and possible integrity concerns.',
    },
    sections: [
      {
        heading: 'The coaching sequence',
        body: [
          'Identify the discrepancy. Ask what happened. Explain why the distinction matters. Request an accurate correction if possible. Agree a follow-up check.',
          'Example: "The narrative and exam fields describe different findings. What did you actually assess? Please correct the record to match that assessment, or identify what was not assessed. If you cannot verify it, leave that uncertainty clear."',
        ],
        sourceIds: ['R09'],
      },
      {
        heading: 'Never coach toward a claim result',
        body: [
          '"Add bedbound so we can bill" is a request to falsify a record. Preserve the truthful findings, clarify facts, and escalate the request through the compliance route.',
        ],
        sourceIds: ['R10'],
      },
    ],
    approval: 'draft',
    reviewers: [EDU, BILL],
  },
  {
    id: 'L03',
    version: '1.0.0',
    title: 'Audit workflow and improvement',
    minutes: 30,
    tracks: LEAD,
    objectives: ['Design a review plan and a small dashboard with defined numerators and denominators.'],
    prerequisites: ['L02'],
    sourceIds: ['R10', 'R11', 'LP06'],
    caseIds: [],
    questionIds: [],
    activity: 'Design a review plan and a small dashboard.',
    emphasis: {
      fto: 'Plan focused follow-up on the next three eligible charts.',
      manager: 'Track recurring defects, completion, and reviewer agreement.',
    },
    sections: [
      {
        heading: 'Measures with definitions',
        body: [
          'Contradiction rate = contradictory charts ÷ charts reviewed. Missing-requirement rate = charts missing an applicable requirement ÷ eligible charts. Reviewer agreement = matching decisions ÷ shared reviewed items.',
          'Keep routine random sampling separate from high-risk and new-hire sampling, and de-duplicate overall counts. Keep clinical-quality results separate from claim-payment results: payment is not proof of documentation quality.',
        ],
        sourceIds: ['R11', 'LP06'],
      },
    ],
    approval: 'draft',
    reviewers: [EDU],
  },
  {
    id: 'L04',
    version: '1.0.0',
    title: 'Leadership sign-off',
    minutes: 20,
    tracks: LEAD,
    objectives: ['Defend a review decision and a remediation plan.'],
    prerequisites: ['L03'],
    sourceIds: [],
    caseIds: ['K05', 'K06', 'K14', 'K15'],
    questionIds: [],
    activity: 'Defend a review decision and remediation plan.',
    emphasis: {
      fto: 'Teach back one difficult case.',
      manager: 'Assign ownership, escalation route, and follow-up measure.',
    },
    sections: [
      {
        heading: 'What sign-off needs',
        body: [
          'A human reviewer approves one coaching response and one audit/remediation plan. Automated text matching cannot establish that free text is clinically accurate, so nothing here is auto-passed.',
        ],
        sourceIds: [],
      },
    ],
    approval: 'draft',
    reviewers: [EDU],
  },
]

export const LESSON_BY_ID: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.id, l]))

export const CORE_IDS = LESSONS.filter((l) => l.id.startsWith('C')).map((l) => l.id)
export const LEADERSHIP_IDS = LESSONS.filter((l) => l.id.startsWith('L')).map((l) => l.id)

/**
 * Four 2-hour sessions (brief §3). A slice names a lesson and the minutes of it
 * that fall in the session; a lesson split across two sessions appears in both.
 */
export const SESSIONS: { id: string; label: string; slices: { lessonId: string; minutes: number }[] }[] = [
  {
    id: 'S1',
    label: 'Session 1',
    slices: [
      { lessonId: 'C00', minutes: 15 },
      { lessonId: 'C01', minutes: 30 },
      { lessonId: 'C02', minutes: 45 },
      { lessonId: 'C03', minutes: 30 },
    ],
  },
  {
    id: 'S2',
    label: 'Session 2',
    slices: [
      { lessonId: 'C03', minutes: 20 },
      { lessonId: 'C04', minutes: 35 },
      { lessonId: 'C05', minutes: 45 },
      { lessonId: 'C06', minutes: 20 },
    ],
  },
  {
    id: 'S3',
    label: 'Session 3',
    slices: [
      { lessonId: 'C06', minutes: 20 },
      { lessonId: 'C07', minutes: 30 },
      { lessonId: 'C08', minutes: 25 },
      { lessonId: 'C09', minutes: 45 },
    ],
  },
  {
    id: 'S4',
    label: 'Session 4 — leadership',
    slices: [
      { lessonId: 'L01', minutes: 35 },
      { lessonId: 'L02', minutes: 35 },
      { lessonId: 'L03', minutes: 30 },
      { lessonId: 'L04', minutes: 20 },
    ],
  },
]

export function lessonsFor(track: Track) {
  return LESSONS.filter((l) => l.tracks.includes(track))
}

/** Practical rubric (brief §6). */
export const RUBRIC: RubricDomain[] = [
  { id: 'timeline', label: 'Timeline and encounter', evidence: 'Coherent dispatch, contact, transport, and handoff sequence' },
  { id: 'findings', label: 'Findings', evidence: 'Relevant observed assessment with appropriate attribution' },
  { id: 'agreement', label: 'Internal agreement', evidence: 'Narrative and structured record describe the same encounter' },
  { id: 'transport', label: 'Transport reasoning', evidence: 'Specific facts, with uncertainty acknowledged' },
  { id: 'care', label: 'Care and response', evidence: 'Interventions, monitoring, reassessment, and clinical changes' },
  { id: 'forms', label: 'Forms and handoff', evidence: 'Applicable forms/signatures, attachments, and transfer of care' },
  { id: 'integrity', label: 'Integrity and privacy', evidence: 'No invented facts; proper amendment and data handling' },
  { id: 'coaching', label: 'Coaching/escalation', evidence: 'Clear neutral query and appropriate next step' },
]

/** Examples, not an exhaustive list. A minor style preference is never one. */
export const CRITICAL_ERRORS = [
  { id: 'fabrication', label: 'Fabricated findings' },
  { id: 'backdating', label: 'Backdating or silent overwrite' },
  { id: 'unauthorized_signer', label: 'Instructing an unauthorized person to sign' },
  { id: 'safety_missed', label: 'Failing to flag an explicitly presented immediate patient-safety concern' },
] as const
