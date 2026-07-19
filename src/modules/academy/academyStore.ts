import { useMemo } from 'react'
import { getState, setState, useSelector } from '../../lib/store'
import { uid } from '../../lib/id'
import { pushUndo } from '../../lib/undo'
import { addDays, formatDate, todayISO, fromISODate, toISODate, monthKey } from '../../lib/date'
import {
  ACADEMY_LENGTH_DAYS,
  DEFAULT_CONTACT_TARGET,
  curriculumFor,
  moduleSatisfied,
  phaseOf,
  requiredContacts,
  WAIVABLE_MODULE_IDS,
} from '../../data/academy'
import { CLASSROOM_TEMPLATE } from '../../data/academyTemplate'
import { PHASE2_TEMPLATE, timelineFromBlocks } from '../../data/academyPhase2'
import { FT_SLOTS, requiredMarks, sectionsFor } from '../../data/ftObjectives'
import type {
  AcademyCohort,
  AcademyDay,
  AcademyDayRef,
  AttendanceRecord,
  AttendanceStatus,
  Credential,
  CustomSession,
  DailyEval,
  DBShape,
  ObjectiveMark,
  OperationId,
  RideAssignment,
  ScheduleBlock,
  SessionArrangement,
  SkillCheck,
  SkillSheetId,
  SurveyResponse,
  TemplateBlock,
  TemplateSession,
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
  const customSessions = db.academyCustomSessions.filter((s) => s.cohortId === id)
  const traineeIds = new Set(trainees.map((t) => t.id))
  const rides = db.rideAssignments.filter((r) => traineeIds.has(r.traineeId))

  setState((db) => ({
    ...db,
    academyCohorts: db.academyCohorts.filter((c) => c.id !== id),
    trainees: db.trainees.filter((t) => t.cohortId !== id),
    academyDays: db.academyDays.filter((d) => d.cohortId !== id),
    academyArrangements: db.academyArrangements.filter((a) => a.cohortId !== id),
    academyAttendance: db.academyAttendance.filter((a) => a.cohortId !== id),
    academyCustomSessions: db.academyCustomSessions.filter((s) => s.cohortId !== id),
    rideAssignments: db.rideAssignments.filter((r) => !traineeIds.has(r.traineeId)),
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
        academyCustomSessions: [...db.academyCustomSessions, ...customSessions],
        rideAssignments: [...db.rideAssignments, ...rides],
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
  transfer?: boolean
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
    transfer: input.transfer || undefined,
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
  // Remove everything that hangs off the trainee, so nothing orphaned lingers
  // (rides on Home, evals/skills in History, leaderboard points). Each removed
  // record also emits a sync tombstone, so the deletion propagates in full.
  const attendance = state.academyAttendance.filter((a) => a.traineeId === id)
  const rides = state.rideAssignments.filter((r) => r.traineeId === id)
  const evals = state.dailyEvals.filter((e) => e.traineeId === id)
  const skills = state.skillChecks.filter((s) => s.traineeId === id)
  const surveys = state.surveyResponses.filter((s) => s.traineeId === id)
  setState((db) => ({
    ...db,
    trainees: db.trainees.filter((t) => t.id !== id),
    academyAttendance: db.academyAttendance.filter((a) => a.traineeId !== id),
    rideAssignments: db.rideAssignments.filter((r) => r.traineeId !== id),
    dailyEvals: db.dailyEvals.filter((e) => e.traineeId !== id),
    skillChecks: db.skillChecks.filter((s) => s.traineeId !== id),
    surveyResponses: db.surveyResponses.filter((s) => s.traineeId !== id),
  }))
  if (trainee) {
    pushUndo(`Removed ${trainee.name}`, () =>
      setState((db) => ({
        ...db,
        trainees: [...db.trainees, trainee],
        academyAttendance: [...db.academyAttendance, ...attendance],
        rideAssignments: [...db.rideAssignments, ...rides],
        dailyEvals: [...db.dailyEvals, ...evals],
        skillChecks: [...db.skillChecks, ...skills],
        surveyResponses: [...db.surveyResponses, ...surveys],
      })),
    )
  }
}

/**
 * Purge records that reference a trainee who is no longer on any roster.
 * Trainees removed before deleteTrainee learned to cascade left their
 * attendance, rides, evals, skill checks, and surveys behind — still showing
 * on Home, in History, and on the leaderboard. Each purged record emits a
 * sync tombstone, so one device running this cleans every device.
 * Returns how many records were removed.
 */
export function purgeOrphanTraineeRecords(): number {
  const db = getState()
  // A trainee whose cohort no longer exists is itself an orphan: rosters are
  // per-cohort, so no roster can ever reach them for a manual Remove — yet
  // Home lists every trainee globally, so they linger there forever.
  const cohorts = new Set(db.academyCohorts.map((c) => c.id))
  const keepTrainee = (t: Trainee) => cohorts.has(t.cohortId)
  const roster = new Set(db.trainees.filter(keepTrainee).map((t) => t.id))
  // Only records LINKED to a missing trainee are orphans. Historical imports
  // carry a traineeName but no traineeId — they belong to no roster and must
  // never be swept.
  const keep = (r: { traineeId?: string }) => !r.traineeId || roster.has(r.traineeId)
  const count =
    db.trainees.filter((t) => !keepTrainee(t)).length +
    db.academyAttendance.filter((r) => !keep(r)).length +
    db.rideAssignments.filter((r) => !keep(r)).length +
    db.dailyEvals.filter((r) => !keep(r)).length +
    db.skillChecks.filter((r) => !keep(r)).length +
    db.surveyResponses.filter((r) => !keep(r)).length
  if (count === 0) return 0
  setState((s) => ({
    ...s,
    trainees: s.trainees.filter(keepTrainee),
    academyAttendance: s.academyAttendance.filter(keep),
    rideAssignments: s.rideAssignments.filter(keep),
    dailyEvals: s.dailyEvals.filter(keep),
    skillChecks: s.skillChecks.filter(keep),
    surveyResponses: s.surveyResponses.filter(keep),
  }))
  return count
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

/** Mark (or unmark) a hire as an AMR transfer; clearing it drops any waivers. */
export function setTransfer(traineeId: string, transfer: boolean): void {
  setState((db) => ({
    ...db,
    trainees: db.trainees.map((t) => {
      if (t.id !== traineeId) return t
      if (transfer) return { ...t, transfer: true }
      const { transfer: _t, waived: _w, ...rest } = t
      return rest as Trainee
    }),
  }))
}

/** Waive / un-waive a requirement for an AMR transfer (waivable modules only). */
export function toggleWaiver(traineeId: string, moduleId: string): void {
  if (!WAIVABLE_MODULE_IDS.has(moduleId)) return
  setState((db) => ({
    ...db,
    trainees: db.trainees.map((t) => {
      if (t.id !== traineeId) return t
      const waived = { ...t.waived }
      if (waived[moduleId]) delete waived[moduleId]
      else if (t.transfer) waived[moduleId] = todayISO()
      else return t
      return { ...t, waived: Object.keys(waived).length ? waived : undefined }
    }),
  }))
}

/** Adjust a completed module's date to the real completion day. */
export function setModuleDate(traineeId: string, moduleId: string, date: string): void {
  if (!date) return
  setState((db) => ({
    ...db,
    trainees: db.trainees.map((t) =>
      t.id === traineeId && t.checklist[moduleId]
        ? { ...t, checklist: { ...t.checklist, [moduleId]: date } }
        : t,
    ),
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

/**
 * Eligible for release: FTO phase and at/over the required contact count
 * (the spec's floor, or the trainee's own lowered transfer target).
 */
export function releaseEligible(t: Trainee): boolean {
  return phaseOf(t) === 'fto' && t.contacts >= requiredContacts(t)
}

// ----- FTO ride assignments ----------------------------------------------------

export interface RideInput {
  date: string
  unit: string
  ftoNames?: string
  window?: string
}

/**
 * Toggle a trainee onto/off an FTO crew shift. Returns true if the ride is
 * now assigned, false if the tap removed an existing assignment.
 */
export function toggleRide(traineeId: string, ride: RideInput): boolean {
  const existing = getState().rideAssignments.find(
    (r) => r.traineeId === traineeId && r.date === ride.date && r.unit === ride.unit,
  )
  if (existing) {
    removeRide(existing.id)
    return false
  }
  const assignment: RideAssignment = { id: uid('ride'), traineeId, ...ride }
  setState((db) => ({ ...db, rideAssignments: [...db.rideAssignments, assignment] }))
  return true
}

export function removeRide(id: string): void {
  const ride = getState().rideAssignments.find((r) => r.id === id)
  setState((db) => ({ ...db, rideAssignments: db.rideAssignments.filter((r) => r.id !== id) }))
  if (ride) {
    const t = getState().trainees.find((x) => x.id === ride.traineeId)
    pushUndo(`Removed ${t?.name ?? 'rider'} from ${ride.unit} ${formatDate(ride.date)}`, () =>
      setState((db) => ({ ...db, rideAssignments: [...db.rideAssignments, ride] })),
    )
  }
}

export function useAllRides(): RideAssignment[] {
  return useSelector((db) => db.rideAssignments)
}

/** A trainee's planned rides, soonest first. */
export function useRidesFor(traineeId: string): RideAssignment[] {
  return useSelector((db) =>
    db.rideAssignments
      .filter((r) => r.traineeId === traineeId)
      .sort((a, b) => a.date.localeCompare(b.date)),
  )
}

// ----- daily performance evaluations -------------------------------------------

export interface DailyEvalInput {
  date: string
  fto?: string
  scores: DailyEval['scores']
  strengths?: string
  improvements?: string
  truckWashed?: boolean
  spotter?: boolean
  readyIndependent?: boolean
}

export function addDailyEval(traineeId: string, input: DailyEvalInput): DailyEval {
  const trainee = getState().trainees.find((t) => t.id === traineeId)
  const ev: DailyEval = {
    id: uid('eval'),
    traineeId,
    traineeName: trainee?.name ?? '?',
    ...input,
    fto: input.fto?.trim() || undefined,
    strengths: input.strengths?.trim() || undefined,
    improvements: input.improvements?.trim() || undefined,
  }
  setState((db) => ({ ...db, dailyEvals: [...db.dailyEvals, ev] }))
  return ev
}

export function deleteDailyEval(id: string): void {
  const ev = getState().dailyEvals.find((e) => e.id === id)
  setState((db) => ({ ...db, dailyEvals: db.dailyEvals.filter((e) => e.id !== id) }))
  if (ev) {
    pushUndo(`Removed ${formatDate(ev.date)} eval for ${ev.traineeName}`, () =>
      setState((db) => ({ ...db, dailyEvals: [...db.dailyEvals, ev] })),
    )
  }
}

export function useAllEvals(): DailyEval[] {
  return useSelector((db) => db.dailyEvals)
}

/** A trainee's daily evals, newest first. */
export function useEvalsFor(traineeId: string): DailyEval[] {
  return useSelector((db) =>
    db.dailyEvals.filter((e) => e.traineeId === traineeId).sort((a, b) => b.date.localeCompare(a.date)),
  )
}

/** Mean of one eval's scored categories, or null when nothing was scored. */
export function evalAverage(e: DailyEval): number | null {
  const vals = Object.values(e.scores).filter((v): v is number => typeof v === 'number')
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

// ----- skill / check-off sheets ---------------------------------------------------

/** Which clinical sheet applies: Linn medics get their own; else the BLS sheet. */
export function sheetFor(t: Trainee): SkillSheetId {
  return t.operation === 'linn' && t.credential === 'paramedic' ? 'linn-medic' : 'bls'
}

// One live SkillCheck per (trainee, sheet). Early records were created before
// multi-sheet support with id `skill:<traineeId>` — lookups therefore go by
// (traineeId, sheet), never by id shape.
const skillCheckId = (traineeId: string, sheet: SkillSheetId) => `skill:${traineeId}:${sheet}`

export function useSkillCheckFor(traineeId: string, sheet: SkillSheetId): SkillCheck | undefined {
  return useSelector((db) => db.skillChecks.find((s) => s.traineeId === traineeId && s.sheet === sheet))
}

/** Patch (creating on first touch) one of the trainee's live check-off sheets. */
function patchSkillCheck(traineeId: string, sheet: SkillSheetId, patch: (s: SkillCheck) => SkillCheck): void {
  setState((db) => {
    const trainee = db.trainees.find((t) => t.id === traineeId)
    if (!trainee) return db
    const existing = db.skillChecks.find((s) => s.traineeId === traineeId && s.sheet === sheet)
    const base: SkillCheck = existing ?? {
      id: skillCheckId(traineeId, sheet),
      traineeId,
      traineeName: trainee.name,
      date: todayISO(),
      sheet,
      results: {},
    }
    const next = { ...patch({ ...base, results: { ...base.results } }), date: todayISO() }
    return {
      ...db,
      skillChecks: existing
        ? db.skillChecks.map((s) => (s.traineeId === traineeId && s.sheet === sheet ? next : s))
        : [...db.skillChecks, next],
    }
  })
}

/** Set (or clear) a skill's outcome on one sheet. */
export function setSkillResult(traineeId: string, sheet: SkillSheetId, skillId: string, result: 'pass' | 'fail' | null): void {
  patchSkillCheck(traineeId, sheet, (s) => {
    if (result === null) delete s.results[skillId]
    else s.results[skillId] = result
    return s
  })
}

/** Step sheets: toggle one observable step; all steps checked = skill passed. */
export function toggleSkillStep(traineeId: string, sheet: SkillSheetId, skillId: string, stepIdx: number, totalSteps: number): void {
  patchSkillCheck(traineeId, sheet, (s) => {
    const steps = { ...s.steps }
    const cur = new Set(steps[skillId] ?? [])
    if (cur.has(stepIdx)) cur.delete(stepIdx)
    else cur.add(stepIdx)
    steps[skillId] = [...cur].sort((a, b) => a - b)
    if (steps[skillId].length === totalSteps) s.results[skillId] = 'pass'
    else delete s.results[skillId]
    return { ...s, steps }
  })
}

export function setSkillEvaluator(traineeId: string, sheet: SkillSheetId, evaluator: string): void {
  patchSkillCheck(traineeId, sheet, (s) => ({ ...s, evaluator: evaluator.trim() || undefined }))
}

export function setSkillComments(traineeId: string, sheet: SkillSheetId, comments: string): void {
  patchSkillCheck(traineeId, sheet, (s) => ({ ...s, comments: comments.trim() || undefined }))
}

/** Capture (or clear) a signature on a sheet. `who` picks trainee vs FTO. */
export function setSkillSignature(
  traineeId: string,
  sheet: SkillSheetId,
  who: 'trainee' | 'evaluator',
  dataUrl: string | null,
): void {
  patchSkillCheck(traineeId, sheet, (s) => {
    if (who === 'trainee') {
      return { ...s, traineeSignature: dataUrl || undefined, traineeSignedAt: dataUrl ? todayISO() : undefined }
    }
    return { ...s, evaluatorSignature: dataUrl || undefined, evaluatorSignedAt: dataUrl ? todayISO() : undefined }
  })
}

// ----- survey responses (kept locally alongside the Google Sheet post) ----------

export function addSurveyResponse(traineeId: string, data: Record<string, string>): void {
  const resp: SurveyResponse = {
    id: uid('survey'),
    traineeId,
    submittedAt: new Date().toISOString(),
    data,
  }
  setState((db) => ({ ...db, surveyResponses: [...db.surveyResponses, resp] }))
}

// ----- digital Field Training Objectives checklist ----------------------------

/** Record one occurrence of an objective, stamped with shift + active FTO. */
export function addFieldMark(traineeId: string, objectiveId: string): void {
  setState((db) => ({
    ...db,
    trainees: db.trainees.map((t) => {
      if (t.id !== traineeId) return t
      const marks = t.fieldMarks?.[objectiveId] ?? []
      if (marks.length >= FT_SLOTS) return t
      const mark: ObjectiveMark = {
        date: todayISO(),
        shift: t.currentShift ?? 1,
        fto: t.activeFto?.trim() || undefined,
      }
      return { ...t, fieldMarks: { ...t.fieldMarks, [objectiveId]: [...marks, mark] } }
    }),
  }))
}

/** Remove the most recent mark on an objective (mis-tap correction). */
export function removeFieldMark(traineeId: string, objectiveId: string): void {
  setState((db) => ({
    ...db,
    trainees: db.trainees.map((t) => {
      if (t.id !== traineeId) return t
      const marks = t.fieldMarks?.[objectiveId] ?? []
      if (marks.length === 0) return t
      return { ...t, fieldMarks: { ...t.fieldMarks, [objectiveId]: marks.slice(0, -1) } }
    }),
  }))
}

/** Trainee acknowledges a whole section complete (toggles; stores the date). */
export function toggleSectionAck(traineeId: string, sectionId: string): void {
  setState((db) => ({
    ...db,
    trainees: db.trainees.map((t) => {
      if (t.id !== traineeId) return t
      const ack = { ...t.sectionAck }
      if (ack[sectionId]) delete ack[sectionId]
      else ack[sectionId] = todayISO()
      return { ...t, sectionAck: ack }
    }),
  }))
}

/** Log one exposure occurrence of a call type on the current shift. */
export function addExposure(traineeId: string, callType: string): void {
  setState((db) => ({
    ...db,
    trainees: db.trainees.map((t) =>
      t.id === traineeId
        ? {
            ...t,
            exposure: {
              ...t.exposure,
              [callType]: [...(t.exposure?.[callType] ?? []), t.currentShift ?? 1],
            },
          }
        : t,
    ),
  }))
}

/** Remove the most recent exposure occurrence of a call type. */
export function removeExposure(traineeId: string, callType: string): void {
  setState((db) => ({
    ...db,
    trainees: db.trainees.map((t) => {
      if (t.id !== traineeId) return t
      const hits = t.exposure?.[callType] ?? []
      if (hits.length === 0) return t
      return { ...t, exposure: { ...t.exposure, [callType]: hits.slice(0, -1) } }
    }),
  }))
}

export interface FieldProgress {
  /** Objectives whose required mark count is met. */
  done: number
  /** Objectives applicable to this trainee's credential. */
  total: number
}

/** Field-checklist completion across the trainee's applicable sections. */
export function fieldProgress(t: Trainee): FieldProgress {
  let done = 0
  let total = 0
  for (const s of sectionsFor(t.credential)) {
    for (const o of s.objectives) {
      total++
      if ((t.fieldMarks?.[o.id]?.length ?? 0) >= requiredMarks(o.target)) done++
    }
  }
  return { done, total }
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
    const done = modules.filter((m) => moduleSatisfied(t, m.id)).length
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
  const sessions = activeCohortSessions(getState(), cohortId)
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
/**
 * The cohort's dated teaching days in printable form: legacy Phase-1 days plus
 * every dated, non-skipped session from the unified schedule, with clock times
 * computed from each session's start. Powers the agenda / full schedule / .ics
 * documents, which predate the unified schedule and consume AcademyDay[].
 */
export function useScheduleDays(cohortId: string | undefined): AcademyDay[] {
  const days = useCohortDays(cohortId)
  const arrangements = useArrangements(cohortId)
  const sessions = useCohortSessions(cohortId)
  return useMemo(() => {
    const fromSessions: AcademyDay[] = sessions
      .filter((s) => {
        const arr = arrangements[s.id]
        return !!arr?.date && !arr.skipped
      })
      .map((s) => {
        const arr = arrangements[s.id]!
        const blocks = arr.blocks?.length ? arr.blocks : s.blocks ?? []
        const rows = timelineFromBlocks(blocks, arr.startTime || s.defaultStart)
        const untimed = (s.segments ?? blocks).map((item, i) => ({
          id: `sb-${s.id}-${i}`,
          time: '',
          title: 'hours' in item && item.hours ? `${item.title} (${item.hours} hrs)` : item.title,
          note: item.notes,
        }))
        return {
          id: `sess-${s.id}`,
          cohortId: cohortId ?? '',
          date: arr.date!,
          title: s.custom ? s.title : `Session ${s.order} — ${s.title}`,
          facilitators: arr.facilitators || undefined,
          location: s.location,
          blocks: rows
            ? rows.map((r, i) => ({
                id: `sb-${s.id}-${i}`,
                time: `${r.start}–${r.end}`,
                title: r.block.title,
                note: r.block.notes,
              }))
            : untimed,
        }
      })
    return [...days, ...fromSessions].sort((a, b) => a.date.localeCompare(b.date))
  }, [days, arrangements, sessions, cohortId])
}

export function useAcademyDays(cohortId: string | undefined): AcademyDayRef[] {
  const days = useCohortDays(cohortId)
  const arrangements = useArrangements(cohortId)
  const sessions = useCohortSessions(cohortId)
  return useMemo(() => {
    const p1: AcademyDayRef[] = days.map((d) => ({
      key: `p1:${d.id}`,
      phase: 1,
      date: d.date,
      title: d.title || 'Academy day',
    }))
    const templateDays: AcademyDayRef[] = sessions
      .filter((s) => s.mode === 'in-person' && !arrangements[s.id]?.skipped)
      .map((s) => ({
        key: `p2:${s.id}`,
        phase: s.week,
        date: arrangements[s.id]?.date ?? '',
        title: `S${s.order} · ${s.title}`,
      }))
    return [...p1, ...templateDays].sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date.localeCompare(b.date)
    })
  }, [days, arrangements, sessions])
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
  // This overwrites the whole column — including any absences already
  // recorded — so keep the day's previous records for undo.
  const prev = getState().academyAttendance.filter(
    (a) => a.cohortId === cohortId && a.dayKey === dayKey,
  )
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
  pushUndo('Marked all present', () =>
    setState((db) => ({
      ...db,
      academyAttendance: [
        ...db.academyAttendance.filter((a) => !(a.cohortId === cohortId && a.dayKey === dayKey)),
        ...prev,
      ],
    })),
  )
}

/** Store a class's edited block list for one session (overrides the template). */
export function setSessionBlocks(cohortId: string, sessionId: string, blocks: TemplateBlock[]): void {
  setArrangement(cohortId, sessionId, { blocks })
}

/** Drop a class's block edits so the session reverts to the template default. */
export function resetSessionBlocks(cohortId: string, sessionId: string): void {
  setArrangement(cohortId, sessionId, { blocks: undefined })
}

// ----- per-class add / skip sessions -----------------------------------------

/** Every session a class sees: the shared template plus its own added sessions,
 *  sorted by week then order. Skipped sessions are still included (marked). */
export function cohortSessionsList(db: DBShape, cohortId: string): TemplateSession[] {
  const custom = db.academyCustomSessions.filter((s) => s.cohortId === cohortId)
  return [...PHASE2_TEMPLATE.sessions, ...custom].sort((a, b) =>
    a.week !== b.week ? a.week - b.week : a.order - b.order,
  )
}

export function useCohortSessions(cohortId: string | undefined): TemplateSession[] {
  return useSelector((db) => (cohortId ? cohortSessionsList(db, cohortId) : []))
}

/** Sessions a class actually runs (excludes skipped), in order. */
export function activeCohortSessions(db: DBShape, cohortId: string): TemplateSession[] {
  const skipped = new Set(
    db.academyArrangements.filter((a) => a.cohortId === cohortId && a.skipped).map((a) => a.sessionId),
  )
  return cohortSessionsList(db, cohortId).filter((s) => !skipped.has(s.id))
}

/** Skip (or restore) a session for one class. */
export function setSessionSkipped(cohortId: string, sessionId: string, skipped: boolean): void {
  setArrangement(cohortId, sessionId, { skipped: skipped || undefined })
}

/** Add a per-class session to a week. Returns the new session's id. */
export function addCustomSession(
  cohortId: string,
  week: 1 | 2,
  mode: 'in-person' | 'at-home',
  title?: string,
): string {
  const id = uid('custom')
  const existing = cohortSessionsList(getState(), cohortId).filter((s) => s.week === week)
  const order = (existing.length ? Math.max(...existing.map((s) => s.order)) : week === 1 ? 0 : 6) + 1
  const session: CustomSession = {
    id,
    cohortId,
    custom: true,
    week,
    order,
    mode,
    title: title?.trim() || (mode === 'at-home' ? 'New at-home day' : 'New session'),
    objectives: [],
    ...(mode === 'in-person'
      ? {
          defaultStart: '0900',
          blocks: [
            { durationMin: 60, kind: 'education', title: 'New block' },
            { durationMin: 30, kind: 'closeout', title: 'Housekeeping & closeout' },
          ],
        }
      : {
          segments: [{ kind: 'lms', title: 'New segment', hours: 1 }],
        }),
  }
  setState((db) => ({ ...db, academyCustomSessions: [...db.academyCustomSessions, session] }))
  return id
}

/** Remove a per-class session and its arrangement. */
export function deleteCustomSession(cohortId: string, sessionId: string): void {
  setState((db) => ({
    ...db,
    academyCustomSessions: db.academyCustomSessions.filter(
      (s) => !(s.cohortId === cohortId && s.id === sessionId),
    ),
    academyArrangements: db.academyArrangements.filter(
      (a) => !(a.cohortId === cohortId && a.sessionId === sessionId),
    ),
  }))
}

/** Rename a per-class session. */
export function renameCustomSession(cohortId: string, sessionId: string, title: string): void {
  setState((db) => ({
    ...db,
    academyCustomSessions: db.academyCustomSessions.map((s) =>
      s.cohortId === cohortId && s.id === sessionId ? { ...s, title } : s,
    ),
  }))
}
