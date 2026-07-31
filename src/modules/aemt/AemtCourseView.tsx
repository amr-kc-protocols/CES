
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Empty, Stat } from '../../components/ui'
import { formatDate } from '../../lib/date'
import { useCourse, useSessions, useStudents, courseHourTotals } from './aemtStore'
import RosterTab from './RosterTab'
import SessionsTab from './SessionsTab'
import HoursTab from './HoursTab'
import ClinicalTab from './ClinicalTab'

const TABS = ['roster', 'sessions', 'hours', 'clinical'] as const
type Tab = (typeof TABS)[number]

const TAB_LABEL: Record<Tab, string> = {
  roster: 'Roster',
  sessions: 'Sessions',
  hours: 'Hours',
  clinical: 'Clinical',
}

export default function AemtCourseView() {
  const { courseId } = useParams()
  const course = useCourse(courseId)
  const students = useStudents(courseId)
  const sessions = useSessions(courseId)
  // Tab lives in the URL so a refresh keeps your place and tabs are linkable.
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as Tab | null
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'roster'
  const setTab = (t: Tab) => setParams(t === 'roster' ? {} : { tab: t }, { replace: true })

  if (!course) {
    return (
      <div>
        <Link to="/aemt" className="link-btn">
          ← Back to AEMT
        </Link>
        <Empty icon="🔍" title="Course not found" />
      </div>
    )
  }

  const totals = courseHourTotals(sessions)
  const active = students.filter((s) => s.status === 'active').length

  return (
    <div>
      <Link to="/aemt" className="link-btn">
        ← Back to AEMT
      </Link>

      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h1>{course.label}</h1>
          <div className="subtle">
            {formatDate(course.startDate)} – {formatDate(course.endDate)}
            {course.courseNumber && <> · KSBEMS #{course.courseNumber}</>}
          </div>
          {(course.coordinator || course.medicalDirector) && (
            <div className="subtle" style={{ fontSize: 12 }}>
              {course.coordinator && <>Coordinator: {course.coordinator}</>}
              {course.coordinator && course.medicalDirector && ' · '}
              {course.medicalDirector && <>Medical Director: {course.medicalDirector}</>}
            </div>
          )}
        </div>
      </div>

      <div className="stat-grid" style={{ marginTop: 12 }}>
        <Stat value={active} label="Active students" />
        <Stat value={sessions.length} label="Sessions" />
        <Stat value={totals.total} label="Scheduled hours" />
        <Stat value={totals.byKind.lab} label="Lab hours" />
      </div>

      <div className="segmented" style={{ marginTop: 14 }}>
        {TABS.map((t) => (
          <button
            key={t}
            className={tab === t ? 'active' : ''}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
            {t === 'roster' && students.length > 0 ? ` (${students.length})` : ''}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        {tab === 'roster' && <RosterTab course={course} />}
        {tab === 'sessions' && <SessionsTab course={course} />}
        {tab === 'hours' && <HoursTab course={course} />}
        {tab === 'clinical' && <ClinicalTab course={course} />}
      </div>
    </div>
  )
}
