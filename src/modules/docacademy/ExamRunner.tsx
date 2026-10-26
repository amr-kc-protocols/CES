import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BASELINE, DOMAIN_LABEL, EXAM_FORM_A, EXAM_PASS_PCT } from '../../data/docAcademy/questions'
import { LESSON_BY_ID } from '../../data/docAcademy/lessons'
import SourceChips from './SourceChips'
import { displayOrders, scoreExam, type Answers } from './scoring'
import { newAttemptId, recordAttempt, useActiveLearner } from './academyStore'

// The baseline (ungraded) and the common-core exam. Scenario facts are shown
// before each prompt; rationale and source-linked remediation only after
// submission. Scoring is deterministic (./scoring).

export default function ExamRunner() {
  const { form = 'A' } = useParams()
  const isBaseline = form === 'baseline'
  const items = isBaseline ? BASELINE : EXAM_FORM_A
  const learner = useActiveLearner()
  const [answers, setAnswers] = useState<Answers>({})
  const [attemptId, setAttemptId] = useState<string | null>(null)

  const order = useMemo(() => displayOrders(items), [items])
  const result = useMemo(() => (attemptId ? scoreExam(items, answers) : null), [attemptId, items, answers])
  const priorA = learner?.attempts.filter((a) => a.form === 'A') ?? []
  const unanswered = items.filter((q) => !answers[q.id]?.length).length

  function submit() {
    const id = newAttemptId()
    const r = scoreExam(items, answers)
    if (learner) {
      recordAttempt(learner.id, {
        id,
        form: isBaseline ? 'baseline' : 'A',
        answers,
        correct: r.correct,
        total: r.total,
        pct: r.pct,
        passed: isBaseline ? false : r.passed,
      })
    }
    setAttemptId(id)
    window.scrollTo({ top: 0 })
  }

  const remediation = result
    ? [...new Set(result.missed.map((id) => items.find((q) => q.id === id)!.lessonId))]
    : []

  return (
    <div>
      <Link to="/doc-academy" className="btn ghost" style={{ paddingLeft: 0 }}>
        ‹ Course
      </Link>
      <div className="page-head">
        <div>
          <h1>{isBaseline ? 'Baseline — ungraded' : 'Common-core exam · Form A'}</h1>
          <div className="subtle">
            {items.length} questions
            {isBaseline ? ' · does not affect completion' : ` · pass at ${EXAM_PASS_PCT}%`}
          </div>
        </div>
      </div>

      {!learner && (
        <div className="banner warn">No learner selected — this attempt will not be saved. Start or choose one on the course page.</div>
      )}
      {!isBaseline && priorA.length > 0 && !attemptId && (
        <div className="banner warn">
          This is attempt {priorA.length + 1}. The brief calls for a <em>different</em> equivalent retest; Form B is not
          written yet, so a same-form retest is recorded as such and the reviewer decides whether it counts.
        </div>
      )}

      {result && (
        <div className={`banner ${isBaseline ? 'info' : result.passed ? 'ok' : 'warn'}`} aria-live="polite">
          <strong>
            {result.correct} of {result.total} ({result.pct}%)
          </strong>
          {isBaseline ? ' — baseline recorded separately from the post-test.' : result.passed ? ' — passed.' : ' — not yet passed.'}
          {result.missedCritical.length > 0 && <> Critical concepts missed: {result.missedCritical.join(', ')}.</>}
          <div style={{ marginTop: 6 }}>
            By domain:{' '}
            {Object.entries(result.byDomain)
              .map(([d, v]) => `${DOMAIN_LABEL[d as keyof typeof DOMAIN_LABEL]} ${v.correct}/${v.total}`)
              .join(' · ')}
          </div>
          {remediation.length > 0 && (
            <div style={{ marginTop: 6 }}>
              Review:{' '}
              {remediation.map((lid, i) => (
                <span key={lid}>
                  {i > 0 && ', '}
                  <Link to={`/doc-academy/lesson/${lid}`}>
                    {lid} {LESSON_BY_ID[lid]?.title}
                  </Link>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <ol style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
        {items.map((q, n) => {
          const chosen = answers[q.id] ?? []
          const right = result && !result.missed.includes(q.id)
          return (
            <li key={q.id} className="card" style={{ padding: 14 }}>
              <div className="subtle" style={{ fontSize: 12, fontWeight: 700 }}>
                {n + 1}. {DOMAIN_LABEL[q.domain]}
                {result && (right ? ' · ✓ correct' : ' · ✗ incorrect')}
              </div>
              {q.scenarioFacts.length > 0 && (
                <ul style={{ margin: '6px 0', paddingLeft: 20, lineHeight: 1.5 }}>
                  {q.scenarioFacts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
              <fieldset disabled={!!result} style={{ border: 0, padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 700, margin: '6px 0' }}>{q.prompt}</legend>
                {order[q.id].map((c) => {
                  const isRight = q.correctChoiceIds.includes(c.id)
                  return (
                    <label key={c.id} className="row" style={{ gap: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
                      <input
                        type="radio"
                        name={q.id}
                        checked={chosen.includes(c.id)}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: [c.id] }))}
                      />
                      <span className="grow">
                        {c.text}
                        {result && (chosen.includes(c.id) || isRight) && (
                          <span className="meta" style={{ display: 'block', marginTop: 4 }}>
                            {isRight ? '✓ ' : '✗ '}
                            {q.rationaleByChoice[c.id]}
                          </span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </fieldset>
              {result && <SourceChips ids={q.sourceIds} />}
            </li>
          )
        })}
      </ol>

      {!result && (
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={submit} disabled={unanswered > 0}>
            Submit
          </button>
          {unanswered > 0 && <span className="subtle">{unanswered} unanswered</span>}
        </div>
      )}
    </div>
  )
}
