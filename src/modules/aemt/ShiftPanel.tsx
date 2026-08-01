import { useState } from 'react'
import { confirmAction } from '../../lib/dialog'
import { Modal } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/date'
import {
  addShift,
  updateShift,
  attestShift,
  withdrawAttestation,
  attestationIsEvidence,
  materialShiftChanges,
  deleteShift,
  shiftHourTotals,
  useRecordSafety,
  ATTESTATION_STATEMENT,
} from './aemtStore'
import { PRECEPTOR_LABELS, SETTING_PRECEPTORS } from '../../data/aemt'
import type { PreceptorCredential } from '../../data/aemt'
import type { AemtClinicalShift, AemtCourse, AemtSiteKind, PreceptorCredentialId } from '../../types'

// ---------------------------------------------------------------------------
// Clinical and field shifts. Encounters hang off these, so a logged rep
// inherits a date, a site and an identified preceptor rather than being a
// number someone typed. A shift only counts once the preceptor has attested.
// ---------------------------------------------------------------------------

const SETTINGS: { value: AemtSiteKind; label: string }[] = [
  { value: 'field', label: 'Field internship' },
  { value: 'hospital', label: 'Hospital clinical' },
  { value: 'lab', label: 'Skills lab / sim' },
]

/** An hours figure, shown against its filed target where one exists. */
function Against({ n, target }: { n: number; target?: number }) {
  if (typeof target !== 'number') return <strong>{n} h</strong>
  return (
    <strong style={{ color: n >= target ? '#166534' : undefined }}>
      {n}/{target} h
    </strong>
  )
}

export function shiftLabel(s: AemtClinicalShift): string {
  return `${formatDate(s.date)} · ${s.site || SETTINGS.find((x) => x.value === s.setting)?.label}`
}

