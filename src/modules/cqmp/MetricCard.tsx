import { useEffect, useRef, useState } from 'react'
import DebouncedInput from '../../components/DebouncedInput'
import { notifyUser } from '../../lib/dialog'
import { CQMP_KPIS, type CqmpKpiId } from '../../data/cqmp'
import {
  addMetricImage,
  deltaOf,
  isReported,
  percentOf,
  STATUS_LABEL,
  statusOf,
  targetFor,
  removeMetricImage,
  updateMetric,
} from './cqmpStore'
import { addScreenshot, deleteScreenshot, getScreenshotUrl } from './images'
import type { CqmpImageRef, CqmpMetric } from '../../types'

// ---------------------------------------------------------------------------
// One measure, for one operation, for the month: the number, the case counts
// behind it, the target, the note, and the dashboard captures.
//
// Screenshots can arrive three ways, because the month's work is done with a
// dashboard open in the other window: the file picker, a drag from the
// desktop, or Ctrl+V straight from the Snipping Tool. The card is focusable so
// paste has somewhere to land.
// ---------------------------------------------------------------------------

const numberText = (v: number | null | undefined): string =>
  typeof v === 'number' ? String(v) : ''

/** Blank clears the field; anything unparseable leaves the stored value alone. */
function parseNumber(raw: string): number | null | undefined {
  const trimmed = raw.trim().replace(/%$/, '')
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : undefined
}

function Thumbnail({
  image,
  onRemove,
}: {
  image: CqmpImageRef
  onRemove: () => void
}) {
  const [url, setUrl] = useState<string>()
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let revoked = false
    let current: string | undefined
    void getScreenshotUrl(image.key).then((u) => {
      if (revoked) {
        if (u) URL.revokeObjectURL(u)
        return
      }
      current = u
      if (u) setUrl(u)
      else setMissing(true)
    })
    return () => {
      revoked = true
      if (current) URL.revokeObjectURL(current)
    }
  }, [image.key])

  return (
    <figure className="shot">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" title="Open full size">
          <img src={url} alt={image.name} />
        </a>
      ) : (
        <div className="shot-missing">{missing ? 'Not on this device' : 'Loading…'}</div>
      )}
      <figcaption>
        <span className="truncate" title={image.name}>
          {image.name}
        </span>
        <button className="link-btn" onClick={onRemove} aria-label={`Remove ${image.name}`}>
          Remove
        </button>
      </figcaption>
    </figure>
  )
}

