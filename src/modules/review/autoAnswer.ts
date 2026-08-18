// ---------------------------------------------------------------------------
// Turning a parsed chart into a filled-in review.
//
// This is the whole point of the bulk import: a reviewer's time should go to
// the charts that need a judgement, not to ticking Yes down a form for the
// twenty-eight calls that were documented properly. So every question gets an
// answer, and a chart that raises nothing is finished the moment it is read.
//
// Three things are kept apart deliberately:
//
//   - The ANSWER. Always given. A question nobody can answer from the export
//     gets the compliant answer, because the alternative is a reviewer opening
//     every chart to tick the same box.
//   - The CONFIDENCE and the reason. Recorded per answer so the reviewer can
//     see which answers were read off the chart and which were assumed, and so
//     the whole thing can be argued with later.
//   - The FLAGS. The only thing that pulls a human in. A flag means either the
//     chart contradicts itself or a field that matters is missing — never
//     "the parser was unsure", or every chart would flag and nothing would be
//     saved.
//
// The one rule that governs the defaults: an assumption is only allowed to be
// generous where the export genuinely cannot say. Where the export CAN say and
// says nothing — a blank destination on a transport, no vitals on a patient
// carried forty miles — that is a finding, not an unknown.
// ---------------------------------------------------------------------------

import {
  compliantAnswer,
  PATIENT_CARE_TYPES,
  question,
  visibleQuestions,
  type ReviewAnswers,
  type ReviewType,
} from '../../data/chartReview'
import { DRUG_ALIASES, DRUG_UNITS, KNOWN_DRUGS, type PcrChart } from './pcrParse'

export type Confidence = 'read' | 'inferred' | 'assumed'

export interface AnswerSource {
  confidence: Confidence
  /** One line, shown beside the answer. */
  because: string
}

export interface ChartFlag {
  /** 'stop' pulls the reviewer in; 'look' is worth their eye once they are there. */
  severity: 'stop' | 'look'
  title: string
  detail: string
  /** The question this flag belongs to, when it maps to one. */
  questionId?: string
}

export interface AutoReview {
  incidentNumber: string
  serviceDate?: string
  /**
   * Who the review counts against: the crew member who wrote the report.
   *
   * Not everyone on the truck. A chart is one provider's work, and crediting
   * both means a driver carries their partner's documentation score and a
   * medic's own figure is diluted by charts they never wrote. ImageTrend names
   * the author in "Crew Member Completing this Report" and that is the person
   * a chart review is about.
   */
  crew: string[]
  /** Everyone else on the crew, for context. Not counted, not stored. */
  otherCrew: string[]
  /**
   * The crew's narrative, passed through for the reviewer to read.
   *
   * Deliberately NOT part of the answers or anything that syncs — the import
   * screen files this in the device-local narrative store instead.
   */
  narrative?: string
  types: ReviewType[]
  categories: string[]
  answers: ReviewAnswers
  sources: Record<string, AnswerSource>
  flags: ChartFlag[]
  /** Questions answered non-compliant, in form order. */
  findings: string[]
  /**
   * A starting note for each finding, keyed by question id.
   *
   * The form asks "what was missing or wrong?" under every non-compliant
   * answer, and the reason the app already recorded is very nearly the answer —
   * "Ondansetron described in the narrative with no Medications entry" is what
   * a reviewer would have typed. Pre-filling it means they edit a sentence
   * instead of writing one, and a note that is there gets read by the crew.
   */
  findingNotes: Record<string, string>
  /** True when nothing here needs a human. */
  clear: boolean
}

const has = (s: string | undefined) => typeof s === 'string' && s.trim().length > 0
const said = (s: string | undefined, ...words: string[]) =>
  !!s && words.some((w) => s.toLowerCase().includes(w.toLowerCase()))

/**
 * "Surname, Forename" -> "Forename Surname".
 *
 * Not cosmetic. The crew field is stored as a list and edited as one
 * comma-separated line, so a name with a comma in it splits into two people the
 * moment anyone opens the review and saves — and the per-crew tally, which is
 * the number a new hire is actually judged on, counts them as two half-medics.
 * It also matches how a reviewer types a name by hand, so imported and manual
 * reviews group together instead of sitting in adjacent rows.
 */
