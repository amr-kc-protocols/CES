import { useState } from 'react'
import { Empty, Modal, ProgressBar } from '../../components/ui'
import { confirmAction } from '../../lib/dialog'
import SavedIndicator from '../../components/SavedIndicator'
import {
  useCandidates,
  addCandidate,
  updateCandidate,
  deleteCandidate,
  recordInterview,
  scoreCandidate,
  interviewDisagreements,
  useRecordSafety,
} from './aemtStore'
import {
  SELECTION_WEIGHTS,
  BONUS_TIERS,
  THRESHOLDS,
  TEST_SECTIONS,
  INTERVIEW_QUESTIONS,
  INTERVIEW_MAX,
  ELIGIBILITY_GATES,
  PROHIBITED_TOPICS,
} from '../../data/aemtSelection'
import { useCan } from '../../lib/role'
import type { AemtCandidate, AemtCourse } from '../../types'

// ---------------------------------------------------------------------------
// Cohort selection.
//
// Retention is handled by the service commitment agreement signed at
// acceptance, not here. This screen measures one thing: who is most likely to
// complete the course and pass the certification examination.
//
// The written instruments are docs/aemt-selection-test.md and
// docs/aemt-selection-interview.md. The weights, thresholds and anchors live in
// data/aemtSelection.ts so changing one is a reviewable edit, not a hunt.
// ---------------------------------------------------------------------------

function ScoreModal({ candidate, onClose }: { candidate: AemtCandidate; onClose: () => void }) {
  const [marks, setMarks] = useState<Record<string, string>>(
    Object.fromEntries(TEST_SECTIONS.map((s) => [s.id, String(candidate.testMarks?.[s.id] ?? '')])),
  )
  const [qa, setQa] = useState(String(candidate.qaPercent ?? ''))
  const [att, setAtt] = useState(String(candidate.attendancePercent ?? ''))
  const [tier, setTier] = useState(candidate.bonusTier ?? 'none')
  const [gates, setGates] = useState<Record<string, boolean>>(candidate.gates ?? {})

  const num = (v: string) => {
    const n = Number(v)
    return v.trim() !== '' && Number.isFinite(n) ? n : undefined
  }

  return (
    <Modal title={`Scores — ${candidate.name}`} onClose={onClose}>
      <div className="section-title" style={{ marginTop: 0 }}>
        Eligibility gates
      </div>
      <div className="help-text" style={{ marginTop: 0 }}>
        Pass/fail. A candidate failing any of these is not scored.
      </div>
      {ELIGIBILITY_GATES.map((g) => (
        <label
          key={g.id}
          className="subtle"
          style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8 }}
        >
          <input
            type="checkbox"
            checked={gates[g.id] === true}
            onChange={(e) => setGates({ ...gates, [g.id]: e.target.checked })}
            style={{ marginTop: 2 }}
          />
          <span>
            {g.label}
            {g.note && <div className="help-text" style={{ marginTop: 2 }}>{g.note}</div>}
          </span>
        </label>
      ))}

      <div className="section-title">Selection test</div>
      {TEST_SECTIONS.map((s) => (
        <div className="field" key={s.id}>
          <label htmlFor={`sc-${s.id}`}>
            {s.label} <span className="subtle">/ {s.marks}</span>
            {s.floor ? <span className="pill warn" style={{ marginLeft: 8, fontSize: 10 }}>{s.floor}% floor</span> : null}
          </label>
          <input
            id={`sc-${s.id}`}
            type="number"
            min={0}
            max={s.marks}
            value={marks[s.id]}
            onChange={(e) => setMarks({ ...marks, [s.id]: e.target.value })}
          />
          {s.floorNote && <div className="help-text">{s.floorNote}</div>}
        </div>
      ))}

      <div className="section-title">Record-based components</div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="sc-qa">QA chart review %</label>
          <input id="sc-qa" type="number" min={0} max={100} value={qa} onChange={(e) => setQa(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sc-att">Attendance %</label>
          <input id="sc-att" type="number" min={0} max={100} value={att} onChange={(e) => setAtt(e.target.value)} />
        </div>
      </div>
      <div className="help-text">Trailing 12 months for both.</div>

      <div className="section-title">Additional duty</div>
      <div className="field">
        <label htmlFor="sc-tier">Bonus tier</label>
        <select id="sc-tier" value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}>
          {BONUS_TIERS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label} (+{b.points})
            </option>
          ))}
        </select>
        <div className="help-text">
          Decides a tie and a near-tie. It cannot carry a candidate over the threshold from a weak
          score — FTO service predicts effort, not arithmetic.
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          onClick={() => {
            updateCandidate(candidate.id, {
              gates,
              testMarks: Object.fromEntries(
                TEST_SECTIONS.map((s) => [s.id, num(marks[s.id])]).filter(
                  (e): e is [string, number] => typeof e[1] === 'number',
                ),
              ),
              qaPercent: num(qa),
              attendancePercent: num(att),
              bonusTier: tier,
            })
            onClose()
          }}
        >
          Save scores
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

