// ---------------------------------------------------------------------------
// Turning an ImageTrend PCR export into something a parser can read.
//
// The PDF is read IN THE BROWSER and never leaves it. Dropping thirty charts on
// this screen must not mean shipping thirty patients' records to a server, so
// pdf.js runs client-side, the file is held in memory, and nothing but the run
// number and the review answers is ever kept.
//
// THE FONT IS THE STRUCTURE. ImageTrend prints every field label in one font
// and every value in another, and it does this everywhere — form fields, table
// headers, table cells. So a run of consecutive same-font items is a label or a
// value, and "label run, then value run" recovers the form. Two things that
// look more obvious both fail:
//
//   - Grouping items by y position, to rebuild lines. The form is two columns,
//     so a line holds two unrelated fields and every value ends up split across
//     three of them.
//   - Reading the flat text and stopping each value at the next "Word:". A
//     value like "Non- Emergent EMS Vehicle (Unit) Number:" matches that
//     pattern from its own first character, so every field comes back empty.
//
// Words still break mid-token wherever a narrow table cell wraps ("Milligra" /
// "ms (mg)", "Intrav" / "enous"). Nothing can stitch those back reliably, so
// matching is done against text with the spaces removed and the broken word
// matches on its prefix.
// ---------------------------------------------------------------------------

import { installPdfCompat, shimmedWorkerUrl } from './pdfCompat'

export interface PcrItem {
  page: number
  x: number
  y: number
  str: string
  font: string
}

/** A run of consecutive items sharing a font: one label, one value, or chrome. */
export interface PcrRun {
  page: number
  /** y of the run's first item, used to spot a block continued from the page before. */
  top: number
  kind: 'label' | 'value' | 'chrome'
  text: string
}

export interface PcrField {
  page: number
  label: string
  value: string
}

export interface PcrDoc {
  items: PcrItem[]
  runs: PcrRun[]
  fields: PcrField[]
  /** One entry per page, items in order. */
  pages: string[]
  /** Every page joined. */
  text: string
}

/** A single chart's slice of an export. */
export interface PcrView {
  runs: PcrRun[]
  fields: PcrField[]
  text: string
  /** Value runs only — form values and table cells, no labels, no chrome. */
  valueText: string
}

/** An upward y jump larger than this starts a new block. Body text is 10-12pt. */
const BLOCK_GAP = 24

/** Collapse to a comparable form: no spaces, lowercase. */
export function despace(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
}

/** Field labels compare on letters, digits and '#' alone. */
function labelKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9#]/g, '')
}

// Curly quotes are normalised so a label written "Patient's Phone Number" here
// matches whichever quote the export happened to use.
const clean = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

