import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, ProgressBar, Stat } from '../../components/ui'
import Icon from '../../components/Icon'
import { activeMarket, marketName } from '../../lib/market'
import { useHasOwnProgram, useProgram } from './programStore'
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
      <span className="subtle" aria-hidden>
        ›
      </span>
    </Link>
  )
}

export default function AcademyList() {
  const cohorts = useCohorts()
  const trainees = useAllTrainees()
  const [showForm, setShowForm] = useState(false)
  const navigate = useNavigate()
  const can = useCan()

  const program = useProgram()
  const ownProgram = useHasOwnProgram()
  // The selection exam is written for Kansas City's interfacility operation —
  // its reading tells applicants the job is NOT 911 work — so it is offered
  // there only. Another operation would need its own reading and questions.
  const hasExam = activeMarket() === 'kc'

  const sorted = useMemo(() => [...cohorts].sort(byStartDesc), [cohorts])
  const readyForRelease = trainees.filter((t) => releaseEligible(t)).length
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
          {/* The same two buttons sit on the Training landing one tap above
              this one; they carry the drawn icons, so these did too — an
              emoji and a line icon side by side read as two different apps. */}
          <Link to="/academy/ftos" className="btn" title="Who's on a truck with an FTO — plan ride-alongs">
            <Icon name="ambulance" /> FTO shifts
          </Link>
          {can.manageAcademy && hasExam && (
            <Link
              to="/academy/exam-results"
              className="btn"
              title="New-hire selection exam — results, section breakdown and interview notes"
            >
              <Icon name="clipboard" /> Selection exam
            </Link>
          )}
          {can.manageAcademy && program && (
            <Link to="/academy/setup" className="btn" title="Change your checklist, schedule, FTOs, shifts and documents">
              ⚙ NEOP setup
            </Link>
          )}
          {can.manageAcademy && program && (
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

      {/* An operation with no NEOP yet. This is the first thing a new
          operation's educator sees, so it says what happens next in the words
          they would use, and how long it takes — not a row of zeroes that reads
          as "this app has nothing in it". */}
      {!program && (
        <div className="card setup-invite" style={{ marginTop: 14 }}>
          <h2 style={{ margin: 0 }}>Build {marketName(activeMarket())}'s NEOP</h2>
          <p style={{ margin: '8px 0 12px' }}>
            Tell the app how your academy runs, and every cohort after that builds itself: each
            hire's checklist, the schedule, the FTO roster, and the paperwork with their name on it.
            About ten minutes. Start from the AMR basics or copy another operation, and skip anything
            you are not ready for — you can come back to any step.
          </p>
          <ol className="setup-invite-steps">
            {['Name & stations', 'Checklist', 'Schedule', 'FTO phase', 'FTOs & shifts', 'Documents'].map((label, i) => (
              <li key={label}>
                <span className="setup-step-n" aria-hidden>
                  {i + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
          {can.manageAcademy ? (
            <Link to="/academy/setup" className="btn primary" style={{ marginTop: 12 }}>
              Start setup
            </Link>
          ) : (
            <p className="subtle" style={{ margin: '12px 0 0' }}>
              Your clinical education specialist sets this up. Nothing to do here until they have.
            </p>
          )}
        </div>
      )}

      {program && can.manageAcademy && (
        <div className="subtle" style={{ marginTop: 10, fontSize: 13 }}>
          Running <strong>{program.name}</strong>
          {ownProgram ? '' : ' as it shipped with the app'} ·{' '}
          <Link to="/academy/setup" className="link-btn">
            change it in NEOP setup
          </Link>
        </div>
      )}

      <div className="section-title">Cohorts</div>
      {sorted.length === 0 ? (
        <Empty icon="🎓" title="No academy cohorts yet">
          {program
            ? 'Create a cohort with + Cohort and add its roster. It runs your NEOP as it stands today.'
            : 'Cohorts start once the NEOP is set up.'}
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
