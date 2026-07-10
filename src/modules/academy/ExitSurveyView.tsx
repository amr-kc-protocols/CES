import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Empty } from '../../components/ui'
import {
  SURVEY_SCRIPT_URL,
  SURVEY_SECTIONS,
  allQuestions,
  type SurveyQuestion,
} from '../../data/exitSurvey'
import { CREDENTIAL_LABELS } from '../../data/academy'
import { formatDate, todayISO } from '../../lib/date'
import { useCohort, useCohortTrainees, updateTrainee } from './academyStore'
import type { Trainee } from '../../types'

// The New Hire Orientation (exit) Survey, ported from the Field Guide site.
// Answers post to the same Google Apps Script endpoint (same field keys →
// same sheet columns); the trainee record additionally notes submission.

type Answers = Record<string, string>

function prefill(t: Trainee): Answers {
  return {
    fullName: t.name,
    employeeNumber: t.employeeNumber ?? '',
    certLevel: t.credential === 'paramedic' ? 'Paramedic' : 'EMT',
    ftoList: t.ftos ?? '',
  }
}

// A 39-question survey must survive an accidental reload or app switch:
// answers autosave to a per-trainee draft, cleared on submit.
const draftKey = (traineeId: string) => `ces.surveydraft.${traineeId}`

function loadDraft(traineeId: string): Answers | null {
  try {
    const raw = localStorage.getItem(draftKey(traineeId))
    return raw ? (JSON.parse(raw) as Answers) : null
  } catch {
    return null
  }
}

function saveDraft(traineeId: string, answers: Answers): void {
  try {
    localStorage.setItem(draftKey(traineeId), JSON.stringify(answers))
  } catch {
    // Best-effort only; a full disk shouldn't break typing.
  }
}

function clearDraft(traineeId: string): void {
  try {
    localStorage.removeItem(draftKey(traineeId))
  } catch {
    // Ignore.
  }
}

function visible(q: SurveyQuestion, answers: Answers): boolean {
  return !('showIf' in q) || !q.showIf || answers[q.showIf.name] === q.showIf.value
}

function QuestionField({
  q,
  answers,
  setAnswer,
  invalid,
}: {
  q: SurveyQuestion
  answers: Answers
  setAnswer: (name: string, value: string) => void
  invalid: boolean
}) {
  const value = answers[q.name] ?? ''
  const label = (
    <label className="q-label">
      {q.label}
      {q.required && <span style={{ color: 'var(--crit)', marginLeft: 3 }}>*</span>}
    </label>
  )
  const invalidStyle: React.CSSProperties = invalid ? { outline: '2px solid var(--crit)', outlineOffset: 2, borderRadius: 8 } : {}

  switch (q.kind) {
    case 'text':
      return (
        <div className="field" data-q={q.name} style={invalidStyle}>
          {label}
          <input value={value} onChange={(e) => setAnswer(q.name, e.target.value)} placeholder={q.placeholder} />
        </div>
      )
    case 'date':
      return (
        <div className="field" data-q={q.name} style={invalidStyle}>
          {label}
          <input type="date" value={value} onChange={(e) => setAnswer(q.name, e.target.value)} />
        </div>
      )
    case 'select':
      return (
        <div className="field" data-q={q.name} style={invalidStyle}>
          {label}
          <select value={value} onChange={(e) => setAnswer(q.name, e.target.value)}>
            <option value="" disabled>
              Select…
            </option>
            {q.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      )
    case 'radio':
      return (
        <div className="field" data-q={q.name} style={invalidStyle}>
          {label}
          {q.note && (
            <div className="banner warn" style={{ display: 'inline-block', padding: '4px 10px', fontSize: 12, marginBottom: 7 }}>
              {q.note}
            </div>
          )}
          <div className="choice-row">
            {q.options.map((o, i) => (
              <button
                key={o}
                type="button"
                className={`choice${value === o ? ' active' : ''}`}
                onClick={() => setAnswer(q.name, o)}
              >
                {q.short?.[i] ?? o}
              </button>
            ))}
          </div>
        </div>
      )
    case 'scale':
      return (
        <div className="field" data-q={q.name} style={invalidStyle}>
          {label}
          <div className="choice-row scale">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`choice${value === String(n) ? ' active' : ''}`}
                onClick={() => setAnswer(q.name, String(n))}
              >
                {n}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            <span>{q.low}</span>
            <span>{q.high}</span>
          </div>
        </div>
      )
    case 'textarea':
      return (
        <div className="field" data-q={q.name} style={invalidStyle}>
          {label}
          {q.hint && <div className="help-text" style={{ marginTop: 0, marginBottom: 6 }}>{q.hint}</div>}
          <textarea
            value={value}
            maxLength={q.maxLength}
            placeholder={q.placeholder}
            onChange={(e) => setAnswer(q.name, e.target.value)}
          />
          <div
            className="help-text"
            style={{ textAlign: 'right', color: value.length > q.maxLength * 0.9 ? 'var(--warn)' : undefined }}
          >
            {value.length} / {q.maxLength}
          </div>
        </div>
      )
  }
}

