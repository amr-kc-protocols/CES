import { esc, printDoc, downloadDoc, safeFilename } from '../academy/docGen'
import { formatDate, monthLabel } from '../../lib/date'
import {
  AIR_OPERATIONS,
  CQMP_KPIS,
  CQMP_OFFICERS,
  GROUND_OPERATIONS,
  MINUTES_TITLE,
  officerSeed,
} from '../../data/cqmp'
import { kpiSummary, meetingMinutes, STATUS_LABEL } from './cqmpStore'
import type { KpiRow } from './cqmpStore'
import type { CqmpMinuteRow, CqmpReport } from '../../types'

// ---------------------------------------------------------------------------
// The monthly meeting minutes, as filed.
//
// Laid out to match the circulated Word template — same header block, same
// attendee grid, same three tracking tables — with one deliberate change: the
// KPI table comes FIRST, before the agenda.
//
// That is the whole reason this document is generated rather than typed. The
// meeting exists to answer one question, "are we meeting these KPIs and if not
// why not", and the template buries that answer in two prose cells that say
// "progress is being made". A director should be able to read the first table
// and know the answer for all twenty-six measures.
//
// The other change is that a miss with no explanation is PRINTED AS SUCH. It
// would be easy to leave the cell blank and let it pass; a blank cell next to a
// number below target is the exact thing that gets asked about in the room, so
// the document says "explanation required" in red instead of saying nothing.
// Better to see it while writing the minutes than to hear it during them.
//
// Output goes through the app's existing document idiom: printDoc for a PDF,
// downloadDoc for a .doc that opens editable in Word. The minutes have blanks
// only a person can fill — who was in the room, what was decided — so being
// editable after generation matters more here than in most of these documents.
// ---------------------------------------------------------------------------

const pct = (n: number | null | undefined): string =>
  typeof n === 'number' ? `${n.toFixed(1)}%` : '—'

