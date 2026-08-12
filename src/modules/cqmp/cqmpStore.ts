import { getState, setState, useSelector } from '../../lib/store'
import { uid } from '../../lib/id'
import { pushUndo } from '../../lib/undo'
import { monthKey, monthLabel } from '../../lib/date'
import { cqmpSlots, type CqmpKpiId } from '../../data/cqmp'
import type { CqmpImageRef, CqmpMetric, CqmpReport } from '../../types'

// ---------------------------------------------------------------------------
// CQMP reports — one per month, per market.
//
// A report is created with an empty metric for every (operation, measure) the
// market reports, so the entry screen is a fixed checklist rather than a blank
// page: at a glance you can see which of the month's numbers are still
// missing. Targets carry forward from the previous month, because they change
// once a year at most and re-typing them twelve times is how a wrong one gets
// onto a slide.
// ---------------------------------------------------------------------------

function emptyMetric(opId: string, kpiId: CqmpKpiId, target: number | null): CqmpMetric {
  return { opId, kpiId, value: null, target, images: [] }
}

/** The most recent report before `month`, if there is one. */
export function priorReport(month: string, reports = getState().cqmpReports): CqmpReport | undefined {
  return reports
    .filter((r) => r.month < month)
    .sort((a, b) => b.month.localeCompare(a.month))[0]
}

export function findMetric(
  report: CqmpReport | undefined,
  opId: string,
  kpiId: string,
): CqmpMetric | undefined {
  return report?.metrics.find((m) => m.opId === opId && m.kpiId === kpiId)
}

export function createReport(month: string): CqmpReport {
  const existing = getState().cqmpReports.find((r) => r.month === month)
  if (existing) return existing

  const prev = priorReport(month)
  const now = new Date().toISOString()
  const report: CqmpReport = {
    id: uid('cqmp'),
    month,
    presenter: prev?.presenter,
    metrics: cqmpSlots().map(({ opId, kpiId }) =>
      emptyMetric(opId, kpiId, findMetric(prev, opId, kpiId)?.target ?? null),
    ),
    createdAt: now,
    updatedAt: now,
  }
  setState((db) => ({ ...db, cqmpReports: [...db.cqmpReports, report] }))
  return report
}

function patchReport(id: string, fn: (r: CqmpReport) => CqmpReport): void {
  setState((db) => ({
    ...db,
    cqmpReports: db.cqmpReports.map((r) =>
      r.id === id ? { ...fn(r), updatedAt: new Date().toISOString() } : r,
    ),
  }))
}

export function updateReport(id: string, patch: Partial<Omit<CqmpReport, 'metrics'>>): void {
  patchReport(id, (r) => ({ ...r, ...patch }))
}

/**
 * Update one measure, creating it if the catalogue has grown since the report
 * was opened. Without that, adding an operation or a measure would leave every
 * report already in flight unable to record it.
 */
export function updateMetric(
  reportId: string,
  opId: string,
  kpiId: string,
  patch: Partial<CqmpMetric>,
): void {
  patchReport(reportId, (r) => {
    const i = r.metrics.findIndex((m) => m.opId === opId && m.kpiId === kpiId)
    const base = i >= 0 ? r.metrics[i] : emptyMetric(opId, kpiId as CqmpKpiId, null)
    const next = { ...base, ...patch }
    const metrics = i >= 0 ? r.metrics.map((m, j) => (j === i ? next : m)) : [...r.metrics, next]
    return { ...r, metrics }
  })
}

export function getReport(id: string): CqmpReport | undefined {
  return getState().cqmpReports.find((r) => r.id === id)
}

export function addMetricImage(
  reportId: string,
  opId: string,
  kpiId: string,
  image: CqmpImageRef,
): void {
  const current = findMetric(getReport(reportId), opId, kpiId)
  updateMetric(reportId, opId, kpiId, { images: [...(current?.images ?? []), image] })
}

export function removeMetricImage(
  reportId: string,
  opId: string,
  kpiId: string,
  key: string,
): void {
  const current = findMetric(getReport(reportId), opId, kpiId)
  updateMetric(reportId, opId, kpiId, {
    images: (current?.images ?? []).filter((im) => im.key !== key),
  })
}

export function deleteReport(id: string): void {
  const report = getState().cqmpReports.find((r) => r.id === id)
  setState((db) => ({ ...db, cqmpReports: db.cqmpReports.filter((r) => r.id !== id) }))
  if (report) {
    // Screenshots are deliberately left in IndexedDB — see purgeOrphanScreenshots.
    pushUndo(`Deleted the ${monthLabel(report.month)} CQMP report`, () =>
      setState((db) => ({ ...db, cqmpReports: [...db.cqmpReports, report] })),
    )
  }
}

// ----- derived --------------------------------------------------------------

/** A measure is "reported" once it has a result. Notes alone are not a number. */
export function isReported(m: CqmpMetric | undefined): boolean {
  return typeof m?.value === 'number'
}

export interface ReportProgress {
  /** Measures the market is expected to report this month. */
  expected: number
  reported: number
  withScreenshot: number
}

export function progressOf(report: CqmpReport): ReportProgress {
  const slots = cqmpSlots()
  let reported = 0
  let withScreenshot = 0
  for (const { opId, kpiId } of slots) {
    const m = findMetric(report, opId, kpiId)
    if (isReported(m)) reported++
    if (m && m.images.length > 0) withScreenshot++
  }
  return { expected: slots.length, reported, withScreenshot }
}

export type MetricStatus = 'met' | 'below' | 'no-target' | 'not-reported'

export function statusOf(m: CqmpMetric | undefined): MetricStatus {
  if (!isReported(m)) return 'not-reported'
  if (typeof m!.target !== 'number') return 'no-target'
  return m!.value! + 1e-9 >= m!.target! ? 'met' : 'below'
}

export const STATUS_LABEL: Record<MetricStatus, string> = {
  met: 'Target met',
  below: 'Below target',
  'no-target': 'No target set',
  'not-reported': 'Not reported',
}

/** Change in percentage points against the previous month, when both exist. */
export function deltaOf(current: CqmpMetric | undefined, prior: CqmpMetric | undefined): number | null {
  if (!isReported(current) || !isReported(prior)) return null
  return Math.round((current!.value! - prior!.value!) * 100) / 100
}

/** Percentage from case counts, rounded the way the dashboards round. */
export function percentOf(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null
  return Math.round((numerator / denominator) * 10000) / 100
}

/** Every screenshot key still referenced by any report, for the orphan sweep. */
export function referencedImageKeys(): Set<string> {
  const keys = new Set<string>()
  for (const r of getState().cqmpReports) {
    for (const m of r.metrics) for (const im of m.images) keys.add(im.key)
  }
  return keys
}

/** Month key for "this month", used to pre-fill the new-report form. */
export function currentMonth(): string {
  return monthKey()
}

/** Months that already have a report — the form refuses to duplicate one. */
export function usedMonths(reports: CqmpReport[]): Set<string> {
  return new Set(reports.map((r) => r.month))
}

// ----- hooks ----------------------------------------------------------------

/** Newest month first — the one being worked on is almost always the newest. */
export function useCqmpReports(): CqmpReport[] {
  return useSelector((db) => [...db.cqmpReports].sort((a, b) => b.month.localeCompare(a.month)))
}

export function useReportById(id: string | undefined): CqmpReport | undefined {
  return useSelector((db) => db.cqmpReports.find((r) => r.id === id))
}
