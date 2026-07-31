import { useSyncExternalStore } from 'react'

// ---------------------------------------------------------------------------
// Confirmations and notices.
//
// These were window.confirm() and window.alert(), which are unstyled, block
// the whole tab, cannot be dismissed by screen-reader users in the same way as
// the rest of the app, and — the reason it matters here — are suppressed
// outright by some in-app browsers and by "prevent this page from creating
// additional dialogs". A destructive action silently doing nothing, or
// silently proceeding, is worse than an ugly dialog.
//
// Same shape as lib/undo: a plain module store with an imperative entry point,
// so non-React code (docGen's pop-up check) can use it too.
// ---------------------------------------------------------------------------

export interface ConfirmRequest {
  id: number
  title: string
  /** The consequence, in plain words. Shown as the dialog body. */
  body: string
  /** Label for the affirmative button. Name the action, not "OK". */
  confirmLabel: string
  danger: boolean
  resolve: (ok: boolean) => void
}

export interface Notice {
  id: number
  text: string
  tone: 'info' | 'warn' | 'crit'
}

const NOTICE_MS = 6000

let pending: ConfirmRequest | null = null
let notice: Notice | null = null
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let nextId = 1
const listeners = new Set<() => void>()

function notify_(): void {
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/**
 * Ask before doing something destructive. Resolves true if confirmed.
 *
 * Only one confirmation can be open at a time; a second request supersedes the
 * first, which resolves false. Stacked confirmations mean someone is about to
 * agree to something they cannot see.
 */
export function confirmAction(opts: {
  title: string
  body: string
  confirmLabel?: string
  danger?: boolean
}): Promise<boolean> {
  pending?.resolve(false)
  return new Promise<boolean>((resolve) => {
    pending = {
      id: nextId++,
      title: opts.title,
      body: opts.body,
      confirmLabel: opts.confirmLabel ?? 'Confirm',
      danger: opts.danger ?? true,
      resolve,
    }
    notify_()
  })
}

export function resolveConfirm(ok: boolean): void {
  const req = pending
  pending = null
  notify_()
  req?.resolve(ok)
}

/** A message with nothing to decide — the replacement for alert(). */
export function notifyUser(text: string, tone: Notice['tone'] = 'info'): void {
  clearTimeout(noticeTimer)
  notice = { id: nextId++, text, tone }
  noticeTimer = setTimeout(dismissNotice, NOTICE_MS)
  notify_()
}

export function dismissNotice(): void {
  clearTimeout(noticeTimer)
  if (!notice) return
  notice = null
  notify_()
}

export function usePendingConfirm(): ConfirmRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  )
}

export function useNotice(): Notice | null {
  return useSyncExternalStore(
    subscribe,
    () => notice,
    () => null,
  )
}
