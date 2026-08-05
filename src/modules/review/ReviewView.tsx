import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Host for the EMS Transport Review tool.
//
// The tool is a self-contained static app vendored under public/review — its
// own DOM, its own IndexedDB, no network code path. This component does not
// reimplement any of it; it frames it and gets out of the way. See
// public/review/UPSTREAM.md for why it is embedded rather than ported.
//
// The path is spelled with the .html extension on purpose. Both the Vercel
// rewrite and the service worker's navigateFallback treat extensionless paths
// as SPA routes and would hand back the CES index.html — an iframe load counts
// as a navigation for both. `/review/index.html` has a dot, so both let it
// through to the real file.
// ---------------------------------------------------------------------------

const TOOL_URL = '/review/index.html'

export default function ReviewView() {
  const frame = useRef<HTMLIFrameElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')

  // A missing or unbuilt public/review would otherwise show as a blank white
  // panel with no explanation. The SPA fallback makes the failure mode worse
  // than blank: a stale deploy serves the CES shell inside the frame, so the
  // tab renders the whole app inside itself. Check what actually loaded.
  useEffect(() => {
    if (state !== 'loading') return
    const timer = setTimeout(() => setState((s) => (s === 'loading' ? 'failed' : s)), 12000)
    return () => clearTimeout(timer)
  }, [state])

  function onLoad() {
    const doc = frame.current?.contentDocument
    // Same-origin, so this read is allowed. If the fallback served the CES
    // shell instead, the title is KC Academy's rather than the tool's.
    const title = doc?.title ?? ''
    setState(title.includes('EMS Transport Review') ? 'ready' : 'failed')
  }

  return (
    <div className="review-host">
      {state === 'failed' ? (
        <div className="review-fallback">
          <h2>Chart review tool did not load</h2>
          <p>
            The review tool is served as static files from <code>/review/</code>. It is missing
            from this deployment, or the server returned the app shell in its place.
          </p>
          <p className="subtle">
            If you are running a development server, restart it — files added under{' '}
            <code>public/</code> are picked up at startup. Otherwise this deploy needs rebuilding.
          </p>
          <p>
            <a href={TOOL_URL} target="_blank" rel="noreferrer" className="link-btn">
              Open the tool directly ↗
            </a>
          </p>
        </div>
      ) : null}

      <iframe
        ref={frame}
        src={TOOL_URL}
        title="EMS Transport Review"
        className="review-frame"
        onLoad={onLoad}
        hidden={state === 'failed'}
        // No sandbox attribute, deliberately. The tool needs IndexedDB, file
        // reads, <dialog>, downloads and a print window — granting those back
        // through sandbox flags requires allow-same-origin, which returns the
        // frame to the same origin anyway and buys nothing. This is
        // first-party code from this repository, not third-party content.
        allow="clipboard-write"
      />
    </div>
  )
}
