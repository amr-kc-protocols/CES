import type { ExamDomain, Question } from './types'

// ---------------------------------------------------------------------------
// Baseline (ungraded) and the common-core exam, Form A.
//
// Blueprint (brief §6): accuracy/corrections 4; narrative/structured
// agreement 5; necessity 6; service level/destination 4; forms/signatures 4;
// hospice/payer routing 3; consent/privacy/local workflow 4 — 30 items, at
// least 20 of them scenario-based. scripts/check-doc-academy.mjs holds Form A
// to that, and to the rule that no scored item rests on a local policy nobody
// has supplied yet.
//
// Form B — the "different equivalent retest" — is not written yet. Until it
// is, a retest is reviewer-administered and the app says so.
// ---------------------------------------------------------------------------

type Choice = [id: string, text: string, rationale: string]

function q(
  id: string,
  lessonId: string,
  domain: ExamDomain,
  scenarioFacts: string[],
  prompt: string,
  choices: Choice[],
  correct: string[],
  sourceIds: string[],
  criticalConcept = false,
): Question {
  return {
    id,
    lessonId,
    domain,
    scenarioFacts,
    prompt,
    choices: choices.map(([cid, text]) => ({ id: cid, text })),
    correctChoiceIds: correct,
    rationaleByChoice: Object.fromEntries(choices.map(([cid, , r]) => [cid, r])),
    sourceIds,
    criticalConcept,
  }
}

export const EXAM_BLUEPRINT: Record<ExamDomain, number> = {
  accuracy: 4,
  agreement: 5,
  necessity: 6,
  level: 4,
  signatures: 4,
  routing: 3,
  consent: 4,
}

export const DOMAIN_LABEL: Record<ExamDomain, string> = {
  accuracy: 'Accuracy and corrections',
  agreement: 'Narrative/structured agreement',
  necessity: 'Medical necessity',
  level: 'Service level and destination',
  signatures: 'Forms and signatures',
  routing: 'Hospice and payer routing',
  consent: 'Consent, privacy and local workflow',
}

export const EXAM_PASS_PCT = 80