export default function MetricCard({
  reportId,
  opId,
  kpiId,
  metric,
  prior,
}: {
  reportId: string
  opId: string
  kpiId: CqmpKpiId
  metric: CqmpMetric
  prior?: CqmpMetric
}) {
  const kpi = CQMP_KPIS[kpiId]
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const status = statusOf(metric)

  const target = targetFor(metric)
  const delta = deltaOf(metric, prior)
  const derived = metric.numerator != null && metric.denominator != null

  function patch(p: Partial<CqmpMetric>): void {
    updateMetric(reportId, opId, kpiId, p)
  }

  /**
   * Case counts win when both are present: the percentage the dashboard shows
   * IS numerator over denominator, so letting the two disagree on the same
   * slide would put the argument in the room rather than the result.
   */
  function setCount(field: 'numerator' | 'denominator', raw: string): void {
    const parsed = parseNumber(raw)
    if (parsed === undefined) return
    const next = { ...metric, [field]: parsed }
    const value =
      next.numerator != null && next.denominator != null
        ? percentOf(next.numerator, next.denominator)
        : metric.value
    patch({ [field]: parsed, value })
  }

  async function takeFiles(files: FileList | File[] | null | undefined): Promise<void> {
    const list = [...(files ?? [])].filter((f) => !f.type || f.type.startsWith('image/'))
    if (list.length === 0) return
    setBusy(true)
    try {
      for (const file of list) {
        const ref = await addScreenshot(file, `${opId}-${kpiId}`)
        addMetricImage(reportId, opId, kpiId, ref)
      }
    } catch (err) {
      notifyUser(err instanceof Error ? err.message : 'That screenshot could not be added.', 'warn')
    } finally {
      setBusy(false)
    }
  }

  function remove(image: CqmpImageRef): void {
    removeMetricImage(reportId, opId, kpiId, image.key)
    void deleteScreenshot(image.key)
  }

  return (
    <div
      className={`card metric-card${dragging ? ' dropping' : ''}`}
      tabIndex={0}
      onPaste={(e) => {
        const files = [...e.clipboardData.files]
        if (files.length === 0) return
        e.preventDefault()
        void takeFiles(files)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        void takeFiles(e.dataTransfer.files)
      }}
    >
      <div className="metric-head">
        <div className="grow">
          <div className="title">{kpi.name}</div>
          <div className="subtle" style={{ fontSize: 12 }}>
            {kpi.source}
          </div>
        </div>
        <span
          className={`pill ${status === 'met' ? 'ok' : status === 'below' ? 'crit' : 'muted'}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`${opId}-${kpiId}-value`}>Result %</label>
          <DebouncedInput
            id={`${opId}-${kpiId}-value`}
            value={numberText(metric.value)}
            inputMode="decimal"
            placeholder="e.g. 80.00"
            disabled={derived}
            title={derived ? 'Calculated from the case counts' : undefined}
            onCommit={(raw) => {
              const parsed = parseNumber(raw)
              if (parsed !== undefined) patch({ value: parsed })
            }}
          />
        </div>
        {/* Fixed, and the same for every operation. Shown rather than asked
            for — it is not a decision anyone makes at the keyboard, and an
            input invites a typo into a number that is not in question. */}
        <div className="field">
          <label htmlFor={`${opId}-${kpiId}-target`}>Target</label>
          <output
            id={`${opId}-${kpiId}-target`}
            className="fixed-value"
            title="Set for the whole region — the same on every operation"
          >
            {target === null ? '—' : `${target}%`}
          </output>
        </div>
        <div className="field">
          <label htmlFor={`${opId}-${kpiId}-num`}>Cases met</label>
          <DebouncedInput
            id={`${opId}-${kpiId}-num`}
            value={numberText(metric.numerator)}
            inputMode="numeric"
            placeholder="optional"
            onCommit={(raw) => setCount('numerator', raw)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${opId}-${kpiId}-den`}>Cases total</label>
          <DebouncedInput
            id={`${opId}-${kpiId}-den`}
            value={numberText(metric.denominator)}
            inputMode="numeric"
            placeholder="optional"
            onCommit={(raw) => setCount('denominator', raw)}
          />
        </div>
      </div>

      <div className="subtle" style={{ fontSize: 12, marginTop: -4 }}>
        {derived && 'Result is calculated from the case counts. '}
        {isReported(metric) && delta !== null && (
          <>
            {delta === 0
              ? 'No change on last month. '
              : `${delta > 0 ? '▲ +' : '▼ −'}${Math.abs(delta).toFixed(2)} pts on last month. `}
          </>
        )}
        {!isReported(metric) && 'No result yet — this measure will show as not reported. '}
      </div>

      <div className="field">
        <label htmlFor={`${opId}-${kpiId}-notes`}>Notes for the slide</label>
        <DebouncedInput
          id={`${opId}-${kpiId}-notes`}
          multiline
          value={metric.notes ?? ''}
          placeholder="What explains this number, and what is being done about it"
          onCommit={(v) => patch({ notes: v })}
        />
      </div>

      <div className="shots">
        {metric.images.map((image) => (
          <Thumbnail key={image.key} image={image} onRemove={() => remove(image)} />
        ))}
        <button
          className="btn sm"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {busy ? 'Adding…' : '＋ Screenshot'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void takeFiles(e.target.files)
            // Cleared so re-picking the same file fires change again.
            e.target.value = ''
          }}
        />
        <span className="subtle" style={{ fontSize: 12 }}>
          or drop an image here, or click the card and press Ctrl+V
        </span>
      </div>
    </div>
  )
}
