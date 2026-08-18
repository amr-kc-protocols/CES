// ---------------------------------------------------------------------------
// Pulling the reviewable facts out of an ImageTrend PCR export.
//
// One exported PDF holds several charts back to back, so this splits on the
// per-chart banner and then reads a fixed set of fields from each. Everything
// here is a field lookup — no judgement, no inference. What the fields MEAN for
// a review is autoAnswer.ts's problem, and keeping the two apart is what lets
// the mapping be argued about without anyone re-reading a PDF.
//
// The parse is deliberately conservative: a field that cannot be found comes
// back undefined rather than guessed, because every undefined turns into a
// question a human is asked rather than an answer they were never shown.
// ---------------------------------------------------------------------------

import {
  despace,
  field,
  hasField,
  sliceDoc,
  tableAfter,
  type PcrDoc,
  type PcrView,
} from './pcrText'

export interface PcrMedication {
  /** Canonical drug name from KNOWN_DRUGS. */
  name: string
  /** The number as printed. */
  amount: string
  /** Unit as classified, or undefined when it could not be read. */
  unit?: 'mg' | 'mcg' | 'ml' | 'g' | 'unit'
}

export interface PcrCrew {
  name: string
  id: string
  level?: string
}

export interface PcrChart {
  /** Run number, the only identifier carried forward out of the PDF. */
  incidentNumber?: string
  /** As printed: "08/16/2026 16:14:28". */
  serviceDate?: string
  /**
   * The same date as YYYY-MM-DD.
   *
   * Everything else in this app stores and compares ISO dates, and the date
   * filter is a string comparison — "08/16/2026" sorts nowhere near
   * "2026-08-16", so a review imported with the printed form silently
   * disappears from every range.
   */
  serviceDateISO?: string
  agency?: string
  unit?: string
  callSign?: string
  /** "Ground Transport (ALS Equipped)". */
  unitCapability?: string

  /** "Emergency Response (Primary Response Area)" or "Hospital-to-Hospital Transfer". */
  serviceRequested?: string
  natureOfCall?: string
  primaryImpression?: string
  secondaryImpressions?: string
  acuity?: string
  finalAcuity?: string
  chiefComplaint?: string
  symptomOnset?: string

  incidentAddress?: string
  incidentType?: string
  destinationName?: string
  destinationReason?: string
  destinationType?: string
  /** "Destination Team Pre-Arrival Alert or Activation". */
  preArrivalAlert?: string

  responseMode?: string
  responseDescriptors?: string
  transportMode?: string
  transportDescriptors?: string
  transportDisposition?: string
  unitDisposition?: string
  crewDisposition?: string
  patientEvaluation?: string
  refusalReason?: string

  possibleInjury?: string
  causeOfInjury?: string
  mechanismOfInjury?: string
  traumaHighRisk?: string
  traumaModerate?: string

  medicalHistory?: string
  advanceDirectives?: string
  medicationHistoryTaken: boolean
  allergiesRecorded: boolean
  weightKg?: string
  /** True when a phone number was recorded, false for "Unable to Complete". */
  hasPhone: boolean
  patientBelongings?: string

  crew: PcrCrew[]
  /** Printed names on signature blocks signed as a crew member. */
  signedBy: string[]
  /** Printed names on signature blocks signed by anyone else. */
  otherSignatures: string[]
  /** The crew member the report is attributed to. */
  reportBy?: string

  vitalsCount: number
  hasGcs: boolean
  hasAvpu: boolean
  hasPainScore: boolean
  hasGlucose: boolean
  hasTwelveLead: boolean
  hasCardiacMonitor: boolean
  cardiacArrest?: string

  medications: PcrMedication[]
  hasProcedures: boolean
  procedureNames: string[]

  narrative?: string

  /** Pages this chart occupied, for reporting a parse problem usefully. */
  pageFrom: number
  pageTo: number
}

// ImageTrend prints one of these per chart, so it is the split point.
const INCIDENT = /Incident\s*#\s*:\s*(\d{6,})/

/**
 * Split a multi-chart export into per-chart page ranges.
 *
 * The run number is repeated in later page banners, so a page only starts a
 * chart when it also carries the "EMS Agency" banner that ImageTrend prints
 * once at the top of each report.
 */