function personName(printed: string): string {
  const [surname, forename] = printed.split(',').map((s) => s.trim())
  return forename ? `${forename} ${surname}` : printed.trim()
}

/** A crew list entry and a signature's printed name are the same person. */
function samePerson(listed: string, printed: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z ,]/g, '').split(/[\s,]+/).filter(Boolean).sort().join(' ')
  return norm(listed) === norm(printed)
}

/** Drug names a narrative mentions, by canonical name. */
export function drugsInNarrative(narrative: string): string[] {
  const text = ` ${narrative.toLowerCase()} `
  const out: string[] = []
  for (const name of KNOWN_DRUGS) {
    const words = [name.toLowerCase(), ...(DRUG_ALIASES[name] ?? [])]
    // Word boundaries, not substrings: "ns" and "epi" would otherwise match
    // inside half the words in a narrative.
    const hit = words.some((w) =>
      new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(text),
    )
    if (hit) out.push(name)
  }
  return out
}

/** Procedures a narrative describes, in the vocabulary of the procedures table. */
const NARRATIVE_PROCEDURES: [string, RegExp][] = [
  ['Venous access', /\b(iv access|iv cath|intravenous access|saline lock|started an? iv|iv established)\b/],
  ['Intraosseous access', /\b(io access|intraosseous|ez-?io)\b/],
  ['12-lead ECG', /\b(12[- ]?lead)\b/],
  ['Cardiac monitoring', /\b(4[- ]?lead|cardiac monitor|placed on the monitor)\b/],
  ['Endotracheal intubation', /\b(intubat|ett placed|endotracheal)\b/],
  ['Supraglottic airway', /\b(king airway|igel|i-gel|supraglottic|lma)\b/],
  ['CPR', /\b(cpr|chest compressions)\b/],
  ['Defibrillation', /\b(defibrillat|shocked the|delivered a shock)\b/],
  ['Tourniquet', /\btourniquet\b/],
  ['Splinting', /\b(splint|splinted)\b/],
  ['CPAP', /\bcpap\b/],
  ['Oxygen administration', /\b(nasal cannula|non-?rebreather|nrb|\d+ ?lpm|oxygen (was )?(applied|administered))\b/],
]

/** Words that turn a procedure in a narrative into one that did not happen. */
const NOT_DONE = /attempt|unsuccessful|without success|unable|refus|declin|no (iv|access)|considered/i

export function proceduresInNarrative(narrative: string): string[] {
  const text = narrative.toLowerCase()
  const out: string[] = []
  for (const [name, re] of NARRATIVE_PROCEDURES) {
    const m = re.exec(text)
    if (!m) continue
    // "iv access attempted, x2 times, without success" is not a procedure the
    // Procedures section should carry. Reporting it as one sends a reviewer to
    // a chart that is right, which is the failure this whole feature exists to
    // avoid, so the sentence around the match gets a look first.
    const around = text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60)
    if (NOT_DONE.test(around)) continue
    if (!out.includes(name)) out.push(name)
  }
  return out
}

/**
 * Which review type this chart is.
 *
 * New-hire review is a decision about a person, not a property of the chart, so
 * a bulk import never assigns it — the reviewer marks those. Everything with a
 * patient comes in as CQM.
 */
function reviewTypes(chart: PcrChart): ReviewType[] {
  // A transport with nobody to assess, checked FIRST because these otherwise
  // land in one of the other two and are marked down for every patient-care
  // field they were never going to have. NEMSIS carries "Non-Patient Transport
  // (Not Otherwise Listed)" as a value of both Unit Disposition and Transport
  // Disposition, and Type of Service Requested names the standing cases.
  if (
    said(chart.unitDisposition, 'non-patient transport', 'non patient transport') ||
    said(chart.transportDisposition, 'non-patient transport', 'non patient transport') ||
    said(chart.serviceRequested, 'standby', 'organ', 'mortuary', 'public assistance') ||
    said(chart.natureOfCall, 'standby', 'organ procurement', 'transfer of flight crew')
  ) return ['nonpatient']

  // Unit Disposition and Patient Evaluation/Care are the fields that decide the
  // rest. Crew Disposition is not: "Back in Service, No Care/Support Services
  // Required" is what a crew records after a cancelled-on-scene call, and it
  // reads as "no patient" while sometimes describing one.
  const noPatient =
    said(chart.unitDisposition, 'no patient', 'cancelled', 'canceled') ||
    said(chart.patientEvaluation, 'not applicable')
  return noPatient ? ['nopatient'] : ['cqm']
}

