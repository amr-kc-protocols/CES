// Render a document's Block[] to docx children.
//
// The other half of src/lib/docBlocks.ts. Each of the four retained program
// documents is built once, as a neutral tree, and rendered twice — here for the
// .docx a KBEMS reviewer files, and by lib/docHtml.ts for the copy the app
// produces and keeps. Neither renderer decides anything about content, which is
// the point: the filed copy and the copy in the app cannot say different things
// about the passing score, because neither of them holds it.
//
// The docx spacing and sizes below are the ones the hand-written generators
// used, kept so the filed documents look the same after the refactor as before.
import {
  AlignmentType,
  Footer,
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

const tcell = (text, opts = {}) =>
  new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.shaded ? { type: ShadingType.CLEAR, fill: 'E8EDF5', color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: (Array.isArray(text) ? text : [text]).map(
      (t, i, all) =>
        new Paragraph({
          spacing: { after: i === all.length - 1 ? 0 : 40 },
          children: [new TextRun({ text: String(t), bold: opts.bold, size: opts.size ?? 20 })],
        }),
    ),
  })

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const longDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

/** One block to zero or more docx children. */
function render(b) {
  switch (b.k) {
    case 'cover':
      return [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: b.title, bold: true, size: 34 })] }),
        ...(b.subtitle
          ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: b.subtitle, bold: true, size: 24 })] })]
          : []),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          border: { bottom: { style: 'single', size: 6, color: '888888', space: 8 } },
          children: [new TextRun({ text: b.cohort, size: 22 })],
        }),
      ]
    case 'h1':
      return [new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 340, after: 150 }, children: [new TextRun({ text: b.text, bold: true, size: 30 })] })]
    case 'h2':
      return [new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 230, after: 100 }, children: [new TextRun({ text: b.text, bold: true, size: 24 })] })]
    case 'h3':
      return [new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 }, children: [new TextRun({ text: b.text, bold: true, size: 22 })] })]
    case 'p':
      return [
        new Paragraph({
          spacing: { after: 130 },
          children: [new TextRun({ text: b.text, bold: b.bold, italics: b.italics, size: b.small ? 20 : 22 })],
        }),
      ]
    case 'bullet':
      return [
        new Paragraph({
          numbering: { reference: BULLET_REF, level: b.level ?? 0 },
          spacing: { after: 60 },
          children: [new TextRun({ text: b.text, size: 22, bold: b.bold, italics: b.italics })],
        }),
      ]
    case 'task':
      return [
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 380, hanging: 320 },
          children: [new TextRun({ text: `☐  ${b.text}`, size: 22 })],
        }),
      ]
    case 'rule':
      return [
        ...(b.label
          ? [new Paragraph({ spacing: { before: 120, after: 20 }, children: [new TextRun({ text: b.label, size: 20, bold: true })] })]
          : []),
        new Paragraph({
          spacing: { after: 100 },
          border: { bottom: { style: 'single', size: 6, color: '9AA4B4', space: 2 } },
          children: [new TextRun({ text: '', size: b.tall ? 34 : 22 })],
        }),
      ]
    case 'spacer':
      return [new Paragraph({ spacing: { after: b.after ?? 200 }, children: [] })]
    case 'pageBreak':
      return [new Paragraph({ pageBreakBefore: true, children: [] })]
    case 'table':
      return [
        new Table({
          columnWidths: b.cols,
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          rows: [
            ...(b.header
              ? [new TableRow({ tableHeader: true, children: b.header.map((h, i) => tcell(h, { width: b.cols[i], shaded: true, bold: true })) })]
              : []),
            ...b.rows.map(
              (r) => new TableRow({ children: r.map((c, i) => tcell(c, { width: b.cols[i], size: b.small ? 18 : 20 })) }),
            ),
          ],
        }),
      ]
    case 'provenance':
      return [
        new Paragraph({
          spacing: { before: 260 },
          children: [
            new TextRun({
              text:
                `Generated from the course record by \`${b.command}\`. Course dates ${longDate(b.startDate)} to ${longDate(b.endDate)}; ` +
                `${b.weeks} instructional weeks. Do not edit this file by hand — edit the course data and regenerate, or the next build will overwrite the change.`,
              size: 17,
              italics: true,
              color: '5B6472',
            }),
          ],
        }),
      ]
    default:
      throw new Error(`doc-render: unknown block ${JSON.stringify(b).slice(0, 80)}`)
  }
}

export const renderBlocks = (blocks) => blocks.flatMap(render)
