import { useMemo } from 'react'
import { getState, setState, useSelector } from '../../lib/store'
import { uid } from '../../lib/id'
import { pushUndo } from '../../lib/undo'
import { addDays, fromISODate, todayISO } from '../../lib/date'
import {
  KAR_109_11_8,
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
  AemtAttendanceRecord,
  AemtClinicalShift,
  AemtAuditEvent,
  AemtCompletion,
  AemtEncounter,
  AemtCourse,
  AemtDeadlineRecord,
  AemtFormResponse,
  AemtHourTargets,
  AemtSession,
  AemtSessionKind,
  AemtSkillCheck,
  AemtStudent,
  AttendanceStatus,
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

export function deleteCourse(id: string): void {
  setState((db) => {
    const course = db.aemtCourses.find((c) => c.id === id)
    const students = db.aemtStudents.filter((s) => s.courseId === id)
    const sessions = db.aemtSessions.filter((s) => s.courseId === id)
    const attendance = db.aemtAttendance.filter((a) => a.courseId === id)
    if (course) {
      pushUndo(`Deleted ${course.label}`, () =>
        setState((cur) => ({
          ...cur,
          aemtCourses: [...cur.aemtCourses, course],
          aemtStudents: [...cur.aemtStudents, ...students],
          aemtSessions: [...cur.aemtSessions, ...sessions],
          aemtAttendance: [...cur.aemtAttendance, ...attendance],
        })),
      )
    }
    return {
      ...db,
      aemtCourses: db.aemtCourses.filter((c) => c.id !== id),
      aemtStudents: db.aemtStudents.filter((s) => s.courseId !== id),
      aemtSessions: db.aemtSessions.filter((s) => s.courseId !== id),
      aemtAttendance: db.aemtAttendance.filter((a) => a.courseId !== id),
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
export function seedKcSchedule(courseId: string, startISO: string): number {
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
        created.push({
          id: uid('asess'),
          courseId,
          date,
          title: block.title,
          kind,
          hours: Math.round(hours * 100) / 100,
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
  return created.length
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
  return [
    { id: 'didactic', label: 'Didactic', target: targets.didactic, scheduled: byKind.didactic },
    { id: 'lab', label: 'Lab / psychomotor', target: targets.lab, scheduled: byKind.lab },
  ].map((r) => ({ ...r, delta: r.scheduled - r.target }))
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

export function setSkillSignoff(
  courseId: string,
  studentId: string,
  sheetId: string,
  patch: { evaluator?: string; passedDate?: string | null },
): void {
  upsertCheck(courseId, studentId, sheetId, (c) => ({
    ...c,
    evaluator: patch.evaluator ?? c.evaluator,
    passedDate: patch.passedDate === null ? undefined : (patch.passedDate ?? c.passedDate),
  }))
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
      signedOff: !!check?.passedDate,
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
  return responses.filter((r) => r.values.remedial === true || r.values.concernRaised === true)
}

// ----- KBEMS submission deadlines --------------------------------------------

export function useDeadlineRecords(): AemtDeadlineRecord[] {
  return useSelector((db) => db.aemtDeadlines)
}

export function setDeadlineDone(courseId: string, deadlineId: string, date: string | null): void {
  setState((db) => {
    const rest = db.aemtDeadlines.filter(
      (d) => !(d.courseId === courseId && d.deadlineId === deadlineId),
    )
    if (!date) return { ...db, aemtDeadlines: rest }
    return { ...db, aemtDeadlines: [...rest, { courseId, deadlineId, completedDate: date }] }
  })
}

export interface DueDeadline {
  course: AemtCourse
  deadline: (typeof KBEMS_DEADLINES)[number]
  /** ISO date the submission is due. */
  dueDate: string
  /** Days from today; negative = overdue. */
  daysOut: number
  completedDate?: string
  done: boolean
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
        out.push({
          course,
          deadline,
          dueDate,
          daysOut,
          completedDate: rec?.completedDate,
          done: !!rec,
          overdue: !rec && daysOut < 0,
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
  /** Hours credited so far. */
  earned: number
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
      return {
        student,
        earned,
        missedHours: missed.reduce((sum, s) => sum + s.hours, 0),
        missed,
        classAbsentHours,
        absenceRemaining: Math.max(0, MAX_ABSENT_HOURS - classAbsentHours),
        overAbsenceCap: classAbsentHours > MAX_ABSENT_HOURS,
      }
    })
  }, [students, sessions, records])
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

export function updateShift(id: string, patch: Partial<AemtClinicalShift>): void {
  setState((db) => ({
    ...db,
    aemtShifts: db.aemtShifts.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  }))
}

/** Preceptor attestation that the shift record is accurate. */
export function attestShift(id: string, attested: boolean): void {
  updateShift(id, { attestedAt: attested ? new Date().toISOString() : undefined })
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
  const done = shifts.filter((s) => s.attestedAt)
  return {
    hospital: done.filter((s) => s.setting === 'hospital').reduce((n, s) => n + s.hours, 0),
    field: done.filter((s) => s.setting === 'field').reduce((n, s) => n + s.hours, 0),
    unattested: shifts.filter((s) => !s.attestedAt).reduce((n, s) => n + s.hours, 0),
  }
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

/** One student's standing against all eight K.A.R. 109-11-8 minimums. */
export function progressFor(
  encounters: AemtEncounter[],
  studentId: string,
  shifts: AemtClinicalShift[] = [],
): RequirementProgress[] {
  const mine = encounters.filter((e) => e.studentId === studentId)
  const byId = new Map(shifts.map((s) => [s.id, s]))
  return KAR_109_11_8.map((requirement) => {
    const rows = mine.filter((e) => e.requirementId === requirement.id)
    // Three conditions, each of which the review found could be bypassed:
    // the setting must count for this requirement, the shift's preceptor must
    // be eligible to supervise it, and the preceptor must have attested.
    const eligible = rows.filter((e) => {
      if (!requirement.allowedSettings.includes(e.siteKind)) return false
      if (!e.shiftId) return true // pre-dates shift linking; counted, flagged below
      const shift = byId.get(e.shiftId)
      return !!shift?.attestedAt && supervisorEligible(requirement, shift)
    })
    const total = eligible.reduce((s, e) => s + e.count, 0)
    const eligibleIds = new Set(eligible)
    const ineligible = rows.filter((e) => !eligibleIds.has(e)).reduce((s, e) => s + e.count, 0)
    const unverified = rows
      .filter((e) => e.shiftId && !byId.get(e.shiftId)?.attestedAt)
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
  progress: RequirementProgress[]
  /** How many of the eight requirements are fully satisfied. */
  metCount: number
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
        const metCount = progress.filter((p) => p.met).length
        return { student, progress, metCount, complete: metCount === progress.length }
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
        {
          id: 'clinical',
          label: 'Clinical minimums met',
          status: c?.complete ? 'met' : 'unmet',
          detail: c ? `${c.metCount} of ${c.progress.length} K.A.R. 109-11-8 minimums` : '—',
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
  }, [students, hours, clinical, checks, responses, completions, monitorSheetId])
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