/** Which CQM category blocks this chart earns. */
function categoriesFor(chart: PcrChart): string[] {
  const out: string[] = []
  // "Non-Traumatic" is dropped before matching: it is the exact opposite of
  // what a search for "trauma" is looking for, and it appears on every
  // non-traumatic chest and back pain call.
  const impression = `${chart.primaryImpression ?? ''} ${chart.secondaryImpressions ?? ''} ${chart.natureOfCall ?? ''}`
    .replace(/non-?\s*traumatic/gi, ' ')
  const add = (c: string) => { if (!out.includes(c)) out.push(c) }

  // ImageTrend's own Possible Injury field settles this when it is filled in.
  // Reading the impression instead puts every chest pain call in the trauma
  // block, because "Chest Pain (Non-Traumatic)" contains the word Traumatic —
  // and the trauma block then reports missing triage criteria on a chart that
  // was never a trauma.
  const injury = said(chart.possibleInjury, 'yes')
  const noInjury = said(chart.possibleInjury, 'no')
  if (
    injury ||
    (!noInjury &&
      (has(chart.causeOfInjury) ||
        has(chart.mechanismOfInjury) ||
        said(impression, 'trauma', 'gunshot', 'stab', 'fall', 'assault', 'burn')))
  ) add('Trauma')

  if (said(chart.cardiacArrest, 'yes')) add('Cardiac Arrest')
  if (said(impression, 'stroke', 'cva', 'cerebrovascular')) add('Stroke')
  if (said(impression, 'stemi', 'myocardial infarction')) add('STEMI')
  if (said(impression, 'altered mental', 'unresponsive', 'unconscious')) add('Altered Mental Status')
  if (
    said(impression, 'overdose', 'poisoning') ||
    chart.medications.some((m) => m.name === 'Naloxone')
  ) add('Overdose Management')
  if (chart.procedureNames.some((p) => /Endotracheal|Supraglottic/.test(p))) add('Advanced Airway')
  if (
    said(chart.responseDescriptors, 'lights and sirens') ||
    said(chart.transportDescriptors, 'lights and sirens')
  ) add('Lights and Sirens')

  return out
}

/**
 * Split the crew into the report's author and everyone else.
 *
 * Falls back to the whole crew when the export does not name an author, which
 * is better than crediting nobody — but it is a fallback, and the reason it is
 * one is that the per-crew tally is what a new hire is judged on.
 */
function primaryAndRest(chart: PcrChart): { crew: string[]; otherCrew: string[] } {
  const names = chart.crew.map((c) => personName(c.name))
  if (!chart.reportBy) return { crew: names, otherCrew: [] }
  const author = personName(chart.reportBy)
  return { crew: [author], otherCrew: names.filter((n) => n !== author) }
}

/** True when this chart records a patient being carried somewhere. */
function wasTransported(chart: PcrChart): boolean {
  return said(chart.transportDisposition, 'transport by this ems unit', 'transport by another')
}

