import { useState } from 'react'
import { Empty, ProgressBar } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/date'
import {
  useStudents,
  useSkillChecks,
  standingFor,
  setSkillResult,
  passAllCriteria,
  toggleCriticalFailure,
  setSkillSignoff,
} from './aemtStore'
import { sheetsForAemt, skillSheet } from '../../data/aemtSkills'
import { useCan } from '../../lib/role'
import type { AemtCourse } from '../../types'

const SHEETS = sheetsForAemt()

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
  const { editRideWork: canEdit } = useCan()
  const sheet = skillSheet(sheetId)
  if (!sheet) return null

  const standing = standingFor(checks, studentId, [sheet])[0]
  const results = standing.check?.results ?? {}
  const criticalFailed = standing.check?.criticalFailed ?? []
  const allIds = sheet.sections.flatMap((s) => s.criteria.map((c) => c.id))

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

      {standing.criticalFailed && (
        <div className="banner crit" style={{ marginTop: 10 }}>
          <strong>Critical failure recorded.</strong> This sheet fails regardless of the individual
          criteria below.
        </div>
      )}

      {canEdit && (
        <div className="toolbar" style={{ marginTop: 10 }}>
          <button
            className="btn sm"
            onClick={() => passAllCriteria(course.id, studentId, sheet.id, allIds)}
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
                      disabled={!canEdit}
                      onClick={() =>
                        setSkillResult(course.id, studentId, sheet.id, c.id, r === 'pass' ? null : 'pass')
                      }
                    >
                      ✓
                    </button>
                    <button
                      className={`choice${r === 'fail' ? ' active' : ''}`}
                      style={{ padding: '6px 12px', fontSize: 13 }}
                      disabled={!canEdit}
                      onClick={() =>
                        setSkillResult(course.id, studentId, sheet.id, c.id, r === 'fail' ? null : 'fail')
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
                  disabled={!canEdit}
                  onClick={() => toggleCriticalFailure(course.id, studentId, sheet.id, text)}
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
            <input
              id="sk-eval"
              value={standing.check?.evaluator ?? ''}
              onChange={(e) =>
                setSkillSignoff(course.id, studentId, sheet.id, { evaluator: e.target.value })
              }
            />
          </div>
          {standing.signedOff ? (
            <div className="banner ok">
              ✓ Signed off {formatDate(standing.check?.passedDate)}
              <button
                className="link-btn"
                style={{ marginLeft: 10 }}
                onClick={() =>
                  setSkillSignoff(course.id, studentId, sheet.id, { passedDate: null })
                }
              >
                Undo
              </button>
            </div>
          ) : (
            <button
              className="btn primary"
              disabled={!standing.allPassed}
              title={
                standing.allPassed
                  ? 'Record this skill as passed'
                  : 'Every criterion must pass, with no critical failure, before sign-off'
              }
              onClick={() =>
                setSkillSignoff(course.id, studentId, sheet.id, { passedDate: todayISO() })
              }
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
        </div>
      )}
    </div>
  )
}

export default function SkillsTab({ course }: { course: AemtCourse }) {
  const students = useStudents(course.id)
  const checks = useSkillChecks(course.id)
  const [selectedId, setSelected] = useState<string | null>(null)
  const [openSheet, setOpenSheet] = useState<string | null>(null)

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
        Psychomotor check-offs at AEMT scope. Paramedic-only sheets from the packet — intubation,
        ventilator, NG tube, needle decompression — are not shown.
      </div>

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

      <div className="toolbar">
        <span className="subtle">
          {done} of {SHEETS.length} sheets signed off
        </span>
      </div>
      <ProgressBar pct={Math.round((done / SHEETS.length) * 100)} complete={done === SHEETS.length} />

      <div className="list" style={{ marginTop: 12 }}>
        {standing.map((s) => (
          <button
            key={s.sheet.id}
            className="row"
            style={{ width: '100%', textAlign: 'left', border: 'none', font: 'inherit' }}
            onClick={() => setOpenSheet(s.sheet.id)}
          >
            <div className="grow">
              <div className="title">{s.sheet.title}</div>
              <div className="meta">
                {s.passed}/{s.total} criteria
                {s.failed > 0 && ` · ${s.failed} needing practice`}
                {s.sheet.levels.length < 3 && ` · ${s.sheet.levelLabel}`}
              </div>
            </div>
            {s.signedOff ? (
              <span className="pill ok">✓ Passed</span>
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
