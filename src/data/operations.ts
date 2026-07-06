import type { OperationId, CELocation } from '../types'

export interface OperationMeta {
  id: OperationId
  name: string
  short: string
  state: 'MO' | 'KS'
  /** Typical monthly call volume, used to pre-fill new QA periods. null = unknown. */
  typicalVolume: number | null
  note?: string
}

// Ordered as they appear across the org. Cass & Linn volumes are open items
// in the spec (§2) — left null so the QA period form prompts for them.
export const OPERATIONS: OperationMeta[] = [
  {
    id: 'kc',
    name: 'Kansas City (MO)',
    short: 'KC',
    state: 'MO',
    typicalVolume: 1000,
    note: 'Interfacility critical care — vent, vasopressor & sedative infusions.',
  },
  {
    id: 'cass',
    name: 'Cass County (MO)',
    short: 'Cass',
    state: 'MO',
    typicalVolume: null,
    note: 'Single transport truck. Monthly volume TBD.',
  },
  {
    id: 'linn',
    name: 'Linn County (KS)',
    short: 'Linn',
    state: 'KS',
    typicalVolume: null,
    note: 'Rural 911, two 24/7 trucks. Monthly volume TBD.',
  },
]

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

export const CE_LOCATIONS: CELocationMeta[] = [
  { id: 'kc', name: 'Kansas City' },
  { id: 'linn', name: 'Linn County' },
  { id: 'topeka', name: 'Topeka' },
]

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
