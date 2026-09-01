// Shared furniture for the generated program documents.
//
// Six documents come out of this repo — the KBEMS application, the syllabus,
// the curriculum and lesson plans, the clinical and field training objectives,
// the policy manual, the blank forms packet, and the student guide. They are
// separate documents because they go to separate people, and they are separate
// scripts because each has its own argument to make. What they must NOT have
// is separate ideas about what the course is.
//
// So the data loader lives here. Every generator reads the same modules the app
// reads, through one function, at one moment — which is the whole reason these
// are generated rather than typed. A syllabus that says 80% and an application
// that says 75% is not a formatting inconsistency; it is two different courses
// described to two different audiences, and the one that gets audited is
// whichever one is wrong.
//
// The docx helpers are here for the duller reason: they were copied between two
// scripts already and had begun to drift on spacing.

import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { build } from 'esbuild'
import {
  AlignmentType,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '..', '..')
const SRC = join(ROOT, 'src')

/**
 * Load the course data the way the app sees it.
 *
 * Bundled through esbuild rather than imported, because these are TypeScript
 * modules with a dependency graph — and running them is also the cheapest
 * possible check that the app would start, which is why the application
 * generator has always done it this way.
 */
export async function loadCourse() {
  const out = join(tmpdir(), `ces-doc-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`)
  await build({
    stdin: {
      contents:
        `export * from ${JSON.stringify(join(SRC, 'data/aemt'))}\n` +
        `export * as A from ${JSON.stringify(join(SRC, 'data/aemtAssessments'))}\n` +
        `export * as N from ${JSON.stringify(join(SRC, 'data/navigateAssets'))}\n` +
        `export * as P from ${JSON.stringify(join(SRC, 'data/aemtPhases'))}\n` +
        `export * as F from ${JSON.stringify(join(SRC, 'data/aemtForms'))}\n` +
        `export * as R from ${JSON.stringify(join(SRC, 'data/aemtRecords'))}\n` +
        `export * as K from ${JSON.stringify(join(SRC, 'data/aemtSkills'))}\n` +
        `export * as S from ${JSON.stringify(join(SRC, 'data/aemtSites'))}\n` +
        `export * as STD from ${JSON.stringify(join(SRC, 'data/aemtStandards'))}\n` +
        // The document bodies themselves. Written in src/ because the app
        // builds and retains the same documents; a generator here that held its
        // own copy of the prose would be the drift this whole set prevents.
        `export * as DOCS from ${JSON.stringify(join(SRC, 'data/programDocs'))}\n` +
        // The app's own renderer and builder registry, so a check can render
        // the same tree both ways and compare.
        `export { docHtml } from ${JSON.stringify(join(SRC, 'lib/docHtml'))}\n` +
        `export { longDate, shortDate, weekdayOf, dayDate } from ${JSON.stringify(join(SRC, 'lib/docBlocks'))}\n` +
        `export { DOC_BUILDERS as BUILDERS } from ${JSON.stringify(join(SRC, 'modules/aemt/programDocBuild'))}\n`,
      resolveDir: SRC,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: out,
  })
  const m = await import(pathToFileURL(out).href)
  rmSync(out, { force: true })
  return m
}

// ----- dates -----------------------------------------------------------------

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const parts = (iso) => iso.split('-').map(Number)

export const longDate = (iso) => { const [y, m, d] = parts(iso); return `${MONTHS[m - 1]} ${d}, ${y}` }
export const shortDate = (iso) => { const [y, m, d] = parts(iso); return `${m}.${d}.${y}` }
export const weekdayOf = (iso) => { const [y, m, d] = parts(iso); return DAYS[new Date(y, m - 1, d).getDay()] }
export const dayDate = (iso) => { const [, m, d] = parts(iso); return `${weekdayOf(iso)} ${m}/${d}` }

// ----- page geometry ---------------------------------------------------------

export const LETTER = { width: 12240, height: 15840 }
export const MARGIN = 1080
export const CONTENT_WIDTH = LETTER.width - MARGIN * 2
export const PAGE = { size: LETTER, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } }

export const BULLET_REF = 'doc-bullets'
export const NUMBERING = {
  config: [
    {
      reference: BULLET_REF,
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 860, hanging: 260 } } } },
      ],
    },
  ],
}

// ----- blocks ----------------------------------------------------------------

export const P = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 130, before: opts.before },
    alignment: opts.align,
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size ?? 22, color: opts.color })],
  })

export const H1 = (text) =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 340, after: 150 }, children: [new TextRun({ text, bold: true, size: 30 })] })

export const H2 = (text) =>
  new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 230, after: 100 }, children: [new TextRun({ text, bold: true, size: 24 })] })

export const H3 = (text) =>
  new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 }, children: [new TextRun({ text, bold: true, size: 22 })] })

export const BULLET = (text, level = 0, opts = {}) =>
  new Paragraph({
    numbering: { reference: BULLET_REF, level },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, bold: opts.bold, italics: opts.italics })],
  })

