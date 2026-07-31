import type { CSSProperties, ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Tab strip.
//
// The .segmented strips were rows of plain buttons: a screen reader announced
// six unrelated buttons with no indication that they were a set, which one was
// showing, or that a panel below belonged to them. This applies the WAI-ARIA
// tabs pattern once, so every strip that switches a content region gets it.
//
// Activation is automatic (moving to a tab selects it), which is the right
// choice here — switching panels is local and cheap, so there is no reason to
// make a keyboard user press Enter to see what a mouse user sees on hover.
// ---------------------------------------------------------------------------

export interface TabDef<T extends string> {
  id: T
  label: ReactNode
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  idPrefix,
  label,
  style,
  className = 'segmented',
}: {
  tabs: readonly TabDef<T>[]
  value: T
  onChange: (id: T) => void
  /** Namespaces the generated ids so two strips can coexist on one page. */
  idPrefix: string
  /** Names the strip for assistive tech, e.g. "Course sections". */
  label: string
  style?: CSSProperties
  className?: string
}) {
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    const i = tabs.findIndex((t) => t.id === value)
    if (i < 0) return
    let next = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    else return

    e.preventDefault()
    onChange(tabs[next].id)
    // The newly selected tab is the only one in the tab order, so focus has to
    // follow the selection or the next Tab press would leave the strip.
    document.getElementById(`${idPrefix}-tab-${tabs[next].id}`)?.focus()
  }

  return (
    <div className={className} style={style} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((t) => {
        const selected = t.id === value
        return (
          <button
            key={t.id}
            id={`${idPrefix}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'active' : ''}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Same strip, different meaning: picking one value from a set rather than
 * switching panels (a chart score, a shift number). Tabs would be the wrong
 * role — nothing here controls a panel — so this announces as a radio group
 * and follows the radio keyboard pattern.
 */
export function SegmentedRadio<T extends string | number>({
  options,
  value,
  onChange,
  idPrefix,
  label,
  style,
  optionStyle,
}: {
  options: readonly { id: T; label: ReactNode }[]
  value: T | undefined
  onChange: (id: T) => void
  idPrefix: string
  label: string
  style?: CSSProperties
  optionStyle?: CSSProperties
}) {
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    const i = options.findIndex((o) => o.id === value)
    let next = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (i - 1 + options.length) % options.length
    else return

    e.preventDefault()
    // Nothing selected yet: an arrow key takes the first option rather than
    // computing an offset from -1.
    const pick = i < 0 ? options[0] : options[next]
    onChange(pick.id)
    document.getElementById(`${idPrefix}-opt-${pick.id}`)?.focus()
  }

  return (
    <div
      className="segmented"
      style={style}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {options.map((o) => {
        const checked = o.id === value
        return (
          <button
            key={o.id}
            id={`${idPrefix}-opt-${o.id}`}
            type="button"
            role="radio"
            aria-checked={checked}
            // One stop in the tab order for the whole group; arrows move
            // within it. Falls back to the first option when nothing is set.
            tabIndex={checked || (value === undefined && o.id === options[0].id) ? 0 : -1}
            className={checked ? 'active' : ''}
            style={optionStyle}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Props for the region a tab controls. Spread onto the panel wrapper. */
export function tabPanelProps(idPrefix: string, id: string) {
  return {
    role: 'tabpanel',
    id: `${idPrefix}-panel-${id}`,
    'aria-labelledby': `${idPrefix}-tab-${id}`,
    // Panels hold scrollable content, so they need to be focusable to be
    // reachable by keyboard scroll after the tab is activated.
    tabIndex: 0,
  } as const
}
