import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  attemptExpired,
  listExamResults,
  listUnfinishedAttempts,
  resetAttempt,
  type ExamAttempt,
  type UnfinishedAttempt,
} from '../../lib/exam'
import { confirmAction, notifyUser } from '../../lib/dialog'
import TestQuality from './TestQuality'

// Admin review of AEMT exam results. Route is wrapped in <AemtOnly>; RLS is the
// real gate (only an admin profile can read exam_attempts). Ranked by score.

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function toCsv(rows: ExamAttempt[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const header = ['Rank', 'Name', 'Email', 'Score', 'Total', 'Percent', 'Submitted']
  const lines = [header.map(esc).join(',')]
  rows.forEach((r, i) => {
    const cells = [
      String(i + 1),
      r.name,
      r.email,
      String(r.score ?? ''),
      String(r.total),
      r.percent == null ? '' : String(r.percent),
      fmtDate(r.submitted_at),
    ]
    lines.push(cells.map((c) => esc(String(c))).join(','))
  })
  return '﻿' + lines.join('\r\n')
}

export default function ExamResults() {
  const [rows, setRows] = useState<ExamAttempt[]>([])
  const [unfinished, setUnfinished] = useState<UnfinishedAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const shareUrl = `${window.location.origin}/exam`

  const load = async () => {
    setLoading(true)
    setError(null)
    const [done, open] = await Promise.all([listExamResults(), listUnfinishedAttempts()])
    if (done.error) setError(done.error)
    else setRows(done.rows ?? [])
    if (!done.error && open.error) setError(open.error)
    else if (!open.error) setUnfinished(open.rows ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  /** Clear an attempt. `scored` names what is being destroyed, if anything. */
  const reset = async (id: string, who: string, scored?: string) => {
    const ok = await confirmAction({
      title: `Reset ${who}?`,
      body: scored
        ? `This permanently deletes their completed result (${scored}) and lets them sit the exam again with a fresh set of questions. This cannot be undone.`
        : `This clears their unfinished attempt so they can start over with a fresh set of questions and a full clock. Their current answers, if any, are discarded.`,
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
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `aemt-exam-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const pill = (pct: number | null) =>
    pct == null ? 'muted' : pct >= 80 ? 'ok' : pct >= 70 ? 'info' : pct >= 60 ? 'warn' : 'crit'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>AEMT Exam</h1>
          <div className="subtle">
            {rows.length} completed{rows.length === 1 ? '' : ''} · ranked by score
          </div>
        </div>
        <div className="btn-row">
          <Link to="/aemt/exam-bank" className="btn sm">📋 Review the bank</Link>
          <button className="btn sm" onClick={() => void load()}>↻ Refresh</button>
          <button className="btn sm" onClick={exportCsv} disabled={rows.length === 0}>⬇ CSV</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title" style={{ marginTop: 0 }}>Exam link</div>
        <p className="subtle" style={{ marginTop: 0 }}>
          Share with candidates — one attempt each, closes Aug 17 at 5 PM Central. No sign-in.
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
      {error && <div className="banner crit">Couldn't load results: {error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="banner info">No completed exams yet. Share the link above.</div>
      )}

      {rows.length > 0 && (
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

      <TestQuality />
    </div>
  )
}
