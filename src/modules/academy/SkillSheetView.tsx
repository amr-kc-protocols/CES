import { Link, useParams } from 'react-router-dom'
import { Empty, ProgressBar } from '../../components/ui'
import SignaturePad from '../../components/SignaturePad'
import { formatDate, todayISO } from '../../lib/date'
import { allFtos } from '../../data/ftoSchedule'
import { SHEETS, skillsFor } from '../../data/checkoffSheets'
import { useSelector } from '../../lib/store'
import { useCan } from '../../lib/role'
import { printDoc, downloadDoc, checkoffSheetHTML, safeFilename } from './docGen'
import type { SkillSheetId } from '../../types'
import {
  useCohort,
  useSkillCheckFor,
  setSkillResult,
  toggleSkillStep,
  setSkillEvaluator,
  setSkillComments,
  setSkillSignature,
} from './academyStore'

// Check-off sheets, one record per (trainee, sheet). Two rendering styles:
// pass/needs-practice per skill (BLS clinical, stretcher v3.2) and
// step-by-step sign-off (Linn medic, EVOC track) where checking every
// observable item passes the skill. KC & Cass share the BLS clinical sheet;
// Linn County paramedics get their own — the sheets stay separate by design.

export default function SkillSheetView() {
  const { cohortId = '', traineeId = '', sheet: sheetParam } = useParams()
  const cohort = useCohort(cohortId)
  const trainee = useSelector((db) => db.trainees.find((t) => t.id === traineeId))
  const sheet: SkillSheetId =
    sheetParam && sheetParam in SHEETS ? (sheetParam as SkillSheetId) : 'bls'
  const check = useSkillCheckFor(traineeId, sheet)
  // New hires can review their sheet (and print it) but not mark or sign it.
  const readOnly = !useCan().editRideWork

  if (!cohort || !trainee) {
    return (
      <Empty icon="🤔" title="Trainee not found">
        <Link to="/academy" className="link-btn">Back to Academy</Link>
      </Empty>
    )
  }

  const meta = SHEETS[sheet]
  // RSI is Linn-only, ventilator management KC/Cass-only — show each trainee
  // only the skills their operation performs.
  const skills = skillsFor(sheet, trainee.operation)
  const stepStyle = skills.some((s) => s.steps?.length)
  const results = check?.results ?? {}
  const passed = skills.filter((s) => results[s.id] === 'pass').length

  function buildDoc() {
    return checkoffSheetHTML(
      meta.label,
      skills,
      {
        traineeName: trainee!.name,
        date: check?.date ?? todayISO(),
        evaluator: check?.evaluator,
        results,
        steps: check?.steps,
        comments: check?.comments,
        evaluatorSignature: check?.evaluatorSignature,
        evaluatorSignedAt: check?.evaluatorSignedAt,
        traineeSignature: check?.traineeSignature,
        traineeSignedAt: check?.traineeSignedAt,
      },
      meta.note,
    )
  }
  const docTitle = `${meta.label} — ${trainee!.name}`

  return (
    <div>
      <Link to={`/academy/${cohortId}`} className="link-btn">← {cohort.label}</Link>
      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h1>{meta.icon} {meta.label}</h1>
          <div className="subtle">
            {trainee.name} · {passed}/{skills.length} signed off
            {check?.date && ` · last touched ${formatDate(check.date)}`}
          </div>
        </div>
      </div>

      <div style={{ margin: '10px 0 14px' }}>
        <ProgressBar pct={Math.round((passed / skills.length) * 100)} complete={passed === skills.length} />
      </div>

      {meta.note && <div className="banner info">{meta.note}</div>}

      {readOnly && (
        <div className="banner info">
          View only — check-offs are recorded and signed with your FTO or the Clinical Educator.
        </div>
      )}

      <div className="card" style={{ padding: 14, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="subtle" style={{ fontSize: 12, flex: 1, minWidth: 200 }}>
          Assessed by
          <select
            value={check?.evaluator ?? ''}
            disabled={readOnly}
            onChange={(e) => setSkillEvaluator(traineeId, sheet, e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 2, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit' }}
          >
            <option value="">—</option>
            {allFtos().map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      {!stepStyle ? (
        <div className="card" style={{ padding: '6px 14px' }}>
          {skills.map((s) => {
            const r = results[s.id]
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 200 }}>{s.label}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className={`choice${r === 'pass' ? ' active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: 13 }}
                    disabled={readOnly}
                    onClick={() => setSkillResult(traineeId, sheet, s.id, r === 'pass' ? null : 'pass')}
                  >
                    ✓ Pass
                  </button>
                  <button
                    className={`choice${r === 'fail' ? ' active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: 13 }}
                    disabled={readOnly}
                    onClick={() => setSkillResult(traineeId, sheet, s.id, r === 'fail' ? null : 'fail')}
                  >
                    ↻ Needs practice
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="list">
          {skills.map((s) => {
            const done = new Set(check?.steps?.[s.id] ?? [])
            const passedSkill = results[s.id] === 'pass'
            return (
              <details key={s.id} className="card" style={{ padding: '10px 14px' }} open={!passedSkill && done.size > 0}>
                <summary style={{ cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>{s.label}</span>
                  <span className={`pill ${passedSkill ? 'ok' : done.size ? 'info' : 'muted'}`}>
                    {passedSkill ? '✓ Passed' : `${done.size}/${s.steps?.length ?? 0} steps`}
                  </span>
                </summary>
                <div style={{ marginTop: 8 }}>
                  {(s.steps ?? []).map((step, i) => (
                    <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0', fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={done.has(i)}
                        disabled={readOnly}
                        onChange={() => toggleSkillStep(traineeId, sheet, s.id, i, s.steps?.length ?? 0)}
                        style={{ marginTop: 3 }}
                      />
                      <span>{step}</span>
                    </label>
                  ))}
                </div>
              </details>
            )
          })}
        </div>
      )}

      <div className="card" style={{ padding: 14, marginTop: 14 }}>
        <label className="subtle" style={{ fontSize: 12, display: 'block' }}>
          Additional comments
          <textarea
            key={`${traineeId}:${sheet}`}
            defaultValue={check?.comments ?? ''}
            disabled={readOnly}
            onBlur={(e) => setSkillComments(traineeId, sheet, e.target.value)}
            rows={3}
            placeholder="Saved when you tap away"
            style={{ display: 'block', width: '100%', marginTop: 2, padding: '8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', resize: 'vertical' }}
          />
        </label>
      </div>

      {/* Signatures — both parties sign on the same device (phone or laptop). */}
      <div className="section-title">Signatures</div>
      <div className="card" style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
        <SignaturePad
          label={`FTO / Evaluator${check?.evaluator ? ` — ${check.evaluator}` : ''}`}
          value={check?.evaluatorSignature}
          signedAt={check?.evaluatorSignedAt}
          disabled={readOnly}
          onChange={(url) => setSkillSignature(traineeId, sheet, 'evaluator', url)}
        />
        <SignaturePad
          label={`New hire — ${trainee.name}`}
          value={check?.traineeSignature}
          signedAt={check?.traineeSignedAt}
          disabled={readOnly}
          onChange={(url) => setSkillSignature(traineeId, sheet, 'trainee', url)}
        />
      </div>

      {/* Printable copy of the completed sheet, results + signatures baked in. */}
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={() => printDoc(docTitle, buildDoc())}>
          🖨️ Print / Save PDF
        </button>
        <button className="btn" onClick={() => downloadDoc(safeFilename(docTitle), docTitle, buildDoc())}>
          ⬇ Download (.doc)
        </button>
      </div>
    </div>
  )
}
