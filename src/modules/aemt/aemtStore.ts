import { useMemo } from 'react'
import { setState, useSelector } from '../../lib/store'
import { uid } from '../../lib/id'
import { pushUndo } from '../../lib/undo'
import { addDays, fromISODate, todayISO } from '../../lib/date'
import { KAR_109_11_8, KC_BLOCK_PLAN, KC_HOUR_TARGETS, MAX_ABSENT_HOURS } from '../../data/aemt'
import type { KarMinimum } from '../../data/aemt'
import type {
  AemtAttendanceRecord,
  AemtEncounter,
  AemtCourse,
  AemtSession,
  AemtSessionKind,
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
    id: uid('aemt'),
    label: input.label,
    startDate: input.startDate,
    endDate: input.endDate,
    courseNumber: input.courseNumber,
    coordinator: input.coordinator,
    medicalDirector: input.medicalDirector,
    notes: input.notes,
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

export function deleteStudent(id: string): void {
  setState((db) => {
    const student = db.aemtStudents.find((s) => s.id === id)
    const attendance = db.aemtAttendance.filter((a) => a.studentId === id)
    if (student) {
      pushUndo(`Removed ${student.name}`, () =>
        setState((cur) => ({
          ...cur,
          aemtStudents: [...cur.aemtStudents, student],
          aemtAttendance: [...cur.aemtAttendance, ...attendance],
        })),
      )
    }
    return {
      ...db,
      aemtStudents: db.aemtStudents.filter((s) => s.id !== id),
      aemtAttendance: db.aemtAttendance.filter((a) => a.studentId !== id),
    }
  })
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
 * Scheduled hours against the proposal's committed targets. This is the number
 * a KBEMS reviewer compares, so it is shown live while the schedule is built.
 */
export function reconcileHours(sessions: AemtSession[]): HourReconciliation[] {
  const { byKind } = courseHourTotals(sessions)
  const scheduledFor: Record<string, number> = {
    didactic: byKind.didactic,
    lab: byKind.lab,
    // Clinical and field hours are logged as shifts, not class sessions; any
    // session marked 'clinical' counts toward the combined clinical/field goal.
    clinical: byKind.clinical,
  }
  return KC_HOUR_TARGETS.filter((t) => t.id === 'didactic' || t.id === 'lab').map((t) => {
    const scheduled = scheduledFor[t.id] ?? 0
    return { id: t.id, label: t.label, target: t.hours, scheduled, delta: scheduled - t.hours }
  })
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
  /** Reps logged, all sites. */
  total: number
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
export function progressFor(encounters: AemtEncounter[], studentId: string): RequirementProgress[] {
  const mine = encounters.filter((e) => e.studentId === studentId)
  return KAR_109_11_8.map((requirement) => {
    const rows = mine.filter((e) => e.requirementId === requirement.id)
    const total = rows.reduce((s, e) => s + e.count, 0)
    const field = rows.filter((e) => e.siteKind === 'field').reduce((s, e) => s + e.count, 0)
    const sub = rows.filter((e) => e.initiatedInfusion).reduce((s, e) => s + e.count, 0)
    const totalMet = total >= requirement.minimum
    const fieldMet = field >= (requirement.fieldMinimum ?? 0)
    const subMet = sub >= (requirement.subRequirement?.minimum ?? 0)
    return { requirement, total, field, sub, totalMet, fieldMet, subMet, met: totalMet && fieldMet && subMet }
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
  return useMemo(
    () =>
      students.map((student) => {
        const progress = progressFor(encounters, student.id)
        const metCount = progress.filter((p) => p.met).length
        return { student, progress, metCount, complete: metCount === progress.length }
      }),
    [students, encounters],
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
