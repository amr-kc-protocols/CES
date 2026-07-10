import { useSyncExternalStore } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getState, setState, onStateChange } from './store'
import { diffRecords, toRecords, applyRemote, recordKey, type SyncRecord } from './records'
import type { DBShape } from '../types'

// ---------------------------------------------------------------------------
// Offline-first cloud sync (Supabase).
//
// The local store stays the working copy: every edit lands in localStorage
// first, then queues here (outbox) and pushes when the network and session
// allow. Pulls run on start, on focus, on reconnect, and on an interval;
// remote records merge in last-write-wins per record, except records with a
// pending local push — local wins those until they flush.
//
// The supabase-js client is imported dynamically so devices that never
// configure sync never download it.
// ---------------------------------------------------------------------------

const CONFIG_KEY = 'ces.cloud.config'
const OUTBOX_KEY = 'ces.cloud.outbox'
const CURSOR_KEY = 'ces.cloud.cursor'
const PULL_INTERVAL_MS = 120_000
const FLUSH_DEBOUNCE_MS = 1_500

export interface CloudConfig {
  url: string
  anonKey: string
}

export interface SyncStatus {
  configured: boolean
  signedIn: boolean
  email?: string
  /** Records queued locally, waiting to push. */
  pending: number
  syncing: boolean
  lastSync?: string
  error?: string
}

// ----- config ----------------------------------------------------------------

export function getCloudConfig(): CloudConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    return raw ? (JSON.parse(raw) as CloudConfig) : null
  } catch {
    return null
  }
}

export function setCloudConfig(config: CloudConfig | null): void {
  if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  else localStorage.removeItem(CONFIG_KEY)
}

// ----- outbox ------------------------------------------------------------------

function loadOutbox(): SyncRecord[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY)
    return raw ? (JSON.parse(raw) as SyncRecord[]) : []
  } catch {
    return []
  }
}

let outbox: SyncRecord[] = loadOutbox()

function saveOutbox(): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox))
  } catch {
    // Best effort — the records are still recoverable from local state.
  }
}

function queueRecords(records: SyncRecord[]): void {
  for (const rec of records) {
    const k = recordKey(rec)
    const idx = outbox.findIndex((r) => recordKey(r) === k)
    if (idx === -1) outbox.push(rec)
    else outbox[idx] = rec
  }
  saveOutbox()
}

// ----- status store -----------------------------------------------------------

let status: SyncStatus = {
  configured: !!getCloudConfig(),
  signedIn: false,
  pending: outbox.length,
  syncing: false,
}
const listeners = new Set<() => void>()

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch, pending: outbox.length }
  listeners.forEach((l) => l())
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => status,
    () => status,
  )
}

// ----- engine -------------------------------------------------------------------

let client: SupabaseClient | null = null
let applyingRemote = false
let flushTimer: ReturnType<typeof setTimeout> | undefined
let pullTimer: ReturnType<typeof setInterval> | undefined
let started = false

async function getClient(): Promise<SupabaseClient | null> {
  if (client) return client
  const config = getCloudConfig()
  if (!config) return null
  const { createClient } = await import('@supabase/supabase-js')
  client = createClient(config.url, config.anonKey)
  return client
}

/** Wire the engine: call once at app start. Safe to call when unconfigured. */
export function initSync(): void {
  if (started) return
  started = true

  // Local edits -> outbox (unless the edit IS a remote merge).
  onStateChange((prev, next) => {
    if (applyingRemote) return
    if (!getCloudConfig()) return
    const changed = diffRecords(prev, next)
    if (changed.length === 0) return
    queueRecords(changed)
    setStatus({})
    scheduleFlush()
  })

  if (!getCloudConfig()) return
  void connect()
}

async function connect(): Promise<void> {
  const c = await getClient()
  if (!c) return

  const { data } = await c.auth.getSession()
  setStatus({ configured: true, signedIn: !!data.session, email: data.session?.user.email ?? undefined })

  c.auth.onAuthStateChange((_event, session) => {
    setStatus({ signedIn: !!session, email: session?.user.email ?? undefined })
    if (session) void syncNow()
  })

  window.addEventListener('online', () => void syncNow())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  if (pullTimer) clearInterval(pullTimer)
  pullTimer = setInterval(() => void syncNow(), PULL_INTERVAL_MS)

  if (data.session) void syncNow()
}

function scheduleFlush(): void {
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void flush(), FLUSH_DEBOUNCE_MS)
}

async function flush(): Promise<void> {
  const c = await getClient()
  if (!c || !status.signedIn || outbox.length === 0) return
  const batch = outbox.slice()
  setStatus({ syncing: true, error: undefined })
  const rows = batch.map((r) => ({
    collection: r.collection,
    id: r.id,
    data: r.data,
    deleted: !!r.deleted,
  }))
  const { error } = await c.from('records').upsert(rows, { onConflict: 'collection,id' })
  if (error) {
    setStatus({ syncing: false, error: `Push failed: ${error.message}` })
    return
  }
  // Drop exactly what was sent; anything re-edited mid-flight stays queued.
  const sent = new Map(batch.map((r) => [recordKey(r), JSON.stringify(r.data)]))
  outbox = outbox.filter((r) => sent.get(recordKey(r)) !== JSON.stringify(r.data))
  saveOutbox()
  setStatus({ syncing: false, lastSync: new Date().toISOString() })
}

async function pull(): Promise<void> {
  const c = await getClient()
  if (!c || !status.signedIn) return
  setStatus({ syncing: true, error: undefined })
  const cursor = localStorage.getItem(CURSOR_KEY)
  let query = c.from('records').select('*').order('updated_at', { ascending: true }).limit(1000)
  if (cursor) query = query.gte('updated_at', cursor)
  const { data, error } = await query
  if (error) {
    setStatus({ syncing: false, error: `Pull failed: ${error.message}` })
    return
  }
  const rows = (data ?? []) as (SyncRecord & { updated_at: string })[]
  if (rows.length > 0) {
    const skip = new Set(outbox.map(recordKey))
    applyingRemote = true
    try {
      setState((db: DBShape) => applyRemote(db, rows, skip))
    } finally {
      applyingRemote = false
    }
    localStorage.setItem(CURSOR_KEY, rows[rows.length - 1].updated_at)
  }
  setStatus({ syncing: false, lastSync: new Date().toISOString() })
}

/** Push what's queued, then pull what's new. */
export async function syncNow(): Promise<void> {
  await flush()
  await pull()
}

/** Seed the cloud with everything on this device (first-time setup). */
export async function pushAllLocalData(): Promise<void> {
  queueRecords([...toRecords(getState()).values()])
  setStatus({})
  await flush()
}

// ----- auth ---------------------------------------------------------------------

export async function signInWithEmail(email: string): Promise<{ error?: string }> {
  const c = await getClient()
  if (!c) return { error: 'Enter and save the project URL and key first.' }
  const { error } = await c.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  return error ? { error: error.message } : {}
}

export async function signOut(): Promise<void> {
  const c = await getClient()
  await c?.auth.signOut()
  setStatus({ signedIn: false, email: undefined })
}

/** Apply new config: reset the client so the next call uses it, and connect. */
export async function reconnectWithConfig(config: CloudConfig): Promise<void> {
  setCloudConfig(config)
  client = null
  setStatus({ configured: true })
  await connect()
}