function ShiftForm({
  course,
  studentId,
  existing,
  onClose,
}: {
  course: AemtCourse
  studentId: string
  existing?: AemtClinicalShift
  onClose: () => void
}) {
  const [date, setDate] = useState(existing?.date ?? todayISO())
  const [setting, setSetting] = useState<AemtSiteKind>(existing?.setting ?? 'field')
  const [site, setSite] = useState(existing?.site ?? '')
  const [hours, setHours] = useState(String(existing?.hours ?? 12))
  const [name, setName] = useState(existing?.preceptorName ?? '')
  const [cred, setCred] = useState<PreceptorCredentialId>(
    existing?.preceptorCredential ?? 'paramedic',
  )
  const [certNumber, setCertNumber] = useState(existing?.preceptorCertNumber ?? '')
  const [reason, setReason] = useState('')
  const { actor } = useRecordSafety()

  const allowed = SETTING_PRECEPTORS[setting]
  const credOk = allowed.includes(cred as PreceptorCredential)
  const hoursNum = Number(hours)
  // Would saving change something the preceptor signed for?
  const willInvalidate =
    !!existing &&
    attestationIsEvidence(existing) &&
    materialShiftChanges(existing, {
      date,
      setting,
      site: site.trim(),
      hours: hoursNum,
      preceptorName: name.trim(),
      preceptorCredential: cred,
      preceptorCertNumber: certNumber.trim() || undefined,
    }).length > 0
  const valid =
    site.trim() !== '' &&
    name.trim() !== '' &&
    hoursNum > 0 &&
    credOk &&
    (!willInvalidate || reason.trim().length >= 4)

  return (
    <Modal title={existing ? 'Edit shift' : 'Add shift'} onClose={onClose}>
      <div className="field-row">
        <div className="field">
          <label htmlFor="sh-date">Date</label>
          <input id="sh-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sh-hours">Hours</label>
          <input
            id="sh-hours"
            type="number"
            min={0}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="sh-setting">Setting</label>
        <select
          id="sh-setting"
          value={setting}
          onChange={(e) => setSetting(e.target.value as AemtSiteKind)}
        >
          {SETTINGS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="sh-site">Site</label>
        <input
          id="sh-site"
          value={site}
          onChange={(e) => setSite(e.target.value)}
          placeholder={setting === 'hospital' ? 'AdventHealth KC — ED' : 'AMR Independence 911'}
        />
      </div>

      <div className="section-title" style={{ marginTop: 14 }}>
        Preceptor
      </div>
      <div className="field">
        <label htmlFor="sh-prec">Name</label>
        <input id="sh-prec" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="sh-cred">Credential</label>
          <select
            id="sh-cred"
            value={cred}
            onChange={(e) => setCred(e.target.value as PreceptorCredentialId)}
          >
            {(Object.keys(PRECEPTOR_LABELS) as PreceptorCredential[]).map((c) => (
              <option key={c} value={c}>
                {PRECEPTOR_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sh-cert">Licence / cert #</label>
          <input
            id="sh-cert"
            value={certNumber}
            onChange={(e) => setCertNumber(e.target.value)}
          />
        </div>
      </div>
      {!credOk && (
        <div className="banner crit">
          A {PRECEPTOR_LABELS[cred as PreceptorCredential]} cannot precept a{' '}
          {SETTINGS.find((s) => s.value === setting)?.label.toLowerCase()} shift under K.A.R.
          109-1-1. Allowed:{' '}
          {allowed.map((c) => PRECEPTOR_LABELS[c]).join(', ')}.
        </div>
      )}

      {willInvalidate && (
        <>
          <div className="banner crit">
            <strong>This invalidates the signature on this shift.</strong>{' '}
            {existing?.attestation?.by} signed for the values as they stand. Saving keeps the
            original as a revision, clears the attestation, and the shift has to be signed again
            before its encounters count.
          </div>
          <div className="field">
            <label htmlFor="sh-reason">Reason for the correction (required)</label>
            <input
              id="sh-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Hours corrected from the crew schedule"
            />
          </div>
        </>
      )}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!valid}
          onClick={() => {
            const patch = {
              date,
              setting,
              site: site.trim(),
              hours: hoursNum,
              preceptorName: name.trim(),
              preceptorCredential: cred,
              preceptorCertNumber: certNumber.trim() || undefined,
            }
            if (existing) updateShift(existing.id, patch, { actor, reason })
            else addShift(course.id, studentId, patch)
            onClose()
          }}
        >
          {existing ? 'Save' : 'Add shift'}
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        {existing && (
          <button
            className="btn danger"
            style={{ marginLeft: 'auto' }}
            onClick={async () => {
              const ok = await confirmAction({
                title: 'Delete this shift?',
                body: 'Encounters logged on it go too — a rep with no shift behind it has no date, site or preceptor. Undo is offered afterwards.',
                confirmLabel: 'Delete shift',
              })
              if (ok) {
                deleteShift(existing.id)
                onClose()
              }
            }}
          >
            Delete
          </button>
        )}
      </div>
    </Modal>
  )
}

/**
 * Signing a shift. Previously a toggle: one tap set a timestamp with nobody
 * behind it, and that timestamp was enough to make every encounter on the
 * shift count toward a regulated minimum. A signature has to identify who
 * signed, under what credential and licence number, and what they agreed to.
 */
function AttestModal({
  shift,
  actor,
  onClose,
}: {
  shift: AemtClinicalShift
  actor: string
  onClose: () => void
}) {
  const [by, setBy] = useState(shift.preceptorName)
  const [cred, setCred] = useState<PreceptorCredentialId>(shift.preceptorCredential)
  const [certNumber, setCert] = useState(shift.preceptorCertNumber ?? '')
  const [agreed, setAgreed] = useState(false)

  const valid = by.trim() !== '' && certNumber.trim() !== '' && agreed

  return (
    <Modal title="Attest this shift" onClose={onClose}>
      <div className="banner info" style={{ marginTop: 0 }}>
        {shiftLabel(shift)} · {shift.hours} h
      </div>
      <div className="field">
        <label htmlFor="at-by">Preceptor signing</label>
        <input id="at-by" value={by} onChange={(e) => setBy(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="at-cred">Credential</label>
          <select
            id="at-cred"
            value={cred}
            onChange={(e) => setCred(e.target.value as PreceptorCredentialId)}
          >
            {(Object.keys(PRECEPTOR_LABELS) as PreceptorCredential[]).map((c) => (
              <option key={c} value={c}>
                {PRECEPTOR_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="at-cert">Licence / cert # (required)</label>
          <input id="at-cert" value={certNumber} onChange={(e) => setCert(e.target.value)} />
        </div>
      </div>
      <label
        className="subtle"
        style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10 }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>{ATTESTATION_STATEMENT}</span>
      </label>
      <div className="help-text">
        Signed as <strong>{actor}</strong>, recorded with the shift and written to the audit trail.
        Editing the date, hours, site or preceptor afterwards invalidates this signature.
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!valid}
          onClick={() => {
            attestShift(shift.id, {
              by: by.trim(),
              credential: cred,
              certNumber: certNumber.trim(),
              actor,
            })
            onClose()
          }}
        >
          Sign attestation
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

export default function ShiftPanel({
  course,
  studentId,
  shifts,
  canEdit,
}: {
  course: AemtCourse
  studentId: string
  shifts: AemtClinicalShift[]
  canEdit: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AemtClinicalShift | null>(null)
  const [attesting, setAttesting] = useState<AemtClinicalShift | null>(null)
  const safety = useRecordSafety()
  const totals = shiftHourTotals(shifts)

  return (
    <>
      <div className="section-title">Clinical &amp; field shifts</div>
      <div className="toolbar">
        {/* Attested hours against the course's filed commitment — the number
            that has to be defensible, not the number of shifts logged. */}
        <span className="subtle">
          {/* Each figure carries its target only when the course filed one —
              an unfiled category shows the hours worked and nothing implied. */}
          <Against n={totals.hospital} target={course.targets?.clinical} /> hospital ·{' '}
          <Against n={totals.field} target={course.targets?.field} /> field attested
          {totals.unattested > 0 && (
            <span style={{ color: 'var(--warn)' }}>
              {' '}
              · {totals.unattested} h awaiting attestation
            </span>
          )}
        </span>
        <div className="spacer" />
        {canEdit && (
          <button className="btn sm primary" onClick={() => setAdding(true)}>
            + Shift
          </button>
        )}
      </div>

      {shifts.length === 0 ? (
        <div className="banner info">
          No shifts yet. Add the shift first, then log encounters against it — that is what ties a
          rep to a date, a site and a named preceptor.
        </div>
      ) : (
        <div className="list">
          {shifts.map((s) => (
            <div
              key={s.id}
              className={`row left-accent ${s.attestedAt ? 'acc-ok' : 'acc-warn'}`}
            >
              <div className="grow">
                <div className="title">{shiftLabel(s)}</div>
                <div className="meta">
                  {s.hours} h · {s.preceptorName} (
                  {PRECEPTOR_LABELS[s.preceptorCredential as PreceptorCredential]}
                  {s.preceptorCertNumber ? ` #${s.preceptorCertNumber}` : ''})
                </div>
                <div className="meta">
                  {attestationIsEvidence(s) ? (
                    <>
                      ✓ Signed {formatDate(s.attestation!.at.slice(0, 10))} by{' '}
                      {s.attestation!.by} (
                      {PRECEPTOR_LABELS[s.attestation!.credential as PreceptorCredential]}
                      {s.attestation!.certNumber ? ` #${s.attestation!.certNumber}` : ''})
                    </>
                  ) : s.attestedAt ? (
                    <span style={{ color: 'var(--crit)' }}>
                      Attested with no signer recorded — does not count. Sign it again.
                    </span>
                  ) : (
                    <span style={{ color: 'var(--warn)' }}>
                      Not attested — encounters on this shift do not count yet
                    </span>
                  )}
                </div>
                {(s.revisions?.length ?? 0) > 0 && (
                  <div className="meta" style={{ color: 'var(--warn)' }}>
                    {s.revisions!.length} correction{s.revisions!.length === 1 ? '' : 's'} after
                    signature — latest: {s.revisions![s.revisions!.length - 1].reason}
                  </div>
                )}
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn sm" onClick={() => setEditing(s)}>
                    Edit
                  </button>
                  {attestationIsEvidence(s) ? (
                    <button
                      className="btn sm"
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: 'Withdraw this attestation?',
                          body: `${s.attestation!.by} signed this shift. Withdrawing it stops every encounter on the shift from counting, and is recorded in the audit trail.`,
                          confirmLabel: 'Withdraw signature',
                        })
                        if (ok) withdrawAttestation(s.id, safety.actor, 'withdrawn by coordinator')
                      }}
                    >
                      Withdraw
                    </button>
                  ) : (
                    <button
                      className="btn sm primary"
                      disabled={!safety.canRecordOfficial}
                      title={
                        safety.canRecordOfficial
                          ? 'Sign this shift as the supervising preceptor'
                          : safety.reason
                      }
                      onClick={() => setAttesting(s)}
                    >
                      Attest
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!safety.canRecordOfficial && (
        <div className="banner warn">
          <strong>Signatures unavailable.</strong> {safety.reason} Shifts can be logged, but they
          cannot be attested, so nothing on them counts yet.
        </div>
      )}

      {attesting && (
        <AttestModal shift={attesting} actor={safety.actor} onClose={() => setAttesting(null)} />
      )}
      {adding && <ShiftForm course={course} studentId={studentId} onClose={() => setAdding(false)} />}
      {editing && (
        <ShiftForm
          course={course}
          studentId={studentId}
          existing={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
