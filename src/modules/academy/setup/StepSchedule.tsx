import { useState } from 'react'
import { educationMinutesForBlocks, timelineFromBlocks } from '../../../data/academyPhase2'
import { newSession, renumber, sortSessions } from '../program'
import { neopSheetMeta } from '../../templates/resolve'
import { ChipToggle, LinesField, NumberField, RowActions, move } from './fields'
import type { StepProps } from './shared'
import type { BlockKind, TemplateBlock, TemplateSegment, TemplateSession } from '../../../types'

// Step 3 — the academy's days.
//
// A cohort copies these when it is created, and its own dates, start times and
// facilitators are set on the cohort's Schedule tab — so this step is the
// shape of a normal academy, not any particular class.

const KINDS: { value: BlockKind; label: string }[] = [
  { value: 'education', label: 'Teaching' },
  { value: 'hands-on', label: 'Hands-on' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'break', label: 'Break' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'closeout', label: 'Housekeeping' },
]

const hours = (min: number) => {
  const h = min / 60
  return Number.isInteger(h) ? String(h) : h.toFixed(1)
}

function rolesToText(s: TemplateSession): string {
  return (s.facilitatorRoles ?? []).map((r) => r.role + (r.lead ? ' (lead)' : '')).join(', ')
}

function textToRoles(text: string): TemplateSession['facilitatorRoles'] {
  const roles = text
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const lead = /\(lead\)\s*$/i.test(r)
      return { role: r.replace(/\s*\(lead\)\s*$/i, ''), ...(lead ? { lead: true } : {}) }
    })
  return roles.length ? roles : undefined
}

/** One line under a collapsed session: when it runs and how much is teaching. */
function sessionSummary(s: TemplateSession): string {
  if (s.mode === 'at-home') {
    const h = (s.segments ?? []).reduce((sum, x) => sum + (x.hours ?? 0), 0)
    return `At home${h ? ` · about ${hours(h * 60)} h` : ''}`
  }
  const blocks = s.blocks ?? []
  const t = timelineFromBlocks(blocks, s.defaultStart)
  const span = t && t.length ? `${t[0].start}–${t[t.length - 1].end}` : 'no start time'
  return `${span} · ${hours(educationMinutesForBlocks(blocks))} h teaching`
}

function BlockEditor({ blocks, onChange, idPrefix }: { blocks: TemplateBlock[]; onChange: (b: TemplateBlock[]) => void; idPrefix: string }) {
  const set = (i: number, patch: Partial<TemplateBlock>) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  return (
    <div>
      <div className="block-rows">
        {blocks.map((b, i) => (
          <div key={i} className="block-row">
            <label className="sr-only" htmlFor={`${idPrefix}-b${i}`}>Block {i + 1}</label>
            <input id={`${idPrefix}-b${i}`} value={b.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="What happens" />
            <label className="sr-only" htmlFor={`${idPrefix}-m${i}`}>Minutes</label>
            <input
              id={`${idPrefix}-m${i}`}
              type="number"
              min={5}
              step={5}
              value={b.durationMin}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                if (Number.isFinite(n) && n > 0) set(i, { durationMin: n })
              }}
              style={{ width: 80 }}
              aria-describedby={`${idPrefix}-minhint`}
            />
            <label className="sr-only" htmlFor={`${idPrefix}-k${i}`}>Kind</label>
            <select id={`${idPrefix}-k${i}`} value={b.kind} onChange={(e) => set(i, { kind: e.target.value as BlockKind })}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <RowActions
              index={i}
              count={blocks.length}
              label={b.title || `block ${i + 1}`}
              onMove={(from, to) => onChange(move(blocks, from, to))}
              onRemove={() => onChange(blocks.filter((_, j) => j !== i))}
            />
          </div>
        ))}
      </div>
      <div id={`${idPrefix}-minhint`} className="help-text">Minutes. Times are worked out from the start time.</div>
      <button
        type="button"
        className="btn sm"
        onClick={() => onChange([...blocks, { durationMin: 60, kind: 'education', title: '' }])}
      >
        + Add a block
      </button>
    </div>
  )
}

function SegmentEditor({ segments, onChange, idPrefix }: { segments: TemplateSegment[]; onChange: (s: TemplateSegment[]) => void; idPrefix: string }) {
  const set = (i: number, patch: Partial<TemplateSegment>) => onChange(segments.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  return (
    <div>
      <div className="block-rows">
        {segments.map((s, i) => (
          <div key={i} className="block-row">
            <label className="sr-only" htmlFor={`${idPrefix}-s${i}`}>Work {i + 1}</label>
            <input id={`${idPrefix}-s${i}`} value={s.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Module or reading" />
            <label className="sr-only" htmlFor={`${idPrefix}-h${i}`}>Hours</label>
            <input
              id={`${idPrefix}-h${i}`}
              type="number"
              min={0}
              step={0.25}
              value={s.hours ?? ''}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                set(i, { hours: Number.isFinite(n) && n >= 0 ? n : undefined })
              }}
              style={{ width: 80 }}
            />
            <span className="subtle">h</span>
            <RowActions
              index={i}
              count={segments.length}
              label={s.title || `item ${i + 1}`}
              onMove={(from, to) => onChange(move(segments, from, to))}
              onRemove={() => onChange(segments.filter((_, j) => j !== i))}
            />
          </div>
        ))}
      </div>
      <button type="button" className="btn sm" onClick={() => onChange([...segments, { kind: 'lms', title: '', hours: 1 }])}>
        + Add work
      </button>
    </div>
  )
}