export const EXAM_FORM_A: Question[] = [
  // --- Accuracy and corrections (4) ---------------------------------------
  q(
    'Q01',
    'C01',
    'accuracy',
    [
      'A paramedic finalized a PCR yesterday.',
      'Reviewing it today, they realize the medication time reads 1421; the drug was given at 1412.',
    ],
    'What is the right way to fix the record?',
    [
      ['a', 'Reopen the chart and change 1421 to 1412. It is a typo, so no note is needed.', 'A silent overwrite removes the original entry. Even a small correction must be identifiable as one.'],
      ['b', 'Add an amendment, dated today and signed by the author, stating the time was 1412, with the original entry still visible.', 'Correct. It is identified as an amendment, dated and attributed, and the original content is preserved.'],
      ['c', 'Leave it alone. Nine minutes does not matter once a chart is finalized.', 'A known error should be corrected. Finalization does not prevent a proper amendment.'],
      ['d', 'Ask a supervisor to change it so the author’s name is not on the correction.', 'The amendment must show who made it. Moving it to someone else hides the author.'],
    ],
    ['b'],
    ['R09'],
    true,
  ),
  q(
    'Q02',
    'C01',
    'accuracy',
    [],
    'For CMS medical review, which describes an acceptable amendment, correction or delayed entry?',
    [
      ['a', 'It replaces the original entry so the reviewer is not confused by two versions.', 'Original content must stay identifiable. Replacing it is what makes a correction unacceptable.'],
      ['b', 'It is valid only if made within 24 hours of the encounter.', 'PIM ch. 3 sets no 24-hour limit. A local completion deadline is a different rule.'],
      ['c', 'It is clearly identified as an amendment, shows its date and author, and leaves the original content identifiable.', 'Correct — the three requirements in PIM ch. 3, §3.3.2.5.'],
      ['d', 'It must be approved by a supervisor before it counts.', 'Supervisor approval is not one of the requirements. The author amends their own record.'],
    ],
    ['c'],
    ['R09'],
    true,
  ),
  q(
    'Q03',
    'C01',
    'accuracy',
    [
      'A QA reviewer asks a crew to "add the second set of vitals" to a transfer chart.',
      'The paramedic does not remember taking a second set.',
    ],
    'What should the paramedic do?',
    [
      ['a', 'Enter the first set again with a later time; the patient was stable.', 'Copying values invents a measurement that was not taken. That is fabrication.'],
      ['b', 'Enter plausible values, since the patient was stable throughout.', 'Estimated values presented as measured are fabricated findings.'],
      ['c', 'Reply that a second set was not obtained or cannot be recalled, and add nothing that was not done.', 'Correct. A reviewer’s request does not create a finding. "Not obtained" or "cannot recall" is a legitimate end to a clarification.'],
      ['d', 'Write "vitals stable throughout" in the narrative instead.', 'That asserts monitoring the paramedic cannot confirm.'],
    ],
    ['c'],
    ['R09'],
    true,
  ),
  q(
    'Q04',
    'C01',
    'accuracy',
    [
      'The day after a transport, an EMT clearly remembers reassessing lung sounds at 1530.',
      'The reassessment is not in the chart.',
    ],
    'How should it be added?',
    [
      ['a', 'Insert it into the timeline at 1530 with no notation, since that is when it happened.', 'An unmarked insertion reads as if it were written at the time. That is backdating.'],
      ['b', 'Add a late entry, dated today and identified as a late entry, describing the 1530 reassessment.', 'Correct. A late entry is dated when written and says what time it refers to.'],
      ['c', 'Nothing can be added once a chart is finalized.', 'Properly identified late entries are permitted. What is not permitted is hiding when they were made.'],
      ['d', 'Ask the partner to put it in their own chart instead.', 'The partner would be documenting someone else’s assessment, and the original record would still be incomplete.'],
    ],
    ['b'],
    ['R09'],
  ),

  // --- Narrative/structured agreement (5) ---------------------------------
  q(
    'Q05',
    'C02',
    'agreement',
    [
      'Narrative: "Pt unable to maintain sitting balance. Known L-sided weakness from prior CVA."',
      'Structured exam: Neuro — Normal. Extremities — Normal.',
    ],
    'What is the best review action?',
    [
      ['a', 'None. The narrative explains the findings, so the fields do not matter.', 'Fields and narrative are read separately. A reassuring narrative does not cure an incompatible exam field.'],
      ['b', 'Mark every exam category abnormal to match the narrative.', 'An abnormal narrative does not justify marking every category abnormal.'],
      ['c', 'Ask the author what was actually assessed, and correct the fields to those findings or to "not assessed".', 'Correct. Reconcile only the findings actually assessed. Do not assume either half is right.'],
      ['d', 'Delete the narrative sentence so the chart is consistent.', 'Deleting a true finding to remove a contradiction destroys information.'],
    ],
    ['c'],
    ['R09', 'R14'],
    true,
  ),
  q(
    'Q06',
    'C02',
    'agreement',
    [],
    'What is the difference between an exam field marked "Normal" and one marked "Not assessed"?',
    [
      ['a', 'None. Both mean nothing abnormal was found.', 'They are different statements. One reports an examination; the other reports that none was done.'],
      ['b', '"Normal" means it was examined and was normal; "Not assessed" means it was not examined.', 'Correct.'],
      ['c', '"Not assessed" is only for patients who refused.', 'A refusal is one reason something was not assessed, not the only one. Record the reason.'],
      ['d', '"Normal" is the correct default when the patient had no complaint in that system.', 'A default is not a finding. If you did not look, it was not assessed.'],
    ],
    ['b'],
    ['R14'],
  ),
  q(
    'Q07',
    'C02',
    'agreement',
    [
      'Structured fields: GCS 15. AVPU: Verbal.',
      'Narrative: "Pt drowsy, at baseline per facility."',
      'No glucose is documented.',
    ],
    'What is the main documentation problem?',
    [
      ['a', 'None. Drowsiness at baseline explains everything.', 'A baseline is useful context, but it does not reconcile the two scores.'],
      ['b', 'GCS 15 and AVPU "Verbal" cannot both be true. The crew should establish the actual mental status and document it consistently.', 'Correct. GCS 15 requires spontaneous eye opening; a patient who responds only to voice is not 15. Establish the real status rather than changing a score to clear a validation message.'],
      ['c', 'Change AVPU to "Alert" so it matches the GCS.', 'That changes a finding to make fields agree, without establishing which is true.'],
      ['d', 'Change GCS to 14 so the glucose requirement no longer triggers.', 'Picking a score to manage a validation rule is falsification, whichever direction it goes.'],
    ],
    ['b'],
    ['R09', 'R14'],
    true,
  ),
  q(
    'Q08',
    'C02',
    'agreement',
    ['At pickup, the charge nurse tells the crew the patient fell overnight. The crew did not witness it.'],
    'How should this be documented?',
    [
      ['a', '"Pt fell overnight."', 'Unattributed, it reads as the crew’s own observation.'],
      ['b', '"Per charge RN at sending facility, pt fell overnight." Then the crew’s own findings.', 'Correct. Outside information is attributed to its source and kept apart from the crew’s findings.'],
      ['c', 'Leave it out, because the crew did not witness it.', 'It is relevant history. Attribute it rather than dropping it.'],
      ['d', '"Pt fell overnight, no injuries," because none were reported.', 'No reported injuries is not the same as no injuries found. State what was assessed.'],
    ],
    ['b'],
    ['R09'],
  ),
  q(
    'Q09',
    'C02',
    'agreement',
    [
      'Narrative: "Lungs clear bilaterally."',
      'Procedures: albuterol nebulizer at 0910, indication "wheezing".',
      'Only one set of lung sounds is recorded.',
    ],
    'What should the reviewer ask for?',
    [
      ['a', 'Remove the albuterol, since the lungs were clear.', 'The treatment was given. Removing it falsifies the record.'],
      ['b', 'The actual findings and their times — for example, wheezing before treatment and the reassessment after.', 'Correct. The chronology probably explains the conflict, but only the author can say what was heard and when.'],
      ['c', 'Change the narrative to "wheezing" to match the indication.', 'That assumes the indication is right and the narrative wrong. Ask instead.'],
      ['d', 'Nothing. The narrative is a summary and need not match the procedure list.', 'Both halves describe one encounter and must agree, or the record cannot be relied on.'],
    ],
    ['b'],
    ['R09', 'R14'],
  ),

  // --- Medical necessity (6) ----------------------------------------------
  q(
    'Q10',
    'C03',
    'necessity',
    [],
    'Under 42 CFR 410.40, which describes a bed-confined beneficiary?',
    [
      ['a', 'Unable to get up from bed without assistance, OR unable to ambulate, OR unable to sit in a chair or wheelchair.', 'All three elements are required, not any one of them.'],
      ['b', 'Unable to get up from bed without assistance, AND unable to ambulate, AND unable to sit in a chair or wheelchair.', 'Correct — all three.'],
      ['c', 'Spends most of the day in bed.', 'Time in bed is not the definition. The test is the three functional inabilities.'],
      ['d', 'Has a physician order that says "bedbound".', 'An order using the word does not establish the three elements.'],
    ],
    ['b'],
    ['R02'],
    true,
  ),
  q(
    'Q11',
    'C03',
    'necessity',
    [],
    'Which statement about bed confinement and Medicare ambulance necessity is correct?',
    [
      ['a', 'A patient must be bed-confined for a nonemergency transport to be covered.', 'Bed confinement is not a universal prerequisite. Other conditions can make other transport contraindicated.'],
      ['b', 'A bed-confined patient is automatically covered.', 'It is not automatic approval. The record still has to show the condition.'],
      ['c', 'It is one consideration. The test is whether the patient’s condition made other means of transport contraindicated.', 'Correct.'],
      ['d', 'It applies only to dialysis patients.', 'The definition applies to ambulance coverage generally.'],
    ],
    ['c'],
    ['R02', 'R03'],
    true,
  ),
  q(
    'Q12',
    'C03',
    'necessity',
    [
      'A patient is being discharged home.',
      'They walk independently to the stretcher. No monitoring, oxygen or positioning need is stated.',
      'The family says they have no car.',
    ],
    'How should the crew handle the documentation?',
    [
      ['a', 'Document "unable to ambulate safely" so the trip is supported.', 'That contradicts what the crew saw. It is an invented limitation.'],
      ['b', 'Document what was observed, including that the patient walked independently. Route the necessity question through local escalation.', 'Correct. Lack of a car is a social reason, not a clinical one. Record the truth and escalate.'],
      ['c', 'Document "no transportation available" as the medical necessity.', 'That is not a clinical rationale for an ambulance.'],
      ['d', 'Refuse to document the encounter.', 'An encounter that happened must be documented.'],
    ],
    ['b'],
    ['R02', 'R03', 'R04'],
    true,
  ),
  q(
    'Q13',
    'C03',
    'necessity',
    [
      'The PCS says "bedbound".',
      'The crew finds the patient sitting up in a wheelchair, and they transfer to the stretcher with one assist.',
    ],
    'What is the right response?',
    [
      ['a', 'Document "bedbound" to match the PCS.', 'The crew documents what it observes, not what the form says.'],
      ['b', 'Cancel the transport because the PCS is wrong.', 'One fact is neither automatic approval nor automatic denial. Clarify instead.'],
      ['c', 'Document the observed function accurately and any other transport needs, and flag the inconsistency for clarification.', 'Correct. A signed PCS does not alone establish necessity, and the crew’s observations stand on their own.'],
      ['d', 'Leave function out so the record does not conflict with the PCS.', 'Omitting the observation hides a relevant fact.'],
    ],
    ['c'],
    ['R02', 'R03'],
  ),
  q(
    'Q14',
    'C03',
    'necessity',
    ['A crew is choosing how to describe why a patient needed an ambulance.'],
    'Which entry best supports the transport need?',
    [
      ['a', '"Pt on 2 L O2 via NC."', 'Oxygen use alone does not show that other transport was contraindicated.'],
      ['b', '"Dx: L hip fracture."', 'A diagnosis alone is not a functional or clinical reason for the ambulance.'],
      ['c', '"Unable to bear weight or sit upright. L leg shortened and externally rotated; pain 9/10 with any hip flexion. Transported supine with the leg supported."', 'Correct. Specific findings observed at this encounter explain why other transport was unsafe.'],
      ['d', '"Facility requested ALS transport."', 'A facility request triggers inquiry. It is not a rationale.'],
    ],
    ['c'],
    ['R03', 'R04'],
  ),
  q(
    'Q15',
    'C03',
    'necessity',
    [
      'A SNF resident is transported for a scheduled outpatient CT.',
      'Narrative: "Pt bedbound. Transported without incident."',
      'Nothing describes getting up, walking, sitting, monitoring or positioning.',
    ],
    'How would you sort this chart?',
    [
      ['a', 'Supported — "bedbound" is documented.', 'A label is not the three elements. The facts behind it are missing.'],
      ['b', 'Not supported — the patient obviously did not need an ambulance.', 'Nothing in the chart shows that either. Do not assume a conclusion the facts do not reach.'],
      ['c', 'Insufficient information — the chart does not describe the patient’s function or condition at this encounter.', 'Correct. Name the missing facts and ask for them; do not supply them.'],
      ['d', 'Supported, because SNF residents are presumed to need ambulances.', 'There is no such presumption.'],
    ],
    ['c'],
    ['R02', 'R03', 'R04'],
  ),

  // --- Service level and destination (4) ----------------------------------
  q(
    'Q16',
    'C04',
    'level',
    [
      'A paramedic crew does a scheduled nonemergency transfer.',
      'The patient needs only BLS-level care, and no ALS assessment or intervention is performed.',
    ],
    'Does the paramedic crew make this an ALS transport?',
    [
      ['a', 'Yes. The level follows the crew’s certification.', 'An ALS crew’s presence is not sufficient to establish ALS.'],
      ['b', 'No. The level follows the service the patient’s condition required and the crew furnished.', 'Correct.'],
      ['c', 'Yes, if the cardiac monitor was applied.', 'Applying a monitor is not by itself an ALS intervention under the definitions.'],
      ['d', 'It depends on whether lights and sirens were used.', 'Lights and sirens do not set the service level.'],
    ],
    ['b'],
    ['R03', 'R05'],
  ),
  q(
    'Q17',
    'C04',
    'level',
    [],
    'Under 42 CFR 414.605, which is part of the definition of an ALS assessment?',
    [
      ['a', 'Any assessment performed by a paramedic.', 'Who performs it is only part of the definition.'],
      ['b', 'An assessment by an ALS crew as part of an emergency response, needed because the patient’s condition reported at dispatch meant only an ALS crew was qualified to perform it.', 'Correct. The definition ties it to emergency response and dispatch conditions.'],
      ['c', 'Any assessment that finds an abnormal vital sign.', 'Findings do not define an ALS assessment.'],
      ['d', 'Any assessment during an interfacility transfer.', 'The definition is tied to an emergency response, not to transfers as such.'],
    ],
    ['b'],
    ['R05'],
  ),
  q(
    'Q18',
    'C04',
    'level',
    [
      'A stable ventilated patient is transferred between ICUs.',
      'There is no deterioration en route.',
      'The chart omits vent settings, airway checks, monitoring and the care performed.',
    ],
    'What is the main documentation issue?',
    [
      ['a', 'None. The patient was stable, so there was nothing to document.', 'A stable outcome does not erase the support the patient needed. Document observed care.'],
      ['b', 'The chart should say "SCT" so the level is clear.', 'A ventilator does not by itself establish SCT. Crews document care; they do not assign a level.'],
      ['c', 'Settings, airway checks, monitoring and care performed are missing. Document what was done, and refer the service-level question for review.', 'Correct.'],
      ['d', 'Add vent settings from the sending facility’s flowsheet as the crew’s own findings.', 'Use outside data only if it is attributed, and never present it as the crew’s own checks.'],
    ],
    ['c'],
    ['R05', 'R09'],
    true,
  ),
  q(
    'Q19',
    'C04',
    'level',
    [
      'A closer hospital exists.',
      'The sending team says the patient is going to a farther hospital because the specialist service is unavailable at the closer one.',
    ],
    'What should the chart record?',
    [
      ['a', 'Just the destination name.', 'Without the reason, a reader cannot see why the closer facility was bypassed.'],
      ['b', '"Closest appropriate facility."', 'A conclusion with no facts behind it.'],
      ['c', 'The service the patient needed, the availability information, who provided it, and the destination rationale.', 'Correct. Record what was needed, what was said, and its source.'],
      ['d', 'Nothing. Destination choice is the sending facility’s responsibility.', 'The record still needs the destination rationale.'],
    ],
    ['c'],
    ['R02', 'R03'],
  ),

  // --- Forms and signatures (4) -------------------------------------------
  q(
    'Q20',
    'C05',
    'signatures',
    [],
    'For a Medicare repetitive, scheduled nonemergency ambulance transport, when must the physician certification be obtained?',
    [
      ['a', 'Within 48 hours after the transport.', 'That window is for unscheduled or nonrepetitive transports of facility residents.'],
      ['b', 'Before the service, and dated no earlier than 60 days before the service.', 'Correct.'],
      ['c', 'Within 21 days after the transport.', 'Twenty-one days is the documented-attempt pathway for nonrepetitive transports.'],
      ['d', 'Once per calendar year.', 'There is no annual certification rule.'],
    ],
    ['b'],
    ['R02', 'R04'],
  ),
  q(
    'Q21',
    'C05',
    'signatures',
    [],
    'For an unscheduled nonemergency transport of a facility resident under a physician’s care, when may the certification be obtained?',
    [
      ['a', 'Within 48 hours after the transport.', 'Correct.'],
      ['b', 'Only before the transport.', 'The rule allows 48 hours after for this category.'],
      ['c', 'Never. Unscheduled transports never need one.', 'Facility residents under a physician’s care do need one in this category.'],
      ['d', 'Within 60 days after the transport.', 'Sixty days is the look-back for repetitive transports, before the service.'],
    ],
    ['a'],
    ['R02', 'R04'],
  ),
  q(
    'Q22',
    'C05',
    'signatures',
    [
      'A patient cannot physically sign the claim authorization because of hand contractures.',
      'Their spouse, who arranged the transport, is present.',
      'The form so far has no explanation and no relationship recorded.',
    ],
    'What should the crew do?',
    [
      ['a', 'Have the EMT partner sign the patient’s name.', 'Signing another person’s name is never an authorized pathway.'],
      ['b', 'Record why the patient cannot sign, and have the spouse sign as representative with name and relationship recorded, following the billing-approved workflow.', 'Correct. A relative who arranges treatment can be an authorized representative under 424.36(b). Document incapacity and the signer’s relationship.'],
      ['c', 'Skip the signature, since the patient cannot sign.', 'The rule provides representative and exception pathways. Skipping is not one of them.'],
      ['d', 'Have the receiving nurse sign because they are a clinician.', 'Not when an eligible representative is present. The facility pathway has its own conditions.'],
    ],
    ['b'],
    ['R07'],
    true,
  ),
  q(
    'Q23',
    'C05',
    'signatures',
    [],
    'Which statement about the ABN (CMS-R-131) is correct?',
    [
      ['a', 'It can be used after a claim is denied to make the patient liable.', 'An ABN is not a retrospective repair.'],
      ['b', 'It serves as the patient’s consent to treatment.', 'It is a notice of likely non-coverage, not a consent form.'],
      ['c', 'It applies to Original Medicare, is given before the service, and should not be given in a medical emergency or under duress.', 'Correct.'],
      ['d', 'Every transport needs one.', 'It is for specific expected non-coverage situations, not every transport.'],
    ],
    ['c'],
    ['R08'],
  ),

  // --- Hospice and payer routing (3) --------------------------------------
  q(
    'Q24',
    'C06',
    'routing',
    [
      'A hospice patient is moved from home to an inpatient hospice unit for symptom management.',
      'The election date and payment arrangement are unknown to the crew.',
    ],
    'What should the crew do?',
    [
      ['a', 'Tell the family Medicare will cover the trip.', 'The crew cannot promise coverage. The hospice may be responsible.'],
      ['b', 'Document a full assessment and clinical rationale, record what is known and unknown about the hospice election and arrangement, and route to billing.', 'Correct. A hospice patient is assessed like any other, and the payment question goes to billing.'],
      ['c', 'Document minimally, since the hospice handles everything.', 'Hospice enrollment does not reduce documentation.'],
      ['d', 'Require a PCS from the family before leaving.', 'The family cannot provide a PCS, and none is automatically required here.'],
    ],
    ['b'],
    ['R12'],
  ),
  q(
    'Q25',
    'C06',
    'routing',
    [
      'A patient has repeated scheduled dialysis transports.',
      'The PCS on file is dated 75 days ago.',
      'Today the patient is more alert and mobile than on recent trips.',
    ],
    'What should the crew do?',
    [
      ['a', 'Copy the condition description from the last trip for consistency.', 'Each trip needs that day’s findings. Copying forward is not documentation.'],
      ['b', 'Document today’s findings as observed, and route the out-of-window certification to billing.', 'Correct. A repetitive PCS must be dated within 60 days before service; that is a routing problem, not a reason to change findings.'],
      ['c', 'Document the patient as less mobile than observed to stay consistent with prior trips.', 'That falsifies today’s record.'],
      ['d', 'Have the patient sign a new PCS.', 'A PCS is a practitioner’s certification, not the patient’s.'],
    ],
    ['b'],
    ['R02', 'R13'],
  ),
  q(
    'Q26',
    'C06',
    'routing',
    ['A crew moves an inpatient between two buildings on the same hospital campus.'],
    'What is the right documentation approach?',
    [
      ['a', 'Document it as a standard separate transport. Billing will sort it out.', 'Do not assume a separate Part B trip.'],
      ['b', 'Document the actual origin and destination locations and the care given, and flag it for billing review of the institutional or bundling question.', 'Correct.'],
      ['c', 'Do not document it; same-campus moves are not transports.', 'An encounter that happened is documented.'],
      ['d', 'Record a different destination so it reads as an interfacility transfer.', 'That falsifies the destination.'],
    ],
    ['b'],
    ['R06'],
  ),

  // --- Consent, privacy and local workflow (4) ----------------------------
  q(
    'Q27',
    'C07',
    'consent',
    ['A patient accepts transport but declines a 12-lead ECG that the paramedic recommended.'],
    'What does the record need?',
    [
      ['a', 'Nothing. The patient was transported, so there was no refusal.', 'A partial refusal still needs to be documented.'],
      ['b', 'Only "pt refused 12-lead".', 'Too thin. It does not show what was explained or how the patient responded.'],
      ['c', 'What was recommended and why, the explanation given, the patient’s response, alternatives offered, any consultation, and reassessment.', 'Correct.'],
      ['d', 'A full refusal form ending the encounter.', 'The patient accepted transport. Document the partial refusal within the encounter.'],
    ],
    ['c'],
    ['R09'],
  ),
  q(
    'Q28',
    'C08',
    'consent',
    [
      'The ePCR will not finalize without a glucose value for this patient.',
      'The glucometer failed and no glucose was obtained.',
    ],
    'What should the paramedic do?',
    [
      ['a', 'Enter a normal value to clear the validation.', 'Entering a value that was never measured is fabrication.'],
      ['b', 'Document that glucose was not obtained and why (meter failure), using the field’s not-obtained option or the agency’s exception process.', 'Correct. Validation rules prompt an assessment; they are not satisfied by inventing one.'],
      ['c', 'Enter the sending facility’s last value as today’s reading.', 'Outside values may be recorded only if attributed and timed, never as the crew’s own reading.'],
      ['d', 'Leave the chart unfinalized indefinitely.', 'Finalize truthfully and use the exception route.'],
    ],
    ['b'],
    ['R09', 'R14'],
    true,
  ),
  q(
    'Q29',
    'C08',
    'consent',
    ['An instructor wants to use a real PCR for a class exercise after deleting the patient’s name.'],
    'Is that sufficient?',
    [
      ['a', 'Yes. Removing the name de-identifies it.', 'Dates, locations, rare conditions and free text can still identify a patient.'],
      ['b', 'No. Removing a name is not de-identification. Use a synthetic case, or a record properly de-identified under the privacy policy.', 'Correct.'],
      ['c', 'Yes, if the class is internal.', 'Internal use does not de-identify a record.'],
      ['d', 'Yes, if the date is also removed.', 'Still not the full Safe Harbor or Expert Determination process.'],
    ],
    ['b'],
    ['R17', 'R18'],
  ),
  q(
    'Q30',
    'C07',
    'consent',
    ['A crew assesses a patient at a facility. The transport is canceled before loading.'],
    'How is this documented?',
    [
      ['a', 'Not at all, because there was no transport.', 'An assessment is a patient encounter, and Kansas requires documentation for every patient assessed.'],
      ['b', 'As a completed transport, since the crew was dispatched.', 'That implies a transport that did not happen.'],
      ['c', 'Record the encounter, findings, any care, and the actual disposition (canceled, not transported).', 'Correct.'],
      ['d', 'As a patient refusal.', 'Use the actual disposition. A facility cancellation is not a patient refusal.'],
    ],
    ['c'],
    ['R15'],
  ),
]