export default function ExitSurveyView() {
  const { cohortId = '', traineeId = '' } = useParams()
  const cohort = useCohort(cohortId)
  const trainee = useCohortTrainees(cohortId).find((t) => t.id === traineeId)
  const [restoredDraft] = useState(() => loadDraft(traineeId))
  const [answers, setAnswers] = useState<Answers>(() =>
    trainee ? { ...prefill(trainee), ...restoredDraft } : {},
  )
  const [missing, setMissing] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const formRef = useRef<HTMLDivElement>(null)

  const questions = useMemo(allQuestions, [])

  if (!cohort || !trainee) {
    return (
      <div>
        <Link to={`/academy/${cohortId}`} className="link-btn">
          ← Back to cohort
        </Link>
        <Empty icon="🔍" title="Trainee not found" />
      </div>
    )
  }

  const setAnswer = (name: string, value: string) => {
    setAnswers((a) => {
      const next = { ...a, [name]: value }
      saveDraft(traineeId, next)
      return next
    })
    setMissing((m) => m.filter((x) => x !== name))
  }

  async function submit() {
    const gaps = questions
      .filter((q) => q.required && visible(q, answers) && !(answers[q.name] ?? '').trim())
      .map((q) => q.name)
    if (gaps.length) {
      setMissing(gaps)
      const el = formRef.current?.querySelector(`[data-q="${gaps[0]}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setStatus('sending')
    const now = new Date()
    const submittedAt =
      now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) +
      ' ' +
      now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    const payload: Record<string, string> = { submittedAt }
    for (const q of questions) payload[q.name] = (answers[q.name] ?? '').trim()

    try {
      // Apps Script requires no-cors + URL-encoded body (avoids preflight).
      await fetch(SURVEY_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(payload) })
      updateTrainee(trainee!.id, { exitSurveyDate: todayISO() })
      clearDraft(traineeId)
      setStatus('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div>
        <Link to={`/academy/${cohortId}`} className="link-btn">
          ← {cohort.label}
        </Link>
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px', marginTop: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
          <h2 style={{ color: 'var(--ok)', marginBottom: 8 }}>Survey submitted</h2>
          <div className="subtle" style={{ maxWidth: 440, margin: '0 auto 18px' }}>
            Thank you for taking the time to complete this survey. Your feedback helps improve the
            orientation experience for every new hire at AMR Kansas City.
          </div>
          <Link to={`/academy/${cohortId}`} className="btn primary">
            Back to cohort
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div ref={formRef}>
      <Link to={`/academy/${cohortId}`} className="link-btn">
        ← {cohort.label}
      </Link>

      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h1>New Hire Orientation Survey</h1>
          <div className="subtle">
            {trainee.name} · {CREDENTIAL_LABELS[trainee.credential]}
            {trainee.exitSurveyDate ? ` · already submitted ${formatDate(trainee.exitSurveyDate)}` : ''}
          </div>
        </div>
      </div>

      <div className="banner info">
        This survey helps improve the program and recognize outstanding FTOs. Responses are reviewed
        by the Clinical Educator and Operations leadership, and kept confidential within leadership.
        Answer honestly — this is your opportunity to shape the experience for the next new hire.
      </div>

      {trainee.exitSurveyDate && (
        <div className="banner warn">
          A survey was already submitted for {trainee.name} on {formatDate(trainee.exitSurveyDate)}.
          Submitting again adds a second response to the sheet.
        </div>
      )}

      {restoredDraft && !trainee.exitSurveyDate && (
        <div className="banner ok">✓ Draft restored — your earlier answers were kept.</div>
      )}

      {SURVEY_SECTIONS.map((s, i) => (
        <div key={s.title} className="card" style={{ padding: 16, marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'var(--navy)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {s.title}
              </div>
              <div className="subtle" style={{ fontSize: 12 }}>{s.sub}</div>
            </div>
          </div>
          {s.questions.map(
            (q) =>
              visible(q, answers) && (
                <QuestionField key={q.name} q={q} answers={answers} setAnswer={setAnswer} invalid={missing.includes(q.name)} />
              ),
          )}
        </div>
      ))}

      {missing.length > 0 && (
        <div className="banner crit" style={{ marginTop: 14 }}>
          ⚠ {missing.length} required question{missing.length === 1 ? '' : 's'} still need an answer —
          they're outlined in red above.
        </div>
      )}

      <button
        className="btn primary"
        style={{ width: '100%', marginTop: 14, padding: 14, fontSize: 16 }}
        disabled={status === 'sending'}
        onClick={submit}
      >
        {status === 'sending' ? 'Submitting…' : 'Submit survey →'}
      </button>
      {status === 'error' && (
        <div className="banner crit" style={{ marginTop: 10 }}>
          ⚠ Submission failed — check connection and try again.
        </div>
      )}
    </div>
  )
}
