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
  /**
   * A practice chart, not a patient's.
   *
   * Elite training and test records come through the same export, and a
   * month's numbers that include them are a month's numbers nobody can use.
   * Reported rather than dropped silently: a run the reviewer expected to see
   * and cannot find is worse than one they were told about.
   */
  isTestRecord: boolean
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

/**
 * A drug the narrative says was GIVEN, as opposed to one it merely names.
 *
 * The distinction is the whole of this. A narrative mentions drugs for three
 * reasons — the crew gave one, the patient takes one at home, or the crew
 * considered one and did not give it — and only the first is a charting gap
 * when the Medications section is empty. Reported as a stop flag on all three,
 * this said "Aspirin not charted" on every cardiac patient who takes a daily
 * 81mg, and a flag that is wrong four times out of five stops being read.
 */
export interface NarrativeDrug {
  name: string
  /**
   * Given before this crew arrived, or by somebody else.
   *
   * Still worth charting — the question asks for medications "including those
   * given by other caregivers" — but not the same thing as a drug this crew
   * pushed and never recorded, so it does not stop a chart.
   */
  givenByOthers: boolean
}

/**
 * Words near a drug that mean it was not given.
 *
 * The bare "no " of the source spec is deliberately narrowed to the phrases
 * that are actually about a drug. Inside an 80-character window "no " matches
 * "no distress", "no allergies", "no obvious injury" — ordinary narrative
 * furniture that sits near a drug name constantly — and suppressing a finding
 * on that is a worse failure than the false positive it prevents: a missing
 * medication entry nobody is told about.
 */
const DRUG_NOT_GIVEN =
  /\b(attempt|unsuccessful|without success|unable|refus|declin|denies|denied|considered|held|withheld|not (given|indicated|administered|required)|no (iv|access|meds?|medications?|dose|doses))\b/i

/** Words near a drug that mean the patient takes it, rather than got it today. */
const DRUG_IS_HISTORY =
  /\b(takes|taking|took|prescribed|home med|daily|bid|tid|qid|qd|prn|history of|hx|medication list|current medications|compliant with)\b/i

/** Words near a drug that mean somebody other than this crew gave it. */
const DRUG_BY_OTHERS =
  /\b(pta|prior to (our |ems )?arrival|by (family|bystander|fire|first responders?|staff|nursing|facility|pd|police)|(family|bystander|fire|staff|nursing|facility|pd|police) (gave|administered|had given))\b/i

/**
 * Drop a narrative's history section before looking for drugs in it.
 *
 * KC crews write DCHAT, and the H section is a list of what the patient takes.
 * Every drug in it is a false positive by construction, and no window around a
 * single word is going to work out that "aspirin, lisinopril, metoprolol" is a
 * list rather than a treatment.
 *
 * The lookahead names the sections that can follow rather than ending at the
 * first colon, because a narrative is full of colons ("Pt states: ..."), and
 * because stopping at the end of the string when there is no A section would
 * take the treatment section with it — losing the findings this is here to
 * catch.
 */
function stripHistorySection(narrative: string): string {
  return narrative.replace(
    /(^|\n)[ \t]*(h|hx|history)[ \t]*[:\-][\s\S]*?(?=\n[ \t]*(?:a|assessment|t|treatment|transport|r|rx|d|dispatch|c|chief complaint)[ \t]*[:\-]|$)/i,
    '\n',
  )
}

