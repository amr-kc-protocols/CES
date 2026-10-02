import { useState } from 'react'
import { fromISODate } from '../../../lib/date'
import { shiftWindow } from '../../../data/ftoSchedule'
import { ChipToggle, NameList, RowActions, move } from './fields'
import type { StepProps } from './shared'
import type { FtoCrew } from '../../../types'

// Step 5 — the operation's FTOs, and the shifts they work.
//
// The ride planner (FTO Shifts) and the dashboard's "on a truck today" read
// these. Kansas City's shipped with its master schedule transcribed; anyone
// else enters theirs here, which is the point: the old way was a code change.

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const clock = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 4)

/** Shift length from a start and end time; an end at or before the start runs past midnight. */
function lengthOf(start: string, end: string): number | undefined {
  if (start.length !== 4 || end.length !== 4) return undefined
  const s = Number(start.slice(0, 2)) * 60 + Number(start.slice(2))
  const e = Number(end.slice(0, 2)) * 60 + Number(end.slice(2))
  const mins = e > s ? e - s : e + 24 * 60 - s
  return Math.round((mins / 60) * 10) / 10
}

function DayGrid({ label, days, onChange, idPrefix }: { label: string; days: number[]; onChange: (d: number[]) => void; idPrefix: string }) {
  return (
    <div className="day-grid" role="group" aria-labelledby={`${idPrefix}-lbl`}>
      <span id={`${idPrefix}-lbl`} className="subtle day-grid-label">
        {label}
      </span>
      {DAYS.map((d, i) => (
        <ChipToggle
          key={i}
          on={days.includes(i)}
          title={DAY_NAMES[i]}
          onClick={() => onChange(days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort())}
        >
          <span aria-hidden>{d}</span>
          <span className="sr-only">{DAY_NAMES[i]}</span>
        </ChipToggle>
      ))}
    </div>
  )
}