export function splitCharts(doc: PcrDoc): { from: number; to: number; incidentNumber: string }[] {
  const starts: { page: number; incidentNumber: string }[] = []
  doc.pages.forEach((text, i) => {
    if (!/EMS Agency\s*:/.test(text)) return
    const m = INCIDENT.exec(text)
    if (!m) return
    if (starts.length && starts[starts.length - 1].incidentNumber === m[1]) return
    starts.push({ page: i + 1, incidentNumber: m[1] })
  })
  return starts.map((s, i) => ({
    from: s.page,
    to: i + 1 < starts.length ? starts[i + 1].page - 1 : doc.pages.length,
    incidentNumber: s.incidentNumber,
  }))
}

/**
 * Drug names worth looking for.
 *
 * A closed list rather than "any capitalised word in the medication table": the
 * point is to check doses on drugs whose units matter, and a list that is
 * missing a name simply skips it instead of inventing one.
 */
export const KNOWN_DRUGS = [
  'Acetaminophen', 'Adenosine', 'Albuterol', 'Amiodarone', 'Aspirin', 'Atropine',
  'Calcium Chloride', 'Dextrose', 'Diphenhydramine', 'Droperidol', 'Epinephrine',
  'Fentanyl', 'Glucagon', 'Haloperidol', 'Hydroxocobalamin', 'Ipratropium',
  'Ketamine', 'Ketorolac', 'Lactated Ringers', 'Lidocaine', 'Magnesium',
  'Methylprednisolone', 'Midazolam', 'Morphine', 'Naloxone', 'Nitroglycerin',
  'Normal Saline', 'Ondansetron', 'Sodium Bicarbonate', 'Tranexamic',
]

/**
 * What a crew is likely to call a drug in a narrative.
 *
 * Narratives are typed at 3am and use brand names — "30mg of tordal", "4mg of
 * zofran". Matching only the generic name would report every one of those as a
 * drug the narrative never mentioned.
 */
export const DRUG_ALIASES: Record<string, string[]> = {
  Acetaminophen: ['tylenol', 'ofirmev', 'apap'],
  Albuterol: ['ventolin', 'proventil', 'duoneb'],
  Amiodarone: ['cordarone', 'amio'],
  Diphenhydramine: ['benadryl'],
  Epinephrine: ['epi', 'adrenaline', 'epipen'],
  Fentanyl: ['fent', 'sublimaze'],
  Ipratropium: ['atrovent', 'duoneb'],
  Ketamine: ['ketalar'],
  Ketorolac: ['toradol', 'tordal', 'terodol'],
  'Lactated Ringers': ['lr', 'ringers'],
  Midazolam: ['versed'],
  Naloxone: ['narcan'],
  Nitroglycerin: ['nitro', 'ntg'],
  'Normal Saline': ['ns', 'saline'],
  Ondansetron: ['zofran'],
  'Sodium Bicarbonate': ['bicarb'],
  Tranexamic: ['txa'],
}

/** Units a drug is expected in, for the dose sanity check. */
export const DRUG_UNITS: Record<string, PcrMedication['unit'][]> = {
  Acetaminophen: ['mg', 'g'],
  Adenosine: ['mg'],
  Albuterol: ['mg', 'ml'],
  Amiodarone: ['mg'],
  Aspirin: ['mg'],
  Atropine: ['mg'],
  Dextrose: ['g', 'ml', 'mg'],
  Diphenhydramine: ['mg'],
  Epinephrine: ['mg', 'mcg'],
  Fentanyl: ['mcg'],
  Glucagon: ['mg', 'unit'],
  Ipratropium: ['mg', 'ml'],
  Ketamine: ['mg'],
  Ketorolac: ['mg'],
  'Lactated Ringers': ['ml'],
  Lidocaine: ['mg'],
  Midazolam: ['mg'],
  Morphine: ['mg'],
  Naloxone: ['mg'],
  Nitroglycerin: ['mg', 'mcg'],
  'Normal Saline': ['ml'],
  Ondansetron: ['mg'],
  Tranexamic: ['mg', 'g'],
}

/**
 * Procedures worth naming.
 *
 * Long names are matched with the spaces removed, so a name the table wrapped
 * mid-word still matches. SHORT names are matched on word boundaries in the
 * text as printed, because despacing runs neighbouring words together and short
 * needles then hit inside them: "Paramedic Protocol" despaces to
 * "paramedicprotocol", which contains "cpr". Charting a cardiac arrest that
 * never happened is the worst failure this file can produce, so short names
 * give up the wrapped-word case rather than risk it.
 */
