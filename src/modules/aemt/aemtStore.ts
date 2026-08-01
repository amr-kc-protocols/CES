import { useMemo } from 'react'
import { getState, setState, useSelector, usePersistFailed } from '../../lib/store'
import { useSyncStatus } from '../../lib/sync'
import { uid } from '../../lib/id'
import { pushUndo } from '../../lib/undo'
import { addDays, fromISODate, todayISO } from '../../lib/date'
import {
  blockPlanTotals,
  CLINICAL_REQUIREMENTS,
  KBEMS_DEADLINES,
  KC_BLOCK_PLAN,
  MAX_ABSENT_HOURS,
  MIN_PASSING_PERCENT,
} from '../../data/aemt'
import { SETTING_PRECEPTORS } from '../../data/aemt'
import type { KarMinimum } from '../../data/aemt'
import { sheetsForCourse } from '../../data/aemtSkills'
import type { AemtSkillSheet } from '../../data/aemtSkills'
import type {
  Attestation,
  AemtAttendanceRecord,
  AemtClinicalShift,
  AemtAuditEvent,
  AemtCompletion,
  AemtEncounter,
  AemtCourse,
  AemtDeadlineRecord,
  AemtFormResponse,
  AemtHourTargets,
  AemtRecordDoc,
  AemtSession,
  AemtSessionKind,
  AemtSkillCheck,
  AemtStudent,
  AttendanceStatus,
  DBShape,
} from '../../types'

// ---------------------------------------------------------------------------
// AEMT course store. Mirrors the academy store's shape (selectors + plain
// mutation functions writing through lib/store), so the two modules read the
// same way. What differs is the unit of record: an AEMT course documents
// *contact hours* toward a Kansas-approved class, so hours live on the session
// and attendance can override them for a partial day.
// ---------------------------------------------------------------------------

// ----- courses ---------------------------------------------------------------

export function useCourses(): AemtCourse[] {
  return useSelector((db) => db.aemtCourses)
}

export function useCourse(courseId: string | undefined): AemtCourse | undefined {
  return useSelector((db) => db.aemtCourses.find((c) => c.id === courseId))
}

/** Newest course first — the one being run now is nearly always the one wanted. */
export function byStartDesc(a: AemtCourse, b: AemtCourse): number {
  return b.startDate.localeCompare(a.startDate)
}

export function createCourse(
  input: Pick<AemtCourse, 'label' | 'startDate' | 'endDate'> & Partial<AemtCourse>,
): AemtCourse {
  const now = new Date().toISOString()
  const course: AemtCourse = {
    // Spread first so every optional field on the input carries through; an
    // explicit field list here silently dropped whatever was added later.
    ...input,
    id: uid('aemt'),
    label: input.label,
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: now,
    updatedAt: now,
  }
  setState((db) => ({ ...db, aemtCourses: [...db.aemtCourses, course] }))
  return course
}

export function updateCourse(id: string, patch: Partial<AemtCourse>): void {
  setState((db) => ({
    ...db,
    aemtCourses: db.aemtCourses.map((c) =>
      c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
    ),
  }))
}

/** Every table a course owns. Anything keyed by courseId belongs here. */
const COURSE_OWNED = [
  'aemtStudents',
  'aemtSessions',
  'aemtAttendance',
  'aemtEncounters',
  'aemtShifts',
  'aemtDeadlines',
  'aemtSkillChecks',
  'aemtFormResponses',
  'aemtCompletions',
  'aemtRecordDocs',
  'aemtAudit',
] as const

type CourseOwnedKey = (typeof COURSE_OWNED)[number]

/** What deleting a course would take with it — shown before it happens. */
export interface CourseFootprint {
  students: number
  sessions: number
  shifts: number
  encounters: number
  skillChecks: number
  formResponses: number
  /** Verified completions. A course with these is a real record, not a test. */
  completions: number
  auditEvents: number
  /** Filings recorded as submitted to KBEMS. */
  submissions: number
  /** Nothing has been recorded against this course at all. */
  empty: boolean
}

export function useCourseFootprint(courseId: string | undefined): CourseFootprint {
  const db = useSelector((d) => d)
  return useMemo(() => {
    const n = (k: CourseOwnedKey) => db[k].filter((r) => r.courseId === courseId).length
    const f = {
      students: n('aemtStudents'),
      sessions: n('aemtSessions'),
      shifts: n('aemtShifts'),
      encounters: n('aemtEncounters'),
      skillChecks: n('aemtSkillChecks'),
      formResponses: n('aemtFormResponses'),
      completions: n('aemtCompletions'),
      auditEvents: n('aemtAudit'),
      submissions: db.aemtDeadlines.filter((d) => d.courseId === courseId && d.submittedDate).length,
    }
    return { ...f, empty: Object.values(f).every((v) => v === 0) }
  }, [db, courseId])
}

/**
 * Delete a course and everything it owns.
 *
 * Every AEMT table is keyed by courseId, and each one left behind is an orphan
 * that nothing can reach and nothing will clean up — including audit events,
 * which are append-only by design and would outlive the course they describe.
 * The whole set is captured first so undo restores the course intact.
 */
export function deleteCourse(id: string): void {
  setState((db) => {
    const course = db.aemtCourses.find((c) => c.id === id)
    if (!course) return db

    const owned = Object.fromEntries(
      COURSE_OWNED.map((k) => [k, db[k].filter((r) => r.courseId === id)]),
    ) as { [K in CourseOwnedKey]: DBShape[K] }

    pushUndo(`Deleted ${course.label}`, () =>
      setState((cur) => ({
        ...cur,
        ...(Object.fromEntries(
          COURSE_OWNED.map((k) => [k, [...cur[k], ...owned[k]]]),
        ) as Partial<DBShape>),
        aemtCourses: [...cur.aemtCourses, course],
      })),
    )

    return {
      ...db,
      ...(Object.fromEntries(
        COURSE_OWNED.map((k) => [k, db[k].filter((r) => r.courseId !== id)]),
      ) as Partial<DBShape>),
      aemtCourses: db.aemtCourses.filter((c) => c.id !== id),
    }
  })
}

// ----- students --------------------------------------------------------------

