import { useEffect, useRef } from 'react'
import {
  usePendingConfirm,
  useNotice,
  resolveConfirm,
  dismissNotice,
} from '../lib/dialog'

// ---------------------------------------------------------------------------
// Renders whatever confirmAction() / notifyUser() have asked for. Mounted once
// in Layout, so call sites stay one line and no screen carries dialog state it
// does not otherwise care about.
// ---------------------------------------------------------------------------

export function ConfirmHost() {
  const req = usePendingConfirm()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!req) return
    // Focus the affirmative button: it is what the dialog is asking about, and
    // it puts focus inside the dialog so Escape and Tab behave.
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveConfirm(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [req])

  if (!req) return null

  return (
    <div className="overlay" onClick={() => resolveConfirm(false)}>
      <div
        className="sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title">{req.title}</h2>
        <p id="confirm-body" style={{ margin: '8px 0 0', lineHeight: 1.55 }}>
          {req.body}
        </p>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => resolveConfirm(false)}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            className={`btn ${req.danger ? 'danger' : 'primary'}`}
            style={{ marginLeft: 'auto' }}
            onClick={() => resolveConfirm(true)}
          >
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function NoticeToast() {
  const notice = useNotice()
  if (!notice) return null
  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span className="undo-label" style={{ whiteSpace: 'normal' }}>
        {notice.tone === 'crit' ? '⚠ ' : notice.tone === 'warn' ? '⚠ ' : ''}
        {notice.text}
      </span>
      <button className="undo-dismiss" onClick={dismissNotice} aria-label="Dismiss">
        ✕
      </button>
    </div>
  )
}