function SessionEditor({ s, draft, onChange }: { s: TemplateSession; draft: StepProps['draft']; onChange: (s: TemplateSession) => void }) {
  const id = `ss-${s.id}`
  const runSheets = draft.sheets.map((x) => x.id)
  return (
    <div className="session-editor">
      <div className="field">
        <label htmlFor={`${id}-title`}>Session</label>
        <input id={`${id}-title`} value={s.title} onChange={(e) => onChange({ ...s, title: e.target.value })} />
      </div>
      <div className="field-row trio">
        <div className="field">
          <label htmlFor={`${id}-week`}>Week</label>
          <select id={`${id}-week`} value={s.week} onChange={(e) => onChange({ ...s, week: Number(e.target.value) })}>
            {draft.schedule.weeks.map((w) => (
              <option key={w.n} value={w.n}>
                {w.label || `Week ${w.n}`}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="field-label" id={`${id}-mode`}>Where</span>
          <div className="seg" role="group" aria-labelledby={`${id}-mode`}>
            <button
              type="button"
              className={`btn sm${s.mode === 'in-person' ? ' primary' : ''}`}
              aria-pressed={s.mode === 'in-person'}
              onClick={() =>
                onChange({
                  ...s,
                  mode: 'in-person',
                  defaultStart: s.defaultStart ?? '0900',
                  blocks: s.blocks?.length ? s.blocks : newSession(s.week, []).blocks,
                })
              }
            >
              In person
            </button>
            <button
              type="button"
              className={`btn sm${s.mode === 'at-home' ? ' primary' : ''}`}
              aria-pressed={s.mode === 'at-home'}
              onClick={() =>
                onChange({ ...s, mode: 'at-home', segments: s.segments?.length ? s.segments : [{ kind: 'lms', title: '', hours: 1 }] })
              }
            >
              At home
            </button>
          </div>
        </div>
        {s.mode === 'in-person' && (
          <div className="field">
            <label htmlFor={`${id}-start`}>Starts</label>
            <input
              id={`${id}-start`}
              value={s.defaultStart ?? ''}
              placeholder="0900"
              inputMode="numeric"
              maxLength={5}
              onChange={(e) => onChange({ ...s, defaultStart: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) || undefined })}
            />
          </div>
        )}
      </div>

      {s.mode === 'in-person' && (
        <div className="field">
          <label htmlFor={`${id}-loc`}>Where it's held</label>
          <input
            id={`${id}-loc`}
            value={s.location ?? ''}
            placeholder="Leave blank for your usual classroom"
            onChange={(e) => onChange({ ...s, location: e.target.value || undefined })}
          />
        </div>
      )}

      <div className="field">
        <label htmlFor={`${id}-fac`}>Who teaches it</label>
        <input
          id={`${id}-fac`}
          defaultValue={rolesToText(s)}
          placeholder="CES (lead), HR"
          onBlur={(e) => onChange({ ...s, facilitatorRoles: textToRoles(e.target.value) })}
        />
        <div className="help-text">Roles, not names — names are set per class. Separate with commas; mark one "(lead)".</div>
      </div>

      <LinesField
        id={`${id}-obj`}
        label="By the end, a hire can…"
        help="One per line. Printed on the schedule."
        value={s.objectives}
        onChange={(objectives) => onChange({ ...s, objectives })}
        rows={3}
      />

      {runSheets.length > 0 && (
        <div className="field">
          <span className="field-label">Check-offs done this day</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {runSheets.map((sheet) => {
              const on = !!s.checkoffs?.includes(sheet)
              return (
                <ChipToggle
                  key={sheet}
                  on={on}
                  onClick={() => {
                    const next = on ? (s.checkoffs ?? []).filter((x) => x !== sheet) : [...(s.checkoffs ?? []), sheet]
                    onChange({ ...s, checkoffs: next.length ? next : undefined })
                  }}
                >
                  {neopSheetMeta(sheet).icon} {neopSheetMeta(sheet).short}
                </ChipToggle>
              )
            })}
          </div>
          <div className="help-text">Puts a "whole class" check-off button on this day of the schedule.</div>
        </div>
      )}

      <div className="field">
        <span className="field-label">{s.mode === 'in-person' ? 'The day, in blocks' : 'The work'}</span>
        {s.mode === 'in-person' ? (
          <BlockEditor idPrefix={id} blocks={s.blocks ?? []} onChange={(blocks) => onChange({ ...s, blocks })} />
        ) : (
          <SegmentEditor idPrefix={id} segments={s.segments ?? []} onChange={(segments) => onChange({ ...s, segments })} />
        )}
      </div>
    </div>
  )
}

export default function StepSchedule({ draft, update }: StepProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const sched = draft.schedule
  const weeks = [...sched.weeks].sort((a, b) => a.n - b.n)
  const sessions = sortSessions(sched.sessions)

  const setSessions = (next: TemplateSession[]) =>
    update((p) => ({ ...p, schedule: { ...p.schedule, sessions: renumber(next) } }))
  const setSession = (s: TemplateSession) => setSessions(sched.sessions.map((x) => (x.id === s.id ? s : x)))

  /** Swap a session with its neighbour inside the same week. */
  const shift = (week: number, from: number, to: number) => {
    const inWeek = sessions.filter((s) => s.week === week)
    const others = sessions.filter((s) => s.week !== week)
    setSessions([...others, ...move(inWeek, from, to).map((s, i) => ({ ...s, order: i + 1 }))])
  }

  return (
    <div>
      <p className="step-intro">
        The days of a normal academy, in order. Every new cohort starts with these; dates, start times
        and who's teaching are set per class on the cohort's Schedule tab, and a class can skip or add
        days of its own.
      </p>

      <NumberField
        id="sc-min"
        label="Minimum teaching hours on an in-person day"
        value={sched.minEducationHoursPerDay}
        onChange={(n) => update((p) => ({ ...p, schedule: { ...p.schedule, minEducationHoursPerDay: n } }))}
        min={0}
        max={12}
        step={0.5}
        help="A day with less teaching than this is flagged on the schedule. Breaks, lunch and housekeeping don't count."
        suffix="hours"
      />

      {weeks.map((w) => {
        const inWeek = sessions.filter((s) => s.week === w.n)
        return (
          <section key={w.n} className="week-block" aria-labelledby={`wk-${w.n}`}>
            <div className="week-head">
              <label htmlFor={`wk-${w.n}`} className="sr-only">Name of week {w.n}</label>
              <input
                id={`wk-${w.n}`}
                className="week-name"
                value={w.label}
                onChange={(e) =>
                  update((p) => ({
                    ...p,
                    schedule: { ...p.schedule, weeks: p.schedule.weeks.map((x) => (x.n === w.n ? { ...x, label: e.target.value } : x)) },
                  }))
                }
              />
              {weeks.length > 1 && inWeek.length === 0 && (
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => update((p) => ({ ...p, schedule: { ...p.schedule, weeks: p.schedule.weeks.filter((x) => x.n !== w.n) } }))}
                >
                  Remove week
                </button>
              )}
            </div>

            {inWeek.length === 0 && <div className="subtle" style={{ margin: '6px 0 10px' }}>No sessions in this week yet.</div>}

            <div className="edit-rows">
              {inWeek.map((s, i) => {
                const open = openId === s.id
                return (
                  <div key={s.id} className={`edit-row session-row${open ? ' open' : ''}`}>
                    <div className="session-head">
                      <button type="button" className="session-toggle" aria-expanded={open} onClick={() => setOpenId(open ? null : s.id)}>
                        <span className="session-title">{s.title || 'Untitled session'}</span>
                        <span className="subtle">{sessionSummary(s)}</span>
                        {s.checkoffs?.map((c) => (
                          <span key={c} className="pill muted">{neopSheetMeta(c).short}</span>
                        ))}
                        <span aria-hidden className="subtle">{open ? '▾' : '▸'}</span>
                      </button>
                      <RowActions
                        index={i}
                        count={inWeek.length}
                        label={s.title || 'session'}
                        onMove={(from, to) => shift(w.n, from, to)}
                        onRemove={() => setSessions(sched.sessions.filter((x) => x.id !== s.id))}
                      />
                    </div>
                    {open && <SessionEditor s={s} draft={draft} onChange={setSession} />}
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              className="btn sm"
              aria-label={`Add a session to ${w.label || `week ${w.n}`}`}
              onClick={() => {
                const s = newSession(w.n, sched.sessions.map((x) => x.id))
                setSessions([...sched.sessions, { ...s, order: 10_000 }])
                setOpenId(s.id)
              }}
            >
              + Add a session
            </button>
          </section>
        )
      })}

      <button
        type="button"
        className="btn"
        style={{ marginTop: 16 }}
        onClick={() =>
          update((p) => {
            const n = Math.max(0, ...p.schedule.weeks.map((x) => x.n)) + 1
            return { ...p, schedule: { ...p.schedule, weeks: [...p.schedule.weeks, { n, label: `Week ${n}` }] } }
          })
        }
      >
        + Add a week
      </button>
    </div>
  )
}
