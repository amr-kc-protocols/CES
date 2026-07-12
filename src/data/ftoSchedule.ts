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

/** Week 1 Sunday the rotation is anchored to. */
export const FTO_ROTATION_ANCHOR = '2026-07-19'

export interface CrewMember {
  name: string
  /** Marked '- FTO' on the workbook's List tab. */
  fto: boolean
}

export interface FtoCrew {
  /** Unit call sign, e.g. 'KC105'. */
  unit: string
  /** Level of service for the line (ALS / BLS / Dedicated). */
  level: string
  /** Wall-clock start, HHMM. */
  start: string
  /** Wall-clock end, HHMM. Ends at or before start = runs into the next day. */
  end: string
  /** Shift length in hours (from the schedule cells). */
  hours: number
  crew: CrewMember[]
  /** Worked days, 0=Sun … 6=Sat, for each week of the rotation. */
  week1: number[]
  week2: number[]
  /**
   * First day of this crew's Week 1, when it differs from the master
   * schedule's FTO_ROTATION_ANCHOR (a crew whose two-week cycle is offset
   * from everyone else's).
   */
  anchor?: string
}

export const FTO_CREWS: FtoCrew[] = [
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
    week1: [2, 3],
    week2: [1, 2],
    // Frank's cycle runs a week ahead of the master schedule: his Week 1
    // began Saturday 2026-07-11, not the global 2026-07-19 anchor.
    anchor: '2026-07-11',
  },
]

/** FTOs on the List tab with no recurring line in the master schedule. */
export const FTOS_WITHOUT_LINE: string[] = ['David Richardson']

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
export function crewOnDate(c: FtoCrew, iso: string): boolean {
  const dow = fromISODate(iso).getDay()
  const week = rotationWeek(iso, c.anchor)
  return (week === 1 ? c.week1 : c.week2).includes(dow)
}

/** Crew lines (with an FTO aboard) on shift on a given date. */
export function crewsOnDate(iso: string): FtoCrew[] {
  return FTO_CREWS.filter((c) => crewOnDate(c, iso))
}

/** '0700' -> '0700–1900 (+1d when overnight)' display string. */
export function shiftWindow(c: FtoCrew): string {
  const overnight = c.end <= c.start
  return `${c.start}–${c.end}${overnight ? ' (+1d)' : ''}`
}

/** Every FTO name, scheduled lines first. */
export function allFtos(): string[] {
  const fromCrews = FTO_CREWS.flatMap((c) => c.crew.filter((m) => m.fto).map((m) => m.name))
  return [...new Set([...fromCrews, ...FTOS_WITHOUT_LINE])]
}
