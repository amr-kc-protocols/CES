import { useState } from 'react'
import { Empty, Modal } from '../../components/ui'
import SavedIndicator from '../../components/SavedIndicator'
import DebouncedInput from '../../components/DebouncedInput'
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
  seedShortfall,
  addPlaceholderSessions,
  sessionProblems,
  parseClock,
} from './aemtStore'
import {
  CLASS_HOURS_PER_WEEK,
  duplicatedChapters,
  holidayShifts,
  KC_CALENDAR_WEEKS,
  KC_CLASS_PATTERN,
  KC_COURSE_WEEKS,
  scheduleTotals,
} from '../../data/aemt'
import ScheduleCalendar from './ScheduleCalendar'
import { addDays } from '../../lib/date'
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
          <DebouncedInput
            value={session.title}
            onCommit={(v) => updateSession(session.id, { title: v })}
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
          <DebouncedInput
            value={session.instructor ?? ''}
            onCommit={(v) => updateSession(session.id, { instructor: v || undefined })}
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
    const from = parseClock(start)
    const to = parseClock(end)
    if (from !== undefined && to !== undefined && to > from) {
      setHours(String((to - from) / 60))
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

/**
 * Seeding states the arithmetic before it writes anything.
 *
 * The bundled plan is the proposal's §3 content schedule, which sums to 90
 * didactic hours. §2 of the same proposal claims ~110. Building from the plan
 * therefore lands short of the course's own filed target by construction, and
 * the previous button did it silently — leaving the gap to be discovered from
 * a reconciliation table, or not at all.
 */
function SeedModal({ course, onClose }: { course: AemtCourse; onClose: () => void }) {
  const plan = scheduleTotals()
  const short = seedShortfall(course.targets)
  const [alsoPlace, setAlsoPlace] = useState(short.total > 0)
  // The plan lays KC_COURSE_WEEKS of Tue/Thu sessions from the first Tuesday on
  // or after the start date. A course whose own end date falls sooner gets a
  // schedule that runs past it, and every session beyond gets flagged as
  // outside the course dates — better said before building than discovered
  // as a wall of warnings afterwards. The span is derived: when the block plan
  // grew from 16 weeks to 23, a hard-coded 15 here would have quietly stopped
  // warning about the seven weeks that now overrun.
  const lastSeeded = addDays(course.startDate, (KC_COURSE_WEEKS - 1) * 7 + 9)
  const runsPast = lastSeeded > course.endDate

  return (
    <Modal title={`Build the AMR KC ${KC_COURSE_WEEKS}-week plan`} onClose={onClose}>
      <p style={{ marginTop: 0, lineHeight: 1.55 }}>
        Lays the {KC_COURSE_WEEKS}-week schedule filed for Wichita, which Kansas City runs as the
        same template —{' '}
        <strong>
          {plan.didactic} didactic + {plan.lab} lab
        </strong>
        , {plan.classroom} hours in total.
      </p>
      <p style={{ lineHeight: 1.55 }} className="subtle">
        <strong>{plan.f2f} h of that is face-to-face</strong>, across {plan.f2fWeeks} class weeks —{' '}
        {KC_CLASS_PATTERN.days.length} classes a week of {KC_CLASS_PATTERN.hoursPerDay} hours (
        {CLASS_HOURS_PER_WEEK} h a week) from{' '}
        {String(Math.floor(KC_CLASS_PATTERN.startMinute / 60)).padStart(2, '0')}:
        {String(KC_CLASS_PATTERN.startMinute % 60).padStart(2, '0')}. The other {plan.assignment} h
        is Navigate chapter work, quizzes and AHA pre-course reading the student completes on their
        own, so it costs no class time. Runs {KC_CALENDAR_WEEKS} calendar weeks once holidays are
        allowed for.
      </p>

      {course.targets ? (
        short.total > 0 ? (
          <div className="banner crit">
            <strong>This plan cannot reach your filed target on its own.</strong> The course files{' '}
            {course.targets.didactic} didactic and {course.targets.lab} lab hours; the plan lays out{' '}
            {plan.didactic} and {plan.lab}. That leaves{' '}
            <strong>
              {short.didactic > 0 && `${short.didactic} h didactic`}
              {short.didactic > 0 && short.lab > 0 && ' and '}
              {short.lab > 0 && `${short.lab} h lab`}
            </strong>{' '}
            unaccounted for. This course's filed targets do not match the schedule template — it is
            a defect in the source document, not a rounding error, and it has to be closed before a
            KBEMS submission.
          </div>
        ) : (
          <div className="banner ok">
            ✓ The plan meets this course's filed classroom targets exactly.
          </div>
        )
      ) : (
        <div className="banner warn">
          This course has filed no hour targets, so there is nothing to check the plan against.
        </div>
      )}

      <div className="banner info">
        <strong>Two things carried over from the Wichita filing.</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
          <li>
            Its summary line files <strong>110 didactic hours</strong>, but its own 26 schedule rows
            sum to <strong>116</strong>. Kansas City files 116 — the schedule is what KBEMS reviews
            against, so a summary that disagrees with it is the thing that is wrong.
          </li>
          {duplicatedChapters().length > 0 && (
            <li>
              Chapter{duplicatedChapters().length === 1 ? ' ' : 's '}
              {duplicatedChapters().join(' and ')}{' '}
              {duplicatedChapters().length === 1 ? 'is' : 'are'} assigned twice. Reproduced as filed
              rather than deduplicated, because removing the repeat would change the hours this
              template exists to match.
            </li>
          )}
        </ul>
      </div>

      {holidayShifts().length > 0 && (
        <div className="banner warn">
          <strong>
            {holidayShifts().length} week{holidayShifts().length === 1 ? '' : 's'} pushed by a
            holiday.
          </strong>{' '}
          Class weeks landing on a holiday move to the next clear week, which is why the course runs{' '}
          {KC_CALENDAR_WEEKS} calendar weeks for {KC_COURSE_WEEKS} course weeks. Assignment weeks are
          not moved — they cost no class time.
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
            {holidayShifts().map((h) => (
              <li key={h.week}>
                <strong>Week {h.week}</strong> — moved clear of {h.holiday}, now starting{' '}
                {formatDate(h.date)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {runsPast && (
        <div className="banner warn">
          <strong>This runs past the course's end date.</strong> {KC_COURSE_WEEKS} weeks from{' '}
          {formatDate(course.startDate)} reaches {formatDate(lastSeeded)}, but the course is recorded
          as ending {formatDate(course.endDate)}. The sessions will still be created — every one past
          the end date will be flagged until the course dates are corrected in Course setup.
        </div>
      )}

      {short.total > 0 && (
        <label
          className="subtle"
          style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12 }}
        >
          <input
            type="checkbox"
            checked={alsoPlace}
            onChange={(e) => setAlsoPlace(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>
            Also add the missing {short.total} h as unplaced sessions. They carry the hours so the
            schedule reconciles, but have no date or subject, so each stays flagged until a
            coordinator places it. Leave unchecked to seed exactly what the proposal filed.
          </span>
        </label>
      )}

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button
          className="btn primary"
          onClick={() => {
            const out = seedKcSchedule(course.id, course.startDate)
            let extra = 0
            if (alsoPlace && short.didactic > 0) {
              extra += addPlaceholderSessions(course.id, 'didactic', short.didactic, course.startDate)
            }
            if (alsoPlace && short.lab > 0) {
              extra += addPlaceholderSessions(course.id, 'lab', short.lab, course.startDate)
            }
            notifyUser(
              `Created ${out.sessions} sessions (${out.didactic} h didactic, ${out.lab} h lab)` +
                (extra > 0 ? ` plus ${extra} unplaced session${extra === 1 ? '' : 's'} to fill in.` : '.'),
              extra > 0 || short.total > 0 ? 'warn' : 'info',
            )
            onClose()
          }}
        >
          Build schedule
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
  const { manageAemt: manageAcademy } = useCan()
  const [adding, setAdding] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const totals = courseHourTotals(sessions)
  const recon = reconcileHours(sessions, course.targets)
  const problems = sessionProblems(sessions, course)
  const shortRows = recon.filter((r) => r.delta < 0)
  const missingTime = sessions.filter((s) => s.delivery !== 'assignment' && !s.startTime)

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
          </div>

          {/* The gap the bundled plan cannot close. Stated as an amount owed
              with a way to act on it, not as a footnote under a table. */}
          {shortRows.length > 0 && (
            <div className="banner crit" style={{ marginTop: 10 }}>
              <strong>
                {shortRows.reduce((n, r) => n + -r.delta, 0)} hours short of the filed target.
              </strong>{' '}
              {shortRows.map((r) => `${-r.delta} h ${r.label.toLowerCase()}`).join(', ')} still has
              to be scheduled.
              {manageAcademy && (
                <div className="btn-row" style={{ marginTop: 10 }}>
                  {shortRows.map((r) => (
                    <button
                      key={r.id}
                      className="btn sm"
                      onClick={() => {
                        const n = addPlaceholderSessions(
                          course.id,
                          r.id === 'lab' ? 'lab' : 'didactic',
                          -r.delta,
                          course.startDate,
                        )
                        notifyUser(
                          `Added ${n} unplaced ${r.label.toLowerCase()} session${n === 1 ? '' : 's'} — each needs a date and a subject.`,
                          'warn',
                        )
                      }}
                    >
                      Add {-r.delta} h of {r.label.toLowerCase()} to place
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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

      {/* Assignment rows are excluded on purpose. K.A.R. 109-11-1a(b3) wants the
          time of each CLASS session; Navigate chapter work has no sitting to put
          a clock time on, and flagging it made this warning fire on sixteen
          sessions that were correct. */}
      {sessions.length > 0 && missingTime.length > 0 && (
        <div className="banner warn" style={{ marginTop: 12 }}>
          {missingTime.length} class session{missingTime.length === 1 ? ' has' : 's have'} no start
          time. The filed schedule has to show the time of each session, not only its length.
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 12 }}>
        <span className="subtle">
          {totals.total} h total · {totals.byKind.didactic} didactic · {totals.byKind.lab} lab ·{' '}
          {totals.byKind.clinical} clinical · {totals.byKind.exam} exam
        </span>
        <div className="spacer" />
        {sessions.length > 0 && (
          <div className="btn-row" role="group" aria-label="Schedule view">
            <button
              className={`btn sm${view === 'calendar' ? ' primary' : ''}`}
              onClick={() => setView('calendar')}
            >
              🗓️ Calendar
            </button>
            <button
              className={`btn sm${view === 'list' ? ' primary' : ''}`}
              onClick={() => setView('list')}
            >
              ☰ List
            </button>
          </div>
        )}
        {manageAcademy && sessions.length === 0 && (
          <button
            className="btn"
            title={`Create Tue/Thu sessions for ${KC_COURSE_WEEKS} weeks from the AMR KC content plan. Adjust for another program.`}
            onClick={() => setSeeding(true)}
          >
            ⚡ Build AMR KC {KC_COURSE_WEEKS}-week plan
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
      ) : view === 'calendar' ? (
        <ScheduleCalendar course={course} sessions={sessions} />
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
      {seeding && <SeedModal course={course} onClose={() => setSeeding(false)} />}
    </div>
  )
}
