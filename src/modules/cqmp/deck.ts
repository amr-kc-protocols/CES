import type PptxGenJS from 'pptxgenjs'
import { monthLabel } from '../../lib/date'
import { marketName, type Market } from '../../lib/market'
import { CQMP_KPIS, CQMP_OPERATIONS, cqmpKpiName, cqmpOperationName, type CqmpKpiId } from '../../data/cqmp'
import { deltaOf, findMetric, isReported, STATUS_LABEL, statusOf } from './cqmpStore'
import { getScreenshotDataUrl } from './images'
import type { CqmpMetric, CqmpReport } from '../../types'

// ---------------------------------------------------------------------------
// The monthly CQMP deck.
//
// Built here rather than by hand every month, in the house style: white
// slides, a deep blue band, one measure per slide with the dashboard capture
// next to the number it came from. The palette follows Global Medical
// Response's own — deep blue and white, one brighter blue for accents —
// because the deck is presented alongside GMR's material and a fourth colour
// scheme in the room helps nobody.
//
// Everything the deck says comes from the report record. Nothing is inferred,
// nothing is filled in with a plausible default: a measure with no result
// prints "Not reported", not a zero, and a measure with no target prints the
// result with no met/not-met call. A slide that quietly invents a number is
// worse than a slide with a gap in it.
//
// pptxgenjs is loaded on demand (~120 KB gzipped). It is only ever needed the
// moment someone presses Generate, and only administrators can.
// ---------------------------------------------------------------------------

// ----- theme ---------------------------------------------------------------

const NAVY = '00365F'
const BLUE = '0072CE'
const LIGHT = 'EAF1F8'
const WHITE = 'FFFFFF'
const INK = '1B2733'
const MUTED = '5B6B7C'
const RULE = 'C8D6E5'
const GREEN = '1B7F4B'
const RED = 'B3261E'

const FONT = 'Segoe UI'

/** 16:9 at pptxgenjs' inch scale. */
const SLIDE_W = 10
const SLIDE_H = 5.625
const MARGIN = 0.45
const HEADER_H = 0.72
const BODY_W = SLIDE_W - MARGIN * 2

// ----- input ---------------------------------------------------------------

export interface DeckOptions {
  report: CqmpReport
  /** The month before, when there is one — drives the "vs. prior" column. */
  prior?: CqmpReport
  market: Market
}

/** A measure with its screenshots resolved to embeddable data URLs. */
interface PreparedMetric {
  opId: string
  kpiId: string
  metric: CqmpMetric
  prior?: CqmpMetric
  images: { dataUrl: string; width: number; height: number; name: string }[]
  /** Screenshots the record references but this device no longer holds. */
  missingImages: number
}

// ----- helpers -------------------------------------------------------------

const pct = (v: number | null | undefined): string =>
  typeof v === 'number' ? `${v.toFixed(2)}%` : '—'

function deltaText(current: CqmpMetric | undefined, prior: CqmpMetric | undefined): string {
  const d = deltaOf(current, prior)
  if (d === null) return '—'
  if (d === 0) return 'no change'
  // Minus sign, not a hyphen: at 12pt on a projector a hyphen reads as a dash.
  return `${d > 0 ? '▲ +' : '▼ −'}${Math.abs(d).toFixed(2)} pts`
}

function deltaColor(current: CqmpMetric | undefined, prior: CqmpMetric | undefined): string {
  const d = deltaOf(current, prior)
  if (d === null || d === 0) return MUTED
  return d > 0 ? GREEN : RED
}

function statusColor(m: CqmpMetric | undefined): string {
  const s = statusOf(m)
  if (s === 'met') return GREEN
  if (s === 'below') return RED
  return MUTED
}

function caseCount(m: CqmpMetric): string | null {
  if (typeof m.numerator !== 'number' || typeof m.denominator !== 'number') return null
  return `n = ${m.numerator} of ${m.denominator}`
}

