import { Link } from 'react-router-dom'
import { ProgressBar } from '../../components/ui'
import { operationName } from '../../data/operations'
import { monthLabel } from '../../lib/date'
import { useDB } from '../../lib/store'
import { usePeriods, progressFor } from '../qa/qaStore'

// Split out of Dashboard so the QA store (and its bot-bridge deps) stay out of
// the initial bundle. Only mounted when QA_ENABLED, so while QA is paused this
// chunk is never fetched.
export default function DashboardQAProgress() {
  const db = useDB()
  const activePeriods = usePeriods().filter((p) => p.status === 'active')
  if (activePeriods.length === 0) return null

  return (
    <>
      <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>
        <span>QA progress</span>
        <Link to="/qa" className="link-btn" style={{ marginLeft: 'auto' }}>
          All →
        </Link>
      </div>
      <div className="list">
        {activePeriods.map((p) => {
          const charts = db.charts.filter((c) => c.periodId === p.id)
          const prog = progressFor(charts, p.targetCount)
          const complete = prog.scored >= p.targetCount && p.targetCount > 0
          return (
            <Link key={p.id} to={`/qa/${encodeURIComponent(p.id)}`} className="row" style={{ color: 'inherit' }}>
              <div className="grow">
                <div className="title">{operationName(p.operation)}</div>
                <div className="meta">
                  {monthLabel(p.month)} · {prog.scored}/{p.targetCount} reviewed
                </div>
                <div style={{ marginTop: 8 }}>
                  <ProgressBar pct={prog.pct} complete={complete} />
                </div>
              </div>
              <div style={{ fontWeight: 800 }}>{prog.pct}%</div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
