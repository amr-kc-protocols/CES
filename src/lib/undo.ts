import { useSyncExternalStore } from 'react'

// ---------------------------------------------------------------------------
// One-shot undo for destructive actions. The store is localStorage-backed with
// no history, so actions that delete data register a restore closure here and
// the UndoToast offers it for a short window. Only the most recent action is
// undoable — a new destructive action replaces the previous entry.
// ---------------------------------------------------------------------------

export interface UndoEntry {
  id: number
  label: string
  undo: () => void
}

const UNDO_WINDOW_MS = 10_000

let current: UndoEntry | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let nextId = 1
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((l) => l())
}

/** Register the undo for a destructive action that just ran. */
export function pushUndo(label: string, undo: () => void): void {
  clearTimeout(timer)
  current = { id: nextId++, label, undo }
  timer = setTimeout(dismissUndo, UNDO_WINDOW_MS)
  notify()
}

export function dismissUndo(): void {
  clearTimeout(timer)
  if (!current) return
  current = null
  notify()
}

export function runUndo(): void {
  const entry = current
  dismissUndo()
  entry?.undo()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useUndoEntry(): UndoEntry | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  )
}
