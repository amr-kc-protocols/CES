import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  EXAM_DEADLINE,
  examClosed,
  startExam,
  submitExam,
  type ExamQuestion,
  type ExamStart,
} from '../../lib/exam'

// Public, no-login AEMT selection exam. Questions come from the server without
// answers; grading is server-side. One attempt per email, before the cutoff.

type Phase = 'intro' | 'exam' | 'submitting' | 'done' | 'closed' | 'taken'

// Stable per-question shuffle of the option display order. We submit the
// ORIGINAL index, so shuffling is purely visual (screenshot resistance).
function shuffledOrder(q: ExamQuestion, seed: string): number[] {
  const idx = q.options.map((_, i) => i)
  let h = 0
  for (const ch of seed + q.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  for (let i = idx.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    const j = h % (i + 1)
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx
}

function fmtClock(s: number): string {
  const m = Math.floor(Math.max(0, s) / 60)
  const sec = Math.max(0, s) % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function ExamPage() {
  const [phase, setPhase] = useState<Phase>(() => (examClosed() ? 'closed' : 'intro'))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [exam, setExam] = useState<ExamStart | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [remaining, setRemaining] = useState(0)
  const submittedRef = useRef(false)

  const orders = useMemo(() => {
    if (!exam) return {}
    const map: Record<number, number[]> = {}
    for (const q of exam.questions) map[q.id] = shuffledOrder(q, exam.attemptId)
    return map
  }, [exam])

  const finish = useCallback(
    async (why: 'manual' | 'time') => {
      if (!exam || submittedRef.current) return
      submittedRef.current = true
      setPhase('submitting')
      setError(null)
      const { error: err } = await submitExam(exam.attemptId, answers)
      if (err) {
        submittedRef.current = false
        setError(err + ' — please try Submit again.')
        setPhase('exam')
        return
      }
      setPhase('done')
      window.scrollTo(0, 0)
      void why
    },
    [exam, answers],
  )

  // Countdown, anchored to the server's started_at so a refresh can't reset it.
  useEffect(() => {
    if (phase !== 'exam' || !exam) return
    const deadline = new Date(exam.startedAt).getTime() + exam.limitSeconds * 1000
    const tick = () => {
      const left = Math.round((deadline - Date.now()) / 1000)
      setRemaining(left)
      if (left <= 0) void finish('time')
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [phase, exam, finish])

  const begin = async () => {
    setError(null)
    if (!name.trim() || !email.trim()) return setError('Please enter your name and email.')
    if (!consent) return setError('Please acknowledge the statement to begin.')
    setPhase('submitting')
    const r = await startExam(name.trim(), email.trim())
    if ('data' in r) {
      setExam(r.data)
      setIndex(0)
      setAnswers({})
      submittedRef.current = false
      setPhase('exam')
    } else if ('reason' in r) {
      setPhase(r.reason === 'closed' ? 'closed' : 'taken')
    } else {
      setError(r.error)
      setPhase('intro')
    }
  }

  const shell = (body: ReactNode) => (
    <div className="intake-page">
      <header className="intake-head">
        <img src="/pwa-192x192.png" alt="" />
        <div>
          <div className="intake-title">AMR Kansas City</div>
          <div className="intake-sub">AEMT Program — Selection Exam</div>
        </div>
      </header>
      <main className="intake-body">{body}</main>
    </div>
  )

  if (phase === 'closed')
    return shell(
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
        <h2 style={{ marginBottom: 8 }}>The exam is closed</h2>
        <p className="subtle" style={{ margin: 0 }}>
          The window closed on <strong>{EXAM_DEADLINE.display}</strong>. Reach out to the AMR KC
          education team with any questions.
        </p>
      </div>,
    )

  if (phase === 'taken')
    return shell(
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <h2 style={{ marginBottom: 8 }}>You've already taken the exam</h2>
        <p className="subtle" style={{ margin: 0 }}>
          Our records show a completed attempt for this email. The exam is one attempt only. If you
          think this is a mistake, contact the AMR KC education team.
        </p>
      </div>,
    )

  if (phase === 'done')
    return shell(
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <h2 style={{ marginBottom: 8 }}>Exam submitted</h2>
        <p className="subtle" style={{ margin: 0 }}>
          Your responses have been recorded. Thank you — the AMR KC education team will be in touch.
          You can close this page.
        </p>
      </div>,
    )

  if (phase === 'intro' || (phase === 'submitting' && !exam))
    return shell(
      <>
        <div className="intake-deadline">
          ⏰ The exam window closes <strong>{EXAM_DEADLINE.display}</strong>.
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Before you begin</h2>
          <ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>
            <li><strong>50 questions</strong>, multiple choice.</li>
            <li><strong>40-minute time limit</strong> — a timer runs at the top; the exam submits automatically when it reaches zero.</li>
            <li><strong>One attempt.</strong> Once you start, the clock runs even if you close the page, so start when you're ready and undisturbed.</li>
            <li>Answer on your own — this is part of your selection.</li>
          </ul>
          <div className="field">
            <label htmlFor="ex-name">Full name</label>
            <input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ex-email">Email</label>
            <input id="ex-email" type="email" placeholder="name@gmr.net" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <label className="intake-consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I confirm I am completing this exam on my own, without help or outside resources.</span>
          </label>
          {error && <div className="banner crit" role="alert">{error}</div>}
          <button className="btn primary" style={{ width: '100%', marginTop: 6 }} disabled={phase === 'submitting'} onClick={begin}>
            {phase === 'submitting' ? 'Starting…' : 'Start exam'}
          </button>
        </div>
      </>,
    )

  // phase === 'exam' (or 'submitting' with exam loaded)
  if (!exam) return shell(<div className="subtle">Loading…</div>)
  const q = exam.questions[index]
  const order = orders[q.id] ?? q.options.map((_, i) => i)
  const answeredCount = Object.keys(answers).length
  const last = index === exam.questions.length - 1
  const lowTime = remaining <= 300

  return shell(
    <>
      <div className="exam-bar">
        <span className="exam-progress">
          Question {index + 1} of {exam.questions.length}
          <span className="subtle"> · {answeredCount} answered</span>
        </span>
        <span className={`exam-timer${lowTime ? ' low' : ''}`}>⏱ {fmtClock(remaining)}</span>
      </div>

      <div className="card exam-q">
        <div className="exam-domain">{q.domain}</div>
        <div className="exam-stem">{q.stem}</div>
        <div className="exam-options">
          {order.map((orig) => {
            const chosen = answers[q.id] === orig
            return (
              <button
                key={orig}
                type="button"
                className={`exam-option${chosen ? ' chosen' : ''}`}
                aria-pressed={chosen}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: orig }))}
              >
                {q.options[orig]}
              </button>
            )
          })}
        </div>
      </div>

      {error && <div className="banner crit" role="alert">{error}</div>}

      <div className="exam-nav">
        <button className="btn" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          ‹ Back
        </button>
        {last ? (
          <button className="btn primary" disabled={phase === 'submitting'} onClick={() => void finish('manual')}>
            {phase === 'submitting' ? 'Submitting…' : 'Submit exam'}
          </button>
        ) : (
          <button className="btn primary" onClick={() => setIndex((i) => i + 1)}>
            Next ›
          </button>
        )}
      </div>
      {last && answeredCount < exam.questions.length && (
        <div className="help-text" style={{ textAlign: 'center' }}>
          {exam.questions.length - answeredCount} unanswered — you can go back, or submit as is.
        </div>
      )}
    </>,
  )
}
