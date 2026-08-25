import { useEffect, useMemo, useRef, useState } from 'react'
import type { SimRun } from '../../types'
import { setState, useDB } from '../../lib/store'
import { uid } from '../../lib/id'
import { formatDate } from '../../lib/date'
import { confirmAction } from '../../lib/dialog'
import { pushUndo } from '../../lib/undo'
import { downloadDoc, printDoc, safeFilename } from '../academy/docGen'
import { runSheetFilename, runSheetHTML, runSheetTitle } from './checkoffSheet'
import { Empty } from '../../components/ui'

// ---------------------------------------------------------------------------
// Host for the human patient simulator.
//
// Two windows by design: the instructor drives the control panel, and the
// patient monitor goes on a second screen the crew reads. So this tab frames
// the control panel and hands the monitor its own window rather than trying to
// show both — a monitor in a phone-sized panel beside its own controls is not
// the thing being simulated.
//
// The pages are self-contained static files under public/simulator/, vendored
// the same way the chart review tools are. They keep their own state in
// localStorage and talk to each other over a BroadcastChannel; nothing there
// touches the app's store. The one thing that crosses back is a finished run —
// the panel posts it here and this component writes the record, because the
// facilitator grades in the panel and the record belongs in CES.
//
// Paths are spelled with the .html extension on purpose. Both the Vercel
// rewrite and the service worker's navigateFallback treat extensionless paths
// as SPA routes and would hand back the CES index.html — an iframe load counts
// as a navigation for both. A dotted path gets through to the real file. This
// is the same trap documented in ReviewView.
// ---------------------------------------------------------------------------

const PANEL_URL = '/simulator/control_panel.html'
const MONITOR_URL = '/simulator/patient_monitor_display.html'
const PANEL_TITLE = 'Simulator Control Panel'

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

/** The sheet, in a print window — browser print dialog, then paper or PDF. */
function printRunSheet(run: SimRun): void {
  printDoc(runSheetTitle(run), runSheetHTML(run))
}

/** The same sheet as an editable .doc, for a sheet that needs a note added. */
function downloadRunSheet(run: SimRun): void {
  downloadDoc(safeFilename(runSheetFilename(run)), runSheetTitle(run), runSheetHTML(run))
}

