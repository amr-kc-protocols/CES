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
  studentHourGaps,
  targetCoverage,
} from './aemtStore'
import { MAX_ABSENT_HOURS } from '../../data/aemt'
import { AttendanceCell, attendanceGridKeys } from '../../components/AttendanceCell'
import { useCan } from '../../lib/role'
import type { AemtCourse, AttendanceStatus } from '../../types'

/** "a", "a and b", "a, b and c" — a bare join reads as a run-on. */
function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// blank -> present -> absent -> blank
function nextStatus(cur: AttendanceStatus | undefined): AttendanceStatus | null {
  if (!cur) return 'present'
  if (cur === 'present') return 'absent'
  return null
}

export default function HoursTab({ course }: { course: AemtCourse }) {
  const students = useStudents(course.id)
  const sessions = useSessions(course.id)
  const records = useAemtAttendance(course.id)
  const map = useMemo(() => attendanceMap(records), [records])
  const hours = useStudentHours(course.id)
  // manageAemt, not editRideWork: the latter is true for FTOs, who must not
  // write to certification records.
  const { manageAemt: canEdit } = useCan()
  const cover = targetCoverage(course.targets)
  // Every student shares the course's target set, so one row defines the
  // columns. Falls back to an empty student so the header renders on a course
  // with a roster of nobody.
  const columns = studentHourGaps(
    hours[0] ?? {
      student: { id: '', courseId: course.id, name: '', status: 'active' },
      earned: 0, clinicalHours: 0, fieldHours: 0, unattestedShiftHours: 0, totalHours: 0,
      missedHours: 0, missed: [], classAbsentHours: 0, absenceRemaining: 0, overAbsenceCap: false,
    },
    course.targets,
  )
  const classroomUnreconciled =
    !columns.some((c) => c.id === 'class') &&
    (typeof course.targets?.didactic === 'number' || typeof course.targets?.lab === 'number')

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
        Tap a cell — or focus one and press space — to cycle{' '}
        <strong>present ✓ → absent ✗ → blank</strong>. Arrow keys move between cells. Hours credit
        automatically from each session's hours, and anyone marked absent rolls up into the make-up
        list below.
      </div>

      <div className="table-wrap" style={{ marginTop: 12 }} onKeyDown={attendanceGridKeys}>
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
            {students.map((t, ri) => {
              const row = hours.find((h) => h.student.id === t.id)
              return (
                <tr key={t.id}>
                  <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', fontWeight: 600 }}>
                    {t.name}
                  </td>
                  {sessions.map((s, ci) => {
                    const rec = map.get(attKey(t.id, s.id))
                    return (
                      <AttendanceCell
                        key={s.id}
                        status={rec?.status}
                        canEdit={canEdit}
                        row={ri}
                        col={ci}
                        label={`${t.name}, ${s.title || 'session'}${s.date ? ` ${formatDate(s.date)}` : ''}`}
                        title={`${t.name} · ${s.title || 'session'} · ${creditedHours(s, rec)} h`}
                        onCycle={() =>
                          setAttendance(course.id, t.id, s.id, nextStatus(rec?.status))
                        }
                      />
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

      {/* Program hours. Classroom time comes from the grid above, clinical and
          field from attested shifts on the Clinical tab — the two halves of
          the total a Kansas course record has to show, reconciled in one
          place against what the course filed. */}
      {cover.any ? (
        <>
          <div className="section-title">
            Program hours vs filed targets
            <span className="subtle" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
              {cover.total} h filed
            </span>
          </div>
          {/* Columns follow whatever the course filed. A category left unset
              is named below rather than shown as a target of zero. */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 150 }}>Student</th>
                  {columns.map((g) => (
                    <th key={g.id} style={{ textAlign: 'center' }}>
                      {g.label}
                      <div className="subtle" style={{ fontSize: 11, fontWeight: 400 }}>
                        of {g.target} h
                      </div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center' }}>Total</th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Still owed</th>
                </tr>
              </thead>
              <tbody>
                {hours.map((h) => {
                  const gaps = studentHourGaps(h, course.targets)
                  const owed = gaps.reduce((n, g) => n + Math.max(0, -g.delta), 0)
                  return (
                    <tr key={h.student.id}>
                      <td style={{ fontWeight: 600 }}>
                        {h.student.name}
                        {h.unattestedShiftHours > 0 && (
                          <div className="subtle" style={{ fontSize: 11, color: 'var(--warn)' }}>
                            +{h.unattestedShiftHours} h logged, not attested
                          </div>
                        )}
                      </td>
                      {gaps.map((g) => (
                        <td
                          key={g.id}
                          style={{
                            textAlign: 'center',
                            fontWeight: 600,
                            color: g.met ? '#166534' : undefined,
                          }}
                          title={
                            g.met
                              ? `${g.label} met (${g.delta > 0 ? `+${g.delta}` : '0'} h)`
                              : `${-g.delta} h of ${g.label.toLowerCase()} still owed`
                          }
                        >
                          {g.earned.toFixed(g.id === 'class' ? 2 : 0)}
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        {h.totalHours.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {owed === 0 ? (
                          <span className="pill ok">✓ complete</span>
                        ) : (
                          <span className="pill warn">{owed.toFixed(2)} h</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="help-text">
            Clinical and field hours count only from shifts a preceptor has attested. Log them on
            the Clinical tab.
          </div>
          {!cover.complete && (
            <div className="banner warn">
              <strong>
                {listOf(cover.missing.map((m) => m.label))} not filed.
              </strong>{' '}
              Those hours are recorded but reconcile against nothing, and the total above is only
              the {cover.total} h that were filed. Set them in <strong>Course setup</strong>.
            </div>
          )}
          {classroomUnreconciled && (
            <div className="banner warn">
              Classroom time cannot be reconciled from a partial pair — attendance is taken per
              session and earned hours mix didactic and lab, so both have to be filed before the
              comparison means anything.
            </div>
          )}
        </>
      ) : (
        <div className="banner warn" style={{ marginTop: 14 }}>
          This course has filed no hour targets, so classroom, clinical and field time cannot be
          reconciled against anything. Set them in <strong>Course setup</strong>.
        </div>
      )}

      {/* Attendance policy is a hard gate: more than 8 hours of class time
          missed fails the course outright, so it gets its own callout rather
          than being buried in the make-up list. */}
      {hours.some((h) => h.classAbsentHours > 0) && (
        <>
          <div className="section-title">Attendance policy · {MAX_ABSENT_HOURS} h maximum</div>
          <div className="list">
            {hours
              .filter((h) => h.classAbsentHours > 0)
              .sort((a, b) => b.classAbsentHours - a.classAbsentHours)
              .map((h) => (
                <div
                  key={h.student.id}
                  className={`row left-accent ${h.overAbsenceCap ? 'acc-crit' : 'acc-warn'}`}
                >
                  <div className="grow">
                    <div className="title">{h.student.name}</div>
                    <div className="meta">
                      {h.classAbsentHours} h of class time missed
                      {h.overAbsenceCap
                        ? ' — over the limit, course failure under the attendance policy'
                        : ` · ${h.absenceRemaining} h remaining before course failure`}
                    </div>
                  </div>
                  <span className={`pill ${h.overAbsenceCap ? 'crit' : 'warn'}`}>
                    {h.overAbsenceCap ? 'Over limit' : `${h.absenceRemaining} h left`}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

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
