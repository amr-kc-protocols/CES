// ---------------------------------------------------------------------------
// FTO shift schedule — transcribed from the KC Metro Operations workbook
// (KC_Metro_Operatoins.xlsx): the 'List' tab marks who is an FTO; the
// 'Master Schedule 8_2025' tab lays out each crew's two-week rotating
// pattern (unit, level, start/end, worked days per week).
//
// Only crew lines with at least one FTO aboard are transcribed — this data
// exists to plan new-hire ride-alongs. The 14-day pattern repeats from
// FTO_ROTATION_ANCHOR (a Week-1 Sunday); any calendar date maps into it.
// ---------------------------------------------------------------------------

import { fromISODate } from '../lib/date'
import type { Market } from '../lib/market'
import type { FtoCrew, NeopFtos } from '../types'

/** Week 1 Sunday the rotation is anchored to. */
export const FTO_ROTATION_ANCHOR = '2026-07-19'

export type { CrewMember, FtoCrew } from '../types'

export const KC_FTO_CREWS: FtoCrew[] = [
  {
    unit: 'KC102',
    level: 'ALS',
    start: '0700',
    end: '1900',
    hours: 12,
    crew: [
      { name: 'Kenny Denk', fto: true },
      { name: 'Noah Lavy', fto: false },
    ],
    week1: [1, 2, 5, 6],
    week2: [0, 3, 4],
  },
  {
    unit: 'KC104',
    level: 'ALS',
    start: '0800',
    end: '2000',
    hours: 12,
    crew: [
      { name: 'Emily Beery', fto: false },
      { name: 'Joshua Hayden', fto: true },
    ],
    week1: [3, 4, 5],
    week2: [3, 4, 5],
  },
  {
    unit: 'KC105',
    level: 'ALS',
    start: '1000',
    end: '2000',
    hours: 10,
    crew: [
      { name: 'Eric Fournier', fto: true },
      { name: 'Miranda Burgoon', fto: true },
    ],
    week1: [2, 3, 4, 5],
    week2: [2, 3, 4, 5],
  },
  // KC202 (Lanie McMullin) removed — she transferred out; Levi Wisecarver is
  // not an FTO, so the line no longer belongs on a ride-along planner.
  {
    unit: 'AD101',
    level: 'Dedicated (Advent)',
    start: '0600',
    end: '1800',
    hours: 12,
    crew: [
      // Workbook List tab says 'Bardwell, Michael J - FTO'; the master
      // schedule line reads 'Bardwell, Jason'. Carrying the scheduled name.
      { name: 'Jason Bardwell', fto: true },
      { name: 'Jessica Sexton', fto: true },
    ],
    week1: [3, 4, 5],
    week2: [3, 4, 5],
  },
  {
    unit: 'CC101',
    level: 'ALS (Cass 24h)',
    start: '0700',
    end: '0700',
    hours: 24,
    crew: [
      { name: 'Frank Alba', fto: true },
      { name: 'Daniel Force', fto: false },
    ],
    // 48h on / 96h off — two back-to-back 24h shifts (0700–0700), then four
    // days off, a 6-day cycle. On-block anchored to Saturday 2026-07-11
    // (Jul 11-12, 17-18, 23-24, …). A 6-day cycle never fits a two-week
    // weekday grid, so this line uses `cycle` like Linn's 48h car.
    cycle: { anchor: '2026-07-11', onDays: 2, cycleDays: 6 },
  },
  {
    unit: 'LC-Medic',
    level: 'Linn County (48h)',
    start: '0800',
    end: '0800',
    hours: 48,
    crew: [{ name: 'Joe Stellwagon', fto: true }],
    // 48h on / 96h off — 2 calendar days on, then 4 off, a 6-day cycle.
    // First shift began Tuesday 2026-07-14 at 0800.
    cycle: { anchor: '2026-07-14', onDays: 2, cycleDays: 6 },
  },
  {
    unit: 'LC-Sup',
    level: 'Linn County (48h) · Supervisor',
    start: '0800',
    end: '0800',
    hours: 48,
    crew: [{ name: 'Virgel Swanson', fto: true }],
    // Supervisor who also FTOs. Same 48h-on / 96h-off cycle as the Linn
    // medic car, offset: his rotation starts Wednesday 2026-07-22.
    cycle: { anchor: '2026-07-22', onDays: 2, cycleDays: 6 },
  },
]

/** FTOs on the List tab with no recurring line in the master schedule. */
const KC_FTOS_WITHOUT_LINE: string[] = ['David Richardson']

/**
 * Clinical educators / staff who assess skill sheets and daily evals but don't
 * run a ride line — they appear in the evaluator dropdowns and facilitator
 * chips, but not in the ride planner or its "schedule rides directly" banner.
 */
