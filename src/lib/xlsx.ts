// ---------------------------------------------------------------------------
// A minimal multi-sheet .xlsx writer.
//
// The app already exports CSV, but CSV cannot carry two sheets, and a chart
// review export wants the rows and the tally in one file rather than two
// downloads someone has to keep together.
//
// Written here rather than pulled in as a dependency. The alternatives are a
// megabyte of spreadsheet library in a service-worker-precached offline app,
// for a file that needs strings, numbers, a bold header row and column widths —
// nothing else. This is roughly two hundred lines and has no supply chain.
//
// The zip is STORED, not deflated. Excel, LibreOffice and Google Sheets all
// open stored archives; skipping compression removes the only part of the
// format that would need a real implementation, at the cost of a larger file
// than these row counts will ever make matter.
// ---------------------------------------------------------------------------

export type CellValue = string | number | boolean | null | undefined

export interface Sheet {
  /** Tab name. Excel forbids : \ / ? * [ ] and caps it at 31 characters. */
  name: string
  /** First row is written bold and frozen. */
  rows: CellValue[][]
  /** Column widths in character units, applied left to right. */
  widths?: number[]
}

// ----- xml -------------------------------------------------------------------

function esc(s: string): string {
  let out = ''
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    // Control characters are illegal in XML 1.0 and make Excel declare the
    // file corrupt rather than skipping the cell. Narrative pasted out of a
    // PCR is exactly where a stray one arrives.
    if (code < 0x20 && ch !== '\t' && ch !== '\n' && ch !== '\r') continue
    if (ch === '&') out += '&amp;'
    else if (ch === '<') out += '&lt;'
    else if (ch === '>') out += '&gt;'
    else if (ch === '"') out += '&quot;'
    else if (ch === "'") out += '&apos;'
    else out += ch
  }
  return out
}

/** 0 -> A, 25 -> Z, 26 -> AA. */
export function columnName(index: number): string {
  let n = index
  let name = ''
  do {
    name = String.fromCharCode(65 + (n % 26)) + name
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return name
}

/** Excel caps sheet names at 31 chars and rejects a handful of characters. */
export function safeSheetName(name: string): string {
  return (name.replace(/[:\\/?*[\]]/g, '-').slice(0, 31) || 'Sheet')
}

function cellXml(value: CellValue, ref: string, style: number): string {
  const s = style ? ` s="${style}"` : ''
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${s}><v>${value}</v></c>`
  }
  const text = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`
}

function sheetXml(sheet: Sheet): string {
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : ''

  const rows = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => cellXml(v, `${columnName(c)}${r + 1}`, r === 0 ? 1 : 0))
        .join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')

  // Freeze the header so a hundred rows of review still say what each column is.
  const freeze = sheet.rows.length
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : ''

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${cols}<sheetData>${rows}</sheetData></worksheet>`
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

// ----- zip -------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

interface Entry {
  name: string
  data: Uint8Array
  crc: number
  offset: number
}

function writer() {
  const parts: Uint8Array[] = []
  let length = 0
  const push = (b: Uint8Array) => {
    parts.push(b)
    length += b.length
  }
  const u16 = (n: number) => push(new Uint8Array([n & 0xff, (n >>> 8) & 0xff]))
  const u32 = (n: number) =>
    push(new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]))
  return {
    push,
    u16,
    u32,
    get length() {
      return length
    },
    concat() {
      const out = new Uint8Array(length)
      let at = 0
      for (const p of parts) {
        out.set(p, at)
        at += p.length
      }
      return out
    },
  }
}

/** Build a STORED zip from name/content pairs. */
function zip(files: { name: string; text: string }[]): Uint8Array {
  const enc = new TextEncoder()
  const w = writer()
  const entries: Entry[] = []

  // A fixed timestamp, not the clock. Two exports of unchanged data should be
  // byte-identical, which is what lets anyone check that a file was not edited
  // between being produced and being sent.
  const TIME = 0 // 00:00:00
  const DATE = 33 // 1980-01-01

  for (const f of files) {
    const data = enc.encode(f.text)
    const nameBytes = enc.encode(f.name)
    const crc = crc32(data)
    entries.push({ name: f.name, data, crc, offset: w.length })

    w.u32(0x04034b50)
    w.u16(20) // version needed
    w.u16(0) // flags
    w.u16(0) // stored
    w.u16(TIME)
    w.u16(DATE)
    w.u32(crc)
    w.u32(data.length)
    w.u32(data.length)
    w.u16(nameBytes.length)
    w.u16(0)
    w.push(nameBytes)
    w.push(data)
  }

  const cdOffset = w.length
  for (const e of entries) {
    const nameBytes = enc.encode(e.name)
    w.u32(0x02014b50)
    w.u16(20) // version made by
    w.u16(20) // version needed
    w.u16(0)
    w.u16(0)
    w.u16(TIME)
    w.u16(DATE)
    w.u32(e.crc)
    w.u32(e.data.length)
    w.u32(e.data.length)
    w.u16(nameBytes.length)
    w.u16(0) // extra
    w.u16(0) // comment
    w.u16(0) // disk
    w.u16(0) // internal attrs
    w.u32(0) // external attrs
    w.u32(e.offset)
    w.push(nameBytes)
  }
  const cdSize = w.length - cdOffset

  w.u32(0x06054b50)
  w.u16(0)
  w.u16(0)
  w.u16(entries.length)
  w.u16(entries.length)
  w.u32(cdSize)
  w.u32(cdOffset)
  w.u16(0)

  return w.concat()
}

// ----- workbook --------------------------------------------------------------

/** Build an .xlsx as bytes. Works in the browser and in node. */
export function buildXlsx(sheets: Sheet[]): Uint8Array {
  if (sheets.length === 0) throw new Error('An xlsx needs at least one sheet')

  // Excel refuses to open a workbook with two sheets of the same name, and
  // truncation to 31 characters is a real way to collide two long ones.
  const names: string[] = []
  for (const s of sheets) {
    let name = safeSheetName(s.name)
    let n = 2
    while (names.includes(name)) name = safeSheetName(`${name.slice(0, 28)} ${n++}`)
    names.push(name)
  }

  const files = [
    {
      name: '[Content_Types].xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join('')}</Types>`,
    },
    {
      name: '_rels/.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join(
          '',
        )}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: 'xl/styles.xml', text: STYLES },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, text: sheetXml(s) })),
  ]

  return zip(files)
}

/** Build and hand the file to the browser. */
export function downloadXlsx(filename: string, sheets: Sheet[]): void {
  const bytes = buildXlsx(sheets)
  // Copied into a plain ArrayBuffer: TypeScript types Uint8Array as possibly
  // backed by a SharedArrayBuffer, which BlobPart does not accept.
  const buffer = new ArrayBuffer(bytes.length)
  new Uint8Array(buffer).set(bytes)
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked on the next tick rather than immediately: Safari cancels an
  // in-flight download when the object URL disappears from under it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
