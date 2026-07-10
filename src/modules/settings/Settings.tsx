import { useRef, useState } from 'react'
import { useDB, setState, exportDB, importDB, resetDB } from '../../lib/store'
import { QA_ENABLED } from '../../config/features'

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

      <div className="section-title">Data</div>
      <div className="card">
        <p className="subtle" style={{ marginTop: 0 }}>
          This MVP stores everything locally on this device (localStorage). Back up or move your data
          with the buttons below.
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
          <strong>AMR Clinical Education Suite</strong> — QA Review Queue (Module A), Kansas CE
          Deadline Tracker (Module B), and New Hire Academy (Module D). Decisions made for this build:
        </p>
        <ul className="subtle" style={{ marginTop: 6, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Persistence is local-first (device-only) behind one storage module, so a shared backend can be added later without UI changes.</li>
          <li>The QA rubric is the real 15-question Ninth Brain chart-review form, shared with the Chart Review Agent so manual and bot reviews score alike.</li>
          <li>Cass &amp; Linn monthly volumes are entered per period (still open items in the spec).</li>
          <li>CE alerts are in-app; Teams/email push can layer on later via Power Automate.</li>
        </ul>
      </div>
    </div>
  )
}
