import { Link, useParams } from 'react-router-dom'
import { Empty, ProgressBar } from '../../components/ui'
import {
  FT_SLOTS,
  EXPOSURE_GROUPS,
  requiredMarks,
  sectionsFor,
  type FTObjective,
} from '../../data/ftObjectives'
import { CREDENTIAL_LABELS } from '../../data/academy'
import { operationShort } from '../../data/operations'
import { formatDate } from '../../lib/date'
import {
  useCohort,
  useCohortTrainees,
  addFieldMark,
  removeFieldMark,
  toggleSectionAck,
  addExposure,
  removeExposure,
  updateTrainee,
  fieldProgress,
} from './academyStore'
import { printDoc, downloadDoc, objectivesPageHTML, safeFilename } from './docGen'
import type { Trainee } from '../../types'

// The FTO-facing fillable version of the Field Training Objectives Page:
// same sections, objectives, targets, and exposure log as the printed sheet,
// but marks are tapped in during the ride and stamped with shift + FTO.

function MarkChips({ trainee, objective }: { trainee: Trainee; objective: FTObjective }) {
  const marks = trainee.fieldMarks?.[objective.id] ?? []
  const required = requiredMarks(objective.target)
  const met = marks.length >= required
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {marks.map((m, i) => (
        <span
          key={i}
          className={`pill ${met ? 'ok' : 'info'}`}
          title={`Shift ${m.shift} · ${formatDate(m.date)}${m.fto ? ` · ${m.fto}` : ''}`}
        >
          S{m.shift}
          {m.fto ? ` ${m.fto}` : ''}
        </span>
      ))}
      {marks.length > 0 && (
        <button
          className="btn sm ghost"
          onClick={() => removeFieldMark(trainee.id, objective.id)}
          title="Remove the most recent mark"
          aria-label={`Remove last mark for ${objective.id}`}
        >
          −
        </button>
      )}
      <button
        className={`btn sm ${met ? '' : 'primary'}`}
        disabled={marks.length >= FT_SLOTS}
        onClick={() => addFieldMark(trainee.id, objective.id)}
        aria-label={`Add mark for ${objective.id}`}
      >
        + Mark
      </button>
    </div>
  )
}

