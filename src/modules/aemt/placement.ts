// ---------------------------------------------------------------------------
// Placement logic.
//
// A hundred and eight placements — six students, eighteen 12-hour shifts each —
// across two markets with per-department capacity caps, and no Fisdap scheduler
// to do it. Everything here is pure — the board reads it, the store writes
// through it, and the tests drive it directly.
//
// Two ideas worth holding onto while reading:
//
// A placement is not a shift. A placement is an intention: a student, a date, a
// department, and whether the site has agreed to it. A shift is what happened,
// and it carries a preceptor's signature. Working a placement CREATES a shift
// and links the two, so the board can show planned against worked without one
// silently rewriting the other. Cancel a placement and no evidence moves;
// delete a shift and no plan moves.
//
// Capacity is per unit per week, not per day. That is how the departments
// actually think about it — "we'll take one student a week in pre-op" — and it
// is what makes the schedule hard at one-per-department: four Kansas City
// students against six departments means no two people in pre-op in the same
// week, so the board has to be able to say no.
//
// Campus is a hard boundary, not a preference. The October 2026 cohort is one
// class run jointly by Kansas City and Wichita, and the didactic is shared —
// but a Wichita student cannot work a shift at AdventHealth Shawnee Mission,
// and every capacity number is per campus for the same reason. Placing across
// campuses is refused rather than warned about: it is not a tight fit, it is a
// two-hundred-mile drive against an affiliation agreement that does not name
// the student.
//
// On storage: placements and preceptors are deliberately NOT in lib/records.ts,
// so they stay on the device. A placement is a plan and a preceptor roster is a
// contact list; neither is a K.A.R. 109-17-3 course record. The regulated
// artifact is the shift, which already syncs. If the instructor ends up
// scheduling from two devices this needs revisiting — it is a decision, not an
// oversight.
// ---------------------------------------------------------------------------

import { fromISODate, toISODate } from '../../lib/date'
import { siteCampus } from '../../data/aemtSites'
import { worksOn } from './workPattern'
import { CAMPUS_LABEL } from '../../data/aemt'
import type { Market } from '../../lib/market'
import type {
  AemtClinicalPhase,
  AemtPlacement,
  AemtSite,
  AemtSiteUnit,
  AemtStudent,
} from '../../types'

/** Statuses that occupy a slot. A cancelled placement frees its capacity. */
export const LIVE_STATUSES = ['open', 'assigned', 'confirmed', 'worked'] as const

/** Statuses where a student is actually committed to being somewhere. */
export const COMMITTED_STATUSES = ['assigned', 'confirmed', 'worked'] as const

/**
 * The Monday of the week a date falls in, as an ISO date.
 *
 * Monday rather than Sunday because a hospital week and a class week both run
 * that way here, and a cap of "one a week" is meaningless if two schedulers
 * disagree about where the week starts.
 */
export function weekStart(iso: string): string {
  const d = fromISODate(iso)
  // getDay(): 0 = Sunday. Shift so Monday is 0.
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return toISODate(d)
}

/** Every Monday from `from` to `to` inclusive of the weeks they fall in. */
export function weeksBetween(from: string, to: string): string[] {
  const out: string[] = []
  let cur = weekStart(from)
  const last = weekStart(to)
  // Guard rather than trust: a reversed range should produce nothing, not spin.
  let guard = 0
  while (cur <= last && guard++ < 520) {
    out.push(cur)
    const d = fromISODate(cur)
    d.setDate(d.getDate() + 7)
    cur = toISODate(d)
  }
  return out
}

/**
 * The campus a student rotates through.
 *
 * Absent means Kansas City. Every student enrolled before the two builds were
 * merged was one, and defaulting the other way would strand them.
 */
export function studentCampus(student: { campus?: Market }): Market {
  return student.campus ?? 'kc'
}

const live = (p: AemtPlacement) =>
  (LIVE_STATUSES as readonly string[]).includes(p.status)
const committed = (p: AemtPlacement) =>
  (COMMITTED_STATUSES as readonly string[]).includes(p.status)

/** How many slots in a unit are taken in the week containing `date`. */
export function unitLoad(
  placements: AemtPlacement[],
  unitId: string,
  date: string,
  ignoreId?: string,
): number {
  const week = weekStart(date)
  return placements.filter(
    (p) =>
      p.id !== ignoreId &&
      p.unitId === unitId &&
      live(p) &&
      weekStart(p.date) === week,
  ).length
}

export interface PlacementIssue {
  field: string
  message: string
  /** A cap breach is refusable; a phase note is worth saying and not refusing. */
  severity: 'block' | 'note'
}

