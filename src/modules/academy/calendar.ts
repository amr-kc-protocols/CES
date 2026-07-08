import { fromISODate } from '../../lib/date'
import type { AcademyCohort, AcademyDay } from '../../types'

// ---------------------------------------------------------------------------
// iCalendar (.ics) export for an academy schedule. Each schedule block with a
// parseable time becomes a timed event on its day; blocks without a usable
// time (or days with no blocks) become an all-day event. Times are written as
// floating local times (no timezone), which every calendar app imports as the
// viewer's local time — correct for a schedule that is the same wall-clock
// time wherever it's opened.
// ---------------------------------------------------------------------------

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** yyyy-mm-dd -> yyyymmdd */
function dateStamp(iso: string): string {
  return iso.replace(/-/g, '')
}

/** Parse a single time token ("0900", "9:00", "900", "16") into minutes-of-day. */
function tokenToMinutes(tok: string): number | null {
  const digits = tok.replace(/[^0-9]/g, '')
  if (!digits) return null
  let h: number
  let m: number
  if (digits.length <= 2) {
    h = Number(digits)
    m = 0
  } else if (digits.length === 3) {
    h = Number(digits.slice(0, 1))
    m = Number(digits.slice(1))
  } else {
    h = Number(digits.slice(0, 2))
    m = Number(digits.slice(2, 4))
  }
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

interface ParsedTime {
  startMin: number
  endMin: number
}

/** Parse a block time string ("0900–0915", "1600", "0900-1600") into minutes. */
export function parseBlockTime(time: string): ParsedTime | null {
  if (!time || !time.trim()) return null
  const normalized = time.replace(/[–—]/g, '-').replace(/\bto\b/gi, '-')
  const parts = normalized.split('-').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const start = tokenToMinutes(parts[0])
  if (start === null) return null
  let end = parts.length > 1 ? tokenToMinutes(parts[1]) : null
  if (end === null || end <= start) end = Math.min(start + 30, 24 * 60 - 1)
  return { startMin: start, endMin: end }
}

function localDateTime(iso: string, minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${dateStamp(iso)}T${pad(h)}${pad(m)}00`
}

/** Escape text for an ICS value (RFC 5545). */
function escICS(s: string): string {
  return (s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Fold long lines to 75 octets per RFC 5545 (continuation lines start with a space). */
function fold(line: string): string {
  if (line.length <= 73) return line
  const out: string[] = []
  let rest = line
  out.push(rest.slice(0, 73))
  rest = rest.slice(73)
  while (rest.length > 72) {
    out.push(' ' + rest.slice(0, 72))
    rest = rest.slice(72)
  }
  if (rest.length) out.push(' ' + rest)
  return out.join('\r\n')
}

function nextDay(iso: string): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function scheduleICS(cohort: AcademyCohort, days: AcademyDay[]): string {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AMR CES//Academy Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escICS(cohort.label)}`,
  ]

  const pushEvent = (uid: string, opts: {
    date: string
    startMin?: number
    endMin?: number
    summary: string
    description?: string
    location?: string
  }) => {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${uid}@ces.amr`)
    lines.push(`DTSTAMP:${dtstamp}`)
    if (opts.startMin != null && opts.endMin != null) {
      lines.push(`DTSTART:${localDateTime(opts.date, opts.startMin)}`)
      lines.push(`DTEND:${localDateTime(opts.date, opts.endMin)}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(opts.date)}`)
      lines.push(`DTEND;VALUE=DATE:${dateStamp(nextDay(opts.date))}`)
    }
    lines.push(`SUMMARY:${escICS(opts.summary)}`)
    if (opts.description) lines.push(`DESCRIPTION:${escICS(opts.description)}`)
    if (opts.location) lines.push(`LOCATION:${escICS(opts.location)}`)
    lines.push('END:VEVENT')
  }

  for (const day of days) {
    const dayCtx = day.facilitators ? `Facilitators: ${day.facilitators}` : ''
    const timedBlocks = day.blocks.filter((b) => parseBlockTime(b.time))
    if (timedBlocks.length > 0) {
      day.blocks.forEach((b, i) => {
        const t = parseBlockTime(b.time)
        const descParts = [b.note, day.title ? `Part of: ${day.title}` : '', dayCtx].filter(Boolean)
        if (t) {
          pushEvent(`${cohort.id}-${day.id}-${i}`, {
            date: day.date,
            startMin: t.startMin,
            endMin: t.endMin,
            summary: b.title || day.title || 'Academy',
            description: descParts.join('\n'),
            location: day.location,
          })
        }
      })
    } else {
      // No parseable block times — one all-day event summarizing the day.
      const blockList = day.blocks.map((b) => `${b.time ? b.time + ' ' : ''}${b.title}`).join('\n')
      const descParts = [dayCtx, day.note, blockList].filter(Boolean)
      pushEvent(`${cohort.id}-${day.id}-all`, {
        date: day.date,
        summary: day.title || 'Academy day',
        description: descParts.join('\n'),
        location: day.location,
      })
    }
  }

  lines.push('END:VCALENDAR')
  // Fold every logical line to <=75 octets per RFC 5545.
  return lines.map(fold).join('\r\n')
}

export function downloadICS(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function weekdayLabel(iso: string): string {
  return WEEKDAYS[fromISODate(iso).getDay()]
}
