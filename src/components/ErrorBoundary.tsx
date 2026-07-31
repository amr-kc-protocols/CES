import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Route error boundary.
//
// A render crash anywhere under <Outlet> unmounted the whole tree and left a
// blank white page with no navigation — on a phone, indistinguishable from the
// app being broken for good. One malformed record from storage was enough to
// do it (a trainee with no checklist map, a form response with no values), and
// the natural reaction to a blank screen is to clear site data, which throws
// away every unsynced record on the device.
//
// The boundary keeps the shell and the tab bar, says plainly that nothing was
// lost, and offers the two things that actually recover: go somewhere else, or
// reload. It also catches the PWA's other common failure — a cached shell
// asking for a chunk that a new deploy replaced — and treats it separately,
// because that one is genuinely fixed by reloading.
// ---------------------------------------------------------------------------

function isChunkError(e: Error): boolean {
  return /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    `${e.name} ${e.message}`,
  )
}

interface Props {
  children: ReactNode
  /** Changing this resets the boundary — pass the current route. */
  resetKey: string
}

interface State {
  error: Error | null
  info: string
  shownFor: string
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '', shownFor: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Navigating away clears the error: the next route is a fresh render and
    // may be perfectly fine. Without this the boundary would pin the user to
    // the error screen for the rest of the session.
    if (state.error && state.shownFor && state.shownFor !== props.resetKey) {
      return { error: null, info: '', shownFor: '' }
    }
    if (state.error && !state.shownFor) return { shownFor: props.resetKey }
    return null
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No telemetry to send it to, so the console is the record. Keeping the
    // component stack is what makes an offline bug report actionable.
    console.error('Render error:', error, info.componentStack)
    this.setState({ info: info.componentStack?.slice(0, 1200) ?? '' })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    const stale = isChunkError(error)

    return (
      <div style={{ padding: '8px 0' }}>
        <div className="banner crit">
          <strong>{stale ? 'This screen is out of date.' : 'This screen hit an error.'}</strong>{' '}
          {stale
            ? 'The app updated while this tab was open, so part of it could not load. Reloading picks up the new version.'
            : 'Nothing was lost — your records are stored on this device and are untouched. Try another tab, or reload.'}
        </div>

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button className="btn" onClick={() => this.setState({ error: null, info: '', shownFor: '' })}>
            Try again
          </button>
        </div>

        {!stale && (
          <>
            <div className="section-title">What went wrong</div>
            <div className="help-text" style={{ marginTop: 0 }}>
              Worth sending on if this keeps happening — it names the record or component at fault.
            </div>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                overflowX: 'auto',
                fontSize: 12,
                lineHeight: 1.5,
                background: 'var(--muted-bg)',
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {error.message}
              {this.state.info}
            </pre>
          </>
        )}
      </div>
    )
  }
}
