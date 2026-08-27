import { useState } from 'react'
import { Empty, Modal, ProgressBar } from '../../components/ui'
import { formatDate } from '../../lib/date'
import ReasonModal from './ReasonModal'
import {
  useStudents,
  useEncounters,
  useShifts,
  useClinicalStanding,
  useRecordSafety,
  supervisorEligible,
  clearanceGate,
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
import ClearancePanel from './ClearancePanel'
import SkillClearancePanel from './SkillClearancePanel'
import PhasePanel from './PhasePanel'
import { useCan } from '../../lib/role'
import type {
  AemtClinicalShift,
  AemtCourse,
  AemtEncounter,
  AemtSiteKind,
  AemtStudent,
} from '../../types'

/**
 * Encounters that share a shift and a requirement, in the order they were
 * logged. Everything the rows have in common — date, setting, site, preceptor —
 * belongs to the group; only the reference and its outcome differ.
 */
interface EncounterGroup {
  key: string
  requirementId: string
  date: string
  siteKind: AemtSiteKind
  site?: string
  preceptor?: string
  entries: AemtEncounter[]
}

function groupEncounters(encounters: AemtEncounter[]): EncounterGroup[] {
  const byKey = new Map<string, EncounterGroup>()
  for (const e of encounters) {
    // Shift first: two venipunctures on the same date at different sites are
    // not the same block of work, and a rep with no shift stands on its own.
    const key = `${e.shiftId ?? `noshift-${e.id}`}:${e.requirementId}`
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        requirementId: e.requirementId,
        date: e.date,
        siteKind: e.siteKind,
        site: e.site,
        preceptor: e.preceptor,
        entries: [],
      })
    }
    byKey.get(key)!.entries.push(e)
  }
  return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date))
}

const SITE_LABEL: Record<AemtSiteKind, string> = {
  field: 'Field',
  hospital: 'Hospital',
  lab: 'Lab',
}

