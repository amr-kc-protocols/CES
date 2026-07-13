import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Empty } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/date'
import { allFtos } from '../../data/ftoSchedule'
import { useCan } from '../../lib/role'
import { useSyncStatus } from '../../lib/sync'
import { ftoNameForEmail } from '../../lib/ftoIdentity'
import {
  useCohort,
  addDailyEval,
  deleteDailyEval,
  evalAverage,
  useEvalsFor,
} from './academyStore'
import { useSelector } from '../../lib/store'
import type { DailyEval } from '../../types'

// End-of-shift Daily Performance Evaluation — the same fields as the legacy
// Microsoft Forms version, now living where the trainee's record lives.

const CATEGORIES: { id: keyof DailyEval['scores']; label: string }[] = [
  { id: 'professionalism', label: 'Overall professionalism' },
  { id: 'teamwork', label: 'Teamwork & communication' },
  { id: 'patientCare', label: 'Patient care skills' },
  { id: 'driving', label: 'Vehicle driving' },
  { id: 'stretcher', label: 'Patient movement (stretcher handling)' },
  { id: 'pcr', label: 'PCR documentation' },
]

function RatingRow({ label, value, onChange }: { label: string; value?: number; onChange: (n?: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 180 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={`choice${value === n ? ' active' : ''}`}
            style={{ padding: '6px 11px', fontSize: 14 }}
            onClick={() => onChange(value === n ? undefined : n)}
            aria-label={`${label}: ${n} of 5`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function YesNoRow({ label, value, onChange }: { label: string; value?: boolean; onChange: (v?: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 180 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button className={`choice${value === true ? ' active' : ''}`} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => onChange(value === true ? undefined : true)}>
          Yes
        </button>
        <button className={`choice${value === false ? ' active' : ''}`} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => onChange(value === false ? undefined : false)}>
          No
        </button>
      </div>
    </div>
  )
}

export default function DailyEvalView() {
  const { cohortId = '', traineeId = '' } = useParams()
  const cohort = useCohort(cohortId)
  const trainee = useSelector((db) => db.trainees.find((t) => t.id === traineeId))
  const evals = useEvalsFor(traineeId)
  const can = useCan()

  const { email } = useSyncStatus()
  const [date, setDate] = useState(todayISO())
  // Signed-in FTOs get their own name preselected — one less tap per eval.
  const [fto, setFto] = useState(() => ftoNameForEmail(email) ?? '')
  const [scores, setScores] = useState<DailyEval['scores']>({})
  const [strengths, setStrengths] = useState('')
  const [improvements, setImprovements] = useState('')
  const [truckWashed, setTruckWashed] = useState<boolean | undefined>()
  const [spotter, setSpotter] = useState<boolean | undefined>()
  const [readyIndependent, setReadyIndependent] = useState<boolean | undefined>()
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')

  if (!cohort || !trainee) {
    return (
      <Empty icon="🤔" title="Trainee not found">
        <Link to="/academy" className="link-btn">Back to Academy</Link>
      </Empty>
    )
  }

  function submit() {
    if (!Object.values(scores).some((v) => typeof v === 'number')) {
      return setError('Score at least one category.')
    }
    addDailyEval(traineeId, {
      date,
      fto,
      scores,
      strengths,
      improvements,
      truckWashed,
      spotter,
      readyIndependent,
    })
    setScores({})
    setStrengths('')
    setImprovements('')
    setTruckWashed(undefined)
    setSpotter(undefined)
    setReadyIndependent(undefined)
    setError('')
    setSaved(`Evaluation saved for ${formatDate(date)}.`)
    setTimeout(() => setSaved(''), 4000)
  }

  const setScore = (id: keyof DailyEval['scores']) => (n?: number) =>
    setScores((s) => ({ ...s, [id]: n }))

  return (
    <div>
      <Link to={`/academy/${cohortId}`} className="link-btn">← {cohort.label}</Link>
      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h1>Daily evaluation</h1>
          <div className="subtle">{trainee.name} · rate the shift before you clear the truck</div>
        </div>
      </div>

      {saved && <div className="banner ok">{saved}</div>}
      {error && <div className="banner crit">{error}</div>}

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <label className="subtle" style={{ fontSize: 12 }}>
            Shift date
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 2, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit' }}
            />
          </label>
          <label className="subtle" style={{ fontSize: 12 }}>
            Evaluating FTO
            <select
              value={fto}
              onChange={(e) => setFto(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 2, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit' }}
            >
              <option value="">—</option>
              {allFtos().map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="subtle" style={{ fontWeight: 700, fontSize: 12, margin: '6px 0 2px' }}>
          Rate 1 (needs work) – 5 (excellent) · skip anything not observed today
        </div>
        {CATEGORIES.map((c) => (
          <RatingRow key={c.id} label={c.label} value={scores[c.id]} onChange={setScore(c.id)} />
        ))}

        <label className="subtle" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          Areas of strength observed today
          <textarea
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            rows={3}
            style={{ display: 'block', width: '100%', marginTop: 2, padding: '8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', resize: 'vertical' }}
          />
        </label>
        <label className="subtle" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          Areas for improvement
          <textarea
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            rows={3}
            style={{ display: 'block', width: '100%', marginTop: 2, padding: '8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', resize: 'vertical' }}
          />
        </label>

        <div style={{ marginTop: 8 }}>
          <YesNoRow label="Truck washed & patient compartment cleaned at EOS?" value={truckWashed} onChange={setTruckWashed} />
          <YesNoRow label="Ambulance always backed with a spotter?" value={spotter} onChange={setSpotter} />
          <YesNoRow label="Ready to work independently without an FTO?" value={readyIndependent} onChange={setReadyIndependent} />
        </div>

        <button className="btn primary" style={{ marginTop: 10 }} onClick={submit}>
          Save evaluation
        </button>
      </div>

      <div className="section-title">Previous evaluations ({evals.length})</div>
      {evals.length === 0 ? (
        <div className="subtle" style={{ fontSize: 13 }}>None yet — the first one starts the record.</div>
      ) : (
        <div className="list">
          {evals.map((e) => {
            const avg = evalAverage(e)
            return (
              <div key={e.id} className="card" style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{formatDate(e.date)}</strong>
                  {e.fto && <span className="subtle">· {e.fto}</span>}
                  {avg !== null && <span className={`pill ${avg >= 4 ? 'ok' : avg >= 3 ? 'info' : 'warn'}`}>{avg.toFixed(1)} avg</span>}
                  {e.readyIndependent === true && <span className="pill ok">Ready</span>}
                  {e.readyIndependent === false && <span className="pill warn">Not ready yet</span>}
                  <span className="spacer" />
                  {can.editRideWork && (
                    <button className="btn ghost sm" title="Remove (undoable)" onClick={() => deleteDailyEval(e.id)}>✕</button>
                  )}
                </div>
                <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
                  {CATEGORIES.filter((c) => e.scores[c.id] != null)
                    .map((c) => `${c.label.split(' ')[0]} ${e.scores[c.id]}`)
                    .join(' · ')}
                </div>
                {e.strengths && <div style={{ fontSize: 13, marginTop: 6 }}>💪 {e.strengths}</div>}
                {e.improvements && <div style={{ fontSize: 13, marginTop: 4 }}>🎯 {e.improvements}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
