// ---------------------------------------------------------------------------
// What a student's work line collides with.
//
// Every AEMT student here is a working EMT on a bid line, and the course is
// scheduled on top of that line rather than instead of it. Until the line was
// recorded, the program found out what that meant in week six — when a student
// had quietly burned through the eight-hour absence cap an hour at a time,
// every Thursday, in a way nobody could see coming because nobody had put the
// two schedules next to each other.
//
// Putting them next to each other is all this does. Two questions:
//
//   Does this student work on this date? — which is what the placement board
//   needs before it books a twelve-hour rotation on top of a twelve-hour shift.
//
//   How much of this class session does their line cover? — which totalled
//   across the course is the number that decides whether they can pass the
//   attendance policy at all.
//
// THE MIDNIGHT CASE IS THE ONE THAT BITES. A 1236 line runs 1200 to 0000. Read
// naively that is a shift of minus twelve hours, and every overlap test against
// it silently returns false — which is the failure mode where the tool reports
// no conflict for the students who have the worst one.
// ---------------------------------------------------------------------------

import type { AemtSession, AemtStudent, AemtWorkPattern } from '../../types'

/** Minutes since midnight. "13:00" -> 780. */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * A shift as a half-open minute interval from its start day's midnight.
 *
 * An end at or before the start means it crossed midnight, so the end is
 * pushed into the next day rather than treated as a negative span.
 */
export function shiftSpan(p: { startTime: string; endTime: string }): { start: number; end: number } {
  const start = minutesOf(p.startTime)
  let end = minutesOf(p.endTime)
  if (end <= start) end += 24 * 60
  return { start, end }
}

export const shiftHours = (p: { startTime: string; endTime: string }): number => {
  const { start, end } = shiftSpan(p)
  return Math.round(((end - start) / 60) * 100) / 100
}

const dayIndex = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** Whole days between two ISO dates, positive when `iso` is the later. */
function daysBetween(fromISO: string, iso: string): number {
  const [ay, am, ad] = fromISO.split('-').map(Number)
  const [by, bm, bd] = iso.split('-').map(Number)
  const a = Date.UTC(ay, am - 1, ad)
  const b = Date.UTC(by, bm - 1, bd)
  return Math.round((b - a) / 86_400_000)
}

/**
 * Which half of the rotation a date falls in: 1 or 2.
 *
 * Anchored to the Sunday that begins week one, because a two-week line has no
 * meaning without one — and a rotation guessed from the calendar week number
 * is right half the time, which is worse than being wrong all of it.
 */
export function rotationWeek(p: AemtWorkPattern, iso: string): 1 | 2 {
  const days = daysBetween(p.anchorSunday, iso)
  // Floor toward negative infinity so dates before the anchor still alternate
  // correctly rather than folding back on themselves.
  const week = Math.floor(days / 7)
  return (((week % 2) + 2) % 2) === 0 ? 1 : 2
}

/** Does this line have the student on shift on this date? */
export function worksOn(p: AemtWorkPattern | undefined, iso: string): boolean {
  if (!p) return false
  const days = rotationWeek(p, iso) === 1 ? p.weekOne : p.weekTwo
  return days.includes(dayIndex(iso))
}

export interface SessionClash {
  session: AemtSession
  /** Hours of the session the line covers. */
  overlapHours: number
  /** The whole session is lost, rather than part of it. */
  whole: boolean
}

/**
 * Where a line and a class session overlap on the clock.
 *
 * A session with no times filed cannot be compared, so it is reported as no
 * overlap rather than assumed to be one — the schedule carries times for every
 * classroom row, and a row without them is an assignment, not a session
 * somebody has to be in a room for.
 */
export function sessionClash(
  p: AemtWorkPattern | undefined,
  session: AemtSession,
): SessionClash | undefined {
  if (!p || !session.date || !session.startTime || !session.endTime) return undefined
  if (!worksOn(p, session.date)) return undefined

  const shift = shiftSpan(p)
  const klass = shiftSpan({ startTime: session.startTime, endTime: session.endTime })
  const overlap = Math.min(shift.end, klass.end) - Math.max(shift.start, klass.start)
  if (overlap <= 0) return undefined

  const hours = Math.round((overlap / 60) * 100) / 100
  return {
    session,
    overlapHours: hours,
    whole: overlap >= klass.end - klass.start,
  }
}

export interface WorkConflictSummary {
  student: AemtStudent
  /** Absent where no line has been recorded — not the same as no conflict. */
  pattern?: AemtWorkPattern
  clashes: SessionClash[]
  /** Class hours the line covers across the whole course. */
  hoursLost: number
  /** Class days they are rostered on, whether or not the clock overlaps. */
  daysWorkingClass: number
  /** Over the program's absence cap on the line alone, before anything else. */
  overCap: boolean
}

/**
 * Every class session this student's line covers, and what it costs.
 *
 * `maxAbsentHours` is passed in rather than imported so this stays a pure
 * function the store, the screens and the check can all share — and so a
 * course that files a different cap is measured against its own.
 */
export function workConflicts(
  student: AemtStudent,
  sessions: AemtSession[],
  maxAbsentHours: number,
): WorkConflictSummary {
  const p = student.workPattern
  const clashes: SessionClash[] = []
  let daysWorkingClass = 0

  for (const s of sessions) {
    if (!s.date || !s.startTime) continue
    if (worksOn(p, s.date)) daysWorkingClass++
    const c = sessionClash(p, s)
    if (c) clashes.push(c)
  }

  const hoursLost = Math.round(clashes.reduce((n, c) => n + c.overlapHours, 0) * 100) / 100
  return {
    student,
    pattern: p,
    clashes,
    hoursLost,
    daysWorkingClass,
    overCap: hoursLost > maxAbsentHours,
  }
}

/** "Tue, Thu" — the days a line works, for a screen that has one line to give it. */
const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const daysLabel = (days: number[]): string =>
  [...days].sort((a, b) => a - b).map((d) => DAY_LABEL[d]).join(', ')

/** "KC105 · 1000–2000 · wk1 Tue, Wed, Thu, Fri / wk2 Tue, Wed, Thu, Fri". */
export function patternLabel(p: AemtWorkPattern): string {
  const same = daysLabel(p.weekOne) === daysLabel(p.weekTwo)
  const days = same
    ? daysLabel(p.weekOne)
    : `wk1 ${daysLabel(p.weekOne)} / wk2 ${daysLabel(p.weekTwo)}`
  return [
    p.line,
    `${p.startTime}–${p.endTime}`,
    days,
    p.shiftType ? `type ${p.shiftType}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
