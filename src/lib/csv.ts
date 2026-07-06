// Minimal CSV parse/serialize. Handles quoted fields, escaped quotes ("")
// and CRLF/LF line endings — enough for Ninth Brain / ImageTrend exports.

export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/^﻿/, '') // strip BOM

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // handled by the \n branch; ignore
    } else {
      field += ch
    }
  }
  // trailing field / row
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export interface ParsedTable {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseTable(text: string): ParsedTable {
  const grid = parseCSV(text)
  if (grid.length === 0) return { headers: [], rows: [] }
  const headers = grid[0].map((h) => h.trim())
  const rows = grid.slice(1).map((cells) => {
    const rec: Record<string, string> = {}
    headers.forEach((h, i) => {
      rec[h] = (cells[i] ?? '').trim()
    })
    return rec
  })
  return { headers, rows }
}

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function toCSV(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map((h) => escapeCell(h)).join(',')]
  for (const r of rows) {
    lines.push(r.map((c) => escapeCell(String(c ?? ''))).join(','))
  }
  return lines.join('\r\n')
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
