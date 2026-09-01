import { useState } from 'react'
import { Modal } from '../../components/ui'
import { confirmAction } from '../../lib/dialog'
import { formatDate, todayISO } from '../../lib/date'
import { checkpointStanding, phasesFor, reseedPhases, updatePhase } from './aemtStore'
import type { RequirementProgress } from './aemtStore'
import { PLANNED_SHIFTS } from '../../data/aemtPhases'
import type {
  AemtClinicalPhase,
  AemtClinicalShift,
  AemtCourse,
  AemtStudent,
} from '../../types'

// ---------------------------------------------------------------------------
// The rotation plan, with this student's shifts laid against it.
//
// Advisory by design. Nothing here refuses anything — a student who picks up an
// extra Tuesday in the middle of Phase 2 did the work, and the app has no
// business arguing with a shift that happened. What it is for is seeing an
// under-filled phase in October instead of December, which is a site-capacity
// problem with a long lead time and no late fix.
//
// A shift that falls in no phase is counted and shown as such rather than
// dropped. The plan has a real gap over the weekend before the break block,
// and a total that quietly disagrees with the shift list is worse than a
// footnote.
// ---------------------------------------------------------------------------

/**
 * Moving a window.
 *
 * The plan is seeded, not carved: a site that changes its Tuesday availability
 * in November moves the phase, and the alternative to editing it here is an
 * instructor mentally discounting a red chip for three months.
 */
