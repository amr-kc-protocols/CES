import { useEffect, useRef, useState } from 'react'
import { formatSignedAt } from '../lib/date'

// A finger-or-mouse signature field. Uses Pointer Events so one code path
// covers phone (touch/stylus) and laptop (mouse/trackpad). Captured strokes
// are exported as a PNG data URL; an existing signature (from a synced record)
// renders back onto the canvas so it can be reviewed or re-signed.
//
// Signature lock: once a signature is captured it locks — the pad stops
// taking ink so a stray swipe while scrolling can't alter a completed
// signature — and shows when it was signed. "Clear & re-sign" is a deliberate
// unlock, so a signature is never changed by accident.

interface Props {
  label: string
  /** Existing signature PNG data URL, if already signed. */
  value?: string
  /** ISO timestamp the signature was captured — shown, and locks the pad. */
  signedAt?: string
  /** Called with the PNG data URL on pen-up, or null when cleared. */
  onChange: (dataUrl: string | null) => void
  /** Read-only: shows any existing signature but never takes ink or unlocks. */
  disabled?: boolean
  /** Pad height in px — default 130; ~70 suits initials. */
  height?: number
}

const PEN = '#0b2e4f'

export default function SignaturePad({ label, value, signedAt, onChange, disabled, height = 130 }: Props) {
  const HEIGHT = height
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirtied = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [hasInk, setHasInk] = useState(!!value)
  // A signature arriving already-signed (reopened sheet, synced from another
  // device) starts locked; a fresh empty pad starts open for signing.
  const [locked, setLocked] = useState(!!value)

  const takesInk = !disabled && !locked

  // Size the backing store to the element (accounting for device pixel ratio
  // so lines stay crisp), then paint any existing signature back on.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = HEIGHT * ratio
    ctx.scale(ratio, ratio)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = PEN
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, HEIGHT)
      img.src = value
    }
    // Only re-init on a genuinely different incoming signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent) => {
    if (!takesInk) return
    e.preventDefault()
    drawing.current = true
    last.current = pos(e)
    try {
      canvasRef.current?.setPointerCapture(e.pointerId)
    } catch {
      // Pointer capture is a nicety (keeps strokes tracking off-canvas); if the
      // environment rejects it, drawing still works from the events themselves.
    }
  }

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !last.current) return
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    dirtied.current = true
    if (!hasInk) setHasInk(true)
  }

  // Export at CSS-pixel size, not the DPR-scaled backing store: signatures
  // live inside synced records and the localStorage DB, and a 3x phone would
  // otherwise store 9x the pixels for no visible gain on a printed sheet.
  const exportPNG = (): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const off = document.createElement('canvas')
    off.width = Math.max(1, Math.round(rect.width))
    off.height = HEIGHT
    const octx = off.getContext('2d')
    if (!octx) return canvas.toDataURL('image/png')
    octx.drawImage(canvas, 0, 0, off.width, off.height)
    return off.toDataURL('image/png')
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    if (dirtied.current) {
      onChange(exportPNG())
      dirtied.current = false
    }
  }

  const lock = () => {
    if (drawing.current) end()
    setLocked(true)
  }

  const clearAndResign = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    setLocked(false)
    onChange(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span className="subtle" style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
        {locked && (
          <span className="subtle" style={{ fontSize: 11 }}>
            🔒 {signedAt ? `Signed ${formatSignedAt(signedAt)}` : 'Locked'}
          </span>
        )}
        {locked && !disabled && (
          <button className="link-btn" style={{ fontSize: 12 }} onClick={clearAndResign}>
            Clear &amp; re-sign
          </button>
        )}
        {takesInk && hasInk && (
          <>
            <button className="link-btn" style={{ fontSize: 12 }} onClick={clearAndResign}>
              Clear
            </button>
            <button className="link-btn" style={{ fontSize: 12, fontWeight: 700 }} onClick={lock}>
              🔒 Lock signature
            </button>
          </>
        )}
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        style={{
          width: '100%',
          height: HEIGHT,
          border: `1px solid ${locked ? 'var(--border)' : 'var(--border-strong)'}`,
          borderRadius: 8,
          background: locked ? '#f8fafc' : '#fff',
          touchAction: 'none',
          display: 'block',
          cursor: takesInk ? 'crosshair' : 'default',
        }}
      />
      {!hasInk && !locked && (
        <div className="subtle" style={{ fontSize: 11, marginTop: 2 }}>
          {disabled ? 'Not signed yet.' : 'Sign above with your finger or mouse.'}
        </div>
      )}
      {takesInk && hasInk && (
        <div className="subtle" style={{ fontSize: 11, marginTop: 2 }}>
          Tap <strong>Lock signature</strong> when done — it can't be changed after without “Clear &amp; re-sign”.
        </div>
      )}
    </div>
  )
}