const KNOWN_PROCEDURES: [string, string][] = [
  ['venous access', 'Venous access'],
  ['vascular access', 'Vascular access'],
  ['intraosseous', 'Intraosseous access'],
  ['12-lead ecg', '12-lead ECG'],
  ['12 lead ecg', '12-lead ECG'],
  ['cardiac monitor', 'Cardiac monitoring'],
  ['endotracheal', 'Endotracheal intubation'],
  ['supraglottic', 'Supraglottic airway'],
  ['bag-valve', 'Bag-valve-mask'],
  ['bag valve', 'Bag-valve-mask'],
  ['cpr', 'CPR'],
  ['chest compression', 'CPR'],
  ['defibrillation', 'Defibrillation'],
  ['cardioversion', 'Cardioversion'],
  ['splint', 'Splinting'],
  ['spinal motion', 'Spinal motion restriction'],
  ['tourniquet', 'Tourniquet'],
  ['wound care', 'Wound care'],
  ['oxygen', 'Oxygen administration'],
  ['cpap', 'CPAP'],
  ['suction', 'Suctioning'],
]

/** Below this length a needle is matched on word boundaries, not despaced. */
const DESPACE_SAFE_LENGTH = 9

/**
 * "08/16/2026 16:14:28" -> "2026-08-16". Undefined when it is not a date.
 *
 * The conversion belongs here rather than at the point of use: the printed
 * order is a property of the export format, and every caller getting it wrong
 * independently is how a review ends up filed under a date that sorts nowhere.
 */
export function isoDate(printed: string | undefined): string | undefined {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(printed ?? '')
  if (!m) return undefined
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

function mentions(text: string, needle: string): boolean {
  if (despace(needle).length >= DESPACE_SAFE_LENGTH) {
    return despace(text).includes(despace(needle))
  }
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text)
}

/** Provider levels, longest first so "Paramedic Plus" is not read as "Paramedic". */
const CREW_LEVELS = [
  'Advanced Emergency Medical Technician (AEMT)',
  'Emergency Medical Responder',
  'Critical Care Paramedic',
  'Registered Nurse',
  'Paramedic Plus',
  'Paramedic',
  'EMT-Intermediate',
  'EMT-Basic',
  'AEMT',
  'EMT',
  'EMR',
]

/**
 * Read the medications table.
 *
 * A medication row wraps across up to three lines in a narrow cell — "30" on
 * one, "Milligra" on the next, "ms (mg)" on a third — and the table can carry
 * over onto a page that never repeats its header. So rather than walking the
 * table, this searches every value the chart printed for "<drug><number><unit>"
 * with the spaces removed, which survives both problems. The narrative is
 * excluded so that a drug a crew only wrote about does not appear as one they
 * charted giving.
 */
