import { useSyncExternalStore } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getState, setState, onStateChange } from './store'
import { diffRecords, toRecords, applyRemote, recordKey, type SyncRecord } from './records'
import { DEFAULT_CLOUD } from '../config/cloud'
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
    if (raw) return JSON.parse(raw) as CloudConfig
  } catch {
    // Fall through to the built-in project.
  }
  // Fresh device: use the baked-in project so setup is just "sign in".
  return DEFAULT_CLOUD.url ? DEFAULT_CLOUD : null
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
let windowListenersWired = false

async function getClient(): Promise<SupabaseClient | null> {
  if (client) return client
  const config = getCloudConfig()
  if (!config) return null
  const { createClient } = await import('@supabase/supabase-js')
  // Implicit flow, explicitly: emailed links carry tokens in the hash and
  // work wherever they're opened (no per-browser code verifier).
  client = createClient(config.url, config.anonKey, { auth: { flowType: 'implicit' } })
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

  // A failed magic link redirects back with the reason in the hash (e.g.
  // otp_expired when a mail scanner pre-consumed the link). Surface it —
  // silently ignoring it left users staring at nothing.
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const authError = hashParams.get('error_description') || hashParams.get('error_code') || hashParams.get('error')
  if (authError) {
    setStatus({
      error: `Sign-in link failed: ${authError}. Corporate mail scanners often consume links — use the 6-digit code from the email instead.`,
    })
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  const { data } = await c.auth.getSession()
  setStatus({ configured: true, signedIn: !!data.session, email: data.session?.user.email ?? undefined })

  c.auth.onAuthStateChange((_event, session) => {
    setStatus({ signedIn: !!session, email: session?.user.email ?? undefined })
    if (session) void syncNow()
  })

  // Guarded: reconnecting with new config must not stack duplicate listeners.
  if (!windowListenersWired) {
    windowListenersWired = true
    window.addEventListener('online', () => void syncNow())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void syncNow()
    })
  }
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

const PULL_PAGE_SIZE = 1000

async function pull(): Promise<void> {
  const c = await getClient()
  if (!c || !status.signedIn) return
  setStatus({ syncing: true, error: undefined })
  // Page until a short page: large backlogs (first pull on a new device)
  // arrive in full instead of waiting a cycle per thousand records.
  for (;;) {
    const cursor = localStorage.getItem(CURSOR_KEY)
    let query = c.from('records').select('*').order('updated_at', { ascending: true }).limit(PULL_PAGE_SIZE)
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
      const last = rows[rows.length - 1].updated_at
      // A full page of identical timestamps can't advance the cursor — bail
      // rather than loop forever; the next cycle's gte re-covers them.
      if (rows.length === PULL_PAGE_SIZE && last === localStorage.getItem(CURSOR_KEY)) break
      localStorage.setItem(CURSOR_KEY, last)
    }
    if (rows.length < PULL_PAGE_SIZE) break
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

/**
 * Sign in by typing the 6-digit code from the sign-in email. Immune to
 * corporate mail scanners that consume one-time links before the user can
 * click them.
 */
export async function verifyEmailCode(email: string, code: string): Promise<{ error?: string }> {
  const c = await getClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { error } = await c.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
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
