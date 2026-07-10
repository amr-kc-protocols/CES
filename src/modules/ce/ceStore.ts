import { getState, setState, useSelector } from '../../lib/store'
import { uid } from '../../lib/id'
import { pushUndo } from '../../lib/undo'
import { addDays, daysFromToday, todayISO } from '../../lib/date'
import type { CEClass, CELocation, CEStatus } from '../../types'

/** Regulatory window: KBEMS submissions are due 30 days after the class date. */
export const CE_WINDOW_DAYS = 30

export interface CEClassInput {
  instructor: string
  location: CELocation
  classDate: string
  discipline: string
  notes?: string
}

export function addCEClass(input: CEClassInput): CEClass {
  const now = new Date().toISOString()
  const cls: CEClass = {
    id: uid('ce'),
    instructor: input.instructor.trim(),
    location: input.location,
    classDate: input.classDate,
    discipline: input.discipline.trim(),
    notes: input.notes?.trim() || undefined,
    status: 'not_started',
    createdAt: now,
    updatedAt: now,
  }
  setState((db) => ({ ...db, ceClasses: [...db.ceClasses, cls] }))
  return cls
}

export function updateCEClass(id: string, patch: Partial<CEClass>): void {
  setState((db) => ({
    ...db,
    ceClasses: db.ceClasses.map((c) =>
      c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
    ),
  }))
}

export function setCEStatus(id: string, status: CEStatus): void {
  const patch: Partial<CEClass> = { status }
  // Record/clear the actual submission date as status changes.
  patch.submittedDate = status === 'submitted' ? todayISO() : undefined
  updateCEClass(id, patch)
}

export function deleteCEClass(id: string): void {
  const cls = getState().ceClasses.find((c) => c.id === id)
  setState((db) => ({ ...db, ceClasses: db.ceClasses.filter((c) => c.id !== id) }))
  if (cls) {
    pushUndo(`Deleted ${cls.discipline || 'class'} — ${cls.instructor}`, () =>
      setState((db) => ({ ...db, ceClasses: [...db.ceClasses, cls] })),
    )
  }
}

// ----- derived helpers -----------------------------------------------------

export function dueDate(cls: CEClass): string {
  return addDays(cls.classDate, CE_WINDOW_DAYS)
}

export function daysRemaining(cls: CEClass): number {
  return daysFromToday(dueDate(cls))
}

export type Urgency = 'submitted' | 'overdue' | 'critical' | 'warning' | 'ok'

/** Color-coded urgency per spec §6 Module B. */
export function urgencyOf(cls: CEClass): Urgency {
  if (cls.status === 'submitted') return 'submitted'
  const days = daysRemaining(cls)
  if (days < 0) return 'overdue'
  if (days < 7) return 'critical'
  if (days <= 14) return 'warning'
  return 'ok'
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  submitted: 'Submitted',
  overdue: 'Overdue',
  critical: 'Due soon',
  warning: 'Approaching',
  ok: 'On track',
}

/**
 * Sort key: overdue & unsubmitted first (most overdue first), then by soonest
 * due date; submitted items sink to the bottom. Guarantees nothing outstanding
 * hides below completed work (spec §6 "never allowed to silently disappear").
 */
export function sortByUrgency(a: CEClass, b: CEClass): number {
  const aDone = a.status === 'submitted'
  const bDone = b.status === 'submitted'
  if (aDone !== bDone) return aDone ? 1 : -1
  return daysRemaining(a) - daysRemaining(b)
}

// ----- hooks ---------------------------------------------------------------

export function useCEClasses(): CEClass[] {
  return useSelector((db) => db.ceClasses)
}

export interface CESummary {
  total: number
  outstanding: number
  overdue: number
  dueThisWeek: number
  submitted: number
}

export function useCESummary(): CESummary {
  return useSelector((db) => {
    let outstanding = 0
    let overdue = 0
    let dueThisWeek = 0
    let submitted = 0
    for (const c of db.ceClasses) {
      if (c.status === 'submitted') {
        submitted++
        continue
      }
      outstanding++
      const u = urgencyOf(c)
      if (u === 'overdue') overdue++
      else if (u === 'critical') dueThisWeek++
    }
    return { total: db.ceClasses.length, outstanding, overdue, dueThisWeek, submitted }
  })
}
