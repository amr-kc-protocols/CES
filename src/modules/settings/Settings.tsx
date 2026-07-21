import { useRef, useState } from 'react'
import { useDB, setState, exportDB, importDB, resetDB } from '../../lib/store'
import { QA_ENABLED, CE_ENABLED } from '../../config/features'
import { useCan } from '../../lib/role'
import { formatDateTime } from '../../lib/date'
import {
  getCloudConfig,
  reconnectWithConfig,
  setCloudConfig,
  signInWithEmail,
  signInWithPassword,
  verifyEmailCode,
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
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [linkSent, setLinkSent] = useState(false)
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
    if (error) return note(`Sign-in failed: ${error}`)
    setLinkSent(true)
    note('Email sent — enter the 6-digit code from it below (or tap its link).')
  }

  async function submitPassword() {
    if (!email.trim() || !password) return note('Enter your email and password.')
    const { error } = await signInWithPassword(email.trim(), password)
    if (error) return note(`Sign-in failed: ${error}`)
    setPassword('')
    note('Signed in!')
  }

  async function submitCode() {
    if (!email.trim() || !code.trim()) return note('Enter your email and the 6-digit code.')
    const { error } = await verifyEmailCode(email.trim(), code)
    if (error) return note(`Code sign-in failed: ${error}`)
    setCode('')
    note('Signed in!')
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
      {status.notice && <div className="banner warn">{status.notice}</div>}

      {!status.signedIn ? (
        <>
          {status.configured && (
            <>
              <div className="field">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmr.net" autoComplete="username" />
              </div>
              <div className="field">
                <label>Password</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button className="btn primary" onClick={submitPassword} style={{ whiteSpace: 'nowrap' }}>
                    Sign in
                  </button>
                </div>
                <div className="help-text">
                  Fastest path — no email involved. The admin sets your starting password.
                </div>
              </div>
              <details>
                <summary className="subtle" style={{ cursor: 'pointer', fontSize: 13 }}>
                  No password? Sign in by email instead
                </summary>
                <div style={{ marginTop: 10 }}>
                  <div className="btn-row" style={{ marginBottom: 10 }}>
                    <button className="btn" onClick={sendLink}>
                      {linkSent ? 'Resend email' : 'Email me a sign-in code'}
                    </button>
                  </div>
                  <div className="field">
                    <label>6-digit code from the email</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitCode()}
                        placeholder="123456"
                      />
                      <button className="btn primary" onClick={submitCode} style={{ whiteSpace: 'nowrap' }}>
                        Verify
                      </button>
                    </div>
                    <div className="help-text">
                      Note: on work email the message's link often arrives pre-consumed by the
                      security scanner — type the code rather than clicking. Showing a code in the
                      email requires the {'{{ .Token }}'} template tweak in Supabase.
                    </div>
                  </div>
                </div>
              </details>
            </>
          )}
          <details style={{ marginTop: 4 }}>
            <summary className="subtle" style={{ cursor: 'pointer', fontSize: 13 }}>
              Advanced: connect to a different Supabase project
            </summary>
            <div style={{ marginTop: 10 }}>
              <div className="field">
                <label>Supabase project URL</label>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
              </div>
              <div className="field">
                <label>Publishable (anon) key</label>
                <input value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="sb_publishable_… (or legacy eyJ…)" />
                <div className="help-text">
                  Dashboard → Settings → API Keys → Publishable key. Safe to store here — row-level
                  security does the real gatekeeping.
                </div>
              </div>
              <div className="btn-row" style={{ marginBottom: 8 }}>
                <button className="btn" onClick={saveConfig}>
                  Save project
                </button>
              </div>
            </div>
          </details>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <span className="pill ok">● Synced as {status.email}</span>
            <span className="pill muted" title="Access level from your cloud profile">{status.role}</span>
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

/** Local footprint of the DB, with the browser's rough allowance alongside. */
function StorageUsage() {
  const db = useDB()
  const bytes = JSON.stringify(db).length
  const mb = (bytes / 1024 / 1024).toFixed(2)
  // localStorage allowances are ~5–10 MB depending on browser; flag early.
  const heavy = bytes > 3.5 * 1024 * 1024
  return (
    <p className={heavy ? 'help-text' : 'subtle'} style={{ fontSize: 12, marginTop: 0 }}>
      Local data size: {mb} MB
      {heavy &&
        ' — approaching this device\u2019s storage allowance. Export a backup; older cohorts can be cleared after their data is safely in the cloud.'}
    </p>
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
  const can = useCan()

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

      {/* The Defaults card only holds QA- and CE-scoped settings; with both
          features flagged off there is nothing to show, so the whole card goes. */}
      {(QA_ENABLED || CE_ENABLED) && (
        <>
          <div className="section-title">{QA_ENABLED ? 'Review defaults' : 'Defaults'}</div>
          <div className="card">
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
            {CE_ENABLED && (
              <div className="field">
                <label>Kansas Class Builder URL</label>
                <input value={cbUrl} onChange={(e) => setCbUrl(e.target.value)} placeholder="https://…" />
                <div className="help-text">
                  The CE tracker links here rather than duplicating the packet generator (spec §6 / §7).
                </div>
              </div>
            )}
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
            {can.manageAcademy ? (
              <button className="btn primary" onClick={saveSettings}>
                Save settings
              </button>
            ) : (
              <div className="help-text">Settings are managed by the admin account.</div>
            )}
          </div>
        </>
      )}

      <div className="section-title">Cloud sync</div>
      <CloudSyncCard />

      <div className="section-title">Data</div>
      <div className="card">
        <p className="subtle" style={{ marginTop: 0 }}>
          Data lives on this device first (works fully offline); Cloud sync above shares it across
          devices when configured. Back up or move your data with the buttons below.
        </p>
        <StorageUsage />
        <div className="btn-row">
          <button className="btn" onClick={doExport}>
            ⬇ Export backup (JSON)
          </button>
          {can.manageAcademy && (
            <button className="btn" onClick={() => fileRef.current?.click()}>
              ⬆ Import backup
            </button>
          )}
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
          <div className="spacer" />
          {can.manageAcademy && (
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
          )}
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
