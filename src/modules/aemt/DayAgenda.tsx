import { Modal } from '../../components/ui'
import { formatDate } from '../../lib/date'
import {
  COURSE_STAFF,
  ROW_BY_TITLE,
  holidayOn,
  type ScheduleRow,
} from '../../data/aemt'
import { assessment, SESSION_TEMPLATE } from '../../data/aemtAssessments'
import { chapterAssets, skillDrills } from '../../data/navigateAssets'
import { standardLabel } from '../../data/aemtStandards'
import { skillSheet } from '../../data/aemtSkills'
import type { AemtSession } from '../../types'

// ---------------------------------------------------------------------------
// One day's agenda, opened by tapping the day on the calendar.
//
// The month grid answers "what shape is this course". This answers the question
// somebody actually has at 0700 on a Monday: what am I doing today, what did
// the students already do, what has to come out of the room before they leave.
//
// It is the same content the printed lesson plan carries, because there should
// only be one answer to that — the plan is what an instructor reads the night
// before and this is what they check on the way in. What it is NOT is the
// filed schedule: hours and attendance live on the stored session, and this
// reads the filed row alongside it for the detail a calendar cell cannot hold.
// A session somebody typed by hand has no filed row, and the sheet says so
// rather than guessing from the nearest title.
// ---------------------------------------------------------------------------

const instructorName = (row?: ScheduleRow): string | undefined => {
  if (!row?.instructor) return undefined
  const who =
    row.instructor === 'co'
      ? COURSE_STAFF.find((s) => s.role !== 'primary')
      : COURSE_STAFF.find((s) => s.role === 'primary')
  return who ? `${who.name}, ${who.credential}` : undefined
}

/** The pre-class row for a week — what students were told to do beforehand. */
function preClassFor(week: number | undefined, rows: ScheduleRow[]): ScheduleRow | undefined {
  if (week === undefined) return undefined
  return rows.find((r) => r.week === week && r.delivery === 'assignment' && !r.standalone)
}

