import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Host for the chart review tools.
//
// Each tool is a self-contained static app vendored under public/ — its own
// DOM, its own IndexedDB, no network code path. This component does not
// reimplement any of them; it frames them and gets out of the way. See
// public/review/UPSTREAM.md and public/necessity/README.md.
//
// The two tools sit behind one tab rather than two. They are the same category
// of work for the same person, and an eighth entry does not fit the bottom bar
// on a phone — at 375px the labels start clipping. Emergent stays the default
// so the tool that was here first costs no extra tap.
//
// Paths are spelled with the .html extension on purpose. Both the Vercel
// rewrite and the service worker's navigateFallback treat extensionless paths
// as SPA routes and would hand back the CES index.html — an iframe load counts
// as a navigation for both. A dotted path gets through to the real file.
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    path: '/review',
    label: 'Emergent transport',
    url: '/review/index.html',
    title: 'EMS Transport Review',
  },
  {
    path: '/review/necessity',
    label: 'Medical necessity',
    url: '/necessity/index.html',
    title: 'Medical Necessity Review',
  },
] as const

export default function ReviewView() {
  const { pathname } = useLocation()
  const tool = TOOLS.find((t) => t.path === pathname) ?? TOOLS[0]

  const frame = useRef<HTMLIFrameElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')

  // Switching tools swaps the iframe src, so the check has to run again.
  useEffect(() => setState('loading'), [tool.url])

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
    setState(title.includes(tool.title) ? 'ready' : 'failed')
  }

  return (
    <div className="review-host">
      <nav className="tool-switch" aria-label="Review tool">
        {TOOLS.map((t) => (
          <NavLink
            key={t.path}
            to={t.path}
            end
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      {state === 'failed' ? (
        <div className="review-fallback">
          <h2>{tool.title} did not load</h2>
          <p>
            This tool is served as static files from <code>{tool.url}</code>. It is missing from
            this deployment, or the server returned the app shell in its place.
          </p>
          <p className="subtle">
            If you are running a development server, restart it — files added under{' '}
            <code>public/</code> are picked up at startup. Otherwise this deploy needs rebuilding.
          </p>
          <p>
            <a href={tool.url} target="_blank" rel="noreferrer" className="link-btn">
              Open the tool directly ↗
            </a>
          </p>
        </div>
      ) : null}

      <iframe
        // Keyed so switching tools remounts rather than reusing a frame whose
        // history would otherwise let the browser Back button walk between the
        // two tools instead of leaving the tab.
        key={tool.url}
        ref={frame}
        src={tool.url}
        title={tool.title}
        className="review-frame"
        onLoad={onLoad}
        hidden={state === 'failed'}
        // No sandbox attribute, deliberately. The tools need IndexedDB, file
        // reads, <dialog>, downloads and a print window — granting those back
        // through sandbox flags requires allow-same-origin, which returns the
        // frame to the same origin anyway and buys nothing. This is
        // first-party code from this repository, not third-party content.
        allow="clipboard-write"
      />
    </div>
  )
}
