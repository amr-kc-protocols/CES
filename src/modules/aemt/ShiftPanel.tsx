import { useState } from 'react'
import { confirmAction } from '../../lib/dialog'
import { Modal } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/date'
import {
  addShift,
  updateShift,
  attestShift,
  deleteShift,
  shiftHourTotals,
  useRecordSafety,
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

  const allowed = SETTING_PRECEPTORS[setting]
  const credOk = allowed.includes(cred as PreceptorCredential)
  const hoursNum = Number(hours)
  const valid = site.trim() !== '' && name.trim() !== '' && hoursNum > 0 && credOk

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
            if (existing) updateShift(existing.id, patch)
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
  const safety = useRecordSafety()
  const totals = shiftHourTotals(shifts)

  return (
    <>
      <div className="section-title">Clinical &amp; field shifts</div>
      <div className="toolbar">
        {/* Attested hours against the course's filed commitment — the number
            that has to be defensible, not the number of shifts logged. */}
        <span className="subtle">
          {course.targets ? (
            <>
              <strong style={{ color: totals.hospital >= course.targets.clinical ? '#166534' : undefined }}>
                {totals.hospital}/{course.targets.clinical} h
              </strong>{' '}
              hospital ·{' '}
              <strong style={{ color: totals.field >= course.targets.field ? '#166534' : undefined }}>
                {totals.field}/{course.targets.field} h
              </strong>{' '}
              field attested
            </>
          ) : (
            <>
              {totals.hospital} h hospital · {totals.field} h field attested
            </>
          )}
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
                  {s.attestedAt ? (
                    <>✓ Attested {formatDate(s.attestedAt.slice(0, 10))}</>
                  ) : (
                    <span style={{ color: 'var(--warn)' }}>
                      Not attested — encounters on this shift do not count yet
                    </span>
                  )}
                </div>
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn sm" onClick={() => setEditing(s)}>
                    Edit
                  </button>
                  <button
                    className={`btn sm ${s.attestedAt ? '' : 'primary'}`}
                    onClick={() => attestShift(s.id, !s.attestedAt, safety.actor)}
                  >
                    {s.attestedAt ? 'Un-attest' : 'Attest'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
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
