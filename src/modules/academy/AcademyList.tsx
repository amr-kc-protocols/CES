import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, ProgressBar, Stat } from '../../components/ui'
import { activeMarket, marketName } from '../../lib/market'
import { FTO_CREWS } from '../../data/ftoSchedule'
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
      {/* Two programs, two sets of obligations. Saying so once on each landing
          page is cheaper than untangling a record filed under the wrong one. */}
      <div className="page-head">
        <div>
          <h1>NEOP</h1>
          <div className="subtle">New Employee Orientation Program — cohorts, checklists &amp; FTO release</div>
        </div>
        <div className="btn-row">
          <Link to="/academy/ftos" className="btn" title="Who's on a truck with an FTO — plan ride-alongs">
            🚑 FTO shifts
          </Link>
          {can.manageAcademy && (
            <Link
              to="/academy/exam-results"
              className="btn"
              title="New-hire comprehension exam — results, section breakdown and interview notes"
            >
              📝 Comprehension exam
            </Link>
          )}
          {can.manageAcademy && (
            <button className="btn primary" onClick={() => setShowForm(true)}>
              + Cohort
            </button>
          )}
        </div>
      </div>

      <div className="banner info">
        <strong>NEOP</strong> is internal onboarding — cohorts, checklists, FTO rides and release.
        It is not a certification course and its records are not KBEMS records. Kansas AEMT
        certification lives under <strong>AEMT</strong>.
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

      {/* A market with no cohorts AND no FTO schedule has never been set up,
          as opposed to one between classes. Without this, Wichita's first look
          at NEOP is a row of zeroes that reads as "this app has nothing in it"
          rather than "this app is ready and waiting for your data". The point
          is to say what already works, so nobody rebuilds what they have. */}
      {sorted.length === 0 && FTO_CREWS.length === 0 && (
        <div className="banner info" style={{ marginTop: 14 }}>
          <strong>{marketName(activeMarket())} is set up and empty.</strong> Nothing was copied
          from another operation — cohorts, trainees, evaluations and records all start here.
          <br />
          <br />
          <strong>Ready to use now:</strong> the clinical skill sheets, the Safe Stretcher
          Handling and EVOC track check-offs, daily performance evaluations, the exit survey,
          and the AEMT program with its curriculum and selection test. These appear as soon as
          you create a cohort and add its roster.
          <br />
          <br />
          <strong>Yours to add:</strong> your FTO roster and shift schedule, your classroom
          week beyond the corporate EVOC and stretcher days, and your receiving-facility list.
          Send those over whenever you have them.
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
