import { useMemo } from 'react'
import { setState, useSelector } from '../../lib/store'
import { uid } from '../../lib/id'
import { pushUndo } from '../../lib/undo'
import { todayISO } from '../../lib/date'
import type {
  AemtAttendanceRecord,
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
      return {
        student,
        earned,
        missedHours: missed.reduce((sum, s) => sum + s.hours, 0),
        missed,
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
