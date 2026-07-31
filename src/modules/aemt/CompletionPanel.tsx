import { useState } from 'react'
import { Modal } from '../../components/ui'
import { formatDate } from '../../lib/date'
import { recordCompletion, revokeCompletion } from './aemtStore'
import type { StudentReadiness } from './aemtStore'
import { MIN_PASSING_PERCENT } from '../../data/aemt'
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

  const gradeNum = Number(grade)
  const gradeValid = grade !== '' && Number.isFinite(gradeNum) && gradeNum >= 0 && gradeNum <= 100
  const gradePasses = gradeValid && gradeNum >= MIN_PASSING_PERCENT
  const needsOverride = !readiness.computedMet || (gradeValid && !gradePasses)
  const overrideReady = reason.trim() !== '' && approver.trim() !== ''
  const canRecord = verifiedBy.trim() !== '' && gradeValid && (!needsOverride || overrideReady)

  return (
    <Modal title={`Verify completion — ${readiness.student.name}`} onClose={onClose}>
      <div className="list" style={{ marginBottom: 12 }}>
        {readiness.checks.map((c) => (
          <div key={c.id} className="row">
            <div className="grow">
              <div className="title" style={{ fontSize: 14 }}>
                {ICON[c.status]} {c.label}
              </div>
              <div className="meta">{c.detail}</div>
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
        <label htmlFor="cp-by">Verified by</label>
        <input
          id="cp-by"
          value={verifiedBy}
          onChange={(e) => setVerifiedBy(e.target.value)}
          placeholder="Primary instructor or program manager"
        />
      </div>

      {needsOverride && (
        <>
          <div className="banner crit">
            <strong>Override required.</strong> Recording completion now will be logged as
            bypassing: {readiness.unmet.join(', ')}
            {gradeValid && !gradePasses ? `${readiness.unmet.length ? ', ' : ''}grade` : ''}.
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
            const unmet = [...readiness.unmet]
            if (gradeValid && !gradePasses) unmet.push('grade')
            recordCompletion(course.id, readiness.student.id, {
              verifiedBy: verifiedBy.trim(),
              finalGradePercent: gradeNum,
              override: needsOverride
                ? { reason: reason.trim(), approver: approver.trim(), unmetChecks: unmet }
                : undefined,
            })
            onClose()
          }}
        >
          {needsOverride ? 'Record with override' : 'Record completion'}
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

  if (readiness.length === 0) return null

  return (
    <>
      <div className="section-title">Completion readiness</div>
      <div className="help-text" style={{ marginTop: 0, marginBottom: 8 }}>
        Completion is what makes a student eligible to sit the NREMT cognitive exam, so it is
        computed from the course record and verified explicitly rather than set by hand.
      </div>

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
