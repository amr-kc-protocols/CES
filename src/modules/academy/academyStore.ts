import { useMemo } from 'react'
import { getState, setState, useSelector } from '../../lib/store'
import { uid } from '../../lib/id'
import { pushUndo } from '../../lib/undo'
import { addDays, formatDate, todayISO, fromISODate, toISODate, monthKey } from '../../lib/date'
import {
  ACADEMY_LENGTH_DAYS,
  DEFAULT_CONTACT_TARGET,
  curriculumFor,
  phaseOf,
  RELEASE_MIN_CONTACTS,
} from '../../data/academy'
import { CLASSROOM_TEMPLATE } from '../../data/academyTemplate'
import { PHASE2_TEMPLATE } from '../../data/academyPhase2'
import type {
  AcademyCohort,
  AcademyDay,
  AcademyDayRef,
  AttendanceRecord,
  AttendanceStatus,
  Credential,
  OperationId,
  ScheduleBlock,
  SessionArrangement,
  Trainee,
} from '../../types'

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
  // Capture everything the cohort owns so the whole thing is restorable.
  const db = getState()
  const cohort = db.academyCohorts.find((c) => c.id === id)
  const trainees = db.trainees.filter((t) => t.cohortId === id)
  const days = db.academyDays.filter((d) => d.cohortId === id)
  const arrangements = db.academyArrangements.filter((a) => a.cohortId === id)
  const attendance = db.academyAttendance.filter((a) => a.cohortId === id)

  setState((db) => ({
    ...db,
    academyCohorts: db.academyCohorts.filter((c) => c.id !== id),
    trainees: db.trainees.filter((t) => t.cohortId !== id),
    academyDays: db.academyDays.filter((d) => d.cohortId !== id),
    academyArrangements: db.academyArrangements.filter((a) => a.cohortId !== id),
    academyAttendance: db.academyAttendance.filter((a) => a.cohortId !== id),
  }))

  if (cohort) {
    pushUndo(`Deleted ${cohort.label}`, () =>
      setState((db) => ({
        ...db,
        academyCohorts: [...db.academyCohorts, cohort],
        trainees: [...db.trainees, ...trainees],
        academyDays: [...db.academyDays, ...days],
        academyArrangements: [...db.academyArrangements, ...arrangements],
        academyAttendance: [...db.academyAttendance, ...attendance],
      })),
    )
  }
}

// ----- trainees ---------------------------------------------------------------

export interface TraineeInput {
  name: string
  operation: OperationId
  credential: Credential
  employeeNumber?: string
  email?: string
  phone?: string
  contactTarget?: number
}

