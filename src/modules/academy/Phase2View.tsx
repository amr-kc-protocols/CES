import { useMemo, useState } from 'react'
import { Modal } from '../../components/ui'
import {
  PHASE2_TEMPLATE,
  educationMinutes,
  isUnderMinHours,
  parseClock,
  timeline,
} from '../../data/academyPhase2'
import { resourceFor, resourceUrl } from '../../data/fieldGuide'
import { addDays, formatDate } from '../../lib/date'
import { printDoc, downloadDoc, phase2ScheduleHTML, safeFilename } from './docGen'
import { weekdayLabel } from './calendar'
import {
  useArrangements,
  setArrangement,
  setSessionBlocks,
  resetSessionBlocks,
  useCohortDays,
  nextWeekdays,
  fillPhase2Dates,
  phase2Dates,
  type Phase2Cadence,
} from './academyStore'
import type { AcademyCohort, BlockKind, TemplateBlock, TemplateSession } from '../../types'

const KIND_LABEL: Record<TemplateBlock['kind'], string> = {
  education: 'Education',
  'hands-on': 'Hands-on',
  assessment: 'Assessment',
  break: 'Break',
  lunch: 'Lunch',
  closeout: 'Housekeeping',
}

const KIND_CLS: Record<TemplateBlock['kind'], string> = {
  education: 'info',
  'hands-on': 'ok',
  assessment: 'warn',
  break: 'muted',
  lunch: 'muted',
  closeout: 'muted',
}

const KIND_ORDER: BlockKind[] = ['education', 'hands-on', 'assessment', 'break', 'lunch', 'closeout']

/** The block list actually in effect for a class: edited if present, else template. */
function effectiveBlocks(
  session: TemplateSession,
  edited: TemplateBlock[] | undefined,
): TemplateBlock[] {
  return edited && edited.length ? edited : session.blocks ?? []
}

const fmtHours = (min: number): string => {
  const h = min / 60
  return Number.isInteger(h) ? `${h}` : h.toFixed(1)
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  padding: '5px 8px',
  font: 'inherit',
  fontSize: 13,
}

function ResourceChips({ refs }: { refs?: string[] }) {
  if (!refs || refs.length === 0) return null
  return (
    <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {refs.map((ref) => {
        const r = resourceFor(ref)
        const url = resourceUrl(ref)
        if (!r || !url) return null
        return (
          <a
            key={ref}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="pill info"
            style={{ textDecoration: 'none' }}
            title={url}
          >
            ↗ {r.label}
          </a>
        )
      })}
    </div>
  )
}