export function useStudents(courseId: string | undefined): AemtStudent[] {
  return useSelector((db) =>
    db.aemtStudents
      .filter((s) => s.courseId === courseId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
}

export function addStudent(courseId: string, name: string, patch?: Partial<AemtStudent>): AemtStudent {
  const student: AemtStudent = {
    id: uid('astu'),
    courseId,
    name,
    status: 'active',
    ...patch,
  }
  setState((db) => ({ ...db, aemtStudents: [...db.aemtStudents, student] }))
  return student
}

export function updateStudent(id: string, patch: Partial<AemtStudent>): void {
  setState((db) => ({
    ...db,
    aemtStudents: db.aemtStudents.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  }))
}

/**
 * Hard-delete a student and EVERY record referencing them.
 *
 * Prefer setting status to 'withdrawn': a course record is normally retained,
 * and withdrawal is the outcome KBEMS asks for on the roster. This exists for
 * genuine mistakes — someone added to the wrong course. It must take all
 * related records with it, or attendance, encounters, skill checks and
 * evaluations are left pointing at a student who no longer exists.
 */
export function deleteStudent(id: string): void {
  setState((db) => {
    const student = db.aemtStudents.find((s) => s.id === id)
    const attendance = db.aemtAttendance.filter((a) => a.studentId === id)
    const encounters = db.aemtEncounters.filter((e) => e.studentId === id)
    const skillChecks = db.aemtSkillChecks.filter((c) => c.studentId === id)
    const forms = db.aemtFormResponses.filter((f) => f.studentId === id)
    if (student) {
      pushUndo(`Removed ${student.name}`, () =>
        setState((cur) => ({
          ...cur,
          aemtStudents: [...cur.aemtStudents, student],
          aemtAttendance: [...cur.aemtAttendance, ...attendance],
          aemtEncounters: [...cur.aemtEncounters, ...encounters],
          aemtSkillChecks: [...cur.aemtSkillChecks, ...skillChecks],
          aemtFormResponses: [...cur.aemtFormResponses, ...forms],
        })),
      )
    }
    return {
      ...db,
      aemtStudents: db.aemtStudents.filter((s) => s.id !== id),
      aemtAttendance: db.aemtAttendance.filter((a) => a.studentId !== id),
      aemtEncounters: db.aemtEncounters.filter((e) => e.studentId !== id),
      aemtSkillChecks: db.aemtSkillChecks.filter((c) => c.studentId !== id),
      aemtFormResponses: db.aemtFormResponses.filter((f) => f.studentId !== id),
    }
  })
}

/** How many records a hard delete would take with it, for the confirmation. */
export function studentRecordCount(studentId: string): number {
  const db = getState()
  return (
    db.aemtAttendance.filter((a) => a.studentId === studentId).length +
    db.aemtEncounters.filter((e) => e.studentId === studentId).length +
    db.aemtSkillChecks.filter((c) => c.studentId === studentId).length +
    db.aemtFormResponses.filter((f) => f.studentId === studentId).length
  )
}

// ----- sessions --------------------------------------------------------------

export function useSessions(courseId: string | undefined): AemtSession[] {
  return useSelector((db) =>
    db.aemtSessions
      .filter((s) => s.courseId === courseId)
      // Date only. Sort is stable, so same-day sessions keep the order they
      // were added — tie-breaking on title would re-order the list under the
      // coordinator's cursor while they are typing one.
      .sort((a, b) => a.date.localeCompare(b.date)),
  )
}

export interface SessionProblem {
  sessionId: string
  /** Short enough to sit under the row it belongs to. */
  text: string
}

/**
 * Schedule problems a KBEMS reviewer would spot. Nothing here blocks editing —
 * a half-built schedule is a normal intermediate state — but a session outside
 * the course dates, or one whose times contradict its hours, is a filing error
 * that is far cheaper to catch now than after submission.
 */
export function sessionProblems(
  sessions: AemtSession[],
  course: Pick<AemtCourse, 'startDate' | 'endDate'>,
): SessionProblem[] {
  const out: SessionProblem[] = []
  for (const s of sessions) {
    const label = s.title || 'Untitled session'
    if (!s.date) {
      out.push({ sessionId: s.id, text: `${label} has no date` })
    } else if (s.date < course.startDate || s.date > course.endDate) {
      out.push({
        sessionId: s.id,
        text: `${label} falls outside the course dates (${course.startDate} – ${course.endDate})`,
      })
    }
    if (!s.title.trim()) {
      out.push({ sessionId: s.id, text: 'This session has no subject — K.A.R. 109-11-1a(b3) requires one' })
    }
    if (s.hours <= 0) {
      out.push({ sessionId: s.id, text: `${label} is worth no hours` })
    }
    if (s.startTime && s.endTime) {
      if (s.endTime <= s.startTime) {
        out.push({ sessionId: s.id, text: `${label} ends at or before it starts` })
      } else {
        // Times and hours are filed together, so they have to agree. A quarter
        // hour of slack absorbs rounding without waving through a real gap.
        const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
        const span = (mins(s.endTime) - mins(s.startTime)) / 60
        if (Math.abs(span - s.hours) > 0.25) {
          out.push({
            sessionId: s.id,
            text: `${label} runs ${span.toFixed(2)} h by the clock but is filed as ${s.hours} h`,
          })
        }
      }
    }
  }
  return out
}

export function addSession(
  courseId: string,
  input?: Partial<Omit<AemtSession, 'id' | 'courseId'>>,
): AemtSession {
  const session: AemtSession = {
    id: uid('asess'),
    courseId,
    date: input?.date ?? todayISO(),
    title: input?.title ?? '',
    kind: input?.kind ?? 'didactic',
    hours: input?.hours ?? 4,
    instructor: input?.instructor,
    notes: input?.notes,
  }
  setState((db) => ({ ...db, aemtSessions: [...db.aemtSessions, session] }))
  return session
}

export function updateSession(id: string, patch: Partial<AemtSession>): void {
  setState((db) => ({
    ...db,
    aemtSessions: db.aemtSessions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  }))
}

export function deleteSession(id: string): void {
  setState((db) => {
    const session = db.aemtSessions.find((s) => s.id === id)
    const attendance = db.aemtAttendance.filter((a) => a.sessionId === id)
    if (session) {
      pushUndo(`Deleted ${session.title || 'session'}`, () =>
        setState((cur) => ({
          ...cur,
          aemtSessions: [...cur.aemtSessions, session],
          aemtAttendance: [...cur.aemtAttendance, ...attendance],
        })),
      )
    }
    return {
      ...db,
      aemtSessions: db.aemtSessions.filter((s) => s.id !== id),
      aemtAttendance: db.aemtAttendance.filter((a) => a.sessionId !== id),
    }
  })
}

// ----- seeding the KC 16-week plan -------------------------------------------

/** Next occurrence of a weekday (0=Sun) on or after an ISO date. */
function onOrAfterWeekday(iso: string, weekday: number): string {
  const d = fromISODate(iso)
  const delta = (weekday - d.getDay() + 7) % 7
  return addDays(iso, delta)
}

/**
 * Lay the proposal's 12-block content plan onto real Tuesday/Thursday dates,
 * starting from the first Tuesday on or after the course start.
 *
 * Hours are placed exactly as the proposal states them — didactic on Tuesday,
 * lab on Thursday, split evenly across the weeks a block spans. Blocks whose
 * week does not add up to the Tue/Thu 4+4 structure are reproduced faithfully
 * rather than smoothed, so the reconciliation panel surfaces the mismatch
 * instead of this function hiding it.
 *
 * Returns the number of sessions created.
 */
export interface SeedOutcome {
  sessions: number
  didactic: number
  lab: number
}

/**
 * What seeding the bundled plan would leave unscheduled against a course's own
 * filed targets.
 *
 * This is not a rounding gap. The AMR KC proposal's §3 content schedule sums
 * to 90 didactic hours while its §2 summary claims ~110, so building from the
 * bundled plan alone lands 20 hours short of the number the course filed. The
 * numbers are transcribed as filed rather than adjusted, which means the
 * shortfall is real and has to be stated before anyone builds on it.
 */
export function seedShortfall(targets: AemtHourTargets | undefined): {
  didactic: number
  lab: number
  total: number
} {
  const plan = blockPlanTotals()
  if (!targets) return { didactic: 0, lab: 0, total: 0 }
  const didactic = Math.max(0, (targets.didactic ?? plan.didactic) - plan.didactic)
  const lab = Math.max(0, (targets.lab ?? plan.lab) - plan.lab)
  return { didactic, lab, total: didactic + lab }
}

/**
 * Sessions carrying hours that are allocated but not yet placed. Created
 * deliberately, never as a side effect of seeding: they have hours and no
 * subject, so the schedule reconciles to the filed target while every one of
 * them stays flagged until a coordinator gives it a date and a topic.
 */
export function addPlaceholderSessions(
  courseId: string,
  kind: AemtSessionKind,
  hours: number,
  startISO: string,
  chunk = 4,
): number {
  const created: AemtSession[] = []
  let left = hours
  while (left > 0.001) {
    const h = Math.min(chunk, left)
    created.push({
      id: uid('asess'),
      courseId,
      date: startISO,
      title: '',
      kind,
      hours: Math.round(h * 100) / 100,
    })
    left -= h
  }
  setState((db) => ({ ...db, aemtSessions: [...db.aemtSessions, ...created] }))
  return created.length
}

export function seedKcSchedule(courseId: string, startISO: string): SeedOutcome {
  const firstTue = onOrAfterWeekday(startISO, 2)
  const created: AemtSession[] = []
  let weekIndex = 0

  for (const block of KC_BLOCK_PLAN) {
    const dPerWeek = block.didacticHours / block.spanWeeks
    const lPerWeek = block.labHours / block.spanWeeks
    for (let w = 0; w < block.spanWeeks; w++) {
      const tue = addDays(firstTue, weekIndex * 7)
      const thu = addDays(tue, 2)
      const push = (date: string, kind: AemtSessionKind, hours: number) => {
        if (hours <= 0) return
        const h = Math.round(hours * 100) / 100
        // The proposal runs class 09:00-13:00 Tue/Thu; end follows the hours.
        const endH = 9 + h
        created.push({
          id: uid('asess'),
          courseId,
          date,
          title: block.title,
          kind,
          hours: h,
          startTime: '09:00',
          endTime: `${String(Math.floor(endH)).padStart(2, '0')}:${endH % 1 ? '30' : '00'}`,
        })
      }
      if (dPerWeek > 0 && lPerWeek > 0) {
        push(tue, 'didactic', dPerWeek)
        push(thu, 'lab', lPerWeek)
      } else if (dPerWeek > 0) {
        // Lecture-only week: split across both class days.
        push(tue, 'didactic', dPerWeek / 2)
        push(thu, 'didactic', dPerWeek / 2)
      } else {
        push(tue, 'lab', lPerWeek / 2)
        push(thu, 'lab', lPerWeek / 2)
      }
      weekIndex++
    }
  }

  setState((db) => ({ ...db, aemtSessions: [...db.aemtSessions, ...created] }))
  return {
    sessions: created.length,
    didactic: created.filter((s) => s.kind === 'didactic').reduce((n, s) => n + s.hours, 0),
    lab: created.filter((s) => s.kind === 'lab').reduce((n, s) => n + s.hours, 0),
  }
}

export interface HourReconciliation {
  id: string
  label: string
  target: number
  scheduled: number
  /** scheduled - target. Negative = short of the filed commitment. */
  delta: number
}

/**
 * Scheduled hours against the course's own filed targets — the comparison a
 * KBEMS reviewer makes. Targets come from the course record rather than a
 * constant, so a second sponsoring organization running its own approved
 * program reconciles against its numbers, not AMR KC's.
 *
 * Returns [] when the course has declared no targets: showing a gap against
 * numbers nobody filed would be noise.
 */
export function reconcileHours(
  sessions: AemtSession[],
  targets: AemtHourTargets | undefined,
): HourReconciliation[] {
  if (!targets) return []
  const { byKind } = courseHourTotals(sessions)
  // One row per target the course actually filed. A category left unset is
  // omitted rather than compared against zero — "not filed" and "filed as 0"
  // are different claims, and only one of them is a commitment.
  return [
    { id: 'didactic', label: 'Didactic', target: targets.didactic, scheduled: byKind.didactic },
    { id: 'lab', label: 'Lab / psychomotor', target: targets.lab, scheduled: byKind.lab },
  ]
    .filter((r): r is HourReconciliation & { target: number } => typeof r.target === 'number')
    .map((r) => ({ ...r, delta: r.scheduled - r.target }))
}

/** AMR KC's filed commitments, offered as the default when creating a course. */
export const KC_DEFAULT_TARGETS: AemtHourTargets = {
  didactic: 110,
  lab: 50,
  clinical: 72,
  field: 144,
}

// ----- psychomotor skill check-offs ------------------------------------------

export function useSkillChecks(courseId: string | undefined): AemtSkillCheck[] {
  return useSelector((db) => db.aemtSkillChecks.filter((c) => c.courseId === courseId))
}

function upsertCheck(
  courseId: string,
  studentId: string,
  sheetId: string,
  fn: (c: AemtSkillCheck) => AemtSkillCheck,
): void {
  setState((db) => {
    const idx = db.aemtSkillChecks.findIndex(
      (c) => c.courseId === courseId && c.studentId === studentId && c.sheetId === sheetId,
    )
    const base: AemtSkillCheck =
      idx >= 0 ? db.aemtSkillChecks[idx] : { courseId, studentId, sheetId, results: {} }
    const next = fn(base)
    const list = [...db.aemtSkillChecks]
    if (idx >= 0) list[idx] = next
    else list.push(next)
    return { ...db, aemtSkillChecks: list }
  })
}

export function setSkillResult(
  courseId: string,
  studentId: string,
  sheetId: string,
  criterionId: string,
  result: 'pass' | 'fail' | null,
): void {
  upsertCheck(courseId, studentId, sheetId, (c) => {
    const results = { ...c.results }
    if (result) results[criterionId] = result
    else delete results[criterionId]
    return { ...c, results }
  })
}

/** Mark every criterion on a sheet as passed — the common "clean run" case. */
export function passAllCriteria(
  courseId: string,
  studentId: string,
  sheetId: string,
  criterionIds: string[],
): void {
  upsertCheck(courseId, studentId, sheetId, (c) => ({
    ...c,
    results: Object.fromEntries(criterionIds.map((id) => [id, 'pass' as const])),
  }))
}

export function toggleCriticalFailure(
  courseId: string,
  studentId: string,
  sheetId: string,
  text: string,
): void {
  upsertCheck(courseId, studentId, sheetId, (c) => {
    const cur = c.criticalFailed ?? []
    return {
      ...c,
      criticalFailed: cur.includes(text) ? cur.filter((t) => t !== text) : [...cur, text],
    }
  })
}

export const SKILL_STATEMENT =
  'I evaluated this student on every criterion of this sheet and attest that they ' +
  'performed it to the standard, without critical failure.'

/** Record the evaluator's name as it is typed. Does not sign anything. */
export function setSkillEvaluator(
  courseId: string,
  studentId: string,
  sheetId: string,
  evaluator: string,
): void {
  upsertCheck(courseId, studentId, sheetId, (c) => ({ ...c, evaluator }))
}

/**
 * Sign a skill sheet as passed.
 *
 * Previously a bare date with an optional free-text evaluator, so a sheet
 * could be signed off with nobody named — and it still counted toward
 * completion. Same bar as a shift: identified signer, credential, licence
 * number, statement, authenticated actor.
 */
export function signSkillSheet(
  courseId: string,
  studentId: string,
  sheetId: string,
  attestation: Omit<Attestation, 'at' | 'statement'>,
): void {
  const at = new Date().toISOString()
  const full: Attestation = { ...attestation, at, statement: SKILL_STATEMENT }
  upsertCheck(courseId, studentId, sheetId, (c) => ({
    ...c,
    evaluator: full.by,
    passedDate: at.slice(0, 10),
    attestation: full,
  }))
  const who = getState().aemtStudents.find((s) => s.id === studentId)?.name ?? studentId
  audit(
    courseId,
    studentId,
    attestation.actor,
    'skill sheet signed off',
    `${who} · ${sheetId} · signed by ${full.by} (${full.credential}` +
      `${full.certNumber ? ` #${full.certNumber}` : ''})`,
  )
}

export function revokeSkillSignoff(
  courseId: string,
  studentId: string,
  sheetId: string,
  actor: string,
): void {
  upsertCheck(courseId, studentId, sheetId, (c) => ({
    ...c,
    passedDate: undefined,
    attestation: undefined,
  }))
  const who = getState().aemtStudents.find((s) => s.id === studentId)?.name ?? studentId
  audit(courseId, studentId, actor, 'skill sign-off revoked', `${who} · ${sheetId}`)
}

/** A sign-off only counts when an identified evaluator stands behind it. */
export function skillSignoffIsEvidence(c: AemtSkillCheck | undefined): boolean {
  const a = c?.attestation
  return !!c?.passedDate && !!a && !!a.by.trim() && !!a.certNumber.trim() && !!a.actor.trim()
}

export interface SkillStanding {
  sheet: AemtSkillSheet
  check?: AemtSkillCheck
  passed: number
  failed: number
  total: number
  /** A critical-failure item was triggered — the sheet fails outright. */
  criticalFailed: boolean
  /** Every criterion passed and no critical failure. */
  allPassed: boolean
  signedOff: boolean
}

export function standingFor(
  checks: AemtSkillCheck[],
  studentId: string,
  sheets: AemtSkillSheet[],
): SkillStanding[] {
  return sheets.map((sheet) => {
    const check = checks.find((c) => c.studentId === studentId && c.sheetId === sheet.id)
    const ids = sheet.sections.flatMap((s) => s.criteria.map((c) => c.id))
    const results = check?.results ?? {}
    const passed = ids.filter((id) => results[id] === 'pass').length
    const failed = ids.filter((id) => results[id] === 'fail').length
    const criticalFailed = (check?.criticalFailed?.length ?? 0) > 0
    return {
      sheet,
      check,
      passed,
      failed,
      total: ids.length,
      criticalFailed,
      allPassed: passed === ids.length && failed === 0 && !criticalFailed,
      signedOff: skillSignoffIsEvidence(check),
    }
  })
}

// ----- evaluation forms ------------------------------------------------------

export function useFormResponses(courseId: string | undefined): AemtFormResponse[] {
  return useSelector((db) =>
    db.aemtFormResponses
      .filter((r) => r.courseId === courseId)
      .sort((a, b) => b.date.localeCompare(a.date)),
  )
}

export function addFormResponse(
  courseId: string,
  formId: string,
  input: { studentId?: string; date: string; values: Record<string, string | number | boolean> },
): AemtFormResponse {
  const res: AemtFormResponse = {
    id: uid('aform'),
    courseId,
    formId,
    studentId: input.studentId,
    date: input.date,
    values: input.values,
    submittedAt: new Date().toISOString(),
  }
  setState((db) => ({ ...db, aemtFormResponses: [...db.aemtFormResponses, res] }))
  return res
}

export function deleteFormResponse(id: string): void {
  setState((db) => {
    const res = db.aemtFormResponses.find((r) => r.id === id)
    if (res) {
      pushUndo('Deleted evaluation', () =>
        setState((cur) => ({ ...cur, aemtFormResponses: [...cur.aemtFormResponses, res] })),
      )
    }
    return { ...db, aemtFormResponses: db.aemtFormResponses.filter((r) => r.id !== id) }
  })
}

/**
 * Responses that need Program Manager attention: a daily evaluation flagged
 * for remedial education, or an affective evaluation flagged for a conference.
 * The proposal commits to reviewing these, so they surface rather than sitting
 * in a list of hundreds.
 */
export function flaggedResponses(responses: AemtFormResponse[]): AemtFormResponse[] {
  // Optional-chained deliberately: this feeds readiness for every student, so
  // one malformed row reaching it from storage would blank the whole tab.
  return responses.filter((r) => r.values?.remedial === true || r.values?.concernRaised === true)
}

// ----- program records --------------------------------------------------------

export function useRecordDocs(courseId: string | undefined): AemtRecordDoc[] {
  return useSelector((db) => db.aemtRecordDocs.filter((r) => r.courseId === courseId))
}

export function setRecordDoc(
  courseId: string,
  typeId: string,
  patch: Partial<Omit<AemtRecordDoc, 'courseId' | 'typeId'>>,
): void {
  setState((db) => {
    const i = db.aemtRecordDocs.findIndex((r) => r.courseId === courseId && r.typeId === typeId)
    const base: AemtRecordDoc =
      i >= 0 ? db.aemtRecordDocs[i] : { courseId, typeId, status: 'missing' }
    const next = { ...base, ...patch }
    const list = [...db.aemtRecordDocs]
    if (i >= 0) list[i] = next
    else list.push(next)
    return { ...db, aemtRecordDocs: list }
  })
}

// ----- KBEMS submission deadlines --------------------------------------------

export function useDeadlineRecords(): AemtDeadlineRecord[] {
  return useSelector((db) => db.aemtDeadlines)
}

/**
 * Record a KBEMS submission with its evidence, or clear it when passed null.
 * Kansas submissions go through the Licensing Portal, so the confirmation
 * number is the receipt — "marked done" alone proves nothing to an auditor.
 */
export function setDeadlineSubmission(
  courseId: string,
  deadlineId: string,
  input: Omit<AemtDeadlineRecord, 'courseId' | 'deadlineId'> | null,
  actor = 'local',
): void {
  audit(
    courseId,
    undefined,
    actor,
    input ? `KBEMS submission ${input.status}` : 'KBEMS submission cleared',
    input
      ? `${deadlineId} · ${input.submittedDate} · by ${input.submittedBy}${input.confirmationNumber ? ` · conf. ${input.confirmationNumber}` : ' · NO confirmation recorded'}`
      : deadlineId,
  )
  setState((db) => {
    const rest = db.aemtDeadlines.filter(
      (d) => !(d.courseId === courseId && d.deadlineId === deadlineId),
    )
    if (!input) return { ...db, aemtDeadlines: rest }
    return { ...db, aemtDeadlines: [...rest, { courseId, deadlineId, ...input }] }
  })
}

export interface DueDeadline {
  course: AemtCourse
  deadline: (typeof KBEMS_DEADLINES)[number]
  /** ISO date the submission is due. */
  dueDate: string
  /** Days from today; negative = overdue. */
  daysOut: number
  record?: AemtDeadlineRecord
  /** Submitted in any state — the deadline itself is met. */
  done: boolean
  /** Submitted but the portal rejected it; still needs work. */
  rejected: boolean
  overdue: boolean
}

/**
 * Every KBEMS submission across every course, soonest first. Deliberately
 * spans courses — the coordinator's real question is "what is due next",
 * which does not respect cohort boundaries when two classes overlap.
 */
export function useDeadlines(): DueDeadline[] {
  const courses = useCourses()
  const records = useDeadlineRecords()
  const sessions = useSelector((db) => db.aemtSessions)
  return useMemo(() => {
    const today = todayISO()
    const out: DueDeadline[] = []
    for (const course of courses) {
      const mine = sessions
        .filter((s) => s.courseId === course.id && s.date)
        .map((s) => s.date)
        .sort()
      // Fall back to the course's own dates before any session exists.
      const first = mine[0] ?? course.startDate
      const last = mine[mine.length - 1] ?? course.endDate
      for (const deadline of KBEMS_DEADLINES) {
        const anchor = deadline.anchor === 'first-session' ? first : last
        if (!anchor) continue
        const dueDate = addDays(anchor, deadline.offsetDays)
        const rec = records.find((r) => r.courseId === course.id && r.deadlineId === deadline.id)
        const daysOut = Math.round(
          (fromISODate(dueDate).getTime() - fromISODate(today).getTime()) / 86400000,
        )
        const rejected = rec?.status === 'rejected'
        out.push({
          course,
          deadline,
          dueDate,
          daysOut,
          record: rec,
          done: !!rec && !rejected,
          rejected,
          overdue: (!rec || rejected) && daysOut < 0,
        })
      }
    }
    return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [courses, records, sessions])
}

// ----- attendance & hours ----------------------------------------------------

export function useAemtAttendance(courseId: string | undefined): AemtAttendanceRecord[] {
  return useSelector((db) => db.aemtAttendance.filter((a) => a.courseId === courseId))
}

/** Attendance lookup key. */
export function attKey(studentId: string, sessionId: string): string {
  return `${studentId}|${sessionId}`
}

export function attendanceMap(records: AemtAttendanceRecord[]): Map<string, AemtAttendanceRecord> {
  const map = new Map<string, AemtAttendanceRecord>()
  for (const r of records) map.set(attKey(r.studentId, r.sessionId), r)
  return map
}

export function setAttendance(
  courseId: string,
  studentId: string,
  sessionId: string,
  status: AttendanceStatus | null,
  hours?: number,
): void {
  setState((db) => {
    const rest = db.aemtAttendance.filter(
      (a) => !(a.studentId === studentId && a.sessionId === sessionId),
    )
    if (!status) return { ...db, aemtAttendance: rest }
    return {
      ...db,
      aemtAttendance: [...rest, { courseId, studentId, sessionId, status, hours }],
    }
  })
}

export function markAllPresent(courseId: string, studentIds: string[], sessionId: string): void {
  setState((db) => {
    const ids = new Set(studentIds)
    const rest = db.aemtAttendance.filter((a) => !(ids.has(a.studentId) && a.sessionId === sessionId))
    return {
      ...db,
      aemtAttendance: [
        ...rest,
        ...studentIds.map((studentId) => ({
          courseId,
          studentId,
          sessionId,
          status: 'present' as AttendanceStatus,
        })),
      ],
    }
  })
}

/**
 * Hours credited to a student for one session: the attendance record's own
 * hours when set (partial day / make-up), else the session's scheduled hours.
 * Anything other than 'present' earns nothing.
 */
export function creditedHours(
  session: AemtSession,
  record: AemtAttendanceRecord | undefined,
): number {
  if (!record || record.status !== 'present') return 0
  return record.hours ?? session.hours
}

export interface StudentHours {
  student: AemtStudent
  /** Classroom hours credited so far (didactic, lab, exam). */
  earned: number
  /** Attested hospital clinical hours. */
  clinicalHours: number
  /** Attested field internship hours, all sites combined. */
  fieldHours: number
  /**
   * Shift hours logged but not yet attested. They are real time worked, but a
   * preceptor has not signed for them, so they count toward nothing yet.
   */
  unattestedShiftHours: number
  /** Classroom + attested clinical + attested field: the program total. */
  totalHours: number
  /** Hours lost to sessions marked absent — what a make-up has to recover. */
  missedHours: number
  /** Sessions missed (marked absent), for the make-up list. */
  missed: AemtSession[]
  /**
   * Absence against the course policy: more than MAX_ABSENT_HOURS of scheduled
   * CLASS time (didactic + lab) fails the course outright. Clinical shifts are
   * excluded — those are rescheduled rather than counted against the cap.
   */
  classAbsentHours: number
  /** Class-absence hours remaining before the policy fails the student. */
  absenceRemaining: number
  /** Already over the cap — course failure under the attendance policy. */
  overAbsenceCap: boolean
}

/** Per-student hour totals — the number a Kansas course record has to show. */
export function useStudentHours(courseId: string | undefined): StudentHours[] {
  const students = useStudents(courseId)
  const sessions = useSessions(courseId)
  const records = useAemtAttendance(courseId)
  const shifts = useShifts(courseId)
  return useMemo(() => {
    const map = attendanceMap(records)
    return students.map((student) => {
      let earned = 0
      const missed: AemtSession[] = []
      for (const s of sessions) {
        const rec = map.get(attKey(student.id, s.id))
        earned += creditedHours(s, rec)
        if (rec?.status === 'absent') missed.push(s)
      }
      const classAbsentHours = missed
        .filter((s) => s.kind === 'didactic' || s.kind === 'lab' || s.kind === 'exam')
        .reduce((sum, s) => sum + s.hours, 0)
      const totals = shiftHourTotals(shifts.filter((s) => s.studentId === student.id))
      return {
        student,
        earned,
        clinicalHours: totals.hospital,
        fieldHours: totals.field,
        unattestedShiftHours: totals.unattested,
        totalHours: earned + totals.hospital + totals.field,
        missedHours: missed.reduce((sum, s) => sum + s.hours, 0),
        missed,
        classAbsentHours,
        absenceRemaining: Math.max(0, MAX_ABSENT_HOURS - classAbsentHours),
        overAbsenceCap: classAbsentHours > MAX_ABSENT_HOURS,
      }
    })
  }, [students, sessions, records, shifts])
}

export interface StudentHourGap {
  id: 'class' | 'clinical' | 'field'
  label: string
  target: number
  earned: number
  /** earned - target. Negative = short of the filed commitment. */
  delta: number
  met: boolean
}

/**
 * A student's hours against the course's filed commitments. This is the
 * question the Records tab could not answer before shifts existed: classroom
 * time came from attendance, clinical and field time came from nowhere, so
 * "376 hours" was an assertion rather than a total.
 *
 * Classroom target is didactic + lab combined — attendance is taken per
 * session, and a session is one or the other, so splitting the comparison
 * would only reconcile against how the schedule happens to be labelled.
 * Returns [] when the course filed no targets.
 */
export function studentHourGaps(
  h: StudentHours,
  targets: AemtHourTargets | undefined,
): StudentHourGap[] {
  if (!targets) return []
  // Classroom needs BOTH didactic and lab: attendance is taken per session and
  // earned classroom hours mix the two, so comparing them against only one
  // filed number would report a shortfall that does not exist. Clinical and
  // field come from shifts tagged by setting, so each stands alone.
  const classTarget =
    typeof targets.didactic === 'number' && typeof targets.lab === 'number'
      ? targets.didactic + targets.lab
      : undefined
  return [
    { id: 'class' as const, label: 'Classroom', target: classTarget, earned: h.earned },
    { id: 'clinical' as const, label: 'Hospital clinical', target: targets.clinical, earned: h.clinicalHours },
    { id: 'field' as const, label: 'Field internship', target: targets.field, earned: h.fieldHours },
  ]
    .filter((r): r is StudentHourGap & { target: number } => typeof r.target === 'number')
    .map((r) => ({ ...r, delta: r.earned - r.target, met: r.earned >= r.target }))
}

/** Which hour commitments this course has filed, and which it has not. */
export interface TargetCoverage {
  filed: { id: keyof AemtHourTargets; label: string; hours: number }[]
  missing: { id: keyof AemtHourTargets; label: string }[]
  /** Total of the filed commitments only. */
  total: number
  complete: boolean
  any: boolean
}

const TARGET_LABELS: { id: keyof AemtHourTargets; label: string }[] = [
  { id: 'didactic', label: 'Didactic' },
  { id: 'lab', label: 'Lab / psychomotor' },
  { id: 'clinical', label: 'Hospital clinical' },
  { id: 'field', label: 'Field internship' },
]

export function targetCoverage(targets: AemtHourTargets | undefined): TargetCoverage {
  const filed: TargetCoverage['filed'] = []
  const missing: TargetCoverage['missing'] = []
  for (const t of TARGET_LABELS) {
    const v = targets?.[t.id]
    if (typeof v === 'number') filed.push({ ...t, hours: v })
    else missing.push(t)
  }
  return {
    filed,
    missing,
    total: filed.reduce((n, f) => n + f.hours, 0),
    complete: missing.length === 0,
    any: filed.length > 0,
  }
}

/** Sum of the hour commitments the course has actually filed. */
export function totalHourTarget(targets: AemtHourTargets | undefined): number {
  return targetCoverage(targets).total
}

/**
 * Hour completion as a readiness check. Names the categories still short
 * rather than reporting one aggregate number, because "12 hours owed" does
 * not tell a coordinator whether to schedule a hospital shift or a make-up.
 */
function hourReadinessCheck(h: StudentHours, targets: AemtHourTargets): ReadinessCheck {
  const gaps = studentHourGaps(h, targets)
  const cover = targetCoverage(targets)
  // Nothing comparable was filed, so there is nothing to compute. Falls to
  // attestation rather than passing by default.
  if (gaps.length === 0) {
    return {
      id: 'hours',
      label: 'Program hours complete',
      status: 'attest',
      detail: cover.any
        ? 'Filed targets are not comparable to recorded hours — attest manually'
        : 'Course filed no hour targets — nothing to reconcile against',
    }
  }
  const short = gaps.filter((g) => !g.met)
  const partial = cover.complete
    ? ''
    : ` · ${cover.missing.map((m) => m.label.toLowerCase()).join(', ')} not filed`
  return {
    id: 'hours',
    label: 'Program hours complete',
    status: short.length === 0 ? 'met' : 'unmet',
    detail:
      (short.length === 0
        ? `${gaps.reduce((n, g) => n + g.earned, 0).toFixed(2)} of ${gaps.reduce((n, g) => n + g.target, 0)} h filed`
        : `${short.map((g) => `${(-g.delta).toFixed(2)} h ${g.label.toLowerCase()}`).join(', ')} still owed` +
          (h.unattestedShiftHours > 0
            ? ` · ${h.unattestedShiftHours} h logged but not attested`
            : '')) + partial,
  }
}

/** Headline counts for a course row. */
export function useCourseTotals(courseId: string | undefined): {
  students: number
  sessions: number
  scheduledHours: number
} {
  const students = useStudents(courseId)
  const sessions = useSessions(courseId)
  return useMemo(
    () => ({
      students: students.filter((s) => s.status !== 'withdrawn').length,
      sessions: sessions.length,
      scheduledHours: sessions.reduce((sum, s) => sum + s.hours, 0),
    }),
    [students, sessions],
  )
}

// ----- clinical & field shifts ----------------------------------------------

export function useShifts(courseId: string | undefined): AemtClinicalShift[] {
  return useSelector((db) =>
    db.aemtShifts
      .filter((s) => s.courseId === courseId)
      .sort((a, b) => b.date.localeCompare(a.date)),
  )
}

export function addShift(
  courseId: string,
  studentId: string,
  input: Omit<AemtClinicalShift, 'id' | 'courseId' | 'studentId'>,
): AemtClinicalShift {
  const shift: AemtClinicalShift = { id: uid('ashift'), courseId, studentId, ...input }
  setState((db) => ({ ...db, aemtShifts: [...db.aemtShifts, shift] }))
  return shift
}

/**
 * Fields whose value is what a preceptor actually signed for. Changing any of
 * them after attestation means the signature no longer describes the record.
 * Notes are excluded — annotating a shift is not a material correction.
 */
const MATERIAL_SHIFT_FIELDS: (keyof AemtClinicalShift)[] = [
  'date',
  'hours',
  'setting',
  'site',
  'preceptorName',
  'preceptorCredential',
  'preceptorCertNumber',
]

export function materialShiftChanges(
  before: AemtClinicalShift,
  patch: Partial<AemtClinicalShift>,
): { field: string; from: string; to: string }[] {
  const out: { field: string; from: string; to: string }[] = []
  for (const f of MATERIAL_SHIFT_FIELDS) {
    if (!(f in patch)) continue
    const from = before[f] ?? ''
    const to = patch[f] ?? ''
    if (String(from) !== String(to)) out.push({ field: f, from: String(from), to: String(to) })
  }
  return out
}

/**
 * Edit a shift.
 *
 * A material change to an attested shift invalidates the attestation: the
 * preceptor signed for 12 hours, and a record silently reading 24 hours over
 * that signature is not evidence, it is a forgery the app helped produce. The
 * prior values and the invalidated signature are kept as a revision, the
 * change is audited, and the shift returns to unattested so it has to be
 * signed again.
 *
 * `reason` is required when correcting an attested record.
 */
export function updateShift(
  id: string,
  patch: Partial<AemtClinicalShift>,
  opts: { actor?: string; reason?: string } = {},
): { invalidated: boolean } {
  const before = getState().aemtShifts.find((s) => s.id === id)
  if (!before) return { invalidated: false }

  const changed = materialShiftChanges(before, patch)
  const wasAttested = !!before.attestedAt
  const invalidate = wasAttested && changed.length > 0
  const actor = opts.actor ?? 'local'

  setState((db) => ({
    ...db,
    aemtShifts: db.aemtShifts.map((s) => {
      if (s.id !== id) return s
      const next: AemtClinicalShift = { ...s, ...patch }
      if (!invalidate) return next
      const revision = {
        at: new Date().toISOString(),
        actor,
        reason: opts.reason?.trim() || 'not stated',
        changed,
        invalidated: s.attestation,
      }
      return {
        ...next,
        attestedAt: undefined,
        attestation: undefined,
        revisions: [...(s.revisions ?? []), revision],
      }
    }),
  }))

  const who = getState().aemtStudents.find((x) => x.id === before.studentId)?.name ?? before.studentId
  if (changed.length > 0) {
    audit(
      before.courseId,
      before.studentId,
      actor,
      invalidate ? 'shift edited — ATTESTATION INVALIDATED' : 'shift edited',
      `${who} · ${before.date} · ${changed.map((c) => `${c.field} ${c.from} → ${c.to}`).join('; ')}` +
        (invalidate ? ` · reason: ${opts.reason?.trim() || 'not stated'}` : ''),
    )
  }
  return { invalidated: invalidate }
}

/**
 * Preceptor attestation that the shift record is accurate. Audited: attesting
 * is what makes the shift's encounters count toward a regulated minimum, and
 * un-attesting silently removes them again.
 */
/** The statement a preceptor is agreeing to. Stored with every signature. */
export const ATTESTATION_STATEMENT =
  'I supervised this student for the shift recorded above, and I attest that the date, ' +
  'site, hours and the encounters logged against it are accurate and were performed ' +
  'under my supervision.'

/**
 * Sign a shift as a named, credentialed preceptor.
 *
 * Attestation is what makes an encounter count toward a regulated minimum, so
 * it is held to the same bar as a completion: an authenticated actor, an
 * identified signer with a credential and licence number, and the statement
 * they agreed to, all stored on the record. Without those it stays a draft.
 */
export function attestShift(
  id: string,
  attestation: Omit<Attestation, 'at' | 'statement'>,
): void {
  const shift = getState().aemtShifts.find((s) => s.id === id)
  if (!shift) return
  const full: Attestation = {
    ...attestation,
    at: new Date().toISOString(),
    statement: ATTESTATION_STATEMENT,
  }
  setState((db) => ({
    ...db,
    aemtShifts: db.aemtShifts.map((s) =>
      s.id === id ? { ...s, attestedAt: full.at, attestation: full } : s,
    ),
  }))
  const who = getState().aemtStudents.find((s) => s.id === shift.studentId)?.name ?? shift.studentId
  audit(
    shift.courseId,
    shift.studentId,
    attestation.actor,
    'shift attested',
    `${who} · ${shift.date} · ${shift.site} · signed by ${full.by} ` +
      `(${full.credential}${full.certNumber ? ` #${full.certNumber}` : ''})`,
  )
}

export function withdrawAttestation(id: string, actor: string, reason: string): void {
  const shift = getState().aemtShifts.find((s) => s.id === id)
  if (!shift) return
  setState((db) => ({
    ...db,
    aemtShifts: db.aemtShifts.map((s) =>
      s.id === id
        ? {
            ...s,
            attestedAt: undefined,
            attestation: undefined,
            revisions: [
              ...(s.revisions ?? []),
              {
                at: new Date().toISOString(),
                actor,
                reason: reason.trim() || 'not stated',
                changed: [],
                invalidated: s.attestation,
              },
            ],
          }
        : s,
    ),
  }))
  const who = getState().aemtStudents.find((s) => s.id === shift.studentId)?.name ?? shift.studentId
  audit(
    shift.courseId,
    shift.studentId,
    actor,
    'shift attestation withdrawn',
    `${who} · ${shift.date} · ${shift.site} · reason: ${reason.trim() || 'not stated'}`,
  )
}

/**
 * An attestation only counts as evidence when it carries an identified signer.
 * Legacy records hold a bare `attestedAt` with nobody behind it; those stay
 * visible but must not be treated as signed.
 */
export function attestationIsEvidence(s: AemtClinicalShift): boolean {
  const a = s.attestation
  return !!a && !!a.by.trim() && !!a.certNumber.trim() && !!a.actor.trim()
}

export function deleteShift(id: string): void {
  setState((db) => {
    const shift = db.aemtShifts.find((s) => s.id === id)
    const encounters = db.aemtEncounters.filter((e) => e.shiftId === id)
    if (shift) {
      pushUndo(`Deleted shift`, () =>
        setState((cur) => ({
          ...cur,
          aemtShifts: [...cur.aemtShifts, shift],
          aemtEncounters: [...cur.aemtEncounters, ...encounters],
        })),
      )
    }
    // Encounters go with the shift — an encounter whose shift is gone has no
    // date, site or preceptor behind it.
    return {
      ...db,
      aemtShifts: db.aemtShifts.filter((s) => s.id !== id),
      aemtEncounters: db.aemtEncounters.filter((e) => e.shiftId !== id),
    }
  })
}

/** Clinical and field hours actually worked, from attested shifts. */
export function shiftHourTotals(shifts: AemtClinicalShift[]): {
  hospital: number
  field: number
  unattested: number
} {
  const done = shifts.filter(attestationIsEvidence)
  return {
    hospital: done.filter((s) => s.setting === 'hospital').reduce((n, s) => n + s.hours, 0),
    field: done.filter((s) => s.setting === 'field').reduce((n, s) => n + s.hours, 0),
    unattested: shifts.filter((s) => !attestationIsEvidence(s)).reduce((n, s) => n + s.hours, 0),
  }
}

/**
 * Does this encounter count toward this requirement?
 *
 * ONE implementation, used by the on-screen progress, the readiness gate and
 * the audit package alike. It was written three times, and three copies of a
 * regulatory rule drift — the export can say a student is complete while the
 * screen says they are not, and only one of those goes to KBEMS.
 */
export function encounterCounts(
  e: AemtEncounter,
  requirement: KarMinimum,
  shift: AemtClinicalShift | undefined,
): boolean {
  if (!requirement.allowedSettings.includes(e.siteKind)) return false
  // An encounter with no shift behind it has no date, site or supervisor that
  // anyone signed for. It is kept and shown, but it is not evidence.
  if (!e.shiftId) return false
  if (!shift) return false
  if (!attestationIsEvidence(shift)) return false
  return supervisorEligible(requirement, shift)
}

/**
 * Whether a shift's preceptor may supervise a given requirement. Falls back to
 * the setting's own preceptor rule when the regulation does not name one.
 */
export function supervisorEligible(
  requirement: KarMinimum,
  shift: AemtClinicalShift | undefined,
): boolean {
  if (!shift) return false
  const allowed = requirement.eligibleSupervisors ?? SETTING_PRECEPTORS[shift.setting]
  return allowed.includes(shift.preceptorCredential)
}

// ----- patient encounter log (K.A.R. 109-11-8) -------------------------------

export function useEncounters(courseId: string | undefined): AemtEncounter[] {
  return useSelector((db) =>
    db.aemtEncounters
      .filter((e) => e.courseId === courseId)
      .sort((a, b) => b.date.localeCompare(a.date)),
  )
}

export function addEncounter(
  courseId: string,
  studentId: string,
  input: Omit<AemtEncounter, 'id' | 'courseId' | 'studentId'>,
): AemtEncounter {
  const enc: AemtEncounter = { id: uid('aenc'), courseId, studentId, ...input }
  setState((db) => ({ ...db, aemtEncounters: [...db.aemtEncounters, enc] }))
  return enc
}

export function deleteEncounter(id: string): void {
  setState((db) => {
    const enc = db.aemtEncounters.find((e) => e.id === id)
    if (enc) {
      pushUndo('Deleted log entry', () =>
        setState((cur) => ({ ...cur, aemtEncounters: [...cur.aemtEncounters, enc] })),
      )
    }
    return { ...db, aemtEncounters: db.aemtEncounters.filter((e) => e.id !== id) }
  })
}

export interface RequirementProgress {
  requirement: KarMinimum
  /** Reps logged in a setting that counts toward this requirement. */
  total: number
  /** Reps that do not count — wrong setting, ineligible supervisor, or an
   *  unattested shift. Surfaced, never silently folded into the total. */
  ineligible: number
  /** Reps sitting on a shift the preceptor has not yet attested. */
  unverified: number
  /** Reps logged at a field internship site. */
  field: number
  /** Reps satisfying the sub-requirement (venipunctures initiating an infusion). */
  sub: number
  /** Total minimum reached. */
  totalMet: boolean
  /** Field-specific minimum reached (true when the requirement has none). */
  fieldMet: boolean
  /** Sub-requirement reached (true when the requirement has none). */
  subMet: boolean
  /** Every condition on this requirement satisfied. */
  met: boolean
}

/**
 * One student's standing against every counted clinical requirement — the
 * seven K.A.R. 109-11-8(a)(4) minimums plus any program competency. Callers
 * split the result by `requirement.basis`; only 'kar' gates completion.
 */
export function progressFor(
  encounters: AemtEncounter[],
  studentId: string,
  shifts: AemtClinicalShift[] = [],
): RequirementProgress[] {
  const mine = encounters.filter((e) => e.studentId === studentId)
  const byId = new Map(shifts.map((s) => [s.id, s]))
  return CLINICAL_REQUIREMENTS.map((requirement) => {
    const rows = mine.filter((e) => e.requirementId === requirement.id)
    // Three conditions, each of which the review found could be bypassed:
    // the setting must count for this requirement, the shift's preceptor must
    // be eligible to supervise it, and the preceptor must have attested.
    const eligible = rows.filter((e) => encounterCounts(e, requirement, byId.get(e.shiftId ?? '')))
    const total = eligible.reduce((s, e) => s + e.count, 0)
    const eligibleIds = new Set(eligible)
    const ineligible = rows.filter((e) => !eligibleIds.has(e)).reduce((s, e) => s + e.count, 0)
    const unverified = rows
      .filter((e) => !e.shiftId || !attestationIsEvidence(byId.get(e.shiftId) ?? ({} as AemtClinicalShift)))
      .reduce((s, e) => s + e.count, 0)
    const field = eligible.filter((e) => e.siteKind === 'field').reduce((s, e) => s + e.count, 0)
    const sub = eligible.filter((e) => e.initiatedInfusion).reduce((s, e) => s + e.count, 0)
    const totalMet = total >= requirement.minimum
    const fieldMet = field >= (requirement.fieldMinimum ?? 0)
    const subMet = sub >= (requirement.subRequirement?.minimum ?? 0)
    return { requirement, total, ineligible, unverified, field, sub, totalMet, fieldMet, subMet, met: totalMet && fieldMet && subMet }
  })
}

export interface StudentClinicalStanding {
  student: AemtStudent
  /** Every counted requirement, statutory and program. */
  progress: RequirementProgress[]
  /** The seven K.A.R. 109-11-8(a)(4) minimums only. */
  statutory: RequirementProgress[]
  /** How many of the seven statutory minimums are fully satisfied. */
  metCount: number
  /** All seven statutory minimums met. Program competencies do not gate this. */
  complete: boolean
}

export function useClinicalStanding(courseId: string | undefined): StudentClinicalStanding[] {
  const students = useStudents(courseId)
  const encounters = useEncounters(courseId)
  const shifts = useShifts(courseId)
  return useMemo(
    () =>
      students.map((student) => {
        const progress = progressFor(encounters, student.id, shifts)
        // Completion is gated on the regulation, not on what the program
        // chooses to also track. A program competency short does not make a
        // student ineligible under K.A.R. 109-11-8.
        const statutory = progress.filter((p) => p.requirement.basis === 'kar')
        const metCount = statutory.filter((p) => p.met).length
        return { student, progress, statutory, metCount, complete: metCount === statutory.length }
      }),
    [students, encounters, shifts],
  )
}

/** Total scheduled hours in the course, by session kind and overall. */
export function courseHourTotals(sessions: AemtSession[]): {
  total: number
  byKind: Record<AemtSessionKind, number>
} {
  const byKind: Record<AemtSessionKind, number> = {
    didactic: 0,
    lab: 0,
    clinical: 0,
    exam: 0,
  }
  let total = 0
  for (const s of sessions) {
    byKind[s.kind] += s.hours
    total += s.hours
  }
  return { total, byKind }
}

// ----- completion readiness --------------------------------------------------
//
// Completion gates a student's eligibility to sit the NREMT cognitive exam, so
// it is a computed state with an explicit verification step — not a status
// anyone can pick from a dropdown. Each check either passes on evidence the app
// holds, or says plainly that it cannot be evidenced here.

export type ReadinessStatus = 'met' | 'unmet' | 'attest'

export interface ReadinessCheck {
  id: string
  label: string
  status: ReadinessStatus
  detail: string
}

export interface StudentReadiness {
  student: AemtStudent
  checks: ReadinessCheck[]
  /** Every computable check passes. */
  computedMet: boolean
  /** Ids of checks that do not pass — what an override would have to name. */
  unmet: string[]
  completion?: AemtCompletion
}

export function useCompletions(courseId: string | undefined): AemtCompletion[] {
  return useSelector((db) => db.aemtCompletions.filter((c) => c.courseId === courseId))
}

export function useAuditEvents(courseId: string | undefined): AemtAuditEvent[] {
  return useSelector((db) =>
    db.aemtAudit.filter((e) => e.courseId === courseId).sort((a, b) => b.at.localeCompare(a.at)),
  )
}

function audit(courseId: string, studentId: string | undefined, actor: string, action: string, detail: string): void {
  setState((db) => ({
    ...db,
    aemtAudit: [
      ...db.aemtAudit,
      { id: uid('aud'), courseId, studentId, at: new Date().toISOString(), actor, action, detail },
    ],
  }))
}

/** Close out a flagged remediation or behaviour conference. */
export function resolveFormResponse(id: string, by: string, note: string): void {
  setState((db) => ({
    ...db,
    aemtFormResponses: db.aemtFormResponses.map((r) =>
      r.id === id ? { ...r, resolvedDate: todayISO(), resolvedBy: by, resolutionNote: note } : r,
    ),
  }))
}

/** Flagged responses that have NOT been closed out. */
export function openConcerns(responses: AemtFormResponse[]): AemtFormResponse[] {
  return flaggedResponses(responses).filter((r) => !r.resolvedDate)
}

/**
 * Readiness for every student. Checks that the app cannot evidence — the final
 * course grade lives in the Navigate LMS — are reported as 'attest' so they are
 * captured at verification rather than silently assumed.
 */
export function useStudentReadiness(
  courseId: string | undefined,
  monitorSheetId: string | undefined,
): StudentReadiness[] {
  const students = useStudents(courseId)
  const hours = useStudentHours(courseId)
  const clinical = useClinicalStanding(courseId)
  const checks = useSkillChecks(courseId)
  const responses = useFormResponses(courseId)
  const completions = useCompletions(courseId)
  const targets = useCourse(courseId)?.targets

  return useMemo(() => {
    const sheets = sheetsForCourse(monitorSheetId)
    return students.map((student) => {
      const h = hours.find((x) => x.student.id === student.id)
      const c = clinical.find((x) => x.student.id === student.id)
      const skills = standingFor(checks, student.id, sheets)
      const signed = skills.filter((s) => s.signedOff).length
      const mine = responses.filter((r) => r.studentId === student.id)
      const open = openConcerns(mine)
      const courseForms = ['instructor-eval', 'course-eval']
      const submitted = courseForms.filter((f) => mine.some((r) => r.formId === f))

      const list: ReadinessCheck[] = [
        {
          id: 'attendance',
          label: 'Attendance within policy',
          status: h && h.classAbsentHours > MAX_ABSENT_HOURS ? 'unmet' : 'met',
          detail: h
            ? `${h.classAbsentHours} h of class missed (limit ${MAX_ABSENT_HOURS})`
            : 'No attendance recorded',
        },
        // Hours and clinical minimums are different questions. A student can
        // hit every K.A.R. 109-11-8 rep count in half the hours the course
        // filed, and the course still owes those hours.
        ...(targets && h
          ? [hourReadinessCheck(h, targets)]
          : [
              {
                id: 'hours',
                label: 'Program hours complete',
                status: 'attest' as const,
                detail: targets
                  ? 'No hours recorded for this student'
                  : 'Course filed no hour targets — nothing to reconcile against',
              },
            ]),
        {
          id: 'clinical',
          label: 'Clinical minimums met',
          status: c?.complete ? 'met' : 'unmet',
          detail: c ? `${c.metCount} of ${c.statutory.length} K.A.R. 109-11-8(a)(4) minimums` : '—',
        },
        {
          id: 'skills',
          label: 'Psychomotor skills signed off',
          status: signed === sheets.length && sheets.length > 0 ? 'met' : 'unmet',
          detail: `${signed} of ${sheets.length} sheets signed off`,
        },
        {
          id: 'concerns',
          label: 'Remediation and conferences closed',
          status: open.length === 0 ? 'met' : 'unmet',
          detail: open.length === 0 ? 'Nothing open' : `${open.length} still open`,
        },
        {
          id: 'evaluations',
          label: 'End-of-course evaluations submitted',
          status: submitted.length === courseForms.length ? 'met' : 'unmet',
          detail: `${submitted.length} of ${courseForms.length} submitted`,
        },
        {
          id: 'grade',
          label: `Final course grade at or above ${MIN_PASSING_PERCENT}%`,
          status: 'attest',
          detail: 'Held in the Navigate LMS — recorded and attested at verification',
        },
      ]

      return {
        student,
        checks: list,
        computedMet: list.every((x) => x.status !== 'unmet'),
        unmet: list.filter((x) => x.status === 'unmet').map((x) => x.id),
        completion: completions.find((x) => x.studentId === student.id),
      }
    })
  }, [students, hours, clinical, checks, responses, completions, monitorSheetId, targets])
}

/**
 * Record a completion. Refuses to fabricate readiness: if checks are unmet the
 * caller must supply an override, which is stored with the completion and
 * written to the audit log naming exactly which checks were bypassed.
 */
export function recordCompletion(
  courseId: string,
  studentId: string,
  input: {
    verifiedBy: string
    finalGradePercent: number
    override?: { reason: string; approver: string; unmetChecks: string[] }
  },
): void {
  const completion: AemtCompletion = {
    courseId,
    studentId,
    completedDate: todayISO(),
    verifiedBy: input.verifiedBy,
    finalGradePercent: input.finalGradePercent,
    override: input.override,
  }
  setState((db) => ({
    ...db,
    aemtCompletions: [
      ...db.aemtCompletions.filter((c) => !(c.courseId === courseId && c.studentId === studentId)),
      completion,
    ],
    aemtStudents: db.aemtStudents.map((s) =>
      s.id === studentId ? { ...s, status: 'completed' as const } : s,
    ),
  }))
  const name = getState().aemtStudents.find((s) => s.id === studentId)?.name ?? studentId
  audit(
    courseId,
    studentId,
    input.verifiedBy,
    input.override ? 'completion recorded WITH OVERRIDE' : 'completion recorded',
    input.override
      ? `${name} · grade ${input.finalGradePercent}% · bypassed: ${input.override.unmetChecks.join(', ')} · approved by ${input.override.approver} · reason: ${input.override.reason}`
      : `${name} · grade ${input.finalGradePercent}% · all readiness checks met`,
  )
}

export function revokeCompletion(courseId: string, studentId: string, actor: string, reason: string): void {
  const name = getState().aemtStudents.find((s) => s.id === studentId)?.name ?? studentId
  setState((db) => ({
    ...db,
    aemtCompletions: db.aemtCompletions.filter(
      (c) => !(c.courseId === courseId && c.studentId === studentId),
    ),
    aemtStudents: db.aemtStudents.map((s) =>
      s.id === studentId ? { ...s, status: 'active' as const } : s,
    ),
  }))
  audit(courseId, studentId, actor, 'completion revoked', `${name} · reason: ${reason}`)
}

// ----- official-record safety -------------------------------------------------
//
// A signed-out device keeps everything in localStorage and nothing leaves it.
// That is fine for working a shift, but it is not a place to create records
// somebody else will rely on: a completion that makes a student exam-eligible,
// or a KBEMS submission receipt. Those need to be durable and attributable, so
// they are gated on being signed in and persisting.

export interface RecordSafety {
  /** Safe to create a record that will be relied on outside this device. */
  canRecordOfficial: boolean
  /** Why not, when it is not. */
  reason?: string
  /** Signed in but with local changes still queued. */
  unsyncedCount: number
  /** Who the audit trail should attribute actions to. */
  actor: string
}

export function useRecordSafety(): RecordSafety {
  const { configured, signedIn, pending, email } = useSyncStatus()
  const persistFailed = usePersistFailed()

  if (persistFailed) {
    return {
      canRecordOfficial: false,
      reason:
        'This device is not saving — storage is full or blocked. Nothing recorded now would survive closing the app.',
      unsyncedCount: pending,
      actor: email ?? 'unknown',
    }
  }
  if (configured && !signedIn) {
    return {
      canRecordOfficial: false,
      reason:
        'Signed out. Everything stays on this device, so a completion or a submission recorded here would not reach anyone else and could not be attributed. Sign in from Settings first.',
      unsyncedCount: pending,
      actor: 'local',
    }
  }
  return { canRecordOfficial: true, unsyncedCount: pending, actor: email ?? 'local' }
}

/** Write an audit event from outside this module's own actions. */
export function recordAuditEvent(
  courseId: string,
  studentId: string | undefined,
  actor: string,
  action: string,
  detail: string,
): void {
  audit(courseId, studentId, actor, action, detail)
}