function LogForm({
  course,
  student,
  shifts,
  existing,
  onClose,
}: {
  course: AemtCourse
  student: AemtStudent
  shifts: AemtClinicalShift[]
  /** Already-logged encounters for this student, for duplicate detection. */
  existing: AemtEncounter[]
  onClose: () => void
}) {
  const studentId = student.id
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
  // Scope of practice. Unlike the setting and supervisor rules above — which
  // log the rep and exclude it — this one refuses the entry outright. Those
  // record something that happened under conditions that do not count; this
  // one would record a procedure the program never cleared the student to
  // perform, which is a different kind of claim and not one to put on file.
  const gate = clearanceGate(student, requirementId, shift?.date ?? '')
  const canLog =
    !!shift && (!refRequired || sourceRef.trim() !== '') && !dupe && !gate.blocked

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
      {/* Sits directly under the requirement select, because that is the input
          it is about — picking a different requirement clears it. */}
      {shift && gate.blocked && (
        <div className="banner crit">
          <strong>Not cleared for this yet.</strong> {gate.message} Assessments, ambulance calls and
          patient care reports on this shift can still be logged.
        </div>
      )}
      {shift && gate.gated && !gate.blocked && (
        <div className="meta" style={{ marginTop: 4 }}>
          ✓ {gate.label} check-off on file from {gate.grantedOn}
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
  // manageAemt, not editRideWork: the latter is true for FTOs, who must not
  // write to certification records.
  const { manageAemt: canEdit } = useCan()
  const [selectedId, setSelected] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)
  const [voiding, setVoiding] = useState<AemtEncounter | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
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
  const progress = progressFor(encounters, student, shifts)
  const mine = encounters.filter((e) => e.studentId === student.id)
  // Only the seven K.A.R. 109-11-8(a)(4) minimums count toward standing.
  const statutory = progress.filter((p) => p.requirement.basis === 'kar')
  const program = progress.filter((p) => p.requirement.basis === 'program')

  return (
    <div>
      {/* Before any of the below: what the facility requires of the student to
          let them through the door at all. */}
      <ClearancePanel course={course} />

      {/* The counting rules, as a footnote rather than a banner. They do not
          change, they are read once, and three lines of policy above the work
          on every visit is three lines nobody reads by the second week. */}
      <details className="rules-note">
        <summary>How a rep counts toward the seven K.A.R. 109-11-8(a)(4) minimums</summary>
        A rep counts only when the setting is allowed for that requirement, the preceptor holds a
        credential the regulation accepts for it, the student was checked off on the skill by the
        date of the shift, and the shift has been attested. Anything short of that is kept and
        shown, never folded into the total.
      </details>

      {/* Who to look at, and a way to switch. This was a stack of five full
          rows each carrying a progress bar — and early in a course every one of
          them reads "0 of 7 complete" with an empty bar, which is five rows of
          nothing. It is a chip row now: the name, the count, and how far along
          the reps themselves are, which moves from week one rather than only
          when a whole minimum tips over. The selected student's name was then
          repeated as a heading directly underneath; that heading is gone. */}
      <div className="section-title">Class standing</div>
      <div className="student-chips">
        {standing.map((s) => {
          const reps = s.statutory.reduce((n, p) => n + Math.min(p.total, p.requirement.minimum), 0)
          const need = s.statutory.reduce((n, p) => n + p.requirement.minimum, 0)
          return (
            <button
              key={s.student.id}
              className={`student-chip${s.student.id === student.id ? ' is-on' : ''}`}
              aria-pressed={s.student.id === student.id}
              onClick={() => setSelected(s.student.id)}
            >
              <span className="title">{s.student.name}</span>
              <span className="meta">
                {s.complete ? '✓ all seven met' : `${s.metCount}/${s.statutory.length} minimums · ${reps}/${need} reps`}
              </span>
              <ProgressBar
                pct={need === 0 ? 0 : Math.round((reps / need) * 100)}
                complete={s.complete}
              />
            </button>
          )
        })}
      </div>

      {/* What this student is cleared to do, before the shifts that depend on
          it — a rep refused downstream is nearly always a date missing here. */}
      <SkillClearancePanel student={student} canEdit={canEdit} />

      <PhasePanel course={course} shifts={shifts} canEdit={canEdit} />

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
                      {/* Named separately because it is the one reason with a
                          two-second fix: the check-off happened, the date has
                          not been entered, or was entered as today. */}
                      {p.uncleared > 0 &&
                        ` (${p.uncleared} before the student's check-off for this skill)`}
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

      {/* The log, grouped.
          One row per performance is deliberate in the data — a row claiming
          "12" is one assertion standing in for twelve procedures — but
          RENDERING one card per row meant twenty-five near-identical blocks
          sharing a date, a site and a preceptor, and two thousand pixels of
          scrolling to read seven facts. Grouped by shift and requirement, the
          repetition collapses and the references are one tap away. */}
      <div className="section-title">
        Log · {mine.length} {mine.length === 1 ? 'entry' : 'entries'}
      </div>
      {mine.length === 0 ? (
        <div className="banner info">Nothing logged for {student.name} yet.</div>
      ) : (
        <div className="list">
          {groupEncounters(mine).map((g) => {
            const req = CLINICAL_REQUIREMENTS.find((r) => r.id === g.requirementId)
            const label = req?.label ?? g.requirementId
            const open = expanded.has(g.key)
            const reps = g.entries.reduce((n, e) => n + e.count, 0)
            const infusions = g.entries.filter((e) => e.initiatedInfusion).length
            const attempts = g.entries.filter((e) => e.outcome === 'attempt').length
            const voided = g.entries.filter((e) => e.voidedAt).length
            const unstated = g.entries.filter((e) => !e.outcome && !e.voidedAt).length
            return (
              <div key={g.key} className="enc-group">
                <button
                  className="enc-head"
                  aria-expanded={open}
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev)
                      next.has(g.key) ? next.delete(g.key) : next.add(g.key)
                      return next
                    })
                  }
                >
                  <span className="op-caret" aria-hidden="true">
                    {open ? '▾' : '▸'}
                  </span>
                  <span className="grow">
                    <span className="title">
                      {label} <span className="enc-count">×{reps}</span>
                    </span>
                    <span className="meta">
                      {formatDate(g.date)} · {SITE_LABEL[g.siteKind]}
                      {g.site && ` · ${g.site}`}
                      {g.preceptor && ` · ${g.preceptor}`}
                    </span>
                  </span>
                  {infusions > 0 && <span className="pill info">{infusions} infusion</span>}
                  {unstated > 0 && <span className="pill warn">{unstated} outcome not stated</span>}
                  {attempts > 0 && <span className="pill warn">{attempts} attempt</span>}
                  {voided > 0 && <span className="pill crit">{voided} voided</span>}
                </button>
                {open && (
                  <div className="enc-rows">
                    {g.entries.map((e) => (
                      <div key={e.id} className="enc-row" style={e.voidedAt ? { opacity: 0.6 } : undefined}>
                        <span className="grow">
                          {e.sourceRef ? `ref ${e.sourceRef}` : 'no reference'}
                          {e.count > 1 && (
                            <span className="pill warn" style={{ marginLeft: 8 }}>
                              ×{e.count} unitemized
                            </span>
                          )}
                          {e.initiatedInfusion && (
                            <span className="pill info" style={{ marginLeft: 8 }}>
                              infusion
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
                          {e.voidedAt && (
                            <span className="meta" style={{ color: 'var(--crit)' }}>
                              Voided by {e.voidedBy} — {e.voidReason}
                            </span>
                          )}
                        </span>
                        {canEdit && !e.voidedAt && (
                          <button
                            className="btn sm"
                            aria-label={`Void this ${label} entry`}
                            disabled={!safety.canRecordOfficial}
                            title={safety.reason}
                            onClick={() => setVoiding(e)}
                          >
                            Void
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {logging && (
        <LogForm
          course={course}
          student={student}
          shifts={shifts}
          existing={mine}
          onClose={() => setLogging(false)}
        />
      )}

      {voiding && (
        <ReasonModal
          title="Void this entry?"
          body="It stops counting toward the minimum but stays on the record with your reason, so the correction is traceable. Deleting a regulated count outright is not an option."
          placeholder="Logged against the wrong requirement; duplicate of run 24-01188"
          confirmLabel="Void entry"
          actor={safety.actor}
          onConfirm={(reason) => voidEncounter(voiding.id, safety.actor, reason)}
          onClose={() => setVoiding(null)}
        />
      )}
    </div>
  )
}