const KC_ADDITIONAL_EVALUATORS: string[] = ['Jordan Jones']

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Which week of the rotation (1 or 2) a date falls in, against the given
 * Week-1 anchor (default: the master schedule's). Works for dates before
 * the anchor too — the pattern extends in both directions.
 */
export function rotationWeek(iso: string, anchor: string = FTO_ROTATION_ANCHOR): 1 | 2 {
  const days = Math.round(
    (fromISODate(iso).getTime() - fromISODate(anchor).getTime()) / MS_PER_DAY,
  )
  const week = Math.floor(days / 7) % 2
  return (week + 2) % 2 === 0 ? 1 : 2
}

/** Whether one crew line is on shift on a date (honors per-crew anchors). */
export function crewOnDate(c: FtoCrew, iso: string, anchor: string = FTO_ROTATION_ANCHOR): boolean {
  if (c.cycle) {
    const days = Math.round(
      (fromISODate(iso).getTime() - fromISODate(c.cycle.anchor).getTime()) / MS_PER_DAY,
    )
    const phase = ((days % c.cycle.cycleDays) + c.cycle.cycleDays) % c.cycle.cycleDays
    return phase < c.cycle.onDays
  }
  const dow = fromISODate(iso).getDay()
  const week = rotationWeek(iso, c.anchor ?? anchor)
  return (week === 1 ? c.week1 ?? [] : c.week2 ?? []).includes(dow)
}

/** Crew lines (with an FTO aboard) on shift on a given date. */
export function crewsOnDate(ftos: NeopFtos, iso: string): FtoCrew[] {
  return ftos.crews.filter((c) => crewOnDate(c, iso, ftos.anchor))
}

/** '0700' -> '0700–1900', with a '(+Nd)' tail for shifts spanning midnight. */
export function shiftWindow(c: FtoCrew): string {
  const overnight = c.end <= c.start
  // A 24h shift ends +1d, a 48h shift +2d, etc.
  const dayspan = overnight ? Math.max(1, Math.round(c.hours / 24)) : 0
  return `${c.start}–${c.end}${dayspan ? ` (+${dayspan}d)` : ''}`
}

/** Every name selectable as an evaluator/facilitator, scheduled lines first. */
export function allFtos(ftos: NeopFtos): string[] {
  const fromCrews = ftos.crews.flatMap((c) => c.crew.filter((m) => m.fto).map((m) => m.name))
  return [...new Set([...fromCrews, ...ftos.names, ...ftos.evaluators])].filter(Boolean)
}

/** FTOs with no recurring line, whose rides have to be booked with them directly. */
export function ftosWithoutLine(ftos: NeopFtos): string[] {
  const onLines = new Set(ftos.crews.flatMap((c) => c.crew.filter((m) => m.fto).map((m) => m.name)))
  return ftos.names.filter((n) => n && !onLines.has(n))
}

/* ---------------------------------------------------------------------------
 * What shipped with the app, per operation.
 *
 * Everything above is the Kansas City Metro operation, transcribed from its
 * workbook. It is now the STARTING POINT for Kansas City's NEOP rather than
 * the only possible answer: an operation's FTOs and shifts live in its own
 * NEOP (settings.neop.ftos), which it edits in the app. These lists are what
 * Kansas City and Wichita see until they save one.
 *
 * That also closes the hole the old comment here described. This file was
 * compiled into the bundle, so the market fence never reached it, and a
 * Wichita admin ended up looking at KC104. An operation's own roster is stored
 * in `records` now, behind the fence, where Wichita cannot read Kansas City's.
 *
 * Wichita's FTOs are listed without lines on purpose: their recurring shifts
 * were never transcribed, and a wrong line would be read as fact. Certification
 * level, for whoever enters Wichita's shifts:
 *   Alex Thomas — paramedic      Alex White — EMT
 *   Sarah Lamm — paramedic       Nathan Huyett — AEMT
 *   Jordan Riddall — AEMT
 * ------------------------------------------------------------------------ */

const WICHITA_FTO_NAMES: string[] = [
  'Alex Thomas',
  'Alex White',
  'Sarah Lamm',
  'Nathan Huyett',
  'Jordan Riddall',
]

export const BUNDLED_FTOS: Partial<Record<Market, NeopFtos>> = {
  kc: {
    names: [
      ...new Set([
        ...KC_FTO_CREWS.flatMap((c) => c.crew.filter((m) => m.fto).map((m) => m.name)),
        ...KC_FTOS_WITHOUT_LINE,
      ]),
    ],
    evaluators: KC_ADDITIONAL_EVALUATORS,
    crews: KC_FTO_CREWS,
    anchor: FTO_ROTATION_ANCHOR,
  },
  wichita: {
    names: WICHITA_FTO_NAMES,
    evaluators: [],
    crews: [],
    anchor: FTO_ROTATION_ANCHOR,
  },
}