export interface PlacementInput {
  studentId?: string
  date: string
  siteId: string
  unitId: string
  hours: number
  status: AemtPlacement['status']
}

/**
 * Everything wrong with a proposed placement.
 *
 * Blocks are real conflicts: a department over its cap, or a student in two
 * places at once. Notes are things worth saying that are nobody's error — a
 * placement outside every phase window, or a department that produces nothing
 * the student is short on.
 */
export function placementIssues(
  input: PlacementInput,
  ctx: {
    placements: AemtPlacement[]
    sites: AemtSite[]
    /** The cohort's roster, so a placement can be checked against its student's campus. */
    students?: AemtStudent[]
    phases?: AemtClinicalPhase[]
    /** Editing an existing placement — do not count it against itself. */
    ignoreId?: string
    courseStart?: string
    courseEnd?: string
  },
): PlacementIssue[] {
  const issues: PlacementIssue[] = []
  const site = ctx.sites.find((s) => s.id === input.siteId)
  const unit = site?.units?.find((u) => u.id === input.unitId)

  if (!input.date) {
    issues.push({ field: 'date', message: 'A placement needs a date.', severity: 'block' })
  } else if (
    ctx.courseStart &&
    ctx.courseEnd &&
    (input.date < ctx.courseStart || input.date > ctx.courseEnd)
  ) {
    issues.push({
      field: 'date',
      message: `Outside the course window (${ctx.courseStart} to ${ctx.courseEnd}).`,
      severity: 'block',
    })
  }

  if (!site) {
    issues.push({ field: 'siteId', message: 'Pick a site.', severity: 'block' })
  } else if (site.active === false) {
    issues.push({
      field: 'siteId',
      message: `${site.name} is not in use this cohort. Activate it first if that has changed.`,
      severity: 'block',
    })
  }

  if (!unit) {
    issues.push({ field: 'unitId', message: 'Pick a department.', severity: 'block' })
  } else if (input.date) {
    const load = unitLoad(ctx.placements, unit.id, input.date, ctx.ignoreId)
    if (load >= unit.weeklySlotCap) {
      issues.push({
        field: 'unitId',
        message: `${unit.name} takes ${unit.weeklySlotCap} student${
          unit.weeklySlotCap === 1 ? '' : 's'
        } a week and the week of ${weekStart(input.date)} is full. Another department, or another week.`,
        severity: 'block',
      })
    }
  }

  if (!(input.hours >= 1 && input.hours <= 24)) {
    issues.push({ field: 'hours', message: 'Hours must be between 1 and 24.', severity: 'block' })
  }

  // Right student, right city. An open slot belongs to whichever campus its
  // site does; it is only when someone is put in it that this can be wrong.
  if (input.studentId && site && ctx.students) {
    const student = ctx.students.find((st) => st.id === input.studentId)
    if (student) {
      const theirs = studentCampus(student)
      const sites = siteCampus(site)
      if (theirs !== sites) {
        issues.push({
          field: 'studentId',
          message: `${student.name} is a ${CAMPUS_LABEL[theirs]} student and ${site.name} is a ${CAMPUS_LABEL[sites]} site. Clinical and field placement is local on this cohort — only the didactic is shared.`,
          severity: 'block',
        })
      }
    }
  }

  // Right student, right day. The board books twelve-hour rotations and the
  // students are working EMTs on twelve-hour lines; until the line was
  // recorded there was nothing here to stop it putting one on top of the
  // other. A warning rather than a block — a student can take the day, trade
  // it, or work it off a night shift — but not something to discover when they
  // do not turn up, or turn up having been awake for twenty hours.
  if (input.studentId && input.date && ctx.students) {
    const student = ctx.students.find((st) => st.id === input.studentId)
    const p = student?.workPattern
    if (student && p && worksOn(p, input.date)) {
      issues.push({
        field: 'date',
        message: `${student.name} works ${p.line ? `${p.line} ` : ''}${p.startTime}–${p.endTime} that day. A ${input.hours}-hour rotation on top of that needs the shift traded or taken off first.`,
        severity: 'note',
      })
    }
  }

  // One person, one place. Checked only for a placement someone is actually
  // assigned to — open slots on the same day are the point of a board.
  if (input.studentId && input.date) {
    const clash = ctx.placements.find(
      (p) =>
        p.id !== ctx.ignoreId &&
        p.studentId === input.studentId &&
        p.date === input.date &&
        committed(p),
    )
    if (clash) {
      issues.push({
        field: 'studentId',
        message: 'That student is already placed somewhere else that day.',
        severity: 'block',
      })
    }
  }

  if (ctx.phases && input.date) {
    const phase = ctx.phases.find((p) => input.date >= p.windowStart && input.date <= p.windowEnd)
    if (!phase) {
      issues.push({
        field: 'date',
        message: 'This date falls outside every phase window. It still counts — it just is not part of the plan.',
        severity: 'note',
      })
    } else if (phase.shiftsRequired === 0) {
      issues.push({
        field: 'date',
        message: `${phase.name} is a no-clinical phase. Placing a shift here is allowed but is ahead of the plan.`,
        severity: 'note',
      })
    }
  }

  return issues
}

