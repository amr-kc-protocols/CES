// ---------------------------------------------------------------------------
// The course schedule as a wall calendar.
//
// A 62-session list is a scroll, not a schedule — you cannot see from it that
// weeks 9 through 11 are three lab weeks in a row, or that a session landed on
// a holiday. A month grid answers those at a glance, which is the point.
//
// Read-only by design. Editing stays in the list view, where every field is
// reachable and a mis-drag cannot silently move a filed session; clicking a day
// here jumps you there.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { formatDate, fromISODate, monthKey, monthLabel, todayISO, toISODate } from '../../lib/date'
import { BLOCK_SHORT_BY_TITLE, holidayOn } from '../../data/aemt'
import type { AemtCourse, AemtSession, AemtSessionKind } from '../../types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const KIND_META: Record<AemtSessionKind, { label: string; cls: string }> = {
  didactic: { label: 'Didactic', cls: 'didactic' },
  lab: { label: 'Lab', cls: 'lab' },
  clinical: { label: 'Clinical', cls: 'clinical' },
  exam: { label: 'Exam', cls: 'exam' },
  aha: { label: 'AHA', cls: 'aha' },
}

/** Shift a yyyy-mm key by n months. */
function shiftMonth(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * The dates of the 5- or 6-week grid covering a month, starting each week on
 * Sunday. Leading and trailing days belong to the neighbouring months and are
 * rendered dimmed — dropping them instead would misalign the columns.
 */
function monthGrid(key: string): string[] {
  const [y, m] = key.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const start = new Date(y, m - 1, 1 - first.getDay())
  const last = new Date(y, m, 0)
  const cells = Math.ceil((first.getDay() + last.getDate()) / 7) * 7
  return Array.from({ length: cells }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toISODate(d)
  })
}

function DayChip({ session }: { session: AemtSession }) {
  const meta = KIND_META[session.kind]
  // Assignment work is not class time. It carries hours and it counts toward
  // the filed didactic total, but nobody is in a room for it — so it reads as
  // an outline rather than a filled block, and carries no clock time.
  const assignment = session.delivery === 'assignment'
  // Seeded sessions are titled with the block's full content line, which is
  // right on a filed schedule and far too long for a grid cell. The hover title
  // still carries the whole thing.
  const label = BLOCK_SHORT_BY_TITLE[session.title] ?? session.title ?? meta.label
  return (
    <div
      className={`cal-chip ${meta.cls}${assignment ? ' assignment' : ''}`}
      title={`${assignment ? 'Assignment' : meta.label} · ${session.hours} h${session.title ? ` — ${session.title}` : ''}`}
    >
      <span className="cal-chip-time">
        {assignment ? 'Assignment' : (session.startTime ?? meta.label)} · {session.hours} h
      </span>
      <span className="cal-chip-title">{label || meta.label}</span>
    </div>
  )
}

