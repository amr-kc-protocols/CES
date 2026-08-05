import { useEffect, useState } from 'react'
import { listExamResults, type ExamAttempt } from '../../lib/exam'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const shareUrl = `${window.location.origin}/exam`

  const load = async () => {
    setLoading(true)
    setError(null)
    const { rows: r, error: err } = await listExamResults()
    if (err) setError(err)
    else setRows(r ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
