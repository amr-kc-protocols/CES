import { useState } from 'react'
import { Modal } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/date'
import ReasonModal from './ReasonModal'
import { clearedOn, grantSkillClearance, revokeSkillClearance, useRecordSafety } from './aemtStore'
import { SKILL_CLEARANCES } from '../../data/aemtPhases'
import type { SkillClearance } from '../../data/aemtPhases'
import type { AemtStudent } from '../../types'

// ---------------------------------------------------------------------------
// Scope of practice: the dated lab check-offs.
//
// Small screen, large consequence. The date entered here decides whether a
// month of venipunctures is evidence or a claim, so it is a date and a signer,
// never a checkbox — and withdrawing one asks for a reason the same way
// withdrawing a preceptor's signature does, because it has the same effect on
// the counts.
//
// Distinct from ClearancePanel, which is the hospital's health and background
// file. That decides whether the student may be in the building; this decides
// what they may do once they are.
// ---------------------------------------------------------------------------

function GrantModal({
  student,
  clearance,
  onClose,
}: {
  student: AemtStudent
  clearance: SkillClearance
  onClose: () => void
}) {
  const existing = clearedOn(student, clearance.code)
  const [date, setDate] = useState(existing ?? todayISO())
  const [by, setBy] = useState('')
  const [note, setNote] = useState('')
  const { actor } = useRecordSafety()

  return (
    <Modal title={`${clearance.label} check-off`} onClose={onClose}>
      <div className="banner info" style={{ marginTop: 0 }}>
        {student.name} · {clearance.grantedAt}
      </div>
      <div className="field">
        <label htmlFor="cl-date">Date of the check-off</label>
        <input id="cl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="help-text">
          {clearance.gates.length > 0 ? (
            <>
              Reps dated <strong>before</strong> this do not count. If the lab was two weeks ago,
              enter the day it happened — not today, or two weeks of work stops counting.
            </>
          ) : (
            <>Recorded for the rotation plan. This one does not refuse counts.</>
          )}
        </div>
      </div>
      <div className="field">
        <label htmlFor="cl-by">Instructor who signed it off</label>
        <input
          id="cl-by"
          value={by}
          onChange={(e) => setBy(e.target.value)}
          placeholder="Primary instructor"
        />
      </div>
      <div className="field">
        <label htmlFor="cl-note">Note (optional)</label>
        <input
          id="cl-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Second attempt — passed"
        />
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!date}
          onClick={() => {
            grantSkillClearance(student.id, clearance.code, date, {
              actor,
              grantedBy: by,
              note,
            })
            onClose()
          }}
        >
          {existing ? 'Update the date' : 'Record the check-off'}
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

export default function SkillClearancePanel({
  student,
  canEdit,
}: {
  student: AemtStudent
  canEdit: boolean
}) {
  const [granting, setGranting] = useState<SkillClearance | null>(null)
  const [withdrawing, setWithdrawing] = useState<SkillClearance | null>(null)
  const { actor } = useRecordSafety()

  const missing = SKILL_CLEARANCES.filter(
    (c) => c.gates.length > 0 && !clearedOn(student, c.code),
  )

  return (
    <>
      <div className="section-title" style={{ marginTop: 16 }}>
        Scope of practice
      </div>
      <div className="help-text" style={{ marginTop: 0 }}>
        Lab check-offs, by date. What a rep counts as depends on whether the student was cleared on
        the day of the shift, so these are dates rather than ticks.
      </div>

      {missing.length > 0 && (
        <div className="banner warn">
          No check-off on file for {missing.map((c) => c.label.toLowerCase()).join(' or ')}. Reps
          against{' '}
          {missing.flatMap((c) => c.gates).join(', ')} cannot be logged until the lab date is
          recorded.
        </div>
      )}

      <div className="list">
        {SKILL_CLEARANCES.map((c) => {
          const on = clearedOn(student, c.code)
          const enforced = c.gates.length > 0
          return (
            <div
              key={c.code}
              className={`row left-accent ${on ? 'acc-ok' : enforced ? 'acc-warn' : ''}`}
            >
              <div className="grow">
                <div className="title">{c.label}</div>
                <div className="meta">
                  {on ? (
                    <>✓ Cleared {formatDate(on)}</>
                  ) : (
                    <span style={{ color: enforced ? 'var(--warn)' : undefined }}>
                      Not recorded
                    </span>
                  )}
                </div>
                <div className="meta">{c.note}</div>
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn sm" onClick={() => setGranting(c)}>
                    {on ? 'Change date' : 'Record'}
                  </button>
                  {on && (
                    <button className="btn sm" onClick={() => setWithdrawing(c)}>
                      Withdraw
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {granting && (
        <GrantModal student={student} clearance={granting} onClose={() => setGranting(null)} />
      )}
      {withdrawing && (
        <ReasonModal
          title={`Withdraw the ${withdrawing.label.toLowerCase()} check-off?`}
          body={
            withdrawing.gates.length > 0
              ? `Every ${withdrawing.gates.join(', ')} rep already logged for ${student.name} stops counting toward its K.A.R. minimum from the moment this is withdrawn.`
              : 'The date comes off the record. Counts are unaffected — this clearance does not gate them.'
          }
          placeholder="Check-off recorded against the wrong student"
          confirmLabel="Withdraw check-off"
          actor={actor}
          onConfirm={(reason) =>
            revokeSkillClearance(student.id, withdrawing.code, actor, reason)
          }
          onClose={() => setWithdrawing(null)}
        />
      )}
    </>
  )
}
