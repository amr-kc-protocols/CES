import { useMemo, useState } from 'react'
import { Empty, Modal } from '../../components/ui'
import { confirmAction, notifyUser } from '../../lib/dialog'
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
  attendanceOverwrites,
  creditedHours,
  studentHourGaps,
  targetCoverage,
  recordMakeUp,
  clearMakeUp,
  useRecordSafety,
} from './aemtStore'
import { ABSENCE_MAKEUP, MAX_ABSENT_HOURS } from '../../data/aemt'
import { patternLabel, workConflicts } from './workPattern'
import { todayISO } from '../../lib/date'
import { AttendanceCell, attendanceGridKeys } from '../../components/AttendanceCell'
import { useCan } from '../../lib/role'
import type { AemtCourse, AemtSession, AemtStudent, AttendanceStatus } from '../../types'

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

/**
 * Record what a student actually did to make up a missed session.
 *
 * The program's policy is that a make-up is documented rather than waived — "a
 * make-up that is not documented is an absence" — and K.A.R. 109-17-3 retains
 * the resulting record for three years. Until this existed the make-up list was
 * a list of grievances with nothing that could close one, so the record the
 * regulation asks for was kept nowhere and the screen implied otherwise.
 */
function MakeUpModal({
  student,
  session,
  actor,
  onClose,
}: {
  student: AemtStudent
  session: AemtSession
  actor: string
  onClose: () => void
}) {
  const [date, setDate] = useState(todayISO())
  const [what, setWhat] = useState('')
  const [by, setBy] = useState(actor === 'local' ? '' : actor)
  const [refused, setRefused] = useState<string | null>(null)
  const valid = what.trim().length >= 4 && by.trim() !== ''

  return (
    <Modal title={`Make-up — ${student.name}`} onClose={onClose}>
      <div className="banner info" style={{ marginTop: 0 }}>
        <strong>{session.title || 'Session'}</strong>
        {session.date ? ` · ${formatDate(session.date)}` : ''} · {session.hours} h missed
      </div>
      <div className="help-text" style={{ marginTop: 0 }}>
        {ABSENCE_MAKEUP.requirement}
      </div>

      <div className="field-row" style={{ marginTop: 10 }}>
        <div className="field">
          <label htmlFor="mu-date">Completed on</label>
          <input id="mu-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="mu-by">Supervised by</label>
          <input
            id="mu-by"
            value={by}
            onChange={(e) => setBy(e.target.value)}
            placeholder="Primary instructor"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="mu-what">What the student did</label>
        <textarea
          id="mu-what"
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          placeholder="Completed the Navigate module and the chapter quiz, then demonstrated glucometry and IM injection to the lab checklist. Both to standard on the first attempt."
        />
        <div className="help-text">
          This is the record an auditor reads. &ldquo;Made up&rdquo; is not a description of
          equivalent competency.
        </div>
      </div>

      <div className="banner warn">
        The absence stays on the attendance record and the {session.hours} h stay lost — that is what
        happened. This documents the equivalent competency, which is the separate thing the policy
        requires.
      </div>
      {refused && <div className="banner crit">{refused}</div>}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!valid}
          onClick={() => {
            const res = recordMakeUp(student.id, session.id, { date, what, by })
            if (!res.ok) {
              setRefused(res.refused ?? 'Could not record it.')
              return
            }
            onClose()
          }}
        >
          Record the make-up
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
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
  const safety = useRecordSafety()
  const [makingUp, setMakingUp] = useState<{ student: AemtStudent; session: AemtSession } | null>(null)
  const cover = targetCoverage(course.targets)

  // Flattened to one entry per missed session so a make-up has something
  // specific to attach to, and sorted by date so the oldest debt is at the top.
  const bySession = (a: { session: AemtSession }, b: { session: AemtSession }) =>
    (a.session.date ?? '').localeCompare(b.session.date ?? '')
  const owed = hours
    .flatMap((h) => h.makeUpOwed.map((session) => ({ student: h.student, session })))
    .sort(bySession)
  // What each student's regular line costs them before a single absence is
  // recorded. Attendance measures what happened; this measures what is already
  // arranged to happen, which is the half nobody could see.
  const lineConflicts = students
    .map((st) => workConflicts(st, sessions, MAX_ABSENT_HOURS))
    .filter((c) => c.clashes.length > 0)
    .sort((a, b) => b.hoursLost - a.hoursLost)
  const done = hours
    .flatMap((h) => h.makeUpsDone.map((d) => ({ student: h.student, ...d })))
    .sort(bySession)
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
                      title="Mark everyone not yet marked as present for this session"
                      onClick={async () => {
                        const ids = students.map((t) => t.id)
                        // Fills blanks. Anything already marked absent, or
                        // credited partial hours for a late arrival, feeds the
                        // attendance policy — so replacing it is a decision,
                        // not a side effect of a mis-tap on a scrolling grid.
                        const clashes = attendanceOverwrites(ids, s.id)
                        let overwrite = false
                        if (clashes.length > 0) {
                          const absences = clashes.filter((a) => a.status !== 'present').length
                          const partial = clashes.length - absences
                          overwrite = await confirmAction({
                            title: 'Replace the marks already recorded?',
                            body:
                              `${clashes.length} student${clashes.length === 1 ? ' has' : 's have'} a mark on this session ` +
                              `already — ${absences} not present, ${partial} credited partial hours. ` +
                              'Replacing them changes the hours those students have earned and the ' +
                              'absence total the attendance policy is measured against. ' +
                              'Cancel to fill only the blank cells.',
                            confirmLabel: 'Replace them',
                          })
                        }
                        const n = markAllPresent(course.id, ids, s.id, { overwrite })
                        notifyUser(
                          n === 0
                            ? 'Everyone on this session is already marked — nothing changed.'
                            : `Marked ${n} student${n === 1 ? '' : 's'} present.`,
                        )
                      }}
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
                            color: g.met ? 'var(--ok)' : undefined,
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

      {/* Scheduled against, before anything is missed.
          The attendance grid above records what happened. This is what the
          students' own bid lines have already decided will happen — the same
          hours, arrived at fourteen weeks earlier, while there is still time to
          trade a shift or move a line. */}
      {lineConflicts.length > 0 && (
        <>
          <div className="section-title">Class hours their work line already covers</div>
          <div className="help-text" style={{ marginTop: 0, marginBottom: 8 }}>
            Not absences — these sessions have not happened. This is the collision between the class
            schedule and the shifts each student is rostered on, which is the same hours counted
            against the {MAX_ABSENT_HOURS}-hour cap unless something changes first.
          </div>
          <div className="list">
            {lineConflicts.map((c) => (
              <div
                key={c.student.id}
                className={`row left-accent ${c.overCap ? 'acc-crit' : 'acc-warn'}`}
              >
                <div className="grow">
                  <div className="title">{c.student.name}</div>
                  <div className="meta">{c.pattern ? patternLabel(c.pattern) : ''}</div>
                  <div className="meta">
                    {c.clashes.length} session{c.clashes.length === 1 ? '' : 's'} ·{' '}
                    {c.clashes.filter((x) => x.whole).length} lost whole · first is{' '}
                    {formatDate(c.clashes[0].session.date)}
                  </div>
                </div>
                <span className={`pill ${c.overCap ? 'crit' : 'warn'}`}>
                  {c.hoursLost} h
                  {c.overCap ? ` · over ${MAX_ABSENT_HOURS} h cap` : ''}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* One row per missed SESSION, not per student. A student with four
          absences used to be one row listing all four, so a make-up for one of
          them had nowhere to attach and the row stayed red until every one was
          done — which is why nothing was ever recorded against it. */}
      <div className="section-title">Make-up</div>
      {hours.every((h) => h.missed.length === 0) ? (
        <div className="banner ok">✓ No missed sessions recorded.</div>
      ) : (
        <>
          {owed.length === 0 ? (
            <div className="banner ok">
              ✓ Every missed session has a documented make-up on file.
            </div>
          ) : (
            <div className="help-text" style={{ marginTop: 0, marginBottom: 8 }}>
              {ABSENCE_MAKEUP.note} {ABSENCE_MAKEUP.requirement}
            </div>
          )}
          <div className="list">
            {owed.map(({ student, session }) => (
              <div key={`${student.id}|${session.id}`} className="row left-accent acc-crit">
                <div className="grow">
                  <div className="title">{student.name}</div>
                  <div className="meta">
                    {session.title || 'Session'}
                    {session.date ? ` · ${formatDate(session.date)}` : ''} · {session.hours} h
                  </div>
                </div>
                <span className="pill crit">no make-up recorded</span>
                {canEdit && (
                  <button className="btn sm primary" onClick={() => setMakingUp({ student, session })}>
                    Record
                  </button>
                )}
              </div>
            ))}
            {done.map(({ student, session, makeUp }) => (
              <div key={`${student.id}|${session.id}`} className="row left-accent acc-ok">
                <div className="grow">
                  <div className="title">{student.name}</div>
                  <div className="meta">
                    {session.title || 'Session'}
                    {session.date ? ` · ${formatDate(session.date)}` : ''} · made up{' '}
                    {formatDate(makeUp.date)} with {makeUp.by}
                  </div>
                  <div className="help-text">{makeUp.what}</div>
                </div>
                <span className="pill ok">documented</span>
                {canEdit && (
                  <button
                    className="btn sm danger"
                    aria-label={`Remove the make-up record for ${student.name}`}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: 'Remove this make-up record?',
                        body:
                          'It is a program record retained for three years under K.A.R. 109-17-3. ' +
                          'Remove it only if it was entered against the wrong session or the wrong ' +
                          'student — the session goes back to owing a make-up.',
                        confirmLabel: 'Remove it',
                      })
                      if (ok) clearMakeUp(student.id, session.id)
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {makingUp && (
        <MakeUpModal
          student={makingUp.student}
          session={makingUp.session}
          actor={safety.actor}
          onClose={() => setMakingUp(null)}
        />
      )}
    </div>
  )
}
