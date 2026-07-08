import { useState } from 'react'
import { Empty } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/date'
import {
  useCohortDays,
  addDay,
  updateDay,
  deleteDay,
  addBlock,
  updateBlock,
  deleteBlock,
  moveBlock,
  moveBlockToDay,
  applyClassroomTemplate,
} from './academyStore'
import { printDoc, downloadDoc, scheduleHTML, safeFilename } from './docGen'
import { scheduleICS, downloadICS } from './calendar'
import type { AcademyCohort, AcademyDay } from '../../types'

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  padding: '5px 8px',
  font: 'inherit',
  fontSize: 13,
}

function DayCard({ day, days }: { day: AcademyDay; days: AcademyDay[] }) {
  const [open, setOpen] = useState(true)
  const [newBlock, setNewBlock] = useState({ time: '', title: '' })

  function addNewBlock() {
    if (!newBlock.title.trim()) return
    addBlock(day.id, { time: newBlock.time.trim(), title: newBlock.title.trim() })
    setNewBlock({ time: '', title: '' })
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="date"
          value={day.date}
          onChange={(e) => e.target.value && updateDay(day.id, { date: e.target.value })}
          style={{ ...inputStyle, fontWeight: 700 }}
          aria-label="Day date"
        />
        <input
          value={day.title}
          onChange={(e) => updateDay(day.id, { title: e.target.value })}
          placeholder="Day theme, e.g. HR & Systems Onboarding"
          style={{ ...inputStyle, flex: 1, minWidth: 180, fontWeight: 700 }}
          aria-label="Day title"
        />
        <button className="btn sm ghost" onClick={() => setOpen(!open)}>
          {open ? 'Collapse' : `Expand (${day.blocks.length})`}
        </button>
        <button
          className="btn sm danger"
          onClick={() => {
            if (confirm(`Remove ${formatDate(day.date)} — ${day.title || 'this day'}?`)) deleteDay(day.id)
          }}
        >
          ✕
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
            <input
              value={day.facilitators ?? ''}
              onChange={(e) => updateDay(day.id, { facilitators: e.target.value })}
              placeholder="Facilitators / instructors"
              style={inputStyle}
              aria-label="Facilitators"
            />
            <input
              value={day.location ?? ''}
              onChange={(e) => updateDay(day.id, { location: e.target.value })}
              placeholder="Location / logistics (optional)"
              style={inputStyle}
              aria-label="Location"
            />
          </div>
          <input
            value={day.note ?? ''}
            onChange={(e) => updateDay(day.id, { note: e.target.value })}
            placeholder="Day note — pending confirmations, fallbacks…"
            style={{ ...inputStyle, width: '100%', marginTop: 8 }}
            aria-label="Day note"
          />

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {day.blocks.map((b, i) => (
              <div key={b.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <input
                  value={b.time}
                  onChange={(e) => updateBlock(day.id, b.id, { time: e.target.value })}
                  placeholder="0900–0915"
                  style={{ ...inputStyle, width: 96 }}
                  aria-label="Block time"
                />
                <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input
                    value={b.title}
                    onChange={(e) => updateBlock(day.id, b.id, { title: e.target.value })}
                    placeholder="Block title"
                    style={inputStyle}
                    aria-label="Block title"
                  />
                  <input
                    value={b.note ?? ''}
                    onChange={(e) => updateBlock(day.id, b.id, { note: e.target.value })}
                    placeholder="Notes (optional)"
                    style={{ ...inputStyle, fontSize: 12, color: 'var(--text-muted)' }}
                    aria-label="Block note"
                  />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn sm" disabled={i === 0} onClick={() => moveBlock(day.id, b.id, -1)} title="Move up">
                    ↑
                  </button>
                  <button
                    className="btn sm"
                    disabled={i === day.blocks.length - 1}
                    onClick={() => moveBlock(day.id, b.id, 1)}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <select
                    value=""
                    onChange={(e) => e.target.value && moveBlockToDay(day.id, b.id, e.target.value)}
                    title="Move to another day"
                    style={{ ...inputStyle, width: 90, fontSize: 12 }}
                    aria-label="Move block to day"
                  >
                    <option value="">Move to…</option>
                    {days
                      .filter((d) => d.id !== day.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {formatDate(d.date)}
                        </option>
                      ))}
                  </select>
                  <button className="btn sm danger" onClick={() => deleteBlock(day.id, b.id)} title="Delete block">
                    ✕
                  </button>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input
                value={newBlock.time}
                onChange={(e) => setNewBlock({ ...newBlock, time: e.target.value })}
                placeholder="Time"
                style={{ ...inputStyle, width: 96 }}
                aria-label="New block time"
              />
              <input
                value={newBlock.title}
                onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addNewBlock()}
                placeholder="Add a block…"
                style={{ ...inputStyle, flex: 1 }}
                aria-label="New block title"
              />
              <button className="btn sm primary" onClick={addNewBlock} disabled={!newBlock.title.trim()}>
                + Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ScheduleEditor({ cohort }: { cohort: AcademyCohort }) {
  const days = useCohortDays(cohort.id)

  return (
    <div>
      <div className="toolbar">
        <button className="btn" onClick={() => addDay(cohort.id, days.length ? days[days.length - 1].date : cohort.startDate || todayISO())}>
          + Add day
        </button>
        {days.length === 0 && (
          <button className="btn primary" onClick={() => applyClassroomTemplate(cohort.id, cohort.startDate)}>
            ⚡ Start from 5-day template
          </button>
        )}
        <div className="spacer" />
        <button
          className="btn"
          disabled={days.length === 0}
          onClick={() => printDoc(`${cohort.label} — Schedule`, scheduleHTML(cohort, days))}
        >
          🖨 Print
        </button>
        <button
          className="btn"
          disabled={days.length === 0}
          onClick={() =>
            downloadDoc(safeFilename(`${cohort.label}_Schedule`), `${cohort.label} — Schedule`, scheduleHTML(cohort, days))
          }
        >
          ⬇ Word
        </button>
        <button
          className="btn"
          disabled={days.length === 0}
          title="Download an .ics calendar file for Outlook / Google / Apple Calendar"
          onClick={() => downloadICS(safeFilename(`${cohort.label}_Academy`), scheduleICS(cohort, days))}
        >
          📅 .ics
        </button>
      </div>

      {days.length === 0 ? (
        <Empty icon="🗓️" title="No schedule yet">
          Start from the 5-day classroom template (HR &amp; Systems · EVOC Classroom · EVOC Road ·
          PCR &amp; ImageTrend · Stretcher &amp; Equipment) and flex from there, or add days one by one.
        </Empty>
      ) : (
        <div className="list">
          {days.map((d) => (
            <DayCard key={d.id} day={d} days={days} />
          ))}
        </div>
      )}
    </div>
  )
}