function InterviewModal({
  candidate,
  actor,
  onClose,
}: {
  candidate: AemtCandidate
  actor: string
  onClose: () => void
}) {
  const mine = (candidate.interviews ?? []).find((i) => i.scorer === actor)
  const [scores, setScores] = useState<Record<string, number>>(mine?.scores ?? {})
  const [notes, setNotes] = useState<Record<string, string>>(mine?.notes ?? {})
  const total = Object.values(scores).reduce((n, v) => n + v, 0)
  const complete = INTERVIEW_QUESTIONS.every((q) => typeof scores[q.id] === 'number')

  return (
    <Modal title={`Interview — ${candidate.name}`} onClose={onClose}>
      <div className="banner info" style={{ marginTop: 0 }}>
        Scoring as <strong>{actor}</strong>. Two interviewers score independently and confer
        afterwards — this saves your scores only.
      </div>

      {INTERVIEW_QUESTIONS.map((q) => (
        <div key={q.id} className="card" style={{ padding: 12, marginTop: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{q.label}</div>
          <div style={{ margin: '6px 0', lineHeight: 1.5 }}>“{q.question}”</div>
          <div className="help-text" style={{ marginTop: 0 }}>
            <em>{q.predicts}</em>
          </div>
          <div className="help-text">Probes: {q.probes.join(' · ')}</div>

          {q.guardRail && (
            <div className="banner crit" style={{ marginTop: 8 }}>
              <strong>Guard rail.</strong> {q.guardRail}
            </div>
          )}

          <div className="segmented" style={{ marginTop: 8, width: '100%' }} role="radiogroup" aria-label={q.label}>
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={scores[q.id] === v}
                className={scores[q.id] === v ? 'active' : ''}
                style={{ flex: 1 }}
                onClick={() => setScores({ ...scores, [q.id]: v })}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="help-text">
            <strong>1</strong> {q.anchors[1]}
            <br />
            <strong>3</strong> {q.anchors[3]}
            <br />
            <strong>5</strong> {q.anchors[5]}
          </div>

          <div className="field" style={{ marginTop: 6 }}>
            <label htmlFor={`nt-${q.id}`}>What they said</label>
            <textarea
              id={`nt-${q.id}`}
              value={notes[q.id] ?? ''}
              onChange={(e) => setNotes({ ...notes, [q.id]: e.target.value })}
              placeholder="Record what was said, not an impression."
            />
          </div>
        </div>
      ))}

      <div className="banner warn" style={{ marginTop: 12 }}>
        <strong>Never ask about:</strong> {PROHIBITED_TOPICS.join(' · ')}. If a candidate
        volunteers any of it, do not record it and do not follow it up.
      </div>

      <div className="toolbar" style={{ marginTop: 10 }}>
        <span className="subtle">
          Total {total} / {INTERVIEW_MAX} · threshold {THRESHOLDS.interview}
        </span>
        <div className="spacer" />
      </div>
      <div className="btn-row">
        <button
          className="btn primary"
          disabled={!complete}
          title={complete ? 'Save your scores' : 'Score every question first'}
          onClick={() => {
            recordInterview(candidate.id, actor, scores, notes)
            onClose()
          }}
        >
          Save my scores
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

export default function SelectionTab({ course }: { course: AemtCourse }) {
  const candidates = useCandidates(course.id)
  const { manageAcademy: canEdit } = useCan()
  const safety = useRecordSafety()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [empNo, setEmpNo] = useState('')
  const [scoring, setScoring] = useState<AemtCandidate | null>(null)
  const [interviewing, setInterviewing] = useState<AemtCandidate | null>(null)

  // Clearing candidates first, then by score. A blocked candidate with a high
  // raw composite heading the list reads as the strongest applicant, which is
  // the opposite of what it means.
  const scored = candidates
    .map((c) => ({ candidate: c, score: scoreCandidate(c) }))
    .sort((a, b) => {
      const aClear = a.score.complete && a.score.blockers.length === 0
      const bClear = b.score.complete && b.score.blockers.length === 0
      if (aClear !== bClear) return aClear ? -1 : 1
      return b.score.composite - a.score.composite
    })
  const clearing = scored.filter((s) => s.score.complete && s.score.blockers.length === 0)

  return (
    <div>
      <div className="banner info">
        Retention is handled by the <strong>service commitment agreement</strong> signed at
        acceptance, not by selection. This screen measures one thing: who is most likely to
        complete the course and pass the certification examination.
      </div>

      <div className="toolbar" style={{ marginTop: 12 }}>
        <span className="subtle">
          {clearing.length} of {candidates.length} clearing every threshold
        </span>
        <div className="spacer" />
        {canEdit && <SavedIndicator />}
        {canEdit && (
          <button className="btn primary" onClick={() => setAdding(true)}>
            + Candidate
          </button>
        )}
      </div>

      {/* Filling a seat below threshold costs more than leaving it empty, and
          that is far easier to hold to before you know who the names are. */}
      {candidates.length > 0 && clearing.length < 4 && (
        <div className="banner warn">
          <strong>{clearing.length} candidate{clearing.length === 1 ? '' : 's'} clear the bar.</strong>{' '}
          Run the cohort at that size rather than advancing someone below threshold — a
          non-completion costs the program more than an empty seat.
        </div>
      )}

      {candidates.length === 0 ? (
        <Empty icon="🧭" title="No candidates yet">
          {canEdit
            ? 'Add the EMTs who applied for a cohort seat.'
            : 'The Clinical Educator manages selection.'}
        </Empty>
      ) : (
        <div className="list" style={{ marginTop: 12 }}>
          {scored.map(({ candidate: c, score }) => {
            const disagree = interviewDisagreements(c)
            const clear = score.complete && score.blockers.length === 0
            return (
              <div
                key={c.id}
                className={`row left-accent ${clear ? 'acc-ok' : score.complete ? 'acc-crit' : 'acc-warn'}`}
              >
                <div className="grow">
                  <div className="title">
                    {c.name}
                    {c.employeeNumber && <span className="subtle"> · #{c.employeeNumber}</span>}
                    {score.bonus > 0 && (
                      <span className="pill info" style={{ marginLeft: 8 }}>
                        +{score.bonus} additional duty
                      </span>
                    )}
                  </div>
                  <div className="meta">
                    {SELECTION_WEIGHTS.map((w) => {
                      const v = score[w.id]
                      return `${w.label.split(' ')[0]} ${v === undefined ? '—' : `${v.toFixed(0)}%`}`
                    }).join(' · ')}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <ProgressBar
                      pct={Math.min(100, Math.round(score.composite))}
                      complete={clear}
                    />
                  </div>
                  {score.blockers.map((b) => (
                    <div key={b} className="meta" style={{ color: 'var(--crit)' }}>
                      {b}
                    </div>
                  ))}
                  {disagree.length > 0 && (
                    <div className="meta" style={{ color: 'var(--warn)' }}>
                      Interviewers differ by 2 or more on{' '}
                      {disagree
                        .map((d) => INTERVIEW_QUESTIONS.find((q) => q.id === d.questionId)?.label)
                        .join(', ')}{' '}
                      — discuss and re-score rather than averaging.
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>
                    {score.composite.toFixed(1)}
                  </div>
                  <div className="subtle" style={{ fontSize: 11 }}>
                    of {THRESHOLDS.composite} needed
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn sm" onClick={() => setScoring(c)}>
                      Scores
                    </button>
                    <button
                      className="btn sm"
                      disabled={!safety.canRecordOfficial}
                      title={safety.canRecordOfficial ? 'Score the interview' : safety.reason}
                      onClick={() => setInterviewing(c)}
                    >
                      Interview
                    </button>
                    <button
                      className="btn sm danger"
                      aria-label={`Remove ${c.name}`}
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: `Remove ${c.name}?`,
                          body: 'Their scores and interview notes go with them. Undo is offered for a few seconds afterwards.',
                          confirmLabel: 'Remove candidate',
                        })
                        if (ok) deleteCandidate(c.id)
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="banner warn" style={{ marginTop: 12 }}>
        <strong>These are not program records.</strong> Selection data is retained under the
        employer's HR schedule, not the three-year K.A.R. 109-17-3 clock, and it does not appear in
        the course audit package. Keep the scoring for every candidate, selected or not — that is
        what demonstrates the procedure was applied consistently.
      </div>

      {adding && (
        <Modal title="Add candidate" onClose={() => setAdding(false)}>
          <div className="field">
            <label htmlFor="cand-name">Name</label>
            <input id="cand-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cand-emp">Employee number</label>
            <input id="cand-emp" value={empNo} onChange={(e) => setEmpNo(e.target.value)} />
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              className="btn primary"
              disabled={name.trim() === ''}
              onClick={() => {
                addCandidate(course.id, name.trim(), empNo.trim() || undefined)
                setName('')
                setEmpNo('')
                setAdding(false)
              }}
            >
              Add
            </button>
            <button className="btn" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {scoring && <ScoreModal candidate={scoring} onClose={() => setScoring(null)} />}
      {interviewing && (
        <InterviewModal
          candidate={interviewing}
          actor={safety.actor}
          onClose={() => setInterviewing(null)}
        />
      )}
    </div>
  )
}
