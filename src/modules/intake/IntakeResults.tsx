import { useEffect, useMemo, useState } from 'react'
import {
  AEMT_FIELDS,
  answerText,
  deleteIntake,
  listIntake,
  setIntakeArchived,
  type IntakeSubmission,
} from '../../lib/intake'

// Review of AEMT intake submissions. The route is wrapped in <AemtOnly>, so
// only an admin reaches this screen; Supabase RLS is the real gate on the data
// itself (only an admin profile can select the table).

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function toCsv(rows: IntakeSubmission[]): string {
  const headers = ['Submitted', ...AEMT_FIELDS.map((f) => f.label)]
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const lines = [headers.map(esc).join(',')]
  for (const r of rows) {
    const cells = [fmtDate(r.created_at), ...AEMT_FIELDS.map((f) => answerText(r.data[f.key]))]
    lines.push(cells.map((c) => esc(String(c))).join(','))
  }
  // BOM so Excel opens UTF-8 cleanly, matching the app's other exports.
  return '﻿' + lines.join('\r\n')
}

function Row({ row, onChange }: { row: IntakeSubmission; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const name = answerText(row.data.name)
  const op = answerText(row.data.operation)
  const commit = answerText(row.data.canCommit)

  const commitPill =
    commit === 'Yes' ? 'ok' : commit === 'No' ? 'crit' : commit === 'Not sure yet' ? 'warn' : 'muted'

  const archive = async (archived: boolean) => {
    setBusy(true)
    await setIntakeArchived(row.id, archived)
    setBusy(false)
    onChange()
  }
  const remove = async () => {
    if (!confirm(`Delete ${name}'s submission? This can't be undone.`)) return
    setBusy(true)
    await deleteIntake(row.id)
    setBusy(false)
    onChange()
  }

  return (
    <div className="card" style={{ padding: 0, opacity: row.archived ? 0.6 : 1 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          width: '100%',
          padding: 14,
          background: 'none',
          border: 0,
          textAlign: 'left',
          font: 'inherit',
        }}
      >
        <span className="grow">
          <span style={{ display: 'block', fontWeight: 700 }}>{name}</span>
          <span className="subtle" style={{ fontSize: 12 }}>
            {op} · {fmtDate(row.created_at)}
          </span>
        </span>
        <span className={`pill ${commitPill}`}>Commit: {commit}</span>
        <span className="subtle" aria-hidden style={{ fontSize: 18 }}>
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          <dl className="intake-answers">
            {AEMT_FIELDS.map((f) => (
              <div key={f.key} className="intake-answer">
                <dt>{f.label}</dt>
                <dd>{answerText(row.data[f.key])}</dd>
              </div>
            ))}
          </dl>
          <div className="btn-row" style={{ marginTop: 10 }}>
            {answerText(row.data.email) !== '—' && (
              <a className="btn sm" href={`mailto:${answerText(row.data.email)}`}>
                ✉ Email
              </a>
            )}
            {answerText(row.data.phone) !== '—' && (
              <a className="btn sm" href={`tel:${String(row.data.phone).replace(/[^\d+]/g, '')}`}>
                ☎ Call
              </a>
            )}
            <button className="btn sm ghost" disabled={busy} onClick={() => archive(!row.archived)}>
              {row.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button className="btn sm danger" disabled={busy} onClick={remove}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function IntakeResults() {
  const [rows, setRows] = useState<IntakeSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = `${window.location.origin}/intake`

  const load = async () => {
    setLoading(true)
    setError(null)
    const { rows: r, error: err } = await listIntake()
    if (err) setError(err)
    else setRows(r ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const visible = useMemo(() => rows.filter((r) => showArchived || !r.archived), [rows, showArchived])
  const activeCount = rows.filter((r) => !r.archived).length

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked — the link is shown below regardless */
    }
  }

  const exportCsv = () => {
    const blob = new Blob([toCsv(visible)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `aemt-intake-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>AEMT Intake</h1>
          <div className="subtle">{activeCount} active submission{activeCount === 1 ? '' : 's'}</div>
        </div>
        <div className="btn-row">
          <button className="btn sm" onClick={() => void load()}>↻ Refresh</button>
          <button className="btn sm" onClick={exportCsv} disabled={visible.length === 0}>⬇ CSV</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title" style={{ marginTop: 0 }}>Candidate link</div>
        <p className="subtle" style={{ marginTop: 0 }}>
          Share this with candidates — it opens the intake form, no sign-in required.
        </p>
        <div className="field-row" style={{ alignItems: 'center' }}>
          <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1 }} />
          <button className="btn" onClick={copyLink}>{copied ? 'Copied ✓' : 'Copy'}</button>
        </div>
      </div>

      <label className="intake-consent" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        <span>Show archived</span>
      </label>

      {loading && <div className="subtle" style={{ padding: 12 }}>Loading…</div>}
      {error && <div className="banner crit">Couldn't load submissions: {error}</div>}
      {!loading && !error && visible.length === 0 && (
        <div className="banner info">No submissions yet. Share the candidate link above to start collecting them.</div>
      )}

      <div className="list" style={{ gap: 10 }}>
        {visible.map((row) => (
          <Row key={row.id} row={row} onChange={load} />
        ))}
      </div>
    </div>
  )
}
