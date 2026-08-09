import { useEffect, useMemo, useState } from 'react'
import {
  AEMT_FIELDS,
  answerText,
  deleteIntake,
  INTAKE_STATUSES,
  listIntake,
  setIntakeArchived,
  setIntakeStatus,
  STATUS_PILL,
  statusOf,
  type IntakeStatus,
  type IntakeSubmission,
} from '../../lib/intake'
import { buildIntakeEmail, COMMITMENT_PLACEHOLDER } from '../../data/intakeEmail'
import { Modal } from '../../components/ui'

// Review of AEMT intake submissions. The route is wrapped in <AemtOnly>, so
// only an admin reaches this screen; Supabase RLS is the real gate on the data
// itself (only an admin profile can select the table).

/**
 * The next-steps email for one candidate, generated from their own answers.
 *
 * Editable before it is copied: the generator gets it most of the way, but the
 * person sending it knows things the form never asked. Copying is the delivery
 * mechanism rather than a mailto link alone, because these go out from Outlook
 * where the signature and the sent-items record live.
 */
function EmailModal({ row, onClose }: { row: IntakeSubmission; onClose: () => void }) {
  const generated = useMemo(() => buildIntakeEmail(row), [row])
  const [body, setBody] = useState(generated.body)
  const [copied, setCopied] = useState<'subject' | 'body' | null>(null)
  const to = answerText(row.data.email)

  const copy = async (what: 'subject' | 'body', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      // Clipboard blocked — the text is on screen and selectable regardless.
    }
  }

  // Still carrying the placeholder means the commitment terms were never
  // filled in. Say so loudly: that paragraph is the contractual one.
  const unfilled = body.includes(COMMITMENT_PLACEHOLDER)

  return (
    <Modal title={`Email ${answerText(row.data.name)}`} onClose={onClose}>
      {unfilled && (
        <div className="banner crit">
          <strong>Not ready to send.</strong> The service commitment terms are still a placeholder.
          Replace the bracketed paragraph below, or set them once for every email in{' '}
          <code>data/intakeEmail.ts</code>.
        </div>
      )}

      <div className="field">
        <label>To</label>
        <input readOnly value={to} onFocus={(e) => e.currentTarget.select()} />
      </div>

      <div className="field">
        <label htmlFor="em-subj">Subject</label>
        <div className="field-row" style={{ alignItems: 'center' }}>
          <input id="em-subj" readOnly value={generated.subject} style={{ flex: 1 }} />
          <button className="btn" onClick={() => void copy('subject', generated.subject)}>
            {copied === 'subject' ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="em-body">Message — edit before sending if you need to</label>
        <textarea
          id="em-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={16}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }}
        />
      </div>

      <div className="btn-row">
        <button className="btn primary" onClick={() => void copy('body', body)}>
          {copied === 'body' ? 'Copied ✓' : '📋 Copy message'}
        </button>
        <a
          className="btn"
          href={`mailto:${to}?subject=${encodeURIComponent(generated.subject)}&body=${encodeURIComponent(body)}`}
        >
          ✉ Open in mail app
        </a>
        <button className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="help-text">
        Copy the message and paste it into Outlook so it goes out with your signature and lands in
        your sent items.
      </div>
    </Modal>
  )
}

type CommitFilter = 'all' | 'Yes' | 'Not sure yet' | 'No'
const COMMIT_FILTERS: { key: CommitFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Yes', label: 'Can commit' },
  { key: 'Not sure yet', label: 'Not sure' },
  { key: 'No', label: 'No' },
]

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function toCsv(rows: IntakeSubmission[]): string {
  const headers = ['Submitted', 'Status', ...AEMT_FIELDS.map((f) => f.label)]
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const lines = [headers.map(esc).join(',')]
  for (const r of rows) {
    const cells = [fmtDate(r.created_at), statusOf(r), ...AEMT_FIELDS.map((f) => answerText(r.data[f.key]))]
    lines.push(cells.map((c) => esc(String(c))).join(','))
  }
  // BOM so Excel opens UTF-8 cleanly, matching the app's other exports.
  return '﻿' + lines.join('\r\n')
}

