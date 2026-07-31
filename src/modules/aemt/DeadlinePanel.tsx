import { useState } from 'react'
import { Modal } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/date'
import { useDeadlines, setDeadlineSubmission } from './aemtStore'
import type { DueDeadline } from './aemtStore'
import { useCan } from '../../lib/role'
import type { AemtDeadlineRecord } from '../../types'

// ---------------------------------------------------------------------------
// KBEMS submission deadlines across every course. Deliberately not scoped to
// one cohort: when two classes overlap, the coordinator's question is "what is
// due next", which does not respect cohort boundaries. Each row names its
// course so the answer is still unambiguous.
//
// A submission carries its evidence — Kansas submissions go through the
// Licensing Portal, so the confirmation number is the receipt. "Marked done"
// on its own proves nothing to an auditor.
// ---------------------------------------------------------------------------

/** How far ahead a not-yet-due submission is worth surfacing. */
const HORIZON_DAYS = 45

const STATUSES: AemtDeadlineRecord['status'][] = ['submitted', 'accepted', 'rejected', 'corrected']

const STATUS_PILL: Record<AemtDeadlineRecord['status'], string> = {
  submitted: 'info',
  accepted: 'ok',
  rejected: 'crit',
  corrected: 'warn',
}

function SubmissionModal({ due, onClose }: { due: DueDeadline; onClose: () => void }) {
  const r = due.record
  const [status, setStatus] = useState<AemtDeadlineRecord['status']>(r?.status ?? 'submitted')
  const [submittedDate, setDate] = useState(r?.submittedDate ?? todayISO())
  const [submittedBy, setBy] = useState(r?.submittedBy ?? '')
  const [confirmationNumber, setConf] = useState(r?.confirmationNumber ?? '')
  const [note, setNote] = useState(r?.note ?? '')

  return (
    <Modal title={due.deadline.label} onClose={onClose}>
      <div className="subtle" style={{ fontSize: 13, marginBottom: 10 }}>
        {due.course.label}
        {due.course.organization && ` · ${due.course.organization}`} · due{' '}
        {formatDate(due.dueDate)}
      </div>

      <div className="field">
        <label htmlFor="dl-status">Status</label>
        <select
          id="dl-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as AemtDeadlineRecord['status'])}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="dl-date">Submitted</label>
          <input
            id="dl-date"
            type="date"
            value={submittedDate}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="dl-by">Submitted by</label>
          <input id="dl-by" value={submittedBy} onChange={(e) => setBy(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="dl-conf">Portal confirmation number</label>
        <input
          id="dl-conf"
          value={confirmationNumber}
          onChange={(e) => setConf(e.target.value)}
          placeholder="Receipt from the KBEMS Licensing Portal"
        />
        <div className="help-text">
          The receipt is the evidence this was filed. Record it while you still have it on screen.
        </div>
      </div>

      <div className="field">
        <label htmlFor="dl-note">Notes</label>
        <textarea id="dl-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={submittedBy.trim() === '' || submittedDate === ''}
          onClick={() => {
            setDeadlineSubmission(due.course.id, due.deadline.id, {
              status,
              submittedDate,
              submittedBy: submittedBy.trim(),
              confirmationNumber: confirmationNumber.trim() || undefined,
              note: note.trim() || undefined,
            })
            onClose()
          }}
        >
          Save
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        {r && (
          <button
            className="btn danger"
            style={{ marginLeft: 'auto' }}
            onClick={() => {
              setDeadlineSubmission(due.course.id, due.deadline.id, null)
              onClose()
            }}
          >
            Clear
          </button>
        )}
      </div>
    </Modal>
  )
}

export default function DeadlinePanel() {
  const all = useDeadlines()
  const { manageAcademy } = useCan()
  const [showDone, setShowDone] = useState(false)
  const [editing, setEditing] = useState<DueDeadline | null>(null)

  if (all.length === 0) return null

  const open = all.filter((d) => !d.done)
  // A rejected filing needs correcting whatever its original due date was, so
  // it is never subject to the horizon — it would otherwise sit invisible
  // behind "nothing due".
  const rejected = open.filter((d) => d.rejected)
  const overdue = open.filter((d) => !d.rejected && d.overdue)
  const soon = open.filter((d) => !d.rejected && !d.overdue && d.daysOut <= HORIZON_DAYS)
  const done = all.filter((d) => d.done)
  const visible = showDone ? all : [...rejected, ...overdue, ...soon]

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
        {rejected.length > 0 && (
          <span className="pill crit" style={{ marginLeft: 8 }}>
            {rejected.length} rejected
          </span>
        )}
        {overdue.length > 0 && (
          <span className="pill crit" style={{ marginLeft: 8 }}>
            {overdue.length} overdue
          </span>
        )}
      </div>

      <div className="list">
        {visible.map((d) => {
          const key = `${d.course.id}:${d.deadline.id}`
          const tone = d.rejected
            ? 'acc-crit'
            : d.done
              ? 'acc-ok'
              : d.overdue
                ? 'acc-crit'
                : d.daysOut <= 14
                  ? 'acc-warn'
                  : ''
          return (
            <div key={key} className={`row left-accent ${tone}`}>
              <div className="grow">
                <div className="title">
                  {d.deadline.label}
                  {d.record && (
                    <span className={`pill ${STATUS_PILL[d.record.status]}`} style={{ marginLeft: 8 }}>
                      {d.record.status}
                    </span>
                  )}
                </div>
                <div className="meta">
                  {d.course.label}
                  {d.course.organization && ` · ${d.course.organization}`}
                </div>
                <div className="meta">
                  {d.record ? (
                    <>
                      {d.rejected && <strong>Rejected — needs correcting. </strong>}
                      Submitted {formatDate(d.record.submittedDate)} by {d.record.submittedBy}
                      {d.record.confirmationNumber ? (
                        <> · conf. {d.record.confirmationNumber}</>
                      ) : (
                        <span style={{ color: 'var(--warn)' }}> · no confirmation recorded</span>
                      )}
                    </>
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
                  className={`btn sm${d.record ? '' : ' primary'}`}
                  onClick={() => setEditing(d)}
                >
                  {d.record ? 'Edit' : 'Record'}
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

      {editing && <SubmissionModal due={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
