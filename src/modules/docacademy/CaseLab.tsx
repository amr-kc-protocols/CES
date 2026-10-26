import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CASE_BY_ID } from '../../data/docAcademy/cases'
import { SOURCE_BY_ID } from '../../data/docAcademy/sources'
import type { CaseIssue } from '../../data/docAcademy/types'
import { checkPhi, phiMessage } from '../../lib/phi'
import SourceChips from './SourceChips'
import { scoreCaseLab } from './scoring'
import { newAttemptId, recordCaseAttempt, saveDraft, useActiveLearner } from './academyStore'

// The chart-review lab. The evidence comes first; the learner flags what they
// would raise, can say the facts are insufficient, and only then sees the
// rationale. A case that rests on an unsupplied local policy ends in
// "clarification needed", never in a definitive legal or payer answer.

// Stable order that does not put the right answers first.
function mix(issues: CaseIssue[]): CaseIssue[] {
  const h = (s: string) => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7)
  return [...issues].sort((a, b) => h(a.id) - h(b.id))
}

export default function CaseLab() {
  const { caseId = '' } = useParams()
  const c = CASE_BY_ID[caseId]
  const learner = useActiveLearner()
  const [picked, setPicked] = useState<string[]>([])
  const [insufficient, setInsufficient] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [draft, setDraft] = useState(() => (learner && c ? learner.drafts[c.id] ?? '' : ''))
  const [draftMsg, setDraftMsg] = useState('')

  const options = useMemo(() => (c ? mix([...c.expectedIssues, ...c.distractors]) : []), [c])

  if (!c) {
    return (
      <div>
        <Link to="/doc-academy" className="btn ghost">‹ Course</Link>
        <div className="banner warn" style={{ marginTop: 12 }}>That case could not be found.</div>
      </div>
    )
  }

  const result = submitted ? scoreCaseLab(c, picked) : null
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  function submit() {
    const id = newAttemptId()
    if (learner) recordCaseAttempt(learner.id, { id, caseId: c.id, picked, insufficient })
    setSubmitted(id)
  }

  function save() {
    const phi = checkPhi(draft)
    if (!phi.ok) {
      setDraftMsg(phiMessage(phi))
      return
    }
    if (learner) saveDraft(learner.id, c.id, draft)
    setDraftMsg(learner ? 'Saved.' : 'Start the course on the course page to save drafts.')
  }

  return (
    <div>
      <Link to="/doc-academy" className="btn ghost" style={{ paddingLeft: 0 }}>
        ‹ Course
      </Link>
      <div className="page-head">
        <div>
          <h1>
            {c.id} · {c.title}
          </h1>
          <div className="subtle">Fictional teaching case — not a patient record</div>
        </div>
      </div>

      <div className="card" style={{ padding: 14 }}>
        <strong>Your task:</strong> {c.learnerTask}
      </div>

      {!c.authored ? (
        <div className="banner info">
          <strong>Seed case.</strong> {c.seed} The full vignette, structured fields and reviewer key are not written yet;
          use it for discussion. Required answer direction: {c.answerDirection}
        </div>
      ) : (
        <>
          <section className="card" style={{ padding: 14 }}>
            <div className="section-title" style={{ marginTop: 0 }}>Narrative</div>
            <p style={{ margin: 0, lineHeight: 1.55, fontFamily: 'ui-monospace, monospace', fontSize: 14 }}>{c.narrative}</p>
          </section>

          {c.structuredFields && (
            <section className="card" style={{ padding: 14 }}>
              <div className="section-title" style={{ marginTop: 0 }}>Structured fields</div>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(8rem, max-content) 1fr', gap: '4px 12px' }}>
                {Object.entries(c.structuredFields).map(([k, v]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt className="subtle">{k}</dt>
                    <dd style={{ margin: 0 }}>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {c.timeline && (
            <section className="card" style={{ padding: 14 }}>
              <div className="section-title" style={{ marginTop: 0 }}>Timeline</div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {c.timeline.map((t) => (
                  <li key={t.time + t.event}>
                    <strong>{t.time}</strong> {t.event}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card" style={{ padding: 14 }}>
            <div className="section-title" style={{ marginTop: 0 }}>What would you raise?</div>
            <div className="help-text" style={{ marginTop: 0 }}>Select every finding you would put to the author. Some options are wrong.</div>
            <fieldset disabled={!!submitted} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="sr-only">Findings</legend>
              {options.map((o) => (
                <label key={o.id} className="row" style={{ gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={picked.includes(o.id)} onChange={() => toggle(o.id)} />
                  <span className="grow">{o.label}</span>
                </label>
              ))}
              <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={insufficient} onChange={() => setInsufficient((v) => !v)} />
                <span className="grow">
                  <strong>Insufficient information</strong> — the chart does not contain the facts needed to decide
                </span>
              </label>
            </fieldset>
            {!submitted && (
              <button className="btn primary" style={{ marginTop: 10 }} onClick={submit} disabled={!picked.length && !insufficient}>
                Submit and see the rationale
              </button>
            )}
          </section>

          {result && (
            <section className="card" style={{ padding: 14 }} aria-live="polite">
              <div className="section-title" style={{ marginTop: 0 }}>
                Feedback — found {result.found.length} of {c.expectedIssues.length}
                {result.wrongPicks.length ? `, ${result.wrongPicks.length} not supported` : ''}
              </div>
              {options.map((o) => {
                const expected = c.expectedIssues.some((e) => e.id === o.id)
                const chose = picked.includes(o.id)
                const tag = expected ? (chose ? '✓ Found' : '○ Missed') : chose ? '✗ Not supported' : '— Correctly left'
                return (
                  <div key={o.id} className="row" style={{ alignItems: 'flex-start' }}>
                    <div className="grow">
                      <div className="title" style={{ fontSize: 14 }}>
                        {tag}: {o.label}
                      </div>
                      <div className="meta">{o.explanation}</div>
                      <SourceChips ids={o.sourceIds} />
                    </div>
                  </div>
                )
              })}
              <div className="row">
                <div className="grow">
                  <div className="title" style={{ fontSize: 14 }}>Unknown facts in this case</div>
                  <div className="meta">
                    {c.unknownFacts.length
                      ? c.unknownFacts.join(' · ')
                      : 'None — the facts here are sufficient to act on.'}
                    {insufficient && !c.unknownFacts.length ? ' "Insufficient information" was not the right call here.' : ''}
                  </div>
                </div>
              </div>
              {c.forbiddenInferences.length > 0 && (
                <div className="banner warn" style={{ marginTop: 10 }}>
                  <strong>Do not conclude:</strong> {c.forbiddenInferences.join(' ')}
                </div>
              )}
              {result.clarificationNeeded && (
                <div className="banner info" style={{ marginTop: 10 }}>
                  <strong>Billing/compliance clarification needed.</strong> Part of this answer depends on{' '}
                  {(c.pendingSourceIds ?? []).map((id) => SOURCE_BY_ID[id]?.title ?? id).join('; ')}, which has not been
                  supplied. Route the question; do not decide it here.
                </div>
              )}
              <p style={{ marginBottom: 0 }}>
                <strong>Answer direction:</strong> {c.answerDirection}
              </p>
            </section>
          )}
        </>
      )}

      <section className="card" style={{ padding: 14 }}>
        <div className="section-title" style={{ marginTop: 0 }}>Narrative workspace</div>
        <div className="help-text" style={{ marginTop: 0 }}>
          Draft your clarification request, documentation plan or rewrite. Synthetic facts only — text that looks like a
          patient identifier is refused. A reviewer reads and scores this; nothing here is auto-graded.
        </div>
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setDraftMsg('')
          }}
          rows={8}
          style={{ width: '100%', font: 'inherit', padding: 10, boxSizing: 'border-box' }}
          aria-label="Narrative workspace"
        />
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={save}>
            Save draft
          </button>
          {draftMsg && <span className="subtle" role="status">{draftMsg}</span>}
        </div>
      </section>
    </div>
  )
}
