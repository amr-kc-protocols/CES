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
  /**
   * A cheap identity for the record, where its slice defines one. Used only to
   * decide whether the record changed; never sent, never stored.
   */
  identity?: string
}

interface SliceDef {
  collection: string
  /** Slice key on DBShape (array slices). */
  slice: keyof DBShape
  /** Stable identity of one item within the slice. */
  idOf: (item: never) => string
  /**
   * A cheap value that changes whenever the item does, where stringifying the
   * whole item on every state change would be wasteful.
   *
   * diffRecords runs on EVERY state change — every attendance tap, every
   * keystroke in a form — and compares each record by stringifying it. That is
   * fine for a session row and wrong for a retained program document, which
   * carries eighty kilobytes of rendered HTML that is written once and never
   * edited. Where a slice can name a value that is a complete identity for the
   * item, it goes here and the body is never stringified.
   *
   * Only correct for immutable rows. A row that can be edited in place must
   * not use this unless the version key changes with every edit.
   */
  identity?: (item: never) => string
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
  // The Ninth Brain chart review questionnaire. Admin/clinical-leadership only
  // server-side, same as the rest of the review data.
  { collection: 'chartReviews', slice: 'chartReviews', idOf: id as SliceDef['idOf'] },

  // ----- AEMT program -------------------------------------------------------
  // Kansas certification records carry a three-year retention obligation under
  // K.A.R. 109-17-3. Until now they lived only in the browser that entered
  // them, which meant a lost phone or a cleared cache took the course record
  // with it. Server-side these are admin-only in both directions; see
  // supabase/migrations/2026-08-01-scoped-reads-and-aemt.sql.
  { collection: 'aemtCourses', slice: 'aemtCourses', idOf: id as SliceDef['idOf'] },
  { collection: 'aemtStudents', slice: 'aemtStudents', idOf: id as SliceDef['idOf'] },
  { collection: 'aemtSessions', slice: 'aemtSessions', idOf: id as SliceDef['idOf'] },
  {
    collection: 'aemtAttendance',
    slice: 'aemtAttendance',
    idOf: ((a: { courseId: string; studentId: string; sessionId: string }) =>
      `${a.courseId}:${a.studentId}:${a.sessionId}`) as SliceDef['idOf'],
  },
  { collection: 'aemtEncounters', slice: 'aemtEncounters', idOf: id as SliceDef['idOf'] },
  { collection: 'aemtShifts', slice: 'aemtShifts', idOf: id as SliceDef['idOf'] },
  {
    collection: 'aemtDeadlines',
    slice: 'aemtDeadlines',
    idOf: ((d: { courseId: string; deadlineId: string }) =>
      `${d.courseId}:${d.deadlineId}`) as SliceDef['idOf'],
  },
  {
    collection: 'aemtSkillChecks',
    slice: 'aemtSkillChecks',
    idOf: ((c: { courseId: string; studentId: string; sheetId: string }) =>
      `${c.courseId}:${c.studentId}:${c.sheetId}`) as SliceDef['idOf'],
  },
  { collection: 'aemtFormResponses', slice: 'aemtFormResponses', idOf: id as SliceDef['idOf'] },
  {
    collection: 'aemtCompletions',
    slice: 'aemtCompletions',
    idOf: ((c: { courseId: string; studentId: string }) =>
      `${c.courseId}:${c.studentId}`) as SliceDef['idOf'],
  },
  {
    collection: 'aemtRecordDocs',
    slice: 'aemtRecordDocs',
    idOf: ((d: { courseId: string; typeId: string }) =>
      `${d.courseId}:${d.typeId}`) as SliceDef['idOf'],
  },
  {
    // The documents the app builds and keeps: the syllabus, the curriculum, the
    // clinical objectives, the policy manual. K.A.R. 109-17-3 retains these for
    // three years, so they sync like every other record rather than living in
    // one device's IndexedDB — a retained record on somebody's laptop is worse
    // than the shared drive this replaced.
    //
    // A row is written once when the document is built and never edited; a
    // rebuild writes a new row. So the fingerprint of the issued document is a
    // complete identity for it, and the diff never has to stringify the body.
    collection: 'aemtProgramDocs',
    slice: 'aemtProgramDocs',
    idOf: id as SliceDef['idOf'],
    identity: ((d: { id: string; fingerprint?: string; generatedAt: string }) =>
      `${d.fingerprint ?? ''}|${d.generatedAt}`) as SliceDef['identity'],
  },
  // Documented private progress conferences. K.A.R. 109-17-3 retains these and
  // the syllabus commits to at least one per student; they were "kept
  // elsewhere" only because nothing here recorded one.
  { collection: 'aemtConferences', slice: 'aemtConferences', idOf: id as SliceDef['idOf'] },
  { collection: 'aemtAudit', slice: 'aemtAudit', idOf: id as SliceDef['idOf'] },
  { collection: 'aemtCandidates', slice: 'aemtCandidates', idOf: id as SliceDef['idOf'] },

  // ----- editable instruments ------------------------------------------------
  // Skill sheets and evaluation forms edited in the app. These MUST sync: an
  // instrument that only exists on the admin's device would leave every FTO and
  // instructor assessing against the version shipped with the app, while the
  // records they wrote claimed a version nobody else can resolve.
  //
  // Versions are append-only in practice — publishing adds a row rather than
  // editing one — so this collection only ever grows, and a device that has
  // pulled a version can always render a record pinned to it.
  { collection: 'templates', slice: 'templates', idOf: id as SliceDef['idOf'] },

  // ----- CQMP monthly KPI review ---------------------------------------------
  // Needs no migration: the read policy gives an admin their whole market and
  // names every collection the other roles may see, so a collection added here
  // is admin-only in both directions by construction.
  //
  // What syncs is the month's numbers, targets and notes. The dashboard
  // screenshots do not — they are IndexedDB blobs referenced by key, for the
  // reasons set out on CqmpImageRef in types.ts.
  { collection: 'cqmpReports', slice: 'cqmpReports', idOf: id as SliceDef['idOf'] },

  // ----- quarterly simulation runs -------------------------------------------
  // Same construction as CQMP: the read policy gives an admin their whole
  // market and names every collection the other roles may see, so this is
  // admin-only in both directions without a migration. Runs are written once
  // at the end of a scenario and never edited, so they only ever grow.
  { collection: 'simRuns', slice: 'simRuns', idOf: id as SliceDef['idOf'] },
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
      out.set(key(def.collection, recordId), {
        collection: def.collection,
        id: recordId,
        data: item,
        identity: def.identity?.(item),
      })
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
    if (!old) {
      changed.push(rec)
      continue
    }
    // Where the slice names a cheap identity, trust it and skip stringifying a
    // body that cannot have changed without it changing too.
    const same =
      rec.identity !== undefined && old.identity !== undefined
        ? rec.identity === old.identity
        : JSON.stringify(old.data) === JSON.stringify(rec.data)
    if (!same) changed.push(rec)
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
    // A malformed row — hand-inserted SQL whose row id doesn't match the
    // payload's own identity — must stay inert. Applying it would adopt the
    // payload under its own id; the device would then re-push that as a NEW
    // record, and the original row resurrects whatever the user deletes.
    if (!rec.deleted && def.idOf(rec.data as never) !== rec.id) continue
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
