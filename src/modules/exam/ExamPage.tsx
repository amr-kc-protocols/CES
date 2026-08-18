import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  attestationLines,
  examClosed,
  examConfig,
  examDeadline,
  startExam,
  submitExam,
  type ExamProgram,
  type ExamQuestion,
  type ExamStart,
} from '../../lib/exam'
import { NEOP_SECTIONS } from '../../data/neopSections'
import { confirmAction } from '../../lib/dialog'
import { ConfirmHost } from '../../components/DialogHost'
import KcBriefing from './KcBriefing'

// Public, no-login selection exam. Questions come from the server without
// answers; grading is server-side. One attempt per email per program, and — on
// the AEMT exam — before the cutoff.
//
// ONE COMPONENT, TWO EXAMS. `program` selects the configuration in lib/exam.ts:
// the clock, whether there is a cutoff at all, the integrity statement, and who
// to contact. The NEOP exam adds two things this page did not have — the job
// briefing on the intro screen, and a section banner when the exam moves from
// one kind of question to the next.

type Phase = 'intro' | 'exam' | 'submitting' | 'done' | 'closed' | 'taken' | 'expired'

/**
 * Stable per-question shuffle of the option display order. We submit the
 * ORIGINAL index, so shuffling is purely visual (screenshot resistance).
 *
 * The generator matters more than it looks. The first version drew each swap
 * with `h % (i + 1)` from a linear congruential generator, and the low bits of
 * an LCG hardly vary — with an odd multiplier and an odd increment the lowest
 * bit simply alternates, so the final swap was decided before it was made.
 * Measured over 20,000 attempts it put the correct answer in slot A 66% of the
 * time and C 33%, essentially never B or D, and reached only 14 of the 24
 * possible orders. Candidates noticed, which is how it was found.
 *
 * xmur3 seeds mulberry32, and each swap is drawn from the full 32 bits rather
 * than the bottom two. Same measurement: 24.9 / 24.8 / 25.2 / 25.2 across the
 * four slots, all 24 orders present. Still a pure function of the attempt id
 * and the question id, so a refresh mid-exam redraws the same order.
 */
function shuffledOrder(q: ExamQuestion, seed: string): number[] {
  const idx = q.options.map((_, i) => i)
  const key = `${seed}:${q.id}`

  let h = 1779033703 ^ key.length
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }

  const rand = () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx
}

function fmtClock(s: number): string {
  const m = Math.floor(Math.max(0, s) / 60)
  const sec = Math.max(0, s) % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

/** `*starred*` runs render bold, so the displayed and hashed wording are one. */
function emphasise(line: string): ReactNode[] {
  return line
    .split('*')
    .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>))
}

