import { useState } from 'react'
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
import { CAMPUS_LABEL } from '../../data/aemt'
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

  const save = () => {
    const patch = {
      name: name.trim(),
      certNumber: certNumber.trim() || undefined,
      employeeNumber: employeeNumber.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      campus,
      status,
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