/** Fit w×h inside a box, centred — PowerPoint stretches whatever it is given. */
function contain(
  imgW: number,
  imgH: number,
  box: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  if (!imgW || !imgH) return box
  const scale = Math.min(box.w / imgW, box.h / imgH)
  const w = imgW * scale
  const h = imgH * scale
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }
}

/**
 * Load the screenshots for every measure that has anything to show.
 *
 * Done up front, and tolerantly: an image the device no longer holds (the
 * report synced from another machine, or the browser cleared its storage) is
 * counted rather than thrown, and the slide says so.
 */
async function prepare(opts: DeckOptions): Promise<PreparedMetric[]> {
  const out: PreparedMetric[] = []
  for (const op of CQMP_OPERATIONS) {
    for (const kpiId of op.kpis) {
      const metric = findMetric(opts.report, op.id, kpiId)
      if (!metric) continue
      // Skip measures nobody has touched. The summary table still lists them
      // as not reported, so the gap shows without a slide of blanks.
      if (!isReported(metric) && metric.images.length === 0 && !metric.notes?.trim()) continue

      const images: PreparedMetric['images'] = []
      let missing = 0
      for (const ref of metric.images) {
        const dataUrl = await getScreenshotDataUrl(ref.key)
        if (dataUrl) images.push({ dataUrl, width: ref.width, height: ref.height, name: ref.name })
        else missing++
      }
      out.push({
        opId: op.id,
        kpiId,
        metric,
        prior: findMetric(opts.prior, op.id, kpiId),
        images,
        missingImages: missing,
      })
    }
  }
  return out
}

// ----- slides --------------------------------------------------------------

// Type-only import: erased at compile time, so the library is still loaded
// on demand by the dynamic import in buildDeck.
type Pptx = PptxGenJS
type Slide = ReturnType<Pptx['addSlide']>
type TableRow = Parameters<Slide['addTable']>[0][number]

function titleSlide(pptx: Pptx, opts: DeckOptions): void {
  const slide = pptx.addSlide()
  slide.background = { color: NAVY }

  slide.addShape('rect', { x: 0, y: 2.02, w: 1.15, h: 0.06, fill: { color: BLUE } })
  slide.addText('Clinical Quality Management Plan', {
    x: MARGIN, y: 1.3, w: BODY_W, h: 0.45,
    fontFace: FONT, fontSize: 20, color: WHITE, bold: true, charSpacing: 1,
  })
  slide.addText(`${monthLabel(opts.report.month)} KPI Review`, {
    x: MARGIN, y: 2.25, w: BODY_W, h: 0.9,
    fontFace: FONT, fontSize: 40, color: WHITE, bold: true,
  })
  slide.addText(marketName(opts.market), {
    x: MARGIN, y: 3.15, w: BODY_W, h: 0.4,
    fontFace: FONT, fontSize: 18, color: 'BBD2E6',
  })
  slide.addText(CQMP_OPERATIONS.map((o) => `${o.name} · ${o.model}`).join('     |     '), {
    x: MARGIN, y: 3.6, w: BODY_W, h: 0.35,
    fontFace: FONT, fontSize: 12, color: '9FBBD4',
  })

  const footer = [
    opts.report.presenter ? `Presented by ${opts.report.presenter}` : null,
    `Prepared ${new Date().toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })}`,
  ]
    .filter(Boolean)
    .join('     ·     ')
  slide.addText(footer, {
    x: MARGIN, y: 4.75, w: BODY_W, h: 0.3,
    fontFace: FONT, fontSize: 11, color: '9FBBD4',
  })
}

function header(slide: Slide, title: string, right: string): void {
  slide.addText(title, {
    x: MARGIN, y: 0.06, w: BODY_W - 2.2, h: HEADER_H - 0.12,
    fontFace: FONT, fontSize: 18, color: WHITE, bold: true, valign: 'middle',
  })
  slide.addText(right, {
    x: SLIDE_W - MARGIN - 2.2, y: 0.06, w: 2.2, h: HEADER_H - 0.12,
    fontFace: FONT, fontSize: 11, color: 'BBD2E6', align: 'right', valign: 'middle',
  })
}

