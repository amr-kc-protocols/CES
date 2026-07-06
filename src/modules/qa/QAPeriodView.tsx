import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Empty, ProgressBar, Stat } from '../../components/ui'
import { operationName } from '../../data/operations'
import { monthLabel, formatDate } from '../../lib/date'
import { toCSV, downloadCSV } from '../../lib/csv'
import { LOW_SCORE_THRESHOLD } from '../../data/qaRubric'
import {
  usePeriod,
  usePeriodCharts,
  progressFor,
  providerStats,
  drawSample,
  resetSample,
  updatePeriod,
  archivePeriod,
  reopenPeriod,
  deletePeriod,
} from './qaStore'
import ImportCharts from './ImportCharts'
import type { Chart } from '../../types'

const STATUS_PILL: Record<Chart['status'], { cls: string; label: string }> = {
  unreviewed: { cls: 'muted', label: 'Unreviewed' },
  in_progress: { cls: 'warn', label: 'In progress' },
  scored: { cls: 'ok', label: 'Scored' },
}

function ChartRow({ chart, periodId }: { chart: Chart; periodId: string }) {
  const pill = STATUS_PILL[chart.status]
  const low = chart.review && chart.review.scorePct < LOW_SCORE_THRESHOLD
  return (
    <Link
      to={`/qa/${encodeURIComponent(periodId)}/chart/${chart.id}`}
      className="row"
      style={{ color: 'inherit' }}
    >
      <div className="grow">
        <div className="title truncate">
          #{chart.incidentNumber}
          {chart.provider ? ` · ${chart.provider}` : ''}
        </div>
        <div className="meta truncate">
          {chart.date ? formatDate(chart.date) + ' · ' : ''}
          {chart.chiefComplaint || 'No chief complaint'}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {chart.status === 'scored' && chart.review ? (
          <div style={{ fontWeight: 800, color: low ? 'var(--crit)' : 'var(--ok)' }}>
            {chart.review.scorePct}%
          </div>
        ) : (
          <span className={`pill ${pill.cls}`}>{pill.label}</span>
        )}
        {chart.review?.flagged && <div style={{ fontSize: 11, color: 'var(--red)' }}>⚑ flagged</div>}
      </div>
    </Link>
  )
}