function SessionCard({ cohortId, session }: { cohortId: string; session: TemplateSession }) {
  const arrangements = useArrangements(cohortId)
  const arr = arrangements[session.id]
  const [editing, setEditing] = useState(false)

  const blocks = effectiveBlocks(session, arr?.blocks)
  const customized = !!(arr?.blocks && arr.blocks.length)
  const eduMin = educationMinutes(session, blocks)
  const under = isUnderMinHours(session, PHASE2_TEMPLATE.minEducationHoursPerDay, blocks)
  const effectiveStart = arr?.startTime || session.defaultStart
  const rows = timeline(session, effectiveStart, blocks)
  const endsAt = rows && rows.length ? rows[rows.length - 1].end : null
  const totalMin = blocks.reduce((s, b) => s + b.durationMin, 0)

  const set = (patch: Parameters<typeof setArrangement>[2]) => setArrangement(cohortId, session.id, patch)

  // --- block editing (per class) ---
  const mutate = (fn: (bs: TemplateBlock[]) => TemplateBlock[]) => {
    const clone = blocks.map((b) => ({ ...b, resources: b.resources ? [...b.resources] : undefined }))
    setSessionBlocks(cohortId, session.id, fn(clone))
  }
  const updateBlock = (i: number, patch: Partial<TemplateBlock>) =>
    mutate((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  const moveBlock = (i: number, dir: -1 | 1) =>
    mutate((bs) => {
      const j = i + dir
      if (j < 0 || j >= bs.length) return bs
      const next = [...bs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const deleteBlock = (i: number) => mutate((bs) => bs.filter((_, j) => j !== i))
  const addBlock = () =>
    mutate((bs) => [...bs, { durationMin: 15, kind: 'education', title: 'New block' }])

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>
          <span className="subtle" style={{ fontWeight: 600 }}>Session {session.order}</span> · {session.title}
        </h3>
        {session.mode === 'at-home' && <span className="pill muted">At home</span>}
        {customized && <span className="pill info" title="This class has edited blocks">Edited</span>}
        <span className={`pill ${under ? 'crit' : 'ok'}`} style={{ marginLeft: 'auto' }}>
          {fmtHours(eduMin)} hrs education{under ? ` · under ${PHASE2_TEMPLATE.minEducationHoursPerDay}` : ''}
        </span>
      </div>

      {session.placement && <div className="help-text" style={{ marginTop: 4 }}>{session.placement}</div>}

      <ul className="subtle" style={{ margin: '8px 0', paddingLeft: 18, lineHeight: 1.5 }}>
        {session.objectives.map((o, i) => (
          <li key={i}>{o}</li>
        ))}
      </ul>

      {/* arrangement layer */}
      <div style={{ display: 'grid', gridTemplateColumns: session.mode === 'at-home' ? '1fr 1fr' : '1fr 1fr 1fr', gap: 8, margin: '4px 0 12px', alignItems: 'end' }}>
        <label className="subtle" style={{ fontSize: 12 }}>
          Date
          <input type="date" value={arr?.date ?? ''} onChange={(e) => set({ date: e.target.value || undefined })} style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 2 }} />
        </label>
        {session.mode !== 'at-home' && (
          <label className="subtle" style={{ fontSize: 12 }}>
            Start time (HHMM)
            <input
              value={arr?.startTime ?? ''}
              onChange={(e) => set({ startTime: e.target.value || undefined })}
              placeholder={`${session.defaultStart ?? '0900'} (default)`}
              inputMode="numeric"
              title={
                arr?.startTime && parseClock(arr.startTime) === undefined
                  ? 'Time not recognized — use HHMM, e.g. 0900. The clock schedule falls back to the default start.'
                  : 'HHMM, e.g. 0900'
              }
              style={{
                ...inputStyle,
                display: 'block',
                width: '100%',
                marginTop: 2,
                ...(arr?.startTime && parseClock(arr.startTime) === undefined
                  ? { borderColor: 'var(--crit, #dc2626)' }
                  : {}),
              }}
            />
          </label>
        )}
        <label className="subtle" style={{ fontSize: 12 }}>
          Facilitators
          <input
            value={arr?.facilitators ?? ''}
            onChange={(e) => set({ facilitators: e.target.value || undefined })}
            placeholder={(session.facilitatorRoles ?? []).map((r) => r.role).join(' · ')}
            style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 2 }}
          />
        </label>
      </div>

      {/* timeline / segments */}
      {session.mode === 'at-home' ? (
        <div className="list">
          {(session.segments ?? []).map((seg, i) => (
            <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div className="title">
                  {seg.title}
                  {seg.hours ? <span className="subtle" style={{ fontWeight: 500 }}> · {seg.hours} hrs</span> : null}
                  {seg.system ? <span className="pill muted" style={{ marginLeft: 8 }}>{seg.system}</span> : null}
                </div>
                {seg.notes && <div className="meta">{seg.notes}</div>}
                {seg.gatesSession && (
                  <div className="meta" style={{ color: 'var(--warn, #b45309)' }}>
                    Must finish before Session {PHASE2_TEMPLATE.sessions.find((x) => x.id === seg.gatesSession)?.order ?? '?'}
                  </div>
                )}
                <ResourceChips refs={seg.resources} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span className="subtle" style={{ fontSize: 12 }}>
              {rows && endsAt ? `Runs ${rows[0].start}–${endsAt}` : `${fmtHours(totalMin)} h of blocks`} · {fmtHours(eduMin)} h teaching
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {customized && (
                <button
                  className="btn sm ghost"
                  onClick={() => {
                    if (confirm('Reset this session’s blocks to the template default?')) {
                      resetSessionBlocks(cohortId, session.id)
                      setEditing(false)
                    }
                  }}
                >
                  Reset to template
                </button>
              )}
              <button className="btn sm" onClick={() => setEditing(!editing)}>
                {editing ? 'Done' : '✎ Edit blocks'}
              </button>
            </div>
          </div>

          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {blocks.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={b.durationMin}
                    onChange={(e) => updateBlock(i, { durationMin: Math.max(0, Number(e.target.value) || 0) })}
                    style={{ ...inputStyle, width: 62 }}
                    aria-label="Duration in minutes"
                    title="Minutes"
                  />
                  <input
                    value={b.title}
                    onChange={(e) => updateBlock(i, { title: e.target.value })}
                    style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                    aria-label="Block title"
                  />
                  <select
                    value={b.kind}
                    onChange={(e) => updateBlock(i, { kind: e.target.value as BlockKind })}
                    style={{ ...inputStyle, width: 118 }}
                    aria-label="Block kind"
                  >
                    {KIND_ORDER.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn sm" disabled={i === 0} onClick={() => moveBlock(i, -1)} title="Move up">↑</button>
                    <button className="btn sm" disabled={i === blocks.length - 1} onClick={() => moveBlock(i, 1)} title="Move down">↓</button>
                    <button className="btn sm danger" onClick={() => deleteBlock(i)} title="Delete block">✕</button>
                  </div>
                </div>
              ))}
              <button className="btn sm primary" onClick={addBlock} style={{ alignSelf: 'flex-start', marginTop: 2 }}>
                + Block
              </button>
              <div className="help-text">
                Durations are minutes. Clock times recompute from the session start. Break, lunch, and
                housekeeping don’t count toward teaching hours.
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 92 }}>{rows ? 'Time' : 'Duration'}</th>
                    <th>Block</th>
                    <th style={{ width: 92 }}>Kind</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? blocks.map((block) => ({ start: '', end: '', block }))).map((r, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{rows ? `${r.start}–${r.end}` : `${r.block.durationMin}m`}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.block.title}</div>
                        {r.block.notes && <div className="subtle" style={{ fontSize: 12 }}>{r.block.notes}</div>}
                        <ResourceChips refs={r.block.resources} />
                      </td>
                      <td>
                        <span className={`pill ${KIND_CLS[r.block.kind]}`}>{KIND_LABEL[r.block.kind]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {session.mode !== 'in-person' ? null : !rows && (
        <div className="help-text" style={{ marginTop: 6 }}>Set a start time to see the clock schedule.</div>
      )}
      {session.retrieval && session.retrieval.pullsFrom.length > 0 && (
        <div className="help-text" style={{ marginTop: 6 }}>
          Cumulative retrieval pulls from:{' '}
          {session.retrieval.pullsFrom
            .map((id) => `Session ${PHASE2_TEMPLATE.sessions.find((x) => x.id === id)?.order ?? id}`)
            .join(', ')}
          .
        </div>
      )}
    </div>
  )
}

function FillDatesModal({ cohort, onClose }: { cohort: AcademyCohort; onClose: () => void }) {
  const phase1Days = useCohortDays(cohort.id)
  const sessions = [...PHASE2_TEMPLATE.sessions].sort((a, b) => a.order - b.order)
  // Phase 2 naturally follows the classroom week: default to the next weekday
  // after the last Phase 1 day, or the cohort start if no schedule exists yet.
  const defaultStart = phase1Days.length
    ? nextWeekdays(addDays(phase1Days[phase1Days.length - 1].date, 1), 1)[0]
    : nextWeekdays(cohort.startDate, 1)[0]
  const [start, setStart] = useState(defaultStart)
  const [paceIdx, setPaceIdx] = useState(0)
  const dates = phase2Dates(start, sessions.length, PACES[paceIdx].value)

  return (
    <Modal title="Fill Phase 2 dates" onClose={onClose}>
      <div className="field-row">
        <div className="field">
          <label>Session 1 date</label>
          <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>Pace</label>
          <select value={paceIdx} onChange={(e) => setPaceIdx(Number(e.target.value))}>
            {PACES.map((p, i) => (
              <option key={i} value={i}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="help-text" style={{ marginTop: -6 }}>
        Spread the clinical phase over a longer time frame (weekly / bi-weekly) for hires who can’t
        attend a full week. Existing dates are overwritten (undoable); start times and facilitators
        are kept. Adjust any session after.
      </div>
      <div className="list" style={{ gap: 4, margin: '10px 0' }}>
        {sessions.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <span className="subtle" style={{ width: 130 }}>
              {weekdayLabel(dates[i])} {formatDate(dates[i])}
            </span>
            <span style={{ flex: 1 }}>
              Session {s.order} · {s.title}
            </span>
            {s.mode === 'at-home' && <span className="pill muted">At home</span>}
          </div>
        ))}
      </div>
      <div className="btn-row">
        <button
          className="btn primary"
          onClick={() => {
            fillPhase2Dates(cohort.id, start, PACES[paceIdx].value)
            onClose()
          }}
        >
          Fill dates
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

const PACES: { value: Phase2Cadence; label: string }[] = [
  { value: 'weekdays', label: 'Consecutive weekdays (one week)' },
  { value: 'weekly', label: 'One session per week' },
  { value: 14, label: 'One every two weeks' },
]

export default function Phase2View({ cohort }: { cohort: AcademyCohort }) {
  const arrangements = useArrangements(cohort.id)
  const [showFill, setShowFill] = useState(false)
  const t = PHASE2_TEMPLATE

  const underCount = useMemo(
    () =>
      t.sessions.filter((s) =>
        isUnderMinHours(s, t.minEducationHoursPerDay, effectiveBlocks(s, arrangements[s.id]?.blocks)),
      ).length,
    [t, arrangements],
  )

  return (
    <div>
      <div className="banner info">
        <strong>{t.name}</strong> — {t.phase.name}. Sessions are a fixed sequence; set each session's
        date, start time, and facilitators for this class. Academy completion is an internal record —
        not CE.
      </div>

      <div className="toolbar" style={{ marginTop: 12 }}>
        <span className="subtle">
          {t.sessions.length} sessions · min {t.minEducationHoursPerDay} education hrs/day
          {underCount > 0 && <span className="pill crit" style={{ marginLeft: 8 }}>{underCount} under minimum</span>}
        </span>
        <div className="spacer" />
        <button
          className="btn primary"
          title="Map the session sequence onto consecutive weekdays"
          onClick={() => setShowFill(true)}
        >
          ⚡ Fill dates
        </button>
        <button className="btn" onClick={() => printDoc(`${cohort.label} — Phase 2`, phase2ScheduleHTML(cohort, arrangements))}>
          🖨 Print
        </button>
        <button
          className="btn"
          onClick={() =>
            downloadDoc(safeFilename(`${cohort.label}_Phase2`), `${cohort.label} — Phase 2`, phase2ScheduleHTML(cohort, arrangements))
          }
        >
          ⬇ Word
        </button>
      </div>

      <div className="list" style={{ marginTop: 12 }}>
        {t.sessions.map((s) => (
          <SessionCard key={s.id} cohortId={cohort.id} session={s} />
        ))}
      </div>

      {showFill && <FillDatesModal cohort={cohort} onClose={() => setShowFill(false)} />}
    </div>
  )
}
