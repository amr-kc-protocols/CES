import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

// ---------------------------------------------------------------------------
// A text field that types locally and commits on a pause.
//
// Every write in this app goes through lib/store's setState, which serialises
// the WHOLE database to localStorage. A field wired straight to a store
// mutation therefore does a full JSON.stringify of every record on every
// keystroke — imperceptible on a new course, and not something to leave in
// place on a course carrying a few thousand encounters.
//
// The visible behaviour is unchanged: there is still no save button, the value
// still lands in the store on its own, and SavedIndicator still ticks. What
// changes is that it lands once per pause rather than once per character.
// Committing on blur and on unmount as well means a value is never lost by
// closing a modal or switching tabs inside the debounce window.
// ---------------------------------------------------------------------------

const COMMIT_MS = 400

export default function DebouncedInput({
  value,
  onCommit,
  multiline = false,
  ...rest
}: {
  value: string
  onCommit: (v: string) => void
  multiline?: boolean
  id?: string
  placeholder?: string
  disabled?: boolean
  title?: string
  className?: string
  style?: CSSProperties
  /** Phone keyboard hint. `decimal` for percentages, `numeric` for counts. */
  inputMode?: 'text' | 'decimal' | 'numeric'
  'aria-label'?: string
}) {
  const [draft, setDraft] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  // Held in refs so the unmount effect never captures a stale commit.
  const pending = useRef<string | null>(null)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit

  // Track the store when it changes underneath us — a seed, an undo, a sync
  // pull — but never while the user has uncommitted keystrokes in flight.
  useEffect(() => {
    if (pending.current === null) setDraft(value)
  }, [value])

  const flush = (): void => {
    clearTimeout(timer.current)
    if (pending.current === null) return
    const next = pending.current
    pending.current = null
    commitRef.current(next)
  }

  useEffect(() => () => flush(), [])

  const onChange = (next: string): void => {
    setDraft(next)
    pending.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, COMMIT_MS)
  }

  const props = {
    ...rest,
    value: draft,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    onBlur: flush,
  }
  return multiline ? <textarea {...props} /> : <input {...props} />
}