export function addTrainee(cohortId: string, input: TraineeInput): Trainee {
  const clean = (s?: string) => {
    const v = s?.trim()
    return v ? v : undefined
  }
  const trainee: Trainee = {
    id: uid('trainee'),
    cohortId,
    name: input.name.trim(),
    operation: input.operation,
    credential: input.credential,
    employeeNumber: clean(input.employeeNumber),
    email: clean(input.email),
    phone: clean(input.phone),
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
  const state = getState()
  const trainee = state.trainees.find((t) => t.id === id)
  const attendance = state.academyAttendance.filter((a) => a.traineeId === id)
  setState((db) => ({
    ...db,
    trainees: db.trainees.filter((t) => t.id !== id),
    academyAttendance: db.academyAttendance.filter((a) => a.traineeId !== id),
  }))
  if (trainee) {
    pushUndo(`Removed ${trainee.name}`, () =>
      setState((db) => ({
        ...db,
        trainees: [...db.trainees, trainee],
        academyAttendance: [...db.academyAttendance, ...attendance],
      })),
    )
  }
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

// ----- schedule builder --------------------------------------------------------

export function useCohortDays(cohortId: string | undefined): AcademyDay[] {
  return useSelector((db) =>
    db.academyDays
      .filter((d) => d.cohortId === cohortId)
      .sort((a, b) => a.date.localeCompare(b.date)),
  )
}

export function addDay(cohortId: string, date: string, title = ''): AcademyDay {
  const day: AcademyDay = { id: uid('day'), cohortId, date, title, blocks: [] }
  setState((db) => ({ ...db, academyDays: [...db.academyDays, day] }))
  return day
}

export function updateDay(id: string, patch: Partial<AcademyDay>): void {
  setState((db) => ({
    ...db,
    academyDays: db.academyDays.map((d) => (d.id === id ? { ...d, ...patch } : d)),
  }))
}

export function deleteDay(id: string): void {
  const state = getState()
  const day = state.academyDays.find((d) => d.id === id)
  const attendance = state.academyAttendance.filter((a) => a.dayKey === `p1:${id}`)
  setState((db) => ({
    ...db,
    academyDays: db.academyDays.filter((d) => d.id !== id),
    academyAttendance: db.academyAttendance.filter((a) => a.dayKey !== `p1:${id}`),
  }))
  if (day) {
    // Days render sorted by date, so re-appending restores its position.
    pushUndo(`Deleted ${formatDate(day.date)}${day.title ? ` — ${day.title}` : ''}`, () =>
      setState((db) => ({
        ...db,
        academyDays: [...db.academyDays, day],
        academyAttendance: [...db.academyAttendance, ...attendance],
      })),
    )
  }
}

export function addBlock(dayId: string, block: Omit<ScheduleBlock, 'id'>): void {
  setState((db) => ({
    ...db,
    academyDays: db.academyDays.map((d) =>
      d.id === dayId ? { ...d, blocks: [...d.blocks, { ...block, id: uid('blk') }] } : d,
    ),
  }))
}

export function updateBlock(dayId: string, blockId: string, patch: Partial<ScheduleBlock>): void {
  setState((db) => ({
    ...db,
    academyDays: db.academyDays.map((d) =>
      d.id === dayId
        ? { ...d, blocks: d.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) }
        : d,
    ),
  }))
}

export function deleteBlock(dayId: string, blockId: string): void {
  const day = getState().academyDays.find((d) => d.id === dayId)
  const index = day ? day.blocks.findIndex((b) => b.id === blockId) : -1
  const block = index >= 0 ? day!.blocks[index] : undefined

  setState((db) => ({
    ...db,
    academyDays: db.academyDays.map((d) =>
      d.id === dayId ? { ...d, blocks: d.blocks.filter((b) => b.id !== blockId) } : d,
    ),
  }))

  if (block) {
    pushUndo(`Deleted block "${block.title || block.time || 'untitled'}"`, () =>
      setState((db) => ({
        ...db,
        academyDays: db.academyDays.map((d) => {
          if (d.id !== dayId) return d
          const blocks = [...d.blocks]
          blocks.splice(Math.min(index, blocks.length), 0, block)
          return { ...d, blocks }
        }),
      })),
    )
  }
}

/** Move a block up/down within its day. */
export function moveBlock(dayId: string, blockId: string, dir: -1 | 1): void {
  setState((db) => ({
    ...db,
    academyDays: db.academyDays.map((d) => {
      if (d.id !== dayId) return d
      const i = d.blocks.findIndex((b) => b.id === blockId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.blocks.length) return d
      const blocks = [...d.blocks]
      ;[blocks[i], blocks[j]] = [blocks[j], blocks[i]]
      return { ...d, blocks }
    }),
  }))
}

/** Move a block to another day (appended at the end). */
export function moveBlockToDay(fromDayId: string, blockId: string, toDayId: string): void {
  setState((db) => {
    const from = db.academyDays.find((d) => d.id === fromDayId)
    const block = from?.blocks.find((b) => b.id === blockId)
    if (!from || !block || fromDayId === toDayId) return db
    return {
      ...db,
      academyDays: db.academyDays.map((d) => {
        if (d.id === fromDayId) return { ...d, blocks: d.blocks.filter((b) => b.id !== blockId) }
        if (d.id === toDayId) return { ...d, blocks: [...d.blocks, block] }
        return d
      }),
    }
  })
}

/**
 * Copy a day (title, facilitators, location, note, blocks) onto the next
 * weekday after the cohort's last scheduled day.
 */
export function duplicateDay(id: string): AcademyDay | undefined {
  const db = getState()
  const src = db.academyDays.find((d) => d.id === id)
  if (!src) return undefined
  const last = db.academyDays
    .filter((d) => d.cohortId === src.cohortId)
    .reduce((max, d) => (d.date > max ? d.date : max), src.date)
  const copy: AcademyDay = {
    ...src,
    id: uid('day'),
    date: nextWeekdays(addDays(last, 1), 1)[0],
    blocks: src.blocks.map((b) => ({ ...b, id: uid('blk') })),
  }
  setState((db) => ({ ...db, academyDays: [...db.academyDays, copy] }))
  return copy
}

function shiftDaysRaw(cohortId: string, deltaDays: number): void {
  setState((db) => ({
    ...db,
    academyDays: db.academyDays.map((d) =>
      d.cohortId === cohortId ? { ...d, date: addDays(d.date, deltaDays) } : d,
    ),
  }))
}

/**
 * Shift every scheduled day of a cohort by the same number of days,
 * preserving the spacing between days (e.g. when the academy start moves).
 */
export function shiftCohortDays(cohortId: string, deltaDays: number): void {
  if (!deltaDays) return
  shiftDaysRaw(cohortId, deltaDays)
  const dir = deltaDays > 0 ? 'later' : 'earlier'
  // Undo calls the raw shift so it doesn't itself register another undo.
  pushUndo(`Schedule shifted ${Math.abs(deltaDays)} day${Math.abs(deltaDays) === 1 ? '' : 's'} ${dir}`, () =>
    shiftDaysRaw(cohortId, -deltaDays),
  )
}

/** Next N weekdays (Mon-Fri) starting from `startISO` inclusive. */
export function nextWeekdays(startISO: string, count: number): string[] {
  const out: string[] = []
  let d = fromISODate(startISO)
  while (out.length < count) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) out.push(toISODate(d))
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  }
  return out
}