export default function ExamPage({ program = 'aemt' }: { program?: ExamProgram }) {
  const cfg = examConfig(program)
  const deadline = examDeadline(program)
  const [phase, setPhase] = useState<Phase>(() => (examClosed(program) ? 'closed' : 'intro'))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [signature, setSignature] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [exam, setExam] = useState<ExamStart | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})

  // Answers survive a refresh.
  //
  // They previously lived only in React state, so a reload, a browser crash or
  // an incoming call wiped every answer while the server clock kept running —
  // on a one-attempt exam with no way to start again. Keyed by attempt id, so
  // one candidate's stored answers can never be served to another, and cleared
  // once the attempt is submitted.
  const answersKey = (attemptId: string) => `ces.exam.answers.${attemptId}`
  const [remaining, setRemaining] = useState(0)
  const submittedRef = useRef(false)

  useEffect(() => {
    if (!exam) return
    try {
      localStorage.setItem(answersKey(exam.attemptId), JSON.stringify(answers))
    } catch {
      // Private browsing or a full quota. The exam still works in memory —
      // this is a safety net, not a dependency.
    }
  }, [exam, answers])

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
      const { error: err, expired } = await submitExam(exam.attemptId, answers)
      if (expired) {
        setPhase('expired')
        window.scrollTo(0, 0)
        return
      }
      if (err) {
        submittedRef.current = false
        setError(err + ' — please try Submit again.')
        setPhase('exam')
        return
      }
      try {
        localStorage.removeItem(answersKey(exam.attemptId))
      } catch {
        // Nothing to do; the entry is inert either way.
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
    const deadlineMs = new Date(exam.startedAt).getTime() + exam.limitSeconds * 1000
    const tick = () => {
      const left = Math.round((deadlineMs - Date.now()) / 1000)
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
    if (!consent) return setError('Please check the box to agree to the Integrity Statement.')
    if (!signature.trim()) return setError('Please sign by typing your full name.')
    if (signature.trim().toLowerCase() !== name.trim().toLowerCase())
      return setError('Your signature must match the full name you entered above.')
    setPhase('submitting')
    const r = await startExam(name.trim(), email.trim(), consent, signature.trim(), program)
    if ('data' in r) {
      setExam(r.data)
      setIndex(0)
      // Resume picks up where the candidate left off rather than blank.
      let restored: Record<number, number> = {}
      try {
        const raw = localStorage.getItem(answersKey(r.data.attemptId))
        if (raw) restored = JSON.parse(raw) as Record<number, number>
      } catch {
        // A corrupt or unreadable entry is not worth failing the exam over.
      }
      setAnswers(restored)
      submittedRef.current = false
      setPhase('exam')
    } else if ('reason' in r) {
      setPhase(r.reason === 'closed' ? 'closed' : r.reason === 'expired' ? 'expired' : 'taken')
    } else {
      setError(r.error)
      setPhase('intro')
    }
  }

  // ConfirmHost is mounted HERE, not just in Layout.
  //
  // This page renders outside the app shell, so it never had a dialog host.
  // confirmAction() would set a pending request that nothing could render or
  // resolve, the await never settled, and the Submit button did nothing — on a
  // one-attempt exam, until the clock ran out and spent the attempt.
  const shell = (body: ReactNode) => (
    <div className="intake-page">
      <header className="intake-head">
        <img src="/pwa-192x192.png" alt="" />
        <div>
          <div className="intake-title">AMR Kansas City</div>
          <div className="intake-sub">{cfg.subtitle}</div>
        </div>
      </header>
      <main className="intake-body">{body}</main>
      <ConfirmHost />
    </div>
  )

  if (phase === 'closed')
    return shell(
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
        <h2 style={{ marginBottom: 8 }}>The exam is closed</h2>
        <p className="subtle" style={{ margin: 0 }}>
          {deadline ? <>The window closed on <strong>{deadline.display}</strong>. </> : null}
          Reach out to {cfg.contact} with any questions.
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
          think this is a mistake, contact {cfg.contact}.
        </p>
      </div>,
    )

  if (phase === 'expired')
    return shell(
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>⏰</div>
        <h2 style={{ marginBottom: 8 }}>Your time ran out</h2>
        <p className="subtle" style={{ margin: 0 }}>
          This attempt's time limit passed before it was submitted, so it is closed. The exam is
          one attempt with one set of questions — there is no second sitting to hand out. If
          something went wrong at your end, contact {cfg.contact} and they can reset it for you.
        </p>
      </div>,
    )

  if (phase === 'done')
    return shell(
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <h2 style={{ marginBottom: 8 }}>Exam submitted</h2>
        <p className="subtle" style={{ margin: 0 }}>
          Your responses have been recorded. Thank you — {cfg.contact} will be in touch. You can
          close this page.
        </p>
      </div>,
    )

  if (phase === 'intro' || (phase === 'submitting' && !exam))
    return shell(
      <>
        {deadline && (
          <div className="intake-deadline">
            ⏰ The exam window closes <strong>{deadline.display}</strong>.
          </div>
        )}

        {/* The briefing comes FIRST on the new-hire exam, above the form and
            above the Start button, and the clock has not started while it is
            being read. The operations section is comprehension of it. */}
        {program === 'neop' && <KcBriefing />}

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Before you begin</h2>
          <ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>
            {/* The number of questions is deliberately not given, here or in
                the progress bar. Knowing the total and the clock lets someone
                budget the slack for looking answers up; not knowing makes it a
                gamble against a timer they cannot see the end of. */}
            <li><strong>Multiple choice.</strong> Answer one question at a time; you can go back.</li>
            <li><strong>{cfg.limitMinutes}-minute time limit</strong> — a timer runs at the top; the exam submits automatically when it reaches zero.</li>
            <li><strong>One attempt.</strong> Once you start, the clock runs even if you close the page, so start when you're ready and undisturbed.</li>
            {program === 'neop' && (
              <li>
                <strong>Three parts:</strong> patient care, our operation, and what you want out of
                the job. The last part is <strong>not scored</strong> — it is there so your
                interview starts from something real.
              </li>
            )}
            <li>Answer on your own — this is part of your selection.</li>
          </ul>
          <div className="field">
            <label htmlFor="ex-name">Full name</label>
            <input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ex-email">Email</label>
            <input
              id="ex-email"
              type="email"
              placeholder={program === 'neop' ? 'you@example.com' : 'name@gmr.net'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <section className="attestation" aria-label="Integrity Statement">
            <div className="attestation-head">⚖️ Integrity Statement</div>
            <p className="attestation-lead">Read carefully. Starting this exam is your signed agreement to the following:</p>
            <ul className="attestation-list">
              {/* Rendered from the same strings that are hashed and stored with
                  the attempt — see attestationLines(). Two hand-kept copies of
                  this wording is a promise that they will differ eventually. */}
              {attestationLines(program).map((line, i) => (
                <li key={i}>{emphasise(line)}</li>
              ))}
            </ul>
            <label className="attestation-check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I have read, understand, and agree to this statement.</span>
            </label>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="ex-sign">Sign by typing your full name</label>
              <input
                id="ex-sign"
                autoComplete="off"
                placeholder="Type your full name to sign"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
              />
            </div>
          </section>

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

  // A section banner on the first question of each section. The three NEOP
  // sections are asking genuinely different things, and the preference section
  // in particular has to say so — an unscored question that looks like a scored
  // one invites a candidate to guess what we want to hear.
  const prev = index > 0 ? exam.questions[index - 1] : null
  const sect = q.section ? NEOP_SECTIONS.find((s) => s.id === q.section) : undefined
  const showSectionIntro = !!sect && (!prev || prev.section !== q.section)

  return shell(
    <>
      <div className="exam-bar">
        {/* The total is withheld on purpose — see the note on the intro copy.
            Position and answered count are still shown: they orient without
            revealing how much time is left to spend looking something up. */}
        <span className="exam-progress">
          Question {index + 1}
          <span className="subtle"> · {answeredCount} answered</span>
        </span>
        <span className={`exam-timer${lowTime ? ' low' : ''}`}>⏱ {fmtClock(remaining)}</span>
      </div>

      {showSectionIntro && sect && (
        <div className="exam-section-intro">
          <div className="sect-label">{sect.label}</div>
          <p>{sect.intro}</p>
        </div>
      )}

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
          <button
            className="btn primary"
            disabled={phase === 'submitting'}
            onClick={async () => {
              // One attempt, no undo. A mistaken tap should not be able to end
              // somebody's exam with questions still blank.
              const answered = Object.keys(answers).length
              const left = exam.questions.length - answered
              const ok = await confirmAction({
                title: 'Submit your exam?',
                body: left
                  ? `${left} question${left === 1 ? ' is' : 's are'} still unanswered. Once you submit you cannot return — this is a one-attempt exam.`
                  : 'All questions answered. Once you submit you cannot return — this is a one-attempt exam.',
                confirmLabel: 'Submit',
                danger: left > 0,
              })
              if (ok) void finish('manual')
            }}
          >
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
