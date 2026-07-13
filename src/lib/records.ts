import type { DBShape } from '../types'

// ---------------------------------------------------------------------------
// Record mapping for cloud sync. Every domain object in DBShape becomes one
// (collection, id, data) record — the same shape as a row in the Supabase
// `records` table. Sync then works at record grain: diff two local states
// into upserts/tombstones, and apply remote records back onto local state.
// ---------------------------------------------------------------------------

export interface SyncRecord {
  collection: string
  id: string
  data: unknown
  deleted?: boolean
}

interface SliceDef {
  collection: string
  /** Slice key on DBShape (array slices). */
  slice: keyof DBShape
  /** Stable identity of one item within the slice. */
  idOf: (item: never) => string
}

// Items are typed `never` in idOf so each definition casts once, locally.
const id = (x: { id: string }) => x.id

const SLICES: SliceDef[] = [
  { collection: 'cohorts', slice: 'academyCohorts', idOf: id as SliceDef['idOf'] },
  { collection: 'trainees', slice: 'trainees', idOf: id as SliceDef['idOf'] },
  { collection: 'days', slice: 'academyDays', idOf: id as SliceDef['idOf'] },
  {
    collection: 'arrangements',
    slice: 'academyArrangements',
    idOf: ((a: { cohortId: string; sessionId: string }) => `${a.cohortId}:${a.sessionId}`) as SliceDef['idOf'],
  },
  { collection: 'customSessions', slice: 'academyCustomSessions', idOf: id as SliceDef['idOf'] },
  {
    collection: 'attendance',
    slice: 'academyAttendance',
    idOf: ((a: { cohortId: string; traineeId: string; dayKey: string }) =>
      `${a.cohortId}:${a.traineeId}:${a.dayKey}`) as SliceDef['idOf'],
  },
  { collection: 'rides', slice: 'rideAssignments', idOf: id as SliceDef['idOf'] },
  { collection: 'evals', slice: 'dailyEvals', idOf: id as SliceDef['idOf'] },
  { collection: 'skills', slice: 'skillChecks', idOf: id as SliceDef['idOf'] },
  { collection: 'surveys', slice: 'surveyResponses', idOf: id as SliceDef['idOf'] },
  { collection: 'ceClasses', slice: 'ceClasses', idOf: id as SliceDef['idOf'] },
  { collection: 'qaPeriods', slice: 'qaPeriods', idOf: id as SliceDef['idOf'] },
  { collection: 'charts', slice: 'charts', idOf: id as SliceDef['idOf'] },
]

const SETTINGS_COLLECTION = 'settings'
const SETTINGS_ID = 'app'

const key = (collection: string, recordId: string) => `${collection}/${recordId}`

/** Flatten a DBShape into records keyed by collection+id. */
export function toRecords(db: DBShape): Map<string, SyncRecord> {
  const out = new Map<string, SyncRecord>()
  for (const def of SLICES) {
    const items = db[def.slice] as unknown as never[]
    for (const item of items) {
      const recordId = def.idOf(item)
      out.set(key(def.collection, recordId), { collection: def.collection, id: recordId, data: item })
    }
  }
  out.set(key(SETTINGS_COLLECTION, SETTINGS_ID), {
    collection: SETTINGS_COLLECTION,
    id: SETTINGS_ID,
    data: db.settings,
  })
  return out
}

/** Records that changed between two states: upserts plus delete tombstones. */
export function diffRecords(prev: DBShape, next: DBShape): SyncRecord[] {
  if (prev === next) return []
  const before = toRecords(prev)
  const after = toRecords(next)
  const changed: SyncRecord[] = []
  for (const [k, rec] of after) {
    const old = before.get(k)
    if (!old || JSON.stringify(old.data) !== JSON.stringify(rec.data)) changed.push(rec)
  }
  for (const [k, rec] of before) {
    if (!after.has(k)) changed.push({ collection: rec.collection, id: rec.id, data: {}, deleted: true })
  }
  return changed
}

/**
 * Merge remote records onto a local state. `skip` holds record keys the
 * local device has pending pushes for — local wins those until they flush.
 */
export function applyRemote(
  db: DBShape,
  records: SyncRecord[],
  skip: Set<string> = new Set(),
): DBShape {
  let next = db
  for (const rec of records) {
    if (skip.has(recordKey(rec))) continue
    if (rec.collection === SETTINGS_COLLECTION) {
      if (!rec.deleted) next = { ...next, settings: { ...next.settings, ...(rec.data as DBShape['settings']) } }
      continue
    }
    const def = SLICES.find((s) => s.collection === rec.collection)
    if (!def) continue
    const items = next[def.slice] as unknown as never[]
    const idx = items.findIndex((item) => def.idOf(item) === rec.id)
    if (rec.deleted) {
      if (idx !== -1) {
        const copy = items.slice()
        copy.splice(idx, 1)
        next = { ...next, [def.slice]: copy }
      }
    } else {
      const copy = items.slice()
      if (idx === -1) copy.push(rec.data as never)
      else copy[idx] = rec.data as never
      next = { ...next, [def.slice]: copy }
    }
  }
  return next
}

export function recordKey(rec: Pick<SyncRecord, 'collection' | 'id'>): string {
  return key(rec.collection, rec.id)
}