function summarySlide(pptx: Pptx, opts: DeckOptions): void {
  const slide = pptx.addSlide({ masterName: 'CONTENT' })
  header(slide, 'KPI Summary', monthLabel(opts.report.month))

  const head = ['Operation', 'Measure', 'Result', 'Target', 'vs. prior', 'Status'].map((t) => ({
    text: t,
    options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 11 },
  }))

  const rows: TableRow[] = [head]
  for (const op of CQMP_OPERATIONS) {
    for (const kpiId of op.kpis) {
      const m = findMetric(opts.report, op.id, kpiId)
      const p = findMetric(opts.prior, op.id, kpiId)
      const reported = isReported(m)
      rows.push([
        { text: op.name, options: { color: INK } },
        { text: CQMP_KPIS[kpiId].short, options: { color: INK } },
        {
          text: reported ? pct(m!.value) : 'Not reported',
          options: { bold: reported, color: reported ? INK : MUTED, align: 'center' },
        },
        { text: pct(m?.target ?? null), options: { color: MUTED, align: 'center' } },
        { text: deltaText(m, p), options: { color: deltaColor(m, p), align: 'center' } },
        { text: STATUS_LABEL[statusOf(m)], options: { color: statusColor(m), bold: true, align: 'center' } },
      ])
    }
  }

  slide.addTable(rows, {
    x: MARGIN, y: HEADER_H + 0.35, w: BODY_W,
    colW: [1.85, 2.1, 1.35, 1.15, 1.3, 1.35],
    rowH: 0.34,
    fontFace: FONT,
    fontSize: 11,
    border: { type: 'solid', color: RULE, pt: 1 },
    align: 'left',
    valign: 'middle',
    margin: 5,
  })

  const unreported = CQMP_OPERATIONS.flatMap((op) =>
    op.kpis.filter((k) => !isReported(findMetric(opts.report, op.id, k))),
  ).length
  if (unreported > 0) {
    slide.addText(
      `${unreported} measure${unreported === 1 ? '' : 's'} not reported this month.`,
      {
        x: MARGIN, y: SLIDE_H - 0.95, w: BODY_W, h: 0.3,
        fontFace: FONT, fontSize: 10, color: MUTED, italic: true,
      },
    )
  }
}