function WindowModal({
  course,
  phase,
  onClose,
}: {
  course: AemtCourse
  phase: AemtClinicalPhase
  onClose: () => void
}) {
  const [start, setStart] = useState(phase.windowStart)
  const [end, setEnd] = useState(phase.windowEnd)
  const backwards = end < start

  return (
    <Modal title={`${phase.ordinal}. ${phase.name}`} onClose={onClose}>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ph-start">Window opens</label>
          <input
            id="ph-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ph-end">Window closes</label>
          <input id="ph-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      {backwards && <div className="banner crit">The window closes before it opens.</div>}
      <div className="help-text">
        Windows are advisory. Moving one changes what this panel counts against, and nothing else —
        no shift stops counting because a window moved.
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={backwards}
          onClick={() => {
            updatePhase(course.id, phase.ordinal, { windowStart: start, windowEnd: end })
            onClose()
          }}
        >
          Save window
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

export default function PhasePanel({
  course,
  student,
  progress,
  shifts,
  canEdit,
}: {
  course: AemtCourse
  student: AemtStudent
  progress: RequirementProgress[]
  shifts: AemtClinicalShift[]
  canEdit: boolean
}) {
  const [editing, setEditing] = useState<AemtClinicalPhase | null>(null)
  const phases = phasesFor(course)
  if (!phases.length) return null
  const today = todayISO()
  const inWindow = (p: (typeof phases)[number]) =>
    shifts.filter((s) => s.date >= p.windowStart && s.date <= p.windowEnd)
  const placed = new Set(phases.flatMap((p) => inWindow(p).map((s) => s.id)))
  const unplaced = shifts.filter((s) => !placed.has(s.id))
  const done = shifts.length
  const checkpoints = checkpointStanding(course, student, progress, shifts)

  return (
    <>
      <div className="section-title" style={{ marginTop: 16 }}>
        Rotation plan
      </div>
      <div className="toolbar">
        <span className="subtle">
          {done} of {PLANNED_SHIFTS} planned shifts logged. Windows are advisory — a shift outside
          one still counts.
        </span>
        <div className="spacer" />
        {canEdit && course.phases && (
          <button
            className="btn sm"
            onClick={async () => {
              const ok = await confirmAction({
                title: 'Reset the rotation plan?',
                body: 'Every window goes back to what the plan says for this course’s start date. Shifts are untouched.',
                confirmLabel: 'Reset windows',
              })
              if (ok) reseedPhases(course.id)
            }}
          >
            Reset windows
          </button>
        )}
      </div>
      <div className="list">
        {phases.map((p) => {
          const mine = inWindow(p)
          const current = today >= p.windowStart && today <= p.windowEnd
          const past = today > p.windowEnd
          const short = mine.length < p.shiftsRequired
          return (
            <div
              key={p.ordinal}
              className={`row left-accent ${
                !short ? 'acc-ok' : past ? 'acc-crit' : current ? 'acc-warn' : ''
              }`}
            >
              <div className="grow">
                <div className="title">
                  {p.ordinal}. {p.name}
                  {current && <span className="pill" style={{ marginLeft: 8 }}>now</span>}
                </div>
                <div className="meta">
                  {formatDate(p.windowStart)} – {formatDate(p.windowEnd)}
                  {p.shiftsRequired > 0 && (
                    <>
                      {' '}
                      · {p.hospitalShifts} hospital, {p.fieldShifts} field
                    </>
                  )}
                </div>
                {/* Only worth saying once the window has closed short, or while
                    it is open and behind. A future phase reading "0 of 7" is
                    noise on every screen for two months. */}
                {p.shiftsRequired > 0 && short && (past || current) && (
                  <div className="meta" style={{ color: past ? 'var(--crit)' : 'var(--warn)' }}>
                    {past
                      ? `Window closed ${p.shiftsRequired - mine.length} short — the shifts have to come from somewhere later.`
                      : `${p.shiftsRequired - mine.length} still to place in this window.`}
                  </div>
                )}
              </div>
              {p.shiftsRequired > 0 && (
                <span className={`pill ${short ? (past ? 'crit' : 'warn') : 'ok'}`}>
                  {mine.length}/{p.shiftsRequired}
                </span>
              )}
              {canEdit && (
                <button className="btn sm" onClick={() => setEditing(p)}>
                  Window
                </button>
              )}
            </div>
          )
        })}
      </div>
      {unplaced.length > 0 && (
        <div className="help-text">
          {unplaced.length} shift{unplaced.length === 1 ? '' : 's'} fall outside every window. They
          count toward the total; they just do not belong to a phase.
        </div>
      )}

      {/*
        The deficit checkpoints.
 
        Separate from the phases above, and deliberately so. A phase says where
        in the rotation a date falls; a checkpoint is a DATE ON WHICH SOMEONE
        LOOKS, tied to a class the instructor is already standing in. That
        pairing is what makes it happen — nobody remembers to read a tally on
        24 November, but everybody is in the room that morning for the week 8
        quiz.
 
        Future checkpoints are shown too. "Four shifts short of the 17 December
        floor" in November is the whole value of the mechanism; showing only
        what has already gone wrong turns it back into a postmortem.
      */}
      <div className="section-title" style={{ marginTop: 16 }}>
        Deficit checkpoints
      </div>
      <div className="help-text" style={{ marginTop: 0 }}>
        Read the tally on these dates. A student below the floor gets an added shift assigned that
        week — not a conversation in January. If the shortfall is site availability rather than the
        student, that is an escalation to the site, and it has a long lead time.
      </div>
      <div className="list">
        {checkpoints.map((c) => (
          <div
            key={c.checkpoint.id}
            className={`row left-accent ${
              c.clear ? 'acc-ok' : c.due ? 'acc-crit' : 'acc-warn'
            }`}
          >
            <div className="grow">
              <div className="title">
                {formatDate(c.date)}
                {c.due && !c.clear && (
                  <span className="pill crit" style={{ marginLeft: 8 }}>
                    action due
                  </span>
                )}
              </div>
              <div className="meta">{c.checkpoint.courseAnchor}</div>
              <div className="meta">
                {c.shiftsDone}/{c.checkpoint.shiftsFloor} shifts
                {c.shortfalls.length > 0 && (
                  <>
                    {' · '}
                    {c.shortfalls
                      .map((f) => `${f.label} ${f.done}/${f.floor}`)
                      .join(' · ')}
                  </>
                )}
                {c.missingClearances.length > 0 && (
                  <> · {c.missingClearances.join(', ')} check-off outstanding</>
                )}
              </div>
              {!c.clear && (
                <div
                  className="meta"
                  style={{ color: c.due ? 'var(--crit)' : 'var(--warn)' }}
                >
                  {c.checkpoint.actionIfBelow}
                </div>
              )}
            </div>
            <span className={`pill ${c.clear ? 'ok' : c.due ? 'crit' : 'warn'}`}>
              {c.clear ? 'clear' : `${c.shiftsShort + c.shortfalls.length} short`}
            </span>
          </div>
        ))}
      </div>
      {editing && (
        <WindowModal course={course} phase={editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
