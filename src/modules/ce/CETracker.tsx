import { useMemo, useState } from 'react'
import { Empty, Stat } from '../../components/ui'
import { ceLocationName } from '../../data/operations'
import { formatDate } from '../../lib/date'
import {
  useCEClasses,
  useCESummary,
  dueDate,
  daysRemaining,
  urgencyOf,
  sortByUrgency,
  setCEStatus,
  URGENCY_LABEL,
  type Urgency,
} from './ceStore'
import CEForm from './CEForm'
import { useCan } from '../../lib/role'
import type { CEClass, CEStatus } from '../../types'

const URGENCY_PILL: Record<Urgency, string> = {
  submitted: 'muted',
  overdue: 'crit',
  critical: 'crit',
  warning: 'warn',
  ok: 'ok',
}

const URGENCY_ACCENT: Record<Urgency, string> = {
  submitted: 'acc-muted',
  overdue: 'acc-crit',
  critical: 'acc-crit',
  warning: 'acc-warn',
  ok: 'acc-ok',
}

function daysLabel(cls: CEClass): string {
  if (cls.status === 'submitted') return 'Submitted'
  const d = daysRemaining(cls)
  if (d < 0) return `${Math.abs(d)}d overdue`
  if (d === 0) return 'Due today'
  return `${d}d left`
}

function ClassRow({ cls, onEdit, canEdit }: { cls: CEClass; onEdit: (c: CEClass) => void; canEdit: boolean }) {
  const u = urgencyOf(cls)
  return (
    <div className={`row left-accent ${URGENCY_ACCENT[u]}`}>
      <div
        className="grow"
        onClick={canEdit ? () => onEdit(cls) : undefined}
        style={canEdit ? { cursor: 'pointer' } : undefined}
        title={canEdit ? 'Edit class' : undefined}
        role={canEdit ? 'button' : undefined}
      >
        <div className="title">
          {cls.discipline || 'Class'} · {ceLocationName(cls.location)}{' '}
          {canEdit && (
            <span className="subtle" aria-hidden style={{ fontWeight: 400 }}>
              ✎
            </span>
          )}
        </div>
        <div className="meta">
          {cls.instructor} · class {formatDate(cls.classDate)} · due {formatDate(dueDate(cls))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <span className={`pill ${URGENCY_PILL[u]}`}>
          {u === 'submitted' ? URGENCY_LABEL[u] : daysLabel(cls)}
        </span>
        <select
          value={cls.status}
          disabled={!canEdit}
          onChange={(e) => setCEStatus(cls.id, e.target.value as CEStatus)}
          aria-label="Status"
          style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border-strong)' }}
        >
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="submitted">Submitted</option>
        </select>
      </div>
    </div>
  )
}

export default function CETracker() {
  const classes = useCEClasses()
  const summary = useCESummary()
  const [view, setView] = useState<'deadline' | 'instructor'>('deadline')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CEClass | undefined>()
  const [showDone, setShowDone] = useState(false)
  const can = useCan()

  const visible = useMemo(() => {
    const list = showDone ? classes : classes.filter((c) => c.status !== 'submitted')
    return [...list].sort(sortByUrgency)
  }, [classes, showDone])

  const byInstructor = useMemo(() => {
    const map = new Map<string, CEClass[]>()
    for (const c of visible) {
      const key = c.instructor || 'Unassigned'
      const arr = map.get(key) ?? []
      arr.push(c)
      map.set(key, arr)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [visible])

  function openEdit(c: CEClass) {
    setEditing(c)
    setShowForm(true)
  }
  function openNew() {
    setEditing(undefined)
    setShowForm(true)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>CE Deadlines</h1>
          <div className="subtle">Kansas CE submissions · 30-day KBEMS window</div>
        </div>
        {can.manageAcademy && (
          <button className="btn primary" onClick={openNew}>
            + Add
          </button>
        )}
      </div>

      <div className="stat-grid" style={{ marginTop: 12 }}>
        <Stat label="Outstanding" value={summary.outstanding} />
        <Stat label="Overdue" value={summary.overdue} alert={summary.overdue > 0} />
        <Stat label="Due within 7d" value={summary.dueThisWeek} alert={summary.dueThisWeek > 0} />
        <Stat label="Submitted" value={summary.submitted} />
      </div>

      {summary.overdue > 0 && (
        <div className="banner crit" style={{ marginTop: 14 }}>
          ⚠️ {summary.overdue} submission{summary.overdue > 1 ? 's are' : ' is'} past the 30-day
          KBEMS window. These stay pinned until marked submitted.
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 14 }}>
        <div className="segmented">
          <button className={view === 'deadline' ? 'active' : ''} onClick={() => setView('deadline')}>
            By deadline
          </button>
          <button className={view === 'instructor' ? 'active' : ''} onClick={() => setView('instructor')}>
            By instructor
          </button>
        </div>
        <div className="spacer" />
        <label className="subtle" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Show submitted
        </label>
      </div>

      {visible.length === 0 ? (
        <Empty icon="📅" title="No CE classes tracked yet">
          Add a class to start the 30-day submission clock.
        </Empty>
      ) : view === 'deadline' ? (
        <div className="list">
          {visible.map((c) => (
            <ClassRow key={c.id} cls={c} onEdit={openEdit} canEdit={can.manageAcademy} />
          ))}
        </div>
      ) : (
        <div>
          {byInstructor.map(([name, list]) => (
            <div key={name}>
              <div className="section-title">
                {name} · {list.length}
              </div>
              <div className="list">
                {list.map((c) => (
                  <ClassRow key={c.id} cls={c} onEdit={openEdit} canEdit={can.manageAcademy} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <CEForm editing={editing} onClose={() => setShowForm(false)} />}
    </div>
  )
}
