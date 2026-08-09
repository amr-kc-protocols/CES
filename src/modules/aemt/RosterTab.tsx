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
import { useCan } from '../../lib/role'
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

  const save = () => {
    const patch = {
      name: name.trim(),
      certNumber: certNumber.trim() || undefined,
      employeeNumber: employeeNumber.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
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
  const readiness = useStudentReadiness(course.id, course.monitorSheetId)
  const completions = useCompletions(course.id)

  return (
    <div>
      <CourseSetupPanel course={course} canEdit={manageAcademy} />

      <div className="section-title">Roster</div>
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
                  {s.certNumber ? `Cert #${s.certNumber}` : 'No cert # on file'}
                  {s.employeeNumber && <> · Emp #{s.employeeNumber}</>}
                </div>
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
