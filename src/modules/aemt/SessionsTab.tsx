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
  rebuildKcSchedule,
  rebuildPreview,
  seedShortfall,
  addPlaceholderSessions,
  sessionProblems,
  parseClock,
  updateCourse,
} from './aemtStore'
import {
  buildClassPlan,
  CLASS_HOURS_PER_WEEK,
  duplicatedChapters,
  FILED_SUMMARY,
  holidayCollisions,
  KC_CALENDAR_WEEKS,
  KC_CLASS_PATTERN,
  KC_COURSE_WEEKS,
  KC_END_DATE,
  KC_START_DATE,
  scheduleTotals,
  WINTER_BREAK,
  KC_HOLIDAYS,
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
  { value: 'aha', label: 'AHA course', cls: 'info' },
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
function SeedModal({
  course,
  onClose,
  rebuild = false,
}: {
  course: AemtCourse
  onClose: () => void
  rebuild?: boolean
}) {
  const preview = rebuild ? rebuildPreview(course.id) : undefined
  const [clearUnmatched, setClearUnmatched] = useState(false)
  const plan = scheduleTotals()
  const short = seedShortfall(course.targets)
  const [alsoPlace, setAlsoPlace] = useState(short.total > 0)
  // The plan lays KC_COURSE_WEEKS of Mon/Thu sessions from the first Monday on
  // or after the start date. A course whose own end date falls sooner gets a
  // schedule that runs past it, and every session beyond gets flagged as
  // outside the course dates — better said before building than discovered
  // as a wall of warnings afterwards. The span is derived: when the block plan
  // grew from 16 weeks to 23, a hard-coded 15 here would have quietly stopped
  // warning about the seven weeks that now overrun.
  const lastSeeded = addDays(course.startDate, (KC_COURSE_WEEKS - 1) * 7 + 9)
  const runsPast = lastSeeded > course.endDate

  // WHAT THIS WILL ACTUALLY LAY.
  //
  // buildClassPlan re-dates the filed plan by whole weeks from the course's
  // own start date, so a course created before the plan moved rebuilds to the
  // OLD dates — a plausible-looking Monday/Thursday calendar, a week wrong,
  // with sessions on Thanksgiving, New Year's Eve and MLK Day. Nothing said
  // so: the seeder's own note says a shifted plan has to be re-checked against
  // its year's holidays, and nothing was calling the function that does it.
  const laid = buildClassPlan(course.startDate).filter((s) => s.startTime)
  const firstClass = laid[0]
  const lastClass = laid[laid.length - 1]
  const drifted = course.startDate !== KC_START_DATE
  const collisions = holidayCollisions(course.startDate)

  return (
    <Modal
      title={rebuild ? 'Rebuild the schedule from the filed plan' : `Build the AMR KC ${KC_COURSE_WEEKS}-week plan`}
      onClose={onClose}
    >
      {(drifted || collisions.length > 0) && (
        <div className={collisions.length > 0 ? 'banner danger' : 'banner warn'}>
          <strong>
            This course starts {formatDate(course.startDate)}; the filed plan starts{' '}
            {formatDate(KC_START_DATE)}.
          </strong>{' '}
          The plan is re-dated by whole weeks to fit, so building here lays{' '}
          {formatDate(firstClass.date)} to {formatDate(lastClass.date)} — not the dates the KBEMS
          application, the syllabus and the student guide were built from.
          {collisions.length > 0 && (
            <>
              <div style={{ marginTop: 8 }}>
                <strong>
                  {collisions.length} session{collisions.length === 1 ? '' : 's'} would land on a
                  day the program does not meet:
                </strong>
              </div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
                {collisions.map((c) => (
                  <li key={c.date}>
                    {formatDate(c.date)} — {c.holiday}, carrying {c.label}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div style={{ marginTop: 10 }}>
            <button
              className="btn sm primary"
              onClick={() => updateCourse(course.id, { startDate: KC_START_DATE, endDate: KC_END_DATE })}
            >
              Move this course to {formatDate(KC_START_DATE)} – {formatDate(KC_END_DATE)}
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className={preview.attended.length + preview.manual.length > 0 ? 'banner warn' : 'banner info'}>
          <strong>
            {preview.removable.length} session{preview.removable.length === 1 ? '' : 's'} will be
            replaced.
          </strong>{' '}
          Two kinds are kept instead.
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
            <li>
              <strong>{preview.attended.length}</strong> with attendance recorded against{' '}
              {preview.attended.length === 1 ? 'it' : 'them'} — that is a record of who was in a
              room, not a plan, and rebuilding must not destroy it.
            </li>
            <li>
              <strong>{preview.manual.length}</strong> matching neither the seeder's mark nor any
              title in the filed plan.
            </li>
          </ul>
          {preview.manual.length > 0 && (
            <>
              <div style={{ marginTop: 8 }}>
                That second group is ambiguous. A session added by hand looks exactly like one
                seeded under an <em>older</em> plan, because changing the plan renames the titles
                a rebuild matches on. If this course was built before the Kansas City and Wichita
                schedules were merged into the joint October 2026 plan, these are stale and should
                go.
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={clearUnmatched}
                  onChange={(e) => setClearUnmatched(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  Also replace those {preview.manual.length}. Leave unchecked to keep them and
                  remove any duplicates by hand.
                </span>
              </label>
            </>
          )}
          <div style={{ marginTop: 8 }}>This is undoable for a few seconds after it runs.</div>
        </div>
      )}
      <p style={{ marginTop: 0, lineHeight: 1.55 }}>
        Lays the joint {KC_COURSE_WEEKS}-week schedule that AMR Kansas City and AMR Wichita agreed
        for the October 2026 cohort —{' '}
        <strong>
          {plan.didactic} didactic + {plan.lab} lab
        </strong>
        {plan.aha > 0 && <>, plus {plan.aha} h of AHA provider courses</>}. {plan.classroom} hours
        in total.
      </p>
      <p style={{ lineHeight: 1.55 }} className="subtle">
        <strong>{plan.f2f} h of that is face-to-face</strong>, across {plan.f2fWeeks} class weeks —{' '}
        {KC_CLASS_PATTERN.days.length} classes a week of {KC_CLASS_PATTERN.hoursPerDay} hours (
        {CLASS_HOURS_PER_WEEK} h a week) from{' '}
        {String(Math.floor(KC_CLASS_PATTERN.startMinute / 60)).padStart(2, '0')}:
        {String(KC_CLASS_PATTERN.startMinute % 60).padStart(2, '0')}. The other {plan.assignment} h
        is Navigate modules, flashcards and practice activities the student
        completes on their own, so it costs no class time. {KC_COURSE_WEEKS} instructional weeks
        over {KC_CALENDAR_WEEKS} calendar weeks, ending {formatDate(KC_END_DATE)}.
      </p>

      {course.targets ? (
        short.total > 0 ? (
          <div className="banner crit">
            <strong>This plan cannot reach your filed target on its own.</strong> The course files{' '}
            {course.targets.didactic} didactic, {course.targets.lab} lab
            {typeof course.targets.aha === 'number' && <> and {course.targets.aha} AHA</>} hours;
            the plan lays out {plan.didactic}, {plan.lab}
            {typeof course.targets.aha === 'number' && <> and {plan.aha}</>}. That leaves{' '}
            <strong>
              {[
                short.didactic > 0 && `${short.didactic} h didactic`,
                short.lab > 0 && `${short.lab} h lab`,
                short.aha > 0 && `${short.aha} h AHA`,
              ]
                .filter(Boolean)
                .join(', ')}
            </strong>{' '}
            unaccounted for. This course's filed targets do not match the agreed schedule — it is a
            defect in one document or the other, not a rounding error, and it has to be closed
            before a KBEMS submission.
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
        <strong>How the calendar absorbs the holidays.</strong> Nothing is pushed. The dates below
        are the agreement, not a projection, which is why re-seeding cannot quietly move them.
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
          <li>
            <strong>A deliberate two-week break</strong>, {formatDate(WINTER_BREAK.start)} to{' '}
            {formatDate(WINTER_BREAK.end)}, replaces four sessions that would have been half empty.
            Christmas Eve, Christmas Day, New Year's Eve and New Year's Day all fall inside it. The
            break is loaded, not idle — concentrated clinical and field shifts plus three dated
            TestPrep sets.
          </li>
          {/*
            Written out by hand this read "MLK Day and Presidents' Day are
            Mondays and never touch the pattern" — true on the Tuesday/Thursday
            calendar it was written for, and false the moment class moved to
            Mondays. The holidays outside the break say for themselves how they
            are handled.
          */}
          {KC_HOLIDAYS.filter(
            (h) => h.date < WINTER_BREAK.start || h.date > WINTER_BREAK.end,
          ).map((h) => (
            <li key={h.date}>
              <strong>{h.name}</strong>, {formatDate(h.date)}. {h.absorbedBy}
            </li>
          ))}
        </ul>
      </div>

      <div className="banner info">
        <strong>Where these hours differ from the plan's own summary line.</strong> The document
        summarises {FILED_SUMMARY.f2fDidactic} h face-to-face didactic and {FILED_SUMMARY.assignment}{' '}
        h pre-class; its own rows sum to {plan.f2fDidactic} and {plan.assignment}. The rows are what
        is filed — the schedule is what KBEMS reviews against — and the document itself says to tune
        the split to whatever totals go to the board, because the sequencing is the part that
        matters. Week 15 is filed here as 4 h didactic + 4 h lab rather than the document's 6 + 4,
        which would be ten hours in a week that holds two four-hour sessions.
        {duplicatedChapters().length > 0 && (
          <div style={{ marginTop: 8 }}>
            <strong>
              Chapter{duplicatedChapters().length === 1 ? ' ' : 's '}
              {duplicatedChapters().join(' and ')}{' '}
              {duplicatedChapters().length === 1 ? 'is' : 'are'} assigned twice.
            </strong>{' '}
            Every chapter of the fourth edition should appear exactly once — the duplicate chapters
            17 and 18 that Wichita's 2025 filing carried were fixed in the joint plan, so this is a
            new defect rather than an inherited one.
          </div>
        )}
      </div>

      {holidayCollisions(course.startDate).length > 0 && (
        <div className="banner crit">
          <strong>
            {holidayCollisions(course.startDate).length} session
            {holidayCollisions(course.startDate).length === 1 ? '' : 's'} would land on a holiday.
          </strong>{' '}
          This course starts {formatDate(course.startDate)}, not{' '}
          {formatDate(KC_START_DATE)}, so the plan has been shifted by whole weeks — and the
          holidays the agreed calendar was built to absorb no longer fall where they did. These
          dates need deciding before the schedule is filed.
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
            {holidayCollisions(course.startDate).map((h) => (
              <li key={h.date}>
                <strong>{formatDate(h.date)}</strong> — {h.label}, on {h.holiday}
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
            const out = rebuild
              ? rebuildKcSchedule(course.id, course.startDate, clearUnmatched)
              : seedKcSchedule(course.id, course.startDate)
            let extra = 0
            if (alsoPlace && short.didactic > 0) {
              extra += addPlaceholderSessions(course.id, 'didactic', short.didactic, course.startDate)
            }
            if (alsoPlace && short.lab > 0) {
              extra += addPlaceholderSessions(course.id, 'lab', short.lab, course.startDate)
            }
            if (alsoPlace && short.aha > 0) {
              extra += addPlaceholderSessions(course.id, 'aha', short.aha, course.startDate, 8)
            }
            notifyUser(
              `Created ${out.sessions} sessions (${out.didactic} h didactic, ${out.lab} h lab)` +
                (extra > 0 ? ` plus ${extra} unplaced session${extra === 1 ? '' : 's'} to fill in.` : '.'),
              extra > 0 || short.total > 0 ? 'warn' : 'info',
            )
            onClose()
          }}
        >
          {rebuild ? 'Rebuild schedule' : 'Build schedule'}
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
  const [rebuilding, setRebuilding] = useState(false)
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
            title={`Create Mon/Thu sessions for ${KC_COURSE_WEEKS} weeks from the AMR KC content plan. Adjust for another program.`}
            onClick={() => setSeeding(true)}
          >
            ⚡ Build AMR KC {KC_COURSE_WEEKS}-week plan
          </button>
        )}
        {/* A course seeded under an older plan would otherwise keep it forever:
            the build button hides once sessions exist, and clearing them meant
            deleting sixty-odd rows one at a time. */}
        {manageAcademy && sessions.length > 0 && (
          <button
            className="btn"
            title="Replace the seeded sessions with the current filed plan. Sessions with attendance, and any added by hand, are kept."
            onClick={() => setRebuilding(true)}
          >
            ↻ Rebuild from filed plan
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
      {rebuilding && (
        <SeedModal course={course} rebuild onClose={() => setRebuilding(false)} />
      )}
    </div>
  )
}
