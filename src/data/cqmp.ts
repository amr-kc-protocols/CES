// ---------------------------------------------------------------------------
// CQMP — the monthly Clinical Quality Management Plan KPI review.
//
// This file is the catalogue: which operations report, and which measures each
// one is held to. It is deliberately SEPARATE from data/operations.ts.
//
// operations.ts describes where new hires are placed and where CE is filed;
// this describes what gets presented to clinical leadership every month. They
// overlap in Kansas City and diverge everywhere else — Winfield reports its
// own KPIs but has never been an academy operation, and Cass County is an
// academy operation that does not appear on this deck. Folding the two lists
// together would mean every future change to one silently moved the other.
//
// REGIONAL, NOT PER-MARKET. This list used to be split by the market the
// device was in, so a Kansas City device saw Kansas City and Linn County and a
// Wichita device saw Wichita and Winfield. That was wrong for what this meeting
// actually is: one Regional Clinical Manager Quality & Safety meeting covering
// Region 41, whose minutes name every air base and every ground business unit
// in one document and go to one regional director. Splitting the catalogue by
// market meant no device could produce those minutes.
//
// Which measures apply is a property of the SERVICE MODEL, not the city or the
// airframe:
//
//   Interfacility (Kansas City, Wichita, Winfield) — the two measures every
//   operation reports: blood glucose verification and advanced airway
//   verification.
//
//   911 and scene flight (Linn County, Independence, Health Star 1, both
//   EagleMed bases) — the same two, plus the stroke and STEMI bundles, because
//   these are the operations that meet those patients in the field rather than
//   at a sending facility.
// ---------------------------------------------------------------------------

export type CqmpKpiId = 'glucose' | 'airway' | 'stroke' | 'stemi'

export interface CqmpKpi {
  id: CqmpKpiId
  /** Slide heading. */
  name: string
  /** Short label for the summary table, where the column is narrow. */
  short: string
  /**
   * What the percentage counts, printed under the heading on the slide. Kept
   * to the shape of the measure — the elements inside each bundle are defined
   * by the protocol, not by this app, so no element list is asserted here.
   */
  definition: string
  /** Where in Clinical Analytics the screenshot is taken from. */
  source: string
}

export const CQMP_KPIS: Record<CqmpKpiId, CqmpKpi> = {
  glucose: {
    id: 'glucose',
    name: 'Blood Glucose Verification',
    short: 'Blood glucose',
    definition:
      'Altered mental status patients with a blood glucose obtained and documented.',
    source: 'Clinical Analytics → Altered Mental Status → Blood Glucose Verification',
  },
  airway: {
    id: 'airway',
    name: 'Advanced Airway Verification',
    short: 'Advanced airway',
    definition:
      'Advanced airways with placement verification documented.',
    source: 'Clinical Analytics → Advanced Airway → Verification of Advanced Airway Placement',
  },
  stroke: {
    id: 'stroke',
    name: 'Stroke Bundle Compliance',
    short: 'Stroke bundle',
    definition:
      'Suspected stroke patients with every element of the stroke bundle documented.',
    source: 'Clinical Analytics → Stroke → Stroke Details',
  },
  stemi: {
    id: 'stemi',
    name: 'STEMI Bundle Compliance',
    short: 'STEMI bundle',
    definition:
      'STEMI patients with every element of the STEMI bundle documented.',
    source: 'Clinical Analytics → STEMI → STEMI Bundle',
  },
}

export interface CqmpOperation {
  /** Stable id stored on every metric — never rename one of these in place. */
  id: string
  name: string
  /** Service model, printed under the operation name on the deck. */
  model: string
  /** Where it sits, so the minutes can list air bases and ground BUs the way
   *  the meeting does. */
  kind: 'ground' | 'air'
  /** City and state, for the minutes header. */
  location?: string
  /** Measures this operation reports, in presentation order. */
  kpis: CqmpKpiId[]
}

/** The two measures every operation reports, whatever its service model. */
const INTERFACILITY: CqmpKpiId[] = ['glucose', 'airway']

/** Those two plus the bundles, for anyone meeting the patient in the field. */
const SCENE: CqmpKpiId[] = ['glucose', 'airway', 'stroke', 'stemi']

/**
 * Region 41, in the order the meeting works through them: ground business
 * units, then air bases.
 *
 * Ids are permanent. A report filed months ago stores whatever ids were current
 * then, so renaming one in place would orphan its history — see
 * cqmpOperationName for what happens to an id that leaves the catalogue.
 */
