import { setState, useSelector } from '../../lib/store'
import { uid } from '../../lib/id'
import { addDays, todayISO, fromISODate, monthKey } from '../../lib/date'
import {
  ACADEMY_LENGTH_DAYS,
  DEFAULT_CONTACT_TARGET,
  curriculumFor,
  phaseOf,
  RELEASE_MIN_CONTACTS,
} from '../../data/academy'
import type { AcademyCohort, Credential, OperationId, Trainee } from '../../types'

// ----- cohorts ---------------------------------------------------------------

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function defaultCohortLabel(startDate: string): string {
  const d = fromISODate(startDate)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()} Academy`
}

export interface CohortInput {
  label?: string
  startDate: string
  endDate?: string
  notes?: string
}

export function addCohort(input: CohortInput): AcademyCohort {
  const now = new Date().toISOString()
  const cohort: AcademyCohort = {
    id: uid('cohort'),
    label: input.label?.trim() || defaultCohortLabel(input.startDate),
    startDate: input.startDate,
    endDate: input.endDate || addDays(input.startDate, ACADEMY_LENGTH_DAYS),
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }
  setState((db) => ({ ...db, academyCohorts: [...db.academyCohorts, cohort] }))
  return cohort
}

export function updateCohort(id: string, patch: Partial<AcademyCohort>): void {
  setState((db) => ({
    ...db,
    academyCohorts: db.academyCohorts.map((c) =>
      c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
    ),
  }))
}

export function deleteCohort(id: string): void {
  setState((db) => ({
    ...db,
    academyCohorts: db.academyCohorts.filter((c) => c.id !== id),
    trainees: db.trainees.filter((t) => t.cohortId !== id),
  }))
}

// ----- trainees ---------------------------------------------------------------

export interface TraineeInput {
  name: string
  operation: OperationId
  credential: Credential
  contactTarget?: number
}

export function addTrainee(cohortId: string, input: TraineeInput): Trainee {
  const trainee: Trainee = {
    id: uid('trainee'),
    cohortId,
    name: input.name.trim(),
    operation: input.operation,
    credential: input.credential,
    checklist: {},
    contacts: 0,
    contactTarget: input.contactTarget ?? DEFAULT_CONTACT_TARGET,
  }
  setState((db) => ({ ...db, trainees: [...db.trainees, trainee] }))
  return trainee
}

export function updateTrainee(id: string, patch: Partial<Trainee>): void {
  setState((db) => ({
    ...db,
    trainees: db.trainees.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }))
}

export function deleteTrainee(id: string): void {
  setState((db) => ({ ...db, trainees: db.trainees.filter((t) => t.id !== id) }))
}

/** Toggle a checklist module; stores the completion date when checking. */
export function toggleModule(traineeId: string, moduleId: string): void {
  setState((db) => ({
    ...db,
    trainees: db.trainees.map((t) => {
      if (t.id !== traineeId) return t
      const checklist = { ...t.checklist }
      if (checklist[moduleId]) delete checklist[moduleId]
      else checklist[moduleId] = todayISO()
      return { ...t, checklist }
    }),
  }))
}

export function addContacts(traineeId: string, n: number): void {
  setState((db) => ({
    ...db,
    trainees: db.trainees.map((t) =>
      t.id === traineeId ? { ...t, contacts: Math.max(0, t.contacts + n) } : t,
    ),
  }))
}

export function setContacts(traineeId: string, n: number): void {
  setState((db) => ({
    ...db,
    trainees: db.trainees.map((t) =>
      t.id === traineeId ? { ...t, contacts: Math.max(0, Math.round(n)) } : t,
    ),
  }))
}

export function releaseTrainee(traineeId: string): void {
  updateTrainee(traineeId, { releasedDate: todayISO() })
}

export function unreleaseTrainee(traineeId: string): void {
  setState((db) => ({
    ...db,
    trainees: db.trainees.map((t) => {
      if (t.id !== traineeId) return t
      const { releasedDate: _drop, ...rest } = t
      return rest as Trainee
    }),
  }))
}

/** Eligible for release: FTO phase and at/over the minimum contact count. */
export function releaseEligible(t: Trainee): boolean {
  return phaseOf(t) === 'fto' && t.contacts >= RELEASE_MIN_CONTACTS
}

// ----- selectors ---------------------------------------------------------------

export function useCohorts(): AcademyCohort[] {
  return useSelector((db) => db.academyCohorts)
}

export function useCohort(id: string | undefined): AcademyCohort | undefined {
  return useSelector((db) => db.academyCohorts.find((c) => c.id === id))
}

export function useCohortTrainees(cohortId: string | undefined): Trainee[] {
  return useSelector((db) => db.trainees.filter((t) => t.cohortId === cohortId))
}

export function useAllTrainees(): Trainee[] {
  return useSelector((db) => db.trainees)
}

export interface CohortProgress {
  trainees: number
  released: number
  inFto: number
  inAcademy: number
  /** Average completion of each trainee's own checklist, 0-100. */
  checklistPct: number
}

export function cohortProgress(trainees: Trainee[]): CohortProgress {
  let released = 0
  let inFto = 0
  let inAcademy = 0
  let pctSum = 0
  for (const t of trainees) {
    const phase = phaseOf(t)
    if (phase === 'released') released++
    else if (phase === 'fto') inFto++
    else inAcademy++
    const modules = curriculumFor(t.operation, t.credential)
    const done = modules.filter((m) => !!t.checklist[m.id]).length
    pctSum += modules.length ? done / modules.length : 0
  }
  return {
    trainees: trainees.length,
    released,
    inFto,
    inAcademy,
    checklistPct: trainees.length ? Math.round((pctSum / trainees.length) * 100) : 0,
  }
}

/** Cohorts whose academy dates are current or upcoming, soonest first. */
export function upcomingCohorts(cohorts: AcademyCohort[]): AcademyCohort[] {
  const today = todayISO()
  return cohorts
    .filter((c) => c.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

/** Sort helper: newest cohorts first for the archive list. */
export function byStartDesc(a: AcademyCohort, b: AcademyCohort): number {
  return b.startDate.localeCompare(a.startDate)
}

export function cohortMonth(c: AcademyCohort): string {
  return monthKey(c.startDate)
}
