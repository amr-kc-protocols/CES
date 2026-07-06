import { useRef, useSyncExternalStore } from 'react'
import type { DBShape } from '../types'

// ---------------------------------------------------------------------------
// Local-first store.
//
// Spec §8 open question 3 (persistence): for the MVP this keeps all records in
// localStorage behind this single module. Every read/write goes through here,
// so swapping in a backend (Supabase / Vercel Postgres) later means changing
// only load()/persist() — the UI and domain actions are untouched.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ces.db.v1'
const CURRENT_VERSION = 1

function emptyDB(): DBShape {
  return {
    version: CURRENT_VERSION,
    ceClasses: [],
    qaPeriods: [],
    charts: [],
    academyCohorts: [],
    trainees: [],
    settings: { samplePercent: 0.2, reviewer: '', classBuilderUrl: '', botUrl: '' },
  }
}

function load(): DBShape {
  if (typeof localStorage === 'undefined') return emptyDB()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDB()
    const parsed = JSON.parse(raw) as Partial<DBShape>
    // Shallow-merge onto defaults so new fields don't break older saves.
    return { ...emptyDB(), ...parsed, settings: { ...emptyDB().settings, ...parsed.settings } }
  } catch {
    return emptyDB()
  }
}

let state: DBShape = load()
const listeners = new Set<() => void>()

function persist(next: DBShape): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (err) {
    console.error('CES: failed to persist state', err)
  }
}

export function getState(): DBShape {
  return state
}

export function setState(updater: (prev: DBShape) => DBShape): void {
  state = updater(state)
  persist(state)
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Subscribe a component to the whole DB. */
export function useDB(): DBShape {
  return useSyncExternalStore(subscribe, getState, getState)
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false
  }
  const aArr = Array.isArray(a)
  const bArr = Array.isArray(b)
  if (aArr !== bArr) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  for (const k of ka) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false
    }
  }
  return true
}

/**
 * Derive a slice of the store. Selectors that build fresh arrays/objects are
 * safe here: the snapshot is cached and only replaced when its shallow contents
 * actually change, which keeps useSyncExternalStore's snapshot referentially
 * stable (otherwise React loops with error #185).
 */
export function useSelector<T>(selector: (db: DBShape) => T): T {
  const cache = useRef<{ value: T } | null>(null)
  const getSnapshot = (): T => {
    const next = selector(getState())
    if (cache.current && shallowEqual(cache.current.value, next)) {
      return cache.current.value
    }
    cache.current = { value: next }
    return next
  }
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// ----- import / export / reset (used by Settings) --------------------------

export function exportDB(): string {
  return JSON.stringify(state, null, 2)
}

export function importDB(json: string): void {
  const parsed = JSON.parse(json) as Partial<DBShape>
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Not a CES backup file')
  }
  // Merge settings onto defaults, same as load(): a backup missing a settings
  // field (e.g. samplePercent) must not leave it undefined until next reload.
  setState(() => ({ ...emptyDB(), ...parsed, settings: { ...emptyDB().settings, ...parsed.settings } }))
}

export function resetDB(): void {
  setState(() => emptyDB())
}
