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

/**
 * Does the roster START a shift on this date?
 *
 * The calendar answer — what an operations schedule marks with the student's
 * name on it. NOT the same as "are they on duty that day", which is the
 * question everything here actually wants, and the difference is a whole
 * morning wide on a 24-hour line.
 */
export function startsShiftOn(p: AemtWorkPattern | undefined, iso: string): boolean {
  if (!p) return false
  const days = rotationWeek(p, iso) === 1 ? p.weekOne : p.weekTwo
  return days.includes(dayIndex(iso))
}

/** A stretch of one calendar day, in minutes from that day's midnight. */
export interface DutySpan {
  start: number
  end: number
  /** This is the tail of a shift that began the day before. */
  carriedOver: boolean
}

/**
 * When this student is on duty during one calendar day.
 *
 * Two shifts can touch a single day: the one that starts on it, and the tail of
 * the one that started yesterday and ran past midnight. The second is the one
 * that kept getting missed. A 1200-0000 line ends exactly at midnight and
 * bleeds nothing, which is why the first version of this got away with only
 * asking whether a shift started today — and then Wichita's students turned up
 * on 24-hour lines, where a Monday shift occupies Tuesday until 0900 and the
 * roster does not mark Tuesday at all.
 *
 * Reporting that Tuesday as free is the worst answer available: it is not a
 * near miss, it is the tool confidently clearing a student to be in a
 * classroom while they are still on an ambulance.
 */
export function dutySpansOn(p: AemtWorkPattern | undefined, iso: string): DutySpan[] {
  if (!p) return []
  const out: DutySpan[] = []
  const { start, end } = shiftSpan(p)

  if (startsShiftOn(p, iso)) {
    out.push({ start, end: Math.min(end, 24 * 60), carriedOver: false })
  }
  if (end > 24 * 60 && startsShiftOn(p, addDays(iso, -1))) {
    out.push({ start: 0, end: end - 24 * 60, carriedOver: true })
  }
  return out
}

/**
 * Is the student on duty at any point on this date?
 *
 * Any duty, not just a shift starting — so a placement booked on the morning
 * after a 24 is caught, and so is one booked on the day it starts.
 */
export function worksOn(p: AemtWorkPattern | undefined, iso: string): boolean {
  return dutySpansOn(p, iso).length > 0
}

/** ISO date `n` days from `iso`, negative for earlier. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86_400_000)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(
    t.getUTCDate(),
  ).padStart(2, '0')}`
}

export interface SessionClash {
  session: AemtSession
  /** Hours of the session the line covers. */
  overlapHours: number
  /** The whole session is lost, rather than part of it. */
  whole: boolean
  /** The overlap is the tail of a shift that started the day before. */
  carriedOver: boolean
  /**
   * The session butts against a shift without overlapping it — off duty just
   * before it starts, or on duty just after it ends.
   *
   * Not an absence. They can be in the room, the clock does not overlap, and
   * the attendance cap has nothing to say about it. It is here because a
   * student who comes off a twelve-hour shift and walks into a classroom, or
   * walks out of one straight onto an ambulance with no gap to travel in, is a
   * real scheduling fact — and reporting that day as clean is technically true
   * and practically useless.
   *
   * Three of the six students on this cohort finish class at 1200 and start a
   * shift at 1200. That is zero minutes to get across town, which is the sort
   * of thing worth seeing on a screen before somebody is late twice and it
   * becomes an attendance conversation.
   */
  tightAgainstShift?: 'off-before' | 'on-after'
}

/** A gap this small between a class and a shift is no gap at all. */
export const TIGHT_GAP_HOURS = 2

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

  const spans = dutySpansOn(p, session.date)
  if (!spans.length) return undefined

  const klass = shiftSpan({ startTime: session.startTime, endTime: session.endTime })
  const klassLength = klass.end - klass.start

  // A day can hold two spans — the shift starting today and yesterday's tail —
  // so take the worst of them rather than the first.
  let best: { overlap: number; carriedOver: boolean } | undefined
  for (const sp of spans) {
    const overlap = Math.min(sp.end, klass.end) - Math.max(sp.start, klass.start)
    if (overlap > 0 && (!best || overlap > best.overlap)) {
      best = { overlap, carriedOver: sp.carriedOver }
    }
  }

  if (!best) {
    // No overlap on the clock. A shift may still end just before the session
    // starts, or start just after it ends, which is not an absence and is not
    // nothing either.
    const endsBefore = spans
      .map((sp) => klass.start - sp.end)
      .filter((gap) => gap >= 0 && gap <= TIGHT_GAP_HOURS * 60)
    const startsAfter = spans
      .map((sp) => sp.start - klass.end)
      .filter((gap) => gap >= 0 && gap <= TIGHT_GAP_HOURS * 60)
    if (!endsBefore.length && !startsAfter.length) return undefined
    return {
      session,
      overlapHours: 0,
      whole: false,
      carriedOver: spans.some((sp) => sp.carriedOver),
      // Coming off a shift into class is the worse of the two — they have been
      // awake for twelve hours — so it wins when a day somehow has both.
      tightAgainstShift: endsBefore.length ? 'off-before' : 'on-after',
    }
  }

  return {
    session,
    overlapHours: Math.round((best.overlap / 60) * 100) / 100,
    whole: best.overlap >= klassLength,
    carriedOver: best.carriedOver,
  }
}

export interface WorkConflictSummary {
  student: AemtStudent
  /** Absent where no line has been recorded — not the same as no conflict. */
  pattern?: AemtWorkPattern
  clashes: SessionClash[]
  /** Class hours the line covers across the whole course. */
  hoursLost: number
  /**
   * Sessions that butt against a shift without overlapping it. Counted apart
   * from hoursLost because they cost no hours and are a different problem.
   */
  tight: SessionClash[]
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
    // `clashes` is the hours question. A session that only butts against a
    // shift belongs in `tight`, not in a list the absence cap is measured from.
    clashes: clashes.filter((c) => c.overlapHours > 0),
    tight: clashes.filter((c) => c.overlapHours === 0),
    hoursLost,
    daysWorkingClass,
    overCap: hoursLost > maxAbsentHours,
  }
}

/** "Tue, Thu" — the days a line works, for a screen that has one line to give it. */
const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const daysLabel = (days: number[]): string =>
  [...days].sort((a, b) => a - b).map((d) => DAY_LABEL[d]).join(', ')

/** "KC105 · 1000–2000 (10 h) · Tue, Wed, Thu, Fri". */
export function patternLabel(p: AemtWorkPattern): string {
  const same = daysLabel(p.weekOne) === daysLabel(p.weekTwo)
  const days = same
    ? daysLabel(p.weekOne)
    : `wk1 ${daysLabel(p.weekOne)} / wk2 ${daysLabel(p.weekTwo)}`
  return [
    p.line,
    `${p.startTime}–${p.endTime} (${shiftHours(p)} h)`,
    days,
    p.shiftType ? `type ${p.shiftType}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