export function autoReview(chart: PcrChart): AutoReview {
  const answers: ReviewAnswers = {}
  const sources: Record<string, AnswerSource> = {}
  const flags: ChartFlag[] = []

  const types = reviewTypes(chart)
  const categories = types.includes('cqm') ? categoriesFor(chart) : []
  const transported = wasTransported(chart)
  const narrative = chart.narrative ?? ''

  const say = (id: string, value: boolean | string | string[], confidence: Confidence, because: string) => {
    answers[id] = value
    sources[id] = { confidence, because }
  }
  const flag = (severity: ChartFlag['severity'], title: string, detail: string, questionId?: string) => {
    flags.push({ severity, title, detail, questionId })
  }

  // ----- the two things that need a human even on a tidy chart ---------------

  // A dose in the wrong unit is the error this whole import exists to catch: a
  // fentanyl dose charted in milligrams is a thousandfold off, and it reads as
  // an ordinary row unless someone checks the unit column against the drug.
  for (const med of chart.medications) {
    const expected = DRUG_UNITS[med.name]
    if (!expected || !med.unit || expected.includes(med.unit)) continue
    flag(
      'stop',
      `${med.name} charted as ${med.amount} ${med.unit}`,
      `${med.name} is given in ${expected.join(' or ')}. Either the dose or the unit is wrong on this chart.`,
      'ovr.nearMiss',
    )
  }

  const chartedDrugs = new Set(chart.medications.map((m) => m.name))
  const narrativeDrugs = narrative ? drugsInNarrative(narrative) : []
  const missingDrugs = narrativeDrugs.filter((d) => !chartedDrugs.has(d))
  if (missingDrugs.length) {
    flag(
      'stop',
      `${missingDrugs.join(', ')} in the narrative only`,
      `The narrative describes giving ${missingDrugs.join(', ')}, but the Medications section has no entry. A drug given and not charted is not billable and not defensible.`,
      'trt.medications',
    )
  }

  // A 12-lead lives in the Medical Devices table, not the Procedures table, and
  // so does the monitor. Comparing the narrative against Procedures alone
  // reports every cardiac chart as missing the 12-lead it plainly recorded.
  const chartedProcedures = new Set(chart.procedureNames)
  if (chart.hasTwelveLead) chartedProcedures.add('12-lead ECG')
  if (chart.hasCardiacMonitor) chartedProcedures.add('Cardiac monitoring')
  const narrativeProcedures = narrative ? proceduresInNarrative(narrative) : []
  const missingProcedures = narrativeProcedures.filter((p) => !chartedProcedures.has(p))
  if (missingProcedures.length) {
    flag(
      'look',
      `${missingProcedures.join(', ')} in the narrative only`,
      `The narrative describes ${missingProcedures.join(', ')} with no matching entry in the Procedures section.`,
      'trt.procedures',
    )
  }

  // ----- signatures ---------------------------------------------------------

  const unsigned = chart.crew.filter((c) => !chart.signedBy.some((s) => samePerson(c.name, s)))
  const signaturesOk = chart.crew.length > 0 && unsigned.length === 0
  const signatureBecause = chart.crew.length === 0
    ? 'No crew table found in the export.'
    : unsigned.length
      ? `No signature for ${unsigned.map((c) => c.name).join(', ')}.`
      : `All ${chart.crew.length} crew members signed.`
  if (unsigned.length) {
    flag('stop', 'A crew member did not sign', signatureBecause, types.includes('nopatient') ? 'np.signatures' : 'dem.signatures')
  }

  // ----- no-patient-contact reviews -----------------------------------------

  if (types.includes('nopatient')) {
    say('np.location', has(chart.incidentAddress), has(chart.incidentAddress) ? 'read' : 'read',
      has(chart.incidentAddress) ? `Incident address recorded: ${chart.incidentAddress}.` : 'Incident Address is blank.')
    say('np.disposition', has(chart.crewDisposition), 'read',
      has(chart.crewDisposition) ? `Crew disposition recorded: ${chart.crewDisposition}.` : 'Crew Disposition is blank.')
    say('np.narrative', narrative.length >= 60, 'read',
      narrative.length >= 60 ? `Narrative is ${narrative.length} characters.` : `Narrative is ${narrative.length} characters — too short to explain the call.`)
    say('np.signatures', signaturesOk, 'read', signatureBecause)
    say('np.decisions', true, 'assumed', 'Nothing in the export contradicts the crew’s decisions on scene.')
    if (narrative.length < 60) flag('look', 'Narrative is very short', `Only ${narrative.length} characters explaining why no care was given.`, 'np.narrative')
  }

  // ----- non-patient transports ---------------------------------------------

  if (types.includes('nonpatient')) {
    const purposeStated = narrative.length >= 40
    say('npt.purpose', purposeStated, 'read',
      purposeStated
        ? `Narrative is ${narrative.length} characters.`
        : `Narrative is ${narrative.length} characters — too short to say what was carried or why.`)
    if (!purposeStated) {
      flag('stop', 'Nothing says what this trip was for',
        'A non-patient transport has no impression and no exam to explain it, so the narrative is the only record of what was carried and why.',
        'npt.purpose')
    }

    const dispoNamed = said(chart.unitDisposition, 'non-patient', 'non patient')
      || said(chart.transportDisposition, 'non-patient', 'non patient')
    say('npt.disposition', dispoNamed, 'read',
      dispoNamed
        ? `Disposition: ${chart.unitDisposition || chart.transportDisposition}.`
        : `Read as a non-patient transport from the service type, but the disposition says "${chart.unitDisposition || chart.transportDisposition || 'nothing'}".`)

    const locations = has(chart.incidentAddress) && has(chart.destinationName)
    say('npt.locations', locations, 'read',
      locations ? 'Origin and destination are both recorded.'
        : !has(chart.incidentAddress) ? 'Incident Address is blank.' : 'Destination Name is blank.')
    if (!has(chart.destinationName)) {
      flag('stop', 'No destination on a transport',
        'The run was carried out and billed on the trip, but Destination Name is blank.', 'npt.locations')
    }

    // Mileage is the whole claim on one of these, and there is no patient
    // record to reconstruct it from later.
    const mileage = has(chart.loadedMiles) || (has(chart.odometerStart) && has(chart.odometerEnd))
    say('npt.mileage', mileage, 'read',
      mileage
        ? `Mileage recorded: ${[chart.loadedMiles && `${chart.loadedMiles} loaded`, chart.odometerEnd && `odometer to ${chart.odometerEnd}`].filter(Boolean).join(', ')}.`
        : 'Neither loaded miles nor a pair of odometer readings is recorded.')
    if (!mileage) {
      flag('stop', 'No mileage on a non-patient transport',
        'These bill on mileage and there is no patient record to reconstruct it from afterwards.',
        'npt.mileage')
    }

    const times = [chart.timeDispatched, chart.timeEnRoute, chart.timeArrivedScene, chart.timeBackInService]
    const timesComplete = times.every(has)
    say('npt.times', timesComplete, 'read',
      timesComplete ? 'Dispatch through back in service are all recorded.'
        : `${times.filter((t) => !has(t)).length} of the four unit times is missing.`)

    say('npt.signatures', signaturesOk, 'read', signatureBecause)

    // The failure worth catching here: a template or a copied chart leaving
    // patient care on a run that never had a patient.
    const strayCare = chart.vitalsCount > 0 || has(chart.primaryImpression) || chart.medications.length > 0
    say('npt.noPatientFields', !strayCare, 'read',
      strayCare
        ? `Patient care is documented on a run with no patient: ${[
            chart.vitalsCount > 0 && `${chart.vitalsCount} set(s) of vitals`,
            has(chart.primaryImpression) && `impression "${chart.primaryImpression}"`,
            chart.medications.length > 0 && `${chart.medications.length} medication(s)`,
          ].filter(Boolean).join(', ')}.`
        : 'No vitals, impression or medications, as expected.')
    if (strayCare) {
      flag('stop', 'Patient care on a non-patient transport',
        'This chart records care on a run that had no patient — either it is not a non-patient transport, or documentation has carried over from another chart.',
        'npt.noPatientFields')
    }
  }

  // ----- CQM header ---------------------------------------------------------

  if (types.includes('cqm')) {
    say('cqm.categories', categories, categories.length ? 'inferred' : 'assumed',
      categories.length ? `From the impression and dispatch fields: ${categories.join(', ')}.` : 'Nothing in the chart matched a review category.')
    say('cqm.copa', false, 'assumed', 'Not something the chart records.')
    const ift = said(chart.serviceRequested, 'transfer') || said(chart.natureOfCall, 'transfer', 'interfacility')
    say('cqm.setting', ift ? 'Interfacility (IFT)' : '911 (Scene)', 'read',
      `Type of Service Requested: ${chart.serviceRequested ?? chart.natureOfCall ?? 'not recorded'}.`)
    const als = said(chart.unitCapability, 'ALS')
    const bls = said(chart.unitCapability, 'BLS')
    if (als || bls) say('cqm.careLevel', als ? 'ALS' : 'BLS', 'read', `Unit capability: ${chart.unitCapability}.`)
  }

  // ----- the patient-care backbone ------------------------------------------

  // Gated on the types that review patient care, NOT on "anything but a
  // no-contact call". Written the second way this raised "no narrative" and "no
  // vital signs on a transport" against a flight-crew return — flags for
  // patient-care fields on a run that never had a patient, which is the exact
  // false alarm the non-patient block exists to prevent.
  if (types.some((t) => PATIENT_CARE_TYPES.includes(t))) {
    // Demographics
    const destOk = !transported || has(chart.destinationName)
    say('dem.locations', has(chart.incidentAddress) && destOk, 'read',
      !has(chart.incidentAddress) ? 'Incident Address is blank.'
        : destOk ? 'Incident and destination addresses are both recorded.'
          : 'The patient was transported but Destination Name is blank.')
    if (transported && !has(chart.destinationName)) {
      flag('stop', 'Transport with no destination recorded', 'Transport Disposition says this crew carried the patient, but Destination Name is blank.', 'dem.locations')
    }

    // Only asked of a chart that has a destination. A refusal or a cancelled
    // call has nowhere to justify, and answering No there marks a crew down for
    // leaving blank a field that should be blank.
    say('dem.destinationRationale', !transported || has(chart.destinationReason), 'read',
      !transported ? 'The patient was not transported, so there is no destination to justify.'
        : has(chart.destinationReason) ? `Destination reason: ${chart.destinationReason}.`
          : 'Destination reason is blank.')

    say('dem.appropriateFacility', true, 'assumed',
      'Whether the facility suited the patient is a clinical judgement the export cannot make.')

    say('dem.contact', chart.hasPhone, 'read',
      chart.hasPhone ? 'A phone number is recorded.' : 'No phone number — the field says Unable to Complete or is blank.')

    say('dem.signatures', signaturesOk, 'read', signatureBecause)

    // Assessment
    say('asm.reasonSupported', has(chart.primaryImpression) && narrative.length > 0, 'inferred',
      has(chart.primaryImpression) ? `Primary impression "${chart.primaryImpression}" with a narrative to match it against.` : 'No primary impression recorded.')

    say('asm.history', has(chart.medicalHistory), 'read',
      has(chart.medicalHistory) ? `History recorded: ${chart.medicalHistory}.` : 'Medical/Surgical History is blank.')

    const monitored = !transported || chart.vitalsCount >= 2
    say('asm.monitoring', monitored, 'read',
      chart.vitalsCount === 0 ? 'No vital signs recorded at all.'
        : `${chart.vitalsCount} set${chart.vitalsCount === 1 ? '' : 's'} of vitals recorded.`)
    if (transported && chart.vitalsCount === 0) {
      flag('stop', 'No vital signs on a transport', 'The patient was carried by this crew with no vital signs recorded anywhere in the chart.', 'asm.monitoring')
    } else if (transported && chart.vitalsCount === 1) {
      flag('look', 'One set of vitals only', 'A single set does not show the patient was monitored during transport.', 'asm.monitoring')
    }

    say('asm.examMatches', true, 'assumed', 'Whether the exam matches the complaint is a clinical judgement.')

    // Treatment
    say('trt.standards', true, 'assumed', 'Protocol compliance is a clinical judgement.')
    say('trt.timely', true, 'assumed', 'Timeliness is a clinical judgement.')
    say('trt.procedures', missingProcedures.length === 0, missingProcedures.length ? 'read' : 'inferred',
      missingProcedures.length
        ? `${missingProcedures.join(', ')} described in the narrative with no Procedures entry.`
        : chart.hasProcedures ? `Procedures section records ${chart.procedureNames.join(', ') || 'entries'}.` : 'No procedures in the narrative and none charted.')
    say('trt.medications', missingDrugs.length === 0, missingDrugs.length ? 'read' : 'inferred',
      missingDrugs.length
        ? `${missingDrugs.join(', ')} described in the narrative with no Medications entry.`
        : chart.medications.length ? `Medications section records ${chart.medications.map((m) => `${m.name} ${m.amount} ${m.unit ?? ''}`.trim()).join(', ')}.` : 'No medications in the narrative and none charted.')

    const scales = chart.hasGcs || chart.hasAvpu
    say('trt.assessmentFields', scales, 'read',
      scales ? `Mental status scales recorded (${[chart.hasGcs && 'GCS', chart.hasAvpu && 'AVPU'].filter(Boolean).join(', ')}).` : 'Neither GCS nor AVPU recorded.')

    say('trt.mode', true, 'assumed', 'Whether the transport mode suited the patient is a clinical judgement.')

    // Overall
    const narrativeMatches = missingDrugs.length === 0 && missingProcedures.length === 0
    say('ovr.narrativeMatches', narrativeMatches, narrativeMatches ? 'inferred' : 'read',
      narrativeMatches
        ? 'Every drug and procedure the narrative describes appears in its own section.'
        : `The narrative describes ${[...missingDrugs, ...missingProcedures].join(', ')} that the structured sections do not.`)

    const NARRATIVE_FLOOR = 200
    say('ovr.narrativeClear', narrative.length >= NARRATIVE_FLOOR, 'read',
      narrative.length === 0 ? 'There is no narrative.' : `Narrative is ${narrative.length} characters.`)
    if (narrative.length < NARRATIVE_FLOOR) {
      flag('stop', narrative.length === 0 ? 'No narrative' : 'Narrative is very short',
        narrative.length === 0
          ? 'The export contains no Patient Care Report Narrative.'
          : `${narrative.length} characters is not enough to support a transport.`,
        'ovr.narrativeClear')
    }

    say('ovr.safeDecisions', true, 'assumed', 'Clinical safety is a judgement the export cannot make.')
  }

  // ----- outcome, asked on every review -------------------------------------

  const doseProblem = flags.some((x) => x.questionId === 'ovr.nearMiss')
  say('ovr.nearMiss', doseProblem, doseProblem ? 'read' : 'assumed',
    doseProblem ? 'A medication is charted in the wrong unit.' : 'Nothing in the export reads as a near miss.')
  say('ovr.safetyConcerns', false, 'assumed', 'Nothing in the export reads as a safety concern.')

  const stops = flags.filter((x) => x.severity === 'stop')
  say('ovr.escalate', stops.length > 0, stops.length ? 'read' : 'assumed',
    stops.length ? `${stops.length} item${stops.length === 1 ? '' : 's'} need a human: ${stops.map((x) => x.title).join('; ')}.` : 'Nothing here needs clinical leadership.')

  // ----- category blocks ----------------------------------------------------

  for (const [id, a] of Object.entries(categoryAnswers(chart, categories))) {
    say(id, a.value, a.confidence, a.because)
  }

  // ----- fill anything the mapping missed, so no review is left half-done ----

  for (const q of visibleQuestions(types, categories)) {
    if (q.id in answers) continue
    const fallback = compliantAnswer(q)
    if (fallback === undefined) continue
    say(q.id, fallback, 'assumed', 'No field in the export speaks to this.')
  }

  const findings = visibleQuestions(types, categories)
    .filter((q) => {
      const a = answers[q.id]
      if (typeof a !== 'boolean') return false
      const good = compliantAnswer(q)
      return typeof good === 'boolean' && a !== good
    })
    .map((q) => q.id)

  return {
    incidentNumber: chart.incidentNumber ?? '',
    serviceDate: chart.serviceDateISO,
    ...primaryAndRest(chart),
    narrative: chart.narrative,
    types,
    categories,
    answers,
    sources,
    flags,
    findings,
    findingNotes: Object.fromEntries(
      findings.map((id) => [id, sources[id]?.because ?? '']).filter(([, note]) => note),
    ),
    // What actually pulls a human in.
    //
    // Only 'stop' flags — the chart contradicting itself, or a field that
    // matters left empty. NOT findings: "no phone number recorded" is a fact
    // read straight off the chart, it belongs in the tally, and making a
    // reviewer confirm it by hand is the busywork this feature exists to
    // remove. NOT 'look' flags either; those are a note for whoever opens the
    // chart, not a reason to open it.
    clear: !flags.some((x) => x.severity === 'stop'),
  }
}

