// Date helpers. All calendar math is done on local dates (yyyy-mm-dd strings)
// to avoid timezone drift around the 30-day CE deadline.

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Today's local date as yyyy-mm-dd. */
export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a yyyy-mm-dd string into a local Date at midnight. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Whole days from today until `iso` (negative = overdue/past). */
export function daysFromToday(iso: string): number {
  const a = fromISODate(todayISO()).getTime()
  const b = fromISODate(iso).getTime()
  return Math.round((b - a) / MS_PER_DAY)
}

/** Month key yyyy-mm for a given ISO date (defaults to today). */
export function monthKey(iso: string = todayISO()): string {
  return iso.slice(0, 7)
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** '2026-07' -> 'July 2026'. */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`
}

/** '2026-07-06' -> 'Jul 6, 2026'. */
export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = fromISODate(iso)
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`
}

export function formatDateTime(isoTimestamp?: string): string {
  if (!isoTimestamp) return '—'
  const d = new Date(isoTimestamp)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Display a signature timestamp. New signatures store a full ISO instant
 * (date + time, for record-keeping); older records stored a date-only string.
 * Show the time when we have it, the date otherwise.
 */
export function formatSignedAt(iso?: string): string {
  if (!iso) return '—'
  return iso.includes('T') ? formatDateTime(iso) : formatDate(iso)
}