/** A tick box somebody fills in on paper. */
export const TASK = (text, level = 0) =>
  new Paragraph({
    spacing: { after: 60 },
    indent: { left: 380 + level * 360, hanging: 320 },
    children: [new TextRun({ text: `☐  ${text}`, size: 22 })],
  })

/** A ruled line to write on. `label` sits above it. */
export const RULE = (label, opts = {}) => [
  ...(label ? [new Paragraph({ spacing: { before: 120, after: 20 }, children: [new TextRun({ text: label, size: 20, bold: true })] })] : []),
  new Paragraph({
    spacing: { after: opts.after ?? 100 },
    border: { bottom: { style: 'single', size: 6, color: '9AA4B4', space: 2 } },
    children: [new TextRun({ text: '', size: opts.tall ? 34 : 22 })],
  }),
]

export const SPACER = (after = 200) => new Paragraph({ spacing: { after }, children: [] })

/** A page break — used where a document has to hand somebody one sheet. */
export const PAGE_BREAK = () => new Paragraph({ pageBreakBefore: true, children: [] })

/**
 * Strip developer references out of a note before it is printed.
 *
 * Several `note` fields on the course record were written for whoever is
 * reading the source — "see data/aemtPhases.ts". That is right where it is, and
 * wrong in a lesson plan handed to a lab instructor, who has no repository and
 * no reason to want one. The clause is removed rather than the whole note,
 * because the sentence in front of it is usually the part that matters.
 *
 * check-documents.mjs scans every generated file for the same patterns, so a
 * new note carrying one is caught rather than shipped.
 */
export const printable = (text) =>
  (text ?? '')
    // "— see data/aemtPhases.ts." / ", see scripts/foo.mjs"
    .replace(/[\s—,;(]*\bsee\s+[^.;]*?\.(?:ts|tsx|mjs|js)\b\.?/gi, '')
    // A bare path left mid-sentence.
    .replace(/\b(?:src|scripts|data|modules)\/[\w/.-]+\.(?:ts|tsx|mjs|js)\b/g, 'the course record')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;])/g, '$1')
    .trim()

// ----- tables ----------------------------------------------------------------

export const cell = (children, opts = {}) =>
  new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    columnSpan: opts.span,
    shading: opts.shaded ? { type: ShadingType.CLEAR, fill: opts.fill ?? 'E8EDF5', color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children,
  })

export const tcell = (text, opts = {}) =>
  cell(
    (Array.isArray(text) ? text : [text]).map(
      (t, i) =>
        new Paragraph({
          spacing: { after: i === (Array.isArray(text) ? text.length - 1 : 0) ? 0 : 40 },
          alignment: opts.align,
          children: [new TextRun({ text: String(t), bold: opts.bold, italics: opts.italics, size: opts.size ?? 20 })],
        }),
    ),
    opts,
  )

/**
 * A table with a repeating header row.
 *
 * `cols` are DXA widths and should sum to CONTENT_WIDTH; a table that does not
 * is silently rescaled by Word and stops lining up with its neighbours.
 */
export const table = (cols, header, rows, opts = {}) =>
  new Table({
    columnWidths: cols,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    rows: [
      ...(header
        ? [new TableRow({ tableHeader: true, children: header.map((h, i) => tcell(h, { width: cols[i], shaded: true, bold: true })) })]
        : []),
      ...rows.map((r) =>
        new TableRow({ children: r.map((c, i) => tcell(c, { width: cols[i], ...(opts.cell ?? {}) })) }),
      ),
    ],
  })

// ----- document shell --------------------------------------------------------

/**
 * The cover block every document opens with: title, subtitle, and the cohort
 * it belongs to under a rule. Identical across the set on purpose — these are
 * handed out separately and have to read as one program's paperwork.
 */
export const coverBlock = (title, subtitle, cohort) => [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: title, bold: true, size: 34 })] }),
  ...(subtitle
    ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: subtitle, bold: true, size: 24 })] })]
    : []),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    border: { bottom: { style: 'single', size: 6, color: '888888', space: 8 } },
    children: [new TextRun({ text: cohort, size: 22 })],
  }),
]

export const footer = (label) =>
  new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${label}    `, size: 18 }),
          new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 18 }),
        ],
      }),
    ],
  })

/**
 * A document-control line.
 *
 * Every one of these is generated, which means every one of them is DISPOSABLE
 * — the copy in somebody's drive is a snapshot, and the source of truth is the
 * repo. Saying so on the page is what stops a stale printout being treated as
 * the record three years later, when K.A.R. 109-17-3 says it still has to be
 * retained and somebody has to work out which copy is real.
 */
export const provenance = (m, command) =>
  new Paragraph({
    spacing: { before: 260 },
    children: [
      new TextRun({
        text:
          `Generated from the course record by \`${command}\`. Course dates ${longDate(m.KC_START_DATE)} to ${longDate(m.KC_END_DATE)}; ` +
          `${m.KC_COURSE_WEEKS} instructional weeks. Do not edit this file by hand — edit the course data and regenerate, or the next build will overwrite the change.`,
        size: 17,
        italics: true,
        color: '5B6472',
      }),
    ],
  })

export { AlignmentType, Header, HeadingLevel, Paragraph, TextRun, WidthType }
