// ---------------------------------------------------------------------------
// A document as data.
//
// The four program documents K.A.R. 109-17-3 retains — the syllabus, the
// curriculum and lesson plans, the clinical and field objectives, the policy
// manual — now have two audiences with two different needs. A KBEMS reviewer
// wants a .docx to file. A Program Manager standing in the app wants to press a
// button and get the same document, without a repository and without Node.
//
// The obvious way to serve both is to write each document twice, and that is
// exactly the failure this whole set of generators exists to prevent. A
// syllabus that says 80% in Word and 75% on screen is not a formatting
// inconsistency; it is two different courses described to two different people,
// and the one that gets audited is whichever is wrong.
//
// So a document is a Block[] — a neutral tree that knows nothing about docx or
// HTML — built once in src/data/programDocs/, and rendered twice: to docx by
// scripts/lib/doc-render.mjs for the filed copy, and to HTML by lib/docHtml.ts
// for the copy the app produces and retains. There is one source for each
// document, so the two copies cannot disagree about anything.
// ---------------------------------------------------------------------------

/** A table cell: one line, or several stacked in the same cell. */
export type DocCell = string | string[]

export type Block =
  | { k: 'cover'; title: string; subtitle?: string; cohort: string }
  | { k: 'h1'; text: string }
  | { k: 'h2'; text: string }
  | { k: 'h3'; text: string }
  | { k: 'p'; text: string; bold?: boolean; italics?: boolean; small?: boolean }
  | { k: 'bullet'; text: string; level?: number; bold?: boolean; italics?: boolean }
  /** A tick box somebody fills in on paper. */
  | { k: 'task'; text: string }
  /** A ruled line to write on; `label` sits above it. */
  | { k: 'rule'; label?: string; tall?: boolean }
  | { k: 'spacer'; after?: number }
  | { k: 'pageBreak' }
  | {
      k: 'table'
      /**
       * DXA widths, which must sum to the content width. Word silently
       * rescales a table that does not, and it stops lining up with its
       * neighbours; HTML derives percentages from the same numbers so the two
       * renderings have the same column proportions.
       */
      cols: number[]
      header?: string[]
      rows: DocCell[][]
      /** A full-width heading row inside the table, for grouped listings. */
      small?: boolean
    }
  /**
   * The document-control line. Every one of these is DISPOSABLE — the copy in
   * somebody's hands is a snapshot and the source of truth is the course
   * record. Saying so on the page is what stops a stale printout being treated
   * as the record three years later.
   */
  | { k: 'provenance'; command: string; startDate: string; endDate: string; weeks: number }

export const cover = (title: string, subtitle: string | undefined, cohort: string): Block => ({
  k: 'cover',
  title,
  subtitle,
  cohort,
})
export const h1 = (text: string): Block => ({ k: 'h1', text })
export const h2 = (text: string): Block => ({ k: 'h2', text })
export const h3 = (text: string): Block => ({ k: 'h3', text })
export const p = (
  text: string,
  opts: { bold?: boolean; italics?: boolean; small?: boolean } = {},
): Block => ({ k: 'p', text, ...opts })
export const bullet = (
  text: string,
  opts: { level?: number; bold?: boolean; italics?: boolean } = {},
): Block => ({ k: 'bullet', text, ...opts })
export const task = (text: string): Block => ({ k: 'task', text })
export const rule = (label?: string, opts: { tall?: boolean } = {}): Block => ({
  k: 'rule',
  label,
  ...opts,
})
export const spacer = (after?: number): Block => ({ k: 'spacer', after })
export const pageBreak = (): Block => ({ k: 'pageBreak' })
export const table = (
  cols: number[],
  header: string[] | undefined,
  rows: DocCell[][],
  opts: { small?: boolean } = {},
): Block => ({ k: 'table', cols, header, rows, ...opts })

/** Page geometry, shared so the two renderers agree on column proportions. */
export const CONTENT_WIDTH = 10080

/**
 * Strip developer references out of a note before it is printed.
 *
 * Several `note` fields on the course record were written for whoever is
 * reading the source — "see data/aemtPhases.ts". That is right where it is, and
 * wrong in a lesson plan handed to a lab instructor, who has no repository and
 * no reason to want one. The clause is removed rather than the whole note,
 * because the sentence in front of it is usually the part that matters.
 */
export const printable = (text: string | undefined): string =>
  (text ?? '')
    .replace(/[\s—,;(]*\bsee\s+[^.;]*?\.(?:ts|tsx|mjs|js)\b\.?/gi, '')
    .replace(/\b(?:src|scripts|data|modules)\/[\w/.-]+\.(?:ts|tsx|mjs|js)\b/g, 'the course record')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;])/g, '$1')
    .trim()

// ----- dates -----------------------------------------------------------------
//
// The documents want dates written the way a reader expects them, which is not
// how the app writes them elsewhere. Kept here rather than in lib/date so the
// document set has one spelling of a date across both renderings.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const parts = (iso: string): number[] => iso.split('-').map(Number)

export const longDate = (iso: string): string => {
  const [y, m, d] = parts(iso)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}
export const shortDate = (iso: string): string => {
  const [y, m, d] = parts(iso)
  return `${m}.${d}.${y}`
}
export const weekdayOf = (iso: string): string => {
  const [y, m, d] = parts(iso)
  return DAYS[new Date(y, m - 1, d).getDay()]
}
export const dayDate = (iso: string): string => {
  const [, m, d] = parts(iso)
  return `${weekdayOf(iso)} ${m}/${d}`
}
