import { useState } from 'react'
import { formatDate, todayISO } from '../../lib/date'
import { useDeadlines, setDeadlineDone } from './aemtStore'
import { useCan } from '../../lib/role'

// ---------------------------------------------------------------------------
// KBEMS submission deadlines across every course. Deliberately not scoped to
// one cohort: when two classes overlap, the coordinator's question is "what is
// due next", which does not respect cohort boundaries. Each row names its
// course so the answer is still unambiguous.
// ---------------------------------------------------------------------------

/** How far ahead a not-yet-due submission is worth surfacing. */
const HORIZON_DAYS = 45

export default function DeadlinePanel() {
  const all = useDeadlines()
  const { manageAcademy } = useCan()
  const [showDone, setShowDone] = useState(false)

  if (all.length === 0) return null

  const open = all.filter((d) => !d.done)
  const overdue = open.filter((d) => d.overdue)
  const soon = open.filter((d) => !d.overdue && d.daysOut <= HORIZON_DAYS)
  const done = all.filter((d) => d.done)
  const visible = showDone ? all : [...overdue, ...soon]

  if (visible.length === 0 && !showDone) {
    return (
      <>
        <div className="section-title">KBEMS submissions</div>
        <div className="banner ok">
          ✓ Nothing due in the next {HORIZON_DAYS} days.
          {done.length > 0 && (
            <>
              {' '}
              <button className="link-btn" onClick={() => setShowDone(true)}>
                Show all {all.length}
              </button>
            </>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="section-title">
        KBEMS submissions
        {overdue.length > 0 && (
          <span className="pill crit" style={{ marginLeft: 8 }}>
            {overdue.length} overdue
          </span>
        )}
      </div>

      <div className="list">
        {visible.map((d) => {
          const key = `${d.course.id}:${d.deadline.id}`
          const tone = d.done ? 'acc-ok' : d.overdue ? 'acc-crit' : d.daysOut <= 14 ? 'acc-warn' : ''
          return (
            <div key={key} className={`row left-accent ${tone}`}>
              <div className="grow">
                <div className="title">{d.deadline.label}</div>
                <div className="meta">
                  {d.course.label}
                  {d.course.organization && ` · ${d.course.organization}`}
                </div>
                <div className="meta">
                  {d.done ? (
                    <>Submitted {formatDate(d.completedDate)}</>
                  ) : (
                    <>
                      Due {formatDate(d.dueDate)} ·{' '}
                      {d.overdue
                        ? `${Math.abs(d.daysOut)} day${Math.abs(d.daysOut) === 1 ? '' : 's'} overdue`
                        : d.daysOut === 0
                          ? 'today'
                          : `in ${d.daysOut} day${d.daysOut === 1 ? '' : 's'}`}
                    </>
                  )}
                </div>
                <div className="help-text">{d.deadline.note}</div>
              </div>
              {manageAcademy && (
                <button
                  className={`btn sm${d.done ? '' : ' primary'}`}
                  onClick={() =>
                    setDeadlineDone(d.course.id, d.deadline.id, d.done ? null : todayISO())
                  }
                >
                  {d.done ? 'Undo' : 'Mark done'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {done.length > 0 && (
        <button className="link-btn" onClick={() => setShowDone(!showDone)}>
          {showDone ? 'Hide completed' : `Show ${done.length} completed`}
        </button>
      )}
    </>
  )
}
