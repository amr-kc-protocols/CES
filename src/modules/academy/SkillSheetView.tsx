import { Link, useParams } from 'react-router-dom'
import { Empty, ProgressBar } from '../../components/ui'
import { formatDate } from '../../lib/date'
import { allFtos } from '../../data/ftoSchedule'
import { BLS_SKILLS, LINN_MEDIC_SKILLS } from '../../data/skillSheets'
import { useSelector } from '../../lib/store'
import {
  useCohort,
  useSkillCheckFor,
  sheetFor,
  setSkillResult,
  toggleSkillStep,
  setSkillEvaluator,
  setSkillComments,
} from './academyStore'

// Clinical skill sheets. KC & Cass share the BLS Clinical Skills Assessment
// (pass / needs-work per skill); Linn County paramedics sign off observable
// steps per skill — a skill passes when every step is checked. The two sheets
// are intentionally separate: keep each consistent with its operation.

export default function SkillSheetView() {
  const { cohortId = '', traineeId = '' } = useParams()
  const cohort = useCohort(cohortId)
  const trainee = useSelector((db) => db.trainees.find((t) => t.id === traineeId))
  const check = useSkillCheckFor(traineeId)

  if (!cohort || !trainee) {
    return (
      <Empty icon="🤔" title="Trainee not found">
        <Link to="/academy" className="link-btn">Back to Academy</Link>
      </Empty>
    )
  }

  const sheet = sheetFor(trainee)
  const skills = sheet === 'linn-medic' ? LINN_MEDIC_SKILLS : BLS_SKILLS
  const results = check?.results ?? {}
  const passed = skills.filter((s) => results[s.id] === 'pass').length

  return (
    <div>
      <Link to={`/academy/${cohortId}`} className="link-btn">← {cohort.label}</Link>
      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h1>{sheet === 'linn-medic' ? 'Linn County paramedic skill sheet' : 'BLS clinical skills assessment'}</h1>
          <div className="subtle">
            {trainee.name} · {passed}/{skills.length} signed off
            {check?.date && ` · last touched ${formatDate(check.date)}`}
          </div>
        </div>
      </div>

      <div style={{ margin: '10px 0 14px' }}>
        <ProgressBar pct={Math.round((passed / skills.length) * 100)} complete={passed === skills.length} />
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="subtle" style={{ fontSize: 12, flex: 1, minWidth: 200 }}>
          Assessed by
          <select
            value={check?.evaluator ?? ''}
            onChange={(e) => setSkillEvaluator(traineeId, e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 2, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit' }}
          >
            <option value="">—</option>
            {allFtos().map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      {sheet === 'bls' ? (
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
                    onClick={() => setSkillResult(traineeId, s.id, r === 'pass' ? null : 'pass')}
                  >
                    ✓ Pass
                  </button>
                  <button
                    className={`choice${r === 'fail' ? ' active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: 13 }}
                    onClick={() => setSkillResult(traineeId, s.id, r === 'fail' ? null : 'fail')}
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
                        onChange={() => toggleSkillStep(traineeId, s.id, i, s.steps?.length ?? 0)}
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
            defaultValue={check?.comments ?? ''}
            onBlur={(e) => setSkillComments(traineeId, e.target.value)}
            rows={3}
            placeholder="Saved when you tap away"
            style={{ display: 'block', width: '100%', marginTop: 2, padding: '8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', resize: 'vertical' }}
          />
        </label>
      </div>
    </div>
  )
}