/** Strip the header/footer stamps ImageTrend puts on every page. */
function stripChrome(s: string): string {
  return s
    .replace(/https:\/\/\S+/g, ' ')
    .replace(/\?\s*reason=\S+/g, ' ')
    .replace(/Page \d+ of \d+/g, ' ')
    // Section banners run into the value ahead of them: "Yes ****INCIDENT****".
    .replace(/\*{3,}[A-Z /-]*\*{3,}/g, ' ')
    .replace(/\d{1,2}\/\d{1,2}\/\d{2},\s*\d{1,2}\s*:\s*\d{2}\s*[AP]M/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Build the document model from raw items.
 *
 * Split out from `readPcrPdf` so the checks can drive it with items read by the
 * node build of pdf.js. When the harness reimplements this instead, the harness
 * and the app drift and the checks start passing on text the app never sees.
 */
export function buildPcrDoc(items: PcrItem[]): PcrDoc {
  // Runs first: consecutive, same page, same font, still flowing down the page.
  //
  // The last condition is what keeps "Cardiac Arrest: No" from swallowing a
  // narrative. Text inside one block always runs downwards; when the y jumps
  // back up by more than a line, the writer has moved to a different block. The
  // threshold is generous so that a two-line table cell followed by a one-line
  // one — a small upward step — keeps the table row together.
  type Raw = { page: number; font: string; y: number; top: number; parts: string[] }
  const raw: Raw[] = []
  let prevY = 0
  for (const it of items) {
    const last = raw[raw.length - 1]
    const sameBlock =
      last && last.page === it.page && last.font === it.font && it.y <= prevY + BLOCK_GAP
    if (sameBlock) last.parts.push(it.str)
    else raw.push({ page: it.page, font: it.font, y: it.y, top: it.y, parts: [it.str] })
    prevY = it.y
  }

  // Which font is the label font? The one that ends the most runs with a colon.
  // Counted rather than named, because pdf.js numbers fonts per document and
  // "g_d0_f1" is not a promise.
  const colonEndings = new Map<string, number>()
  const itemCount = new Map<string, number>()
  for (const r of raw) {
    const text = clean(r.parts.join(' '))
    if (/:$/.test(text)) colonEndings.set(r.font, (colonEndings.get(r.font) ?? 0) + 1)
    itemCount.set(r.font, (itemCount.get(r.font) ?? 0) + r.parts.length)
  }
  const best = (m: Map<string, number>, skip?: string) =>
    [...m.entries()].filter(([f]) => f !== skip).sort((a, b) => b[1] - a[1])[0]?.[0]
  const labelFont = best(colonEndings) ?? best(itemCount)
  // The value font is whatever follows labels most often — not simply the
  // second most common font, since on a chart that is mostly narrative the
  // footer font can outweigh it.
  const followers = new Map<string, number>()
  raw.forEach((r, i) => {
    if (r.font !== labelFont) return
    const next = raw[i + 1]
    if (!next || next.font === labelFont) return
    followers.set(next.font, (followers.get(next.font) ?? 0) + 1)
  })
  const valueFont = best(followers) ?? best(itemCount, labelFont)

  const kindOf = (font: string): PcrRun['kind'] =>
    font === labelFont ? 'label' : font === valueFont ? 'value' : 'chrome'
  let runs: PcrRun[] = raw
    .map((r) => ({
      page: r.page,
      top: r.top,
      kind: kindOf(r.font),
      text: stripChrome(clean(r.parts.join(' '))),
    }))
    .filter((r) => r.text)

  // Rejoin blocks the page break cut in half.
  //
  // A block too long for one page continues at the TOP of the next, which puts
  // it after that page's own fields in reading order — a narrative ends up
  // trailing "Cardiac Arrest: No" with nothing tying it to its label. Two
  // things together identify one of these orphans, and both are needed:
  //
  //   - It carries no label of its own: the run before it is another value.
  //     Without this, a narrative that simply starts low on its page — with its
  //     own label right there — gets torn off and pasted onto the page before.
  //   - It starts higher up the page than that page's first run, so it was
  //     placed above content already written. Without this, the second and
  //     third cell runs of an ordinary table each look like an orphan.
  //
  // Its home is the last value run of the preceding page.
  const firstTopOnPage = new Map<number, number>()
  for (const r of runs) if (!firstTopOnPage.has(r.page)) firstTopOnPage.set(r.page, r.top)
  const merged: PcrRun[] = []
  let before: PcrRun | undefined
  for (const r of runs) {
    const isOverflow =
      r.kind === 'value' &&
      before?.kind === 'value' &&
      r.top > (firstTopOnPage.get(r.page) ?? r.top)
    if (r.kind !== 'chrome') before = r
    if (isOverflow) {
      // Walk back to the last value run on a preceding page, stepping over the
      // page footer — which is a run of its own and would otherwise end the
      // search one run short of the block being continued.
      let target = -1
      for (let i = merged.length - 1; i >= 0; i--) {
        if (merged[i].page >= r.page || merged[i].kind === 'chrome') continue
        if (merged[i].kind === 'value') target = i
        break
      }
      if (target >= 0) {
        merged[target] = { ...merged[target], text: `${merged[target].text} ${r.text}` }
        continue
      }
    }
    merged.push(r)
  }
  runs = merged

  // Fields. Within a label run, every colon-terminated segment is a label — the
  // label font never holds values — so an unfilled field is a label with an
  // empty value and only the LAST label in the run takes the value that
  // follows. That is what makes "Number of Patients: # of Patients
  // Transported: Incident Address: 406 E PINE ST" come out right.
  const fields: PcrField[] = []
  runs.forEach((run, i) => {
    if (run.kind !== 'label') return
    const segments = run.text.split(':').map((s) => s.trim()).filter(Boolean)
    // A run with no trailing colon is a table header or a section title.
    const labels = /:\s*$/.test(run.text) ? segments : segments.slice(0, -1)
    if (!labels.length) return
    const next = runs[i + 1]
    const value = next && next.kind === 'value' && next.page === run.page ? next.text : ''
    labels.forEach((label, n) => {
      fields.push({ page: run.page, label, value: n === labels.length - 1 ? value : '' })
    })
  })

  const pages: string[] = []
  const byPage = new Map<number, string[]>()
  for (const it of items) {
    if (!byPage.has(it.page)) byPage.set(it.page, [])
    byPage.get(it.page)!.push(it.str)
  }
  const maxPage = items.length ? Math.max(...items.map((i) => i.page)) : 0
  for (let n = 1; n <= maxPage; n++) pages.push(stripChrome(clean((byPage.get(n) ?? []).join(' '))))

  return { items, runs, fields, pages, text: pages.join(' \n ') }
}

/**
 * Read a PDF into the document model.
 *
 * pdf.js is imported dynamically so it lands in its own chunk — it is by far
 * the largest thing this app depends on, and a coordinator who never imports a
 * PDF should not pay for it on first load.
 */
export async function readPcrPdf(data: ArrayBuffer): Promise<PcrDoc> {
  // Before the import, not after: pdf.js calls Promise.withResolvers in its own
  // top-level code, and Safari below 17.4 does not have it.
  installPdfCompat()
  const pdfjs = await import('pdfjs-dist')
  // Bundled beside the library rather than fetched from a CDN: a CDN worker is
  // both a network dependency and a way for a patient record to be handled
  // somewhere other than this machine.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default
  // On a browser missing what pdf.js assumes, the worker is started through a
  // wrapper that installs the shim in the worker's own global scope first. On
  // every other browser this is undefined and the worker loads as normal.
  const shimmed = shimmedWorkerUrl(workerUrl)
  pdfjs.GlobalWorkerOptions.workerSrc = shimmed ?? workerUrl

  const task = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true })
  const doc = await task.promise
  const items: PcrItem[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    for (const rawItem of content.items) {
      const it = rawItem as { str?: string; transform?: number[]; fontName?: string }
      if (!it.str || !it.str.trim() || !it.transform) continue
      items.push({
        page: n,
        x: it.transform[4],
        y: it.transform[5],
        str: it.str,
        font: it.fontName ?? '',
      })
    }
    page.cleanup()
  }
  // Releases the worker's copy of the file: a patient record should not sit
  // in memory after the screen is done with it.
  await task.destroy()
  if (shimmed) URL.revokeObjectURL(shimmed)

  return buildPcrDoc(items)
}

