import type { AttendanceStatus } from '../types'

// ---------------------------------------------------------------------------
// Attendance grid cell.
//
// Both grids (academy days, AEMT sessions) were clickable <td>s, which meant
// they could not be reached or operated by keyboard at all, and a screen
// reader announced a bare "✓" with nothing to say who or what it belonged to.
// The cell is now a real button carrying its own label, and the grid supports
// arrow-key movement so marking a roster does not require a mouse.
// ---------------------------------------------------------------------------

const GLYPH: Record<string, string> = { present: '✓', absent: '✗', blank: '·' }

const WORD: Record<string, string> = {
  present: 'present',
  absent: 'absent',
  blank: 'not recorded',
}

export function AttendanceCell({
  status,
  label,
  title,
  canEdit,
  row,
  col,
  onCycle,
}: {
  status: AttendanceStatus | undefined
  /** Who and what this cell is — read out in place of a bare glyph. */
  label: string
  /** Hover text, which may carry more detail than the accessible label. */
  title?: string
  canEdit: boolean
  row: number
  col: number
  onCycle: () => void
}) {
  const key = status ?? 'blank'

  // Read-only: no interactive element, so nothing lands in the tab order
  // promising an action the viewer cannot take.
  if (!canEdit) {
    return (
      <td className="att-td">
        <span className={`att-cell ${key}`} title={title} aria-label={`${label} — ${WORD[key]}`}>
          {GLYPH[key]}
        </span>
      </td>
    )
  }

  return (
    <td className="att-td">
      <button
        type="button"
        className={`att-cell ${key}`}
        data-att-r={row}
        data-att-c={col}
        title={title}
        aria-label={`${label} — ${WORD[key]}. Activate to cycle present, absent, not recorded.`}
        onClick={onCycle}
      >
        {GLYPH[key]}
      </button>
    </td>
  )
}

/**
 * Arrow-key movement across the grid. Goes on the scroll container, so one
 * handler serves every cell inside it rather than one per cell.
 *
 * Focus moves; it does not wrap. Wrapping in a roster grid reads as a jump to
 * a different student, which is worse than stopping at the edge.
 */
export function attendanceGridKeys(e: React.KeyboardEvent<HTMLElement>): void {
  const step: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  }
  const target = e.target as HTMLElement
  const r = Number(target.dataset?.attR)
  const c = Number(target.dataset?.attC)
  if (Number.isNaN(r) || Number.isNaN(c)) return

  const find = (nr: number, nc: number) =>
    e.currentTarget.querySelector<HTMLButtonElement>(
      `[data-att-r="${nr}"][data-att-c="${nc}"]`,
    )

  let next: HTMLButtonElement | null = null
  if (e.key in step) {
    const [dr, dc] = step[e.key]
    next = find(r + dr, c + dc)
  } else if (e.key === 'Home') {
    next = find(r, 0)
  } else if (e.key === 'End') {
    // Walk out to the last cell in the row rather than assuming a width.
    let last = find(r, c)
    for (let i = c + 1; ; i++) {
      const cell = find(r, i)
      if (!cell) break
      last = cell
    }
    next = last
  } else {
    return
  }

  if (next) {
    e.preventDefault()
    next.focus()
  }
}