/** Drugs a narrative says were given, by canonical name. */
export function drugsInNarrative(narrative: string): NarrativeDrug[] {
  const text = ` ${stripHistorySection(narrative).toLowerCase()} `
  const out: NarrativeDrug[] = []
  for (const name of KNOWN_DRUGS) {
    const words = [name.toLowerCase(), ...(DRUG_ALIASES[name] ?? [])]
    for (const w of words) {
      // Word boundaries, not substrings: "ns" and "epi" would otherwise match
      // inside half the words in a narrative.
      const re = new RegExp(`(^|[^a-z])(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})([^a-z]|$)`)
      const m = re.exec(text)
      if (!m) continue
      // "ns" is two letters, and the only time a crew means saline by them is
      // beside a volume. Left as a bare word it matched "pt's ns exam", initials
      // and half the abbreviations in a narrative.
      if (
        w === 'ns' &&
        !/\bns\b[^a-z0-9]{0,4}\d|\d+\s*(?:ml|cc|l|liters?)?\s*(?:of\s+)?\bns\b/.test(text)
      ) continue
      const at = m.index + m[1].length
      const window = text.slice(Math.max(0, at - 80), at + w.length + 80)
      // One look decides the drug: a mention that reads as history or as a
      // drug not given is not evidence that a later mention was given either,
      // and chasing further mentions only re-raises the flag this removes.
      if (DRUG_NOT_GIVEN.test(window) || DRUG_IS_HISTORY.test(window)) break
      out.push({ name, givenByOthers: DRUG_BY_OTHERS.test(window) })
      break
    }
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

/**
 * The five things a KC narrative is expected to cover.
 *
 * DCHAT is the house format: Dispatch, Chief complaint, History, Assessment,
 * Treatment. A character count catches the narrative that says nothing; this
 * catches the one that is long enough and still leaves out the history or the
 * handover. Crew labels are preferred where the crew wrote them, because a
 * labelled "H:" is the crew saying which part is which.
 */
const DCHAT: [string, string, RegExp][] = [
  ['D', 'dispatch', /\b(dispatched|responded|en ?route|called (to|for)|lights and sirens|non-?emergent)\b/i],
  ['C', 'chief complaint', /\b(chief complaint|c\/o|complain(s|ing|ed) of|states|reports)\b/i],
  ['H', 'history', /\b(history|hx|pmh|medications?|allergies|nkda|denies|prior to)\b/i],
  ['A', 'assessment', /\b(gcs|avpu|a&ox?\d|alert|lung sounds|skin|pupils|assessment|vitals?|bp \d|hr \d)\b/i],
  ['T', 'treatment and handover', /\b(administered|given|placed|applied|established|transported|report given|care transferred|transfer of care)\b/i],
]

/** The DCHAT elements a narrative does not cover, by name. */
export function missingNarrativeElements(narrative: string): string[] {
  const labelled = new Set(
    [...narrative.matchAll(/(^|\n)\s*([DCHAT])\s*[:\-]/gi)].map((m) => m[2].toUpperCase()),
  )
  return DCHAT.filter(([letter, , re]) => !labelled.has(letter) && !re.test(narrative)).map(
    ([, name]) => name,
  )
}

/**
 * A chart built for practice rather than for a patient.
 *
 * Elite training and test records go through the same export, and a month's
 * numbers that include them are a month's numbers nobody can use. The markers
 * are the ones KC uses; the patient name is never parsed here, so the narrative
 * and the run number are what there is to go on.
 */
export function looksLikeTestRecord(chart: Pick<PcrChart, 'isTestRecord' | 'narrative'>): boolean {
  return chart.isTestRecord === true || /zztest|\*{2,}\s*training/i.test(chart.narrative ?? '')
}

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

  // A refusal AFTER an assessment, which is a different chart from a call that
  // cleared without a patient. The distinction is whether anything was found
  // out about the patient: a crew who took vitals, formed an impression or
  // treated before the patient declined has a chart to defend, and the no-
  // patient-contact block does not ask any of the questions that defend it.
  const refused =
    said(chart.transportDisposition, 'patient refused transport', 'refused transport') ||
    said(chart.patientEvaluation, 'refused') ||
    has(chart.refusalReason)
  const assessed =
    chart.vitalsCount > 0 || has(chart.primaryImpression) || chart.medications.length > 0 || chart.hasGcs
  if (refused && assessed) return ['refusal']

  // Unit Disposition and Patient Evaluation/Care are the fields that decide the
  // rest. Crew Disposition is not: "Back in Service, No Care/Support Services
  // Required" is what a crew records after a cancelled-on-scene call, and it
  // reads as "no patient" while sometimes describing one.
  const noPatient =
    said(chart.unitDisposition, 'no patient', 'cancelled', 'canceled') ||
    said(chart.patientEvaluation, 'not applicable') ||
    // A refusal before anything was assessed IS a no-contact call, and that
    // block asks the right question of it: why was no care provided.
    refused
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

// ----- times -----------------------------------------------------------------
//
// Out-of-order times are the costliest ordinary error on a chart: in live
// testing two of them fired nine separate Elite rules, none of which named the
// cause. What a reviewer needs is the one pair that broke the sequence.

/** Minutes since epoch for a printed "08/16/2026 16:22:25", or undefined. */
export function parseStamp(printed: string | undefined): number | undefined {
  if (!printed) return undefined
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(printed)
  if (!m) return undefined
  const [, mo, d, y, h, min, sec] = m
  return Date.UTC(+y, +mo - 1, +d, +h, +min, sec ? +sec : 0)
}

/** The call's times, in the order they must run. */
export const TIME_CHAIN: { key: keyof PcrChart; label: string }[] = [
  { key: 'timePsap', label: 'PSAP Call' },
  { key: 'timeDispatchNotified', label: 'Dispatch Notified' },
  { key: 'timeDispatched', label: 'Unit Notified by Dispatch' },
  { key: 'timeEnRoute', label: 'Unit En Route' },
  { key: 'timeArrivedScene', label: 'Unit Arrived on Scene' },
  { key: 'timeArrivedPatient', label: 'Arrived at Patient' },
  { key: 'timeLeftScene', label: 'Unit Left Scene' },
  { key: 'timeArrivedDestination', label: 'Patient Arrived at Destination' },
  { key: 'timeTransferOfCare', label: 'Destination Patient Transfer of Care' },
  { key: 'timeBackInService', label: 'Unit Back in Service' },
]

export interface ChainProblem {
  /**
   * 'midnight' is the same fault with a known cause: the writer takes the date
   * and the time as separate inputs, so a call running through midnight gets
   * the clock advanced and the date left behind. Worth naming, because the fix
   * is one field rather than a hunt.
   */
  kind: 'out-of-order' | 'midnight'
  label: string
  value: string
  previousLabel: string
  previousValue: string
}

/**
 * The FIRST pair of times that runs backwards, and nothing after it.
 *
 * One root cause, deliberately. A single wrong time puts every later time out
 * of order with it, and a list of nine problems is a list nobody reads to the
 * end of. Missing times are skipped rather than treated as zero: a chart with
 * no PSAP time is not a chart whose PSAP time is wrong.
 */
export function firstOutOfOrder(chart: PcrChart): ChainProblem | undefined {
  let prev: number | undefined
  let prevLabel = ''
  let prevValue = ''
  for (const { key, label } of TIME_CHAIN) {
    const printed = chart[key] as string | undefined
    const t = parseStamp(printed)
    if (t === undefined) continue
    if (prev !== undefined && t < prev) {
      // Same calendar day, clock wound back from late evening to early
      // morning: the crew advanced the time and not the date.
      const sameDay = new Date(t).getUTCDate() === new Date(prev).getUTCDate()
      const wrapped = new Date(prev).getUTCHours() >= 20 && new Date(t).getUTCHours() <= 4
      return {
        kind: sameDay && wrapped ? 'midnight' : 'out-of-order',
        label,
        value: printed ?? '',
        previousLabel: prevLabel,
        previousValue: prevValue,
      }
    }
    prev = t
    prevLabel = label
    prevValue = printed ?? ''
  }
  return undefined
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
  const uncharted = narrativeDrugs.filter((d) => !chartedDrugs.has(d.name))
  // Split by who gave it. A drug this crew pushed and never charted is a claim
  // that cannot be defended; one the family gave before arrival is a field the
  // crew should have filled in, which is worth a reviewer's eye but not worth
  // holding the chart for.
  const missingByCrew = uncharted.filter((d) => !d.givenByOthers).map((d) => d.name)
  const missingByOthers = uncharted.filter((d) => d.givenByOthers).map((d) => d.name)
  const missingDrugs = uncharted.map((d) => d.name)
  if (missingByCrew.length) {
    flag(
      'stop',
      `${missingByCrew.join(', ')} in the narrative only`,
      `The narrative describes giving ${missingByCrew.join(', ')}, but the Medications section has no entry. A drug given and not charted is not billable and not defensible.`,
      'trt.medications',
    )
  }
  if (missingByOthers.length) {
    flag(
      'look',
      `${missingByOthers.join(', ')} given before this crew, not charted`,
      `The narrative says ${missingByOthers.join(', ')} was given by somebody else before or on arrival. The Medications section asks for those too, and it has no entry.`,
      'trt.medications',
    )
  }

  // A 12-lead lives in the Medical Devices table, not the Procedures table, and
  // so does the monitor. Comparing the narrative against Procedures alone
  // reports every cardiac chart as missing the 12-lead it plainly recorded.
  const chartedProcedures = new Set(chart.procedureNames)
  if (chart.hasTwelveLead) chartedProcedures.add('12-lead ECG')
  if (chart.hasCardiacMonitor) chartedProcedures.add('Cardiac monitoring')
  // Oxygen is a procedure on some KC charts and a medication on others, and
  // both are correct. Reading Procedures alone reported "oxygen in the
  // narrative only" on every chart of the second kind.
  if (chart.hasOxygen) chartedProcedures.add('Oxygen administration')
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

  // ----- the times ----------------------------------------------------------
  //
  // Raised for every review type, before anything else that reads a time. A
  // chart whose times run backwards is wrong whether it carried a patient, a
  // flight crew or nobody at all, and everything downstream — monitoring,
  // mileage, the clinical window — is being measured against a sequence that
  // does not hold.

  const chain = firstOutOfOrder(chart)
  if (chain) {
    flag(
      'stop',
      chain.kind === 'midnight'
        ? 'The call runs past midnight and the date was not advanced'
        : `${chain.label} is before ${chain.previousLabel}`,
      chain.kind === 'midnight'
        ? `${chain.previousLabel} is ${chain.previousValue} and ${chain.label} is ${chain.value} — the same day. The writer takes the date and the time as separate fields, so the clock was advanced and the date was left behind.`
        : `${chain.previousLabel} is ${chain.previousValue} and ${chain.label} is ${chain.value}. One of the two is wrong; every later time is out of order with it, so this is the only one worth reading.`,
      'ovr.nearMiss',
    )
  }

  // Clinical times outside the window the crew had the patient.
  //
  // Only the vitals, for now: they are the one clinical table whose row
  // timestamps this parser reads. The usual cause is a CAD download into an
  // open report, which replaces the response times and leaves the manually
  // entered clinical times where they were.
  const careFrom = parseStamp(chart.timeArrivedPatient) ?? parseStamp(chart.timeArrivedScene)
  const careTo = parseStamp(chart.timeTransferOfCare) ?? parseStamp(chart.timeArrivedDestination)
  const vitalStamps = chart.vitalsTimes
    .map((v) => ({ printed: v, at: parseStamp(v) }))
    .filter((v): v is { printed: string; at: number } => v.at !== undefined)
  const outsideCare = vitalStamps.filter(
    (v) => (careFrom !== undefined && v.at < careFrom) || (careTo !== undefined && v.at > careTo),
  )
  if (outsideCare.length && !chain) {
    const allBefore =
      careFrom !== undefined &&
      vitalStamps.length > 0 &&
      outsideCare.length === vitalStamps.length &&
      vitalStamps.every((v) => v.at < (parseStamp(chart.timeDispatched) ?? careFrom))
    flag(
      'look',
      allBefore
        ? 'Every clinical time is before the unit was dispatched'
        : `${outsideCare.length} clinical time${outsideCare.length === 1 ? ' is' : 's are'} outside the crew's contact with the patient`,
      allBefore
        ? `The response times look consistent but every set of vitals is stamped before ${chart.timeDispatched || 'the unit was notified'} — the fingerprint of a CAD download into an open report, which replaces the response times and leaves the manually entered clinical times behind.`
        : `Vitals at ${outsideCare.map((v) => v.printed).join(', ')} fall outside ${chart.timeArrivedPatient || chart.timeArrivedScene || 'arrival'} to ${chart.timeTransferOfCare || chart.timeArrivedDestination || 'transfer of care'}. Unless they were taken prior to arrival, one of the times is wrong.`,
      'asm.monitoring',
    )
  }

  // One person cannot both drive and be the caregiver in the back.
  //
  // Elite does not catch it, and it is usually a copied crew row rather than a
  // claim about what happened — but it is on a record that says who treated the
  // patient, and the per-crew tally is built from exactly that.
  const bothRoles = chart.crew.filter(
    (c) => /driver|pilot/i.test(c.role ?? '') && /primary patient caregiver/i.test(c.role ?? ''),
  )
  if (bothRoles.length) {
    flag('look', `${bothRoles.map((c) => c.name).join(', ')} is recorded as driver and primary caregiver`,
      'One person cannot drive the truck and be the primary caregiver in the back of it on the same transport. Usually a crew row copied from another chart.',
      'dem.signatures')
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

    /**
     * Phone and email, and the answer is No without the phone.
     *
     * A deliberate decision rather than an oversight: Elite accepts "Unable to
     * Complete" on the phone field and fires no rule, which is why it is so
     * often what the field says. This is a documentation review and the number
     * is what the billing office chases afterwards, so a chart without one is
     * marked down — but the reason says which of the two is missing, so nobody
     * has to open the chart to find out.
     */
    say('dem.contact', chart.hasPhone, 'read',
      chart.hasPhone && chart.hasEmail
        ? 'A phone number and an email address are recorded.'
        : chart.hasPhone
          ? 'A phone number is recorded; no email address.'
          : 'No phone number — the field says Unable to Complete or is blank.')
    if (chart.hasPhone && !chart.hasEmail) {
      flag('look', 'No email address recorded',
        'The phone number is there. Elite warns on the missing email at weight 0, so it never blocks the chart and is easy to leave out.',
        'dem.contact')
    }

    say('dem.signatures', signaturesOk, 'read', signatureBecause)

    // Assessment
    say('asm.reasonSupported', has(chart.primaryImpression) && narrative.length > 0, 'inferred',
      has(chart.primaryImpression) ? `Primary impression "${chart.primaryImpression}" with a narrative to match it against.` : 'No primary impression recorded.')

    say('asm.history', has(chart.medicalHistory), 'read',
      has(chart.medicalHistory) ? `History recorded: ${chart.medicalHistory}.` : 'Medical/Surgical History is blank.')

    /**
     * Monitored DURING TRANSPORT, which a count of sets cannot answer.
     *
     * Two sets taken on scene before the truck moved satisfied "vitalsCount >=
     * 2" and passed a question about the ride. Where the chart carries the
     * times, the sets are placed against them: at least one between leaving the
     * scene and arriving at the destination. Where it does not — the export is
     * missing one of the two times — the old count is the honest fallback, and
     * it says so in its reason rather than claiming to have checked.
     */
    const leftScene = parseStamp(chart.timeLeftScene)
    const arrived = parseStamp(chart.timeArrivedDestination)
    const stamps = chart.vitalsTimes.map(parseStamp).filter((t): t is number => t !== undefined)
    const canTime = transported && leftScene !== undefined && arrived !== undefined && stamps.length > 0
    const enRoute = canTime ? stamps.filter((t) => t > leftScene! && t <= arrived!) : []
    const monitored = !transported || (canTime ? enRoute.length >= 1 : chart.vitalsCount >= 2)
    say('asm.monitoring', monitored, canTime ? 'read' : 'inferred',
      chart.vitalsCount === 0 ? 'No vital signs recorded at all.'
        : canTime
          ? enRoute.length
            ? `${enRoute.length} of ${chart.vitalsCount} set${chart.vitalsCount === 1 ? '' : 's'} taken between leaving the scene and arriving.`
            : `${chart.vitalsCount} set${chart.vitalsCount === 1 ? '' : 's'} of vitals, none between leaving the scene and arriving.`
          : `${chart.vitalsCount} set${chart.vitalsCount === 1 ? '' : 's'} of vitals recorded; the chart does not carry the times to place them in the transport.`)
    if (transported && chart.vitalsCount === 0) {
      flag('stop', 'No vital signs on a transport', 'The patient was carried by this crew with no vital signs recorded anywhere in the chart.', 'asm.monitoring')
    } else if (canTime && enRoute.length === 0) {
      flag('look', 'No vitals taken during the transport',
        `All ${chart.vitalsCount} set${chart.vitalsCount === 1 ? '' : 's'} were taken before the unit left the scene. Nothing in the chart shows the patient was monitored on the way.`,
        'asm.monitoring')
    } else if (canTime && enRoute.length === 1 && arrived - leftScene >= 30 * 60 * 1000) {
      flag('look', 'One set of vitals on a long transport',
        `${Math.round((arrived - leftScene) / 60000)} minutes from scene to destination with one set of vitals taken during it.`,
        'asm.monitoring')
    } else if (!canTime && transported && chart.vitalsCount === 1) {
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
    // The floor catches the narrative that says nothing. The elements catch the
    // one that is long enough and still never says what the history was or who
    // the patient was handed to — which a character count cannot tell apart
    // from a good chart.
    const missingElements = narrative.length >= NARRATIVE_FLOOR ? missingNarrativeElements(narrative) : []
    say('ovr.narrativeClear', narrative.length >= NARRATIVE_FLOOR, 'read',
      narrative.length === 0
        ? 'There is no narrative.'
        : missingElements.length
          ? `Narrative is ${narrative.length} characters and does not cover ${missingElements.join(', ')}.`
          : `Narrative is ${narrative.length} characters.`)
    if (narrative.length < NARRATIVE_FLOOR) {
      flag('stop', narrative.length === 0 ? 'No narrative' : 'Narrative is very short',
        narrative.length === 0
          ? 'The export contains no Patient Care Report Narrative.'
          : `${narrative.length} characters is not enough to support a transport.`,
        'ovr.narrativeClear')
    } else if (missingElements.length) {
      flag('look', `Narrative does not cover ${missingElements.join(', ')}`,
        `Long enough, but nothing in it reads as ${missingElements.join(' or ')}. The house format is DCHAT — dispatch, chief complaint, history, assessment, treatment and handover.`,
        'ovr.narrativeClear')
    }

    say('ovr.safeDecisions', true, 'assumed', 'Clinical safety is a judgement the export cannot make.')
  }

  // ----- refusals -----------------------------------------------------------
  //
  // The chart most likely to be read by a lawyer, and the one the export can
  // say least about: capacity, risks and alternatives live in the narrative in
  // whatever words the crew chose. So these are read where a field answers them
  // and scanned for where only the narrative does — and a scan that finds
  // nothing is reported as a look, never as a finding on its own.

  if (types.includes('refusal')) {
    const narr = narrative.toLowerCase()
    const capacityWords = /\b(a&ox?\s*4|alert and oriented|oriented x ?4|capacity|competent|gcs 15)\b/i
    const capacity = chart.hasGcs || chart.hasAvpu || capacityWords.test(narr)
    say('ref.capacity', capacity, chart.hasGcs || chart.hasAvpu ? 'read' : 'inferred',
      chart.hasGcs || chart.hasAvpu
        ? `Mental status recorded (${[chart.hasGcs && 'GCS', chart.hasAvpu && 'AVPU'].filter(Boolean).join(', ')}).`
        : capacity
          ? 'The narrative describes the patient as oriented.'
          : 'No GCS, no AVPU, and nothing in the narrative about the patient’s capacity to refuse.')
    if (!capacity) {
      flag('stop', 'Nothing records the patient’s capacity to refuse',
        'No GCS, no AVPU and no statement of orientation. A refusal is defended on the patient having been able to make the decision.',
        'ref.capacity')
    }

    const risks = /\b(risks?|refus\w* against|ama|against medical advice|death|die|dying|disab|deteriorat|worse)\b/i.test(narr)
    say('ref.risks', risks, 'inferred',
      risks ? 'The narrative mentions the risks of refusing.' : 'Nothing in the narrative reads as the risks of refusing being explained.')
    if (!risks) {
      flag('look', 'Risks of refusing not described',
        'Nothing in the narrative reads as the crew explaining what could happen. "Advised to seek care" is not a risk.',
        'ref.risks')
    }

    const alternatives = /\b(alternativ|own (doctor|physician|pcp)|pcp|urgent care|call (us )?back|call 911 again|return precautions|follow up)\b/i.test(narr)
    say('ref.alternatives', alternatives, 'inferred',
      alternatives ? 'The narrative mentions alternatives or return precautions.' : 'Nothing in the narrative reads as an alternative being offered.')

    say('ref.signature', chart.signedByPatient, 'read',
      chart.signedByPatient
        ? 'A signature block was signed by the patient or their representative.'
        : 'No signature block signed by the patient or a representative.')
    if (!chart.signedByPatient) {
      flag('look', 'No patient signature on a refusal',
        'Nothing in the chart records the patient signing, and nothing records a witness to their declining to.',
        'ref.signature')
    }

    say('ref.vitals', chart.vitalsCount > 0, 'read',
      chart.vitalsCount > 0
        ? `${chart.vitalsCount} set${chart.vitalsCount === 1 ? '' : 's'} of vitals recorded.`
        : 'No vital signs recorded anywhere in the chart.')
    if (chart.vitalsCount === 0) {
      flag('stop', 'No vital signs on a refusal',
        'The patient was assessed enough to decline transport, and nothing was measured. This is the refusal that cannot be defended afterwards.',
        'ref.vitals')
    }

    const handover = /\b(left (with|in|at)|remained|family|police|pd|officer|scene with|at home|care of)\b/i.test(narr)
    say('ref.handover', handover, 'inferred',
      handover ? 'The narrative says where and with whom the patient was left.' : 'The narrative does not say who the patient was left with.')
  }

  // ----- outcome, asked on every review -------------------------------------

  const doseProblem = flags.some((x) => x.questionId === 'ovr.nearMiss')
  say('ovr.nearMiss', doseProblem, doseProblem ? 'read' : 'assumed',
    doseProblem ? 'A medication is charted in the wrong unit.' : 'Nothing in the export reads as a near miss.')
  say('ovr.safetyConcerns', false, 'assumed', 'Nothing in the export reads as a safety concern.')

  const stops = flags.filter((x) => x.severity === 'stop')
  say('ovr.escalate', stops.length > 0, stops.length ? 'read' : 'assumed',
    stops.length ? `${stops.length} item${stops.length === 1 ? '' : 's'} need a human: ${stops.map((x) => x.title).join('; ')}.` : 'Nothing here needs clinical leadership.')

  // Lights and sirens carried on a patient who was not that sick.
  //
  // Not scored — the two L&S questions are flags by design, because a No is the
  // good answer as often as not. But a lights-and-sirens transport of a patient
  // the crew themselves graded low acuity is the one combination worth a
  // reviewer's eye: it is the version of this that carries crash risk for no
  // clinical return, and nothing upstream puts the two fields side by side.
  if (
    categories.includes('Lights and Sirens') &&
    said(chart.transportDescriptors, 'lights and sirens') &&
    said(chart.finalAcuity, 'lower', 'minor', 'non-acute', 'stable')
  ) {
    flag('look', 'Transported lights and sirens at low acuity',
      `Transport mode is lights and sirens and Final Patient Acuity is "${chart.finalAcuity}". Either the acuity or the mode wants explaining in the narrative.`,
      'ls.transport')
  }

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
    isTestRecord: looksLikeTestRecord(chart),
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
