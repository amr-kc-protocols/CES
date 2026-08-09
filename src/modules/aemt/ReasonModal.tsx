import { useState } from 'react'
import { Modal } from '../../components/ui'

// ---------------------------------------------------------------------------
// Reason capture for a consequential reversal.
//
// Voiding a rep, withdrawing a preceptor's signature, revoking a skill sign-off
// and revoking a completion all reach a store function that takes a `reason`
// and writes it to the audit trail. Each caller used to supply a literal —
// 'voided by coordinator', 'withdrawn by coordinator' — so every one of those
// entries said the same thing for every course, which is the same as saying
// nothing. The reason is the part an auditor reads.
//
// Deliberately not `confirmAction`: that resolves a boolean, and a reversal
// that has to be explained needs a field, not an OK button.
// ---------------------------------------------------------------------------

export default function ReasonModal({
  title,
  body,
  label = 'Reason (required)',
  placeholder,
  confirmLabel,
  actor,
  onConfirm,
  onClose,
}: {
  title: string
  /** What this reversal does, in plain words. */
  body: string
  label?: string
  placeholder?: string
  confirmLabel: string
  /** Who the audit trail will attribute it to. */
  actor: string
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  // Four characters is enough to stop an empty field and a stray keypress
  // without pretending the app can judge whether a reason is a good one.
  const valid = reason.trim().length >= 4

  return (
    <Modal title={title} onClose={onClose}>
      <div className="banner crit" style={{ marginTop: 0 }}>
        {body}
      </div>
      <div className="field">
        <label htmlFor="rsn-text">{label}</label>
        <textarea
          id="rsn-text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          autoFocus
        />
        <div className="help-text">
          Recorded in the audit trail against <strong>{actor}</strong>, and printed in the course
          audit package.
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn danger"
          disabled={!valid}
          title={valid ? undefined : 'Say why — this is what an auditor reads'}
          onClick={() => {
            onConfirm(reason.trim())
            onClose()
          }}
        >
          {confirmLabel}
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}