function Row({ row, onChange }: { row: IntakeSubmission; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const name = answerText(row.data.name)
  const op = answerText(row.data.operation)
  const commit = answerText(row.data.canCommit)
  const status = statusOf(row)

  const commitPill =
    commit === 'Yes' ? 'ok' : commit === 'No' ? 'crit' : commit === 'Not sure yet' ? 'warn' : 'muted'

  const archive = async (archived: boolean) => {
    setBusy(true)
    await setIntakeArchived(row.id, archived)
    setBusy(false)
    onChange()
  }
  const changeStatus = async (next: IntakeStatus) => {
    if (next === status) return
    setBusy(true)
    const { error } = await setIntakeStatus(row.id, next)
    setBusy(false)
    if (error) {
      alert(
        `Couldn't update status: ${error}. If this mentions a missing "status" column, run the status migration in Supabase.`,
      )
      return
    }
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
        <span className="intake-row-pills">
          <span className={`pill ${STATUS_PILL[status] ?? 'muted'}`}>{status}</span>
          <span className={`pill ${commitPill}`}>Commit: {commit}</span>
        </span>
        <span className="subtle" aria-hidden style={{ fontSize: 18 }}>
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Status</label>
            <div className="choice-row" role="radiogroup" aria-label="Candidate status">
              {INTAKE_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  className={`choice${status === s ? ' active' : ''}`}
                  aria-pressed={status === s}
                  onClick={() => changeStatus(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
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
              <button className="btn sm primary" onClick={() => setEmailing(true)}>
                ✉ Next-steps email
              </button>
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

      {emailing && <EmailModal row={row} onClose={() => setEmailing(false)} />}
    </div>
  )
}

export default function IntakeResults() {
  const [rows, setRows] = useState<IntakeSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [commitFilter, setCommitFilter] = useState<CommitFilter>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | IntakeStatus>('all')
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

  // The can-commit filter applies within the current archived scope, so its
  // counts always match what's actually filterable on screen.
  const base = useMemo(() => rows.filter((r) => showArchived || !r.archived), [rows, showArchived])
  const counts = useMemo(() => {
    const c: Record<CommitFilter, number> = { all: base.length, Yes: 0, 'Not sure yet': 0, No: 0 }
    for (const r of base) {
      const v = answerText(r.data.canCommit)
      if (v === 'Yes' || v === 'Not sure yet' || v === 'No') c[v] += 1
    }
    return c
  }, [base])
  const statusCounts = useMemo(() => {
    const c = {} as Record<IntakeStatus, number>
    for (const s of INTAKE_STATUSES) c[s] = 0
    for (const r of base) c[statusOf(r)] += 1
    return c
  }, [base])
  const visible = useMemo(
    () =>
      base.filter(
        (r) =>
          (commitFilter === 'all' || answerText(r.data.canCommit) === commitFilter) &&
          (statusFilter === 'all' || statusOf(r) === statusFilter),
      ),
    [base, commitFilter, statusFilter],
  )
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

      <div className="segmented" role="tablist" aria-label="Filter by commitment" style={{ marginBottom: 10 }}>
        {COMMIT_FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={commitFilter === f.key}
            className={commitFilter === f.key ? 'active' : ''}
            onClick={() => setCommitFilter(f.key)}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      <div className="field-row" style={{ alignItems: 'center', marginBottom: 10, gap: 10 }}>
        <label htmlFor="status-filter" style={{ fontWeight: 700, fontSize: 13 }}>
          Status
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | IntakeStatus)}
          style={{ flex: 1 }}
        >
          <option value="all">All statuses ({base.length})</option>
          {INTAKE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s} ({statusCounts[s]})
            </option>
          ))}
        </select>
      </div>

      <label className="intake-consent" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        <span>Show archived</span>
      </label>

      {loading && <div className="subtle" style={{ padding: 12 }}>Loading…</div>}
      {error && <div className="banner crit">Couldn't load submissions: {error}</div>}
      {!loading && !error && visible.length === 0 && (
        <div className="banner info">
          {base.length === 0
            ? 'No submissions yet. Share the candidate link above to start collecting them.'
            : 'No submissions match this filter.'}
        </div>
      )}

      <div className="list" style={{ gap: 10 }}>
        {visible.map((row) => (
          <Row key={row.id} row={row} onChange={load} />
        ))}
      </div>
    </div>
  )
}
