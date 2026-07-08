import { useEffect, useSyncExternalStore } from 'react'
import { getState } from '../../lib/store'
import { QA_ENABLED } from '../../config/features'
import { monthKey, monthLabel } from '../../lib/date'
import { operationShort } from '../../data/operations'
import { parseBotBatch, type ExternalReview } from './botBridge'
import { createPeriod, importBotReviews, periodId } from './qaStore'
import type { OperationId } from '../../types'

// ---------------------------------------------------------------------------
// Live folder sync for the QA bot (Chart Review Agent).
//
// The bot writes ces_batch_<unit>.json files next to app.py (via
// scripts/ces_export.py or scripts/xlsx_to_ces.py). Instead of importing them
// by hand, the user points CES at that folder once (File System Access API,
// Chrome/Edge); CES then re-reads the files on an interval and imports any
// changes. Reviews are routed to the QA period matching their run date's
// month + the file's unit suffix, creating the period if needed, so bot work
// always lands where the monthly target is counted.
//
// The directory handle is persisted in IndexedDB (it can't go in
// localStorage); per-file lastModified stamps live in localStorage so an
// unchanged file isn't re-imported on every tick or page load.
// ---------------------------------------------------------------------------

const BATCH_FILE_RE = /^ces_batch(?:_([a-z0-9]+))?\.json$/i
const SYNC_INTERVAL_MS = 15_000
const OPERATION_IDS: OperationId[] = ['kc', 'cass', 'linn']

// ----- preferences (localStorage) -------------------------------------------

const PREFS_KEY = 'ces.botsync.v1'

interface SyncPrefs {
  enabled: boolean
  /** Unit used for a batch file without a unit suffix (plain ces_batch.json). */
  defaultUnit: OperationId
  /** name -> lastModified of the last imported version of each batch file. */
  fileState: Record<string, number>
}

function loadPrefs(): SyncPrefs {
  const defaults: SyncPrefs = { enabled: true, defaultUnit: 'kc', fileState: {} }
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return defaults
    return { ...defaults, ...(JSON.parse(raw) as Partial<SyncPrefs>) }
  } catch {
    return defaults
  }
}

let prefs = loadPrefs()

function savePrefs(): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch (err) {
    console.error('CES: failed to persist bot sync prefs', err)
  }
}

// ----- directory handle persistence (IndexedDB) ------------------------------