/**
 * Ungraded baseline (C00). Reported separately from the post-test and never
 * counted toward completion.
 */
export const BASELINE: Question[] = [
  q('B01', 'C00', 'agreement', ['"BP 132/84 at 1405."'], 'What kind of statement is this?', [
    ['a', 'Observed', 'Correct — a measurement the crew took.'],
    ['b', 'Reported', 'Nothing attributes it to someone else.'],
    ['c', 'Assumed', 'It is a measurement, not an inference.'],
  ], ['a'], ['R09']),
  q('B02', 'C00', 'agreement', ['"Per daughter, pt has been more confused for two days."'], 'What kind of statement is this?', [
    ['a', 'Observed', 'The crew did not observe the two days.'],
    ['b', 'Reported', 'Correct — attributed to the daughter.'],
    ['c', 'Assumed', 'It is attributed, not inferred.'],
  ], ['b'], ['R09']),
  q('B03', 'C00', 'agreement', ['"Pt probably fell from bed."'], 'What kind of statement is this?', [
    ['a', 'Observed', 'No one saw the fall.'],
    ['b', 'Reported', 'No source is given.'],
    ['c', 'Assumed', 'Correct — an inference. Say what it is based on, or leave it out.'],
  ], ['c'], ['R09']),
  q('B04', 'C00', 'agreement', [], 'Lung sounds were not checked. What should the record say?', [
    ['a', 'Clear', 'That reports an exam that did not happen.'],
    ['b', 'Not assessed', 'Correct.'],
    ['c', 'Leave it blank and say nothing', 'A blank cannot be told apart from an omission. Say "not assessed" and why.'],
  ], ['b'], ['R14']),
  q('B05', 'C00', 'necessity', [], 'Does a diagnosis by itself establish ambulance necessity?', [
    ['a', 'Yes', 'A diagnosis alone does not show other transport was contraindicated.'],
    ['b', 'No', 'Correct.'],
  ], ['b'], ['R03']),
  q('B06', 'C00', 'accuracy', [], 'Can a finalized PCR be corrected?', [
    ['a', 'No, never', 'Properly identified amendments are allowed.'],
    ['b', 'Yes, by overwriting it', 'Overwriting hides the original.'],
    ['c', 'Yes, with an identified, dated, attributed amendment that keeps the original', 'Correct.'],
  ], ['c'], ['R09']),
  q('B07', 'C00', 'level', [], 'Does a paramedic on board make a transport ALS?', [
    ['a', 'Yes', 'The level follows the patient’s required care.'],
    ['b', 'No', 'Correct.'],
  ], ['b'], ['R05']),
  q('B08', 'C00', 'signatures', [], 'Is a physician certification statement required for every ambulance transport?', [
    ['a', 'Yes', 'The rule applies to specific nonemergency categories.'],
    ['b', 'No', 'Correct.'],
  ], ['b'], ['R02']),
  q('B09', 'C00', 'routing', [], 'Once a patient is on hospice, can documentation be reduced?', [
    ['a', 'Yes', 'Hospice enrollment does not eliminate assessment or documentation.'],
    ['b', 'No', 'Correct.'],
  ], ['b'], ['R12']),
  q('B10', 'C00', 'consent', [], 'A reviewer asks you to add a finding you do not remember. What do you do?', [
    ['a', 'Add it — the reviewer knows best', 'A request does not create a finding.'],
    ['b', 'Say it was not done, or that you cannot recall', 'Correct.'],
  ], ['b'], ['R09']),
]

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(
  [...EXAM_FORM_A, ...BASELINE].map((x) => [x.id, x]),
)
