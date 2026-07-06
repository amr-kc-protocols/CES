import { useCallback, useEffect, useState } from 'react'
import { Empty } from '../../components/ui'
import { OPERATIONS } from '../../data/operations'
import { formatDateTime } from '../../lib/date'
import { setState, useDB } from '../../lib/store'
import {
  useBotSync,
  chooseFolder,
  forgetFolder,
  resumeAccess,
  setSyncEnabled,
  setDefaultUnit,
  syncNow,
} from './botSync'
import type { OperationId } from '../../types'

// The Chart Review Agent runs locally (app.py on Hunter's machine). Browsers
// treat http://localhost as a trustworthy origin, so the bot's UI can be
// embedded here and its batch folder read even when CES itself is served
// over HTTPS.

type Reachability = 'unknown' | 'checking' | 'online' | 'offline'

function useBotReachable(url: string): [Reachability, () => void] {
  const [reach, setReach] = useState<Reachability>('unknown')
  const check = useCallback(() => {
    if (!url) return
    setReach('checking')
    // no-cors: an opaque response still proves something answered at that URL.
    fetch(url, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(4000) })
      .then(() => setReach('online'))
      .catch(() => setReach('offline'))
  }, [url])
  useEffect(check, [check])
  return [reach, check]
}

export default function BotTab() {
  const db = useDB()
  const sync = useBotSync()
  const botUrl = db.settings.botUrl
  const [urlDraft, setUrlDraft] = useState(botUrl)
  const [reach, recheck] = useBotReachable(botUrl)
  // Bump to force the iframe to reload after the bot comes back up.
  const [frameKey, setFrameKey] = useState(0)

  function saveUrl() {
    const url = urlDraft.trim().replace(/\/+$/, '')
    setState((d) => ({ ...d, settings: { ...d.settings, botUrl: url } }))
    setFrameKey((k) => k + 1)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>QA Bot</h1>
          <div className="subtle">Ninth Brain Chart Review Agent · runs on this machine</div>
        </div>
        {botUrl && (
          <a className="btn sm" href={botUrl} target="_blank" rel="noreferrer">
            Open in new tab ↗
          </a>
        )}
      </div>

      {/* ----- review sync ----- */}
      <div className="section-title">Review sync</div>
      <div className="card">
        {!sync.supported ? (
          <div className="banner warn">
            Automatic sync needs the File System Access API (Chrome or Edge). In this browser,
            import batches manually: QA → period → Add charts → Bot reviews.
          </div>
        ) : sync.folderName === null ? (
          <>
            <p className="subtle" style={{ marginTop: 0 }}>
              Point CES at the folder where the bot writes <code>ces_batch_*.json</code> (the folder
              containing <code>app.py</code>). New and updated reviews are then imported
              automatically into the matching month's QA period — no manual file step.
            </p>
            <button className="btn primary" onClick={() => void chooseFolder()}>
              📂 Choose the bot's folder
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong>📂 {sync.folderName}</strong>
              {sync.permission === 'granted' ? (
                <span className={`pill ${sync.enabled ? 'ok' : 'muted'}`}>
                  {sync.syncing ? 'Syncing…' : sync.enabled ? 'Auto-sync on' : 'Paused'}
                </span>
              ) : (
                <span className="pill warn">Access needed</span>
              )}
            </div>

            {sync.permission === 'prompt' && (
              <div className="banner warn" style={{ marginTop: 10 }}>
                The browser needs you to re-confirm folder access after a restart.{' '}
                <button className="link-btn" onClick={() => void resumeAccess()}>
                  Resume access
                </button>
              </div>
            )}

            {sync.permission === 'granted' && (
              <>
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <button className="btn" onClick={() => void syncNow(true)} disabled={sync.syncing}>
                    ↻ Sync now
                  </button>
                  <button className="btn" onClick={() => setSyncEnabled(!sync.enabled)}>
                    {sync.enabled ? 'Pause auto-sync' : 'Resume auto-sync'}
                  </button>
                  <div className="spacer" />
                  <button className="btn" onClick={() => void forgetFolder()}>
                    Forget folder
                  </button>
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Unit for files without a suffix (plain ces_batch.json)</label>
                  <select
                    value={sync.defaultUnit}
                    onChange={(e) => setDefaultUnit(e.target.value as OperationId)}
                    style={{ maxWidth: 260 }}
                  >
                    {OPERATIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <div className="help-text">
                    Suffixed files (ces_batch_kc.json, ces_batch_linn.json…) route themselves.
                  </div>
                </div>
              </>
            )}

            {sync.error && <div className="banner crit" style={{ marginTop: 10 }}>{sync.error}</div>}

            {sync.lastSyncAt && (
              <div style={{ marginTop: 12 }}>
                <div className="subtle">Last scan {formatDateTime(sync.lastSyncAt)}</div>
                {sync.summary && (
                  <div className="banner info" style={{ marginTop: 8 }}>
                    Imported: {sync.summary}. Reviews land in each run date's month —{' '}
                    set the period's monthly volume so the 20% target is right.
                  </div>
                )}
                {sync.fileNotes.length > 0 && (
                  <ul className="subtle" style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.6 }}>
                    {sync.fileNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ----- embedded bot UI ----- */}
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>Bot console</span>
        {botUrl && reach === 'offline' && (
          <button className="link-btn" style={{ marginLeft: 'auto' }} onClick={() => { recheck(); setFrameKey((k) => k + 1) }}>
            Retry
          </button>
        )}
      </div>

      {!botUrl ? (
        <div className="card">
          <p className="subtle" style={{ marginTop: 0 }}>
            Enter the address the Chart Review Agent prints when it starts (usually{' '}
            <code>http://localhost:5000</code> or similar) to use it right here inside CES.
          </p>
          <div className="field">
            <label>Bot URL</label>
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="http://localhost:5000"
              inputMode="url"
            />
          </div>
          <button className="btn primary" onClick={saveUrl} disabled={!urlDraft.trim()}>
            Connect
          </button>
        </div>
      ) : reach === 'offline' ? (
        <Empty icon="🤖" title="Bot not reachable">
          Nothing answered at <code>{botUrl}</code>. Start the Chart Review Agent on this machine,
          then hit Retry. You can change the URL in Settings.
        </Empty>
      ) : (
        <iframe
          key={frameKey}
          src={botUrl}
          title="Ninth Brain Chart Review Agent"
          style={{
            width: '100%',
            height: '72vh',
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: '#fff',
          }}
        />
      )}
    </div>
  )
}
