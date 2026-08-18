import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  attemptExpired,
  examConfig,
  examDeadline,
  isSetupError,
  listExamBank,
  SETUP_INSTRUCTIONS,
  listExamResults,
  listUnfinishedAttempts,
  resetAttempt,
  type BankRow,
  type ExamAttempt,
  type ExamProgram,
  type UnfinishedAttempt,
} from '../../lib/exam'
import {
  FIT_BY_CODE,
  NEOP_SECTIONS,
  NEOP_THRESHOLDS,
  SIGNAL_LABEL,
  SIGNAL_TONE,
  TALLY_NOTE,
  type FitSignal,
} from '../../data/neopSelection'
import { confirmAction, notifyUser } from '../../lib/dialog'
import TestQuality from './TestQuality'

// Admin review of selection exam results, for either program. RLS is the real
// gate (only an admin profile can read exam_attempts); the routes wrap this in
// the matching screen gate. Ranked by score.
//
// The NEOP exam is read differently from the AEMT one, and the screen has to
// reflect that rather than showing one percentage for all of it:
//
//   - Its scored half is two sections with separate floors. A strong clinician
//     who understood nothing about the operation is the specific hire this
//     instrument exists to catch, and a blended percentage hides exactly that
//     candidate.
//   - Its preference section is unscored, and is the reason the exam is worth
//     sitting: it is a set of answers to take into the interview, printed
//     beside the probe to ask next. Nothing here rejects anybody.

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** One candidate's exam, broken down against the bank they were served. */
interface Breakdown {
  clinical: { right: number; of: number }
  operations: { right: number; of: number }
  fit: { code: string; stem: string; chosen: string | null; signal: FitSignal }[]
}

function breakdown(a: ExamAttempt, bank: Map<number, BankRow>): Breakdown | null {
  if (!a.question_ids?.length) return null
  const out: Breakdown = { clinical: { right: 0, of: 0 }, operations: { right: 0, of: 0 }, fit: [] }
  for (const id of a.question_ids) {
    const q = bank.get(id)
    if (!q) continue
    const chosen = a.responses?.[String(id)]
    if (q.section === 'fit') {
      const spec = q.code ? FIT_BY_CODE.get(q.code) : undefined
      out.fit.push({
        code: q.code ?? String(id),
        stem: q.stem,
        chosen: chosen === undefined ? null : q.options[chosen] ?? null,
        signal: (chosen !== undefined && spec?.signals[chosen]) || 'neutral',
      })
    } else if (q.section === 'clinical' || q.section === 'operations') {
      const bucket = out[q.section]
      bucket.of++
      if (chosen !== undefined && chosen === q.answer) bucket.right++
    }
  }
  return out
}

const pct = (right: number, of: number) => (of ? Math.round((right / of) * 100) : null)

/**
 * The pattern across the preference section, which is the only level at which
 * it means anything.
 *
 * Every option in that section is a defensible answer, so one lean is noise.
 * Presenting a count rather than a verdict is the honest rendering of what the
 * instrument can actually support — and it is also the useful one, because what
 * an interviewer wants to know walking into the room is whether there is a
 * theme worth opening up, not which of thirteen boxes was ticked.
 */
function tally(fit: Breakdown['fit']): Record<FitSignal, number> {
  const t: Record<FitSignal, number> = { consistent: 0, discuss: 0, neutral: 0 }
  for (const f of fit) t[f.signal]++
  return t
}

