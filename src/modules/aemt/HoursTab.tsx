import { useMemo } from 'react'
import { Empty } from '../../components/ui'
import { formatDate } from '../../lib/date'
import { weekdayLabel } from '../academy/calendar'
import {
  useSessions,
  useStudents,
  useAemtAttendance,
  useStudentHours,
  attendanceMap,
  attKey,
  setAttendance,
  markAllPresent,
  creditedHours,
} from './aemtStore'
import { useCan } from '../../lib/role'
import type { AemtCourse, AttendanceStatus } from '../../types'

// blank -> present -> absent -> blank
function nextStatus(cur: AttendanceStatus | undefined): AttendanceStatus | null {
  if (!cur) return 'present'
  if (cur === 'present') return 'absent'
  return null
}

const cellStyle = (
  status: AttendanceStatus | undefined,
  canEdit: boolean,
): React.CSSProperties => ({
  width: 48,
  minWidth: 48,
  textAlign: 'center',
  cursor: canEdit ? 'pointer' : 'default',
  fontWeight: 700,
  fontSize: 15,
  background:
    status === 'present' ? 'var(--ok-bg)' : status === 'absent' ? 'var(--crit-bg)' : undefined,
  color:
    status === 'present' ? '#166534' : status === 'absent' ? '#991b1b' : 'var(--border-strong)',
})

export default function HoursTab({ course }: { course: AemtCourse }) {
  const students = useStudents(course.id)
  const sessions = useSessions(course.id)
  const records = useAemtAttendance(course.id)
  const map = useMemo(() => attendanceMap(records), [records])
  const hours = useStudentHours(course.id)
  const { editRideWork: canEdit } = useCan()

  if (students.length === 0) {
    return (
      <Empty icon="🧑‍🚒" title="No students yet">
        Add students on the Roster tab to track hours.
      </Empty>
    )
  }
  if (sessions.length === 0) {
    return (
      <Empty icon="🗓️" title="No sessions yet">
        Add sessions on the Sessions tab, then mark who attended here.
      </Empty>
    )
  }

  return (
    <div>
      <div className="banner info">
        Tap a cell to cycle <strong>present ✓ → absent ✗ → blank</strong>. Hours credit
        automatically from each session's hours, and anyone marked absent rolls up into the
        make-up list below.
      </div>

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: 'var(--surface-2)', minWidth: 150 }}>
                Student
              </th>
              {sessions.map((s) => (
                <th key={s.id} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>
                    {s.date ? `${weekdayLabel(s.date)} ${formatDate(s.date)}` : 'TBD'}
                  </div>
                  <div className="subtle" style={{ fontSize: 11 }}>{s.hours} h</div>
                  {canEdit && (
                    <button
                      className="link-btn"
                      style={{ fontSize: 11, padding: '5px 10px', minHeight: 30 }}
                      title="Mark all present for this session"
                      onClick={() => markAllPresent(course.id, students.map((t) => t.id), s.id)}
                    >
                      all ✓
                    </button>
                  )}
                </th>
              ))}
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Hours</th>
            </tr>
          </thead>
          <tbody>
            {students.map((t) => {
              const row = hours.find((h) => h.student.id === t.id)
              return (
                <tr key={t.id}>
                  <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', fontWeight: 600 }}>
                    {t.name}
                  </td>
                  {sessions.map((s) => {
                    const rec = map.get(attKey(t.id, s.id))
                    return (
                      <td
                        key={s.id}
                        style={cellStyle(rec?.status, canEdit)}
                        onClick={
                          canEdit
                            ? () => setAttendance(course.id, t.id, s.id, nextStatus(rec?.status))
                            : undefined
                        }
                        title={`${t.name} · ${s.title || 'session'} · ${creditedHours(s, rec)} h`}
                      >
                        {rec?.status === 'present' ? '✓' : rec?.status === 'absent' ? '✗' : '·'}
                      </td>
                    )
                  })}
                  <td style={{ textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {row ? row.earned.toFixed(2) : '0.00'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="section-title">Make-up needed</div>
      {hours.every((h) => h.missed.length === 0) ? (
        <div className="banner ok">✓ No missed sessions recorded.</div>
      ) : (
        <div className="list">
          {hours
            .filter((h) => h.missed.length > 0)
            .map(({ student, missed, earned, missedHours }) => (
              <div key={student.id} className="row left-accent acc-crit">
                <div className="grow">
                  <div className="title">{student.name}</div>
                  <div className="meta">
                    {earned.toFixed(2)} h earned · missed:{' '}
                    {missed
                      .map((s) => `${s.title || 'session'}${s.date ? ` (${formatDate(s.date)})` : ''}`)
                      .join(' · ')}
                  </div>
                </div>
                <span className="pill crit">{missedHours} h to make up</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
