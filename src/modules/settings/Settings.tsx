import { useRef, useState } from 'react'
import { useDB, setState, exportDB, importDB, resetDB } from '../../lib/store'
import { QA_ENABLED } from '../../config/features'
import { formatDateTime } from '../../lib/date'
import {
  getCloudConfig,
  reconnectWithConfig,
  setCloudConfig,
  signInWithEmail,
  signOut,
  syncNow,
  pushAllLocalData,
  useSyncStatus,
} from '../../lib/sync'

function CloudSyncCard() {
  const status = useSyncStatus()
  const existing = getCloudConfig()
  const [url, setUrl] = useState(existing?.url ?? '')
  const [anonKey, setAnonKey] = useState(existing?.anonKey ?? '')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')

  const note = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 5000)
  }

  async function saveConfig() {
    if (!url.trim() || !anonKey.trim()) return note('Both the project URL and anon key are needed.')
    await reconnectWithConfig({ url: url.trim().replace(/\/+$/, ''), anonKey: anonKey.trim() })
    note('Project saved — now sign in below.')
  }

  async function sendLink() {
    if (!email.trim()) return note('Enter your email first.')
    const { error } = await signInWithEmail(email.trim())
    note(error ? `Sign-in failed: ${error}` : 'Magic link sent — check your email and tap the link.')
  }

  return (
    <div className="card">
      <p className="subtle" style={{ marginTop: 0 }}>
        Share data across devices and users through a Supabase project. Setup guide:{' '}
        <code>supabase/README.md</code> in the repo (create project → run <code>schema.sql</code> →
        paste URL &amp; key here). Everything keeps working offline; changes queue and sync when
        connected.
      </p>

      {msg && <div className="banner info">{msg}</div>}
      {status.error && <div className="banner crit">{status.error}</div>}

      {!status.signedIn ? (
        <>
          <div className="field">
            <label>Supabase project URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
          </div>
          <div className="field">
            <label>Anon (public) key</label>
            <input value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJ…" />
            <div className="help-text">
              Dashboard → Settings → API. The anon key is safe to store here — row-level security
              does the real gatekeeping.
            </div>
          </div>
          <div className="btn-row" style={{ marginBottom: 12 }}>
            <button className="btn" onClick={saveConfig}>
              Save project
            </button>
          </div>
          {status.configured && (
            <div className="field">
              <label>Sign in (magic link)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmr.net" />
                <button className="btn primary" onClick={sendLink} style={{ whiteSpace: 'nowrap' }}>
                  Send link
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <span className="pill ok">● Synced as {status.email}</span>
            {status.syncing && <span className="pill info">Syncing…</span>}
            {status.pending > 0 && <span className="pill warn">{status.pending} queued</span>}
            {status.lastSync && (
              <span className="subtle" style={{ fontSize: 12 }}>
                Last sync {formatDateTime(status.lastSync)}
              </span>
            )}
          </div>
          <div className="btn-row">
            <button className="btn" onClick={() => void syncNow()}>
              ⟳ Sync now
            </button>
            <button
              className="btn"
              title="Seed the cloud with everything on this device — use once after setup"
              onClick={async () => {
                await pushAllLocalData()
                note('Local data pushed to the cloud.')
              }}
            >
              ⬆ Push local data to cloud
            </button>
            <div className="spacer" />
            <button
              className="btn ghost"
              onClick={async () => {
                await signOut()
                note('Signed out. Sync is paused; local data is untouched.')
              }}
            >
              Sign out
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setCloudConfig(null)
                note('Cloud config removed from this device.')
              }}
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function Settings() {
  const db = useDB()
  const [reviewer, setReviewer] = useState(db.settings.reviewer)
  const [pct, setPct] = useState(String(Math.round(db.settings.samplePercent * 100)))
  const [cbUrl, setCbUrl] = useState(db.settings.classBuilderUrl)
  const [botUrl, setBotUrl] = useState(db.settings.botUrl)
  const [saved, setSaved] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function saveSettings() {
    const p = Math.min(100, Math.max(1, Number(pct) || 20)) / 100
    setState((d) => ({
      ...d,
      settings: {
        ...d.settings,
        reviewer: reviewer.trim(),
        samplePercent: p,
        classBuilderUrl: cbUrl.trim(),
        botUrl: botUrl.trim().replace(/\/+$/, ''),
      },
    }))
    setSaved('Settings saved.')
    setTimeout(() => setSaved(''), 2000)
  }

  function doExport() {
    const blob = new Blob([exportDB()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ces-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      importDB(await file.text())
      setSaved('Data imported.')
    } catch {
      setSaved('Import failed — not a valid backup file.')
    }
    if (fileRef.current) fileRef.current.value = ''
    setTimeout(() => setSaved(''), 2500)
  }

  return (
    <div>
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      {saved && <div className="banner info">{saved}</div>}

      <div className="section-title">{QA_ENABLED ? 'Review defaults' : 'Defaults'}</div>
      <div className="card">
        {/* QA-only settings stay hidden while the QA function is feature-flagged off. */}
        {QA_ENABLED && (
          <>
            <div className="field">
              <label>Reviewer name</label>
              <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Used to pre-fill QA reviews" />
            </div>
            <div className="field">
              <label>QA sampling target (%)</label>
              <input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(e.target.value)} />
              <div className="help-text">Default 20% per operation. Applied to new review periods.</div>
            </div>
          </>
        )}
        <div className="field">
          <label>Kansas Class Builder URL</label>
          <input value={cbUrl} onChange={(e) => setCbUrl(e.target.value)} placeholder="https://…" />
          <div className="help-text">
            The CE tracker links here rather than duplicating the packet generator (spec §6 / §7).
          </div>
        </div>
        {QA_ENABLED && (
          <div className="field">
            <label>QA bot URL (Chart Review Agent)</label>
            <input value={botUrl} onChange={(e) => setBotUrl(e.target.value)} placeholder="http://localhost:5000" />
            <div className="help-text">
              The local address the Chart Review Agent prints when it starts. Shown embedded in the
              QA Bot tab.
            </div>
          </div>
        )}
        <button className="btn primary" onClick={saveSettings}>
          Save settings
        </button>
      </div>

      <div className="section-title">Cloud sync</div>
      <CloudSyncCard />

      <div className="section-title">Data</div>
      <div className="card">
        <p className="subtle" style={{ marginTop: 0 }}>
          Data lives on this device first (works fully offline); Cloud sync above shares it across
          devices when configured. Back up or move your data with the buttons below.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={doExport}>
            ⬇ Export backup (JSON)
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆ Import backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
          <div className="spacer" />
          <button
            className="btn danger"
            onClick={() => {
              if (confirm('Erase ALL local data (CE classes, academy cohorts, attendance)? A backup JSON downloads first, so you can re-import if this was a mistake.')) {
                doExport()
                resetDB()
                setReviewer('')
                setSaved('All data cleared — a backup was downloaded in case you need it back.')
                setTimeout(() => setSaved(''), 4000)
              }
            }}
          >
            Reset all data
          </button>
        </div>
      </div>

      <div className="section-title">About & open items</div>
      <div className="card">
        <p className="subtle" style={{ marginTop: 0 }}>
          <strong>AMR KC Academy — New Hire &amp; FTO Portal</strong> — QA Review Queue (Module A), Kansas CE
          Deadline Tracker (Module B), and New Hire Academy (Module D). Decisions made for this build:
        </p>
        <ul className="subtle" style={{ marginTop: 6, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Persistence is local-first behind one storage module, with optional record-level cloud sync (Supabase + row-level security roles: admin / FTO / new hire).</li>
          <li>The QA rubric is the real 15-question Ninth Brain chart-review form, shared with the Chart Review Agent so manual and bot reviews score alike.</li>
          <li>Cass &amp; Linn monthly volumes are entered per period (still open items in the spec).</li>
          <li>CE alerts are in-app; Teams/email push can layer on later via Power Automate.</li>
        </ul>
      </div>
    </div>
  )
}
