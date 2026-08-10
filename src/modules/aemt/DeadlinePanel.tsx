import { Fragment, useState } from 'react'
import { Modal } from '../../components/ui'
import { confirmAction } from '../../lib/dialog'
import { formatDate, todayISO } from '../../lib/date'
import { useDeadlines, setDeadlineSubmission, useRecordSafety } from './aemtStore'
import type { DueDeadline } from './aemtStore'
import { useCan } from '../../lib/role'
import type { AemtDeadlineRecord } from '../../types'

// ---------------------------------------------------------------------------
// KBEMS submissions, drawn as a timeline per course.
//
// A timeline rather than a checklist because these filings are a sequence, not
// a set of chores: instructor setup gates the approval filing, the approval
// filing gates enrolling students, and the roster closes it out. Their order is
// as much of the information as their dates, and a flat list of what is due
// soonest hides it — it also hides the completed steps, which is exactly what
// tells you where in the sequence you are standing.
//
// So the whole arc is drawn, past and future, with today marked in place. What
// was a 45-day visibility horizon is now only emphasis: nothing is hidden, and
// the summary line still answers "what is next" across every course at once,
// which is the question that does not respect cohort boundaries.
//
// A submission carries its evidence — Kansas submissions go through the
// Licensing Portal, so the confirmation number is the receipt. "Marked done"
// on its own proves nothing to an auditor.
// ---------------------------------------------------------------------------

/** Inside this many days, an outstanding submission is drawn as pressing. */
const SOON_DAYS = 14

const STATUSES: AemtDeadlineRecord['status'][] = ['submitted', 'accepted', 'rejected', 'corrected']

const STATUS_PILL: Record<AemtDeadlineRecord['status'], string> = {
  submitted: 'info',
  accepted: 'ok',
  rejected: 'crit',
  corrected: 'warn',
}

