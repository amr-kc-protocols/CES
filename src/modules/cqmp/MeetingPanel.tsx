import { useState } from 'react'
import DebouncedInput from '../../components/DebouncedInput'
import { confirmAction } from '../../lib/dialog'
import { todayISO } from '../../lib/date'
import { CQMP_OFFICERS, officerSeed } from '../../data/cqmp'
import {
  addMinuteRow,
  meetingMinutes,
  removeMinuteRow,
  updateMeeting,
  updateMinuteRow,
  type MinuteTable,
} from './cqmpStore'
import type { CqmpAttendee, CqmpMinuteRow, CqmpReport } from '../../types'

// ---------------------------------------------------------------------------
// Everything the minutes need that the numbers do not: when the meeting was,
// who was in it, and the three tracking tables.
//
// Above the KPI cards on the page, because it is what gets filled in first:
// the meeting is happening, somebody is taking the minutes, and the date, the
// room and the agenda are known before any percentage is typed. The numbers
// below it are the month's work and get done across several sittings.
// ---------------------------------------------------------------------------

const TABLES: { key: MinuteTable; heading: string; topic: string; notes: string; hint: string }[] = [
  {
    key: 'agenda',
    heading: 'Agenda items',
    topic: 'Topic / follow-up',
    notes: 'Notes',
    hint: 'What was discussed, and what happens next.',
  },
  {
    key: 'aqms',
    heading: 'CQMP annual quality measures',
    topic: 'AQM',
    notes: 'Concerns / issues',
    hint: 'The AQM table on the minutes — 2025 measures, 2026 measures, anything under review.',
  },
  {
    key: 'safety',
    heading: 'Patient safety issues',
    topic: 'Topic',
    notes: 'Concerns / issues',
    hint: 'Left empty on most months, and that is a fine thing for a filed document to say.',
  },
]

