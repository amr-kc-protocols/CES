import { useEffect, useState } from 'react'
import { Empty, Modal, ProgressBar } from '../../components/ui'
import { confirmAction, notifyUser } from '../../lib/dialog'
import SavedIndicator from '../../components/SavedIndicator'
import {
  useCandidates,
  addCandidate,
  updateCandidate,
  deleteCandidate,
  pullExamResults,
  listExamSittings,
  addCandidatesFromExam,
  type ExamSitting,
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
import { printDoc, downloadDoc, safeFilename } from '../academy/docGen'
import {
  candidateRecordBody,
  candidateRecordTitle,
  cohortRecordBody,
  cohortRecordTitle,
  recordFingerprint,
} from './selectionRecord'
import {
  parseTranscript,
  listSpeakers,
  guessCandidate,
  segmentAnswers,
  suggestScore,
  docxToText,
  type Suggestion,
} from '../../lib/interviewTranscript'
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
  const [email, setEmail] = useState(candidate.email ?? '')

  // Clamped on save. The min/max attributes on a number input constrain the
  // spinner, not what a person can type or paste — and an unclamped 500% QA
  // score flows straight into the weighted composite and puts a candidate at
  // the top of a list four seats are filled from.
  const num = (v: string, max: number) => {
    const n = Number(v)
    if (v.trim() === '' || !Number.isFinite(n)) return undefined
    return Math.min(max, Math.max(0, n))
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
      <div className="field">
        <label htmlFor="sc-email">Exam email</label>
        <input
          id="sc-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="the address they sat the exam under"
        />
      </div>
      {typeof candidate.examPercent === 'number' ? (
        <div className="banner ok" style={{ marginTop: 8 }}>
          <strong>Selection exam: {candidate.examPercent.toFixed(0)}%</strong>
          {candidate.examPulledAt ? ` · pulled ${candidate.examPulledAt}` : ''}
          <div className="help-text" style={{ marginTop: 2 }}>
            This is the 40% test component. It comes from the exam they sat — it is not entered
            here.
          </div>
        </div>
      ) : (
        <div className="banner warn" style={{ marginTop: 8 }}>
          No selection-exam result attached.
          <div className="help-text" style={{ marginTop: 2 }}>
            Set the exam email above, then use <strong>Pull exam results</strong>. Until then the
            test component falls back to any supplementary marks entered below.
          </div>
        </div>
      )}

      <div className="section-title">Supplementary sections</div>
      <div className="help-text" style={{ marginTop: 0 }}>
        Optional. The online exam does not produce these — enter marks only for a section you
        actually administered on paper. A floor is checked only against a section that was
        scored, so leaving these blank blocks nobody.
      </div>
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
              email: email.trim().toLowerCase() || undefined,
              testMarks: Object.fromEntries(
                TEST_SECTIONS.map((s) => [s.id, num(marks[s.id], s.marks)]).filter(
                  (e): e is [string, number] => typeof e[1] === 'number',
                ),
              ),
              qaPercent: num(qa, 100),
              attendancePercent: num(att, 100),
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
  // On a device with no cloud sync the actor is the literal 'local' for
  // everybody, so two interviewers scoring on one tablet both wrote as 'local'
  // and the second silently replaced the first — defeating independent scoring
  // and zeroing out the disagreement check, which needs two entries to fire.
  const anonymous = actor === 'local'
  const [scorer, setScorer] = useState(anonymous ? '' : actor)
  const identity = anonymous ? scorer.trim() : actor
  const mine = (candidate.interviews ?? []).find((i) => i.scorer === identity)
  const [scores, setScores] = useState<Record<string, number>>(mine?.scores ?? {})
  const [notes, setNotes] = useState<Record<string, string>>(mine?.notes ?? {})
  const total = Object.values(scores).reduce((n, v) => n + v, 0)

  // ----- transcript assist (optional) -------------------------------------
  // A Teams transcript can pre-fill the answers and suggest a 1-5 per question.
  // It is a convenience: the interviewer confirms every answer and score. See
  // lib/interviewTranscript.ts.
  const [showTx, setShowTx] = useState(false)
  const [tx, setTx] = useState('')
  const [candidateSpeaker, setCandidateSpeaker] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({})
  const turns = tx.trim() ? parseTranscript(tx) : []
  const speakerList = listSpeakers(turns)
  const chosenSpeaker = candidateSpeaker || guessCandidate(turns)

  async function onPickFile(file: File | undefined) {
    if (!file) return
    setTxError(null)
    try {
      const text = await docxToText(await file.arrayBuffer())
      setTx(text)
    } catch (e) {
      setTxError((e as Error).message || 'Could not read that file. Try pasting the transcript instead.')
    }
  }

  function applyTranscript() {
    if (!turns.length) return
    const answers = segmentAnswers(turns, chosenSpeaker, INTERVIEW_QUESTIONS)
    const nextNotes = { ...notes }
    const nextScores = { ...scores }
    const nextSug: Record<string, Suggestion> = {}
    for (const q of INTERVIEW_QUESTIONS) {
      const a = answers[q.id]
      if (a) nextNotes[q.id] = a
      const s = suggestScore(q.id, a || '')
      nextSug[q.id] = s
      // Only pre-select where there is an answer to suggest from; an empty
      // answer must not silently drop a 1 onto the form.
      if (a) nextScores[q.id] = s.score
    }
    setNotes(nextNotes)
    setScores(nextScores)
    setSuggestions(nextSug)
  }
  const complete =
    INTERVIEW_QUESTIONS.every((q) => typeof scores[q.id] === 'number') && identity !== ''
  const alreadyScored = (candidate.interviews ?? []).map((i) => i.scorer)

  return (
    <Modal title={`Interview — ${candidate.name}`} onClose={onClose}>
      {anonymous ? (
        <>
          <div className="banner warn" style={{ marginTop: 0 }}>
            <strong>This device is not signed in</strong>, so it cannot tell interviewers apart.
            Enter your name — scores are stored against it, and a second interviewer entering the
            same name would replace yours rather than being counted alongside it.
          </div>
          <div className="field">
            <label htmlFor="iv-scorer">Your name</label>
            <input
              id="iv-scorer"
              value={scorer}
              onChange={(e) => setScorer(e.target.value)}
              placeholder="Interviewer name"
            />
            {identity !== '' && alreadyScored.includes(identity) && (
              <div className="help-text" style={{ color: 'var(--warn)' }}>
                {identity} has already scored this candidate — saving replaces that entry.
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="banner info" style={{ marginTop: 0 }}>
          Scoring as <strong>{actor}</strong>. Two interviewers score independently and confer
          afterwards — this saves your scores only.
        </div>
      )}

      <div className="card" style={{ padding: 12, marginTop: 12, borderLeft: '3px solid var(--info)' }}>
        <button
          className="link-btn"
          onClick={() => setShowTx((v) => !v)}
          aria-expanded={showTx}
          style={{ fontWeight: 700 }}
        >
          {showTx ? '▾' : '▸'} Score from a Teams transcript (optional)
        </button>
        {showTx && (
          <>
            {/* Info, not warn: on a signed-out device this sits directly under
                the amber "not signed in" banner, and two ambers in a row means
                neither is read. */}
            <div className="banner info" style={{ marginTop: 8 }}>
              <strong>An assistant, not the decision.</strong> Suggestions come from keyword signals
              in the words on the page — a starting point, not an assessment. You confirm every
              answer and every score, and you remain the scorer of record.
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="tx-paste">Paste the transcript, or upload the Teams .docx</label>
              <textarea
                id="tx-paste"
                rows={6}
                value={tx}
                onChange={(e) => setTx(e.target.value)}
                placeholder="Paste the Teams meeting transcript here…"
              />
            </div>
            <div className="btn-row">
              <label className="btn" style={{ cursor: 'pointer' }}>
                Upload .docx
                <input
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  hidden
                  onChange={(e) => onPickFile(e.target.files?.[0])}
                />
              </label>
              {tx.trim() && (
                <button className="btn" onClick={() => { setTx(''); setSuggestions({}); setTxError(null) }}>
                  Clear
                </button>
              )}
            </div>
            {txError && (
              <div className="banner crit" style={{ marginTop: 8 }}>
                {txError}
              </div>
            )}
            {turns.length > 0 && (
              <>
                <div className="field" style={{ marginTop: 8 }}>
                  <label htmlFor="tx-speaker">Which speaker is the candidate?</label>
                  <select
                    id="tx-speaker"
                    value={chosenSpeaker}
                    onChange={(e) => setCandidateSpeaker(e.target.value)}
                  >
                    {speakerList.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name} · {s.words} words
                      </option>
                    ))}
                  </select>
                </div>
                <div className="btn-row">
                  <button className="btn primary" onClick={applyTranscript} disabled={!chosenSpeaker}>
                    Fill answers &amp; suggest scores
                  </button>
                </div>
                <div className="help-text">
                  {turns.length} turns · {speakerList.length} speakers detected. Applying fills “What
                  they said” and pre-selects a suggested score under each question — both editable.
                </div>
              </>
            )}
          </>
        )}
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

          {suggestions[q.id] && (
            <div
              className="help-text"
              style={{
                marginTop: 6,
                padding: '6px 8px',
                background: 'var(--muted-bg)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <strong>Suggested {suggestions[q.id].score}/5</strong> · {suggestions[q.id].confidence}{' '}
              confidence — a starting point, not a score.
              <ul style={{ margin: '4px 0 0 16px' }}>
                {suggestions[q.id].rationale.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              {typeof scores[q.id] === 'number' && scores[q.id] !== suggestions[q.id].score && (
                <div style={{ marginTop: 3, color: 'var(--info)' }}>
                  You set {scores[q.id]} — overriding the suggestion.
                </div>
              )}
            </div>
          )}

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
          title={
            complete
              ? 'Save your scores'
              : identity === ''
                ? 'Enter your name first'
                : 'Score every question first'
          }
          onClick={() => {
            recordInterview(candidate.id, identity, scores, notes)
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

/**
 * The filed selection record for one candidate — scores, interview in full, and
 * the justification of the whole procedure — printed to PDF or saved as an
 * editable .doc, fingerprinted so a filed copy is tamper-evident.
 */
const DECISIONS: { id: 'advance' | 'hold' | 'declined'; label: string }[] = [
  { id: 'advance', label: 'Advance' },
  { id: 'hold', label: 'Hold' },
  { id: 'declined', label: 'Do not advance' },
]

function RecordModal({
  candidate,
  course,
  actor,
  canRecord,
  onClose,
}: {
  candidate: AemtCandidate
  course: AemtCourse
  actor: string
  canRecord: boolean
  onClose: () => void
}) {
  // The decision is recorded here because this is the moment it is filed. Held
  // in local state and written through, so the document generated below carries
  // the decision the button shows without waiting for a store round-trip.
  const [decision, setDecisionState] = useState(candidate.decision)
  const stamped: AemtCandidate = {
    ...candidate,
    decision,
    decidedBy: decision ? actor : undefined,
    decidedAt: decision ? candidate.decidedAt ?? new Date().toISOString() : undefined,
  }
  const score = scoreCandidate(stamped)
  const [fingerprint, setFingerprint] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  function chooseDecision(id: 'advance' | 'hold' | 'declined') {
    // Clicking the recorded decision again clears it, for a mis-tap.
    const next = decision === id ? undefined : id
    setDecisionState(next)
    updateCandidate(candidate.id, {
      decision: next,
      decidedBy: next ? actor : undefined,
      decidedAt: next ? new Date().toISOString() : undefined,
    })
  }

  useEffect(() => {
    let live = true
    setReady(false)
    recordFingerprint(stamped, score).then((h) => {
      if (live) {
        setFingerprint(h)
        setReady(true)
      }
    })
    return () => {
      live = false
    }
    // Re-fingerprint when the decision changes — the decision is one of the
    // scoring facts the hash covers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate, decision])

  const meta = () => ({ actor, generatedAt: new Date().toLocaleString(), fingerprint })
  const ivCount = candidate.interviews?.length ?? 0

  return (
    <Modal title={`Selection record — ${candidate.name}`} onClose={onClose}>
      <div className="banner info" style={{ marginTop: 0 }}>
        A filed record of how this candidate was scored — the composite, the interview in full, and
        the justification of the procedure. Retained under HR, not the K.A.R. program-records clock.
      </div>

      <div className="meta" style={{ margin: '8px 0' }}>
        Composite <strong>{score.composite.toFixed(1)}</strong> / {THRESHOLDS.composite} ·{' '}
        {ivCount === 0
          ? 'no interview recorded'
          : `${ivCount} interviewer${ivCount === 1 ? '' : 's'}`}
        {ivCount === 1 && ' (procedure expects two)'} ·{' '}
        {score.complete && score.blockers.length === 0 ? 'clears every threshold' : 'does not clear'}
      </div>
      {ivCount === 0 && (
        <div className="banner warn">
          No interview has been scored for this candidate yet. The record will still generate — the
          interview section will say so — but it is not a complete selection record.
        </div>
      )}

      <div className="field" style={{ marginTop: 10 }}>
        <label id="dec-lbl">Final decision</label>
        <div className="segmented" role="radiogroup" aria-labelledby="dec-lbl" style={{ width: '100%' }}>
          {DECISIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={decision === d.id}
              disabled={!canRecord}
              title={canRecord ? undefined : 'Signed out — a decision recorded here could not be attributed.'}
              className={decision === d.id ? 'active' : ''}
              style={{ flex: 1 }}
              onClick={() => chooseDecision(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="help-text">
          {decision
            ? `Recorded ${actor === 'local' ? 'on this device' : `as ${actor}`}, and stamped on the document. Tap again to clear.`
            : 'Optional — the record prints “No final decision recorded” until one is set.'}
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!ready}
          onClick={() =>
            printDoc(candidateRecordTitle(stamped), candidateRecordBody(stamped, score, course, meta()))
          }
        >
          Print / Save as PDF
        </button>
        <button
          className="btn"
          disabled={!ready}
          onClick={() =>
            downloadDoc(
              safeFilename(`AEMT-selection-${candidate.name}`),
              candidateRecordTitle(stamped),
              candidateRecordBody(stamped, score, course, meta()),
            )
          }
        >
          Download .doc
        </button>
      </div>
      <div className="help-text" style={{ marginTop: 6 }}>
        {ready
          ? fingerprint
            ? 'Fingerprinted (SHA-256) for the file.'
            : 'Fingerprint unavailable on this device — the record notes it.'
          : 'Preparing the record…'}
      </div>
    </Modal>
  )
}

/**
 * Add candidates from the people who have actually sat the selection exam.
 *
 * The tab previously only worked the other way round — type a candidate, then
 * pull their score by email — and "Pull exam results" is disabled with an empty
 * list, so a coordinator whose candidates had all taken the test but had never
 * been typed in had no way to start.
 */
function ExamImportModal({ course, onClose }: { course: AemtCourse; onClose: () => void }) {
  const [rows, setRows] = useState<ExamSitting[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  useEffect(() => {
    let live = true
    listExamSittings(course.id).then((r) => {
      if (!live) return
      if (r.error) setError(r.error)
      else {
        setRows(r.rows ?? [])
        // Everyone not already on the list is worth adding by default; that is
        // the whole reason for opening this.
        setPicked(new Set((r.rows ?? []).filter((s) => !s.alreadyAdded).map((s) => s.email)))
      }
    })
    return () => {
      live = false
    }
  }, [course.id])

  const toggle = (email: string) =>
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })

  const available = (rows ?? []).filter((s) => !s.alreadyAdded)

  return (
    <Modal title="Add candidates from exam attempts" onClose={onClose}>
      {error && <div className="banner crit">{error}</div>}
      {!rows && !error && <p className="subtle">Loading attempts…</p>}

      {rows && rows.length === 0 && (
        <div className="banner warn">
          No submitted exam attempts found. An attempt only appears here once the candidate has
          submitted it — one still in progress will not.
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <p style={{ marginTop: 0, lineHeight: 1.55 }}>
            Name and email come straight from the attempt, so a candidate added here matches their
            own result by construction. That is the failure hand-entry has: one typo in an address
            and the score never attaches.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Name</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'right' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.email}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Add ${s.name}`}
                        disabled={s.alreadyAdded}
                        checked={picked.has(s.email)}
                        onChange={() => toggle(s.email)}
                      />
                    </td>
                    <td>{s.name}</td>
                    <td className="subtle">{s.email}</td>
                    <td style={{ textAlign: 'right' }}>
                      {s.alreadyAdded ? (
                        <span className="pill muted">already added</span>
                      ) : s.percent == null ? (
                        <span className="pill warn">no score</span>
                      ) : (
                        <strong>{s.percent}%</strong>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button
          className="btn primary"
          disabled={picked.size === 0}
          onClick={() => {
            const add = available.filter((s) => picked.has(s.email))
            const n = addCandidatesFromExam(course.id, add)
            notifyUser(`Added ${n} candidate${n === 1 ? '' : 's'} with their exam results.`, 'info')
            onClose()
          }}
        >
          Add {picked.size} candidate{picked.size === 1 ? '' : 's'}
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
  const { manageAemt: canEdit } = useCan()
  const safety = useRecordSafety()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [empNo, setEmpNo] = useState('')
  const [email, setEmail] = useState('')
  const [pulling, setPulling] = useState(false)
  const [importing, setImporting] = useState(false)
  const [pullNote, setPullNote] = useState<string | null>(null)
  const [scoring, setScoring] = useState<AemtCandidate | null>(null)
  const [interviewing, setInterviewing] = useState<AemtCandidate | null>(null)
  const [recording, setRecording] = useState<AemtCandidate | null>(null)

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
          <button className="btn" onClick={() => setImporting(true)} title="List everyone who has sat the selection exam and add them as candidates">
            👥 Add from exam
          </button>
        )}
        {canEdit && (
          <button
            className="btn"
            disabled={pulling || candidates.length === 0}
            onClick={async () => {
              setPulling(true)
              setPullNote(null)
              const r = await pullExamResults(course.id)
              setPulling(false)
              if (r.error) {
                setPullNote(r.error)
                return
              }
              const bits = [`${r.matched} result${r.matched === 1 ? '' : 's'} attached`]
              if (r.unmatched.length) bits.push(`no attempt found for ${r.unmatched.join(', ')}`)
              if (r.noEmail.length) bits.push(`no exam email on ${r.noEmail.join(', ')}`)
              setPullNote(bits.join(' · '))
            }}
            title={
              candidates.length === 0
                ? 'Nothing to match yet — add candidates first, or use “Add from exam”'
                : 'Refresh scores for candidates already on the list, matched by email'
            }
          >
            {pulling ? 'Pulling…' : '⬇ Pull exam results'}
          </button>
        )}
        {canEdit && candidates.length > 0 && (
          <button
            className="btn"
            title="One-page summary of the whole field with the scoring methodology — for the file"
            onClick={() =>
              printDoc(
                cohortRecordTitle(course),
                cohortRecordBody(
                  course,
                  scored,
                  { actor: safety.actor, generatedAt: new Date().toLocaleString() },
                ),
              )
            }
          >
            🗎 Cohort record
          </button>
        )}
        {canEdit && (
          <button className="btn primary" onClick={() => setAdding(true)}>
            + Candidate
          </button>
        )}
      </div>

      {pullNote && (
        <div className="banner info" style={{ marginTop: 8 }}>
          {pullNote}
        </div>
      )}

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
                className={`row cand-row left-accent ${clear ? 'acc-ok' : score.complete ? 'acc-crit' : 'acc-warn'}`}
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
                    {/* The filed decision, visible without opening the record. */}
                    {c.decision && (
                      <span
                        className={`pill ${c.decision === 'advance' ? 'ok' : c.decision === 'declined' ? 'crit' : 'warn'}`}
                        style={{ marginLeft: 8 }}
                      >
                        {DECISIONS.find((d) => d.id === c.decision)?.label}
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
                  {(c.interviews?.length ?? 0) === 1 && (
                    <div className="meta" style={{ color: 'var(--warn)' }}>
                      Scored by one interviewer ({c.interviews![0].scorer}). The procedure has two
                      score independently before conferring, and the disagreement check needs both.
                    </div>
                  )}
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
                <div className="cand-score" style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>
                    {score.composite.toFixed(1)}
                  </div>
                  <div className="subtle" style={{ fontSize: 11 }}>
                    of {THRESHOLDS.composite} needed
                  </div>
                </div>
                {canEdit && (
                  <div className="cand-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                      className="btn sm"
                      title="Generate the filed selection record — scores, interview, and the justification of the process"
                      onClick={() => setRecording(c)}
                    >
                      Record
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

      {importing && <ExamImportModal course={course} onClose={() => setImporting(false)} />}

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
          <div className="field">
            <label htmlFor="cand-email">Exam email</label>
            <input
              id="cand-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="the address they sat the exam under"
            />
            <div className="help-text">
              The only link to their selection-exam result. The exam is a no-login form, so a
              candidate whose address does not match is left unmatched rather than guessed at.
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              className="btn primary"
              disabled={name.trim() === ''}
              onClick={() => {
                addCandidate(course.id, name.trim(), empNo.trim() || undefined, email.trim() || undefined)
                setName('')
                setEmpNo('')
                setEmail('')
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
      {recording && (
        <RecordModal
          candidate={recording}
          course={course}
          actor={safety.actor}
          canRecord={safety.canRecordOfficial}
          onClose={() => setRecording(null)}
        />
      )}
    </div>
  )
}
