import { useState } from 'react'
import { useSyncStatus } from '../../lib/sync'
import {
  AUTHORITY_TIERS,
  CE_NOTE_KS,
  CE_NOTE_MO,
  CE_NOTE_NREMT,
  CE_ROWS,
  DIRECTIONAL_RULE,
  NOMENCLATURE,
  REF_DOCS,
  REGULATORS,
  TRAPS,
  defaultView,
  inView,
  type View,
} from '../../data/emsReference'

// Curated Kansas / Missouri EMS regulatory reference. Static, offline, and
// verified against named statute/regulation — this is the "Browse" half of the
// planned expert tool, not a generated-answer bot. Jurisdiction follows the
// device's market by default (Wichita = Kansas; KC = bi-state).

const VIEWS: { id: View; label: string }[] = [
  { id: 'ks', label: 'Kansas' },
  { id: 'mo', label: 'Missouri' },
  { id: 'both', label: 'Both' },
]

export default function EmsReference() {
  const { market } = useSyncStatus()
  const [view, setView] = useState<View>(() => defaultView(market))

  const showKs = view === 'ks' || view === 'both'
  const showMo = view === 'mo' || view === 'both'
  const traps = TRAPS.filter((t) => inView(t.scope, view))
  const docs = REF_DOCS.filter((d) => inView(d.scope, view))
  const nomen = NOMENCLATURE.filter((n) => inView(n.scope, view))
  const regs = REGULATORS.filter((r) => inView(r.scope, view))

  return (
    <div>
      <style>{`
        .ref-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .ref-table th, .ref-table td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
        .ref-table th { background: var(--navy); color: var(--text-invert); font-weight: 600; }
      `}</style>
      <div className="page-head">
        <div>
          <h1>EMS Reference</h1>
          <div className="subtle">Kansas &amp; Missouri EMS law, scope, and regional plans — verified sources, works offline</div>
        </div>
      </div>

      <div className="banner crit" role="note">
        <strong>Reference only — not medical direction, not legal advice.</strong> Your agency's
        medical-director-approved protocol governs. A medical director may <strong>narrow</strong> but
        never <strong>expand</strong> state-authorized scope.
      </div>

      <div className="segmented" role="tablist" aria-label="Jurisdiction" style={{ margin: '12px 0' }}>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            className={view === v.id ? 'active' : ''}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Continuing education */}
      <div className="section-title">Continuing education (recertification)</div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="ref-table">
          <thead>
            <tr>
              <th>Level</th>
              {showKs && <th>Kansas</th>}
              {showMo && <th>Missouri</th>}
            </tr>
          </thead>
          <tbody>
            {CE_ROWS.map((r) => (
              <tr key={r.level}>
                <td style={{ fontWeight: 700 }}>{r.level}</td>
                {showKs && <td>{r.ks ?? '—'}</td>}
                {showMo && <td>{r.mo ?? '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {showKs && <p className="help-text" style={{ marginBottom: 4 }}>{CE_NOTE_KS}</p>}
        {showMo && <p className="help-text" style={{ marginBottom: 4 }}>{CE_NOTE_MO}</p>}
        <div className="banner warn" style={{ marginTop: 8 }}>{CE_NOTE_NREMT}</div>
      </div>

      {/* Levels & nomenclature */}
      {nomen.length > 0 && (
        <>
          <div className="section-title">Provider levels &amp; nomenclature</div>
          <div className="card">
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.55 }}>
              {nomen.map((n) => (
                <li key={n.note} style={{ marginBottom: 6 }}>{n.note}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Conflicts & traps */}
      <div className="section-title">Known conflicts &amp; traps</div>
      <div className="help-text" style={{ marginTop: 0 }}>
        The questions most often answered wrong. Each traces to the controlling source.
      </div>
      <div className="list" style={{ gap: 10 }}>
        {traps.map((t) => (
          <div key={t.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15 }}>{t.title}</strong>
              <span className={`pill ${t.scope === 'ks' ? 'info' : t.scope === 'mo' ? 'warn' : 'muted'}`}>
                {t.scope === 'ks' ? 'Kansas' : t.scope === 'mo' ? 'Missouri' : 'Bi-state'}
              </span>
            </div>
            <p style={{ margin: '6px 0 8px', lineHeight: 1.5 }}>{t.body}</p>
            <div className="subtle" style={{ fontSize: 12.5 }}>📖 {t.cite}</div>
          </div>
        ))}
      </div>

      {/* Authority hierarchy */}
      <div className="section-title">Authority hierarchy</div>
      <div className="card">
        <p className="help-text" style={{ marginTop: 0 }}>
          When sources disagree, higher tier wins. A local or national standard never outranks state
          statute or regulation on what a clinician is legally permitted to do.
        </p>
        <div className="list" style={{ gap: 6 }}>
          {AUTHORITY_TIERS.map((t) => (
            <div key={t.tier} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <span className="pill info" style={{ flex: 'none' }}>Tier {t.tier}</span>
              <span className="grow">
                <span style={{ fontWeight: 650 }}>{t.label}</span>
                <span className="subtle" style={{ display: 'block', fontSize: 12.5 }}>{t.examples}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="banner info" style={{ marginTop: 10 }}>{DIRECTIONAL_RULE}</div>
      </div>

      {/* Browse the sources */}
      <div className="section-title">Browse the sources</div>
      <div className="help-text" style={{ marginTop: 0 }}>Tap a source to see key sections, then open the canonical text.</div>
      <div className="list" style={{ gap: 8 }}>
        {docs.map((d) => (
          <details key={d.code} className="card" style={{ padding: 0 }}>
            <summary style={{ cursor: 'pointer', padding: 14, fontWeight: 700, listStyle: 'none' }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span>{d.code}</span>
                <span className="pill muted" style={{ fontWeight: 600 }}>Tier {d.tier}</span>
              </span>
              <span className="subtle" style={{ display: 'block', fontWeight: 400, fontSize: 13 }}>{d.title}</span>
            </summary>
            <div style={{ padding: '0 14px 14px' }}>
              {d.sections && (
                <ul style={{ margin: '0 0 10px', paddingLeft: 18, lineHeight: 1.5, fontSize: 13.5 }}>
                  {d.sections.map((s) => (
                    <li key={s.cite} style={{ marginBottom: 4 }}>
                      <strong>{s.cite}</strong> — {s.subject}
                    </li>
                  ))}
                </ul>
              )}
              <a href={d.url} target="_blank" rel="noreferrer" className="btn sm">Open source ↗</a>
            </div>
          </details>
        ))}
      </div>

      {/* Regulators */}
      <div className="section-title">Regulators &amp; contacts</div>
      <div className="list" style={{ gap: 8 }}>
        {regs.map((r) => (
          <div key={r.name} className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 700 }}>{r.name}</div>
            <div className="subtle" style={{ fontSize: 13, margin: '2px 0 6px' }}>{r.detail}</div>
            <div className="btn-row">
              {r.phone && <a className="btn sm" href={`tel:${r.phone.replace(/[^\d]/g, '')}`}>☎ {r.phone}</a>}
              <a className="btn sm" href={r.url} target="_blank" rel="noreferrer">Website ↗</a>
            </div>
          </div>
        ))}
      </div>

      <div className="help-text" style={{ marginTop: 18, textAlign: 'center' }}>
        Curated from Kansas &amp; Missouri statute and regulation. Confirm against the canonical source
        for anything you'll act on — Kansas rules change often, and the Register is authoritative.
      </div>
    </div>
  )
}