function metricSlide(pptx: Pptx, opts: DeckOptions, pm: PreparedMetric): void {
  const slide = pptx.addSlide({ masterName: 'CONTENT' })
  const kpi = CQMP_KPIS[pm.kpiId as CqmpKpiId]
  header(
    slide,
    `${cqmpOperationName(pm.opId)} — ${cqmpKpiName(pm.kpiId)}`,
    monthLabel(opts.report.month),
  )

  const m = pm.metric
  const notes = m.notes?.trim()
  const notesH = notes ? 0.95 : 0
  const panelY = HEADER_H + 0.6
  const panelH = SLIDE_H - panelY - 0.45 - notesH

  // What the measure counts, and where the capture came from — one small line
  // under the header. Both belong on the slide (a room full of people will ask
  // exactly these two questions) and neither is worth a second of the eye.
  slide.addText(
    [kpi?.definition, kpi ? `Source: ${kpi.source}` : null].filter(Boolean).join('   ·   '),
    {
      x: MARGIN, y: HEADER_H + 0.12, w: BODY_W, h: 0.42,
      fontFace: FONT, fontSize: 9, color: MUTED, valign: 'top',
    },
  )

  // ----- left: the number itself -------------------------------------------
  const colW = 2.75
  slide.addShape('rect', { x: MARGIN, y: panelY, w: colW, h: panelH, fill: { color: LIGHT } })
  // Sized to the string, not fixed: "100.00%" at the same size as "80.00%"
  // wraps onto a second line and lands on the status label underneath, and
  // 100% is the number this panel shows most often.
  const headline = isReported(m) ? pct(m.value) : 'Not reported'
  const headlineSize = !isReported(m) ? 18 : headline.length >= 7 ? 29 : 34
  slide.addText(headline, {
    x: MARGIN + 0.08, y: panelY + 0.18, w: colW - 0.16, h: 0.75,
    fontFace: FONT, fontSize: headlineSize, bold: true,
    color: isReported(m) ? NAVY : MUTED, align: 'center', valign: 'middle',
  })
  slide.addText(STATUS_LABEL[statusOf(m)], {
    x: MARGIN + 0.15, y: panelY + 0.95, w: colW - 0.3, h: 0.28,
    fontFace: FONT, fontSize: 12, bold: true, color: statusColor(m), align: 'center',
  })

  const facts: { label: string; value: string; color: string }[] = [
    { label: 'Target', value: pct(m.target), color: INK },
    {
      label: opts.prior ? `vs. ${monthLabel(opts.prior.month)}` : 'vs. prior month',
      value: deltaText(m, pm.prior),
      color: deltaColor(m, pm.prior),
    },
  ]
  const cases = caseCount(m)
  if (cases) facts.push({ label: 'Cases', value: cases, color: INK })

  facts.forEach((f, i) => {
    const y = panelY + 1.4 + i * 0.5
    slide.addText(f.label, {
      x: MARGIN + 0.15, y, w: colW - 0.3, h: 0.2,
      fontFace: FONT, fontSize: 9, color: MUTED, charSpacing: 0.6,
    })
    slide.addText(f.value, {
      x: MARGIN + 0.15, y: y + 0.18, w: colW - 0.3, h: 0.26,
      fontFace: FONT, fontSize: 13, bold: true, color: f.color,
    })
  })

  // ----- right: the dashboard capture ---------------------------------------
  const box = {
    x: MARGIN + colW + 0.25,
    y: panelY,
    w: BODY_W - colW - 0.25,
    h: panelH,
  }
  slide.addShape('rect', { ...box, fill: { color: WHITE }, line: { color: RULE, width: 1 } })

  const first = pm.images[0]
  if (first) {
    const inner = { x: box.x + 0.08, y: box.y + 0.08, w: box.w - 0.16, h: box.h - 0.16 }
    const fit = contain(first.width, first.height, inner)
    slide.addImage({ data: first.dataUrl, ...fit, altText: `${cqmpKpiName(pm.kpiId)} dashboard` })
  } else {
    slide.addText(
      pm.missingImages > 0
        ? 'Screenshot not available on this device'
        : 'No dashboard screenshot attached',
      {
        x: box.x, y: box.y, w: box.w, h: box.h,
        fontFace: FONT, fontSize: 12, color: MUTED, align: 'center', valign: 'middle', italic: true,
      },
    )
  }

  // ----- notes ---------------------------------------------------------------
  if (notes) {
    const y = SLIDE_H - 0.45 - notesH + 0.06
    slide.addShape('rect', { x: MARGIN, y, w: BODY_W, h: notesH - 0.12, fill: { color: LIGHT } })
    slide.addText(
      [
        { text: 'Notes   ', options: { bold: true, color: NAVY, fontSize: 10 } },
        { text: notes, options: { color: INK, fontSize: 11 } },
      ],
      {
        x: MARGIN + 0.15, y: y + 0.06, w: BODY_W - 0.3, h: notesH - 0.24,
        fontFace: FONT, valign: 'middle',
      },
    )
  }

  // Extra captures get a slide each rather than being shrunk to fit alongside
  // the first — the axis labels are the point of showing them at all.
  pm.images.slice(1).forEach((img, i) => {
    const extra = pptx.addSlide({ masterName: 'CONTENT' })
    header(
      extra,
      `${cqmpOperationName(pm.opId)} — ${cqmpKpiName(pm.kpiId)} (${i + 2})`,
      monthLabel(opts.report.month),
    )
    const area = { x: MARGIN, y: panelY, w: BODY_W, h: SLIDE_H - panelY - 0.45 }
    extra.addShape('rect', { ...area, fill: { color: WHITE }, line: { color: RULE, width: 1 } })
    const fit = contain(img.width, img.height, {
      x: area.x + 0.08, y: area.y + 0.08, w: area.w - 0.16, h: area.h - 0.16,
    })
    extra.addImage({ data: img.dataUrl, ...fit, altText: img.name })
  })
}

