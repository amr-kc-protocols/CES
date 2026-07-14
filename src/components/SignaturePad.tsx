import { useEffect, useRef, useState } from 'react'

// A finger-or-mouse signature field. Uses Pointer Events so one code path
// covers phone (touch/stylus) and laptop (mouse/trackpad). Captured strokes
// are exported as a PNG data URL; an existing signature (from a synced record)
// renders back onto the canvas so it can be reviewed or re-signed.

interface Props {
  label: string
  /** Existing signature PNG data URL, if already signed. */
  value?: string
  /** Called with the PNG data URL on pen-up, or null when cleared. */
  onChange: (dataUrl: string | null) => void
}

const PEN = '#0b2e4f'
const HEIGHT = 130

export default function SignaturePad({ label, value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirtied = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [hasInk, setHasInk] = useState(!!value)

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

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    if (dirtied.current) {
      onChange(canvasRef.current?.toDataURL('image/png') ?? null)
      dirtied.current = false
    }
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    onChange(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span className="subtle" style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
        {hasInk && (
          <button className="link-btn" style={{ fontSize: 12 }} onClick={clear}>
            Clear
          </button>
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
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
          background: '#fff',
          touchAction: 'none',
          display: 'block',
          cursor: 'crosshair',
        }}
      />
      {!hasInk && (
        <div className="subtle" style={{ fontSize: 11, marginTop: 2 }}>
          Sign above with your finger or mouse.
        </div>
      )}
    </div>
  )
}
