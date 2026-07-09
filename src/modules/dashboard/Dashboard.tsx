import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { Empty, Stat } from '../../components/ui'
import { ceLocationName, operationShort } from '../../data/operations'
import { formatDate } from '../../lib/date'
import { useDB } from '../../lib/store'
import {
  useCEClasses,
  useCESummary,
  dueDate,
  daysRemaining,
  urgencyOf,
  sortByUrgency,
} from '../ce/ceStore'
import { useCohorts, useAllTrainees, upcomingCohorts, releaseEligible } from '../academy/academyStore'
import { QA_ENABLED } from '../../config/features'

// Loaded only when QA is enabled — keeps the QA store out of the initial chunk.
const DashboardQAProgress = lazy(() => import('./DashboardQAProgress'))

function daysChip(days: number) {
  if (days < 0) return <span className="pill crit">{Math.abs(days)}d overdue</span>
  if (days === 0) return <span className="pill crit">Due today</span>
  if (days < 7) return <span className="pill crit">{days}d left</span>
  return <span className="pill warn">{days}d left</span>
}

export default function Dashboard() {
  const db = useDB()
  const classes = useCEClasses()
  const ce = useCESummary()

  const atRisk = classes
    .filter((c) => c.status !== 'submitted' && ['overdue', 'critical', 'warning'].includes(urgencyOf(c)))
    .sort(sortByUrgency)
    .slice(0, 6)

  const cohorts = useCohorts()
  const trainees = useAllTrainees()
  const nextCohort = upcomingCohorts(cohorts)[0]
  const readyForRelease = trainees.filter(releaseEligible)
  const nothing = classes.length === 0 && cohorts.length === 0

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Today</h1>
          <div className="subtle">What’s at risk right now</div>
        </div>
      </div>

      {nothing && (
        <Empty icon="👋" title="Welcome to CES">
          Start with a{' '}
          <Link to="/ce" className="link-btn">
            CE deadline
          </Link>{' '}
          or an{' '}
          <Link to="/academy" className="link-btn">
            academy cohort
          </Link>
          .
        </Empty>
      )}

      {!nothing && (
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <Stat label="CE overdue" value={ce.overdue} alert={ce.overdue > 0} />
          <Stat label="CE due ≤7d" value={ce.dueThisWeek} alert={ce.dueThisWeek > 0} />
          <Stat label="CE outstanding" value={ce.outstanding} />
          <Stat label="Academy cohorts" value={cohorts.length} />
        </div>
      )}

      {/* CE at-risk */}
      {classes.length > 0 && (
        <>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>
            <span>CE deadlines at risk</span>
            <Link to="/ce" className="link-btn" style={{ marginLeft: 'auto' }}>
              All →
            </Link>
          </div>
          {atRisk.length === 0 ? (
            <div className="banner ok" style={{ background: 'var(--ok-bg)', color: '#166534' }}>
              ✓ No CE submissions are overdue or due within two weeks.
            </div>
          ) : (
            <div className="list">
              {atRisk.map((c) => (
                <div
                  key={c.id}
                  className={`row left-accent ${daysRemaining(c) < 7 ? 'acc-crit' : 'acc-warn'}`}
                >
                  <div className="grow">
                    <div className="title">
                      {c.discipline} · {ceLocationName(c.location)}
                    </div>
                    <div className="meta">
                      {c.instructor} · due {formatDate(dueDate(c))}
                    </div>
                  </div>
                  {daysChip(daysRemaining(c))}
                </div>
              ))}
            </div>
          )}
          {db.settings.classBuilderUrl && (
            <div style={{ marginTop: 10 }}>
              <a className="btn sm" href={db.settings.classBuilderUrl} target="_blank" rel="noreferrer">
                Open Kansas Class Builder ↗
              </a>
            </div>
          )}
        </>
      )}

      {/* QA progress — only when QA is enabled (lazy chunk) */}
      {QA_ENABLED && (
        <Suspense fallback={null}>
          <DashboardQAProgress />
        </Suspense>
      )}

      {/* Academy */}
      {(nextCohort || readyForRelease.length > 0) && (
        <>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>
            <span>Academy</span>
            <Link to="/academy" className="link-btn" style={{ marginLeft: 'auto' }}>
              All →
            </Link>
          </div>
          <div className="list">
            {nextCohort && (
              <Link to={`/academy/${nextCohort.id}`} className="row" style={{ color: 'inherit' }}>
                <div className="grow">
                  <div className="title">🎓 {nextCohort.label}</div>
                  <div className="meta">
                    {formatDate(nextCohort.startDate)} – {formatDate(nextCohort.endDate)} ·{' '}
                    {trainees.filter((t) => t.cohortId === nextCohort.id).length} on roster
                  </div>
                </div>
                <span className="pill info">Next academy</span>
              </Link>
            )}
            {readyForRelease.map((t) => (
              <Link key={t.id} to={`/academy/${t.cohortId}`} className="row left-accent acc-ok" style={{ color: 'inherit' }}>
                <div className="grow">
                  <div className="title">{t.name}</div>
                  <div className="meta">
                    {operationShort(t.operation)} · {t.contacts}/{t.contactTarget} contacts
                  </div>
                </div>
                <span className="pill ok">Ready for release</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
