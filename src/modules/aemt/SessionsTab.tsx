import { Empty } from '../../components/ui'
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

function SessionRow({ session, canEdit }: { session: AemtSession; canEdit: boolean }) {
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

export default function SessionsTab({ course }: { course: AemtCourse }) {
  const sessions = useSessions(course.id)
  const { manageAcademy } = useCan()
  const totals = courseHourTotals(sessions)
  const recon = reconcileHours(sessions, course.targets)

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
        {manageAcademy && (
          <button
            className="btn primary"
            onClick={() => addSession(course.id, { date: course.startDate })}
          >
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
            <SessionRow key={s.id} session={s} canEdit={manageAcademy} />
          ))}
        </div>
      )}
    </div>
  )
}