function toCsv(rows: ExamAttempt[], bank: Map<number, BankRow>, program: ExamProgram): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const neop = program === 'neop'
  const fitCodes = neop ? [...FIT_BY_CODE.keys()] : []
  const header = [
    'Rank', 'Name', 'Email', 'Score', 'Total', 'Percent',
    ...(neop ? ['Clinical %', 'Operations %'] : []),
    'Submitted',
    ...fitCodes.map((c) => `Pref: ${FIT_BY_CODE.get(c)?.theme ?? c}`),
  ]
  const lines = [header.map(esc).join(',')]
  rows.forEach((r, i) => {
    const b = neop ? breakdown(r, bank) : null
    const cells = [
      String(i + 1),
      r.name,
      r.email,
      String(r.score ?? ''),
      String(r.total),
      r.percent == null ? '' : String(r.percent),
      ...(neop
        ? [
            b ? String(pct(b.clinical.right, b.clinical.of) ?? '') : '',
            b ? String(pct(b.operations.right, b.operations.of) ?? '') : '',
          ]
        : []),
      fmtDate(r.submitted_at),
      ...fitCodes.map((c) => b?.fit.find((f) => f.code === c)?.chosen ?? ''),
    ]
    lines.push(cells.map((c) => esc(String(c))).join(','))
  })
  return '﻿' + lines.join('\r\n')
}