function SessionBlock({ session, allRows }: { session: AemtSession; allRows: ScheduleRow[] }) {
  const row = ROW_BY_TITLE[session.title]
  const assignment = session.delivery === 'assignment'
  const teacher = instructorName(row) ?? session.instructor
  const pre = preClassFor(row?.preClassWeek ?? row?.week, allRows)
  const chapters = pre?.chapters ?? []
  const drills = chapters.length ? skillDrills(chapters) : []
  const events = (row?.assessmentIds ?? []).map((id) => assessment(id)).filter(Boolean)
  const sheets = (row?.sheetIds ?? []).map((id) =>
    id === '@monitor' ? 'Your operation’s cardiac monitor sheet' : (skillSheet(id)?.title ?? id),
  )
  const moduleMinutes = chapters.reduce((n, c) => n + (chapterAssets(c)?.moduleMinutes ?? 0), 0)

  return (
    <div className="card" style={{ padding: 12, marginBottom: 10 }}>
      <div className="title" style={{ fontSize: 15 }}>
        {/* "Before class" is right for a week's pre-class row and wrong for the
            winter break, which is not before anything. */}
        {assignment
          ? row?.standalone
            ? 'Student work'
            : 'Before class'
          : `${session.startTime ?? ''}${session.endTime ? `–${session.endTime}` : ''}`}
        {!assignment && <> · {session.hours} h</>}
        {row?.short ? ` · ${row.short}` : ''}
      </div>
      {teacher && !assignment && (
        <div className="meta">
          Taught by {teacher}
          {row?.instructorNote && ' — see below'}
        </div>
      )}
      <div className="help-text" style={{ marginTop: 6 }}>
        {session.title}
      </div>

      {row?.instructorNote && (
        <div className="banner info" style={{ marginTop: 8 }}>
          {row.instructorNote}
        </div>
      )}

      {!assignment && (row?.sections ?? pre?.sections ?? []).length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 10 }}>
            Standards covered
          </div>
          <div className="list">
            {(row?.sections ?? pre?.sections ?? []).map((c) => (
              <div key={c} className="row">
                <div className="grow">
                  <div className="meta">{standardLabel(c)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!assignment && chapters.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 10 }}>
            What they were told to do first
          </div>
          <div className="help-text" style={{ marginTop: 0 }}>
            Chapters {chapters.join(', ')} — read, module, flashcards and practice activity
            {moduleMinutes ? `, ${moduleMinutes} minutes of module time` : ''}.{' '}
            <strong>Assume they have met this material; do not re-deliver it.</strong>
          </div>
          {drills.length > 0 && (
            <div className="help-text">
              Skill Drills read in advance: {drills.map((d) => `${d.n} (p. ${d.page})`).join(', ')}.
            </div>
          )}
        </>
      )}

      {/* The four hours, block by block. Skipped where the session is an
          examination or a full-length simulation — those run to their own
          clock and the template would be a lie about the room. */}
      {!assignment &&
        !events.some((e) => e?.kind === 'gate' || e?.kind === 'final' || e?.kind === 'simulation') && (
          <>
            <div className="section-title" style={{ marginTop: 10 }}>
              Shape of the session
            </div>
            <div className="list">
              {SESSION_TEMPLATE.map((b) => (
                <div key={b.label} className="row">
                  <div className="grow">
                    <div className="title" style={{ fontSize: 13 }}>
                      {b.start}–{b.end} · {b.label}
                    </div>
                    {b.what && <div className="meta">{b.what}</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      {sheets.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 10 }}>
            Checked off today
          </div>
          <div className="list">
            {sheets.map((t) => (
              <div key={t} className="row left-accent acc-ok">
                <div className="grow">
                  <div className="meta">{t}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="help-text">
            Every student individually, on the sheet, with the evaluator named. A sheet marked
            complete for the group is not a record.
          </div>
        </>
      )}

      {(row?.taughtNotChecked ?? []).length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 10 }}>
            Taught, not checked off
          </div>
          {row!.taughtNotChecked!.map((t) => (
            <div key={t} className="help-text">
              {t}
            </div>
          ))}
        </>
      )}

      {events.length > 0 && (
        <>
          {/*
            "Graded today" over every assessment on the row put an UNGRADED
            diagnostic under a heading saying it counted, and the instructor
            reasonably read that as a test they owed on day one. Two of these
            are ungraded by design — a diagnostic students protect their score
            on tells you nothing — so the heading has to follow the event.
          */}
          <div className="section-title" style={{ marginTop: 10 }}>
            {events.some((e) => e!.gradingComponent) ? 'Assessed today' : 'On the calendar today'}
          </div>
          <div className="list">
            {events.map((e) => (
              <div
                key={e!.id}
                className={`row left-accent ${e!.source === 'unsourced' ? 'acc-bad' : 'acc-warn'}`}
              >
                <div className="grow">
                  <div className="title" style={{ fontSize: 13 }}>
                    {e!.label}
                    {!e!.gradingComponent && <span className="meta"> · ungraded</span>}
                  </div>
                  <div className="meta">
                    {[
                      e!.covers,
                      e!.items ? `${e!.items} items` : '',
                      e!.minutes ? `${e!.minutes} min` : '',
                      e!.proctored ? 'proctored, closed book' : '',
                      e!.mps ? `MPS ${e!.mps}%` : '',
                      e!.source === 'navigate' ? 'in Navigate — it holds the score' : '',
                      e!.source === 'program' ? 'the program administers this' : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {e!.source === 'unsourced' && (
                    <div className="banner danger" style={{ marginTop: 6 }}>
                      <strong>This instrument does not exist yet.</strong>{' '}
                      {e!.sourceNote}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {row?.note && (
        <div className="help-text" style={{ marginTop: 8, fontStyle: 'italic' }}>
          {row.note}
        </div>
      )}

      {!row && (
        <div className="help-text" style={{ marginTop: 8 }}>
          Written by hand rather than seeded from the filed plan, so there is no lesson detail to
          show — what is above is everything this session records.
        </div>
      )}
    </div>
  )
}

export default function DayAgenda({
  date,
  sessions,
  allRows,
  onClose,
}: {
  date: string
  sessions: AemtSession[]
  allRows: ScheduleRow[]
  onClose: () => void
}) {
  const holiday = holidayOn(date)
  const classHours = sessions.reduce(
    (n, s) => n + (s.delivery === 'assignment' ? 0 : s.hours),
    0,
  )

  return (
    <Modal title={formatDate(date)} onClose={onClose}>
      {holiday && (
        <div className="banner warn" style={{ marginTop: 0 }}>
          <strong>{holiday}.</strong> The calendar absorbs the holidays rather than pushing past
          them, so a session here is a deliberate exception.
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="banner info" style={{ marginTop: 0 }}>
          Nothing scheduled. {holiday ? '' : 'Not a class day.'}
        </div>
      ) : (
        <>
          <div className="help-text" style={{ marginTop: 0, marginBottom: 10 }}>
            {sessions.length} entr{sessions.length === 1 ? 'y' : 'ies'}
            {classHours > 0 ? ` · ${Math.round(classHours * 100) / 100} h in the room` : ''}
          </div>
          {sessions.map((s) => (
            <SessionBlock key={s.id} session={s} allRows={allRows} />
          ))}
        </>
      )}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  )
}
