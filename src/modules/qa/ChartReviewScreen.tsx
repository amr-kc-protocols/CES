import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Empty } from '../../components/ui'
import { operationName } from '../../data/operations'
import { formatDate } from '../../lib/date'
import { getState } from '../../lib/store'
import {
  rubricForOperation,
  computeScore,
  STATUS_LABELS,
  LOW_SCORE_THRESHOLD,
} from '../../data/qaRubric'
import { usePeriodCharts, saveReview, setChartInProgress } from './qaStore'
import type { CriterionStatus } from '../../types'

const STATUS_ORDER: CriterionStatus[] = ['met', 'partial', 'not_met', 'na']

export default function ChartReviewScreen() {
  const { periodId = '', chartId = '' } = useParams()
  const id = decodeURIComponent(periodId)
  const charts = usePeriodCharts(id)
  const chart = charts.find((c) => c.id === chartId)
  const navigate = useNavigate()

  const criteria = useMemo(() => (chart ? rubricForOperation(chart.operation) : []), [chart])
  const [scores, setScores] = useState<Record<string, CriterionStatus>>(chart?.review?.scores ?? {})
  const [notes, setNotes] = useState(chart?.review?.notes ?? '')
  const [flagged, setFlagged] = useState(chart?.review?.flagged ?? false)
  const [reviewer, setReviewer] = useState(chart?.review?.reviewer || getState().settings.reviewer)

  useEffect(() => {
    if (chart && chart.status === 'unreviewed') setChartInProgress(chart.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart?.id])

  if (!chart) {
    return (
      <div>
        <Link to={`/qa/${encodeURIComponent(id)}`} className="link-btn">
          ← Back
        </Link>
        <Empty icon="🔍" title="Chart not found" />
      </div>
    )
  }

  const score = computeScore(scores, criteria)
  const answered = criteria.filter((c) => scores[c.id]).length
  const low = score < LOW_SCORE_THRESHOLD

  function setStatus(critId: string, status: CriterionStatus) {
    setScores((prev) => ({ ...prev, [critId]: status }))
  }

  function save() {
    saveReview(chart!.id, scores, notes, reviewer, flagged)
    navigate(`/qa/${encodeURIComponent(id)}`)
  }

  // Group criteria by category for display.
  const groups = new Map<string, typeof criteria>()
  for (const c of criteria) {
    const arr = groups.get(c.category) ?? []
    arr.push(c)
    groups.set(c.category, arr)
  }

  return (
    <div>
      <Link to={`/qa/${encodeURIComponent(id)}`} className="link-btn">
        ← Back to {operationName(chart.operation)}
      </Link>

      <div className="card" style={{ marginTop: 10 }}>
        <div className="page-head" style={{ marginBottom: 4 }}>
          <h1 style={{ fontSize: 20 }}>Chart #{chart.incidentNumber}</h1>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: low ? 'var(--crit)' : 'var(--ok)' }}>
              {score}%
            </div>
            <div className="subtle">{answered}/{criteria.length} scored</div>
          </div>
        </div>
        <div className="meta">
          {chart.provider && <>Provider: {chart.provider} · </>}
          {chart.date && <>{formatDate(chart.date)} · </>}
          {chart.chiefComplaint || 'No chief complaint'}
          {chart.acuity && <> · acuity {chart.acuity}</>}
        </div>
      </div>

      {[...groups.entries()].map(([category, items]) => (
        <div key={category}>
          <div className="section-title">{category}</div>
          <div className="list">
            {items.map((c) => (
              <div key={c.id} className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {c.label}
                  {c.critical && <span className="pill crit" style={{ marginLeft: 8 }}>Critical</span>}
                </div>
                {c.help && <div className="help-text" style={{ marginTop: -4, marginBottom: 8 }}>{c.help}</div>}
                <div className="segmented" style={{ width: '100%' }}>
                  {STATUS_ORDER.map((s) => (
                    <button
                      key={s}
                      className={scores[c.id] === s ? 'active' : ''}
                      style={{ flex: 1 }}
                      onClick={() => setStatus(c.id, s)}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="section-title">Reviewer notes</div>
      <div className="card">
        <div className="field">
          <label>Reviewer</label>
          <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" />
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observations, coaching points, follow-up…"
          />
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
          <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} />
          ⚑ Flag for coaching follow-up
        </label>
      </div>

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button className="btn primary" onClick={save} disabled={answered === 0}>
          Save review
        </button>
        <button className="btn" onClick={() => navigate(`/qa/${encodeURIComponent(id)}`)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