function medications(view: PcrView, narrative: string | undefined): PcrMedication[] {
  let hay = view.valueText
  if (narrative) hay = hay.split(narrative).join(' ')
  // The Controlled Substances table restates a shift total — "Fentanyl 100 mcg,
  // 0 wasted" for two 50mcg doses — which would otherwise show up as a third
  // administration the crew never gave.
  const controlled = tableAfter(view, 'Controlled Substance Medication Name')
  if (controlled) hay = hay.split(controlled).join(' ')
  const flat = despace(hay)

  const out: PcrMedication[] = []
  for (const name of KNOWN_DRUGS) {
    const key = despace(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // The unit is REQUIRED, not optional. Without it "Epinephrine" followed by
    // the timestamp "17:43:00" in the next column reads as 17 of something.
    // Longest prefixes first, so "milligrams" is not read as "mg".
    const re = new RegExp(`${key}(\\d+(?:\\.\\d+)?)(micro|millig|millil|gram|mcg|mg|ml|unit)`, 'g')
    for (const m of flat.matchAll(re)) {
      const amount = m[1]
      const unit = ((): PcrMedication['unit'] => {
        switch (m[2]) {
          case 'micro': case 'mcg': return 'mcg'
          case 'millig': case 'mg': return 'mg'
          case 'millil': case 'ml': return 'ml'
          case 'gram': return 'g'
          default: return 'unit'
        }
      })()
      if (out.some((x) => x.name === name && x.amount === amount && x.unit === unit)) continue
      out.push({ name, amount, unit })
    }
  }
  return out
}

/** Crew from the crew table, or from anywhere in the chart as a fallback. */
function crewMembers(view: PcrView): PcrCrew[] {
  // The crew table's header can be the last thing on a page, putting its rows
  // behind the next page's banner where `tableAfter` will not follow. Falling
  // back to the whole chart is safe here in a way it is not for other tables:
  // the "Surname, Forename (12345)" shape only appears for staff.
  const table = [
    tableAfter(view, 'Crew Member Response Role'),
    tableAfter(view, 'Crew Member Level'),
  ].find((t) => t && t.trim())
  const source = table ?? view.valueText
  const out: PcrCrew[] = []
  // The licence number wraps like everything else — "(P- 21847)" is one id, not
  // a malformed one — so spaces are allowed inside the brackets and stripped.
  const re = /([A-Z][A-Za-z'-]+,\s*[A-Z][A-Za-z'-]+)\s*\(\s*([A-Z]?\s*-?\s*\d{4,6})\s*\)\s*([A-Za-z ()-]{0,48})/g
  for (const m of source.matchAll(re)) {
    const name = m[1].replace(/\s+/g, ' ').trim()
    if (out.some((c) => c.name === name)) continue
    const tail = m[3].trim()
    const level = CREW_LEVELS.find((l) => tail.toLowerCase().startsWith(l.toLowerCase()))
    out.push({ name, id: m[2].replace(/\s+/g, ''), level })
  }
  return out
}

/**
 * Signature blocks, split by who signed.
 *
 * The fields arrive in document order, so the "Type of Person Signing" ahead of
 * a "Printed Name" is the one that block belongs to. Reading them any other way
 * puts the receiving nurse's name in the crew's column.
 */
function signatures(view: PcrView): { crew: string[]; other: string[] } {
  const crew: string[] = []
  const other: string[] = []
  let signer = ''
  for (const f of view.fields) {
    const key = f.label.toLowerCase().replace(/[^a-z]/g, '')
    if (key.endsWith('typeofpersonsigning')) signer = f.value.toLowerCase()
    else if (key.endsWith('printedname') && f.value) {
      const name = f.value.replace(/\s+/g, ' ').trim()
      if (signer.includes('crew')) { if (!crew.includes(name)) crew.push(name) }
      else if (!other.includes(name)) other.push(name)
    }
  }
  return { crew, other }
}

export function parseChart(doc: PcrDoc, from: number, to: number): PcrChart {
  const view = sliceDoc(doc, from, to)
  // Blank is not the same as absent. "Destination Name:" printed with nothing
  // after it is a documentation gap the reviewer should see; a chart that never
  // had the field is a question nobody can answer. `field` returns '' for the
  // first and undefined for the second, and that distinction is preserved all
  // the way through — so this is a pass-through, not a tidy-up.
  const f = (label: string) => field(view, label)

  const narrative = f('Patient Care Report Narrative')
  const vitals = tableAfter(view, 'Date/Time HR SBP/DBP') ?? ''
  const scales = tableAfter(view, 'GCS - Total') ?? ''
  const devices = tableAfter(view, 'Medical Device Event Type') ?? ''
  const procedures = tableAfter(view, 'Procedure Performed') ?? ''
  const phones = tableAfter(view, "Patient's Phone Number") ?? ''
  const sigs = signatures(view)

  const procedureNames: string[] = []
  for (const [key, name] of KNOWN_PROCEDURES) {
    if (mentions(procedures, key) && !procedureNames.includes(name)) procedureNames.push(name)
  }

  return {
    incidentNumber: f('Incident #') ?? f('Incident Number'),
    serviceDate: f('Date of Service'),
    serviceDateISO: isoDate(f('Date of Service')),
    agency: f('EMS Agency'),
    unit: f('EMS Unit'),
    callSign: f('EMS Unit Call Sign') ?? f('EMS Call Sign'),
    unitCapability: f('Unit Transport and Equipment Capability'),

    serviceRequested: f('Type of Service Requested'),
    natureOfCall: f('Nature of Call'),
    primaryImpression: f('Primary Impression'),
    secondaryImpressions: f('Secondary Impressions'),
    acuity: f('Initial Patient Acuity'),
    finalAcuity: f('Final Patient Acuity'),
    chiefComplaint: f('Chief Complaint Anatomic Location') ?? f('Primary Symptom'),
    symptomOnset: f('Date/Time of Symptom Onset'),

    incidentAddress: f('Incident Address'),
    incidentType: f('Incident Type'),
    destinationName: f('Destination Name'),
    destinationReason: f('Destination reason'),
    destinationType: f('Destination Type'),
    preArrivalAlert: f('Destination Team Pre-Arrival Alert or Activation'),

    responseMode: f('Response Mode to Scene'),
    responseDescriptors: f('Additional Response Mode Descriptors'),
    transportMode: f('Transport Mode'),
    transportDescriptors: f('Transport Mode Descriptors'),
    transportDisposition: f('Transport Disposition'),
    unitDisposition: f('Unit Disposition'),
    crewDisposition: f('Crew Disposition'),
    patientEvaluation: f('Patient Evaluation/Care'),
    refusalReason: f('Reason for Refusal/Release'),

    possibleInjury: f('Possible Injury'),
    causeOfInjury: f('Cause of Injury'),
    mechanismOfInjury: f('Mechanism of Injury'),
    traumaHighRisk: f('Trauma Triage Criteria (High Risk- Red )') ?? f('Trauma Triage Criteria (High Risk-Red)'),
    traumaModerate: f('Trauma Triage Criteria (Moderate- Yellow)') ?? f('Trauma Triage Criteria (Moderate-Yellow)'),

    medicalHistory: f('Medical/Surgical History'),
    advanceDirectives: f('Advance Directives'),
    // These live in tables that are simply absent when nothing was recorded, so
    // presence of the heading is the signal, not presence of a value.
    medicationHistoryTaken: /Medication\s+Allergies|Current Medications|Medication History/i.test(view.text),
    allergiesRecorded: /Medication\s+Allergies|Environmental\/Food Allergies|No Known Drug Allergy/i.test(view.text),
    weightKg: f('Estimated Body Weight in Kilograms'),
    hasPhone: /\(\d{3}\)\s*\d{3}\s*-\s*\d{4}|\b\d{3}-\d{3}-\d{4}\b/.test(phones),
    patientBelongings: f('Patient Belongings'),

    crew: crewMembers(view),
    signedBy: sigs.crew,
    otherSignatures: sigs.other,
    reportBy: f('Crew Member Completing this Report')?.match(/[A-Z][A-Za-z'-]+,\s*[A-Z][A-Za-z'-]+/)?.[0],

    // Every vitals row is stamped "|| PTA = No", so counting those inside the
    // vitals table counts the sets — counting them across the whole chart would
    // also count the GCS, glucose and measurement-method tables.
    vitalsCount: (vitals.match(/\|\|\s*PTA\s*=/g) ?? []).length,
    hasGcs: /\d/.test(scales) && /GCS|Glasgow/i.test(view.text),
    hasAvpu: /\b(Alert|Verbal|Painful|Unresponsive)\b/.test(scales),
    hasPainScore: /\bPain\b/.test(vitals) || /Numeric|Wong|FLACC/i.test(vitals),
    hasGlucose: (tableAfter(view, 'Blood Glucose Level') ?? '').length > 0,
    hasTwelveLead: /12-?\s?Lead/i.test(devices) || /12-?\s?Lead/i.test(procedures),
    hasCardiacMonitor: /ECG-?\s?Monitor/i.test(devices),
    cardiacArrest: f('Cardiac Arrest'),

    medications: medications(view, narrative),
    hasProcedures: procedures.trim().length > 0,
    procedureNames,

    narrative,
    pageFrom: from,
    pageTo: to,
  }
}

/** Parse every chart in an export. */
export function parseCharts(doc: PcrDoc): PcrChart[] {
  return splitCharts(doc).map((r) => parseChart(doc, r.from, r.to))
}

/** True when the export looks like an ImageTrend PCR at all. */
export function looksLikePcr(doc: PcrDoc): boolean {
  return /EMS Agency\s*:/.test(doc.text) && INCIDENT.test(doc.text)
}

// `hasField` is re-exported so autoAnswer can tell "the export omits this
// section" from "the section is there and empty" without importing pcrText.
export { hasField }