/** A signed delta, or an em dash. Zero is shown as zero, not as a blank. */
const delta = (n: number | null): string => {
  if (n === null) return '—'
  if (n === 0) return '0.0'
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}`
}

const STATUS_STYLE: Record<string, string> = {
  met: 'color:#166534;font-weight:600',
  below: 'color:#991b1b;font-weight:700',
  'no-target': 'color:#92400e',
  'not-reported': 'color:#6b7280;font-style:italic',
}

function kpiTableRows(rows: KpiRow[]): string {
  return rows
    .map((r) => {
      // The "why not" column carries the whole argument of the meeting, so it
      // is never silently empty on a miss.
      const why = r.needsExplanation
        ? '<span style="color:#991b1b;font-weight:700">Explanation required</span>'
        : r.status === 'below'
          ? esc(r.why)
          : r.why
            ? esc(r.why)
            : ''
      return `<tr>
        <td>${esc(r.operation.name)}</td>
        <td>${esc(CQMP_KPIS[r.kpiId].short)}</td>
        <td style="text-align:right">${pct(r.metric?.value)}</td>
        <td style="text-align:right">${
          typeof r.metric?.target === 'number' ? pct(r.metric.target) : '—'
        }</td>
        <td style="text-align:right">${delta(r.delta)}</td>
        <td style="${STATUS_STYLE[r.status] ?? ''}">${esc(STATUS_LABEL[r.status])}</td>
        <td>${why}</td>
      </tr>`
    })
    .join('')
}

function minuteTable(
  heading: string,
  columns: [string, string, string, string, string],
  rows: CqmpMinuteRow[],
  /** Blank rows so the printed copy can be finished by hand. */
  blanks = 2,
): string {
  const body = rows
    .map(
      (r) => `<tr>
        <td>${esc(r.topic)}</td>
        <td>${esc(r.notes ?? '')}</td>
        <td>${esc(r.action ?? '')}</td>
        <td>${esc(r.assignedTo ?? '')}</td>
        <td>${r.status === 'closed' ? 'Closed' : 'Open'}</td>
      </tr>`,
    )
    .join('')
  const empty = Array.from({ length: blanks })
    .map(() => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>')
    .join('')
  return `<h2>${esc(heading)}</h2>
    <table class="mt">
      <tr>${columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>
      ${body}${empty}
    </table>`
}

function attendeeGrid(people: { name: string; title?: string }[], blanks: number): string {
  const filled = [...people]
  while (filled.length < blanks) filled.push({ name: '', title: '' })
  // Two name/title pairs per row, as the template lays them out.
  const rows: string[] = []
  for (let i = 0; i < filled.length; i += 2) {
    const a = filled[i]
    const b = filled[i + 1] ?? { name: '', title: '' }
    rows.push(
      `<tr><td>${esc(a.name)}</td><td>${esc(a.title ?? '')}</td>` +
        `<td>${esc(b.name)}</td><td>${esc(b.title ?? '')}</td></tr>`,
    )
  }
  return rows.join('')
}

export function minutesTitle(report: CqmpReport): string {
  return `${MINUTES_TITLE} — ${monthLabel(report.month)}`
}

export function minutesFilename(report: CqmpReport): string {
  return safeFilename(`CQMP_Meeting_Minutes_${report.month}`)
}

export function minutesHTML(report: CqmpReport, prior: CqmpReport | undefined): string {
  const meeting = report.meeting ?? {}
  const officers = { ...officerSeed(), ...(meeting.officers ?? {}) }
  const summary = kpiSummary(report, prior)
  const mins = meetingMinutes(meeting)
  const groundRows = summary.rows.filter((r) => r.operation.kind === 'ground')
  const airRows = summary.rows.filter((r) => r.operation.kind === 'air')
  const director = CQMP_OFFICERS.find((o) => o.role === 'director')

  const officerCells = CQMP_OFFICERS.map(
    (o) => `<tr><th>${esc(o.short)}</th><td>${esc(officers[o.role] ?? '')}</td></tr>`,
  ).join('')

  const kpiHead = `<tr>
    <th>Operation</th><th>Measure</th><th style="text-align:right">Result</th>
    <th style="text-align:right">Target</th><th style="text-align:right">Δ vs prior</th>
    <th>Status</th><th>If not met, why</th>
  </tr>`

  return `
  <h1 style="text-align:center;margin-bottom:2px">${esc(MINUTES_TITLE)}</h1>
  <p style="text-align:center;margin-top:0"><strong>Reporting month: ${esc(
    monthLabel(report.month),
  )}</strong>${prior ? ` &middot; compared against ${esc(monthLabel(prior.month))}` : ''}</p>

  <table class="hdr">
    <tr>
      <td style="width:34%;vertical-align:top">
        <table class="inner">
          <tr><th>Meeting Date</th><td>${
            meeting.date ? esc(formatDate(meeting.date)) : ''
          }</td></tr>
          <tr><th>Start Time</th><td>${esc(meeting.startTime ?? '')}</td></tr>
          <tr><th>End Time</th><td>${esc(meeting.endTime ?? '')}</td></tr>
          <tr><th>Total Minutes</th><td>${mins === null ? '' : `${mins} min`}</td></tr>
        </table>
      </td>
      <td style="width:33%;vertical-align:top">
        <table class="inner">${officerCells}</table>
      </td>
      <td style="width:33%;vertical-align:top">
        <table class="inner">
          <tr><th>Ground BUs</th><td>${esc(
            GROUND_OPERATIONS.map((o) => o.name).join(', '),
          )}</td></tr>
          <tr><th>Air Bases</th><td>${esc(AIR_OPERATIONS.map((o) => o.name).join(', '))}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <h2>Key Performance Indicators — ${esc(monthLabel(report.month))}</h2>
  <p class="lede">
    <strong>${summary.met} of ${summary.rows.length} measures met target.</strong>
    ${summary.below > 0 ? `${summary.below} below target. ` : ''}
    ${summary.notReported > 0 ? `${summary.notReported} not reported. ` : ''}
    ${summary.noTarget > 0 ? `${summary.noTarget} with no target set. ` : ''}
  </p>
  ${
    summary.unexplained.length > 0
      ? `<p class="warn-note"><strong>${summary.unexplained.length} measure${
          summary.unexplained.length === 1 ? ' is' : 's are'
        } below target with no explanation recorded.</strong> These are the questions the meeting exists to answer — fill them in before filing.</p>`
      : ''
  }

  <h3>Ground business units</h3>
  <table class="mt kpi">${kpiHead}${kpiTableRows(groundRows)}</table>

  <h3>Air bases</h3>
  <table class="mt kpi">${kpiHead}${kpiTableRows(airRows)}</table>

  <p class="src">
    Measure definitions: ${Object.values(CQMP_KPIS)
      .map((k) => `<strong>${esc(k.short)}</strong> — ${esc(k.definition)}`)
      .join(' ')}
  </p>

  <h2>Attendees</h2>
  <table class="mt">
    <tr><th>Name</th><th>Title</th><th>Name</th><th>Title</th></tr>
    ${attendeeGrid(meeting.attendees ?? [], 12)}
  </table>

  <h2>Absent</h2>
  <table class="mt">
    <tr><th>Name</th><th>Title</th><th>Name</th><th>Title</th></tr>
    ${attendeeGrid(meeting.absent ?? [], 2)}
  </table>

  ${minuteTable(
    'Agenda Items',
    ['Topic / Follow-ups', 'Notes', 'Action Required', 'Assigned To', 'Open / Closed'],
    meeting.agenda ?? [],
  )}

  ${minuteTable(
    'Clinical Quality Management Plan (CQMP)',
    ['AQM', 'Concerns / Issues', 'Notes / Action Required', 'Project Champion', 'Open / Closed'],
    meeting.aqms ?? [],
  )}

  ${minuteTable(
    'Patient Safety Issues',
    ['Topic', 'Concerns / Issues', 'Action Required', 'Assigned To', 'Open / Closed'],
    meeting.safety ?? [],
    3,
  )}

  ${
    report.summary
      ? `<h2>Summary</h2>${report.summary
          .split('\n')
          .filter((l) => l.trim())
          .map((l) => `<p>${esc(l)}</p>`)
          .join('')}`
      : ''
  }

  <table class="sig">
    <tr>
      <td>
        <div class="sigline">&nbsp;</div>
        <div class="siglabel">${esc(officers.rcm ?? '')} — Regional Clinical Manager</div>
      </td>
      <td>
        <div class="sigline">&nbsp;</div>
        <div class="siglabel">Submitted to ${esc(
          officers.director ?? director?.name ?? '',
        )} — ${esc(director?.title ?? 'Regional Director')}</div>
      </td>
    </tr>
  </table>
  <style>
    h1 { font-size: 17pt; }
    h2 { font-size: 12pt; background: #1f3864; color: #fff; padding: 4px 8px; margin: 16px 0 6px; }
    h3 { font-size: 10.5pt; margin: 12px 0 4px; color: #1f3864; }
    table.hdr, table.mt, table.sig { width: 100%; border-collapse: collapse; }
    table.hdr > tbody > tr > td { border: 1px solid #1f3864; padding: 0; }
    table.inner { width: 100%; border-collapse: collapse; }
    table.inner th, table.inner td { border: 1px solid #c9ccd6; padding: 3px 6px; font-size: 8.5pt; text-align: left; }
    table.inner th { background: #eef1f7; width: 42%; font-weight: 600; }
    table.mt th, table.mt td { border: 1px solid #9aa0ae; padding: 4px 6px; font-size: 8.5pt; vertical-align: top; }
    table.mt th { background: #eef1f7; text-align: left; font-weight: 600; }
    /* Ground and air are two tables so the meeting can read them the way it
       works through them, but they have to line up as if they were one — a
       reader comparing a rotor base against a ground BU should not have to
       re-find the Target column. Fixed layout with explicit widths does that;
       auto layout sized each table to its own content and they drifted. */
    table.kpi { table-layout: fixed; }
    table.kpi th:nth-child(1), table.kpi td:nth-child(1) { width: 16%; font-weight: 600; }
    table.kpi th:nth-child(2), table.kpi td:nth-child(2) { width: 14%; }
    table.kpi th:nth-child(3), table.kpi td:nth-child(3) { width: 8%; }
    table.kpi th:nth-child(4), table.kpi td:nth-child(4) { width: 8%; }
    table.kpi th:nth-child(5), table.kpi td:nth-child(5) { width: 8%; }
    table.kpi th:nth-child(6), table.kpi td:nth-child(6) { width: 12%; }
    table.kpi th:nth-child(7), table.kpi td:nth-child(7) { width: 34%; }
    /* A row split across a page break is unreadable on the printed copy. */
    tr { page-break-inside: avoid; }
    p.lede { font-size: 11pt; margin: 6px 0; }
    p.warn-note { border-left: 4px solid #991b1b; background: #fdf2f2; padding: 6px 10px; font-size: 9.5pt; }
    p.src { font-size: 7.5pt; color: #555; margin-top: 6px; }
    table.sig { margin-top: 24px; }
    table.sig td { width: 50%; padding: 0 16px; border: none; vertical-align: bottom; }
    .sigline { border-bottom: 1px solid #333; height: 28px; }
    .siglabel { font-size: 8pt; color: #444; padding-top: 3px; }
    @page { size: letter; margin: 12mm; }
  </style>`
}

export function printMinutes(report: CqmpReport, prior: CqmpReport | undefined): void {
  printDoc(minutesTitle(report), minutesHTML(report, prior))
}

export function downloadMinutes(report: CqmpReport, prior: CqmpReport | undefined): void {
  downloadDoc(minutesFilename(report), minutesTitle(report), minutesHTML(report, prior))
}