export default function ScheduleCalendar({
  course,
  sessions,
}: {
  course: AemtCourse
  sessions: AemtSession[]
}) {
  // Open on the month the course starts in rather than today's — a coordinator
  // opening a course that runs next spring wants to see the course, not an
  // empty grid for this month.
  const [month, setMonth] = useState(() => monthKey(course.startDate || todayISO()))
  const today = todayISO()

  const byDate = useMemo(() => {
    const map = new Map<string, AemtSession[]>()
    for (const s of sessions) {
      if (!s.date) continue
      const list = map.get(s.date)
      if (list) list.push(s)
      else map.set(s.date, [s])
    }
    // Order within a day by start time, so a day carrying the tail of one block
    // and the head of the next reads top-to-bottom in the order it is taught.
    for (const list of map.values()) {
      list.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    }
    return map
  }, [sessions])

  const grid = useMemo(() => monthGrid(month), [month])

  // Totals for the month on screen, not the whole course — the figure that
  // answers "what does this month cost", which is what a month view is for.
  // Split by delivery, because only the class hours cost anything.
  const monthTotals = useMemo(() => {
    const out = new Map<AemtSessionKind, number>()
    let assignment = 0
    for (const iso of grid) {
      if (monthKey(iso) !== month) continue
      for (const s of byDate.get(iso) ?? []) {
        if (s.delivery === 'assignment') assignment += s.hours
        else out.set(s.kind, (out.get(s.kind) ?? 0) + s.hours)
      }
    }
    return { byKind: out, assignment }
  }, [grid, byDate, month])

  const unplaced = sessions.filter((s) => !s.date)
  const classHours = [...monthTotals.byKind.values()].reduce((n, h) => n + h, 0)

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="btn sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
          ‹
        </button>
        <h2 className="cal-month">{monthLabel(month)}</h2>
        <button className="btn sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
          ›
        </button>
        <div className="spacer" />
        <button className="btn sm" onClick={() => setMonth(monthKey(course.startDate || today))}>
          Course start
        </button>
        <button className="btn sm" onClick={() => setMonth(monthKey(today))}>
          Today
        </button>
      </div>

      <div className="cal-legend">
        {(Object.keys(KIND_META) as AemtSessionKind[]).map((k) => {
          const hours = monthTotals.byKind.get(k) ?? 0
          if (hours === 0) return null
          return (
            <span key={k} className={`cal-key ${KIND_META[k].cls}`}>
              <i /> {KIND_META[k].label} · {Math.round(hours * 100) / 100} h
            </span>
          )
        })}
        {monthTotals.assignment > 0 && (
          <span className="cal-key assignment">
            <i /> Assignment · {Math.round(monthTotals.assignment * 100) / 100} h
          </span>
        )}
        {classHours === 0 && monthTotals.assignment === 0 ? (
          <span className="subtle">No sessions this month.</span>
        ) : (
          <span className="subtle">
            {Math.round(classHours * 100) / 100} h in class this month
          </span>
        )}
      </div>

      <div className="cal-grid" role="grid">
        {WEEKDAYS.map((d) => (
          <div key={d} className="cal-dow" role="columnheader">
            {d}
          </div>
        ))}
        {grid.map((iso) => {
          const day = byDate.get(iso) ?? []
          const inMonth = monthKey(iso) === month
          // A session outside the recorded course dates is already flagged in
          // the list view; shading the day makes the pattern visible — a whole
          // block hanging off the end reads very differently from one stray day.
          const outside =
            !!course.startDate && !!course.endDate && (iso < course.startDate || iso > course.endDate)
          const holiday = inMonth ? holidayOn(iso) : undefined
          // The day badge counts class time only — an assignment logged against
          // this date is not four more hours in the room.
          const hours = day.reduce((n, s) => n + (s.delivery === 'assignment' ? 0 : s.hours), 0)
          return (
            <div
              key={iso}
              role="gridcell"
              className={[
                'cal-day',
                inMonth ? '' : 'other-month',
                iso === today ? 'is-today' : '',
                day.length > 0 && outside ? 'is-outside' : '',
                holiday ? 'is-holiday' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="cal-daynum">
                <span>{fromISODate(iso).getDate()}</span>
                {hours > 0 && <span className="cal-dayhours">{Math.round(hours * 100) / 100} h</span>}
              </div>
              {/* Named on the day itself. A three-week gap in January is
                  otherwise an unexplained hole, and the first question anyone
                  asks about a schedule is why nothing is happening. */}
              {holiday && <div className="cal-holiday">{holiday}</div>}
              {day.map((s) => (
                <DayChip key={s.id} session={s} />
              ))}
            </div>
          )
        })}
      </div>

      {unplaced.length > 0 && (
        <div className="banner warn" style={{ marginTop: 12 }}>
          <strong>
            {unplaced.length} session{unplaced.length === 1 ? '' : 's'} with no date
          </strong>{' '}
          cannot appear on a calendar — {unplaced.reduce((n, s) => n + s.hours, 0)} h carried by
          sessions nobody has placed yet. They are listed in the list view.
        </div>
      )}

      {course.startDate && course.endDate && (
        <div className="help-text" style={{ marginTop: 10 }}>
          Course runs {formatDate(course.startDate)} – {formatDate(course.endDate)}. Shaded days fall
          outside that range.
        </div>
      )}
    </div>
  )
}