export const blocking = (issues: PlacementIssue[]) => issues.filter((i) => i.severity === 'block')

// ----- coverage: does the plan fit in the capacity that exists? --------------

export interface WeekCapacity {
  week: string
  /** Slots that exist across every active unit this week. */
  capacity: number
  /** Slots taken. */
  used: number
}

/**
 * Slot supply and demand week by week.
 *
 * This is the number that has to be looked at in October rather than December:
 * a phase whose demand exceeds the slots that physically exist is a site
 * capacity problem with a long lead time and no late fix.
 */
export function weeklyCapacity(
  sites: AemtSite[],
  placements: AemtPlacement[],
  from: string,
  to: string,
  kind?: 'clinical' | 'field',
  /** Restrict to one campus. Omit to count the whole cohort's supply. */
  campus?: Market,
): WeekCapacity[] {
  const units: AemtSiteUnit[] = sites
    .filter(
      (s) =>
        s.active !== false &&
        (!kind || s.kind === kind) &&
        (!campus || siteCampus(s) === campus),
    )
    .flatMap((s) => s.units ?? [])
  const unitIds = new Set(units.map((u) => u.id))
  const capacity = units.reduce((n, u) => n + u.weeklySlotCap, 0)
  return weeksBetween(from, to).map((week) => ({
    week,
    capacity,
    used: placements.filter(
      (p) => live(p) && unitIds.has(p.unitId) && weekStart(p.date) === week,
    ).length,
  }))
}

export interface PhaseCoverage {
  phase: AemtClinicalPhase
  /** Shifts the phase asks for, across every student. */
  demand: number
  /** Slots that physically exist in the window. */
  supply: number
  /** Placements already made in the window. */
  placed: number
  /** Supply short of demand — a capacity problem, not a student problem. */
  shortfall: number
}

/**
 * What each phase needs against what the sites can physically take.
 *
 * Hospital and field are counted separately because they are not
 * interchangeable: a field shift at Linn County does not relieve a full pre-op.
 *
 * CALL THIS PER CAMPUS on a joint cohort. Six students against the two markets'
 * sites pooled together looks comfortable and is not: Kansas City's four cannot
 * use Wichita's slack and Wichita's two cannot use AdventHealth's. Pooling them
 * hides a shortfall on one side behind headroom on the other, which is the one
 * thing this function exists to prevent.
 */
export function phaseCoverage(
  phases: AemtClinicalPhase[],
  sites: AemtSite[],
  placements: AemtPlacement[],
  studentCount: number,
  kind: 'clinical' | 'field',
  campus?: Market,
): PhaseCoverage[] {
  const relevant = sites.filter(
    (s) => s.active !== false && s.kind === kind && (!campus || siteCampus(s) === campus),
  )
  const unitIds = new Set(relevant.flatMap((s) => (s.units ?? []).map((u) => u.id)))
  const perWeek = relevant
    .flatMap((s) => s.units ?? [])
    .reduce((n, u) => n + u.weeklySlotCap, 0)
  return phases
    .filter((p) => p.shiftsRequired > 0)
    .map((phase) => {
      const weeks = weeksBetween(phase.windowStart, phase.windowEnd).length
      const perStudent = kind === 'clinical' ? phase.hospitalShifts : phase.fieldShifts
      const demand = perStudent * studentCount
      const supply = perWeek * weeks
      const placed = placements.filter(
        (p) =>
          live(p) &&
          unitIds.has(p.unitId) &&
          p.date >= phase.windowStart &&
          p.date <= phase.windowEnd,
      ).length
      return { phase, demand, supply, placed, shortfall: Math.max(0, demand - supply) }
    })
}

/**
 * Placements per student against what the plan expects, for the board's
 * left-hand column. Counts committed placements only — an open slot is not
 * anybody's shift yet.
 */
export function studentLoad(
  students: AemtStudent[],
  placements: AemtPlacement[],
): { student: AemtStudent; assigned: number; worked: number }[] {
  return students.map((student) => {
    const mine = placements.filter((p) => p.studentId === student.id && committed(p))
    return {
      student,
      assigned: mine.length,
      worked: mine.filter((p) => p.status === 'worked').length,
    }
  })
}
