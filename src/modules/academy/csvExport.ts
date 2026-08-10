import { neopSheetMeta, neopSkillsFor } from '../templates/resolve'
import { evalAverage, attKey } from './academyStore'
import { weekdayLabel } from './calendar'
import { addDays, fromISODate } from '../../lib/date'
import type {
  AcademyCohort,
  AcademyDayRef,
  AttendanceStatus,
  DailyEval,
  SkillCheck,
  Trainee,
} from '../../types'

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
      const meta = neopSheetMeta(c.sheet)
      // RSI / ventilator scope by operation — measure against the trainee's
      // own applicable skill list, not the sheet's superset.
      const trainee = c.traineeId ? roster.get(c.traineeId) : undefined
      const applicable = trainee ? neopSkillsFor(c.sheet, trainee.operation) : meta?.skills ?? []
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

// ----- payroll timesheet -----------------------------------------------------

/** 'Mon 7/13/2026' — unambiguous for a timekeeper reconciling a pay period. */
function columnDate(iso: string): string {
  const d = fromISODate(iso)
  return `${weekdayLabel(iso)} ${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

/**
 * One payroll week of academy days: Sunday through Saturday, the standard US
 * pay week. Grouping is by calendar week rather than by the academy's own
 * Week 1 / Week 2 because Phase 2 can be paced one session per week, which
 * would otherwise put a month of days on a single sheet.
 */
export interface TimesheetWeek {
  /** ISO date of the Sunday that starts the week — also the option value. */
  startISO: string
  endISO: string
  /** 'Jul 13 – 19' (year appended when the week straddles two). */
  label: string
  days: AcademyDayRef[]
}

/** Sunday that starts the pay week containing this date. */
export function weekStartISO(iso: string): string {
  return addDays(iso, -fromISODate(iso).getDay())
}

function weekLabel(startISO: string, endISO: string): string {
  const a = fromISODate(startISO)
  const b = fromISODate(endISO)
  const mon = (d: Date) => MONTHS[d.getMonth()]
  const sameYear = a.getFullYear() === b.getFullYear()
  const left = `${mon(a)} ${a.getDate()}${sameYear ? '' : `, ${a.getFullYear()}`}`
  const right = a.getMonth() === b.getMonth() && sameYear
    ? `${b.getDate()}`
    : `${mon(b)} ${b.getDate()}`
  return `${left} – ${right}, ${b.getFullYear()}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Group dated days into Sun–Sat pay weeks, chronologically. */
export function timesheetWeeks(days: AcademyDayRef[]): TimesheetWeek[] {
  const byStart = new Map<string, AcademyDayRef[]>()
  for (const d of days) {
    if (!d.date) continue
    const key = weekStartISO(d.date)
    const list = byStart.get(key)
    if (list) list.push(d)
    else byStart.set(key, [d])
  }
  return [...byStart.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([startISO, weekDays]) => {
      const endISO = addDays(startISO, 6)
      return { startISO, endISO, label: weekLabel(startISO, endISO), days: weekDays }
    })
}

/**
 * Attendance as a payroll timesheet: one row per trainee, one column per
 * scheduled academy day, and the day's hours in the cell only where the
 * trainee is marked present. Absent and unmarked cells are left blank — a
 * blank reads as "don't pay for this day", where a 0 could be misread as a
 * worked day with no hours.
 *
 * Hours are the day's full scheduled span, meal break included. Undated Phase 2
 * sessions are omitted: a timekeeper can't post hours to a day with no date.
 */
export function timesheetCSV(
  cohort: AcademyCohort,
  days: AcademyDayRef[],
  trainees: Trainee[],
  map: Map<string, AttendanceStatus>,
  /** Pay week this sheet covers, e.g. 'Jul 13 – 19, 2026'. */
  periodLabel?: string,
): string {
  const dated = days.filter((d) => d.date)
  const hrs = (n: number): string => n.toFixed(2)

  const header = [
    'Employee name',
    'Employee #',
    ...dated.map((d) => (d.autoCredit ? `${columnDate(d.date)} (LMS)` : columnDate(d.date))),
    'Total hours',
  ]

  // Reference row: what each day is scheduled for, so the timekeeper can see
  // at a glance which days carry no hours and why a column is empty.
  const scheduled = [
    'Scheduled hours',
    '',
    ...dated.map((d) => (d.hours ? hrs(d.hours) : '')),
    hrs(dated.reduce((sum, d) => sum + (d.hours ?? 0), 0)),
  ]

  const rows = trainees.map((t) => {
    let total = 0
    const cells = dated.map((d) => {
      if (!d.hours) return ''
      // At-home LMS days are self-paced with nothing to mark, so they are
      // credited to everyone; in-person days need a present mark.
      if (!d.autoCredit && map.get(attKey(t.id, d.key)) !== 'present') return ''
      total += d.hours
      return hrs(d.hours)
    })
    return [t.name, t.employeeNumber ?? '', ...cells, hrs(total)]
  })

  return csv([
    [`${cohort.label} — Academy attendance timesheet`],
    [periodLabel ? `Pay week: ${periodLabel}` : 'All academy days'],
    ['Hours are scheduled class time, meal break included. Blank = not attended.'],
    ['(LMS) = self-paced Cornerstone day — credited to everyone, no attendance taken.'],
    [],
    header,
    scheduled,
    ...rows,
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
