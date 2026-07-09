import { useMemo } from 'react'
import { Empty } from '../../components/ui'
import { formatDate } from '../../lib/date'
import {
  useCohortTrainees,
  useAcademyDays,
  useAttendance,
  attendanceMap,
  attKey,
  setAttendance,
  markAllPresent,
} from './academyStore'
import { printDoc, downloadDoc, attendanceSheetHTML, safeFilename } from './docGen'
import type { AcademyCohort, AttendanceStatus } from '../../types'

// Next state when a cell is clicked: blank -> present -> absent -> blank.
function nextStatus(cur: AttendanceStatus | undefined): AttendanceStatus | null {
  if (!cur) return 'present'
  if (cur === 'present') return 'absent'
  return null
}

const cellStyle = (status: AttendanceStatus | undefined): React.CSSProperties => ({
  width: 34,
  minWidth: 34,
  textAlign: 'center',
  cursor: 'pointer',
  fontWeight: 700,
  background:
    status === 'present' ? 'var(--ok-bg)' : status === 'absent' ? 'var(--crit-bg)' : undefined,
  color: status === 'present' ? '#166534' : status === 'absent' ? '#991b1b' : 'var(--border-strong)',
})

export default function AttendanceView({ cohort }: { cohort: AcademyCohort }) {
  const trainees = useCohortTrainees(cohort.id)
  const days = useAcademyDays(cohort.id)
  const records = useAttendance(cohort.id)
  const map = useMemo(() => attendanceMap(records), [records])

  // Per-trainee list of missed dated days -> catch-up.
  const catchUp = useMemo(
    () =>
      trainees
        .map((t) => ({
          trainee: t,
          missed: days.filter((d) => map.get(attKey(t.id, d.key)) === 'absent'),
        }))
        .filter((x) => x.missed.length > 0),
    [trainees, days, map],
  )

  if (trainees.length === 0) {
    return (
      <Empty icon="🧑‍🚒" title="No trainees yet">
        Add trainees on the Roster tab to track attendance.
      </Empty>
    )
  }
  if (days.length === 0) {
    return (
      <Empty icon="🗓️" title="No academy days scheduled">
        Build the Schedule (Phase 1) or lay out Phase 2 dates, then mark attendance here.
      </Empty>
    )
  }

  return (
    <div>
      <div className="banner info">
        Tap a cell to cycle <strong>present ✓ → absent ✗ → blank</strong>. Absences roll up into the
        catch-up list below, across both phases.
      </div>

      <div className="toolbar" style={{ marginTop: 12 }}>
        <span className="subtle">
          {trainees.length} trainees · {days.length} day{days.length === 1 ? '' : 's'}
        </span>
        <div className="spacer" />
        <button className="btn" onClick={() => printDoc(`${cohort.label} — Attendance`, attendanceSheetHTML(cohort, days, trainees, map))}>
          🖨 Print
        </button>
        <button
          className="btn"
          onClick={() =>
            downloadDoc(safeFilename(`${cohort.label}_Attendance`), `${cohort.label} — Attendance`, attendanceSheetHTML(cohort, days, trainees, map))
          }
        >
          ⬇ Word
        </button>
      </div>

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: 'var(--surface-2)', minWidth: 140 }}>
                Trainee
              </th>
              {days.map((d) => (
                <th key={d.key} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: 11 }}>
                    <span className={`pill ${d.phase === 1 ? 'info' : 'warn'}`} style={{ padding: '0 5px' }}>
                      P{d.phase}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{d.date ? formatDate(d.date) : 'TBD'}</div>
                  <button
                    className="link-btn"
                    style={{ fontSize: 10 }}
                    title="Mark all present for this day"
                    onClick={() => markAllPresent(cohort.id, trainees.map((t) => t.id), d.key)}
                  >
                    all ✓
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trainees.map((t) => (
              <tr key={t.id}>
                <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', fontWeight: 600 }}>
                  {t.name}
                </td>
                {days.map((d) => {
                  const status = map.get(attKey(t.id, d.key))
                  return (
                    <td
                      key={d.key}
                      style={cellStyle(status)}
                      onClick={() => setAttendance(cohort.id, t.id, d.key, nextStatus(status))}
                      title={`${t.name} · ${d.title}`}
                    >
                      {status === 'present' ? '✓' : status === 'absent' ? '✗' : '·'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">Catch-up needed</div>
      {catchUp.length === 0 ? (
        <div className="banner ok" style={{ background: 'var(--ok-bg)', color: '#166534' }}>
          ✓ No missed days recorded.
        </div>
      ) : (
        <div className="list">
          {catchUp.map(({ trainee, missed }) => (
            <div key={trainee.id} className="row left-accent acc-crit">
              <div className="grow">
                <div className="title">{trainee.name}</div>
                <div className="meta">
                  Missed: {missed.map((d) => `${d.title}${d.date ? ` (${formatDate(d.date)})` : ''}`).join(' · ')}
                </div>
              </div>
              <span className="pill crit">{missed.length} to catch up</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
