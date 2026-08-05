import type { OperationId, CELocation } from '../types'
import { activeMarket, type Market } from '../lib/market'

export interface OperationMeta {
  id: OperationId
  name: string
  short: string
  /**
   * States the operation actually runs in. Kansas City straddles the line —
   * the metro operation covers Kansas City, Kansas as well as Missouri, and
   * is the KBEMS-facing sponsoring organization for Kansas courses.
   */
  states: ('MO' | 'KS')[]
  /** Typical monthly call volume, used to pre-fill new QA periods. null = unknown. */
  typicalVolume: number | null
  note?: string
}

// Ordered as they appear across the org. Cass & Linn volumes are open items
// in the spec (§2) — left null so the QA period form prompts for them.
const KC_OPERATIONS: OperationMeta[]  = [
  {
    id: 'kc',
    name: 'Kansas City',
    short: 'KC',
    states: ['MO', 'KS'],
    typicalVolume: 1000,
    note: 'Interfacility critical care — vent, vasopressor & sedative infusions.',
  },
  {
    id: 'cass',
    name: 'Cass County (MO)',
    short: 'Cass',
    states: ['MO'],
    typicalVolume: null,
    note: 'Single transport truck. Monthly volume TBD.',
  },
  {
    id: 'linn',
    name: 'Linn County (KS)',
    short: 'Linn',
    states: ['KS'],
    typicalVolume: null,
    note: 'Rural 911, two 24/7 trucks. Monthly volume TBD.',
  },
]

/* ---------------------------------------------------------------------------
 * Per-market selection.
 *
 * Kansas City, Cass County and Linn County are Kansas City's operations, and
 * Kansas City, Linn and Topeka are its KBEMS submission locations. Neither
 * list means anything in Wichita.
 *
 * Wichita gets ONE entry rather than none, and that is deliberate: the
 * operation picker on a trainee is `OPERATIONS.map(...)`, and `Trainee.operation`
 * is required, so an empty list would leave Wichita unable to add a trainee at
 * all. A single placeholder unblocks the screen; an empty one breaks it.
 *
 * That entry is a stand-in. Wichita's real operational structure — whether it
 * is one operation or several, and what the KBEMS submission locations are —
 * needs filling in by someone who knows it.
 * ------------------------------------------------------------------------ */

const WICHITA_OPERATIONS: OperationMeta[] = [
  {
    id: 'wichita',
    name: 'Wichita',
    short: 'ICT',
    states: ['KS'],
    typicalVolume: null,
    note: 'Placeholder — Wichita’s operations still to be confirmed.',
  },
]

const WICHITA_CE_LOCATIONS: CELocationMeta[] = [{ id: 'wichita', name: 'Wichita' }]

const OPERATIONS_BY_MARKET: Record<Market, OperationMeta[]> = {
  kc: KC_OPERATIONS,
  wichita: WICHITA_OPERATIONS,
}

export const OPERATIONS: OperationMeta[] = OPERATIONS_BY_MARKET[activeMarket()]

export const OPERATION_MAP: Record<OperationId, OperationMeta> = Object.fromEntries(
  OPERATIONS.map((o) => [o.id, o]),
) as Record<OperationId, OperationMeta>

export function operationName(id: OperationId): string {
  return OPERATION_MAP[id]?.name ?? id
}

export function operationShort(id: OperationId): string {
  return OPERATION_MAP[id]?.short ?? id
}

// ----- CE submission locations (Module B) ----------------------------------

export interface CELocationMeta {
  id: CELocation
  name: string
}

const KC_CE_LOCATIONS: CELocationMeta[]  = [
  { id: 'kc', name: 'Kansas City' },
  { id: 'linn', name: 'Linn County' },
  { id: 'topeka', name: 'Topeka' },
]

const CE_LOCATIONS_BY_MARKET: Record<Market, CELocationMeta[]> = {
  kc: KC_CE_LOCATIONS,
  wichita: WICHITA_CE_LOCATIONS,
}

export const CE_LOCATIONS: CELocationMeta[] = CE_LOCATIONS_BY_MARKET[activeMarket()]

export function ceLocationName(id: CELocation): string {
  return CE_LOCATIONS.find((l) => l.id === id)?.name ?? id
}

/** Common AHA / EMS disciplines offered for CE classes. Free text also allowed. */
export const CE_DISCIPLINES = [
  'ACLS',
  'PALS',
  'BLS',
  'Trauma',
  'Airway',
  'Cardiac',
  'Medical',
  'Pediatrics',
  'OB',
  'Operations',
  'Other',
]
