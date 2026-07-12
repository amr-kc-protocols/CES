import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, ProgressBar, Stat } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/date'
import {
  useCohorts,
  useAllTrainees,
  cohortProgress,
  byStartDesc,
  releaseEligible,
} from './academyStore'
import CohortForm from './CohortForm'
import { useCan } from '../../lib/role'
import type { AcademyCohort } from '../../types'

function CohortRow({ cohort }: { cohort: AcademyCohort }) {
  const trainees = useAllTrainees().filter((t) => t.cohortId === cohort.id)
  const prog = cohortProgress(trainees)
  const today = todayISO()
  const running = cohort.startDate <= today && today <= cohort.endDate
  const upcoming = cohort.startDate > today
  const allReleased = prog.trainees > 0 && prog.released === prog.trainees

  return (
    <Link to={`/academy/${cohort.id}`} className="row" style={{ color: 'inherit' }}>
      <div className="grow">
        <div className="title">
          {cohort.label}
          {running && <span className="pill info" style={{ marginLeft: 8 }}>In session</span>}
          {upcoming && <span className="pill warn" style={{ marginLeft: 8 }}>Upcoming</span>}
          {allReleased && <span className="pill ok" style={{ marginLeft: 8 }}>All released</span>}
        </div>
        <div className="meta">
          {formatDate(cohort.startDate)} – {formatDate(cohort.endDate)} · {prog.trainees} trainee
          {prog.trainees === 1 ? '' : 's'}
          {prog.trainees > 0 && (
            <>
              {' '}
              · {prog.inAcademy} academy / {prog.inFto} FTO / {prog.released} released
            </>
          )}
        </div>
        {prog.trainees > 0 && (
          <div style={{ marginTop: 8 }}>
            <ProgressBar
              pct={Math.round((prog.released / prog.trainees) * 100)}
              complete={allReleased}
            />
          </div>
        )}
      </div>
    </Link>
  )
}

export default function AcademyList() {
  const cohorts = useCohorts()
  const trainees = useAllTrainees()
  const [showForm, setShowForm] = useState(false)
  const navigate = useNavigate()
  const can = useCan()

  const sorted = useMemo(() => [...cohorts].sort(byStartDesc), [cohorts])
  const readyForRelease = trainees.filter(releaseEligible).length
  const active = trainees.filter((t) => !t.releasedDate).length
  const released = trainees.filter((t) => !!t.releasedDate).length

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Academy</h1>
          <div className="subtle">New hire cohorts, checklists & FTO release</div>
        </div>
        <div className="btn-row">
          <Link to="/academy/ftos" className="btn" title="Who's on a truck with an FTO — plan ride-alongs">
            🚑 FTO shifts
          </Link>
          {can.manageAcademy && (
            <button className="btn primary" onClick={() => setShowForm(true)}>
              + Cohort
            </button>
          )}
        </div>
      </div>

      <div className="stat-grid" style={{ marginTop: 12 }}>
        <Stat label="Cohorts" value={cohorts.length} />
        <Stat label="In pipeline" value={active} />
        <Stat label="Ready for release" value={readyForRelease} alert={readyForRelease > 0} />
        <Stat label="Released" value={released} />
      </div>

      {readyForRelease > 0 && (
        <div className="banner info" style={{ marginTop: 14 }}>
          🎓 {readyForRelease} trainee{readyForRelease > 1 ? 's have' : ' has'} reached the
          contact minimum and can be evaluated for release.
        </div>
      )}

      <div className="section-title">Cohorts</div>
      {sorted.length === 0 ? (
        <Empty icon="🎓" title="No academy cohorts yet">
          Create a cohort (academies run ~1.5 weeks, every other month) and add its roster.
        </Empty>
      ) : (
        <div className="list">
          {sorted.map((c) => (
            <CohortRow key={c.id} cohort={c} />
          ))}
        </div>
      )}

      {showForm && (
        <CohortForm
          onClose={() => setShowForm(false)}
          onCreated={(id) => navigate(`/academy/${id}`)}
        />
      )}
    </div>
  )
}
