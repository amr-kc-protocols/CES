import { useState } from 'react'
import { SOURCE_BY_ID, AUTHORITY_LABEL, VERIFICATION_LABEL } from '../../data/docAcademy/sources'
import type { Source } from '../../data/docAcademy/types'

// The source drawer. Every lesson section, rationale and case issue shows what
// it rests on and what kind of authority that is — a federal rule and this
// course's own recommendation are never presented as the same thing.

export function verificationPill(s: Source) {
  const cls = s.verification === 'reviewed' ? 'ok' : s.verification === 'local_pending' ? 'crit' : 'warn'
  return <span className={`pill ${cls}`}>{VERIFICATION_LABEL[s.verification]}</span>
}

export function SourceDetail({ s }: { s: Source }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="grow">
        <div className="title" style={{ fontSize: 14 }}>
          {s.id} · {s.title}
        </div>
        <div className="meta">
          {AUTHORITY_LABEL[s.authority]} · {s.publisher}
          {s.jurisdiction ? ` · ${s.jurisdiction}` : ''}
          {s.locator ? ` · ${s.locator}` : ''}
        </div>
        <div className="meta">
          Checked {s.checkedOn}
          {s.effectiveDate ? ` · revision ${s.effectiveDate}` : ''} · owner: {s.owner} · next review {s.nextReviewOn}
        </div>
        {s.note && (
          <div className="meta" style={{ marginTop: 4 }}>
            {s.note}
          </div>
        )}
        {s.url && (
          <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
            Open source ↗
          </a>
        )}
      </div>
      {verificationPill(s)}
    </div>
  )
}

export default function SourceChips({ ids }: { ids: string[] }) {
  const [open, setOpen] = useState(false)
  const sources = ids.map((id) => SOURCE_BY_ID[id]).filter(Boolean)
  if (!sources.length) return null
  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        className="btn ghost sm"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ paddingLeft: 0 }}
      >
        Sources: {sources.map((s) => `${s.id} (${AUTHORITY_LABEL[s.authority]})`).join(', ')} {open ? '−' : '+'}
      </button>
      {open && (
        <div className="list" style={{ gap: 6, marginTop: 6 }}>
          {sources.map((s) => (
            <SourceDetail key={s.id} s={s} />
          ))}
        </div>
      )}
    </div>
  )
}
