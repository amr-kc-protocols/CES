import { useState, type ReactNode } from 'react'
import { CREDENTIAL_LABELS } from '../../../data/academy'
import { describeAudience } from '../program'
import type { Credential, NeopAudience, NeopLocation } from '../../../types'

// ---------------------------------------------------------------------------
// The small controls every setup step shares. Kept plain on purpose: a
// facilitator setting up an academy is filling in a form, and every control
// here should look like the thing it does.
// ---------------------------------------------------------------------------

/** A button that is on or off, announced as such. */
export function ChipToggle({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
  title?: string
}) {
  return (
    <button type="button" className="chip-toggle" aria-pressed={on} onClick={onClick} title={title}>
      {children}
    </button>
  )
}

/**
 * "Who needs this?" — everyone, or only some credentials and stations.
 *
 * Collapsed to one line saying who it applies to, because most items apply to
 * everyone and an open picker on every row would turn a ten-line checklist
 * into a wall of buttons.
 */
export function AudiencePicker({
  value,
  onChange,
  credentials,
  locations,
  idPrefix,
}: {
  value: NeopAudience | undefined
  onChange: (next: NeopAudience | undefined) => void
  credentials: Credential[]
  locations: NeopLocation[]
  idPrefix: string
}) {
  const [open, setOpen] = useState(false)
  const creds = value?.credentials ?? []
  const locs = value?.locations ?? []
  const set = (next: NeopAudience) => {
    const clean: NeopAudience = {}
    if (next.credentials?.length) clean.credentials = next.credentials
    if (next.locations?.length) clean.locations = next.locations
    onChange(clean.credentials || clean.locations ? clean : undefined)
  }
  const toggle = <T,>(list: T[], x: T): T[] => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

  return (
    <div className="audience">
      <button
        type="button"
        className="link-btn audience-summary"
        aria-expanded={open}
        aria-controls={`${idPrefix}-who`}
        onClick={() => setOpen(!open)}
      >
        {describeAudience(value, locations)}{' '}
        <span aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div id={`${idPrefix}-who`} className="audience-panel">
          <div className="audience-row">
            <span className="subtle">Credential</span>
            {credentials.map((c) => (
              <ChipToggle key={c} on={creds.includes(c)} onClick={() => set({ credentials: toggle(creds, c), locations: locs })}>
                {CREDENTIAL_LABELS[c]}
              </ChipToggle>
            ))}
          </div>
          {locations.length > 1 && (
            <div className="audience-row">
              <span className="subtle">Station</span>
              {locations.map((l) => (
                <ChipToggle key={l.id} on={locs.includes(l.id)} onClick={() => set({ credentials: creds, locations: toggle(locs, l.id) })}>
                  {l.short || l.name}
                </ChipToggle>
              ))}
            </div>
          )}
          <div className="help-text" style={{ marginTop: 4 }}>
            Nothing picked means everyone. Picking narrows it — EMTs only, or paramedics at one station.
          </div>
        </div>
      )}
    </div>
  )
}

/** Up / down / remove for one row of an ordered list. */
export function RowActions({
  index,
  count,
  onMove,
  onRemove,
  label,
}: {
  index: number
  count: number
  onMove: (from: number, to: number) => void
  onRemove: () => void
  label: string
}) {
  return (
    <span className="row-actions">
      <button type="button" className="btn sm ghost" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move ${label} up`}>
        ↑
      </button>
      <button type="button" className="btn sm ghost" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move ${label} down`}>
        ↓
      </button>
      <button type="button" className="btn sm ghost danger-text" onClick={onRemove} aria-label={`Remove ${label}`}>
        ✕
      </button>
    </span>
  )
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const copy = list.slice()
  const [x] = copy.splice(from, 1)
  copy.splice(to, 0, x)
  return copy
}

/**
 * A list of names typed one at a time. Enter adds; ✕ removes. Duplicates are
 * refused quietly, because a name in a picker twice is a name picked wrong.
 */
export function NameList({
  names,
  onChange,
  placeholder,
  id,
  label,
}: {
  names: string[]
  onChange: (next: string[]) => void
  placeholder: string
  id: string
  label: string
}) {
  const [text, setText] = useState('')
  const add = () => {
    const v = text.trim()
    if (!v) return
    if (!names.some((n) => n.toLowerCase() === v.toLowerCase())) onChange([...names, v])
    setText('')
  }
  return (
    <div>
      <div className="name-chips" aria-live="polite">
        {names.length === 0 && <span className="subtle">None yet.</span>}
        {names.map((n) => (
          <span key={n} className="name-chip">
            {n}
            <button type="button" aria-label={`Remove ${n}`} onClick={() => onChange(names.filter((x) => x !== n))}>
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="inline-add">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="btn" onClick={add} disabled={!text.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}

/** One line per entry. Blank lines dropped on the way out. */
export function LinesField({
  id,
  label,
  help,
  value,
  onChange,
  rows = 4,
}: {
  id: string
  label: string
  help?: string
  value: string[]
  onChange: (next: string[]) => void
  rows?: number
}) {
  // Kept as raw text while typing so a trailing newline survives the keystroke
  // that makes it; split only when the text is read back out.
  const [text, setText] = useState(value.join('\n'))
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={rows}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onChange(e.target.value.split('\n').map((l) => l.trim()).filter(Boolean))
        }}
      />
      {help && <div className="help-text">{help}</div>}
    </div>
  )
}

/** A number input that never hands back NaN. */
export function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  help,
  suffix,
}: {
  id: string
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
  help?: string
  suffix?: string
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : ''}
          style={{ maxWidth: 120 }}
          onChange={(e) => {
            const n = parseFloat(e.target.value)
            if (Number.isFinite(n)) onChange(Math.max(min, max !== undefined ? Math.min(max, n) : n))
          }}
        />
        {suffix && <span className="subtle">{suffix}</span>}
      </div>
      {help && <div className="help-text">{help}</div>}
    </div>
  )
}
