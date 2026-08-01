import { useState } from 'react'
import { Empty, Modal, ProgressBar } from '../../components/ui'
import { confirmAction } from '../../lib/dialog'
import { formatDate } from '../../lib/date'
import {
  useStudents,
  useEncounters,
  useShifts,
  useClinicalStanding,
  useRecordSafety,
  supervisorEligible,
  duplicateEncounter,
  voidEncounter,
  addEncounter,
  progressFor,
} from './aemtStore'
import {
  CLINICAL_REQUIREMENTS,
  KAR_109_11_8,
  PROGRAM_COMPETENCIES,
  PRECEPTOR_LABELS,
} from '../../data/aemt'
import type { PreceptorCredential } from '../../data/aemt'
import ShiftPanel, { shiftLabel } from './ShiftPanel'
import { useCan } from '../../lib/role'
import type { AemtClinicalShift, AemtCourse, AemtEncounter, AemtSiteKind } from '../../types'

const SITE_LABEL: Record<AemtSiteKind, string> = {
  field: 'Field',
  hospital: 'Hospital',
  lab: 'Lab',
}

function LogForm({
  course,
  studentId,
  shifts,
  existing,
  onClose,
}: {
  course: AemtCourse
  studentId: string
  shifts: AemtClinicalShift[]
  /** Already-logged encounters for this student, for duplicate detection. */
  existing: AemtEncounter[]
  onClose: () => void
}) {
  const [shiftId, setShiftId] = useState(shifts[0]?.id ?? '')
  const [requirementId, setReq] = useState(KAR_109_11_8[0].id)
  const [outcome, setOutcome] = useState<'success' | 'attempt'>('success')
  const [initiatedInfusion, setInfusion] = useState(false)
  const [sourceRef, setSourceRef] = useState('')

  const req = CLINICAL_REQUIREMENTS.find((r) => r.id === requirementId)!
  const shift = shifts.find((s) => s.id === shiftId)
  const siteKind = shift?.setting
  const settingOk = !!siteKind && req.allowedSettings.includes(siteKind)
  const supOk = supervisorEligible(req, shift)
  // A lab exercise has no run number to give; anything on a patient does.
  const refRequired = siteKind !== 'lab'
  const dupe = duplicateEncounter(existing, {
    studentId,
    shiftId,
    requirementId,
    sourceRef,
  })
  const canLog = !!shift && (!refRequired || sourceRef.trim() !== '') && !dupe

  return (
    <Modal title="Log encounter" onClose={onClose}>
      <div className="banner warn" style={{ marginBottom: 12 }}>
        <strong>No patient information.</strong> This log records the skill, site, and preceptor
        only — never names, dates of birth, or any other PHI.
      </div>
      <div className="field">
        <label htmlFor="ae-shift">Shift</label>
        <select id="ae-shift" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {shiftLabel(s)} — {s.preceptorName}
              {s.attestedAt ? '' : ' (not attested)'}
            </option>
          ))}
        </select>
        <div className="help-text">
          Date, site and preceptor come from the shift, so every rep is tied to a real one.
        </div>
      </div>
      <div className="field">
        <label htmlFor="ae-req">Requirement</label>
        <select id="ae-req" value={requirementId} onChange={(e) => setReq(e.target.value)}>
          <optgroup label="K.A.R. 109-11-8(a)(4) minimums">
            {KAR_109_11_8.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} (min {r.minimum})
              </option>
            ))}
          </optgroup>
          <optgroup label="Program competencies">
            {PROGRAM_COMPETENCIES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} (min {r.minimum})
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      {/* One record per performance. A row claiming "12" is one assertion
          standing in for twelve procedures, sharing a single outcome and a
          single reference — which is not evidence of twelve of anything. */}
      <div className="field">
        <label htmlFor="ae-outcome">Outcome</label>
        <select
          id="ae-outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as 'success' | 'attempt')}
        >
          <option value="success">Successfully performed</option>
          <option value="attempt">Attempted — not successful</option>
        </select>
        <div className="help-text">
          K.A.R. 109-11-8 counts successful performances. An attempt is recorded and shown, and is
          what a remediation plan is built from, but it does not count toward the minimum.
        </div>
      </div>

      {shift && (
        <div className="banner info" style={{ marginTop: 4 }}>
          {SITE_LABEL[shift.setting]} · {shift.site} · {shift.preceptorName} (
          {PRECEPTOR_LABELS[shift.preceptorCredential as PreceptorCredential]})
        </div>
      )}
      {shift && !settingOk && (
        <div className="banner crit">
          {req.label} does not count on a {SITE_LABEL[shift.setting].toLowerCase()} shift. It will
          be logged but excluded. Allowed: {req.allowedSettings.join(', ')}.
        </div>
      )}
      {shift && settingOk && !supOk && (
        <div className="banner crit">
          A {PRECEPTOR_LABELS[shift.preceptorCredential as PreceptorCredential]} may not supervise{' '}
          {req.label.toLowerCase()} — K.A.R. names{' '}
          {(req.eligibleSupervisors ?? []).map((c) => PRECEPTOR_LABELS[c]).join(', ')}. This entry
          will be logged but will not count.
        </div>
      )}
      {shift && settingOk && supOk && !shift.attestedAt && (
        <div className="banner warn">
          This shift has not been attested by the preceptor yet, so the entry will not count until
          it is.
        </div>
      )}

      <div className="field">
        <label htmlFor="ae-ref">
          Run / incident reference{refRequired ? ' (required)' : ' (optional for lab/sim)'}
        </label>
        <input
          id="ae-ref"
          value={sourceRef}
          onChange={(e) => setSourceRef(e.target.value)}
          placeholder={refRequired ? 'ImageTrend incident number' : 'Lab exercise reference'}
        />
        <div className="help-text">
          Ties the entry to a source record, and is what makes a duplicate detectable. An incident
          number only — never a patient identifier.
        </div>
      </div>
      {dupe && (
        <div className="banner crit">
          <strong>Already logged.</strong> {req.label} on this shift with reference{' '}
          {dupe.sourceRef} is on file
          {dupe.date ? ` from ${dupe.date}` : ''}. Logging it again would count the same
          performance twice.
        </div>
      )}

      {req.subRequirement && (
        <label className="field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={initiatedInfusion}
            onChange={(e) => setInfusion(e.target.checked)}
            style={{ width: 'auto', minHeight: 0 }}
          />
          <span>
            This stick {req.subRequirement.label} ({req.subRequirement.minimum} of{' '}
            {req.minimum} required)
          </span>
        </label>
      )}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!canLog}
          onClick={() => {
            if (!shift) return
            addEncounter(course.id, studentId, {
              date: shift.date,
              requirementId,
              siteKind: shift.setting,
              site: shift.site,
              count: 1,
              outcome,
              initiatedInfusion: req.subRequirement ? initiatedInfusion : undefined,
              shiftId: shift.id,
              sourceRef: sourceRef.trim() || undefined,
              preceptor: shift.preceptorName,
            })
            onClose()
          }}
        >
          Log it
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