export default function ExamResults({ program = 'aemt' }: { program?: ExamProgram }) {
  const cfg = examConfig(program)
  const deadline = examDeadline(program)
  const neop = program === 'neop'

  const [rows, setRows] = useState<ExamAttempt[]>([])
  const [unfinished, setUnfinished] = useState<UnfinishedAttempt[]>([])
  const [bank, setBank] = useState<Map<number, BankRow>>(new Map())
  const [open, setOpen] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const shareUrl = `${window.location.origin}${cfg.path}`

  const load = async () => {
    setLoading(true)
    setError(null)
    const [done, openAttempts, bk] = await Promise.all([
      listExamResults(program),
      listUnfinishedAttempts(program),
      // The section breakdown and the preference answers are computed against
      // the bank the candidate was actually served, not against a copy of the
      // questions in the app. The AEMT screen has never needed it.
      neop ? listExamBank(program) : Promise.resolve({ rows: [] as BankRow[] }),
    ])
    // The SQL for this exam is run by hand against the project, and until it
    // has been, every read here fails on a missing column or function. That is
    // a setup step nobody has done yet, not an error — and saying so with the
    // file name is the difference between a five-minute fix and an afternoon.
    setNeedsSetup(
      [done, openAttempts].some((r) => 'error' in r && isSetupError({ message: r.error ?? '' })),
    )
    if (done.error) setError(done.error)
    else setRows(done.rows ?? [])
    if (!done.error && openAttempts.error) setError(openAttempts.error)
    else if (!openAttempts.error) setUnfinished(openAttempts.rows ?? [])
    if (!('error' in bk) || !bk.error) setBank(new Map((bk.rows ?? []).map((q) => [q.id, q])))
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program])

  const breakdowns = useMemo(() => {
    const m = new Map<string, Breakdown | null>()
    if (neop) for (const r of rows) m.set(r.id, breakdown(r, bank))
    return m
  }, [rows, bank, neop])

  /** Void an attempt. `scored` names the result being set aside, if any. */
  const reset = async (id: string, who: string, scored?: string) => {
    const ok = await confirmAction({
      title: `Reset ${who}?`,
      body: scored
        ? `Their completed result (${scored}) stops counting and they can sit the exam again with a fresh set of questions. The attempt is kept on record — including their signed integrity statement and who reset it — rather than deleted.`
        : `Their unfinished attempt stops counting and they can start over with a fresh set of questions and a full clock. The attempt is kept on record rather than deleted.`,
      confirmLabel: 'Reset attempt',
      danger: true,
    })
    if (!ok) return
    setBusy(id)
    const { error: err } = await resetAttempt(id)
    setBusy(null)
    if (err) {
      notifyUser(`Couldn't reset: ${err}`, 'crit')
      return
    }
    notifyUser(`${who} can now retake the exam.`, 'info')
    void load()
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* link is shown below regardless */
    }
  }

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows, bank, program)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${program}-exam-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const pill = (p: number | null) =>
    p == null ? 'muted' : p >= 80 ? 'ok' : p >= 70 ? 'info' : p >= 60 ? 'warn' : 'crit'

  const sectionPill = (p: number | null, floor: number) =>
    p == null ? 'muted' : p >= floor ? 'ok' : 'crit'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{neop ? 'New hire selection exam' : 'AEMT Exam'}</h1>
          <div className="subtle">
            {rows.length} completed · ranked by score
            {neop && ' · the preference section is not scored'}
          </div>
        </div>
        <div className="btn-row">
          <Link to={neop ? '/academy/exam-bank' : '/aemt/exam-bank'} className="btn sm">
            📋 Review the bank
          </Link>
          <button className="btn sm" onClick={() => void load()}>↻ Refresh</button>
          <button className="btn sm" onClick={exportCsv} disabled={rows.length === 0}>⬇ CSV</button>
        </div>
      </div>

      {neop && (
        <div className="banner info">
          Three sections. <strong>Patient care</strong> and <strong>our operation</strong> are
          scored, with floors of {NEOP_THRESHOLDS.clinical}% and {NEOP_THRESHOLDS.operations}%.
          The <strong>preference</strong> answers are not scored and are not a reason to decline
          anybody — they are there so the interview starts from something the candidate has
          already put on the record. Open a candidate to see them with the question to ask next.
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title" style={{ marginTop: 0 }}>Exam link</div>
        <p className="subtle" style={{ marginTop: 0 }}>
          Share with candidates — one attempt each, no sign-in.{' '}
          {deadline ? `Closes ${deadline.display}.` : 'No closing date — hiring is rolling.'}
          {neop && ' The job briefing is on the same page, above the Start button, and reading it is untimed.'}
        </p>
        <div className="field-row" style={{ alignItems: 'center' }}>
          <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1 }} />
          <button className="btn" onClick={copyLink}>{copied ? 'Copied ✓' : 'Copy'}</button>
        </div>
      </div>

      {/* Unfinished sittings. Shown above the results because this is the part
          that needs a decision — a candidate here is locked out until reset. */}
      {unfinished.length > 0 && (
        <>
          <div className="section-title">Unfinished attempts</div>
          <div className="help-text" style={{ marginTop: 0 }}>
            Started but never submitted. A candidate whose time ran out cannot start again until
            you reset them.
          </div>
          <div className="list" style={{ gap: 8 }}>
            {unfinished.map((a) => {
              const out = attemptExpired(a)
              return (
                <div key={a.id} className="card" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="grow" style={{ minWidth: 180 }}>
                      <span style={{ display: 'block', fontWeight: 650 }}>{a.name}</span>
                      <span className="subtle" style={{ fontSize: 12 }}>
                        {a.email} · started {fmtDate(a.started_at)}
                      </span>
                    </span>
                    <span className={`pill ${out ? 'crit' : 'warn'}`}>
                      {out ? 'Time expired' : 'In progress'}
                    </span>
                    <button
                      className="btn sm danger"
                      disabled={busy === a.id}
                      onClick={() => void reset(a.id, a.name)}
                    >
                      {busy === a.id ? 'Resetting…' : 'Reset'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {loading && <div className="subtle" style={{ padding: 12 }}>Loading…</div>}
      {needsSetup && (
        <div className="banner warn">
          <strong>Not installed on this project yet.</strong> {SETUP_INSTRUCTIONS}
          <br />
          <br />
          Until then a candidate opening the link is told the exam is temporarily
          unavailable and to contact {cfg.contact} — they are not shown a database error.
        </div>
      )}
      {error && !needsSetup && <div className="banner crit">Couldn't load results: {error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="banner info">No completed exams yet. Share the link above.</div>
      )}

      {rows.length > 0 && !neop && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="exam-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Candidate</th>
                <th style={{ textAlign: 'right' }}>Score</th>
                <th style={{ textAlign: 'right' }}>%</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 650 }}>{r.name}</div>
                    <div className="subtle" style={{ fontSize: 12 }}>{r.email}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {r.score ?? '—'}/{r.total}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`pill ${pill(r.percent)}`}>{r.percent == null ? '—' : `${r.percent}%`}</span>
                  </td>
                  <td className="subtle" style={{ fontSize: 12 }}>{fmtDate(r.submitted_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn sm ghost"
                      disabled={busy === r.id}
                      onClick={() =>
                        void reset(r.id, r.name, `${r.score ?? '—'}/${r.total}`)
                      }
                    >
                      {busy === r.id ? '…' : 'Reset'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && neop && (
        <div className="list" style={{ gap: 10 }}>
          {rows.map((r, i) => {
            const b = breakdowns.get(r.id) ?? null
            const clin = b ? pct(b.clinical.right, b.clinical.of) : null
            const ops = b ? pct(b.operations.right, b.operations.of) : null
            const isOpen = open === r.id
            return (
              <div key={r.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="grow" style={{ minWidth: 180 }}>
                    <span style={{ display: 'block', fontWeight: 650 }}>
                      {i + 1}. {r.name}
                    </span>
                    <span className="subtle" style={{ fontSize: 12 }}>
                      {r.email} · {fmtDate(r.submitted_at)}
                    </span>
                  </span>
                  <span className={`pill ${pill(r.percent)}`}>
                    {r.percent == null ? '—' : `${r.percent}%`} overall
                  </span>
                  <span className={`pill ${sectionPill(clin, NEOP_THRESHOLDS.clinical)}`}>
                    Care {clin == null ? '—' : `${clin}%`}
                  </span>
                  <span className={`pill ${sectionPill(ops, NEOP_THRESHOLDS.operations)}`}>
                    Operation {ops == null ? '—' : `${ops}%`}
                  </span>
                  <button className="btn sm" onClick={() => setOpen(isOpen ? null : r.id)}>
                    {isOpen ? 'Hide' : 'Interview notes'}
                  </button>
                  <button
                    className="btn sm ghost"
                    disabled={busy === r.id}
                    onClick={() => void reset(r.id, r.name, `${r.score ?? '—'}/${r.total}`)}
                  >
                    {busy === r.id ? '…' : 'Reset'}
                  </button>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 12 }}>
                    <div className="help-text" style={{ marginTop: 0 }}>
                      {b?.clinical.of ?? 0} patient-care and {b?.operations.of ?? 0} operations
                      items scored ({r.score ?? '—'}/{r.total}). Everything below is unscored.
                      Ask the probe whatever they answered — the answer is the opening, not the
                      finding.
                    </div>
                    {(b?.fit ?? []).length > 0 && (
                      <div className="fit-tally">
                        <div className="fit-tally-row">
                          {(['consistent', 'discuss', 'neutral'] as FitSignal[]).map((sig) => {
                            const n = tally(b?.fit ?? [])[sig]
                            return (
                              <span key={sig} className={`pill ${SIGNAL_TONE[sig]}`}>
                                {n} · {SIGNAL_LABEL[sig]}
                              </span>
                            )
                          })}
                        </div>
                        <p>{TALLY_NOTE}</p>
                      </div>
                    )}
                    {(b?.fit ?? []).map((f) => {
                      const spec = FIT_BY_CODE.get(f.code)
                      return (
                        <div key={f.code} className="fit-answer">
                          <div className="fit-q">{f.stem}</div>
                          <div className="fit-a">
                            <span className={`pill ${SIGNAL_TONE[f.signal]}`}>
                              {SIGNAL_LABEL[f.signal]}
                            </span>{' '}
                            {f.chosen ?? <span className="subtle">no answer</span>}
                          </div>
                          {spec && <div className="fit-probe">Ask: “{spec.probe}”</div>}
                        </div>
                      )
                    })}
                    {(b?.fit ?? []).length === 0 && (
                      <div className="subtle">
                        No preference answers recorded for this attempt.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {neop && (
        <p className="help-text">
          Sections and floors are set in <code>src/data/neopSelection.ts</code>; the briefing the
          operations questions come from is <code>src/data/kcOperation.ts</code>. Both are read by{' '}
          <code>npm run check:neop</code>, which will not let an operations item ask about
          something the briefing never told the candidate.{' '}
          {NEOP_SECTIONS.find((s) => s.id === 'fit')?.draw === null &&
            'Every candidate is served every preference item, so two candidates can be compared on them.'}
        </p>
      )}

      <TestQuality program={program} />
    </div>
  )
}