/**
 * Seed a cohort's schedule from the 5-day classroom template, mapped onto
 * consecutive weekdays starting at the cohort start date. No-op days already
 * scheduled are preserved; the template only adds.
 */
export function applyClassroomTemplate(cohortId: string, startISO: string): number {
  const dates = nextWeekdays(startISO, CLASSROOM_TEMPLATE.length)
  const days: AcademyDay[] = CLASSROOM_TEMPLATE.map((t, i) => ({
    id: uid('day'),
    cohortId,
    date: dates[i],
    title: t.title,
    facilitators: t.facilitators,
    location: t.location,
    note: t.note,
    blocks: t.blocks.map((b) => ({ ...b, id: uid('blk') })),
  }))
  setState((db) => ({ ...db, academyDays: [...db.academyDays, ...days] }))
  return days.length
}

// ----- Phase 2 template arrangements -----------------------------------------
// The template is static (src/data/academyPhase2.ts); only the per-class
// scheduling layer (date, start time, facilitator names per session) is stored.

/** Arrangements for a cohort, keyed by session id. */
export function useArrangements(cohortId: string | undefined): Record<string, SessionArrangement> {
  return useSelector((db) => {
    const map: Record<string, SessionArrangement> = {}
    for (const a of db.academyArrangements) {
      if (a.cohortId === cohortId) map[a.sessionId] = a
    }
    return map
  })
}

/**
 * How Phase 2 sessions map onto dates:
 *   'weekdays' — consecutive Mon–Fri (a single week; the default),
 *   'weekly'   — one session per week (same weekday),
 *   a number   — every N calendar days (e.g. 14 = bi-weekly).
 * The non-'weekdays' cadences let the clinical phase stretch over a longer
 * time frame for hires who can't attend a full week at once.
 */
export type Phase2Cadence = 'weekdays' | 'weekly' | number

export function phase2Dates(startISO: string, count: number, cadence: Phase2Cadence): string[] {
  if (cadence === 'weekdays') return nextWeekdays(startISO, count)
  const step = cadence === 'weekly' ? 7 : Math.max(1, Math.floor(cadence))
  return Array.from({ length: count }, (_, i) => addDays(startISO, i * step))
}

export function fillPhase2Dates(
  cohortId: string,
  startISO: string,
  cadence: Phase2Cadence = 'weekdays',
): void {
  const sessions = [...PHASE2_TEMPLATE.sessions].sort((a, b) => a.order - b.order)
  const dates = phase2Dates(startISO, sessions.length, cadence)
  const prev = getState().academyArrangements.filter((a) => a.cohortId === cohortId)

  setState((db) => {
    const mine = new Map(prev.map((a) => [a.sessionId, a]))
    return {
      ...db,
      academyArrangements: [
        ...db.academyArrangements.filter((a) => a.cohortId !== cohortId),
        ...sessions.map((s, i) => ({
          ...(mine.get(s.id) ?? { cohortId, sessionId: s.id }),
          date: dates[i],
        })),
      ],
    }
  })

  pushUndo('Phase 2 session dates filled', () =>
    setState((db) => ({
      ...db,
      academyArrangements: [
        ...db.academyArrangements.filter((a) => a.cohortId !== cohortId),
        ...prev,
      ],
    })),
  )
}