function SubmissionModal({ due, onClose }: { due: DueDeadline; onClose: () => void }) {
  const safety = useRecordSafety()
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
            setDeadlineSubmission(
              due.course.id,
              due.deadline.id,
              {
                status,
                submittedDate,
                submittedBy: submittedBy.trim(),
                confirmationNumber: confirmationNumber.trim() || undefined,
                note: note.trim() || undefined,
              },
              safety.actor,
            )
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
            onClick={async () => {
              const ok = await confirmAction({
                title: 'Clear this submission record?',
                body:
                  `The portal confirmation${r.confirmationNumber ? ` (${r.confirmationNumber})` : ''} ` +
                  'is the receipt proving this was filed with KBEMS, and it is not recoverable from ' +
                  'anywhere else in the app. The deadline goes back to outstanding. Clearing it is ' +
                  'written to the audit trail.',
                confirmLabel: 'Clear submission',
              })
              if (!ok) return
              setDeadlineSubmission(due.course.id, due.deadline.id, null, safety.actor)
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

/** How a node is drawn: colour follows what the reader has to do about it. */
function toneOf(d: DueDeadline): 'tl-ok' | 'tl-warn' | 'tl-crit' | '' {
  if (d.rejected) return 'tl-crit'
  if (d.done) return 'tl-ok'
  if (d.overdue) return 'tl-crit'
  return d.daysOut <= SOON_DAYS ? 'tl-warn' : ''
}

function relativeDue(d: DueDeadline): string {
  if (d.overdue) return `${Math.abs(d.daysOut)} day${Math.abs(d.daysOut) === 1 ? '' : 's'} overdue`
  if (d.daysOut === 0) return 'today'
  return `in ${d.daysOut} day${d.daysOut === 1 ? '' : 's'}`
}

function TimelineItem({
  d,
  onEdit,
}: {
  d: DueDeadline
  onEdit: () => void
}) {
  const { manageAemt: manageAcademy } = useCan()
  const safety = useRecordSafety()

  return (
    <div className={`tl-item ${toneOf(d)}`}>
      <div className="tl-date">
        {formatDate(d.dueDate)}
        {!d.done && <> · {relativeDue(d)}</>}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="tl-title">
            {d.deadline.label}
            {d.deadline.basis === 'program' && (
              <span
                className="pill"
                style={{ marginLeft: 8 }}
                title="CES planning target, not a date Kansas sets. Missing it has no regulatory consequence of its own — it just leaves too little time for what depends on it."
              >
                planning target
              </span>
            )}
            {d.record && (
              <span className={`pill ${STATUS_PILL[d.record.status]}`} style={{ marginLeft: 8 }}>
                {d.record.status}
              </span>
            )}
          </div>

          {d.record && (
            <div className="meta">
              {d.rejected && <strong>Rejected — needs correcting. </strong>}
              Submitted {formatDate(d.record.submittedDate)} by {d.record.submittedBy}
              {d.record.confirmationNumber ? (
                <> · conf. {d.record.confirmationNumber}</>
              ) : (
                <span style={{ color: 'var(--warn)' }}> · no confirmation recorded</span>
              )}
            </div>
          )}

          <div className="help-text">{d.deadline.note}</div>

          {d.deadline.prerequisites && !d.done && (
            <div className="help-text" style={{ marginTop: 6 }}>
              <strong>Must already be true before this can be filed:</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
                {d.deadline.prerequisites.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {manageAcademy && (
          <button
            className={`btn sm${d.record ? '' : ' primary'}`}
            disabled={!safety.canRecordOfficial}
            title={safety.reason}
            onClick={onEdit}
          >
            {d.record ? 'Edit' : 'Record'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function DeadlinePanel() {
  const all = useDeadlines()
  const [editing, setEditing] = useState<DueDeadline | null>(null)
  const safety = useRecordSafety()

  if (all.length === 0) return null

  const open = all.filter((d) => !d.done)
  const rejected = open.filter((d) => d.rejected)
  const overdue = open.filter((d) => !d.rejected && d.overdue)
  // useDeadlines already returns them by date, so the first outstanding one is
  // the next thing to do — across every course, which is the whole point of not
  // scoping this panel to a cohort.
  const next = open.find((d) => !d.overdue && !d.rejected)

  // One spine per course: a single spine interleaving two cohorts reads as one
  // sequence when it is two. Courses are ordered by their own next outstanding
  // filing, so the one needing attention soonest is on top.
  const byCourse = new Map<string, DueDeadline[]>()
  for (const d of all) {
    const list = byCourse.get(d.course.id)
    if (list) list.push(d)
    else byCourse.set(d.course.id, [d])
  }
  const courses = [...byCourse.values()].sort((a, b) => {
    const nextOf = (list: DueDeadline[]) => list.find((d) => !d.done)?.dueDate ?? '9999'
    return nextOf(a).localeCompare(nextOf(b))
  })

  const today = todayISO()

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

      {!safety.canRecordOfficial && (
        <div className="banner crit">
          <strong>Draft only.</strong> {safety.reason}
        </div>
      )}

      {open.length === 0 ? (
        <div className="banner ok">✓ Every KBEMS submission is filed.</div>
      ) : next && overdue.length === 0 && rejected.length === 0 ? (
        <div className="banner">
          <strong>Next up:</strong> {next.deadline.label} — {formatDate(next.dueDate)},{' '}
          {relativeDue(next)}
          {courses.length > 1 && <> · {next.course.label}</>}
        </div>
      ) : null}

      {courses.map((list) => {
        const course = list[0].course
        // Today goes in before the first thing not yet past — it is where the
        // reader is standing, not something to do, so it is drawn as a rule
        // across the spine rather than as another node.
        const nowAt = list.findIndex((d) => d.dueDate > today)
        return (
          <div key={course.id} style={{ marginTop: 14 }}>
            {courses.length > 1 && (
              <div className="meta" style={{ fontWeight: 700 }}>
                {course.label}
                {course.organization && ` · ${course.organization}`}
              </div>
            )}
            <div className="timeline">
              {list.map((d, i) => (
                <Fragment key={`${course.id}:${d.deadline.id}`}>
                  {i === nowAt && <div className="tl-now">Today</div>}
                  <TimelineItem d={d} onEdit={() => setEditing(d)} />
                </Fragment>
              ))}
              {nowAt === -1 && <div className="tl-now">Today</div>}
            </div>
          </div>
        )
      })}

      {editing && <SubmissionModal due={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
