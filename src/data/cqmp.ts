import { activeMarket, type Market } from '../lib/market'

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
// Which measures apply is a property of the service model, not the city:
//
//   Interfacility (Kansas City, Wichita, Winfield) — the two measures every
//   operation reports: blood glucose verification and advanced airway
//   verification.
//
//   Rule 901 ground 911 (Linn County) — the same two, plus the stroke and
//   STEMI bundles, because Linn is the operation that meets those patients
//   in the field rather than at a sending facility.
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
  /** Measures this operation reports, in presentation order. */
  kpis: CqmpKpiId[]
}

const INTERFACILITY: CqmpKpiId[] = ['glucose', 'airway']

const KC_OPERATIONS: CqmpOperation[] = [
  {
    id: 'kc',
    name: 'Kansas City',
    model: 'Urban interfacility',
    kpis: INTERFACILITY,
  },
  {
    id: 'linn',
    name: 'Linn County',
    model: 'Rule 901 ground operation',
    kpis: ['glucose', 'airway', 'stroke', 'stemi'],
  },
]

const WICHITA_OPERATIONS: CqmpOperation[] = [
  { id: 'wichita', name: 'Wichita', model: 'Interfacility', kpis: INTERFACILITY },
  { id: 'winfield', name: 'Winfield', model: 'Interfacility', kpis: INTERFACILITY },
]

const BY_MARKET: Record<Market, CqmpOperation[]> = {
  kc: KC_OPERATIONS,
  wichita: WICHITA_OPERATIONS,
}

/** The operations this market presents, for the market the device is in. */
export const CQMP_OPERATIONS: CqmpOperation[] = BY_MARKET[activeMarket()]

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

/** Every (operation, measure) pair this market reports, in deck order. */
export function cqmpSlots(): { opId: string; kpiId: CqmpKpiId }[] {
  return CQMP_OPERATIONS.flatMap((op) => op.kpis.map((kpiId) => ({ opId: op.id, kpiId })))
}
