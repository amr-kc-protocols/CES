import { useRef, useState } from 'react'
import { Empty, Modal } from '../../components/ui'
import { addDays, formatDate, fromISODate, todayISO } from '../../lib/date'
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
  shiftCohortDays,
  nextWeekdays,
} from './academyStore'
import { printDoc, downloadDoc, scheduleHTML, safeFilename } from './docGen'
import { scheduleICS, downloadICS, parseBlockTime, weekdayLabel } from './calendar'
import type { AcademyCohort, AcademyDay } from '../../types'

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  padding: '5px 8px',
  font: 'inherit',
  fontSize: 13,
}

const TIME_HINT = 'Times like 0900–0915 (or 0900) become timed calendar events in the .ics export.'

/** Style + tooltip for a time input whose text won't parse into a real time. */
function timeInputProps(time: string): { style: React.CSSProperties; title?: string } {
  const invalid = time.trim() !== '' && !parseBlockTime(time)
  return invalid
    ? {
        style: { borderColor: 'var(--crit, #dc2626)' },
        title: `Time not recognized — it will show as text but won't become a timed calendar event. ${TIME_HINT}`,
      }
    : { style: {}, title: TIME_HINT }
}

function isWeekend(iso: string): boolean {
  const dow = fromISODate(iso).getDay()
  return dow === 0 || dow === 6
}

function DayCard({
  day,
  days,
  open,
  onToggle,
}: {
  day: AcademyDay
  days: AcademyDay[]
  open: boolean
  onToggle: () => void
}) {
  const [newBlock, setNewBlock] = useState({ time: '', title: '' })
  const newTimeRef = useRef<HTMLInputElement>(null)

  function addNewBlock() {
    if (!newBlock.title.trim()) return
    addBlock(day.id, { time: newBlock.time.trim(), title: newBlock.title.trim() })
    setNewBlock({ time: '', title: '' })
    // Keep the flow going: next entry starts at the time field.
    newTimeRef.current?.focus()
  }

  function removeBlock(blockId: string, title: string, note?: string) {
    // Blocks with real content take effort to recreate; empty ones don't.
    if (!title.trim() && !note?.trim()) return deleteBlock(day.id, blockId)
    if (confirm(`Delete block "${title || 'untitled'}"?`)) deleteBlock(day.id, blockId)
  }

  const newTime = timeInputProps(newBlock.time)

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          className={`pill ${isWeekend(day.date) ? 'warn' : 'muted'}`}
          title={isWeekend(day.date) ? 'This day falls on a weekend' : undefined}
        >
          {weekdayLabel(day.date)}
        </span>
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
        <button className="btn sm ghost" onClick={onToggle}>
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
            {day.blocks.map((b, i) => {
              const t = timeInputProps(b.time)
              return (
                <div key={b.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <input
                    value={b.time}
                    onChange={(e) => updateBlock(day.id, b.id, { time: e.target.value })}
                    placeholder="0900–0915"
                    style={{ ...inputStyle, width: 96, ...t.style }}
                    title={t.title}
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
                            {weekdayLabel(d.date)} {formatDate(d.date)}
                          </option>
                        ))}
                    </select>
                    <button className="btn sm danger" onClick={() => removeBlock(b.id, b.title, b.note)} title="Delete block">
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}

            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input
                ref={newTimeRef}
                value={newBlock.time}
                onChange={(e) => setNewBlock({ ...newBlock, time: e.target.value })}
                placeholder="0900–0915"
                style={{ ...inputStyle, width: 96, ...newTime.style }}
                title={newTime.title}
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

function ShiftDatesModal({
  cohortId,
  days,
  onClose,
}: {
  cohortId: string
  days: AcademyDay[]
  onClose: () => void
}) {
  const first = days[0]
  const [newStart, setNewStart] = useState(first.date)
  const delta = Math.round(
    (fromISODate(newStart).getTime() - fromISODate(first.date).getTime()) / 86400000,
  )

  return (
    <Modal title="Shift all schedule dates" onClose={onClose}>
      <div className="field">
        <label>New first day</label>
        <input type="date" value={newStart} onChange={(e) => e.target.value && setNewStart(e.target.value)} />
        <div className="help-text">
          Every day moves by the same amount, so the spacing between days is preserved.
        </div>
      </div>
      {delta !== 0 && (
        <div className="banner info">
          All {days.length} day{days.length === 1 ? '' : 's'} move {Math.abs(delta)} day
          {Math.abs(delta) === 1 ? '' : 's'} {delta > 0 ? 'later' : 'earlier'}:{' '}
          {weekdayLabel(first.date)} {formatDate(first.date)} → {weekdayLabel(newStart)}{' '}
          {formatDate(newStart)}
          {delta % 7 !== 0 && ' — weekdays change; double-check for weekends.'}
        </div>
      )}
      <div className="btn-row">
        <button
          className="btn primary"
          disabled={delta === 0}
          onClick={() => {
            shiftCohortDays(cohortId, delta)
            onClose()
          }}
        >
          Shift dates
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

export default function ScheduleEditor({ cohort }: { cohort: AcademyCohort }) {
  const days = useCohortDays(cohort.id)
  // Days default to open; ids in this set are collapsed.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showShift, setShowShift] = useState(false)
  const allCollapsed = days.length > 0 && days.every((d) => collapsed.has(d.id))

  function toggleDay(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addNextDay() {
    // Default to the next weekday after the last scheduled day so consecutive
    // "+ Add day" clicks build a sensible week instead of stacking on one date.
    const date = days.length
      ? nextWeekdays(addDays(days[days.length - 1].date, 1), 1)[0]
      : cohort.startDate || todayISO()
    const day = addDay(cohort.id, date)
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.delete(day.id)
      return next
    })
  }

  return (
    <div>
      <div className="toolbar">
        <button className="btn" onClick={addNextDay}>
          + Add day
        </button>
        {days.length === 0 && (
          <button className="btn primary" onClick={() => applyClassroomTemplate(cohort.id, cohort.startDate)}>
            ⚡ Start from 5-day template
          </button>
        )}
        {days.length > 0 && (
          <>
            <button
              className="btn"
              title="Move the whole schedule when the academy start date changes"
              onClick={() => setShowShift(true)}
            >
              ⇄ Shift dates
            </button>
            <button
              className="btn ghost"
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(days.map((d) => d.id)))}
            >
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
          </>
        )}
        <div className="spacer" />
        <button
          className="btn"
          disabled={days.length === 0}
          title={days.length === 0 ? 'Add schedule days first' : undefined}
          onClick={() => printDoc(`${cohort.label} — Schedule`, scheduleHTML(cohort, days))}
        >
          🖨 Print
        </button>
        <button
          className="btn"
          disabled={days.length === 0}
          title={days.length === 0 ? 'Add schedule days first' : undefined}
          onClick={() =>
            downloadDoc(safeFilename(`${cohort.label}_Schedule`), `${cohort.label} — Schedule`, scheduleHTML(cohort, days))
          }
        >
          ⬇ Word
        </button>
        <button
          className="btn"
          disabled={days.length === 0}
          title={
            days.length === 0
              ? 'Add schedule days first'
              : 'Download an .ics calendar file for Outlook / Google / Apple Calendar'
          }
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
            <DayCard key={d.id} day={d} days={days} open={!collapsed.has(d.id)} onToggle={() => toggleDay(d.id)} />
          ))}
        </div>
      )}

      {showShift && days.length > 0 && (
        <ShiftDatesModal cohortId={cohort.id} days={days} onClose={() => setShowShift(false)} />
      )}
    </div>
  )
}