export default function QAPeriodView() {
  const { periodId = '' } = useParams()
  const id = decodeURIComponent(periodId)
  const period = usePeriod(id)
  const charts = usePeriodCharts(id)
  const navigate = useNavigate()
  const [showImport, setShowImport] = useState(false)
  const [filter, setFilter] = useState<'queue' | 'all'>('queue')

  const prog = useMemo(() => progressFor(charts, period?.targetCount ?? 0), [charts, period])
  const stats = useMemo(() => providerStats(charts), [charts])

  if (!period) {
    return (
      <div>
        <Link to="/qa" className="link-btn">
          ← Back to QA
        </Link>
        <Empty icon="🔍" title="Review period not found" />
      </div>
    )
  }

  const per = period // non-null after the guard above; stable for closures below
  const pool = charts.filter((c) => !c.sampled).length
  const canDraw = prog.sampled < period.targetCount && pool > 0
  const queue = charts.filter((c) => c.sampled)
  const shown = filter === 'queue' ? queue : charts
  const complete = prog.scored >= period.targetCount && period.targetCount > 0

  function exportReviews() {
    const headers = [
      'Incident', 'Date', 'Provider', 'Crew', 'Chief Complaint', 'Acuity',
      'Status', 'Score %', 'Flagged', 'Reviewer', 'Reviewed At', 'Notes',
    ]
    const rows = charts
      .filter((c) => c.sampled)
      .map((c) => [
        c.incidentNumber, c.date ?? '', c.provider ?? '', c.crew ?? '',
        c.chiefComplaint ?? '', c.acuity ?? '', c.status,
        c.review ? c.review.scorePct : '', c.review?.flagged ? 'yes' : '',
        c.review?.reviewer ?? '', c.review?.reviewedAt ?? '', c.review?.notes ?? '',
      ])
    downloadCSV(`QA_${per.operation}_${per.month}_reviews.csv`, toCSV(headers, rows))
  }

  function exportProviders() {
    const headers = ['Provider', 'Reviews', 'Avg Score %', 'Low Scores', 'Flagged', 'Operation', 'Month']
    const rows = stats.map((s) => [
      s.provider, s.reviews, s.avgScore, s.lowCount, s.flagged,
      operationName(per.operation), per.month,
    ])
    downloadCSV(`QA_${per.operation}_${per.month}_providers.csv`, toCSV(headers, rows))
  }

  return (
    <div>
      <Link to="/qa" className="link-btn">
        ← Back to QA
      </Link>

      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h1>{operationName(period.operation)}</h1>
          <div className="subtle">
            {monthLabel(period.month)}
            {period.status === 'archived' && ' · archived'}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <strong>
            {prog.scored} / {period.targetCount} reviewed
          </strong>
          <span className="subtle">{prog.pct}%</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <ProgressBar pct={prog.pct} complete={complete} />
        </div>
        <div className="stat-grid" style={{ marginTop: 14 }}>
          <Stat
            label="Monthly volume"
            value={
              <input
                type="number"
                defaultValue={period.monthlyVolume}
                min={0}
                onBlur={(e) => {
                  const v = Number(e.target.value)
                  if (v >= 0 && v !== period.monthlyVolume) updatePeriod(id, { monthlyVolume: v })
                }}
                style={{ width: 80, font: 'inherit', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}
              />
            }
          />
          <Stat label="Target (20%)" value={period.targetCount} />
          <Stat label="Imported" value={prog.imported} />
          <Stat label="In sample" value={prog.sampled} />
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={() => setShowImport(true)}>
          + Add charts
        </button>
        <button className="btn" onClick={() => drawSample(id)} disabled={!canDraw} title={canDraw ? '' : 'Sample target already met or no charts left in pool'}>
          🎲 Draw sample
        </button>
        <button className="btn" onClick={() => resetSample(id)} disabled={prog.sampled === 0}>
          Reset sample
        </button>
      </div>

      {charts.length === 0 && (
        <div className="banner info">
          Import the month’s call list (or add charts manually), then draw the 20% random sample.
        </div>
      )}
      {charts.length > 0 && canDraw && prog.sampled === 0 && (
        <div className="banner warn">
          {prog.imported} charts in the pool. Draw the sample to pull {period.targetCount} at random
          into the review queue.
        </div>
      )}

      {stats.length > 0 && (
        <>
          <div className="section-title">Providers (coaching signal)</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Reviews</th>
                  <th>Avg</th>
                  <th>Low</th>
                  <th>Flagged</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.provider}>
                    <td>{s.provider}</td>
                    <td>{s.reviews}</td>
                    <td style={{ color: s.avgScore < LOW_SCORE_THRESHOLD ? 'var(--crit)' : undefined, fontWeight: 700 }}>
                      {s.avgScore}%
                    </td>
                    <td>{s.lowCount || ''}</td>
                    <td>{s.flagged ? `⚑ ${s.flagged}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>Charts</span>
        <div className="segmented" style={{ marginLeft: 'auto' }}>
          <button className={filter === 'queue' ? 'active' : ''} onClick={() => setFilter('queue')}>
            Queue ({queue.length})
          </button>
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            All ({charts.length})
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <Empty icon="🗂️" title={filter === 'queue' ? 'Nothing in the review queue yet' : 'No charts imported'}>
          {filter === 'queue' ? 'Draw the sample to populate the queue.' : 'Add charts to get started.'}
        </Empty>
      ) : (
        <div className="list">
          {shown.map((c) => (
            <ChartRow key={c.id} chart={c} periodId={id} />
          ))}
        </div>
      )}

      <div className="section-title">Export & period</div>
      <div className="btn-row">
        <button className="btn" onClick={exportReviews} disabled={queue.length === 0}>
          ⬇ Reviews CSV
        </button>
        <button className="btn" onClick={exportProviders} disabled={stats.length === 0}>
          ⬇ Provider summary
        </button>
        {period.status === 'active' ? (
          <button className="btn" onClick={() => archivePeriod(id)}>
            Archive month
          </button>
        ) : (
          <button className="btn" onClick={() => reopenPeriod(id)}>
            Reopen
          </button>
        )}
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Delete this period and all its charts? This cannot be undone.')) {
              deletePeriod(id)
              navigate('/qa')
            }
          }}
        >
          Delete
        </button>
      </div>

      {showImport && (
        <ImportCharts periodId={id} operation={period.operation} onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}
