import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { Stat } from '../../components/ui'
import { HubHead, HubLocked, HubRow, itemAt } from './SectionHub'
import { useSection } from '../../lib/nav'
import { useCan } from '../../lib/role'
import { useDB } from '../../lib/store'
import { todayISO } from '../../lib/date'
import { formatDate } from '../../lib/date'
import { useCohorts, useAllTrainees, cohortProgress, releaseEligible } from '../academy/academyStore'

// The AEMT figures are read straight off the store rather than through
// aemtStore, deliberately: that module is the course engine and pulling it in
// here would load it for every FTO who opens Training and cannot see AEMT at
// all. Counting rows needs none of it.

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

export default function TrainingHub() {
  const section = useSection('/training')
  const { manageAcademy } = useCan()
  const db = useDB()
  const cohorts = useCohorts()
  const trainees = useAllTrainees()
  const today = todayISO()

  const inSession = cohorts.filter((c) => c.startDate <= today && today <= c.endDate).length
  const upcoming = cohorts.filter((c) => c.startDate > today).length
  const active = trainees.filter((t) => !t.releasedDate).length
  const ready = trainees.filter(releaseEligible).length

  const neopItem = itemAt(section, '/academy')
  const aemtItem = itemAt(section, '/aemt')
  const aemtRunning = db.aemtCourses.filter((c) => c.startDate <= today && today <= c.endDate).length
  const aemtStudents = db.aemtStudents.filter((s) => s.status === 'active').length

  // What is actually running, one tap from here. Without this the landing is a
  // menu of two words and the section has cost a tap for nothing — the cohort
  // is what an FTO opened the app to reach.
  const running = cohorts
    .filter((c) => c.startDate <= today && today <= c.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  if (!section) {
    return <HubLocked title="Nothing here on this account" why="Training programs are not available to this account." />
  }

  return (
    <div>
      <HubHead section={section}>
        {/* The one screen an FTO opens daily that is not a program root —
            worth keeping a single tap from here rather than three. */}
        <Link to="/academy/ftos" className="btn" title="Who's on a truck with an FTO — plan ride-alongs">
          <Icon name="ambulance" /> FTO shifts
        </Link>
        {manageAcademy && (
          <Link to="/academy/exam-results" className="btn" title="New-hire selection exam results">
            <Icon name="clipboard" /> Selection exam
          </Link>
        )}
      </HubHead>

      <div className="stat-grid">
        <Stat value={active} label="Trainees in progress" />
        <Stat value={inSession} label="Cohorts in session" />
        <Stat value={ready} label="Ready for release" alert={ready > 0} />
        {aemtItem && <Stat value={aemtStudents} label="AEMT students" />}
      </div>

      <div className="list">
        {neopItem && (
        <HubRow
          item={neopItem}
          meta={
            cohorts.length === 0
              ? 'No cohorts yet — start one here'
              : `${plural(inSession, 'cohort')} in session · ${plural(active, 'trainee')} in progress${
                  upcoming ? ` · ${upcoming} upcoming` : ''
                }`
          }
          pill={ready > 0 ? <span className="pill warn">{ready} ready for release</span> : undefined}
        />
        )}
        {aemtItem && (
          <HubRow
            item={aemtItem}
            meta={
              db.aemtCourses.length === 0
                ? 'No course set up yet'
                : `${plural(aemtRunning, 'course')} running · ${plural(aemtStudents, 'active student')}`
            }
          />
        )}
      </div>

      {running.length > 0 && (
        <>
          <div className="section-title">In session now</div>
          <div className="list">
            {running.map((c) => {
              const prog = cohortProgress(trainees.filter((t) => t.cohortId === c.id))
              return (
                <Link key={c.id} to={`/academy/${c.id}`} className="row" style={{ color: 'inherit' }}>
                  <div className="grow">
                    <div className="title">{c.label}</div>
                    <div className="meta">
                      {formatDate(c.startDate)} – {formatDate(c.endDate)} · {prog.inAcademy} academy /{' '}
                      {prog.inFto} FTO / {prog.released} released
                    </div>
                  </div>
                  <span className="subtle" aria-hidden>
                    ›
                  </span>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