function CrewEditor({ c, ftoNames, onChange, idPrefix }: { c: FtoCrew; ftoNames: string[]; onChange: (c: FtoCrew) => void; idPrefix: string }) {
  const onFtos = c.crew.filter((m) => m.fto).map((m) => m.name)
  const partners = c.crew.filter((m) => !m.fto).map((m) => m.name)
  const setTimes = (patch: { start?: string; end?: string }) => {
    const start = patch.start ?? c.start
    const end = patch.end ?? c.end
    onChange({ ...c, ...patch, hours: lengthOf(start, end) ?? c.hours })
  }
  const cycle = !!c.cycle
  return (
    <div className="session-editor">
      <div className="field-row trio">
        <div className="field">
          <label htmlFor={`${idPrefix}-unit`}>Unit</label>
          <input id={`${idPrefix}-unit`} value={c.unit} placeholder="TOP12" onChange={(e) => onChange({ ...c, unit: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-start`}>Starts</label>
          <input id={`${idPrefix}-start`} value={c.start} inputMode="numeric" maxLength={4} placeholder="0700" onChange={(e) => setTimes({ start: clock(e.target.value) })} />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-end`}>Ends</label>
          <input id={`${idPrefix}-end`} value={c.end} inputMode="numeric" maxLength={4} placeholder="1900" onChange={(e) => setTimes({ end: clock(e.target.value) })} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${idPrefix}-level`}>Type of truck</label>
          <input id={`${idPrefix}-level`} value={c.level} placeholder="ALS" onChange={(e) => onChange({ ...c, level: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-hours`}>Shift length</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              id={`${idPrefix}-hours`}
              type="number"
              min={1}
              max={96}
              value={c.hours}
              style={{ maxWidth: 100 }}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                if (Number.isFinite(n) && n > 0) onChange({ ...c, hours: n })
              }}
            />
            <span className="subtle">hours</span>
          </div>
          <div className="help-text">Worked out from the times; change it for a 24- or 48-hour shift.</div>
        </div>
      </div>

      <div className="field">
        <span className="field-label">FTO on this truck</span>
        {ftoNames.length === 0 ? (
          <div className="subtle">Add your FTOs above first.</div>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ftoNames.map((n) => (
              <ChipToggle
                key={n}
                on={onFtos.includes(n)}
                onClick={() => {
                  const next = onFtos.includes(n) ? onFtos.filter((x) => x !== n) : [...onFtos, n]
                  onChange({ ...c, crew: [...next.map((name) => ({ name, fto: true })), ...partners.map((name) => ({ name, fto: false }))] })
                }}
              >
                {n}
              </ChipToggle>
            ))}
          </div>
        )}
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-partner`}>Partner (optional)</label>
        <input
          id={`${idPrefix}-partner`}
          defaultValue={partners.join(', ')}
          placeholder="Not an FTO — shown beside the FTO's name"
          onBlur={(e) => {
            const names = e.target.value.split(',').map((x) => x.trim()).filter(Boolean)
            onChange({ ...c, crew: [...onFtos.map((name) => ({ name, fto: true })), ...names.map((name) => ({ name, fto: false }))] })
          }}
        />
      </div>

      <div className="field">
        <span className="field-label" id={`${idPrefix}-pat`}>When this truck runs</span>
        <div className="seg" role="group" aria-labelledby={`${idPrefix}-pat`} style={{ marginBottom: 10 }}>
          <button
            type="button"
            className={`btn sm${!cycle ? ' primary' : ''}`}
            aria-pressed={!cycle}
            onClick={() => {
              const { cycle: _c, ...rest } = c
              void _c
              onChange({ ...rest, week1: c.week1 ?? [], week2: c.week2 ?? [] })
            }}
          >
            Days of the week
          </button>
          <button
            type="button"
            className={`btn sm${cycle ? ' primary' : ''}`}
            aria-pressed={cycle}
            onClick={() => onChange({ ...c, cycle: c.cycle ?? { anchor: new Date().toISOString().slice(0, 10), onDays: 2, cycleDays: 6 } })}
          >
            On / off cycle
          </button>
        </div>
        {!cycle ? (
          <>
            <DayGrid label="Week 1" idPrefix={`${idPrefix}-w1`} days={c.week1 ?? []} onChange={(week1) => onChange({ ...c, week1 })} />
            <DayGrid label="Week 2" idPrefix={`${idPrefix}-w2`} days={c.week2 ?? []} onChange={(week2) => onChange({ ...c, week2 })} />
            <div className="help-text">Tap the days it runs in each week of your two-week rotation. Same both weeks? Tap the same days twice.</div>
          </>
        ) : (
          <div className="field-row trio">
            <div className="field">
              <label htmlFor={`${idPrefix}-on`}>Days on</label>
              <input
                id={`${idPrefix}-on`}
                type="number"
                min={1}
                value={c.cycle!.onDays}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  if (n > 0) onChange({ ...c, cycle: { ...c.cycle!, onDays: n, cycleDays: Math.max(c.cycle!.cycleDays, n + 1) } })
                }}
              />
            </div>
            <div className="field">
              <label htmlFor={`${idPrefix}-cyc`}>Repeats every</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  id={`${idPrefix}-cyc`}
                  type="number"
                  min={2}
                  value={c.cycle!.cycleDays}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    if (n > c.cycle!.onDays) onChange({ ...c, cycle: { ...c.cycle!, cycleDays: n } })
                  }}
                />
                <span className="subtle">days</span>
              </div>
            </div>
            <div className="field">
              <label htmlFor={`${idPrefix}-anc`}>A first day on</label>
              <input id={`${idPrefix}-anc`} type="date" value={c.cycle!.anchor} onChange={(e) => e.target.value && onChange({ ...c, cycle: { ...c.cycle!, anchor: e.target.value } })} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function StepFtos({ draft, update }: StepProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const f = draft.ftos
  const setFtos = (patch: Partial<typeof f>) => update((p) => ({ ...p, ftos: { ...p.ftos, ...patch } }))
  const anchorIsSunday = fromISODate(f.anchor).getDay() === 0

  return (
    <div>
      <p className="step-intro">
        Your FTOs appear wherever someone signs a skill sheet or a daily evaluation. Add the shifts they
        work and FTO Shifts will show who is on a truck each day, so rides can be planned around them.
        Shifts are optional — skip them and plan rides directly with each FTO.
      </p>

      <div className="field">
        <span className="field-label">FTOs</span>
        <NameList id="ft-names" label="Add an FTO" names={f.names} onChange={(names) => setFtos({ names })} placeholder="Type a name and press Enter" />
      </div>

      <div className="field">
        <span className="field-label">Other evaluators</span>
        <div className="help-text" style={{ marginTop: 0, marginBottom: 6 }}>
          Educators who sign skill sheets and daily evaluations but don't run rides.
        </div>
        <NameList id="ft-evals" label="Add an evaluator" names={f.evaluators} onChange={(evaluators) => setFtos({ evaluators })} placeholder="Type a name and press Enter" />
      </div>

      <fieldset className="field plain-fieldset">
        <legend>Shifts with an FTO aboard</legend>
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="ft-anchor">Week 1 of your rotation starts on</label>
          <input id="ft-anchor" type="date" value={f.anchor} onChange={(e) => e.target.value && setFtos({ anchor: e.target.value })} />
          <div className={`help-text${anchorIsSunday ? '' : ' crit-text'}`}>
            {anchorIsSunday ? 'Any Week 1 Sunday works — the pattern repeats both ways from it.' : 'Pick a Sunday: weeks here run Sunday to Saturday.'}
          </div>
        </div>

        <div className="edit-rows">
          {f.crews.map((c, i) => {
            const open = openIdx === i
            const ftosAboard = c.crew.filter((m) => m.fto).map((m) => m.name).join(', ')
            return (
              <div key={i} className={`edit-row session-row${open ? ' open' : ''}`}>
                <div className="session-head">
                  <button type="button" className="session-toggle" aria-expanded={open} onClick={() => setOpenIdx(open ? null : i)}>
                    <span className="session-title">{c.unit || 'New shift'}</span>
                    <span className="subtle">
                      {c.start && c.end ? shiftWindow(c) : 'no times'} · {ftosAboard || 'no FTO picked'}
                    </span>
                    <span aria-hidden className="subtle">{open ? '▾' : '▸'}</span>
                  </button>
                  <RowActions
                    index={i}
                    count={f.crews.length}
                    label={c.unit || 'shift'}
                    onMove={(from, to) => setFtos({ crews: move(f.crews, from, to) })}
                    onRemove={() => {
                      setFtos({ crews: f.crews.filter((_, j) => j !== i) })
                      setOpenIdx(null)
                    }}
                  />
                </div>
                {open && (
                  <CrewEditor
                    idPrefix={`cr-${i}`}
                    c={c}
                    ftoNames={f.names}
                    onChange={(next) => setFtos({ crews: f.crews.map((x, j) => (j === i ? next : x)) })}
                  />
                )}
              </div>
            )
          })}
        </div>
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            setFtos({ crews: [...f.crews, { unit: '', level: 'ALS', start: '0700', end: '1900', hours: 12, crew: [], week1: [], week2: [] }] })
            setOpenIdx(f.crews.length)
          }}
        >
          + Add a shift
        </button>
      </fieldset>
    </div>
  )
}
