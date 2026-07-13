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
import { useCohorts, useAllTrainees, useAllRides, useAllEvals, releaseEligible } from '../academy/academyStore'
import { allFtos, crewsOnDate, rotationWeek, shiftWindow, type FtoCrew } from '../../data/ftoSchedule'
import { weekdayLabel } from '../academy/calendar'
import { useSyncStatus } from '../../lib/sync'
import { ftoNameForEmail, facilitatorLineNames } from '../../lib/ftoIdentity'
import { QA_ENABLED, CE_ENABLED } from '../../config/features'
import type { DailyEval, RideAssignment, SessionArrangement, Trainee } from '../../types'

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

const PTS_PER_RIDE = 5
const PTS_PER_EVAL = 2
const PTS_PER_ACADEMY_DAY = 5
const RANK_MEDALS = ['🥇', '🥈', '🥉']

interface FtoScore {
  name: string
  rides: number
  evals: number
  academyDays: number
  pts: number
}

/**
 * Gamified FTO tally: 5 pts per ride-along hosted (through today), 2 pts per
 * daily performance evaluation signed with their name, and 5 pts per academy
 * day facilitated — read straight from the facilitator names the educator
 * types on dated schedule days, no extra data entry.
 */
function ftoLeaderboard(
  evals: DailyEval[],
  rides: RideAssignment[],
  arrangements: SessionArrangement[],
  today: string,
): FtoScore[] {
  const taughtDays = arrangements.filter((a) => a.date && a.date <= today && !a.skipped && a.facilitators)
  return allFtos()
    .map((name) => {
      const hosted = rides.filter((r) => r.date <= today && (r.ftoNames ?? '').includes(name)).length
      const signed = evals.filter((e) => e.fto === name).length
      // Distinct dates, so co-facilitating two sessions on one day counts once.
      const academyDays = new Set(
        taughtDays.filter((a) => facilitatorLineNames(a.facilitators, name)).map((a) => a.date),
      ).size
      return {
        name,
        rides: hosted,
        evals: signed,
        academyDays,
        pts: hosted * PTS_PER_RIDE + signed * PTS_PER_EVAL + academyDays * PTS_PER_ACADEMY_DAY,
      }
    })
    .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name))
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
              to={`/academy/${t.cohortId}/eval/${t.id}`}
              className="row"
              style={{ color: 'inherit', marginTop: 6, marginLeft: 72 }}
            >
              <div className="grow">
                <div className="title">🎓 {t.name}</div>
                <div className="meta">{t.contacts}/{t.contactTarget} contacts logged</div>
              </div>
              <span className="pill ok">⭐ Daily eval →</span>
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
  const evals = useAllEvals()
  const leaderboard = ftoLeaderboard(evals, rides, db.academyArrangements, today)
  const { email } = useSyncStatus()
  const myFtoName = ftoNameForEmail(email)

  // Every unreleased trainee, with today's eval state — the FTO's daily
  // expectation stays visible even when no ride was pre-planned.
  const activeTrainees = trainees.filter((t) => !t.releasedDate)
  const evaledToday = (traineeId: string) => evals.find((e) => e.traineeId === traineeId && e.date === today)

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
                to={`/academy/${t.cohortId}/eval/${t.id}`}
                className="row"
                style={{ color: 'inherit' }}
              >
                <div className="grow">
                  <div className="title">🎓 {t.name} rides {r.unit}</div>
                  <div className="meta">
                    {r.ftoNames || 'FTO'} {r.window ? `· ${r.window}` : ''} · off-rotation shift
                  </div>
                </div>
                <span className="pill ok">⭐ Daily eval →</span>
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

      {/* The FTO's standing daily expectation: one eval per trainee per shift
          ridden — visible even when no ride was pre-planned on the schedule. */}
      {activeTrainees.length > 0 && (
        <>
          <div className="section-title">Daily evals — one per trainee, each shift ridden</div>
          <div className="list">
            {activeTrainees.map((t) => {
              const done = evaledToday(t.id)
              return (
                <Link
                  key={t.id}
                  to={`/academy/${t.cohortId}/eval/${t.id}`}
                  className="row"
                  style={{ color: 'inherit' }}
                >
                  <div className="grow">
                    <div className="title">🎓 {t.name}</div>
                    <div className="meta">{t.contacts}/{t.contactTarget} contacts logged</div>
                  </div>
                  {done ? (
                    <span className="pill ok" title={done.fto ? `Filed by ${done.fto}` : undefined}>
                      ✓ Evaluated today
                    </span>
                  ) : (
                    <span className="pill warn">⭐ File today's eval →</span>
                  )}
                </Link>
              )
            })}
          </div>
        </>
      )}

      {/* FTO leaderboard — friendly competition over rides hosted + sign-offs. */}
      <div className="section-title">FTO leaderboard</div>
      <div className="card" style={{ padding: '6px 14px' }}>
        {leaderboard.map((s, i) => (
          <div
            key={s.name}
            style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: i < leaderboard.length - 1 ? '1px solid var(--border)' : 'none' }}
          >
            <span style={{ width: 26, textAlign: 'center', fontSize: s.pts > 0 && i < 3 ? 18 : 13 }} className={s.pts > 0 && i < 3 ? '' : 'subtle'}>
              {s.pts > 0 && i < 3 ? RANK_MEDALS[i] : i + 1}
            </span>
            <span style={{ flex: 1, fontWeight: s.pts > 0 && i === 0 ? 700 : 500 }}>
              {s.name}
              {s.name === myFtoName && <span className="pill info" style={{ marginLeft: 6, padding: '1px 7px', fontSize: 10 }}>you</span>}
            </span>
            <span className="subtle" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
              🚑 {s.rides} · ⭐ {s.evals} · 🎓 {s.academyDays}
            </span>
            <span className={`pill ${s.pts > 0 ? 'info' : 'muted'}`} style={{ minWidth: 56, justifyContent: 'center' }}>
              {s.pts} pts
            </span>
          </div>
        ))}
        <div className="help-text" style={{ padding: '8px 0' }}>
          🚑 {PTS_PER_RIDE} pts per ride-along hosted · ⭐ {PTS_PER_EVAL} pts per daily evaluation
          signed with your name · 🎓 {PTS_PER_ACADEMY_DAY} pts per academy day facilitated (read
          from the facilitator names on the class schedule).
        </div>
      </div>

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