export function setArrangement(
  cohortId: string,
  sessionId: string,
  patch: Partial<Omit<SessionArrangement, 'cohortId' | 'sessionId'>>,
): void {
  setState((db) => {
    const idx = db.academyArrangements.findIndex(
      (a) => a.cohortId === cohortId && a.sessionId === sessionId,
    )
    if (idx === -1) {
      return {
        ...db,
        academyArrangements: [...db.academyArrangements, { cohortId, sessionId, ...patch }],
      }
    }
    return {
      ...db,
      academyArrangements: db.academyArrangements.map((a, i) =>
        i === idx ? { ...a, ...patch } : a,
      ),
    }
  })
}

// ----- unified academy day list (both phases) --------------------------------

/**
 * Every scheduled academy day for a cohort, across both phases, in date order.
 * Phase 1 pulls from the free-form schedule; Phase 2 from dated in-person
 * sessions. Undated Phase 2 sessions sort to the end.
 *
 * Derived with useMemo from the (referentially stable) day + arrangement
 * selectors — building fresh objects inside a single useSelector would defeat
 * its snapshot cache and loop.
 */
export function useAcademyDays(cohortId: string | undefined): AcademyDayRef[] {
  const days = useCohortDays(cohortId)
  const arrangements = useArrangements(cohortId)
  return useMemo(() => {
    const p1: AcademyDayRef[] = days.map((d) => ({
      key: `p1:${d.id}`,
      phase: 1,
      date: d.date,
      title: d.title || 'Academy day',
    }))
    const p2: AcademyDayRef[] = PHASE2_TEMPLATE.sessions
      .filter((s) => s.mode === 'in-person')
      .map((s) => ({
        key: `p2:${s.id}`,
        phase: 2 as const,
        date: arrangements[s.id]?.date ?? '',
        title: `S${s.order} · ${s.title}`,
      }))
    return [...p1, ...p2].sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date.localeCompare(b.date)
    })
  }, [days, arrangements])
}

// ----- attendance ------------------------------------------------------------

export function useAttendance(cohortId: string | undefined): AttendanceRecord[] {
  return useSelector((db) => db.academyAttendance.filter((a) => a.cohortId === cohortId))
}

/** Attendance lookup key. */
export function attKey(traineeId: string, dayKey: string): string {
  return `${traineeId}|${dayKey}`
}

/** Build a fast lookup: `${traineeId}|${dayKey}` -> status. */
export function attendanceMap(records: AttendanceRecord[]): Map<string, AttendanceStatus> {
  const m = new Map<string, AttendanceStatus>()
  for (const r of records) m.set(attKey(r.traineeId, r.dayKey), r.status)
  return m
}

/** Set (or clear, when status is null) one trainee's attendance for one day. */
export function setAttendance(
  cohortId: string,
  traineeId: string,
  dayKey: string,
  status: AttendanceStatus | null,
): void {
  setState((db) => {
    const rest = db.academyAttendance.filter(
      (a) => !(a.cohortId === cohortId && a.traineeId === traineeId && a.dayKey === dayKey),
    )
    return {
      ...db,
      academyAttendance: status ? [...rest, { cohortId, traineeId, dayKey, status }] : rest,
    }
  })
}

/** Mark every trainee present for a day (quick "all present" action). */
export function markAllPresent(cohortId: string, traineeIds: string[], dayKey: string): void {
  setState((db) => {
    const rest = db.academyAttendance.filter(
      (a) => !(a.cohortId === cohortId && a.dayKey === dayKey),
    )
    const marks: AttendanceRecord[] = traineeIds.map((traineeId) => ({
      cohortId,
      traineeId,
      dayKey,
      status: 'present' as const,
    }))
    return { ...db, academyAttendance: [...rest, ...marks] }
  })
}
