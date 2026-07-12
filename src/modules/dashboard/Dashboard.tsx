import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { Stat } from '../../components/ui'
import { ceLocationName } from '../../data/operations'
import { addDays, formatDate, todayISO } from '../../lib/date'
import { useDB } from '../../lib/store'
import {
  useCEClasses,
  useCESummary,
  dueDate,
  daysRemaining,
  urgencyOf,
  sortByUrgency,
} from '../ce/ceStore'
import { useCohorts, useAllTrainees, useAllRides, releaseEligible } from '../academy/academyStore'
import { crewsOnDate, rotationWeek, shiftWindow, type FtoCrew } from '../../data/ftoSchedule'
import { weekdayLabel } from '../academy/calendar'
import { QA_ENABLED, CE_ENABLED } from '../../config/features'
import type { RideAssignment, Trainee } from '../../types'

// Loaded only when QA is enabled — keeps the QA store out of the initial chunk.
const DashboardQAProgress = lazy(() => import('./DashboardQAProgress'))

import FtoGuide from './FtoGuide'

function daysChip(days: number) {
  if (days < 0) return <span className="pill crit">{Math.abs(days)}d overdue</span>
  if (days === 0) return <span className="pill crit">Due today</span>
  if (days < 7) return <span className="pill crit">{days}d left</span>
  return <span className="pill warn">{days}d left</span>
}

function ftoNamesOf(c: FtoCrew): string {
  return c.crew.filter((m) => m.fto).map((m) => m.name).join(' · ')
}

/** One crew on shift today, with its assigned rider(s) linking to checklists. */
function CrewToday({ crew, riders, traineeById }: {
  crew: FtoCrew
  riders: RideAssignment[]
  traineeById: Map<string, Trainee>
}) {
  return (
    <div className="card" style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="pill info" style={{ minWidth: 62, justifyContent: 'center' }}>{crew.unit}</span>
        <span style={{ flex: 1, minWidth: 140, fontWeight: 700 }}>{ftoNamesOf(crew)}</span>
        <span className="subtle" style={{ whiteSpace: 'nowrap' }}>
          {shiftWindow(crew)} · {crew.level}
        </span>
      </div>
      {riders.length === 0 ? (
        <div className="subtle" style={{ fontSize: 12, padding: '4px 0 0 72px' }}>No rider assigned</div>
      ) : (
        riders.map((r) => {
          const t = traineeById.get(r.traineeId)
          if (!t) return null
          return (
            <Link
              key={r.id}
              to={`/academy/${t.cohortId}/checklist/${t.id}`}
              className="row"
              style={{ color: 'inherit', marginTop: 6, marginLeft: 72 }}
            >
              <div className="grow">
                <div className="title">🎓 {t.name}</div>
                <div className="meta">{t.contacts}/{t.contactTarget} contacts logged</div>
              </div>
              <span className="pill ok">📋 Checklist →</span>
            </Link>
          )
        })
      )}
    </div>
  )
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
  const rides = useAllRides()
  const readyForRelease = trainees.filter(releaseEligible)
  const traineeById = new Map(trainees.map((t) => [t.id, t]))

  const today = todayISO()
  const tomorrow = addDays(today, 1)
  const crewsToday = crewsOnDate(today)
  const crewsTomorrow = crewsOnDate(tomorrow)
  const ridesOn = (date: string, unit: string) => rides.filter((r) => r.date === date && r.unit === unit)
  // Rides logged for today whose unit has no rotation line on shift (one-off
  // scheduling, e.g. an FTO without a recurring line) — still worth surfacing.
  const offRotationRides = rides.filter(
    (r) => r.date === today && !crewsToday.some((c) => c.unit === r.unit),
  )

  return (
    <div>
      {/* First thing a new FTO sees — before any data, before sign-in. */}
      <FtoGuide />

      <div className="page-head">
        <div>
          <h1>Today</h1>
          <div className="subtle">
            {weekdayLabel(today)} {formatDate(today)} · rotation week {rotationWeek(today)}
          </div>
        </div>
      </div>

      {readyForRelease.length > 0 && (
        <div className="banner info" style={{ marginTop: 12 }}>
          🎓 {readyForRelease.length} trainee{readyForRelease.length > 1 ? 's are' : ' is'} ready to
          be evaluated for release —{' '}
          <Link to="/academy" className="link-btn">
            review in Academy →
          </Link>
        </div>
      )}

      {CE_ENABLED && (
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <Stat label="CE overdue" value={ce.overdue} alert={ce.overdue > 0} />
          <Stat label="CE due ≤7d" value={ce.dueThisWeek} alert={ce.dueThisWeek > 0} />
          <Stat label="CE outstanding" value={ce.outstanding} />
          <Stat label="Academy cohorts" value={cohorts.length} />
        </div>
      )}

      {/* Who's on a truck with an FTO right now, and which new hire rides along. */}
      <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>
        <span>On a truck today</span>
        <Link to="/academy/ftos" className="link-btn" style={{ marginLeft: 'auto' }}>
          Plan rides →
        </Link>
      </div>
      {crewsToday.length === 0 && offRotationRides.length === 0 ? (
        <div className="banner warn">No FTO crews on the rotation today.</div>
      ) : (
        <div className="list">
          {crewsToday.map((c) => (
            <CrewToday key={c.unit + c.start} crew={c} riders={ridesOn(today, c.unit)} traineeById={traineeById} />
          ))}
          {offRotationRides.map((r) => {
            const t = traineeById.get(r.traineeId)
            if (!t) return null
            return (
              <Link
                key={r.id}
                to={`/academy/${t.cohortId}/checklist/${t.id}`}
                className="row"
                style={{ color: 'inherit' }}
              >
                <div className="grow">
                  <div className="title">🎓 {t.name} rides {r.unit}</div>
                  <div className="meta">
                    {r.ftoNames || 'FTO'} {r.window ? `· ${r.window}` : ''} · off-rotation shift
                  </div>
                </div>
                <span className="pill ok">📋 Checklist →</span>
              </Link>
            )
          })}
        </div>
      )}

      {/* Tomorrow, at a glance — enough to plan the night before. */}
      {crewsTomorrow.length > 0 && (
        <>
          <div className="section-title">Tomorrow ({weekdayLabel(tomorrow)})</div>
          <div className="card" style={{ padding: '10px 14px' }}>
            {crewsTomorrow.map((c) => {
              const riders = ridesOn(tomorrow, c.unit)
              return (
                <div key={c.unit + c.start} className="subtle" style={{ padding: '3px 0', fontSize: 13 }}>
                  <strong style={{ color: 'var(--text)' }}>{c.unit}</strong> {ftoNamesOf(c)} ·{' '}
                  {shiftWindow(c)}
                  {riders.map((r) => (
                    <span key={r.id}> · 🎓 {traineeById.get(r.traineeId)?.name ?? '?'}</span>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* CE at-risk */}
      {CE_ENABLED && classes.length > 0 && (
        <>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>
            <span>CE deadlines at risk</span>
            <Link to="/ce" className="link-btn" style={{ marginLeft: 'auto' }}>
              All →
            </Link>
          </div>
          {atRisk.length === 0 ? (
            <div className="banner ok">✓ No CE submissions are overdue or due within two weeks.</div>
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
    </div>
  )
}