function closingSlide(pptx: Pptx, opts: DeckOptions): void {
  const summary = opts.report.summary?.trim()
  if (!summary) return
  const slide = pptx.addSlide({ masterName: 'CONTENT' })
  header(slide, 'Summary & Action Items', monthLabel(opts.report.month))

  // One bullet per line, so the notes field can be written as a list.
  const lines = summary.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  slide.addText(
    lines.map((text) => ({ text, options: { bullet: { code: '2022' }, breakLine: true } })),
    {
      x: MARGIN + 0.1, y: HEADER_H + 0.4, w: BODY_W - 0.2, h: SLIDE_H - HEADER_H - 1.1,
      fontFace: FONT, fontSize: 14, color: INK, lineSpacingMultiple: 1.3, valign: 'top',
    },
  )
}

// ----- entry point ----------------------------------------------------------

export function deckFilename(report: CqmpReport, market: Market): string {
  const place = marketName(market).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `CQMP_KPI_Review_${report.month}_${place}.pptx`
}

/**
 * Build the deck and hand back the .pptx bytes. The caller does the download,
 * so this stays testable and has no opinion about the browser.
 */
export async function buildDeck(opts: DeckOptions): Promise<Blob> {
  const prepared = await prepare(opts)
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()

  pptx.layout = 'LAYOUT_16x9'
  pptx.title = `CQMP KPI Review — ${monthLabel(opts.report.month)}`
  pptx.subject = 'Clinical Quality Management Plan monthly KPI review'
  pptx.company = 'Global Medical Response'
  if (opts.report.presenter) pptx.author = opts.report.presenter

  pptx.defineSlideMaster({
    title: 'CONTENT',
    background: { color: WHITE },
    objects: [
      { rect: { x: 0, y: 0, w: SLIDE_W, h: HEADER_H, fill: { color: NAVY } } },
      { rect: { x: 0, y: HEADER_H, w: SLIDE_W, h: 0.045, fill: { color: BLUE } } },
      {
        text: {
          text: `Clinical Quality Management Plan  ·  ${marketName(opts.market)}`,
          options: {
            x: MARGIN, y: SLIDE_H - 0.36, w: BODY_W - 0.8, h: 0.25,
            fontFace: FONT, fontSize: 9, color: MUTED,
          },
        },
      },
    ],
    slideNumber: {
      x: SLIDE_W - MARGIN - 0.4, y: SLIDE_H - 0.36, w: 0.4, h: 0.25,
      align: 'right', fontFace: FONT, fontSize: 9, color: MUTED,
    },
  })

  titleSlide(pptx, opts)
  summarySlide(pptx, opts)
  for (const pm of prepared) metricSlide(pptx, opts, pm)
  closingSlide(pptx, opts)

  const out = await pptx.write({ outputType: 'blob' })
  return out as Blob
}

/** Build and save. Returns the filename that was offered to the browser. */
export async function downloadDeck(opts: DeckOptions): Promise<string> {
  const blob = await buildDeck(opts)
  const filename = deckFilename(opts.report, opts.market)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.append(a)
  a.click()
  // Attached, then revoked on a later tick — a detached anchor and a
  // synchronous revoke race the download in Firefox and Safari.
  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 0)
  return filename
}
