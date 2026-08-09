import { useState } from 'react'
import { Empty, Modal, ProgressBar } from '../../components/ui'
import DebouncedInput from '../../components/DebouncedInput'
import { confirmAction } from '../../lib/dialog'
import { formatDate } from '../../lib/date'
import ReasonModal from './ReasonModal'
import {
  useStudents,
  useSkillChecks,
  standingFor,
  setSkillResult,
  passAllCriteria,
  toggleCriticalFailure,
  setSkillEvaluator,
  signSkillSheet,
  revokeSkillSignoff,
  recordedFailures,
  useRecordSafety,
  SKILL_STATEMENT,
} from './aemtStore'
import { sheetsForCourse, sheetsByScope, skillSheet } from '../../data/aemtSkills'
import { PRECEPTOR_LABELS } from '../../data/aemt'
import type { PreceptorCredential } from '../../data/aemt'
import { useCan } from '../../lib/role'
import type { AemtCourse, PreceptorCredentialId } from '../../types'

/** Evaluator signature for a skill sheet — same bar as a shift attestation. */
function SignModal({
  sheetTitle,
  defaultName,
  actor,
  onSign,
  onClose,
}: {
  sheetTitle: string
  defaultName: string
  actor: string
  onSign: (a: { by: string; credential: PreceptorCredentialId; certNumber: string }) => void
  onClose: () => void
}) {
  const [by, setBy] = useState(defaultName)
  const [cred, setCred] = useState<PreceptorCredentialId>('paramedic')
  const [certNumber, setCert] = useState('')
  const [agreed, setAgreed] = useState(false)
  const valid = by.trim() !== '' && certNumber.trim() !== '' && agreed

  return (
    <Modal title={`Sign off — ${sheetTitle}`} onClose={onClose}>
      <div className="field">
        <label htmlFor="sg-by">Evaluator</label>
        <input id="sg-by" value={by} onChange={(e) => setBy(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="sg-cred">Credential</label>
          <select
            id="sg-cred"
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
          <label htmlFor="sg-cert">Licence / cert # (required)</label>
          <input id="sg-cert" value={certNumber} onChange={(e) => setCert(e.target.value)} />
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
        <span>{SKILL_STATEMENT}</span>
      </label>
      <div className="help-text">
        Signed as <strong>{actor}</strong> and written to the audit trail.
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!valid}
          onClick={() => {
            onSign({ by: by.trim(), credential: cred, certNumber: certNumber.trim() })
            onClose()
          }}
        >
          Sign off
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

const BLS_SHEETS = sheetsByScope('bls')
const MEDIC_SHEETS = sheetsByScope('paramedic')

function SheetDetail({
  course,
  studentId,
  sheetId,
  onBack,
}: {
  course: AemtCourse
  studentId: string
  sheetId: string
  onBack: () => void
}) {
  const checks = useSkillChecks(course.id)
  // manageAemt, not editRideWork: the latter is true for FTOs, who must not
  // write to certification records.
  const { manageAemt: canEdit } = useCan()
  const safety = useRecordSafety()
  const [signing, setSigning] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const sheet = skillSheet(sheetId)
  if (!sheet) return null

  const standing = standingFor(checks, studentId, [sheet])[0]
  const results = standing.check?.results ?? {}
  const criticalFailed = standing.check?.criticalFailed ?? []
  const allIds = sheet.sections.flatMap((s) => s.criteria.map((c) => c.id))
  // A signed sheet is locked. The evaluator attested to these exact criteria,
  // so re-grading them behind the signature would leave it describing a record
  // that no longer exists. The store invalidates the signature if it happens
  // anyway; this makes the order of operations obvious instead of surprising.
  const locked = !!standing.check?.passedDate
  const canGrade = canEdit && !locked

  return (
    <div>
      <button className="link-btn" onClick={onBack}>
        ← All skills
      </button>

      <div className="page-head" style={{ marginTop: 4 }}>
        <div>
          <h2 style={{ fontSize: 18 }}>{sheet.title}</h2>
          <div className="subtle" style={{ fontSize: 12 }}>
            {sheet.levelLabel} · {standing.passed}/{standing.total} passed
            {standing.failed > 0 && ` · ${standing.failed} needing practice`}
          </div>
        </div>
      </div>

      {sheet.draft && (
        <div className="banner warn" style={{ marginTop: 10 }}>
          <strong>Draft sheet.</strong> No sheet for this skill existed in the AMR workbook, so its
          criteria were written here. Have the Program Manager and Medical Director review it before
          it is used as a competency record.
        </div>
      )}

      {standing.criticalFailed && (
        <div className="banner crit" style={{ marginTop: 10 }}>
          <strong>Critical failure recorded.</strong> This sheet fails regardless of the individual
          criteria below.
        </div>
      )}

      {standing.contradicted && (
        <div className="banner crit" style={{ marginTop: 10 }}>
          <strong>This sign-off is contradicted by the results recorded on it.</strong> It does not
          count toward completion. Revoke it, finish grading, and sign it again.
        </div>
      )}

      {locked && !standing.contradicted && (
        <div className="banner info" style={{ marginTop: 10 }}>
          <strong>Signed and locked.</strong> The criteria below are what{' '}
          {standing.check?.attestation?.by ?? 'the evaluator'} attested to. Revoke the sign-off below
          to change any of them.
        </div>
      )}

      {canGrade && (
        <div className="toolbar" style={{ marginTop: 10 }}>
          <button
            className="btn sm"
            onClick={async () => {
              // "Pass all" replaces every result. On a part-graded sheet that
              // discards the record of what the student could not do, which is
              // what a remediation plan is built from.
              const failures = recordedFailures(standing.check)
              if (failures > 0) {
                const ok = await confirmAction({
                  title: 'Overwrite the recorded failures?',
                  body:
                    `${failures} criteri${failures === 1 ? 'on is' : 'a are'} recorded as needing ` +
                    'practice on this sheet. Passing everything erases that, and it is what a ' +
                    'remediation plan would have been built from.',
                  confirmLabel: 'Pass all anyway',
                })
                if (!ok) return
              }
              passAllCriteria(course.id, studentId, sheet.id, allIds, safety.actor)
            }}
          >
            ✓ Pass all
          </button>
          <div className="spacer" />
          <span className="subtle" style={{ fontSize: 12 }}>
            {standing.total} criteria
          </span>
        </div>
      )}

      {sheet.sections.map((section, si) => (
        <div key={si} style={{ marginTop: 14 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            {section.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {section.criteria.map((c) => {
              const r = results[c.id]
              return (
                <div
                  key={c.id}
                  style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}
                >
                  <span style={{ flex: 1, minWidth: 180, fontSize: 14, paddingTop: 8 }}>
                    {c.label}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className={`choice${r === 'pass' ? ' active' : ''}`}
                      style={{ padding: '6px 12px', fontSize: 13 }}
                      disabled={!canGrade}
                      title={locked ? 'Signed — revoke the sign-off to re-grade' : undefined}
                      onClick={() =>
                        setSkillResult(
                          course.id, studentId, sheet.id, c.id,
                          r === 'pass' ? null : 'pass', safety.actor,
                        )
                      }
                    >
                      ✓
                    </button>
                    <button
                      className={`choice${r === 'fail' ? ' active' : ''}`}
                      style={{ padding: '6px 12px', fontSize: 13 }}
                      disabled={!canGrade}
                      title={locked ? 'Signed — revoke the sign-off to re-grade' : undefined}
                      onClick={() =>
                        setSkillResult(
                          course.id, studentId, sheet.id, c.id,
                          r === 'fail' ? null : 'fail', safety.actor,
                        )
                      }
                    >
                      ↻
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {sheet.criticalFailures.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            Critical failure criteria
          </div>
          <div className="help-text" style={{ marginTop: 0, marginBottom: 8 }}>
            Any one of these fails the skill outright, whatever the criteria above show.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sheet.criticalFailures.map((text) => {
              const on = criticalFailed.includes(text)
              return (
                <button
                  key={text}
                  className={`choice${on ? ' active' : ''}`}
                  style={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    padding: '10px 12px',
                    fontSize: 13,
                    fontWeight: 500,
                    ...(on ? { borderColor: 'var(--crit)', background: 'var(--crit-bg)' } : {}),
                  }}
                  disabled={!canGrade}
                  title={locked ? 'Signed — revoke the sign-off to re-grade' : undefined}
                  onClick={() =>
                    toggleCriticalFailure(course.id, studentId, sheet.id, text, safety.actor)
                  }
                >
                  {on ? '✗ ' : '☐ '}
                  {text}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="card" style={{ marginTop: 16, padding: 12 }}>
          <div className="field">
            <label htmlFor="sk-eval">Evaluator</label>
            <DebouncedInput
              id="sk-eval"
              value={standing.check?.evaluator ?? ''}
              disabled={locked}
              title={locked ? 'Signed — the signer of record is shown below' : undefined}
              onCommit={(v) => setSkillEvaluator(course.id, studentId, sheet.id, v)}
            />
          </div>
          {standing.signedOff ? (
            <div className="banner ok">
              ✓ Signed {formatDate(standing.check?.passedDate)} by{' '}
              {standing.check?.attestation?.by} (
              {PRECEPTOR_LABELS[standing.check!.attestation!.credential as PreceptorCredential]}
              {standing.check?.attestation?.certNumber
                ? ` #${standing.check.attestation.certNumber}`
                : ''}
              )
              <button className="link-btn" style={{ marginLeft: 10 }} onClick={() => setRevoking(true)}>
                Revoke
              </button>
            </div>
          ) : standing.contradicted ? (
            <div className="banner crit">
              This sheet carries a sign-off its recorded results do not support, so it does not count
              toward completion.
              <button className="link-btn" style={{ marginLeft: 10 }} onClick={() => setRevoking(true)}>
                Revoke
              </button>
            </div>
          ) : standing.check?.passedDate ? (
            <div className="banner crit">
              Signed off with no evaluator recorded — this does not count toward completion. Sign
              it again with a name and licence number.
              <button className="link-btn" style={{ marginLeft: 10 }} onClick={() => setRevoking(true)}>
                Clear it
              </button>
            </div>
          ) : (
            <button
              className="btn primary"
              disabled={!standing.allPassed || !safety.canRecordOfficial}
              title={
                !safety.canRecordOfficial
                  ? safety.reason
                  : standing.allPassed
                    ? 'Record this skill as passed'
                    : 'Every criterion must pass, with no critical failure, before sign-off'
              }
              onClick={() => setSigning(true)}
            >
              Sign off as passed
            </button>
          )}
          {!standing.allPassed && !standing.signedOff && (
            <div className="help-text">
              {standing.criticalFailed
                ? 'A critical failure is recorded — clear it before signing off.'
                : `${standing.total - standing.passed} criteria still to pass.`}
            </div>
          )}
          {!safety.canRecordOfficial && (
            <div className="help-text" style={{ color: 'var(--warn)' }}>
              {safety.reason} Sign-off is unavailable until then.
            </div>
          )}
        </div>
      )}

      {signing && (
        <SignModal
          sheetTitle={sheet.title}
          defaultName={standing.check?.evaluator ?? ''}
          actor={safety.actor}
          onSign={(a) => signSkillSheet(course.id, studentId, sheet.id, { ...a, actor: safety.actor })}
          onClose={() => setSigning(false)}
        />
      )}

      {revoking && (
        <ReasonModal
          title={`Revoke the sign-off — ${sheet.title}`}
          body="The sheet returns to unsigned, stops counting toward the K.A.R. 109-11-8(a)(2) skills requirement, and becomes editable again."
          placeholder="Re-assessed after remediation; original sign-off recorded against the wrong sheet"
          confirmLabel="Revoke sign-off"
          actor={safety.actor}
          onConfirm={(reason) =>
            revokeSkillSignoff(course.id, studentId, sheet.id, safety.actor, reason)
          }
          onClose={() => setRevoking(false)}
        />
      )}
    </div>
  )
}

export default function SkillsTab({ course }: { course: AemtCourse }) {
  const students = useStudents(course.id)
  const checks = useSkillChecks(course.id)
  const [selectedId, setSelected] = useState<string | null>(null)
  const [openSheet, setOpenSheet] = useState<string | null>(null)
  const [showExcluded, setShowExcluded] = useState(false)
  const SHEETS = sheetsForCourse(course.monitorSheetId)

  if (students.length === 0) {
    return (
      <Empty icon="🧑‍🚒" title="No students yet">
        Add students on the Roster tab to record skill check-offs.
      </Empty>
    )
  }

  const studentId = selectedId ?? students[0].id
  const student = students.find((s) => s.id === studentId) ?? students[0]

  if (openSheet) {
    return (
      <SheetDetail
        course={course}
        studentId={student.id}
        sheetId={openSheet}
        onBack={() => setOpenSheet(null)}
      />
    )
  }

  const standing = standingFor(checks, student.id, SHEETS)
  const done = standing.filter((s) => s.signedOff).length

  return (
    <div>
      <div className="banner info">
        The <strong>{SHEETS.length} advanced skills</strong> the AEMT credential adds. The packet's
        EMT-level sheets are left out — the student already holds those — as is anything above AEMT
        scope.{' '}
        <button className="link-btn" style={{ minHeight: 0 }} onClick={() => setShowExcluded(!showExcluded)}>
          {showExcluded ? 'Hide' : 'What was excluded?'}
        </button>
      </div>

      {showExcluded && (
        <div className="card" style={{ padding: 12, marginTop: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            EMT-level — student arrives proficient ({BLS_SHEETS.length})
          </div>
          <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
            {BLS_SHEETS.map((s) => s.title).join(' · ')}
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, marginTop: 10 }}>
            Above AEMT scope ({MEDIC_SHEETS.length})
          </div>
          <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
            {MEDIC_SHEETS.map((s) => s.title).join(' · ')}
          </div>
          <div className="help-text">
            Scope is set per sheet in <code>data/aemtSkills.ts</code>; any one can be moved without
            touching the others.
          </div>
        </div>
      )}

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="sk-student">Student</label>
        <select id="sk-student" value={student.id} onChange={(e) => setSelected(e.target.value)}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {!course.monitorSheetId && (
        <div className="banner warn" style={{ marginTop: 10 }}>
          <strong>No cardiac monitor selected for this course.</strong> Students are checked off on
          their own monitor only, so with none chosen the monitor sheet is absent from the list below
          and no student is required to complete it. Set it in <strong>Course setup</strong>.
        </div>
      )}

      <div className="toolbar">
        <span className="subtle">
          {done} of {SHEETS.length} sheets signed off
        </span>
      </div>
      <ProgressBar
        pct={SHEETS.length === 0 ? 0 : Math.round((done / SHEETS.length) * 100)}
        complete={SHEETS.length > 0 && done === SHEETS.length}
      />

      <div className="list" style={{ marginTop: 12 }}>
        {standing.map((s) => (
          <button
            key={s.sheet.id}
            className="row"
            style={{ width: '100%', textAlign: 'left', border: 'none', font: 'inherit' }}
            onClick={() => setOpenSheet(s.sheet.id)}
          >
            <div className="grow">
              <div className="title">
                {s.sheet.title}
                {s.sheet.draft && (
                  <span className="pill warn" style={{ marginLeft: 8 }}>
                    draft
                  </span>
                )}
              </div>
              <div className="meta">
                {s.passed}/{s.total} criteria
                {s.failed > 0 && ` · ${s.failed} needing practice`}
                {s.sheet.levels.length < 3 && ` · ${s.sheet.levelLabel}`}
              </div>
            </div>
            {s.signedOff ? (
              <span className="pill ok">✓ Passed</span>
            ) : s.contradicted ? (
              <span className="pill crit">Sign-off contradicted</span>
            ) : s.criticalFailed ? (
              <span className="pill crit">Critical fail</span>
            ) : s.passed > 0 ? (
              <span className="pill info">In progress</span>
            ) : (
              <span className="pill muted">Not started</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
