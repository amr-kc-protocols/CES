import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, Modal } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/date'
import { useCourses, useCourseTotals, createCourse, byStartDesc, KC_DEFAULT_TARGETS } from './aemtStore'
import { MONITOR_SHEETS } from '../../data/aemtSkills'
import DeadlinePanel from './DeadlinePanel'
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
        {course.organization && <div className="meta">{course.organization}</div>}
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
  const [organization, setOrg] = useState('')
  const [monitor, setMonitor] = useState('')
  const [didactic, setDidactic] = useState('')
  const [lab, setLab] = useState('')
  const [clinical, setClinical] = useState('')
  const [field, setField] = useState('')

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
        <label htmlFor="ac-org">Sponsoring organization</label>
        <input
          id="ac-org"
          value={organization}
          onChange={(e) => setOrg(e.target.value)}
          placeholder="AMR Kansas City"
        />
      </div>
      <div className="field">
        <label htmlFor="ac-monitor">Cardiac monitor</label>
        <select id="ac-monitor" value={monitor} onChange={(e) => setMonitor(e.target.value)}>
          <option value="">— select the monitor this operation runs —</option>
          {MONITOR_SHEETS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <div className="help-text">
          Students are checked off on this monitor only.
        </div>
      </div>
      <div className="field">
        <label htmlFor="ac-coord">Course coordinator (optional)</label>
        <input id="ac-coord" value={coordinator} onChange={(e) => setCoordinator(e.target.value)} />
      </div>

      {/* Filed hour commitments are per course: a second sponsoring
          organization runs its own approved program with its own numbers. */}
      <div className="section-title" style={{ marginTop: 16 }}>
        Filed hours (optional)
      </div>
      <div className="help-text" style={{ marginTop: 0, marginBottom: 8 }}>
        What this course's approved proposal commits to. Fill in the ones you know and leave the
        rest blank — each is reconciled independently, so a clinical affiliation still being
        negotiated does not stop the classroom hours from being checked. They can be set or changed
        later in Course setup.
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ac-did">Didactic</label>
          <input id="ac-did" type="number" min={0} value={didactic} onChange={(e) => setDidactic(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ac-lab">Lab</label>
          <input id="ac-lab" type="number" min={0} value={lab} onChange={(e) => setLab(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ac-clin">Hospital clinical</label>
          <input id="ac-clin" type="number" min={0} value={clinical} onChange={(e) => setClinical(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ac-field">Field internship</label>
          <input id="ac-field" type="number" min={0} value={field} onChange={(e) => setField(e.target.value)} />
        </div>
      </div>
      <button
        className="btn sm"
        type="button"
        onClick={() => {
          setDidactic(String(KC_DEFAULT_TARGETS.didactic ?? ''))
          setLab(String(KC_DEFAULT_TARGETS.lab ?? ''))
          setClinical(String(KC_DEFAULT_TARGETS.clinical ?? ''))
          setField(String(KC_DEFAULT_TARGETS.field ?? ''))
        }}
      >
        Use AMR KC proposal hours
      </button>
      {startDate && endDate && startDate > endDate && (
        <div className="banner crit">The end date is before the start date.</div>
      )}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!canSave}
          onClick={() => {
            // Keep whatever was filed. Each commitment is independent, and a
            // course that knows three of its four numbers should reconcile
            // against those three rather than against nothing.
            const num = (v: string) => {
              const n = Number(v)
              return v.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined
            }
            const targets = {
              didactic: num(didactic),
              lab: num(lab),
              clinical: num(clinical),
              field: num(field),
            }
            const anyTarget = Object.values(targets).some((v) => v !== undefined)
            const c = createCourse({
              label: label.trim(),
              startDate,
              endDate,
              organization: organization.trim() || undefined,
              courseNumber: courseNumber.trim() || undefined,
              coordinator: coordinator.trim() || undefined,
              monitorSheetId: monitor || undefined,
              targets: anyTarget ? targets : undefined,
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
          <h1>AEMT Program</h1>
          <div className="subtle">
            Kansas-approved Advanced EMT certification — KBEMS course records, clinical minimums
            and completion verification
          </div>
        </div>
        {manageAcademy && (
          <button className="btn primary" onClick={() => setAdding(true)}>
            + New course
          </button>
        )}
      </div>

      <div className="banner info">
        This is the <strong>AEMT certification program</strong>, regulated by KBEMS under K.A.R.
        109-11-8 with its own records and a three-year retention obligation. New-hire onboarding
        lives under <strong>NEOP</strong> and is an internal record — the two are kept apart on
        purpose.
      </div>

      <DeadlinePanel />

      {sorted.length === 0 ? (
        <Empty icon="💉" title="No AEMT courses yet">
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