export default function FieldChecklistView() {
  const { cohortId = '', traineeId = '' } = useParams()
  const cohort = useCohort(cohortId)
  const trainee = useCohortTrainees(cohortId).find((t) => t.id === traineeId)

  if (!cohort || !trainee) {
    return (
      <div>
        <Link to={`/academy/${cohortId}`} className="link-btn">
          ← Back to cohort
        </Link>
        <Empty icon="🔍" title="Trainee not found" />
      </div>
    )
  }

  const sections = sectionsFor(trainee.credential)
  const prog = fieldProgress(trainee)
  const shift = trainee.currentShift ?? 1
  const exposureTotal = Object.values(trainee.exposure ?? {}).filter((v) => v.length > 0).length

  const sectionProgress = (sId: string) => {
    const s = sections.find((x) => x.id === sId)!
    const done = s.objectives.filter(
      (o) => (trainee.fieldMarks?.[o.id]?.length ?? 0) >= requiredMarks(o.target),
    ).length
    return { done, total: s.objectives.length }
  }

  const jumpTo = (id: string) =>
    document.getElementById(`ft-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div>
      <Link to={`/academy/${cohortId}`} className="link-btn">
        ← {cohort.label}
      </Link>

      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h1>{trainee.name}</h1>
          <div className="subtle">
            Field Training Objectives · {operationShort(trainee.operation)} ·{' '}
            {CREDENTIAL_LABELS[trainee.credential]}
          </div>
        </div>
      </div>

      <div style={{ margin: '10px 0 4px' }}>
        <ProgressBar pct={prog.total ? Math.round((prog.done / prog.total) * 100) : 0} complete={prog.done === prog.total} />
        <div className="subtle" style={{ marginTop: 4 }}>
          {prog.done}/{prog.total} objectives at target · {exposureTotal} call types exposed
        </div>
      </div>

      {/* Ride context: everything tapped below is stamped with this. */}
      <div className="card" style={{ padding: 12, marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>
              Current shift
            </div>
            <div className="segmented">
              {Array.from({ length: FT_SLOTS }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  className={shift === n ? 'active' : ''}
                  onClick={() => updateTrainee(trainee.id, { currentShift: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="subtle" style={{ fontSize: 12, flex: 1, minWidth: 150 }}>
            FTO initials (stamped on new marks)
            <input
              value={trainee.activeFto ?? ''}
              onChange={(e) => updateTrainee(trainee.id, { activeFto: e.target.value || undefined })}
              placeholder="e.g. MR"
              style={{ display: 'block', width: '100%', marginTop: 2, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit' }}
            />
          </label>
        </div>
      </div>

      {/* Jump chips: one tap to any section — the page is 50+ objectives long. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
        {sections.map((s) => {
          const sp = sectionProgress(s.id)
          const complete = sp.done === sp.total
          return (
            <button
              key={s.id}
              className={`choice${complete ? ' active' : ''}`}
              style={{ padding: '6px 12px', fontSize: 13 }}
              onClick={() => jumpTo(s.id)}
              title={`${s.title} — ${sp.done}/${sp.total} at target`}
            >
              {s.id}
              {complete ? ' ✓' : ` ${sp.done}/${sp.total}`}
            </button>
          )
        })}
        <button className="choice" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => jumpTo('I')}>
          I · Exposure
        </button>
      </div>

      <div className="toolbar" style={{ marginTop: 12 }}>
        <div className="spacer" />
        <button
          className="btn"
          onClick={() => printDoc(`${trainee.name} — Field Training Objectives`, objectivesPageHTML(trainee))}
        >
          🖨 Print (marks filled in)
        </button>
        <button
          className="btn"
          onClick={() =>
            downloadDoc(
              safeFilename(`${trainee.name}_Field_Objectives`),
              `${trainee.name} — Field Training Objectives`,
              objectivesPageHTML(trainee),
            )
          }
        >
          ⬇ Word
        </button>
      </div>

      {sections.map((s) => {
        const sectionDone = s.objectives.every(
          (o) => (trainee.fieldMarks?.[o.id]?.length ?? 0) >= requiredMarks(o.target),
        )
        const ackDate = trainee.sectionAck?.[s.id]
        const sp = sectionProgress(s.id)
        return (
          <div key={s.id} id={`ft-section-${s.id}`} className="card" style={{ padding: 14, marginTop: 12, scrollMarginTop: 74 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15, flex: 1 }}>{s.title}</h3>
              {sectionDone ? (
                <span className="pill ok">All at target</span>
              ) : (
                <span className="pill muted">
                  {sp.done}/{sp.total}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {s.objectives.map((o) => {
                const met = (trainee.fieldMarks?.[o.id]?.length ?? 0) >= requiredMarks(o.target)
                return (
                  <div key={o.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', opacity: met ? 0.62 : 1 }}>
                      <span className="subtle" style={{ fontWeight: 700, minWidth: 28 }}>
                        {met ? '✓' : o.id}
                      </span>
                      <span style={{ flex: 1 }}>{o.text}</span>
                      <span className={`pill ${met ? 'ok' : 'muted'}`} title="Occurrences required">
                        {o.target}
                      </span>
                    </div>
                    <div style={{ paddingLeft: 36 }}>
                      <MarkChips trainee={trainee} objective={o} />
                    </div>
                  </div>
                )
              })}
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
              <input type="checkbox" checked={!!ackDate} onChange={() => toggleSectionAck(trainee.id, s.id)} />
              <span className="subtle" style={{ fontSize: 13 }}>
                Trainee acknowledges Section {s.id} complete
                {ackDate ? ` · ${formatDate(ackDate)}` : ''}
              </span>
            </label>
          </div>
        )
      })}

      <div id="ft-section-I" className="card" style={{ padding: 14, marginTop: 12, scrollMarginTop: 74 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>I. Call Type Exposure</h3>
        <div className="subtle" style={{ fontSize: 13, marginBottom: 10 }}>
          One tap per occurrence — an exposure log, not a competence check-off. Use gaps to plan
          targeted shifts.
        </div>
        {EXPOSURE_GROUPS.map((g) => (
          <div key={g.label} style={{ marginBottom: 10 }}>
            <div className="subtle" style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
              {g.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {g.types.map((ct) => {
                const hits = trainee.exposure?.[ct] ?? []
                return (
                  <div key={ct} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ flex: 1 }}>{ct}</span>
                    {hits.length > 0 && (
                      <span className="pill ok" title={`Shifts: ${hits.join(', ')}`}>
                        {hits.length}×
                      </span>
                    )}
                    {hits.length > 0 && (
                      <button
                        className="btn sm ghost"
                        onClick={() => removeExposure(trainee.id, ct)}
                        title="Remove the most recent occurrence"
                        aria-label={`Remove exposure for ${ct}`}
                      >
                        −
                      </button>
                    )}
                    <button className="btn sm" onClick={() => addExposure(trainee.id, ct)} aria-label={`Add exposure for ${ct}`}>
                      +
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
