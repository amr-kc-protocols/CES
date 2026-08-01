import { useState } from 'react'
import { Modal } from '../../components/ui'
import { notifyUser } from '../../lib/dialog'
import { formatDate } from '../../lib/date'
import {
  recordCompletion,
  revokeCompletion,
  useRecordSafety,
  useSessions,
  verificationDeadline,
} from './aemtStore'
import type { StudentReadiness } from './aemtStore'
import { MIN_PASSING_PERCENT, INSTRUCTOR_VERIFICATION_DAYS } from '../../data/aemt'
import type { AemtCourse } from '../../types'

// ---------------------------------------------------------------------------
// Course completion. The old roster dropdown let anyone set a student to
// "Completed" regardless of attendance, clinical minimums, skills or open
// remediation — which is the state that makes a student eligible to sit the
// NREMT cognitive exam. Completion is now computed readiness plus an explicit,
// attributed verification, and bypassing a failed check is possible but never
// silent.
// ---------------------------------------------------------------------------

const ICON: Record<string, string> = { met: '✓', unmet: '✗', attest: '✎' }
const PILL: Record<string, string> = { met: 'ok', unmet: 'crit', attest: 'warn' }

function VerifyModal({
  course,
  readiness,
  onClose,
}: {
  course: AemtCourse
  readiness: StudentReadiness
  onClose: () => void
}) {
  const [verifiedBy, setVerifiedBy] = useState('')
  const [grade, setGrade] = useState('')
  const [reason, setReason] = useState('')
  const [approver, setApprover] = useState('')

  const sessions = useSessions(course.id)
  const due = verificationDeadline(sessions)
  const gradeNum = Number(grade)
  const gradeValid = grade !== '' && Number.isFinite(gradeNum) && gradeNum >= 0 && gradeNum <= 100
  const gradePasses = gradeValid && gradeNum >= MIN_PASSING_PERCENT
  // Statutory failures are not overrideable at any price. Program-policy
  // failures are, with a documented reason and a named approver.
  const blocked = readiness.blocking.length > 0
  const needsOverride =
    !blocked && (readiness.overrideable.length > 0 || (gradeValid && !gradePasses))
  const overrideReady = reason.trim() !== '' && approver.trim() !== ''
  const named = course.primaryInstructor?.trim()
  const verifierMismatch = !!named && named.toLowerCase() !== verifiedBy.trim().toLowerCase()
  const canRecord =
    !blocked && verifiedBy.trim() !== '' && gradeValid && (!needsOverride || overrideReady)

  return (
    <Modal title={`Verify completion — ${readiness.student.name}`} onClose={onClose}>
      <div className="list" style={{ marginBottom: 12 }}>
        {readiness.checks.map((c) => (
          <div key={c.id} className="row">
            <div className="grow">
              <div className="title" style={{ fontSize: 14 }}>
                {ICON[c.status]} {c.label}
                {c.basis === 'statutory' && (
                  <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>
                    K.A.R.
                  </span>
                )}
              </div>
              <div className="meta">{c.detail}</div>
              {c.status === 'unmet' && (
                <div className="meta" style={{ color: c.basis === 'statutory' ? 'var(--crit)' : 'var(--warn)' }}>
                  {c.basis === 'statutory'
                    ? 'Required by regulation — cannot be overridden'
                    : 'Program policy — may be overridden with a documented reason'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="field">
        <label htmlFor="cp-grade">Final course grade (%)</label>
        <input
          id="cp-grade"
          type="number"
          min={0}
          max={100}
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="from Navigate"
        />
        {gradeValid && !gradePasses && (
          <div className="help-text" style={{ color: 'var(--crit)' }}>
            Below the {MIN_PASSING_PERCENT}% minimum — recording this requires an override.
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="cp-by">Verified by the primary instructor</label>
        <input
          id="cp-by"
          value={verifiedBy}
          onChange={(e) => setVerifiedBy(e.target.value)}
          placeholder={named || 'Name of the primary instructor'}
        />
        <div className="help-text">
          K.A.R. 109-11-8 requires the <strong>primary instructor</strong> to verify completion in
          writing, within {INSTRUCTOR_VERIFICATION_DAYS} days of the final class session and before
          the student sits the certification examination. This is a different act from the NREMT
          Program Director's verification, which happens separately.
        </div>
        {verifierMismatch && (
          <div className="help-text" style={{ color: 'var(--warn)' }}>
            The primary instructor of record for this course is <strong>{named}</strong>. Recording
            a different name is allowed but is written to the audit trail as a role mismatch.
          </div>
        )}
        {!named && (
          <div className="help-text" style={{ color: 'var(--warn)' }}>
            This course names no primary instructor, so the role cannot be checked. Set one in
            Course setup.
          </div>
        )}
      </div>

      {due.dueBy && (
        <div className={`banner ${due.overdue ? 'crit' : due.daysLeft! <= 5 ? 'warn' : 'info'}`}>
          {due.overdue ? (
            <>
              <strong>Verification is overdue.</strong> The final class session was{' '}
              {formatDate(due.finalSession!)}, so written verification was due{' '}
              {formatDate(due.dueBy)} — {Math.abs(due.daysLeft!)} days ago.
            </>
          ) : (
            <>
              Written verification is due <strong>{formatDate(due.dueBy)}</strong> —{' '}
              {due.daysLeft} day{due.daysLeft === 1 ? '' : 's'} from today, counting{' '}
              {INSTRUCTOR_VERIFICATION_DAYS} days from the final session on{' '}
              {formatDate(due.finalSession!)}.
            </>
          )}
        </div>
      )}

      {blocked && (
        <div className="banner crit">
          <strong>Cannot be completed.</strong> {readiness.blocking.join(', ')}{' '}
          {readiness.blocking.length === 1 ? 'is' : 'are'} required by K.A.R. 109-11-8. There is no
          override for a statutory requirement — recording completion would assert to KBEMS and
          NREMT that this student met something they have not.
        </div>
      )}

      {needsOverride && (
        <>
          <div className="banner crit">
            <strong>Override required.</strong> Recording completion now will be logged as
            bypassing this program's own policy on: {readiness.overrideable.join(', ')}
            {gradeValid && !gradePasses ? `${readiness.overrideable.length ? ', ' : ''}grade` : ''}.
            Statutory requirements are unaffected — they are all met.
          </div>
          <div className="field">
            <label htmlFor="cp-reason">Reason for the override</label>
            <textarea id="cp-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cp-approver">Approved by</label>
            <input
              id="cp-approver"
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
              placeholder="Program manager or medical director"
            />
          </div>
        </>
      )}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className={`btn ${needsOverride ? 'danger' : 'primary'}`}
          disabled={!canRecord}
          onClick={() => {
            const unmet = [...readiness.overrideable]
            if (gradeValid && !gradePasses) unmet.push('grade')
            const res = recordCompletion(course.id, readiness.student.id, {
              verifiedBy: verifiedBy.trim(),
              primaryInstructor: course.primaryInstructor,
              finalGradePercent: gradeNum,
              blocking: readiness.blocking,
              override: needsOverride
                ? { reason: reason.trim(), approver: approver.trim(), unmetChecks: unmet }
                : undefined,
            })
            if (!res.ok) {
              notifyUser(res.refused ?? 'Completion refused.', 'crit')
              return
            }
            onClose()
          }}
        >
          {blocked
            ? 'Blocked by regulation'
            : needsOverride
              ? 'Record with override'
              : 'Record completion'}
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

export default function CompletionPanel({
  course,
  readiness,
  canEdit,
}: {
  course: AemtCourse
  readiness: StudentReadiness[]
  canEdit: boolean
}) {
  const [verifying, setVerifying] = useState<StudentReadiness | null>(null)
  const safety = useRecordSafety()

  if (readiness.length === 0) return null

  return (
    <>
      <div className="section-title">Completion readiness</div>
      <div className="help-text" style={{ marginTop: 0, marginBottom: 8 }}>
        Completion is what makes a student eligible to sit the NREMT cognitive exam, so it is
        computed from the course record and verified explicitly rather than set by hand.
      </div>

      {!safety.canRecordOfficial && (
        <div className="banner crit">
          <strong>Draft only.</strong> {safety.reason}
        </div>
      )}
      {safety.canRecordOfficial && safety.unsyncedCount > 0 && (
        <div className="banner warn">
          {safety.unsyncedCount} change{safety.unsyncedCount === 1 ? '' : 's'} on this device have
          not uploaded yet. A completion recorded now is still local until they do.
        </div>
      )}

      <div className="list">
        {readiness.map((r) => {
          const met = r.checks.filter((c) => c.status === 'met').length
          return (
            <div
              key={r.student.id}
              className={`row left-accent ${r.completion ? 'acc-ok' : r.computedMet ? '' : 'acc-warn'}`}
            >
              <div className="grow">
                <div className="title">
                  {r.student.name}
                  {r.completion?.override && (
                    <span className="pill crit" style={{ marginLeft: 8 }}>
                      override
                    </span>
                  )}
                </div>
                {r.completion ? (
                  <div className="meta">
                    Completed {formatDate(r.completion.completedDate)} ·{' '}
                    {r.completion.finalGradePercent}% · verified by {r.completion.verifiedBy}
                  </div>
                ) : (
                  <>
                    <div className="meta">
                      {met} of {r.checks.length} checks met
                      {r.unmet.length > 0 && ` · outstanding: ${r.unmet.join(', ')}`}
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {r.checks.map((c) => (
                        <span
                          key={c.id}
                          className={`pill ${PILL[c.status]}`}
                          title={`${c.label} — ${c.detail}`}
                        >
                          {ICON[c.status]} {c.id}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {canEdit &&
                (r.completion ? (
                  <button
                    className="btn sm"
                    onClick={() => {
                      const why = prompt(`Revoke completion for ${r.student.name}? Reason:`)
                      if (why?.trim()) {
                        revokeCompletion(course.id, r.student.id, 'roster', why.trim())
                      }
                    }}
                  >
                    Revoke
                  </button>
                ) : (
                  <button
                    className={`btn sm ${r.computedMet ? 'primary' : ''}`}
                    disabled={!safety.canRecordOfficial}
                    title={safety.reason}
                    onClick={() => setVerifying(r)}
                  >
                    Verify
                  </button>
                ))}
            </div>
          )
        })}
      </div>

      {verifying && (
        <VerifyModal course={course} readiness={verifying} onClose={() => setVerifying(null)} />
      )}
    </>
  )
}
