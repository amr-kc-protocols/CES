import { useState } from 'react'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
import { confirmAction, notifyUser } from '../../lib/dialog'
import { Empty, Modal } from '../../components/ui'
import {
  useStudents,
  useStudentReadiness,
  useCompletions,
  addStudent,
  updateStudent,
  deleteStudent,
  studentRecordCount,
} from './aemtStore'
import CompletionPanel from './CompletionPanel'
import CourseSetupPanel from './CourseSetupPanel'
import { useAemtForms, useSheetsForCourse } from '../templates/resolve'
import ConferencePanel from './ConferencePanel'
import { useConferences } from './aemtStore'
import { useCan } from '../../lib/role'
import { CAMPUS_LABEL, MAX_ABSENT_HOURS } from '../../data/aemt'
import { todayISO } from '../../lib/date'
import { daysLabel, patternLabel, workConflicts } from './workPattern'
import { useSessions } from './aemtStore'
import { MARKETS } from '../../lib/market'
import type { Market } from '../../lib/market'
import type { AemtCourse, AemtStudent, AemtStudentStatus } from '../../types'

const STATUS_PILL: Record<AemtStudentStatus, string> = {
  active: 'info',
  completed: 'ok',
  withdrawn: 'muted',
}

function StudentForm({
  courseId,
  existing,
  hasCompletion,
  onClose,
}: {
  courseId: string
  existing?: AemtStudent
  /** A verified completion is on file, so status is not editable here. */
  hasCompletion: boolean
  onClose: () => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [certNumber, setCert] = useState(existing?.certNumber ?? '')
  const [employeeNumber, setEmp] = useState(existing?.employeeNumber ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [status, setStatus] = useState<AemtStudentStatus>(existing?.status ?? 'active')
  const [campus, setCampus] = useState<Market>(existing?.campus ?? 'kc')

  // The work line. Kept in one local state object because it is saved or
  // cleared as a unit — a half-entered line is worse than none, since every
  // screen that reads one treats it as the truth about when this student is
  // unavailable.
  const wp = existing?.workPattern
  const [line, setLine] = useState(wp?.line ?? '')
  const [los, setLos] = useState(wp?.los ?? '')
  const [shiftStart, setShiftStart] = useState(wp?.startTime ?? '')
  const [shiftEnd, setShiftEnd] = useState(wp?.endTime ?? '')
  const [shiftType, setShiftType] = useState(wp?.shiftType ?? '')
  const [anchorSunday, setAnchor] = useState(wp?.anchorSunday ?? '')
  const [weekOne, setWeekOne] = useState<number[]>(wp?.weekOne ?? [])
  const [weekTwo, setWeekTwo] = useState<number[]>(wp?.weekTwo ?? [])
  const [sameBothWeeks, setSameBothWeeks] = useState(
    !wp || daysLabel(wp.weekOne) === daysLabel(wp.weekTwo),
  )
  const lineStarted = !!(line || shiftStart || shiftEnd || weekOne.length)
  const lineComplete = !!(shiftStart && shiftEnd && weekOne.length && anchorSunday)

  const toggleDay = (week: 1 | 2, d: number) => {
    const [days, set] = week === 1 ? [weekOne, setWeekOne] : [weekTwo, setWeekTwo]
    set(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b))
  }

  const save = () => {
    const patch = {
      name: name.trim(),
      certNumber: certNumber.trim() || undefined,
      employeeNumber: employeeNumber.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      campus,
      status,
      workPattern: lineComplete
        ? {
            line: line.trim() || undefined,
            los: los.trim() || undefined,
            startTime: shiftStart,
            endTime: shiftEnd,
            shiftType: shiftType.trim() || undefined,
            weekOne,
            weekTwo: sameBothWeeks ? weekOne : weekTwo,
            anchorSunday,
            updatedOn: todayISO(),
          }
        : undefined,
    }
    if (existing) {
      const res = updateStudent(existing.id, patch)
      if (!res.ok) {
        notifyUser(res.refused ?? 'That change was refused.', 'crit')
        return
      }
    } else {
      addStudent(courseId, patch.name, patch)
    }
    onClose()
  }

  return (
    <Modal title={existing ? 'Edit student' : 'Add student'} onClose={onClose}>
      <div className="field">
        <label htmlFor="as-name">Name</label>
        <input
          id="as-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Last, First"
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="as-cert">Kansas EMS cert #</label>
          <input id="as-cert" value={certNumber} onChange={(e) => setCert(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="as-emp">Employee # (if AMR)</label>
          <input id="as-emp" value={employeeNumber} onChange={(e) => setEmp(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="as-email">Email</label>
          <input id="as-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="as-phone">Phone</label>
          <input id="as-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="as-campus">Campus</label>
        <select
          id="as-campus"
          value={campus}
          onChange={(e) => setCampus(e.target.value as Market)}
        >
          {MARKETS.map((mk) => (
            <option key={mk.id} value={mk.id}>
              {mk.short}
            </option>
          ))}
        </select>
        <div className="help-text">
          Which operation this student rotates through. The classroom is shared on a joint
          cohort; clinical and field placement is not, so this decides which hospital and which
          ambulance service they can be booked at. It does not change what they are taught or the
          standard they are held to.
        </div>
      </div>
      {existing && (
        <div className="field">
          <label htmlFor="as-status">Status</label>
          <select
            id="as-status"
            value={status}
            disabled={hasCompletion}
            onChange={(e) => setStatus(e.target.value as AemtStudentStatus)}
          >
            <option value="active">Active</option>
            <option value="withdrawn">Withdrawn</option>
            {existing.status === 'completed' && <option value="completed">Completed</option>}
          </select>
          <div className="help-text">
            {hasCompletion ? (
              <>
                This student has a <strong>verified completion</strong> on file, so status is not
                editable here — moving them off Completed would leave that record in place while the
                roster said otherwise. Use <strong>Revoke</strong> in Completion readiness below,
                which records who did it and why.
              </>
            ) : (
              <>
                Completed is set by verifying readiness below, not chosen here — it is what makes a
                student eligible to sit the NREMT cognitive exam.
              </>
            )}
          </div>
        </div>
      )}
      {/* The work line.
          Every one of these students is a working EMT on a bid line and the
          course is scheduled on top of it. Recording the line is what lets the
          program see, in week 0, which class hours it costs them — and stops
          the placement board booking a twelve-hour rotation onto a day they
          already work twelve. */}
      <div className="section-title">Regular AMR work line</div>
      <div className="help-text" style={{ marginTop: 0, marginBottom: 8 }}>
        Class runs Tuesday and Thursday 0900–1300 and the rotation is 12-hour shifts on top of
        both. Recording the line is how that arithmetic gets done before the course starts rather
        than in week six.
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="as-line">Unit / line</label>
          <input id="as-line" value={line} onChange={(e) => setLine(e.target.value)} placeholder="KC105" />
        </div>
        <div className="field">
          <label htmlFor="as-los">Level</label>
          <input id="as-los" value={los} onChange={(e) => setLos(e.target.value)} placeholder="ALS" />
        </div>
        <div className="field">
          <label htmlFor="as-stype">Shift type</label>
          <input id="as-stype" value={shiftType} onChange={(e) => setShiftType(e.target.value)} placeholder="1236" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="as-sstart">On duty</label>
          <input id="as-sstart" type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="as-send">Off duty</label>
          <input id="as-send" type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
        </div>
      </div>
      {shiftStart && shiftEnd && shiftEnd <= shiftStart && (
        <div className="help-text">
          Read as crossing midnight — {shiftStart} to {shiftEnd} the following day.
        </div>
      )}

      <div className="field">
        <label htmlFor="as-anchor">Sunday that begins week one</label>
        <input id="as-anchor" type="date" value={anchorSunday} onChange={(e) => setAnchor(e.target.value)} />
        <div className="help-text">
          A two-week line has no meaning without one. Any Sunday the student knows was a week one.
        </div>
      </div>

      <div className="field">
        <label>Days worked{sameBothWeeks ? '' : ' — week one'}</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {DAY_NAMES.map((d, i) => (
            <button
              key={d}
              type="button"
              className={`choice${weekOne.includes(i) ? ' active' : ''}`}
              style={{ flex: 1, padding: '6px 2px' }}
              aria-pressed={weekOne.includes(i)}
              onClick={() => toggleDay(1, i)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <label className="check-row" style={{ display: 'block', margin: '6px 0 8px' }}>
        <input
          type="checkbox"
          checked={sameBothWeeks}
          onChange={(e) => setSameBothWeeks(e.target.checked)}
        />{' '}
        Both weeks of the rotation are the same
      </label>

      {!sameBothWeeks && (
        <div className="field">
          <label>Days worked — week two</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {DAY_NAMES.map((d, i) => (
              <button
                key={d}
                type="button"
                className={`choice${weekTwo.includes(i) ? ' active' : ''}`}
                style={{ flex: 1, padding: '6px 2px' }}
                aria-pressed={weekTwo.includes(i)}
                onClick={() => toggleDay(2, i)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {lineStarted && !lineComplete && (
        <div className="banner warn">
          A partly-entered line is not saved. On duty, off duty, at least one day and the week-one
          Sunday are all needed — every screen that reads a line treats it as the truth about when
          this student is unavailable.
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={!name.trim()} onClick={save}>
          {existing ? 'Save' : 'Add student'}
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        {existing && (
          <button
            className="btn danger"
            style={{ marginLeft: 'auto' }}
            onClick={async () => {
              const n = studentRecordCount(existing.id)
              const ok = await confirmAction({
                title: `Remove ${existing.name}?`,
                body:
                  `This deletes ${n} linked record${n === 1 ? '' : 's'} — attendance, clinical ` +
                  `encounters, skill check-offs and evaluations. Course records are normally ` +
                  `kept: set status to Withdrawn instead unless this student was added by mistake.`,
                confirmLabel: 'Remove student',
              })
              if (ok) {
                deleteStudent(existing.id)
                onClose()
              }
            }}
          >
            Remove
          </button>
        )}
      </div>
    </Modal>
  )
}

export default function RosterTab({ course }: { course: AemtCourse }) {
  const students = useStudents(course.id)
  const { manageAemt: manageAcademy } = useCan()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AemtStudent | null>(null)
  const sheets = useSheetsForCourse(course.monitorSheetId)
  const forms = useAemtForms()
  const conferences = useConferences(course.id)
  const sessions = useSessions(course.id)
  // What each student's line costs them, computed once for the whole roster.
  const conflicts = students.map((st) => workConflicts(st, sessions, MAX_ABSENT_HOURS))
  const overCap = conflicts.filter((c) => c.overCap)
  const noLine = students.filter((st) => !st.workPattern)
  const readiness = useStudentReadiness(course.id, course.monitorSheetId, sheets, forms)
  const completions = useCompletions(course.id)
  // Campus is only worth showing on a cohort that actually has two. On a
  // single-market course it is noise on every row.
  const campuses = [...new Set(students.map((s) => s.campus ?? 'kc'))].sort()

  return (
    <div>
      <CourseSetupPanel course={course} canEdit={manageAcademy} />

      <div className="section-title">Roster</div>
      {campuses.length > 1 && (
        <div className="banner info">
          <strong>Joint cohort.</strong>{' '}
          {campuses
            .map((c) => `${students.filter((s) => (s.campus ?? 'kc') === c).length} ${CAMPUS_LABEL[c]}`)
            .join(' · ')}
          . One class, one schedule, one standard — but clinical and field placement is local to
          each operation, so every student's campus decides which sites the placement board will
          book them at.
        </div>
      )}
      {/* The line-versus-class arithmetic, stated once at the top.
          This is the finding that made work lines worth recording at all: a
          student whose bid line covers class hours is over the absence cap
          before the first session, and nobody could see it because the two
          schedules lived in different places. */}
      {overCap.length > 0 && (
        <div className="banner crit">
          <strong>
            {overCap.length} student{overCap.length === 1 ? '' : 's'} cannot attend this schedule on
            their current line
          </strong>{' '}
          — class is Tuesday and Thursday 0900–1300, and their shifts cover it:
          <div style={{ marginTop: 6 }}>
            {overCap.map((c) => (
              <div key={c.student.id}>
                • {c.student.name} — {c.hoursLost} h of class lost, against an {MAX_ABSENT_HOURS} h
                cap
              </div>
            ))}
          </div>
          <div style={{ marginTop: 6 }}>
            Each needs a line change, a shift trade for class days, or a documented make-up for
            every session. This is a scheduling decision, not an attendance problem — it does not
            resolve itself.
          </div>
        </div>
      )}
      {students.length > 0 && noLine.length > 0 && (
        <div className="banner warn">
          {noLine.length} of {students.length} student{students.length === 1 ? ' has' : 's have'} no
          work line recorded, so nothing has been checked for {noLine.length === 1 ? 'them' : 'them'}
          : {noLine.map((s) => s.name).join(', ')}.
        </div>
      )}

      {manageAcademy && (
        <div className="toolbar">
          <div className="spacer" />
          <button className="btn primary" onClick={() => setAdding(true)}>
            + Add student
          </button>
        </div>
      )}

      {students.length === 0 ? (
        <Empty icon="🧑‍🚒" title="No students yet">
          {manageAcademy
            ? 'Add the students enrolled in this course.'
            : 'The Clinical Educator manages the roster.'}
        </Empty>
      ) : (
        <div className="list" style={{ marginTop: 12 }}>
          {students.map((s) => (
            <div key={s.id} className="row">
              <div className="grow">
                <div className="title">
                  {s.name}
                  {s.status !== 'active' && (
                    <span className={`pill ${STATUS_PILL[s.status]}`} style={{ marginLeft: 8 }}>
                      {s.status}
                    </span>
                  )}
                </div>
                <div className="meta">
                  {campuses.length > 1 && <>{CAMPUS_LABEL[s.campus ?? 'kc']} · </>}
                  {s.certNumber ? `Cert #${s.certNumber}` : 'No cert # on file'}
                  {s.employeeNumber && <> · Emp #{s.employeeNumber}</>}
                </div>
                {(() => {
                  const wc = conflicts.find((c) => c.student.id === s.id)
                  if (!wc?.pattern) {
                    return (
                      <div className="meta" style={{ color: 'var(--warn)' }}>
                        No work line recorded — nothing to check the class schedule against
                      </div>
                    )
                  }
                  return (
                    <div className="meta" style={{ color: wc.overCap ? 'var(--crit)' : undefined }}>
                      {patternLabel(wc.pattern)}
                      {wc.clashes.length > 0 && (
                        <>
                          {' · '}
                          {wc.hoursLost} h of class lost across {wc.clashes.length} session
                          {wc.clashes.length === 1 ? '' : 's'}
                          {wc.overCap && ` — over the ${MAX_ABSENT_HOURS} h cap`}
                        </>
                      )}
                    </div>
                  )
                })()}
                {(() => {
                  const n = conferences.filter((c) => c.studentId === s.id).length
                  return (
                    <div className="meta" style={{ color: n ? undefined : 'var(--warn)' }}>
                      {n
                        ? `${n} progress conference${n === 1 ? '' : 's'} documented`
                        : 'No progress conference documented'}
                    </div>
                  )
                })()}
              </div>
              {manageAcademy && (
                <button className="btn sm" onClick={() => setEditing(s)}>
                  Edit
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {students.length > 0 && (
        <ConferencePanel course={course} students={students} canEdit={manageAcademy} />
      )}

      {students.length > 0 && (
        <CompletionPanel course={course} readiness={readiness} canEdit={manageAcademy} />
      )}

      {adding && (
        <StudentForm courseId={course.id} hasCompletion={false} onClose={() => setAdding(false)} />
      )}
      {editing && (
        <StudentForm
          courseId={course.id}
          existing={editing}
          hasCompletion={completions.some((c) => c.studentId === editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