export default function SimulatorView() {
  const db = useDB()
  const frame = useRef<HTMLIFrameElement>(null)
  const [state, setLoad] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [monitorLive, setMonitorLive] = useState(false)
  const [tab, setTab] = useState<'console' | 'records'>('console')
  const [justSaved, setJustSaved] = useState<string | null>(null)

  const runs = useMemo(
    () => [...db.simRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [db.simRuns],
  )

  // Every open monitor announces itself on the shared channel once a second.
  // This bar is the only part of the screen that does not scroll away, so it is
  // where a facilitator can see at a glance that the crew still has a display —
  // a monitor that was closed by accident is otherwise completely silent.
  useEffect(() => {
    let channel: BroadcastChannel
    try {
      channel = new BroadcastChannel('simState')
    } catch {
      return // no channel, no claim either way
    }
    let last = 0
    channel.onmessage = (e) => {
      if (e.data && e.data.__monitor) last = Date.now()
    }
    const timer = setInterval(() => setMonitorLive(Date.now() - last < 3000), 1000)
    return () => {
      clearInterval(timer)
      channel.close()
    }
  }, [])

  // A finished run, posted from the framed panel. The panel knows what the crew
  // did; only this side knows who is signed in and where records live, so the
  // facilitator is stamped here rather than asked for twice.
  //
  // The panel can also ask for the sheet to be printed the moment the run ends,
  // which is the flow at a megacode: end the run, hand the student their sheet.
  // It has no record to print from — the record is here — so it asks, and the
  // saved run is held in a ref because the message arrives outside React's
  // render and the state set alongside it has not landed yet.
  const lastSaved = useRef<SimRun | null>(null)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      if (!e.data) return
      if (e.data.type === 'ces-sim-print') {
        if (lastSaved.current) printRunSheet(lastSaved.current)
        return
      }
      if (e.data.type !== 'ces-sim-run' || !e.data.run) return
      const incoming = e.data.run as Omit<SimRun, 'id' | 'facilitator'>
      const record: SimRun = {
        ...incoming,
        id: uid('simrun'),
        facilitator: db.settings.reviewer || '',
      }
      lastSaved.current = record
      setState((prev) => ({ ...prev, simRuns: [...prev.simRuns, record] }))
      setJustSaved(record.id)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [db.settings.reviewer])

  // A missing or unbuilt directory would otherwise show as a blank white panel
  // with no explanation. The SPA fallback makes the failure mode worse than
  // blank: a stale deploy serves the CES shell inside the frame, so the tab
  // renders the whole app inside itself. Check what actually loaded.
  useEffect(() => {
    if (state !== 'loading') return
    const timer = setTimeout(() => setLoad((s) => (s === 'loading' ? 'failed' : s)), 12000)
    return () => clearTimeout(timer)
  }, [state])

  function onLoad() {
    // Same-origin, so this read is allowed. If the fallback served the CES
    // shell instead, the title is the host app's rather than the tool's.
    const title = frame.current?.contentDocument?.title ?? ''
    setLoad(title.includes(PANEL_TITLE) ? 'ready' : 'failed')
  }

  function openMonitor() {
    // Named, so a second press focuses the monitor already open rather than
    // opening another one onto the same scenario. Sized for a second display;
    // resizable so it can be dragged to a TV and put full screen.
    window.open(MONITOR_URL, 'SimMonitor', 'width=1280,height=760,resizable=yes')?.focus()
  }

  return (
    <div className="sim-host">
      <div className="sim-bar">
        <nav className="sim-tabs" aria-label="Simulator">
          <button
            className={tab === 'console' ? 'active' : ''}
            onClick={() => setTab('console')}
          >
            Console
          </button>
          <button
            className={tab === 'records' ? 'active' : ''}
            onClick={() => {
              setTab('records')
              setJustSaved(null)
            }}
          >
            Runs{runs.length ? ` (${runs.length})` : ''}
          </button>
        </nav>

        {tab === 'console' ? (
          <>
            <div className="sim-bar-text">
              {justSaved ? (
                <strong className="sim-saved">
                  ✔ Run saved —{' '}
                  <button
                    className="link-inline"
                    onClick={() => lastSaved.current && printRunSheet(lastSaved.current)}
                  >
                    print the check-off sheet
                  </button>{' '}
                  or see Runs
                </strong>
              ) : (
                <span className="subtle">
                  Set vitals, rhythm and medications here. Open the monitor on the screen the crew
                  reads.
                </span>
              )}
            </div>
            <span className={`sim-mon ${monitorLive ? 'on' : 'off'}`}>
              {monitorLive ? '● Monitor live' : '◌ No monitor open'}
            </span>
            <button className="btn primary sm" onClick={openMonitor} disabled={state === 'failed'}>
              {monitorLive ? 'Bring monitor to front ↗' : 'Open patient monitor ↗'}
            </button>
          </>
        ) : (
          <div className="sim-bar-text">
            <span className="subtle">
              Every graded run. Actions are the scenario's own expected actions. ACLS megacodes
              carry the AHA checklist's PASS / NR and print as that check-off sheet, filled in,
              for the student's card; the quarterly scenarios print as a performance record,
              because their approved documents define no outcome. Runs driven from the LIFEPAK
              monitor also carry the crew's own timeline at the defibrillator.
            </span>
          </div>
        )}
      </div>

      {tab === 'records' ? (
        <RunList runs={runs} />
      ) : (
        <>
          {state === 'failed' ? (
            <div className="review-fallback">
              <h2>The simulator did not load</h2>
              <p>
                It is served as static files from <code>{PANEL_URL}</code>. They are missing from
                this deployment, or the server returned the app shell in their place.
              </p>
              <p className="subtle">
                If you are running a development server, restart it — files added under{' '}
                <code>public/</code> are picked up at startup. Otherwise this deploy needs
                rebuilding.
              </p>
              <p>
                <a href={PANEL_URL} target="_blank" rel="noreferrer" className="link-btn">
                  Open the control panel directly ↗
                </a>
              </p>
            </div>
          ) : null}

          <iframe
            ref={frame}
            src={PANEL_URL}
            title={PANEL_TITLE}
            className="sim-frame"
            onLoad={onLoad}
            hidden={state === 'failed'}
            // No sandbox attribute, deliberately — the panel opens the monitor
            // window, writes its own localStorage and posts finished runs back
            // to this document. Granting those through sandbox flags needs
            // allow-same-origin, which returns the frame to this origin anyway.
            // First-party code from this repository.
            allow="clipboard-write"
          />
        </>
      )}
    </div>
  )
}

