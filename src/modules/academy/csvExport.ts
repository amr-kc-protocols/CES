import { SHEETS, skillsFor } from '../../data/checkoffSheets'
import { evalAverage } from './academyStore'
import type { DailyEval, SkillCheck, Trainee } from '../../types'

// ---------------------------------------------------------------------------
// Spreadsheet exports: evals and skill sheets as CSV, one row per record —
// opens directly in Excel (BOM included so accents/dashes survive), filters
// and pivots like the workbooks these replaced.
// ---------------------------------------------------------------------------

function csvField(v: string | number | undefined): string {
  if (v === undefined || v === '') return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csv(rows: (string | number | undefined)[][]): string {
  return '﻿' + rows.map((r) => r.map(csvField).join(',')).join('\r\n')
}

const yn = (v: boolean | undefined): string => (v === undefined ? '' : v ? 'Yes' : 'No')

/** One row per daily evaluation, newest first. */
export function evalsCSV(trainees: Trainee[], evals: DailyEval[]): string {
  const roster = new Map(trainees.map((t) => [t.id, t]))
  const rows = evals
    .filter((e) => e.traineeId && roster.has(e.traineeId))
    .sort((a, b) => b.date.localeCompare(a.date) || a.traineeName.localeCompare(b.traineeName))
  return csv([
    [
      'Trainee', 'Shift date', 'Evaluating FTO',
      'Professionalism', 'Teamwork', 'Patient care', 'Driving', 'Stretcher', 'PCR',
      'Average', 'Strengths', 'Improvements',
      'Truck washed', 'Backed with spotter', 'Ready independent', 'FTO initialed',
    ],
    ...rows.map((e) => {
      const avg = evalAverage(e)
      return [
        e.traineeName, e.date, e.fto,
        e.scores.professionalism, e.scores.teamwork, e.scores.patientCare,
        e.scores.driving, e.scores.stretcher, e.scores.pcr,
        avg === null ? '' : avg.toFixed(2), e.strengths, e.improvements,
        yn(e.truckWashed), yn(e.spotter), yn(e.readyIndependent),
        e.ftoInitials ? 'Yes' : '',
      ]
    }),
  ])
}

/** One row per (trainee, sheet) check-off record. */
export function skillChecksCSV(trainees: Trainee[], checks: SkillCheck[]): string {
  const roster = new Map(trainees.map((t) => [t.id, t]))
  const rows = checks
    .filter((c) => c.traineeId && roster.has(c.traineeId))
    .sort((a, b) => a.traineeName.localeCompare(b.traineeName) || a.sheet.localeCompare(b.sheet))
  return csv([
    [
      'Trainee', 'Sheet', 'Last touched', 'Assessed by',
      'Passed', 'Needs practice', 'Total skills', 'Complete',
      'FTO signed', 'New hire signed', 'Comments',
    ],
    ...rows.map((c) => {
      const meta = SHEETS[c.sheet]
      // RSI / ventilator scope by operation — measure against the trainee's
      // own applicable skill list, not the sheet's superset.
      const trainee = c.traineeId ? roster.get(c.traineeId) : undefined
      const applicable = trainee ? skillsFor(c.sheet, trainee.operation) : meta?.skills ?? []
      const ids = new Set(applicable.map((sk) => sk.id))
      const total = applicable.length
      const entries = Object.entries(c.results ?? {}).filter(([id]) => ids.has(id))
      const passed = entries.filter(([, r]) => r === 'pass').length
      const fails = entries.filter(([, r]) => r === 'fail').length
      return [
        c.traineeName, meta?.label ?? c.sheet, c.date, c.evaluator,
        passed, fails, total, passed === total && total > 0 ? 'Yes' : 'No',
        c.evaluatorSignedAt ?? (c.evaluatorSignature ? 'Yes' : ''),
        c.traineeSignedAt ?? (c.traineeSignature ? 'Yes' : ''),
        c.comments,
      ]
    }),
  ])
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
