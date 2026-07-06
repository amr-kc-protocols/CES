import type { ReactNode } from 'react'
import { useEffect } from 'react'

// ----- Progress bar --------------------------------------------------------

export function ProgressBar({ pct, complete }: { pct: number; complete?: boolean }) {
  return (
    <div className={`progress${complete ? ' ok' : ''}`} role="progressbar" aria-valuenow={pct}>
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

// ----- Stat tile -----------------------------------------------------------

export function Stat({
  value,
  label,
  alert,
}: {
  value: ReactNode
  label: string
  alert?: boolean
}) {
  return (
    <div className={`stat${alert ? ' alert' : ''}`}>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  )
}

// ----- Empty state ---------------------------------------------------------

export function Empty({
  icon = '📋',
  title,
  children,
}: {
  icon?: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{title}</div>
      {children && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  )
}

// ----- Modal / bottom sheet ------------------------------------------------

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{title}</h2>
          <button className="link-btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