export const CQMP_OPERATIONS: CqmpOperation[] = [
  {
    id: 'kc',
    name: 'Kansas City',
    model: 'Urban interfacility',
    kind: 'ground',
    location: 'Kansas City, MO',
    kpis: INTERFACILITY,
  },
  {
    id: 'wichita',
    name: 'Wichita',
    model: 'Interfacility',
    kind: 'ground',
    location: 'Wichita, KS',
    kpis: INTERFACILITY,
  },
  {
    id: 'winfield',
    name: 'Winfield',
    model: 'Interfacility',
    kind: 'ground',
    location: 'Winfield, KS',
    kpis: INTERFACILITY,
  },
  {
    id: 'linn',
    name: 'Linn County',
    model: 'Rule 901 ground 911',
    kind: 'ground',
    location: 'Linn County, KS',
    kpis: SCENE,
  },
  {
    id: 'independence',
    name: 'Independence',
    model: 'Ground 911',
    kind: 'ground',
    location: 'Independence, MO',
    kpis: SCENE,
  },
  {
    id: 'healthstar1',
    name: 'Health Star 1',
    model: 'Scene flight — rotor',
    kind: 'air',
    location: 'Overland Park, KS',
    kpis: SCENE,
  },
  {
    id: 'eaglemed-chanute',
    name: 'EagleMed Chanute',
    model: 'Scene flight — rotor',
    kind: 'air',
    location: 'Chanute, KS',
    kpis: SCENE,
  },
  {
    // Fixed wing, and carrying the scene set on instruction. Worth a second
    // look if the bundles turn out never to have a qualifying patient here —
    // a measure that is structurally always empty is noise on the slide, not
    // a compliance signal.
    id: 'eaglemed-wichita',
    name: 'EagleMed Wichita',
    model: 'Fixed wing',
    kind: 'air',
    location: 'Wichita, KS',
    kpis: SCENE,
  },
]

export const GROUND_OPERATIONS = CQMP_OPERATIONS.filter((o) => o.kind === 'ground')
export const AIR_OPERATIONS = CQMP_OPERATIONS.filter((o) => o.kind === 'air')

export function cqmpOperation(id: string): CqmpOperation | undefined {
  return CQMP_OPERATIONS.find((o) => o.id === id)
}

/**
 * Name for an operation id that may no longer be in the catalogue.
 *
 * A report filed months ago holds whatever ids were current then. If the
 * catalogue changes, those metrics still have to render — with the id itself
 * rather than a blank — so the month can be read and the stale rows removed.
 */
export function cqmpOperationName(id: string): string {
  return cqmpOperation(id)?.name ?? id
}

export function cqmpKpiName(id: string): string {
  return CQMP_KPIS[id as CqmpKpiId]?.name ?? id
}

/** Every (operation, measure) pair the region reports, in deck order. */
export function cqmpSlots(): { opId: string; kpiId: CqmpKpiId }[] {
  return CQMP_OPERATIONS.flatMap((op) => op.kpis.map((kpiId) => ({ opId: op.id, kpiId })))
}

// ----- who the minutes name ---------------------------------------------------
//
// The roster on the meeting minutes header. Seeded here and COPIED ONTO EACH
// REPORT when a month is created, so a month chaired by somebody acting reads
// correctly a year later instead of being retconned by whoever holds the post
// today.
//
// The names below are the correct spellings, which the circulated template did
// not have: it carried Kramer for Cramer, Maurice for Morris, and Crowley for
// Dralle, and had no row for the vice president at all. Those are people's
// names on a document going to a regional director — worth getting right.

export type CqmpOfficerRole =
  | 'rcm'
  | 'rcd'
  | 'rcqm'
  | 'rpsm'
  | 'vp'
  | 'president'
  | 'director'

export interface CqmpOfficer {
  role: CqmpOfficerRole
  /** Abbreviation as the minutes header prints it. */
  short: string
  title: string
  name: string
}

export const CQMP_OFFICERS: CqmpOfficer[] = [
  { role: 'rcm', short: 'RCM', title: 'Regional Clinical Manager', name: 'Odie White' },
  { role: 'rcd', short: 'RCD', title: 'Regional Clinical Director', name: 'Eric Divendorf' },
  {
    role: 'rcqm',
    short: 'RCQM',
    title: 'Regional Clinical Quality Manager',
    name: 'Brad Cramer',
  },
  {
    role: 'rpsm',
    short: 'RPSM',
    title: 'Regional Patient Safety Manager',
    name: 'Kevin Morris',
  },
  { role: 'vp', short: 'VP', title: 'Vice President', name: 'Scott Lenn' },
  { role: 'president', short: 'Reg. President', title: 'Regional President', name: 'Steve Dralle' },
  {
    role: 'director',
    short: 'Reg. Director',
    title: 'Regional Director, Region 41',
    name: 'Craig Isom',
  },
]

/** Who the finished minutes are submitted to. */
export const CQMP_SUBMIT_TO: CqmpOfficerRole = 'director'

/**
 * Where the finished minutes are filed.
 *
 * A Smartsheet intake form that takes the PDF as an upload. The app does not
 * post to it — there is no API here and no credential, and an offline-first
 * PWA quietly failing to submit a compliance document would be worse than not
 * offering to. The link opens the form; the person attaches the file they just
 * generated and fills in whatever else the form asks for.
 */
export const CQMP_SUBMIT_URL =
  'https://app.smartsheet.com/b/form/2a67f3482aeb40ec869d56f12ce8c2b8'

export function officerSeed(): Record<string, string> {
  return Object.fromEntries(CQMP_OFFICERS.map((o) => [o.role, o.name]))
}

export const MINUTES_TITLE = 'Regional Clinical Manager Quality & Safety Meeting Minutes'