export default function ClinicalTab({ course }: { course: AemtCourse }) {
  const students = useStudents(course.id)
  const encounters = useEncounters(course.id)
  const allShifts = useShifts(course.id)
  const standing = useClinicalStanding(course.id)
  const { editRideWork: canEdit } = useCan()
  const [selectedId, setSelected] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)
  const safety = useRecordSafety()

  if (students.length === 0) {
    return (
      <Empty icon="🧑‍🚒" title="No students yet">
        Add students on the Roster tab, then log their clinical and field encounters here.
      </Empty>
    )
  }

  const studentId = selectedId ?? students[0].id
  const student = students.find((s) => s.id === studentId) ?? students[0]
  const shifts = allShifts.filter((s) => s.studentId === student.id)
  const progress = progressFor(encounters, student.id, shifts)
  const mine = encounters.filter((e) => e.studentId === student.id)
  // Only the seven K.A.R. 109-11-8(a)(4) minimums count toward standing.
  const statutory = progress.filter((p) => p.requirement.basis === 'kar')
  const program = progress.filter((p) => p.requirement.basis === 'program')
  const metCount = statutory.filter((p) => p.met).length

  return (
    <div>
      <div className="banner info">
        Progress toward the <strong>seven K.A.R. 109-11-8(a)(4)</strong> clinical minimums. A rep
        counts only when the setting is allowed for that requirement, the preceptor holds a
        credential the regulation accepts for it, and the shift has been attested. Anything short
        of that is kept and shown, never folded into the total.
      </div>

      {/* Class overview — who is short, at a glance. */}
      <div className="section-title">Class standing</div>
      <div className="list">
        {standing.map((s) => (
          <button
            key={s.student.id}
            className="row"
            style={{
              width: '100%',
              textAlign: 'left',
              background: s.student.id === student.id ? 'var(--muted-bg)' : undefined,
              border: 'none',
              font: 'inherit',
            }}
            onClick={() => setSelected(s.student.id)}
          >
            <div className="grow">
              <div className="title">{s.student.name}</div>
              <div className="meta">
                {s.metCount} of {s.statutory.length} K.A.R. minimums complete
              </div>
              <div style={{ marginTop: 6 }}>
                <ProgressBar
                  pct={Math.round((s.metCount / s.statutory.length) * 100)}
                  complete={s.complete}
                />
              </div>
            </div>
            {s.complete && <span className="pill ok">✓ All met</span>}
          </button>
        ))}
      </div>

      <div className="section-title">
        {student.name} · {metCount} of {statutory.length} met
      </div>

      <ShiftPanel course={course} studentId={student.id} shifts={shifts} canEdit={canEdit} />

      {program.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 16 }}>
            Program competencies
          </div>
          <div className="help-text" style={{ marginTop: 0 }}>
            Tracked by this program, not numbered by K.A.R. 109-11-8(a)(4). These do not gate
            completion — subsection (a)(2) has the primary instructor attest practical skills
            instead.
          </div>
          <div className="list">
            {program.map((p) => (
              <div
                key={p.requirement.id}
                className={`row left-accent ${p.met ? 'acc-ok' : 'acc-warn'}`}
              >
                <div className="grow">
                  <div className="title">{p.requirement.label}</div>
                  <div className="meta">{p.requirement.site}</div>
                </div>
                <span className={`pill ${p.met ? 'ok' : 'warn'}`}>
                  {p.total}/{p.requirement.minimum}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {canEdit && (
        <div className="toolbar">
          <div className="spacer" />
          <button
            className="btn primary"
            disabled={shifts.length === 0}
            title={shifts.length === 0 ? 'Add a shift first' : 'Log an encounter on a shift'}
            onClick={() => setLogging(true)}
          >
            + Log encounter
          </button>
        </div>
      )}

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Requirement</th>
              <th style={{ textAlign: 'right' }}>Logged</th>
              <th style={{ textAlign: 'right' }}>Min</th>
              <th style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {statutory.map((p) => (
              <tr key={p.requirement.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.requirement.label}</div>
                  {p.requirement.fieldMinimum ? (
                    <div
                      className="subtle"
                      style={{ fontSize: 12, color: p.fieldMet ? undefined : 'var(--crit)' }}
                    >
                      field {p.field}/{p.requirement.fieldMinimum}
                      {!p.fieldMet && ' — field share not met'}
                    </div>
                  ) : null}
                  {p.attempts > 0 ? (
                    <div className="subtle" style={{ fontSize: 12, color: 'var(--warn)' }}>
                      {p.attempts} unsuccessful attempt{p.attempts === 1 ? '' : 's'} — recorded,
                      not counted
                    </div>
                  ) : null}
                  {p.unitemized > 0 ? (
                    <div className="subtle" style={{ fontSize: 12, color: 'var(--warn)' }}>
                      {p.unitemized} of these come from batch rows standing in for several
                      performances
                    </div>
                  ) : null}
                  {p.unstated > 0 ? (
                    <div className="subtle" style={{ fontSize: 12, color: 'var(--warn)' }}>
                      {p.unstated} logged before success was recorded — counted as successful
                    </div>
                  ) : null}
                  {p.voided > 0 ? (
                    <div className="subtle" style={{ fontSize: 12 }}>
                      {p.voided} voided
                    </div>
                  ) : null}
                  {p.ineligible > 0 ? (
                    <div className="subtle" style={{ fontSize: 12, color: 'var(--warn)' }}>
                      {p.ineligible} logged but not counting
                      {p.unverified > 0 && ` (${p.unverified} on an unattested shift)`}
                    </div>
                  ) : null}
                  {p.requirement.subRequirement ? (
                    <div
                      className="subtle"
                      style={{ fontSize: 12, color: p.subMet ? undefined : 'var(--crit)' }}
                    >
                      {p.sub}/{p.requirement.subRequirement.minimum}{' '}
                      {p.requirement.subRequirement.label}
                    </div>
                  ) : null}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.total}</td>
                <td style={{ textAlign: 'right' }} className="subtle">
                  {p.requirement.minimum}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`pill ${p.met ? 'ok' : 'warn'}`}>{p.met ? '✓' : 'open'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">Log · {mine.length} entries</div>
      {mine.length === 0 ? (
        <div className="banner info">Nothing logged for {student.name} yet.</div>
      ) : (
        <div className="list">
          {mine.map((e) => {
            const req = CLINICAL_REQUIREMENTS.find((r) => r.id === e.requirementId)
            return (
              <div
                key={e.id}
                className={`row left-accent ${e.voidedAt ? 'acc-crit' : e.outcome === 'attempt' ? 'acc-warn' : ''}`}
                style={e.voidedAt ? { opacity: 0.65 } : undefined}
              >
                <div className="grow">
                  <div className="title">
                    {req?.label ?? e.requirementId}
                    {e.count > 1 && (
                      <span className="pill warn" style={{ marginLeft: 8 }}>
                        ×{e.count} unitemized
                      </span>
                    )}
                    {e.outcome === 'attempt' && (
                      <span className="pill warn" style={{ marginLeft: 8 }}>
                        attempt — not counted
                      </span>
                    )}
                    {e.outcome === undefined && !e.voidedAt && (
                      <span className="pill warn" style={{ marginLeft: 8 }}>
                        outcome not stated
                      </span>
                    )}
                    {e.initiatedInfusion && (
                      <span className="pill info" style={{ marginLeft: 8 }}>
                        infusion
                      </span>
                    )}
                    {e.voidedAt && (
                      <span className="pill crit" style={{ marginLeft: 8 }}>
                        voided
                      </span>
                    )}
                  </div>
                  <div className="meta">
                    {formatDate(e.date)} · {SITE_LABEL[e.siteKind]}
                    {e.site && ` · ${e.site}`}
                    {e.preceptor && ` · ${e.preceptor}`}
                    {e.sourceRef ? ` · ref ${e.sourceRef}` : ' · no reference'}
                  </div>
                  {e.voidedAt && (
                    <div className="meta" style={{ color: 'var(--crit)' }}>
                      Voided by {e.voidedBy} — {e.voidReason}
                    </div>
                  )}
                </div>
                {canEdit && !e.voidedAt && (
                  <button
                    className="btn sm danger"
                    aria-label={`Void this ${req?.label ?? e.requirementId} entry`}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: 'Void this entry?',
                        body: 'It stops counting but stays on the record with the reason, so the correction is traceable. Deleting a regulated count outright is not an option.',
                        confirmLabel: 'Void entry',
                      })
                      if (ok) voidEncounter(e.id, safety.actor, 'voided by coordinator')
                    }}
                  >
                    Void
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {logging && (
        <LogForm
          course={course}
          studentId={student.id}
          shifts={shifts}
          existing={mine}
          onClose={() => setLogging(false)}
        />
      )}
    </div>
  )
}
