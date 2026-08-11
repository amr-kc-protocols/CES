import { useMemo } from 'react'
import { getState, setState, useSelector, usePersistFailed } from '../../lib/store'
import { useSyncStatus } from '../../lib/sync'
import { uid } from '../../lib/id'
import { pushUndo } from '../../lib/undo'
import { addDays, fromISODate, todayISO } from '../../lib/date'
import { listExamResults } from '../../lib/exam'
import {
  buildClassPlan,
  blockPlanTotals,
  KC_CLASS_PATTERN,
  KC_CLINICAL_TARGET,
  KC_FIELD_TARGET,
  CLINICAL_REQUIREMENTS,
  INSTRUCTOR_VERIFICATION_DAYS,
  KBEMS_DEADLINES,
  MAX_ABSENT_HOURS,
  MIN_PASSING_PERCENT,
} from '../../data/aemt'
import { SETTING_PRECEPTORS } from '../../data/aemt'
import type { KarMinimum } from '../../data/aemt'
import { versionToPin } from '../templates/resolve'
import {
  SELECTION_WEIGHTS,
  BONUS_TIERS,
  THRESHOLDS,
  TEST_SECTIONS,
  TEST_TOTAL_MARKS,
  INTERVIEW_QUESTIONS,
  INTERVIEW_MAX,
  ELIGIBILITY_GATES,
} from '../../data/aemtSelection'
import type { AemtSkillSheet } from '../../data/aemtSkills'
import type {
  Attestation,
  AemtAttendanceRecord,
  AemtCandidate,
  AemtInterviewScore,
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
  // Selection data is retained under the employer's HR schedule rather than the
  // K.A.R. 109-17-3 clock, but it is still keyed by courseId: left out of this
  // list it survived the course as rows nothing could reach, list or delete.
  // It goes with the course and comes back with the undo, and the delete
  // confirmation counts it separately so the retention difference stays visible.
  'aemtCandidates',
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
  /**
   * Cohort candidates. Counted apart from the program records above because
   * their retention is the employer's HR schedule, not K.A.R. 109-17-3.
   */
  candidates: number
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
      candidates: n('aemtCandidates'),
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

/**
 * Edit a student.
 *
 * Refuses to move a student off 'completed' while a verified completion exists.
 * The roster dropdown correctly declined to *set* Completed, but moving a
 * completed student to Active or Withdrawn went straight through — leaving the
 * AemtCompletion record on file, unaudited, still printing in the audit package
 * and still shown as completed by the panel below. Un-completing someone is
 * `revokeCompletion`, which takes an actor and a reason.
 */
export function updateStudent(
  id: string,
  patch: Partial<AemtStudent>,
): { ok: boolean; refused?: string } {
  const db = getState()
  const student = db.aemtStudents.find((s) => s.id === id)
  if (!student) return { ok: false, refused: 'That student no longer exists.' }

  if (
    patch.status !== undefined &&
    patch.status !== 'completed' &&
    student.status === 'completed' &&
    db.aemtCompletions.some((c) => c.studentId === id && c.courseId === student.courseId)
  ) {
    return {
      ok: false,
      refused:
        'This student has a verified completion on file, which is what makes them eligible to sit ' +
        'the NREMT cognitive exam. Revoke the completion first — that records who did it and why.',
    }
  }

  setState((cur) => ({
    ...cur,
    aemtStudents: cur.aemtStudents.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  }))
  return { ok: true }
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

/**
 * Session kinds that are classroom time.
 *
 * ONE definition, used by earned hours, by the absence cap and by the audit
 * package. The package expressed the same rule inversely (`kind !== 'clinical'`)
 * — identical across today's four kinds and divergent the moment a fifth is
 * added, with the divergent copy being the one that prints for KBEMS.
 */
export const CLASSROOM_KINDS: readonly AemtSessionKind[] = ['didactic', 'lab', 'exam']

/**
 * 'HH:MM' to minutes past midnight, or undefined when it is not a clock time.
 * Shared so the schedule checker and the session form agree on what a time is.
 */
export function parseClock(t: string | undefined): number | undefined {
  const m = /^(\d{2}):(\d{2})$/.exec(t ?? '')
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return undefined
  return h * 60 + min
}

/** Minutes past midnight back to 'HH:MM'. Returns undefined past the day's end. */
export function formatClock(minutes: number): string | undefined {
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 24 * 60) return undefined
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Is this session classroom contact time, as opposed to a clinical rotation? */
export function isClassroomSession(kind: AemtSessionKind): boolean {
  return CLASSROOM_KINDS.includes(kind)
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
      const from = parseClock(s.startTime)
      const to = parseClock(s.endTime)
      if (from === undefined || to === undefined) {
        // A time nobody can parse is a filing error in its own right. Reported
        // rather than skipped: the comparison below used to yield NaN here, and
        // `Math.abs(NaN) > 0.25` is false, so a malformed time passed silently.
        out.push({ sessionId: s.id, text: `${label} has a time that cannot be read` })
      } else if (to <= from) {
        out.push({ sessionId: s.id, text: `${label} ends at or before it starts` })
      } else {
        // Times and hours are filed together, so they have to agree. A quarter
        // hour of slack absorbs rounding without waving through a real gap.
        const span = (to - from) / 60
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

// ----- seeding the KC block plan ---------------------------------------------

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
  const created: AemtSession[] = []
  const pattern = KC_CLASS_PATTERN
  // The first class day on or after the start date anchors the calendar; every
  // other session is offset from it, so the pattern's weekdays are honoured
  // whatever day of the week the course happens to begin.
  const firstDay = onOrAfterWeekday(startISO, pattern.days[0])

  // Minutes already booked on each date. A class day normally carries one
  // session, but where a block's hours run out mid-day the next block starts on
  // the same day and has to begin when the first one ends — not at 09:00 again.
  const dayEnd = new Map<string, number>()

  for (const s of buildClassPlan(pattern)) {
    const offset = pattern.days[s.dayIndex] - pattern.days[0]
    const date = addDays(firstDay, s.week * 7 + offset)
    const startMin = dayEnd.get(date) ?? pattern.startMinute
    // Computed in minutes: an earlier form printed ':30' for any fractional
    // part, so a quarter-hour session filed a time that contradicted its own
    // hours, and anything running past midnight produced '24:00', which is not
    // a time an input will accept.
    const endMin = startMin + Math.round(s.hours * 60)
    dayEnd.set(date, endMin)
    created.push({
      id: uid('asess'),
      courseId,
      date,
      title: s.title,
      kind: s.kind,
      hours: s.hours,
      startTime: formatClock(startMin),
      endTime: formatClock(endMin),
    })
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
  // Derived from the block plan so a course created from these defaults
  // reconciles to zero against the schedule the seeder builds. Typed figures
  // are what made `seedShortfall` report a permanent 20-hour gap on every
  // course: the defaults said 110 didactic and the plan laid out 90.
  didactic: blockPlanTotals().didactic,
  lab: blockPlanTotals().lab,
  clinical: KC_CLINICAL_TARGET,
  field: KC_FIELD_TARGET,
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
      idx >= 0
        ? db.aemtSkillChecks[idx]
        : {
            courseId,
            studentId,
            sheetId,
            // Pinned when the record is created, so a sheet edited mid-course
            // does not retroactively change what a part-graded student was
            // assessed against.
            templateVersion: versionToPin('aemt-skill', sheetId),
            results: {},
          }
    const next = fn(base)
    const list = [...db.aemtSkillChecks]
    if (idx >= 0) list[idx] = next
    else list.push(next)
    return { ...db, aemtSkillChecks: list }
  })
}

/**
 * Grading a sheet after it was signed invalidates the signature.
 *
 * The evaluator attested that every criterion was performed to the standard.
 * Changing what the criteria say afterwards leaves that statement describing a
 * record that no longer exists — the same failure mode `updateShift` guards
 * against for a preceptor's signature. Previously the criteria stayed editable
 * after sign-off and nothing cleared the attestation, so a sheet could carry a
 * recorded critical failure and still satisfy the statutory skills check.
 *
 * The prior signature is not silently dropped: it is written to the audit trail
 * with what changed, and the sheet returns to unsigned so it has to be signed
 * again.
 */
function gradeSheet(
  courseId: string,
  studentId: string,
  sheetId: string,
  actor: string,
  what: string,
  fn: (c: AemtSkillCheck) => AemtSkillCheck,
): void {
  const before = getState().aemtSkillChecks.find(
    (c) => c.courseId === courseId && c.studentId === studentId && c.sheetId === sheetId,
  )
  const invalidate = !!before?.attestation || !!before?.passedDate

  upsertCheck(courseId, studentId, sheetId, (c) => {
    const next = fn(c)
    if (!invalidate) return next
    return { ...next, passedDate: undefined, attestation: undefined }
  })

  if (!invalidate) return
  const who = getState().aemtStudents.find((s) => s.id === studentId)?.name ?? studentId
  audit(
    courseId,
    studentId,
    actor,
    'skill sheet edited — SIGN-OFF INVALIDATED',
    `${who} · ${sheetId} · ${what} · signature by ${before?.attestation?.by ?? 'nobody recorded'} ` +
      `no longer describes this sheet; it must be signed again`,
  )
}

export function setSkillResult(
  courseId: string,
  studentId: string,
  sheetId: string,
  criterionId: string,
  result: 'pass' | 'fail' | null,
  actor = 'local',
): void {
  gradeSheet(
    courseId,
    studentId,
    sheetId,
    actor,
    `criterion ${criterionId} set to ${result ?? 'unassessed'}`,
    (c) => {
      const results = { ...c.results }
      if (result) results[criterionId] = result
      else delete results[criterionId]
      return { ...c, results }
    },
  )
}

/** Mark every criterion on a sheet as passed — the common "clean run" case. */
export function passAllCriteria(
  courseId: string,
  studentId: string,
  sheetId: string,
  criterionIds: string[],
  actor = 'local',
): void {
  gradeSheet(courseId, studentId, sheetId, actor, 'every criterion set to pass', (c) => ({
    ...c,
    results: Object.fromEntries(criterionIds.map((id) => [id, 'pass' as const])),
  }))
}

export function toggleCriticalFailure(
  courseId: string,
  studentId: string,
  sheetId: string,
  text: string,
  actor = 'local',
): void {
  const cur =
    getState().aemtSkillChecks.find(
      (c) => c.courseId === courseId && c.studentId === studentId && c.sheetId === sheetId,
    )?.criticalFailed ?? []
  const clearing = cur.includes(text)
  gradeSheet(
    courseId,
    studentId,
    sheetId,
    actor,
    `critical failure ${clearing ? 'cleared' : 'recorded'}: ${text}`,
    (c) => {
      const list = c.criticalFailed ?? []
      return {
        ...c,
        criticalFailed: list.includes(text) ? list.filter((t) => t !== text) : [...list, text],
      }
    },
  )
}

/** How many criteria on a sheet are recorded as failed — for the overwrite warning. */
export function recordedFailures(c: AemtSkillCheck | undefined): number {
  return Object.values(c?.results ?? {}).filter((r) => r === 'fail').length
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
  // Pin the sheet version at the moment of signing. The evaluator attested to
  // the criteria as they read today; a later edit publishes a new version and
  // this record keeps rendering against the one that was signed.
  const templateVersion = versionToPin('aemt-skill', sheetId)
  upsertCheck(courseId, studentId, sheetId, (c) => ({
    ...c,
    templateVersion: c.templateVersion ?? templateVersion,
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
  reason: string,
): void {
  const before = getState().aemtSkillChecks.find(
    (c) => c.courseId === courseId && c.studentId === studentId && c.sheetId === sheetId,
  )
  upsertCheck(courseId, studentId, sheetId, (c) => ({
    ...c,
    passedDate: undefined,
    attestation: undefined,
  }))
  const who = getState().aemtStudents.find((s) => s.id === studentId)?.name ?? studentId
  audit(
    courseId,
    studentId,
    actor,
    'skill sign-off revoked',
    `${who} · ${sheetId} · signed by ${before?.attestation?.by ?? 'nobody recorded'}` +
      ` · reason: ${reason.trim() || 'not stated'}`,
  )
}

/** A sign-off only counts when an identified evaluator stands behind it. */
export function skillSignoffIsEvidence(c: AemtSkillCheck | undefined): boolean {
  const a = c?.attestation
  return !!c?.passedDate && !!a && !!a.by.trim() && !!a.certNumber.trim() && !!a.actor.trim()
}

/**
 * Signed, but the results recorded on the sheet no longer support it.
 *
 * Grading now invalidates a signature, so this cannot arise from new edits —
 * it catches records written before that rule and rows arriving from sync or an
 * import. Reported rather than silently reclassified, and it does not count
 * toward completion.
 */
export function skillSignoffContradicted(
  c: AemtSkillCheck | undefined,
  allPassed: boolean,
): boolean {
  return !!c?.passedDate && !allPassed
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
  /** Signed by an identified evaluator AND still supported by the results. */
  signedOff: boolean
  /** Carries a signature the recorded results contradict. Never counts. */
  contradicted: boolean
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
    const allPassed = passed === ids.length && failed === 0 && !criticalFailed
    const contradicted = skillSignoffContradicted(check, allPassed)
    return {
      sheet,
      check,
      passed,
      failed,
      total: ids.length,
      criticalFailed,
      allPassed,
      // Both halves are required: an identified signer, and results that still
      // say what the signer attested to.
      signedOff: skillSignoffIsEvidence(check) && !contradicted,
      contradicted,
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
    templateVersion: versionToPin('aemt-form', formId),
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

/**
 * Marks already recorded against a session that a "mark all present" sweep
 * would overwrite — an absence, or a partial-hour credit for a late arrival.
 * Both feed the attendance policy gate, so the caller has to say whether it
 * means to replace them.
 */
export function attendanceOverwrites(
  studentIds: string[],
  sessionId: string,
): AemtAttendanceRecord[] {
  const ids = new Set(studentIds)
  return getState().aemtAttendance.filter(
    (a) =>
      a.sessionId === sessionId &&
      ids.has(a.studentId) &&
      (a.status !== 'present' || a.hours !== undefined),
  )
}

/**
 * Mark a session present for a whole roster.
 *
 * Fills blanks by default. Overwriting is possible but never accidental: it
 * used to replace every record unconditionally, which quietly cleared
 * absences and partial-hour credits — the two things the attendance policy is
 * computed from — with no confirmation and no undo, from a button sitting in
 * every column header of a horizontally scrolling grid.
 */
export function markAllPresent(
  courseId: string,
  studentIds: string[],
  sessionId: string,
  opts: { overwrite?: boolean } = {},
): number {
  const before = getState().aemtAttendance
  const existing = new Set(
    before.filter((a) => a.sessionId === sessionId).map((a) => a.studentId),
  )
  const targets = opts.overwrite ? studentIds : studentIds.filter((id) => !existing.has(id))
  if (targets.length === 0) return 0

  const ids = new Set(targets)
  const replaced = before.filter((a) => ids.has(a.studentId) && a.sessionId === sessionId)
  if (replaced.length > 0) {
    pushUndo(`Marked ${targets.length} present`, () =>
      setState((cur) => ({
        ...cur,
        aemtAttendance: [
          ...cur.aemtAttendance.filter((a) => !(ids.has(a.studentId) && a.sessionId === sessionId)),
          ...replaced,
        ],
      })),
    )
  }

  setState((db) => ({
    ...db,
    aemtAttendance: [
      ...db.aemtAttendance.filter((a) => !(ids.has(a.studentId) && a.sessionId === sessionId)),
      ...targets.map((studentId) => ({
        courseId,
        studentId,
        sessionId,
        status: 'present' as AttendanceStatus,
      })),
    ],
  }))
  return targets.length
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
        // Classroom time only. A session marked 'clinical' is rotation time,
        // and counting it here put it in the classroom total AND again in the
        // clinical total via its attested shift — the same hours reconciled
        // twice against two different filed commitments.
        if (isClassroomSession(s.kind)) earned += creditedHours(s, rec)
        if (rec?.status === 'absent') missed.push(s)
      }
      const classAbsentHours = missed
        .filter((s) => isClassroomSession(s.kind))
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
 * a program total was an assertion rather than something anything added up to.
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
      basis: 'statutory',
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
    basis: 'statutory',
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
      s.id === id
        ? {
            ...s,
            // The signature is written through to the preceptor fields.
            // `supervisorEligible` decides whether a rep counts from
            // `preceptorCredential`, so leaving that untouched while the
            // signature said something else meant eligibility was judged on a
            // field nobody had signed for.
            preceptorName: full.by,
            preceptorCredential: full.credential,
            preceptorCertNumber: full.certNumber || s.preceptorCertNumber,
            attestedAt: full.at,
            attestation: full,
          }
        : s,
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
  // Voided rows stay visible and stop counting. A correction has to be
  // traceable, so nothing is deleted to make a number move.
  if (e.voidedAt) return false
  // K.A.R. 109-11-8 counts successful performances. An attempt is worth
  // recording — remediation is built from them — but it is not a rep.
  // `undefined` predates the distinction and is treated as a success, which is
  // how it was already being counted; those rows are reported separately so
  // the assumption is visible rather than silent.
  if (e.outcome === 'attempt') return false
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

/**
 * Has this performance already been logged? Same shift, same requirement and
 * the same run reference is the same event twice — which is how a count grows
 * without anyone doing anything wrong on purpose.
 */
export function duplicateEncounter(
  encounters: AemtEncounter[],
  candidate: { studentId: string; shiftId?: string; requirementId: string; sourceRef?: string },
): AemtEncounter | undefined {
  const ref = candidate.sourceRef?.trim().toLowerCase()
  if (!ref) return undefined
  return encounters.find(
    (e) =>
      !e.voidedAt &&
      e.studentId === candidate.studentId &&
      e.requirementId === candidate.requirementId &&
      e.shiftId === candidate.shiftId &&
      (e.sourceRef ?? '').trim().toLowerCase() === ref,
  )
}

/** Void a logged rep, keeping it and its reason on the record. */
export function voidEncounter(id: string, actor: string, reason: string): void {
  const e = getState().aemtEncounters.find((x) => x.id === id)
  if (!e) return
  setState((db) => ({
    ...db,
    aemtEncounters: db.aemtEncounters.map((x) =>
      x.id === id
        ? { ...x, voidedAt: new Date().toISOString(), voidedBy: actor, voidReason: reason.trim() || 'not stated' }
        : x,
    ),
  }))
  const who = getState().aemtStudents.find((s) => s.id === e.studentId)?.name ?? e.studentId
  audit(
    e.courseId,
    e.studentId,
    actor,
    'encounter voided',
    `${who} · ${e.requirementId} · ${e.count} rep${e.count === 1 ? '' : 's'} · reason: ${reason.trim() || 'not stated'}`,
  )
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
  /** Recorded but unsuccessful — not a rep, but evidence for remediation. */
  attempts: number
  /** Voided reps, kept for the correction history. */
  voided: number
  /** Counting reps that came from a row representing more than one. */
  unitemized: number
  /** Counting reps whose success was never stated. */
  unstated: number
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
    // The four categories partition the log: counted, voided, attempted, and
    // "logged but not counting" for everything else. `ineligible` used to be
    // simply "whatever encounterCounts rejected", which also swallows voids and
    // attempts — so a single voided rep was reported under two headings at once
    // and a reviewer adding up the annotations got more reps than the log holds.
    const live = rows.filter((e) => !e.voidedAt && e.outcome !== 'attempt')
    const ineligible = live.filter((e) => !eligibleIds.has(e)).reduce((s, e) => s + e.count, 0)
    const unverified = live
      .filter((e) => !e.shiftId || !attestationIsEvidence(byId.get(e.shiftId) ?? ({} as AemtClinicalShift)))
      .reduce((s, e) => s + e.count, 0)
    const field = eligible.filter((e) => e.siteKind === 'field').reduce((s, e) => s + e.count, 0)
    const sub = eligible.filter((e) => e.initiatedInfusion).reduce((s, e) => s + e.count, 0)
    const attempts = rows.filter((e) => e.outcome === 'attempt' && !e.voidedAt).reduce((s, e) => s + e.count, 0)
    const voided = rows.filter((e) => e.voidedAt).reduce((s, e) => s + e.count, 0)
    // Rows standing in for more than one performance, with a single outcome
    // and a single reference across all of them.
    const unitemized = eligible.filter((e) => e.count > 1).reduce((s, e) => s + e.count, 0)
    const unstated = eligible.filter((e) => e.outcome === undefined).reduce((s, e) => s + e.count, 0)
    const totalMet = total >= requirement.minimum
    const fieldMet = field >= (requirement.fieldMinimum ?? 0)
    const subMet = sub >= (requirement.subRequirement?.minimum ?? 0)
    return {
      requirement, total, ineligible, unverified, field, sub,
      attempts, voided, unitemized, unstated,
      totalMet, fieldMet, subMet, met: totalMet && fieldMet && subMet,
    }
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
        return {
          student,
          progress,
          statutory,
          metCount,
          // An empty requirement set is not a student who has met everything.
          complete: statutory.length > 0 && metCount === statutory.length,
        }
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
  /**
   * Where the requirement comes from, and therefore whether it may be
   * bypassed.
   *
   * 'statutory' — imposed by K.A.R. 109-11-8. NOT overrideable. A completion
   *   recorded despite one of these would assert to KBEMS and NREMT that a
   *   student met a requirement they did not, which is the one thing this
   *   screen must never be able to produce.
   * 'program'   — this program's own policy (the attendance cap, the 80%
   *   pass mark, end-of-course evaluations). Overrideable with a documented
   *   reason and named approver.
   */
  basis: 'statutory' | 'program'
}

export interface StudentReadiness {
  student: AemtStudent
  checks: ReadinessCheck[]
  /** Every computable check passes. */
  computedMet: boolean
  /** Ids of checks that do not pass — what an override would have to name. */
  unmet: string[]
  /**
   * Unmet checks imposed by regulation. While this is non-empty the student
   * cannot be completed at all — no override, no approver, no exception.
   */
  blocking: string[]
  /** Unmet program-policy checks, which an override may document past. */
  overrideable: string[]
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
  /**
   * The sheets this course checks off on, already resolved to the version in
   * force. Passed in rather than resolved here so the readiness gate counts the
   * same sheets the Skills tab shows — including any an operation authored or
   * hid, which a bundled lookup would miss.
   */
  sheets: AemtSkillSheet[],
): StudentReadiness[] {
  const students = useStudents(courseId)
  const hours = useStudentHours(courseId)
  const clinical = useClinicalStanding(courseId)
  const checks = useSkillChecks(courseId)
  const responses = useFormResponses(courseId)
  const completions = useCompletions(courseId)
  const targets = useCourse(courseId)?.targets

  return useMemo(() => {
    return students.map((student) => {
      const h = hours.find((x) => x.student.id === student.id)
      const c = clinical.find((x) => x.student.id === student.id)
      const skills = standingFor(checks, student.id, sheets)
      const signed = skills.filter((s) => s.signedOff).length
      const contradicted = skills.filter((s) => s.contradicted).length
      const mine = responses.filter((r) => r.studentId === student.id)
      const open = openConcerns(mine)
      const courseForms = ['instructor-eval', 'course-eval']
      const submitted = courseForms.filter((f) => mine.some((r) => r.formId === f))

      const list: ReadinessCheck[] = [
        {
          id: 'attendance',
          basis: 'program' as const,
          label: 'Attendance within policy',
          // No hours row at all means nothing was computed, which is not the
          // same as being within policy. It asks for an attestation rather than
          // passing on absent data.
          status: !h ? 'attest' : h.classAbsentHours > MAX_ABSENT_HOURS ? 'unmet' : 'met',
          detail: h
            ? `${h.classAbsentHours} h of class missed (limit ${MAX_ABSENT_HOURS})`
            : 'No attendance recorded for this student — nothing to check against the policy',
        },
        // Hours and clinical minimums are different questions. A student can
        // hit every K.A.R. 109-11-8 rep count in half the hours the course
        // filed, and the course still owes those hours.
        ...(targets && h
          ? [hourReadinessCheck(h, targets)]
          : [
              {
                id: 'hours',
                basis: 'statutory' as const,
                label: 'Program hours complete',
                status: 'attest' as const,
                detail: targets
                  ? 'No hours recorded for this student'
                  : 'Course filed no hour targets — nothing to reconcile against',
              },
            ]),
        {
          id: 'clinical',
          basis: 'statutory' as const,
          label: 'Clinical minimums met',
          status: c?.complete ? 'met' : 'unmet',
          detail: c ? `${c.metCount} of ${c.statutory.length} K.A.R. 109-11-8(a)(4) minimums` : '—',
        },
        {
          // K.A.R. 109-11-8(a)(2) — practical skills completed to the primary
          // instructor's satisfaction.
          id: 'skills',
          basis: 'statutory' as const,
          label: 'Psychomotor skills signed off',
          status: signed === sheets.length && sheets.length > 0 ? 'met' : 'unmet',
          detail:
            `${signed} of ${sheets.length} sheets signed off` +
            (contradicted > 0
              ? ` · ${contradicted} signed but contradicted by the recorded results — must be re-signed`
              : '') +
            (monitorSheetId
              ? ''
              : ' · no cardiac monitor selected for this course, so no monitor sheet is required of anyone'),
        },
        {
          id: 'concerns',
          basis: 'program' as const,
          label: 'Remediation and conferences closed',
          status: open.length === 0 ? 'met' : 'unmet',
          detail: open.length === 0 ? 'Nothing open' : `${open.length} still open`,
        },
        {
          id: 'evaluations',
          basis: 'program' as const,
          label: 'End-of-course evaluations submitted',
          status: submitted.length === courseForms.length ? 'met' : 'unmet',
          detail: `${submitted.length} of ${courseForms.length} submitted`,
        },
        {
          id: 'grade',
          basis: 'program' as const,
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
        blocking: list.filter((x) => x.status === 'unmet' && x.basis === 'statutory').map((x) => x.id),
        overrideable: list.filter((x) => x.status === 'unmet' && x.basis === 'program').map((x) => x.id),
        completion: completions.find((x) => x.studentId === student.id),
      }
    })
  }, [students, hours, clinical, checks, responses, completions, monitorSheetId, targets, sheets])
}

/**
 * Record a completion. Refuses to fabricate readiness: if checks are unmet the
 * caller must supply an override, which is stored with the completion and
 * written to the audit log naming exactly which checks were bypassed.
 */
/**
 * When the primary instructor's written verification is due, and whether it
 * still is. K.A.R. 109-11-8 gives 15 days from the final class session, and
 * requires it before the student sits the certification examination.
 */
export function verificationDeadline(sessions: AemtSession[]): {
  finalSession?: string
  dueBy?: string
  daysLeft?: number
  overdue: boolean
} {
  const dated = sessions.filter((s) => s.date).map((s) => s.date).sort()
  const finalSession = dated[dated.length - 1]
  if (!finalSession) return { overdue: false }
  const dueBy = addDays(finalSession, INSTRUCTOR_VERIFICATION_DAYS)
  const daysLeft = Math.round(
    (fromISODate(dueBy).getTime() - fromISODate(todayISO()).getTime()) / 86_400_000,
  )
  return { finalSession, dueBy, daysLeft, overdue: daysLeft < 0 }
}

/**
 * Record a completion.
 *
 * Refuses outright when a statutory check is unmet. An override can document
 * a departure from this program's own policy; it cannot assert to KBEMS that
 * a student met K.A.R. 109-11-8 when they did not. Callers must pass the
 * blocking list so the refusal is decided here, not in whichever screen
 * happens to call it.
 */
export function recordCompletion(
  courseId: string,
  studentId: string,
  input: {
    verifiedBy: string
    /** The course's named primary instructor, for the role check. */
    primaryInstructor?: string
    finalGradePercent: number
    /**
     * Statutory checks that have not passed. REQUIRED — an optional list meant
     * a caller that simply forgot it got a completion recorded past unmet
     * statutory requirements with no refusal and nothing in the audit trail.
     * Pass an empty array to assert there are none.
     */
    blocking: string[]
    override?: { reason: string; approver: string; unmetChecks: string[] }
  },
): { ok: boolean; refused?: string } {
  if (input.blocking.length > 0) {
    return {
      ok: false,
      refused: `Statutory requirements are unmet: ${input.blocking.join(', ')}. These cannot be overridden.`,
    }
  }
  // Grade is attested rather than computed, but it is still a number with a
  // policy attached. Decided here rather than trusting whichever screen calls
  // in: below the pass mark it needs a documented override, same as any other
  // program-policy departure.
  if (!Number.isFinite(input.finalGradePercent) ||
      input.finalGradePercent < 0 ||
      input.finalGradePercent > 100) {
    return { ok: false, refused: 'The final course grade must be a percentage between 0 and 100.' }
  }
  if (input.finalGradePercent < MIN_PASSING_PERCENT && !input.override) {
    return {
      ok: false,
      refused:
        `The final grade of ${input.finalGradePercent}% is below the ${MIN_PASSING_PERCENT}% pass mark. ` +
        'Recording completion anyway requires a documented override with a named approver.',
    }
  }
  const named = input.primaryInstructor?.trim().toLowerCase()
  const verifier = input.verifiedBy.trim().toLowerCase()
  const verifierMismatch = !!named && named !== verifier
  const completion: AemtCompletion = {
    courseId,
    studentId,
    completedDate: todayISO(),
    verifiedBy: input.verifiedBy,
    verifierMismatch,
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
  if (verifierMismatch) {
    audit(
      courseId,
      studentId,
      input.verifiedBy,
      'completion verified by someone other than the primary instructor',
      `${name} · verified by ${input.verifiedBy} · primary instructor of record is ${input.primaryInstructor}`,
    )
  }
  audit(
    courseId,
    studentId,
    input.verifiedBy,
    input.override ? 'completion recorded WITH OVERRIDE' : 'completion recorded',
    input.override
      ? `${name} · grade ${input.finalGradePercent}% · bypassed: ${input.override.unmetChecks.join(', ')} · approved by ${input.override.approver} · reason: ${input.override.reason}`
      : `${name} · grade ${input.finalGradePercent}% · all readiness checks met`,
  )
  return { ok: true }
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

// ----- cohort selection -------------------------------------------------------
//
// Employment-selection data, kept in the same store so scoring is consistent
// and the records survive, but NOT program records: retention is the employer's
// HR schedule, not the three-year K.A.R. 109-17-3 clock.

export function useCandidates(courseId: string | undefined): AemtCandidate[] {
  return useSelector((db) =>
    db.aemtCandidates
      .filter((c) => c.courseId === courseId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
}

export function addCandidate(
  courseId: string,
  name: string,
  employeeNumber?: string,
  email?: string,
): AemtCandidate {
  const candidate: AemtCandidate = {
    id: uid('acand'),
    courseId,
    name,
    employeeNumber,
    // Lowercased to match how exam_start normalises it, so the join works.
    email: email?.trim().toLowerCase() || undefined,
    gates: {},
    createdAt: new Date().toISOString(),
  }
  setState((db) => ({ ...db, aemtCandidates: [...db.aemtCandidates, candidate] }))
  return candidate
}

/**
 * Attach selection-exam results to candidates, matched by email.
 *
 * Email is the only join available: the exam is a public no-login form and
 * exam_attempts carries nothing else that identifies a person. A candidate
 * with no email, or whose email does not match the one they sat under, simply
 * goes unmatched and is reported rather than guessed at — matching on a name
 * would eventually attach one person's score to another's record.
 */
export async function pullExamResults(courseId: string): Promise<{
  matched: number
  unmatched: string[]
  noEmail: string[]
  error?: string
}> {
  const { rows, error } = await listExamResults()
  if (error) return { matched: 0, unmatched: [], noEmail: [], error }

  // Remote rows are not trusted to have the shape they are typed with: a null
  // email threw and failed the whole pull. Where somebody sat the exam twice,
  // the better attempt wins rather than whichever row came back last — an
  // arbitrary ordering deciding a selection score is not a defensible tiebreak.
  const byEmail = new Map<string, { percent: number | null }>()
  for (const r of rows ?? []) {
    const email = typeof r?.email === 'string' ? r.email.trim().toLowerCase() : ''
    if (!email) continue
    const percent = typeof r.percent === 'number' ? r.percent : null
    const prev = byEmail.get(email)
    if (!prev || prev.percent == null || (percent != null && percent > prev.percent)) {
      byEmail.set(email, { percent })
    }
  }

  const candidates = getState().aemtCandidates.filter((c) => c.courseId === courseId)
  const noEmail: string[] = []
  const unmatched: string[] = []
  const patches = new Map<string, number>()

  for (const c of candidates) {
    if (!c.email) {
      noEmail.push(c.name)
      continue
    }
    const hit = byEmail.get(c.email)
    if (!hit || hit.percent == null) {
      unmatched.push(c.name)
      continue
    }
    patches.set(c.id, hit.percent)
  }

  if (patches.size) {
    const now = todayISO()
    setState((db) => ({
      ...db,
      aemtCandidates: db.aemtCandidates.map((c) =>
        patches.has(c.id) ? { ...c, examPercent: patches.get(c.id), examPulledAt: now } : c,
      ),
    }))
  }
  return { matched: patches.size, unmatched, noEmail }
}

export function updateCandidate(id: string, patch: Partial<AemtCandidate>): void {
  setState((db) => ({
    ...db,
    aemtCandidates: db.aemtCandidates.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  }))
}

export function deleteCandidate(id: string): void {
  setState((db) => {
    const c = db.aemtCandidates.find((x) => x.id === id)
    if (c) pushUndo(`Removed ${c.name}`, () => setState((cur) => ({ ...cur, aemtCandidates: [...cur.aemtCandidates, c] })))
    return { ...db, aemtCandidates: db.aemtCandidates.filter((x) => x.id !== id) }
  })
}

/**
 * Record one interviewer's scores. Replaces that scorer's previous entry and
 * leaves everyone else's alone — two interviewers score independently, and one
 * overwriting the other would defeat the point.
 */
export function recordInterview(
  candidateId: string,
  scorer: string,
  scores: Record<string, number>,
  notes?: Record<string, string>,
): void {
  const entry: AemtInterviewScore = { scorer, at: new Date().toISOString(), scores, notes }
  setState((db) => ({
    ...db,
    aemtCandidates: db.aemtCandidates.map((c) =>
      c.id === candidateId
        ? { ...c, interviews: [...(c.interviews ?? []).filter((i) => i.scorer !== scorer), entry] }
        : c,
    ),
  }))
}

export interface CandidateScore {
  /** Percentage per weighted component; undefined = not yet scored. */
  test?: number
  interview?: number
  qa?: number
  attendance?: number
  /**
   * Weighted total out of 100. An unscored component contributes nothing rather
   * than being normalised away, so a partially-scored candidate scores LOW, not
   * proportionally — which is why `complete` exists and why the list sorts
   * cleared candidates above everyone else. Reading this as a comparable score
   * before `complete` is true compares a full candidate against a partial one.
   */
  base: number
  bonus: number
  composite: number
  /** True only when every weighted component has been scored. */
  complete: boolean
  /** Raw interview total out of 30, averaged across interviewers. */
  interviewRaw?: number
  /** Per-section test percentages. */
  sections: { id: string; label: string; pct?: number; floor?: number; scored: boolean; met: boolean }[]
  /** Everything blocking advancement, in the order it should be read. */
  blockers: string[]
  gatesMet: boolean
}

/**
 * Score a candidate against the model in data/aemtSelection.
 *
 * Partial scores are reported rather than assumed: a candidate with no
 * interview yet has an incomplete composite, not a low one, and the
 * distinction matters when four seats are being filled from a small field.
 */
export function scoreCandidate(c: AemtCandidate): CandidateScore {
  const sections = TEST_SECTIONS.map((s) => {
    const raw = c.testMarks?.[s.id]
    const pct = typeof raw === 'number' ? (raw / s.marks) * 100 : undefined
    return {
      id: s.id,
      label: s.label,
      pct,
      floor: s.floor,
      /** Whether this supplement was administered at all. */
      scored: pct !== undefined,
      // Unscored means nothing to fail, not a failure.
      met: s.floor === undefined || pct === undefined || pct >= s.floor,
    }
  })

  // The online exam is the selection test. Hand-entered section marks are a
  // supplement and only stand in where no attempt exists — see the header of
  // data/aemtSelection.ts for why this narrowed.
  const anyMarks = TEST_SECTIONS.some((s) => typeof c.testMarks?.[s.id] === 'number')
  const testTotal = TEST_SECTIONS.reduce((n, s) => n + (c.testMarks?.[s.id] ?? 0), 0)
  const test =
    typeof c.examPercent === 'number'
      ? c.examPercent
      : anyMarks
        ? (testTotal / TEST_TOTAL_MARKS) * 100
        : undefined

  const iv = c.interviews ?? []
  const totals = iv.map((i) => Object.values(i.scores).reduce((n, v) => n + v, 0))
  const interviewRaw = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : undefined
  const interview = interviewRaw === undefined ? undefined : (interviewRaw / INTERVIEW_MAX) * 100

  const parts: Record<string, number | undefined> = {
    test,
    interview,
    qa: c.qaPercent,
    attendance: c.attendancePercent,
  }
  const base = SELECTION_WEIGHTS.reduce(
    (n, w) => n + ((parts[w.id] ?? 0) * w.weight) / 100,
    0,
  )
  const bonus = BONUS_TIERS.find((b) => b.id === (c.bonusTier ?? 'none'))?.points ?? 0
  const complete = SELECTION_WEIGHTS.every((w) => typeof parts[w.id] === 'number')

  const gateIds = ELIGIBILITY_GATES.map((g) => g.id)
  const gatesMet = gateIds.every((g) => c.gates[g] === true)

  const blockers: string[] = []
  if (!gatesMet) {
    const failed = ELIGIBILITY_GATES.filter((g) => c.gates[g.id] !== true).map((g) => g.label)
    blockers.push(`Eligibility not met: ${failed.join(', ')}`)
  }
  // A floor binds only on a section that was actually administered. Blocking a
  // candidate for an unscored floor made every candidate un-advanceable, since
  // the supplementary sections are not delivered by the online exam — a gate
  // on a test nobody sat is not a gate, it is an outage.
  for (const s of sections) {
    if (s.pct !== undefined && !s.met) {
      blockers.push(`${s.label} at ${s.pct.toFixed(0)}%, below its ${s.floor}% floor`)
    }
  }
  if (test !== undefined && test < THRESHOLDS.test) {
    blockers.push(`Selection test at ${test.toFixed(0)}%, below ${THRESHOLDS.test}%`)
  }
  if (interviewRaw !== undefined && interviewRaw < THRESHOLDS.interview) {
    blockers.push(
      `Interview at ${interviewRaw.toFixed(1)}/${INTERVIEW_MAX}, below ${THRESHOLDS.interview}`,
    )
  }
  const composite = base + bonus
  if (complete && composite < THRESHOLDS.composite) {
    blockers.push(`Composite at ${composite.toFixed(1)}, below ${THRESHOLDS.composite}`)
  }
  if (!complete) blockers.push('Not all components scored yet')

  return { test, interview, qa: c.qaPercent, attendance: c.attendancePercent, base, bonus, composite, complete, interviewRaw, sections, blockers, gatesMet }
}

/** Two interviewers differing by 2+ on a question must discuss, not average. */
export function interviewDisagreements(c: AemtCandidate): { questionId: string; spread: number }[] {
  const iv = c.interviews ?? []
  if (iv.length < 2) return []
  return INTERVIEW_QUESTIONS.map((q) => {
    const vals = iv.map((i) => i.scores[q.id]).filter((v): v is number => typeof v === 'number')
    const spread = vals.length < 2 ? 0 : Math.max(...vals) - Math.min(...vals)
    return { questionId: q.id, spread }
  }).filter((d) => d.spread >= 2)
}
