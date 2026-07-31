import { useState } from 'react'
import { Empty, Modal } from '../../components/ui'
import SavedIndicator from '../../components/SavedIndicator'
import { confirmAction, notifyUser } from '../../lib/dialog'
import { formatDate } from '../../lib/date'
import { weekdayLabel } from '../academy/calendar'
import {
  useSessions,
  addSession,
  updateSession,
  deleteSession,
  courseHourTotals,
  reconcileHours,
  seedKcSchedule,
  sessionProblems,
} from './aemtStore'
import { blockPlanTotals } from '../../data/aemt'
import { useCan } from '../../lib/role'
import type { AemtCourse, AemtSession, AemtSessionKind } from '../../types'

const KINDS: { value: AemtSessionKind; label: string; cls: string }[] = [
  { value: 'didactic', label: 'Didactic', cls: 'info' },
  { value: 'lab', label: 'Lab', cls: 'warn' },
  { value: 'clinical', label: 'Clinical', cls: 'ok' },
  { value: 'exam', label: 'Exam', cls: 'crit' },
]

const KIND_CLS: Record<AemtSessionKind, string> = Object.fromEntries(
  KINDS.map((k) => [k.value, k.cls]),
) as Record<AemtSessionKind, string>

function SessionRow({
  session,
  canEdit,
  problems,
}: {
  session: AemtSession
  canEdit: boolean
  problems: string[]
}) {
  if (!canEdit) {
    return (
      <div className="row">
        <div className="grow">
          <div className="title">{session.title || 'Untitled session'}</div>
          <div className="meta">
            {session.date ? `${weekdayLabel(session.date)} ${formatDate(session.date)}` : 'No date'}
            {session.startTime && ` ${session.startTime}${session.endTime ? `–${session.endTime}` : ''}`} ·{' '}
            {session.hours} h
            {session.instructor && <> · {session.instructor}</>}
          </div>
        </div>
        <span className={`pill ${KIND_CLS[session.kind]}`}>
          {KINDS.find((k) => k.value === session.kind)?.label}
        </span>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
        <label className="subtle" style={{ fontSize: 12 }}>
          Date
          <input
            type="date"
            value={session.date}
            onChange={(e) => updateSession(session.id, { date: e.target.value })}
            style={{ display: 'block', width: '100%', marginTop: 2 }}
          />
        </label>
        <label className="subtle" style={{ fontSize: 12 }}>
          Hours
          <input
            type="number"
            min={0}
            step={0.25}
            value={session.hours}
            onChange={(e) =>
              updateSession(session.id, { hours: Math.max(0, Number(e.target.value) || 0) })
            }
            style={{ display: 'block', width: '100%', marginTop: 2 }}
          />
        </label>
        {/* K.A.R. 109-11-1a(b3) requires the filed schedule to show the time of
            each session, not only its length. */}
        <label className="subtle" style={{ fontSize: 12 }}>
          Start
          <input
            type="time"
            value={session.startTime ?? ''}
            onChange={(e) => updateSession(session.id, { startTime: e.target.value || undefined })}
            style={{ display: 'block', width: '100%', marginTop: 2 }}
          />
        </label>
        <label className="subtle" style={{ fontSize: 12 }}>
          End
          <input
            type="time"
            value={session.endTime ?? ''}
            onChange={(e) => updateSession(session.id, { endTime: e.target.value || undefined })}
            style={{ display: 'block', width: '100%', marginTop: 2 }}
          />
        </label>
        <label className="subtle" style={{ fontSize: 12, gridColumn: '1 / -1' }}>
          Title
          <input
            value={session.title}
            onChange={(e) => updateSession(session.id, { title: e.target.value })}
            placeholder="Airway management — supraglottic devices"
            style={{ display: 'block', width: '100%', marginTop: 2 }}
          />
        </label>
        <label className="subtle" style={{ fontSize: 12 }}>
          Kind
          <select
            value={session.kind}
            onChange={(e) => updateSession(session.id, { kind: e.target.value as AemtSessionKind })}
            style={{ display: 'block', width: '100%', marginTop: 2 }}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="subtle" style={{ fontSize: 12 }}>
          Instructor
          <input
            value={session.instructor ?? ''}
            onChange={(e) => updateSession(session.id, { instructor: e.target.value || undefined })}
            style={{ display: 'block', width: '100%', marginTop: 2 }}
          />
        </label>
      </div>
      {problems.length > 0 && (
        <div className="banner warn" style={{ marginTop: 8, marginBottom: 0 }}>
          {problems.map((t) => (
            <div key={t}>{t}</div>
          ))}
        </div>
      )}
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button
          className="btn sm danger"
          onClick={async () => {
            const ok = await confirmAction({
              title: 'Delete this session?',
              body: 'Attendance marked against it goes too, and the hours it carried come off every student who attended.',
              confirmLabel: 'Delete session',
            })
            if (ok) deleteSession(session.id)
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

/**
 * Adding a session goes through a form rather than dropping an empty row into
 * the schedule. "+ Session" used to write immediately: a stray tap created an
 * untitled 4-hour didactic session, which counted toward the filed hour totals
 * and synced, and the only way back was to find and delete it.
 */
function AddSessionModal({ course, onClose }: { course: AemtCourse; onClose: () => void }) {
  const [date, setDate] = useState(course.startDate)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<AemtSessionKind>('didactic')
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('22:00')
  const [hours, setHours] = useState('4')
  const [instructor, setInstructor] = useState('')

  const hoursNum = Number(hours)
  const outOfRange = date < course.startDate || date > course.endDate
  const timesBackwards = !!startTime && !!endTime && endTime <= startTime
  const valid = !!date && hoursNum > 0 && !timesBackwards

  // Times are what the filing needs; hours follow from them unless overridden.
  function setSpan(start: string, end: string): void {
    setStartTime(start)
    setEndTime(end)
    if (start && end && end > start) {
      const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
      setHours(String((mins(end) - mins(start)) / 60))
    }
  }

  return (
    <Modal title="Add session" onClose={onClose}>
      <div className="field-row">
        <div className="field">
          <label htmlFor="as-date">Date</label>
          <input
            id="as-date"
            type="date"
            value={date}
            min={course.startDate}
            max={course.endDate}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="as-kind">Kind</label>
          <select
            id="as-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as AemtSessionKind)}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="as-title">Subject</label>
        <input
          id="as-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Airway management — supraglottic devices"
        />
        <div className="help-text">
          K.A.R. 109-11-1a(b3): the filed schedule shows the subject of each session.
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="as-start">Start</label>
          <input
            id="as-start"
            type="time"
            value={startTime}
            onChange={(e) => setSpan(e.target.value, endTime)}
          />
        </div>
        <div className="field">
          <label htmlFor="as-end">End</label>
          <input
            id="as-end"
            type="time"
            value={endTime}
            onChange={(e) => setSpan(startTime, e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="as-hours">Hours</label>
          <input
            id="as-hours"
            type="number"
            min={0}
            step={0.25}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="as-instr">Instructor</label>
        <input id="as-instr" value={instructor} onChange={(e) => setInstructor(e.target.value)} />
      </div>

      {timesBackwards && (
        <div className="banner crit">The end time is at or before the start time.</div>
      )}
      {outOfRange && !timesBackwards && (
        <div className="banner warn">
          This date is outside the course ({formatDate(course.startDate)} –{' '}
          {formatDate(course.endDate)}). It can still be added, but it will be flagged.
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!valid}
          onClick={() => {
            addSession(course.id, {
              date,
              title: title.trim(),
              kind,
              hours: hoursNum,
              startTime: startTime || undefined,
              endTime: endTime || undefined,
              instructor: instructor.trim() || undefined,
            })
            onClose()
          }}
        >
          Add session
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

export default function SessionsTab({ course }: { course: AemtCourse }) {
  const sessions = useSessions(course.id)
  const { manageAcademy } = useCan()
  const [adding, setAdding] = useState(false)
  const totals = courseHourTotals(sessions)
  const recon = reconcileHours(sessions, course.targets)
  const problems = sessionProblems(sessions, course)

  return (
    <div>
      <div className="banner info">
        Every session carries the <strong>contact hours</strong> it is worth. Those hours are what a
        student's course record — and a KBEMS course audit — is built from.
      </div>

      {/* The filed proposal commits to specific hour totals; KBEMS compares the
          submitted schedule against them. Show the gap while it is still cheap
          to fix. */}
      {sessions.length > 0 && recon.length > 0 && (
        <div className="card" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            Against the filed hours
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Component</th>
                  <th style={{ textAlign: 'right' }}>Scheduled</th>
                  <th style={{ textAlign: 'right' }}>Target</th>
                  <th style={{ textAlign: 'right' }}>Gap</th>
                </tr>
              </thead>
              <tbody>
                {recon.map((r) => (
                  <tr key={r.id}>
                    <td>{r.label}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.scheduled}</td>
                    <td style={{ textAlign: 'right' }} className="subtle">{r.target}</td>
                    <td style={{ textAlign: 'right' }}>
                      {r.delta === 0 ? (
                        <span className="pill ok">even</span>
                      ) : (
                        <span className={`pill ${r.delta < 0 ? 'crit' : 'warn'}`}>
                          {r.delta > 0 ? '+' : ''}
                          {r.delta} h
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="help-text">
            Targets are this course's filed hour commitments, set on the course record.
            {course.targets && course.targets.didactic !== blockPlanTotals().didactic && (
              <>
                {' '}The bundled 16-week plan lays out {blockPlanTotals().didactic} didactic hours,
                so building from it alone will not reach {course.targets.didactic}.
              </>
            )}
          </div>
        </div>
      )}

      {problems.length > 0 && (
        <div className="banner warn" style={{ marginTop: 12 }}>
          <strong>
            {problems.length} schedule problem{problems.length === 1 ? '' : 's'}.
          </strong>{' '}
          Each is flagged on the session it belongs to. None of this blocks editing — a half-built
          schedule is normal — but these are the things a KBEMS reviewer checks.
        </div>
      )}

      {sessions.length > 0 && sessions.some((s) => !s.startTime) && (
        <div className="banner warn" style={{ marginTop: 12 }}>
          {sessions.filter((s) => !s.startTime).length} session
          {sessions.filter((s) => !s.startTime).length === 1 ? ' has' : 's have'} no start time. The
          filed schedule has to show the time of each session, not only its length.
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 12 }}>
        <span className="subtle">
          {totals.total} h total · {totals.byKind.didactic} didactic · {totals.byKind.lab} lab ·{' '}
          {totals.byKind.clinical} clinical · {totals.byKind.exam} exam
        </span>
        <div className="spacer" />
        {manageAcademy && sessions.length === 0 && (
          <button
            className="btn"
            title="Create Tue/Thu sessions for 16 weeks from the AMR KC proposal's content plan. Adjust for another program."
            onClick={() => {
              const n = seedKcSchedule(course.id, course.startDate)
              notifyUser(`Created ${n} sessions from the 16-week plan — adjust dates and hours as needed.`)
            }}
          >
            ⚡ Build AMR KC 16-week plan
          </button>
        )}
        {manageAcademy && <SavedIndicator />}
        {manageAcademy && (
          <button className="btn primary" onClick={() => setAdding(true)}>
            + Session
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <Empty icon="🗓️" title="No sessions yet">
          {manageAcademy
            ? 'Add the class meetings and the hours each is worth.'
            : 'The Clinical Educator lays out the course schedule.'}
        </Empty>
      ) : (
        <div
          className={manageAcademy ? undefined : 'list'}
          style={manageAcademy ? { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 } : { marginTop: 12 }}
        >
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              canEdit={manageAcademy}
              problems={problems.filter((p) => p.sessionId === s.id).map((p) => p.text)}
            />
          ))}
        </div>
      )}

      {adding && <AddSessionModal course={course} onClose={() => setAdding(false)} />}
    </div>
  )
}