function PeopleEditor({
  report,
  field,
  label,
  hint,
}: {
  report: CqmpReport
  field: 'attendees' | 'absent'
  label: string
  hint: string
}) {
  const people = report.meeting?.[field] ?? []
  const set = (next: CqmpAttendee[]) => updateMeeting(report.id, { [field]: next })

  return (
    <>
      <div className="section-title" style={{ marginTop: 14 }}>
        {label}
      </div>
      <div className="help-text" style={{ marginTop: 0 }}>
        {hint}
      </div>
      <div className="list">
        {people.map((p, i) => (
          <div key={i} className="row">
            <div className="grow" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <DebouncedInput
                value={p.name}
                placeholder="Name"
                aria-label={`${label} ${i + 1} name`}
                onCommit={(v) =>
                  set(people.map((x, j) => (j === i ? { ...x, name: v } : x)))
                }
              />
              <DebouncedInput
                value={p.title ?? ''}
                placeholder="Title"
                aria-label={`${label} ${i + 1} title`}
                onCommit={(v) =>
                  set(people.map((x, j) => (j === i ? { ...x, title: v } : x)))
                }
              />
            </div>
            <button
              className="btn sm"
              aria-label={`Remove ${p.name || `${label} ${i + 1}`}`}
              onClick={() => set(people.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button className="btn sm" onClick={() => set([...people, { name: '', title: '' }])}>
        + {label.replace(/s$/, '')}
      </button>
    </>
  )
}

function RowEditor({
  report,
  table,
  heading,
  topicLabel,
  notesLabel,
  hint,
}: {
  report: CqmpReport
  table: MinuteTable
  heading: string
  topicLabel: string
  notesLabel: string
  hint: string
}) {
  const rows: CqmpMinuteRow[] = report.meeting?.[table] ?? []
  return (
    <>
      <div className="section-title" style={{ marginTop: 14 }}>
        {heading}
      </div>
      <div className="help-text" style={{ marginTop: 0 }}>
        {hint}
      </div>
      {rows.map((r) => (
        <div key={r.id} className="card" style={{ padding: 12, marginBottom: 8 }}>
          <div className="field-row">
            <div className="field">
              <label htmlFor={`${r.id}-topic`}>{topicLabel}</label>
              <DebouncedInput
                id={`${r.id}-topic`}
                value={r.topic}
                onCommit={(v) => updateMinuteRow(report.id, table, r.id, { topic: v })}
              />
            </div>
            <div className="field" style={{ maxWidth: 150 }}>
              <label htmlFor={`${r.id}-status`}>Status</label>
              <select
                id={`${r.id}-status`}
                value={r.status}
                onChange={(e) =>
                  updateMinuteRow(report.id, table, r.id, {
                    status: e.target.value as 'open' | 'closed',
                  })
                }
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor={`${r.id}-notes`}>{notesLabel}</label>
            <DebouncedInput
              id={`${r.id}-notes`}
              multiline
              value={r.notes ?? ''}
              onCommit={(v) => updateMinuteRow(report.id, table, r.id, { notes: v })}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor={`${r.id}-action`}>Action required</label>
              <DebouncedInput
                id={`${r.id}-action`}
                value={r.action ?? ''}
                onCommit={(v) => updateMinuteRow(report.id, table, r.id, { action: v })}
              />
            </div>
            <div className="field">
              <label htmlFor={`${r.id}-who`}>Assigned to</label>
              <DebouncedInput
                id={`${r.id}-who`}
                value={r.assignedTo ?? ''}
                onCommit={(v) => updateMinuteRow(report.id, table, r.id, { assignedTo: v })}
              />
            </div>
          </div>
          <button
            className="btn sm danger"
            onClick={async () => {
              const ok = await confirmAction({
                title: 'Remove this row?',
                body: r.topic ? `“${r.topic}” comes off the minutes.` : 'The empty row comes off.',
                confirmLabel: 'Remove',
              })
              if (ok) removeMinuteRow(report.id, table, r.id)
            }}
          >
            Remove row
          </button>
        </div>
      ))}
      <button className="btn sm" onClick={() => addMinuteRow(report.id, table)}>
        + Row
      </button>
    </>
  )
}

export default function MeetingPanel({ report }: { report: CqmpReport }) {
  // Open by default. These are the fields somebody sits down to fill in at the
  // start of the meeting, and a panel that has to be found and expanded first
  // is a panel that gets filled in afterwards from memory, if at all.
  const [open, setOpen] = useState(true)
  const meeting = report.meeting ?? {}
  const officers = { ...officerSeed(), ...(meeting.officers ?? {}) }
  const mins = meetingMinutes(meeting)

  return (
    <div className="card" style={{ padding: 14, marginTop: 12 }}>
      <div className="toolbar" style={{ marginTop: 0 }}>
        <div className="grow">
          <div className="section-title" style={{ marginTop: 0 }}>
            Meeting record
          </div>
          <div className="subtle" style={{ fontSize: 12 }}>
            {meeting.date ? `Held ${meeting.date}` : 'No meeting date yet'}
            {mins !== null && ` · ${mins} min`}
            {(meeting.attendees?.length ?? 0) > 0 && ` · ${meeting.attendees!.length} attending`}
          </div>
        </div>
        <button className="btn sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Edit'}
        </button>
      </div>

      {open && (
        <>
          <div className="field-row" style={{ marginTop: 10 }}>
            <div className="field">
              <label htmlFor="mtg-date">Meeting date</label>
              <input
                id="mtg-date"
                type="date"
                value={meeting.date ?? ''}
                onChange={(e) => updateMeeting(report.id, { date: e.target.value })}
              />
              {!meeting.date && (
                <button
                  className="btn sm"
                  style={{ marginTop: 4 }}
                  onClick={() => updateMeeting(report.id, { date: todayISO() })}
                >
                  Today
                </button>
              )}
            </div>
            <div className="field">
              <label htmlFor="mtg-start">Start</label>
              <input
                id="mtg-start"
                type="time"
                value={meeting.startTime ?? ''}
                onChange={(e) => updateMeeting(report.id, { startTime: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="mtg-end">End</label>
              <input
                id="mtg-end"
                type="time"
                value={meeting.endTime ?? ''}
                onChange={(e) => updateMeeting(report.id, { endTime: e.target.value })}
              />
            </div>
          </div>

          <div className="section-title" style={{ marginTop: 14 }}>
            Who held each post
          </div>
          <div className="help-text" style={{ marginTop: 0 }}>
            Carried forward from last month and stored on this report, so a month someone chaired in
            an acting capacity still reads correctly next year.
          </div>
          {CQMP_OFFICERS.map((o) => (
            <div className="field" key={o.role}>
              <label htmlFor={`off-${o.role}`}>
                {o.title} <span className="subtle">({o.short})</span>
              </label>
              <DebouncedInput
                id={`off-${o.role}`}
                value={officers[o.role] ?? ''}
                onCommit={(v) =>
                  updateMeeting(report.id, { officers: { ...officers, [o.role]: v } })
                }
              />
            </div>
          ))}

          <PeopleEditor
            report={report}
            field="attendees"
            label="Attendees"
            hint="Name and title as they should print on the minutes."
          />
          <PeopleEditor
            report={report}
            field="absent"
            label="Absent"
            hint="Anyone expected who was not there."
          />

          {TABLES.map((t) => (
            <RowEditor
              key={t.key}
              report={report}
              table={t.key}
              heading={t.heading}
              topicLabel={t.topic}
              notesLabel={t.notes}
              hint={t.hint}
            />
          ))}
        </>
      )}
    </div>
  )
}
