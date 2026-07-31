import { useEffect, useRef, useState } from 'react'
import { usePersistFailed, useSaveTick } from '../lib/store'

// ---------------------------------------------------------------------------
// "Saved" feedback for screens that write on keystroke.
//
// The app has no save button anywhere — that is a deliberate design, and the
// onboarding text promises it ("Everything saves to your phone instantly").
// But a field that writes straight through and shows nothing is
// indistinguishable from a field that is not wired up, which is exactly the
// doubt that makes someone retype a whole schedule.
//
// Reserves its own width so the row does not reflow when the word appears.
// ---------------------------------------------------------------------------

const SHOW_MS = 1600

export default function SavedIndicator({ label = 'Saved' }: { label?: string }) {
  const tick = useSaveTick()
  const failed = usePersistFailed()
  const [shown, setShown] = useState(false)
  const first = useRef(true)

  useEffect(() => {
    // Skip the mount tick: nothing was saved by arriving on the screen.
    if (first.current) {
      first.current = false
      return
    }
    setShown(true)
    const t = setTimeout(() => setShown(false), SHOW_MS)
    return () => clearTimeout(t)
  }, [tick])

  if (failed) {
    return (
      <span className="subtle" style={{ fontSize: 12, color: 'var(--crit)', whiteSpace: 'nowrap' }}>
        ⚠ Not saved
      </span>
    )
  }

  return (
    <span
      aria-live="polite"
      className="subtle"
      style={{
        fontSize: 12,
        whiteSpace: 'nowrap',
        color: 'var(--ok)',
        opacity: shown ? 1 : 0,
        transition: 'opacity 0.25s',
      }}
    >
      ✓ {label}
    </span>
  )
}