function RunList({ runs }: { runs: SimRun[] }) {
  const [open, setOpen] = useState<string | null>(runs[0]?.id ?? null)

  // Practice runs, equipment tests, a scenario started twice by mistake. These
  // are competency records, so deleting one asks first and stays undoable for
  // the length of the toast — but a list nobody can clean up is a list nobody
  // trusts, and a test run sitting next to a real megacode is worse than no
  // record at all.
  async function onDelete(run: SimRun) {
    const label = run.crew?.trim() ? `${run.scenarioName} — ${run.crew.trim()}` : run.scenarioName
    const ok = await confirmAction({
      title: 'Delete this run?',
      body:
        `${label}, recorded ${formatDate(run.startedAt.slice(0, 10))}. ` +
        (run.checklist && run.result
          ? `It carries a ${run.result === 'pass' ? 'PASS' : 'NR'} result. `
          : '') +
        'The record goes; print the sheet first if it is needed.',
      confirmLabel: 'Delete run',
      danger: true,
    })
    if (!ok) return
    setState((prev) => ({ ...prev, simRuns: prev.simRuns.filter((x) => x.id !== run.id) }))
    pushUndo(`Deleted run "${label}"`, () =>
      setState((prev) =>
        prev.simRuns.some((x) => x.id === run.id)
          ? prev
          : { ...prev, simRuns: [...prev.simRuns, run] },
      ),
    )
  }

  if (!runs.length) {
    return (
      <div className="sim-records">
        <Empty icon="🫀" title="No runs recorded yet">
          Load a quarterly simulation on the console, tick the expected actions as the crew performs
          them, then end the run. It is saved here.
        </Empty>
      </div>
    )
  }
  return (
    <div className="sim-records">
      {runs.map((r) => {
        const done = r.states.reduce((n, s) => n + s.actions.filter((a) => a.done).length, 0)
        const total = r.states.reduce((n, s) => n + s.actions.length, 0)
        const secs = r.states.reduce((n, s) => n + s.seconds, 0)
        const shocks = (r.device ?? []).filter((e) => e.type === 'shock').length
        const isOpen = open === r.id
        return (
          <div key={r.id} className="card sim-run">
            <button className="sim-run-head" onClick={() => setOpen(isOpen ? null : r.id)}>
              <div className="grow">
                <div className="title">{r.scenarioName}</div>
                <div className="meta">
                  {formatDate(r.startedAt.slice(0, 10))}
                  {r.crew ? ` · ${r.crew}` : ''}
                  {r.facilitator ? ` · facilitated by ${r.facilitator}` : ''}
                </div>
              </div>
              {r.checklist ? (
                <span className={`pill ${r.result === 'pass' ? 'ok' : r.result === 'nr' ? 'warn' : 'muted'}`}>
                  {r.result === 'pass' ? 'PASS' : r.result === 'nr' ? 'NR' : 'no result'}
                </span>
              ) : null}
              {shocks > 0 ? <span className="pill warn">⚡ {shocks} shock{shocks === 1 ? '' : 's'}</span> : null}
              <span className={`pill ${done === total ? 'ok' : 'info'}`}>
                {done}/{total} actions
              </span>
              <span className="subtle sim-run-time">{mmss(secs)}</span>
              <span className="subtle">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div className="sim-run-body">
                {r.checklist ? (
                  <div className="sim-run-state">
                    <div className="sim-run-state-head">
                      Team &amp; CPR quality <span className="subtle">{r.checklistName}</span>
                    </div>
                    {(r.team ?? []).map((t, j) => (
                      <div key={j} className={t.done ? 'sim-act ok' : 'sim-act miss'}>
                        {t.done ? '✓' : '✗'} {t.text}
                      </div>
                    ))}
                    {r.cpr ? (
                      <div className="sim-act subtle">
                        Compression rate {r.cpr.rate ? '✓' : '✗'} · depth {r.cpr.depth ? '✓' : '✗'} · recoil{' '}
                        {r.cpr.recoil ? '✓' : '✗'} · fraction {r.cpr.fraction || '—'}% · ventilation{' '}
                        {r.cpr.ventRate || '—'}/min
                      </div>
                    ) : null}
                    {/* What the printed sheet will be signed with. Blank here
                        means blank on the sheet the student submits. */}
                    <div className={r.instructorInitials ? 'sim-act subtle' : 'sim-act miss'}>
                      Instructor {r.instructorInitials || '— not recorded'}
                      {r.instructorNumber ? ` · number ${r.instructorNumber}` : ''}
                    </div>
                  </div>
                ) : null}
                {r.states.map((st, i) =>
                  st.actions.length || st.seconds ? (
                    <div key={i} className="sim-run-state">
                      <div className="sim-run-state-head">
                        {st.label} <span className="subtle">{mmss(st.seconds)}</span>
                      </div>
                      {st.actions.map((a, j) => (
                        <div key={j} className={a.done ? 'sim-act ok' : 'sim-act miss'}>
                          {a.done ? '✓' : '✗'} {a.text}
                        </div>
                      ))}
                    </div>
                  ) : null,
                )}
                {r.device && r.device.length ? (
                  <div className="sim-run-state">
                    <div className="sim-run-state-head">
                      At the monitor <span className="subtle">{r.device.length} actions</span>
                    </div>
                    {/* In order, because the questions this answers are about
                        order: how long to the first shock, and whether
                        compressions came back straight after one. */}
                    {r.device.map((e, j) => (
                      <div key={j} className={`sim-dev${e.type === 'shock' ? ' shock' : ''}`}>
                        <span className="sim-dev-t">{mmss(e.at)}</span>
                        <span>{e.label}</span>
                        {e.detail ? <span className="subtle"> {e.detail}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {r.notes ? <div className="sim-run-note">{r.notes}</div> : null}
                <div className="sim-run-acts">
                  <button className="btn primary sm" onClick={() => printRunSheet(r)}>
                    🖨 {r.checklist ? 'Print check-off sheet' : 'Print record'}
                  </button>
                  <button className="btn sm" onClick={() => downloadRunSheet(r)}>
                    ⬇ Download .doc
                  </button>
                  <span className="grow" />
                  <button className="btn danger sm" onClick={() => onDelete(r)}>
                    Delete run
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