/**
 * Category-block answers.
 *
 * Only the questions the export can actually speak to are here; the rest fall
 * through to the compliant default in `autoReview`, which is the honest
 * outcome for a question like "was the destination an appropriate trauma
 * designation" that no field answers.
 */
function categoryAnswers(chart: PcrChart, categories: string[]): Record<string, { value: boolean; because: string; confidence: Confidence }> {
  const out: Record<string, { value: boolean; because: string; confidence: Confidence }> = {}
  const set = (id: string, value: boolean, confidence: Confidence, because: string) => {
    if (question(id)) out[id] = { value, confidence, because }
  }

  if (categories.includes('Trauma')) {
    const criteria = chart.traumaHighRisk !== undefined && chart.traumaModerate !== undefined
      && (chart.traumaHighRisk.trim().length > 0 || chart.traumaModerate.trim().length > 0)
    set('tr.triageCriteria', criteria, 'read',
      criteria ? `Triage criteria recorded: ${[chart.traumaHighRisk, chart.traumaModerate].filter(Boolean).join(' / ')}.` : 'Both trauma triage criteria fields are blank.')
    const mech = has(chart.mechanismOfInjury) || has(chart.causeOfInjury)
    set('tr.mechanism', mech, 'read',
      mech ? `Mechanism recorded: ${[chart.causeOfInjury, chart.mechanismOfInjury].filter(Boolean).join(' — ')}.` : 'Neither Cause nor Mechanism of Injury is recorded.')
    set('tr.gcs', chart.hasGcs, 'read', chart.hasGcs ? 'GCS recorded.' : 'No GCS recorded.')
  }

  if (categories.includes('Lights and Sirens')) {
    const respond = said(chart.responseDescriptors, 'lights and sirens')
    const transport = said(chart.transportDescriptors, 'lights and sirens')
    set('ls.respond', respond, 'read', `Response mode descriptors: ${chart.responseDescriptors || 'blank'}.`)
    set('ls.transport', transport, 'read', `Transport mode descriptors: ${chart.transportDescriptors || 'blank'}.`)
  }

  if (categories.includes('STEMI')) {
    set('stemi.twelveLead', chart.hasTwelveLead, 'read', chart.hasTwelveLead ? 'A 12-lead is recorded in the device table.' : 'No 12-lead in the device table.')
    set('stemi.notification', said(chart.preArrivalAlert, 'yes'), 'read', `Pre-arrival alert: ${chart.preArrivalAlert || 'blank'}.`)
    set('stemi.painScale', chart.hasPainScore, 'read', chart.hasPainScore ? 'A pain score is recorded with the vitals.' : 'No pain score with the vitals.')
  }

  if (categories.includes('Stroke')) {
    set('str.glucose', chart.hasGlucose, 'read', chart.hasGlucose ? 'Blood glucose recorded.' : 'No blood glucose recorded.')
    set('str.notification', said(chart.preArrivalAlert, 'yes'), 'read', `Pre-arrival alert: ${chart.preArrivalAlert || 'blank'}.`)
  }

  if (categories.includes('Altered Mental Status')) {
    set('ams.glucose', chart.hasGlucose, 'read', chart.hasGlucose ? 'Blood glucose recorded.' : 'No blood glucose recorded.')
  }

  if (categories.includes('Overdose Management')) {
    set('od.vitals', chart.vitalsCount > 0, 'read', `${chart.vitalsCount} sets of vitals recorded.`)
  }

  if (categories.includes('Cardiac Arrest')) {
    const airway = chart.procedureNames.some((p) => /Endotracheal|Supraglottic/.test(p))
    set('ca.advancedAirway', airway, 'read', airway ? 'An advanced airway is in the Procedures section.' : 'No advanced airway in the Procedures section.')
    const cpr = chart.procedureNames.includes('CPR')
    set('ca.compressionDevice', cpr, 'inferred', cpr ? 'CPR is recorded in the Procedures section.' : 'No compression device recorded.')
  }

  return out
}
