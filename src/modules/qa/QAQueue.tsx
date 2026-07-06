import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, ProgressBar, Stat } from '../../components/ui'
import { operationName } from '../../data/operations'
import { monthLabel } from '../../lib/date'
import { usePeriods, usePeriodCharts, progressFor, useQASummary } from './qaStore'
import QAPeriodForm from './QAPeriodForm'
import type { QAPeriod } from '../../types'

function PeriodRow({ period }: { period: QAPeriod }) {
  const charts = usePeriodCharts(period.id)
  const prog = progressFor(charts, period.targetCount)
  const complete = prog.scored >= period.targetCount && period.targetCount > 0
  return (
    <Link to={`/qa/${encodeURIComponent(period.id)}`} className="row" style={{ color: 'inherit' }}>
      <div className="grow">
        <div className="title">
          {operationName(period.operation)}
          {period.status === 'archived' && <span className="pill muted" style={{ marginLeft: 8 }}>Archived</span>}
        </div>
        <div className="meta">
          {monthLabel(period.month)} · {prog.scored}/{period.targetCount} reviewed ·{' '}
          {prog.imported} imported
        </div>
        <div style={{ marginTop: 8 }}>
          <ProgressBar pct={prog.pct} complete={complete} />
        </div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 52 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{prog.pct}%</div>
        {complete && <span className="pill ok">Done</span>}
      </div>
    </Link>
  )
}

export default function QAQueue() {
  const periods = usePeriods()
  const summary = useQASummary()
  const [showForm, setShowForm] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const grouped = useMemo(() => {
    const list = showArchived ? periods : periods.filter((p) => p.status === 'active')
    const map = new Map<string, QAPeriod[]>()
    for (const p of list) {
      const arr = map.get(p.month) ?? []
      arr.push(p)
      map.set(p.month, arr)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [periods, showArchived])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>QA Review Queue</h1>
          <div className="subtle">20% chart sampling per operation</div>
        </div>
        <button className="btn primary" onClick={() => setShowForm(true)}>
          + Period
        </button>
      </div>

      <div className="stat-grid" style={{ marginTop: 12 }}>
        <Stat label="Active periods" value={summary.activePeriods} />
        <Stat label="Reviewed" value={summary.scored} />
        <Stat label="Target" value={summary.target} />
        <Stat label="Progress" value={`${summary.pct}%`} />
      </div>

      <div className="toolbar" style={{ marginTop: 14 }}>
        <div className="spacer" />
        <label className="subtle" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      {grouped.length === 0 ? (
        <Empty icon="🩺" title="No review periods yet">
          Create a period, import the month’s call list, then draw the sample.
        </Empty>
      ) : (
        grouped.map(([month, list]) => (
          <div key={month}>
            <div className="section-title">{monthLabel(month)}</div>
            <div className="list">
              {list.map((p) => (
                <PeriodRow key={p.id} period={p} />
              ))}
            </div>
          </div>
        ))
      )}

      {showForm && <QAPeriodForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