/** The runs, fields and text for one page range. */
export function sliceDoc(doc: PcrDoc, from: number, to: number): PcrView {
  const runs = doc.runs.filter((r) => r.page >= from && r.page <= to)
  return {
    runs,
    fields: doc.fields.filter((f) => f.page >= from && f.page <= to),
    text: doc.pages.slice(from - 1, to).join(' \n '),
    valueText: runs.filter((r) => r.kind === 'value').map((r) => r.text).join(' \n '),
  }
}

/**
 * A field's value.
 *
 * Returns undefined when the label is absent, so "not in this export" reads
 * differently from "present and blank" — the difference between a question the
 * parser cannot answer and one it can answer No.
 *
 * Matching is exact first, then by suffix, because ImageTrend runs a section
 * title into the label ahead of it: the narrative's label arrives as "Narrative
 * Patient Care Report Narrative".
 */
export function field(view: PcrView, label: string): string | undefined {
  const key = labelKey(label)
  const hit =
    view.fields.find((f) => labelKey(f.label) === key) ??
    view.fields.find((f) => labelKey(f.label).endsWith(key))
  if (!hit) return undefined
  return hit.value
}

/** Every value recorded for a label. */
export function fieldAll(view: PcrView, label: string): string[] {
  const key = labelKey(label)
  return view.fields
    .filter((f) => labelKey(f.label) === key || labelKey(f.label).endsWith(key))
    .map((f) => f.value)
    .filter(Boolean)
}

/** True when the export contains this label at all, filled or not. */
export function hasField(view: PcrView, label: string): boolean {
  const key = labelKey(label)
  return view.fields.some((f) => labelKey(f.label) === key || labelKey(f.label).endsWith(key))
}

/**
 * The cells of a table, found by a phrase from its header row.
 *
 * How a table is read: the header row is one label run and every cell in the
 * table is one value run after it. Every match is collected, not just the
 * first, because a table that runs past the bottom of a page reprints its
 * header on the next one — take only the first and a medication given on page
 * two of the table is invisible.
 *
 * Returns undefined when no header matched, so a table the export omits reads
 * differently from one that is present and empty.
 */
export function tableAfter(view: PcrView, header: string): string | undefined {
  const key = despace(header)
  const parts: string[] = []
  let found = false
  for (let i = 0; i < view.runs.length; i++) {
    if (view.runs[i].kind !== 'label' || !despace(view.runs[i].text).includes(key)) continue
    found = true
    // A header row wide enough to wrap comes through as several label runs, so
    // skip to the end of the header before reading cells, then take every value
    // run until the next label — a table's cells are not always one run.
    let j = i + 1
    while (j < view.runs.length && view.runs[j].kind === 'label') j++
    while (j < view.runs.length && view.runs[j].kind !== 'label') {
      if (view.runs[j].kind === 'value') parts.push(view.runs[j].text)
      j++
    }
  }
  return found ? parts.join(' \n ') : undefined
}
