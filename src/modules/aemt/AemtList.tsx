import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, Modal } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/date'
import { useCourses, useCourseTotals, createCourse, byStartDesc } from './aemtStore'
import { useCan } from '../../lib/role'
import type { AemtCourse } from '../../types'

function CourseRow({ course }: { course: AemtCourse }) {
  const totals = useCourseTotals(course.id)
  const today = todayISO()
  const running = course.startDate <= today && today <= course.endDate
  const upcoming = course.startDate > today

  return (
    <Link to={`/aemt/${course.id}`} className="row" style={{ color: 'inherit' }}>
      <div className="grow">
        <div className="title">
          {course.label}
          {running && <span className="pill info" style={{ marginLeft: 8 }}>In session</span>}
          {upcoming && <span className="pill warn" style={{ marginLeft: 8 }}>Upcoming</span>}
        </div>
        <div className="meta">
          {formatDate(course.startDate)} – {formatDate(course.endDate)}
          {course.courseNumber && <> · KSBEMS #{course.courseNumber}</>}
        </div>
        <div className="meta">
          {totals.students} student{totals.students === 1 ? '' : 's'} ·{' '}
          {totals.scheduledHours} scheduled hour{totals.scheduledHours === 1 ? '' : 's'} ·{' '}
          {totals.sessions} session{totals.sessions === 1 ? '' : 's'}
        </div>
      </div>
      <span className="subtle">▶</span>
    </Link>
  )
}

function NewCourseForm({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [label, setLabel] = useState('')
  const [startDate, setStart] = useState(todayISO())
  const [endDate, setEnd] = useState('')
  const [courseNumber, setNumber] = useState('')
  const [coordinator, setCoordinator] = useState('')

  const canSave = label.trim() !== '' && startDate !== '' && endDate !== '' && startDate <= endDate

  return (
    <Modal title="New AEMT course" onClose={onClose}>
      <div className="field">
        <label htmlFor="ac-label">Course name</label>
        <input
          id="ac-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Fall 2026 AEMT"
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ac-start">Start date</label>
          <input id="ac-start" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ac-end">End date</label>
          <input id="ac-end" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ac-num">KSBEMS course number (optional)</label>
        <input
          id="ac-num"
          value={courseNumber}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Add it once the course is approved"
        />
      </div>
      <div className="field">
        <label htmlFor="ac-coord">Course coordinator (optional)</label>
        <input id="ac-coord" value={coordinator} onChange={(e) => setCoordinator(e.target.value)} />
      </div>
      {startDate && endDate && startDate > endDate && (
        <div className="banner crit">The end date is before the start date.</div>
      )}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!canSave}
          onClick={() => {
            const c = createCourse({
              label: label.trim(),
              startDate,
              endDate,
              courseNumber: courseNumber.trim() || undefined,
              coordinator: coordinator.trim() || undefined,
            })
            onClose()
            navigate(`/aemt/${c.id}`)
          }}
        >
          Create course
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

export default function AemtList() {
  const courses = useCourses()
  const [adding, setAdding] = useState(false)
  const { manageAcademy } = useCan()
  const sorted = useMemo(() => [...courses].sort(byStartDesc), [courses])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>AEMT Course</h1>
          <div className="subtle">Kansas Advanced EMT certification classes</div>
        </div>
        {manageAcademy && (
          <button className="btn primary" onClick={() => setAdding(true)}>
            + New course
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <Empty icon="🎓" title="No AEMT courses yet">
          {manageAcademy
            ? 'Create a course, add your students, then lay out the class sessions and their hours.'
            : 'The Clinical Educator sets up AEMT courses.'}
        </Empty>
      ) : (
        <div className="list" style={{ marginTop: 12 }}>
          {sorted.map((c) => (
            <CourseRow key={c.id} course={c} />
          ))}
        </div>
      )}

      {adding && <NewCourseForm onClose={() => setAdding(false)} />}
    </div>
  )
}
