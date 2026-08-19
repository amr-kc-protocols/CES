import { useEffect, useRef, useState } from 'react'

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
// localStorage and talk to each other over a BroadcastChannel; nothing here
// touches the app's store. See public/simulator/README.md.
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

export default function SimulatorView() {
  const frame = useRef<HTMLIFrameElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [monitorLive, setMonitorLive] = useState(false)

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

  // A missing or unbuilt directory would otherwise show as a blank white panel
  // with no explanation. The SPA fallback makes the failure mode worse than
  // blank: a stale deploy serves the CES shell inside the frame, so the tab
  // renders the whole app inside itself. Check what actually loaded.
  useEffect(() => {
    if (state !== 'loading') return
    const timer = setTimeout(() => setState((s) => (s === 'loading' ? 'failed' : s)), 12000)
    return () => clearTimeout(timer)
  }, [state])

  function onLoad() {
    // Same-origin, so this read is allowed. If the fallback served the CES
    // shell instead, the title is the host app's rather than the tool's.
    const title = frame.current?.contentDocument?.title ?? ''
    setState(title.includes(PANEL_TITLE) ? 'ready' : 'failed')
  }

  function openMonitor() {
    // Sized for a second display; resizable so it can be dragged to a TV and
    // put full screen with the monitor's own ⛶ button or the F key.
    // Named, so a second press focuses the monitor already open rather than
    // opening another one onto the same scenario.
    window.open(MONITOR_URL, 'SimMonitor', 'width=1280,height=760,resizable=yes')?.focus()
  }

  return (
    <div className="sim-host">
      <div className="sim-bar">
        <div className="sim-bar-text">
          <strong>Control panel</strong>
          <span className="subtle">
            {' '}
            — set vitals, rhythm and medications here. Open the monitor on the screen the crew
            reads.
          </span>
        </div>
        <span className={`sim-mon ${monitorLive ? 'on' : 'off'}`}>
          {monitorLive ? '● Monitor live' : '◌ No monitor open'}
        </span>
        <button className="btn primary sm" onClick={openMonitor} disabled={state === 'failed'}>
          {monitorLive ? 'Bring monitor to front ↗' : 'Open patient monitor ↗'}
        </button>
      </div>

      {state === 'failed' ? (
        <div className="review-fallback">
          <h2>The simulator did not load</h2>
          <p>
            It is served as static files from <code>{PANEL_URL}</code>. They are missing from this
            deployment, or the server returned the app shell in their place.
          </p>
          <p className="subtle">
            If you are running a development server, restart it — files added under{' '}
            <code>public/</code> are picked up at startup. Otherwise this deploy needs rebuilding.
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
        // window and writes its own localStorage, and granting those back
        // through sandbox flags needs allow-same-origin, which returns the
        // frame to this origin anyway. First-party code from this repository.
        allow="clipboard-write"
      />
    </div>
  )
}
