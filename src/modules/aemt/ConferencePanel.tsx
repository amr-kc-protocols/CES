import { useState } from 'react'
import { Modal } from '../../components/ui'
import { confirmAction } from '../../lib/dialog'
import { formatDate, todayISO } from '../../lib/date'
import {
  CONFERENCE_REASONS,
  deleteConference,
  recordConference,
  useConferences,
  useRecordSafety,
} from './aemtStore'
import type { AemtConference, AemtCourse, AemtStudent } from '../../types'

// ---------------------------------------------------------------------------
// Documented private progress conferences.
//
// K.A.R. 109-17-3 retains these and the syllabus commits to at least one per
// student. Before this they were listed as a record "kept elsewhere", which
// meant nothing could say which students had had one — so the commitment was
// only ever checkable by asking the person who held them to remember.
//
// The notes are the record. A conference logged as a date and a tick tells a
// reviewer that a meeting was scheduled, which is not what the regulation is
// asking about, so the form refuses a description too short to be one.
// ---------------------------------------------------------------------------

function ConferenceModal({
  course,
  students,
  actor,
  onClose,
}: {
  course: AemtCourse
  students: AemtStudent[]
  actor: string
  onClose: () => void
}) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [date, setDate] = useState(todayISO())
  const [attendees, setAttendees] = useState(actor === 'local' ? '' : actor)
  const [reason, setReason] = useState<AemtConference['reason']>('scheduled')
  const [discussed, setDiscussed] = useState('')
  const [agreed, setAgreed] = useState('')
  const [followUpBy, setFollowUpBy] = useState('')
  const [refused, setRefused] = useState<string | null>(null)
  const valid = studentId && discussed.trim().length >= 8 && attendees.trim() !== ''

  return (
    <Modal title="Document a progress conference" onClose={onClose}>
      <div className="field-row" style={{ marginTop: 0 }}>
        <div className="field">
          <label htmlFor="cf-student">Student</label>
          <select id="cf-student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cf-date">Date held</label>
          <input id="cf-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="cf-reason">Why it was held</label>
        <select
          id="cf-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as AemtConference['reason'])}
        >
          {CONFERENCE_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="cf-att">Who was present, besides the student</label>
        <input
          id="cf-att"
          value={attendees}
          onChange={(e) => setAttendees(e.target.value)}
          placeholder="Primary instructor; Program Manager"
        />
      </div>

      <div className="field">
        <label htmlFor="cf-disc">What was discussed</label>
        <textarea
          id="cf-disc"
          value={discussed}
          onChange={(e) => setDiscussed(e.target.value)}
          placeholder="Gate 2 at 74%, below the 80% standard. Walked through the item analysis: pharmacology and shock, both weak on the retrieval quizzes as well. Student said the pre-class modules are being done the night before rather than across the week."
        />
        <div className="help-text">
          This is the record a reviewer reads. No patient identifiers — a conference note is about
          the student, not about a call.
        </div>
      </div>

      <div className="field">
        <label htmlFor="cf-agreed">What was agreed</label>
        <textarea
          id="cf-agreed"
          value={agreed}
          onChange={(e) => setAgreed(e.target.value)}
          placeholder="Modules moved to two sessions a week. Retest 14 Dec. Check back after the next retrieval quiz."
        />
      </div>

      <div className="field">
        <label htmlFor="cf-follow">Follow up by</label>
        <input
          id="cf-follow"
          type="date"
          value={followUpBy}
          onChange={(e) => setFollowUpBy(e.target.value)}
        />
      </div>

      {refused && <div className="banner crit">{refused}</div>}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!valid}
          onClick={() => {
            const res = recordConference(course.id, studentId, {
              date,
              attendees,
              reason,
              discussed,
              agreed: agreed || undefined,
              followUpBy: followUpBy || undefined,
              actor,
            })
            if (!res.ok) {
              setRefused(res.refused ?? 'Could not record it.')
              return
            }
            onClose()
          }}
        >
          Record it
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

export default function ConferencePanel({
  course,
  students,
  canEdit,
}: {
  course: AemtCourse
  students: AemtStudent[]
  canEdit: boolean
}) {
  const conferences = useConferences(course.id)
  const safety = useRecordSafety()
  const [adding, setAdding] = useState(false)
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? 'Unknown'
  const reasonOf = (r: AemtConference['reason']) =>
    CONFERENCE_REASONS.find((x) => x.value === r)?.label ?? r
  const without = students.filter((s) => !conferences.some((c) => c.studentId === s.id))

  return (
    <>
      <div className="section-title">
        Progress conferences
        {conferences.length > 0 && (
          <span className="pill ok" style={{ marginLeft: 8 }}>
            {conferences.length}
          </span>
        )}
      </div>

      <div className={`banner ${without.length ? 'warn' : 'ok'}`} style={{ marginTop: 0 }}>
        {without.length ? (
          <>
            <strong>
              {without.length} student{without.length === 1 ? '' : 's'} with no documented
              conference:
            </strong>{' '}
            {without.map((s) => s.name).join(', ')}. The syllabus commits to at least one private
            conference each, and K.A.R. 109-17-3 retains the record for three years.
          </>
        ) : (
          <>✓ Every student has at least one documented conference on file.</>
        )}
      </div>

      {canEdit && (
        <div className="toolbar">
          <div className="spacer" />
          <button className="btn primary" onClick={() => setAdding(true)}>
            + Document a conference
          </button>
        </div>
      )}

      {conferences.length > 0 && (
        <div className="list">
          {conferences.map((c) => (
            <div key={c.id} className="row left-accent acc-ok">
              <div className="grow">
                <div className="title">{nameOf(c.studentId)}</div>
                <div className="meta">
                  {formatDate(c.date)} · {reasonOf(c.reason)} · with {c.attendees}
                  {c.followUpBy && ` · follow up by ${formatDate(c.followUpBy)}`}
                </div>
                <div className="help-text">{c.discussed}</div>
                {c.agreed && (
                  <div className="help-text">
                    <strong>Agreed:</strong> {c.agreed}
                  </div>
                )}
              </div>
              {canEdit && (
                <button
                  className="btn sm danger"
                  aria-label={`Delete the conference record for ${nameOf(c.studentId)}`}
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: 'Delete this conference record?',
                      body:
                        'It is a program record retained for three years under K.A.R. 109-17-3. ' +
                        'Delete it only if it was entered against the wrong student or duplicated.',
                      confirmLabel: 'Delete it',
                    })
                    if (ok) deleteConference(c.id)
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <ConferenceModal
          course={course}
          students={students}
          actor={safety.actor}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  )
}