const IDB_NAME = 'ces-fs'
const IDB_STORE = 'handles'
const IDB_KEY = 'botBatchDir'

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(value: FileSystemDirectoryHandle | null): Promise<void> {
  const db = await openIdb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    if (value) tx.objectStore(IDB_STORE).put(value, IDB_KEY)
    else tx.objectStore(IDB_STORE).delete(IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function idbGet(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openIdb()
  const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return handle
}

// ----- status store (useSyncExternalStore pattern, like lib/store.ts) --------

export interface BotSyncState {
  /** False on browsers without the File System Access API (Safari/Firefox). */
  supported: boolean
  folderName: string | null
  /** null = no folder chosen; 'prompt' = folder saved but access needs a click. */
  permission: 'granted' | 'prompt' | null
  enabled: boolean
  defaultUnit: OperationId
  syncing: boolean
  lastSyncAt: string | null
  /** One line per batch file from the last scan. */
  fileNotes: string[]
  /** Summary of what the last scan imported ('' = nothing new). */
  summary: string
  error: string | null
}

const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window

let dirHandle: FileSystemDirectoryHandle | null = null
let state: BotSyncState = {
  supported,
  folderName: null,
  permission: null,
  enabled: prefs.enabled,
  defaultUnit: prefs.defaultUnit,
  syncing: false,
  lastSyncAt: null,
  fileNotes: [],
  summary: '',
  error: null,
}

const listeners = new Set<() => void>()

function setSyncState(patch: Partial<BotSyncState>): void {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useBotSync(): BotSyncState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
    () => state,
  )
}

// ----- actions ---------------------------------------------------------------

/** Restore the saved folder handle (no permission prompt — that needs a click). */
async function restoreHandle(): Promise<void> {
  if (!supported || dirHandle) return
  try {
    const saved = await idbGet()
    if (!saved) return
    dirHandle = saved
    const perm = await saved.queryPermission({ mode: 'read' })
    setSyncState({
      folderName: saved.name,
      permission: perm === 'granted' ? 'granted' : 'prompt',
    })
  } catch (err) {
    console.error('CES: could not restore bot sync folder', err)
  }
}

/** Pick the folder the bot writes ces_batch_*.json into. Must be user-initiated. */
export async function chooseFolder(): Promise<void> {
  if (!supported) return
  try {
    const handle = await window.showDirectoryPicker({ id: 'ces-bot-batches', mode: 'read' })
    dirHandle = handle
    await idbSet(handle)
    prefs = { ...prefs, fileState: {} } // new folder -> forget old file stamps
    savePrefs()
    setSyncState({ folderName: handle.name, permission: 'granted', error: null })
    void syncNow()
  } catch (err) {
    if ((err as Error).name === 'AbortError') return // user cancelled the picker
    setSyncState({ error: 'Could not open that folder: ' + (err as Error).message })
  }
}

/** Re-grant read access to the saved folder after a browser restart. */
export async function resumeAccess(): Promise<void> {
  if (!dirHandle) return
  const perm = await dirHandle.requestPermission({ mode: 'read' })
  if (perm === 'granted') {
    setSyncState({ permission: 'granted', error: null })
    void syncNow()
  }
}

export async function forgetFolder(): Promise<void> {
  dirHandle = null
  await idbSet(null)
  prefs = { ...prefs, fileState: {} }
  savePrefs()
  setSyncState({ folderName: null, permission: null, fileNotes: [], summary: '', error: null })
}

export function setSyncEnabled(enabled: boolean): void {
  prefs = { ...prefs, enabled }
  savePrefs()
  setSyncState({ enabled })
  if (enabled) void syncNow()
}

export function setDefaultUnit(unit: OperationId): void {
  prefs = { ...prefs, defaultUnit: unit }
  savePrefs()
  setSyncState({ defaultUnit: unit })
}

// ----- the sync pass ---------------------------------------------------------

function isOperationId(s: string): s is OperationId {
  return (OPERATION_IDS as string[]).includes(s)
}

/** Route one file's reviews into periods by run-date month, creating periods as needed. */
function importRouted(unit: OperationId, reviews: ExternalReview[]): string[] {
  const byPeriod = new Map<string, ExternalReview[]>()
  for (const r of reviews) {
    const month = r.date && /^\d{4}-\d{2}/.test(r.date) ? r.date.slice(0, 7) : monthKey()
    const pid = periodId(month, unit)
    const arr = byPeriod.get(pid) ?? []
    arr.push(r)
    byPeriod.set(pid, arr)
  }
  const lines: string[] = []
  for (const [pid, list] of byPeriod) {
    const month = pid.slice(0, pid.indexOf(':'))
    if (!getState().qaPeriods.some((p) => p.id === pid)) {
      // Volume is unknown from here; 0 keeps the target at 0 until the user
      // fills it in on the period screen.
      createPeriod({ month, operation: unit, monthlyVolume: 0 })
    }
    const res = importBotReviews(pid, unit, list)
    lines.push(
      `${res.total} review${res.total === 1 ? '' : 's'} → ${operationShort(unit)} ${monthLabel(month)}` +
        (res.created > 0 ? ` (${res.created} new chart${res.created === 1 ? '' : 's'})` : ''),
    )
  }
  return lines
}

let syncInFlight = false

/**
 * Scan the folder and import changed batch files. `force` re-imports
 * everything regardless of the stored lastModified stamps.
 */
export async function syncNow(force = false): Promise<void> {
  if (!dirHandle || state.permission !== 'granted' || syncInFlight) return
  syncInFlight = true
  setSyncState({ syncing: true })
  const notes: string[] = []
  const imported: string[] = []
  const nextFileState: Record<string, number> = force ? {} : { ...prefs.fileState }
  try {
    let sawBatchFile = false
    for await (const entry of dirHandle.values()) {
      if (entry.kind !== 'file') continue
      const m = BATCH_FILE_RE.exec(entry.name)
      if (!m) continue
      sawBatchFile = true

      const suffix = (m[1] ?? '').toLowerCase()
      const unit = suffix === '' ? prefs.defaultUnit : suffix
      if (!isOperationId(unit)) {
        notes.push(`${entry.name}: unit “${suffix}” isn’t a CES operation — skipped`)
        continue
      }

      const file = await (entry as FileSystemFileHandle).getFile()
      if (!force && prefs.fileState[entry.name] === file.lastModified) {
        notes.push(`${entry.name}: unchanged`)
        continue
      }
      const { reviews, error } = parseBotBatch(await file.text())
      if (error) {
        notes.push(`${entry.name}: ${error}`)
        continue
      }
      imported.push(...importRouted(unit, reviews))
      notes.push(`${entry.name}: imported ${reviews.length} review${reviews.length === 1 ? '' : 's'}`)
      nextFileState[entry.name] = file.lastModified
    }
    if (!sawBatchFile) {
      notes.push('No ces_batch*.json files in this folder yet.')
    }
    prefs = { ...prefs, fileState: nextFileState }
    savePrefs()
    setSyncState({
      syncing: false,
      lastSyncAt: new Date().toISOString(),
      fileNotes: notes,
      summary: imported.join(' · '),
      error: null,
    })
  } catch (err) {
    setSyncState({
      syncing: false,
      lastSyncAt: new Date().toISOString(),
      fileNotes: notes,
      error: 'Sync failed: ' + (err as Error).message,
    })
  } finally {
    syncInFlight = false
  }
}

// ----- background runner ------------------------------------------------------

/**
 * Mounted once in Layout so the sync keeps running while the app is open,
 * whichever tab the user is on.
 */
export function useBotSyncRunner(): void {
  useEffect(() => {
    if (!QA_ENABLED || !supported) return
    let timer: ReturnType<typeof setInterval> | undefined
    void restoreHandle().then(() => {
      if (state.enabled) void syncNow()
      timer = setInterval(() => {
        if (state.enabled && document.visibilityState === 'visible') void syncNow()
      }, SYNC_INTERVAL_MS)
    })
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [])
}
