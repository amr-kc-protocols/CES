import { setState, useSelector, getState } from '../../lib/store'
import { uid } from '../../lib/id'
import { monthKey } from '../../lib/date'
import { computeScore, rubricForOperation, LOW_SCORE_THRESHOLD } from '../../data/qaRubric'
import { buildCriteriaResolver, normalizeStatus, type ExternalReview } from './botBridge'
import type {
  Chart,
  ChartReview,
  CriterionStatus,
  OperationId,
  QAPeriod,
} from '../../types'

export function periodId(month: string, operation: OperationId): string {
  return `${month}:${operation}`
}

export function targetFor(volume: number, samplePercent: number): number {
  return Math.ceil(Math.max(0, volume) * samplePercent)
}

export interface CreatePeriodInput {
  month?: string
  operation: OperationId
  monthlyVolume: number
  samplePercent?: number
}

export function createPeriod(input: CreatePeriodInput): QAPeriod {
  const month = input.month ?? monthKey()
  const samplePercent = input.samplePercent ?? getState().settings.samplePercent
  const id = periodId(month, input.operation)
  const now = new Date().toISOString()
  const period: QAPeriod = {
    id,
    month,
    operation: input.operation,
    monthlyVolume: input.monthlyVolume,
    samplePercent,
    targetCount: targetFor(input.monthlyVolume, samplePercent),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  setState((db) => {
    const existing = db.qaPeriods.find((p) => p.id === id)
    if (existing) {
      // Update volume/target rather than duplicate.
      return {
        ...db,
        qaPeriods: db.qaPeriods.map((p) =>
          p.id === id
            ? {
                ...p,
                monthlyVolume: input.monthlyVolume,
                samplePercent,
                targetCount: targetFor(input.monthlyVolume, samplePercent),
                updatedAt: now,
              }
            : p,
        ),
      }
    }
    return { ...db, qaPeriods: [...db.qaPeriods, period] }
  })
  return period
}

export function updatePeriod(id: string, patch: Partial<QAPeriod>): void {
  setState((db) => ({
    ...db,
    qaPeriods: db.qaPeriods.map((p) => {
      if (p.id !== id) return p
      const merged = { ...p, ...patch, updatedAt: new Date().toISOString() }
      // Keep target in sync if volume/percent changed.
      merged.targetCount = targetFor(merged.monthlyVolume, merged.samplePercent)
      return merged
    }),
  }))
}

export function archivePeriod(id: string): void {
  updatePeriod(id, { status: 'archived' })
}

export function reopenPeriod(id: string): void {
  updatePeriod(id, { status: 'active' })
}

export function deletePeriod(id: string): void {
  setState((db) => ({
    ...db,
    qaPeriods: db.qaPeriods.filter((p) => p.id !== id),
    charts: db.charts.filter((c) => c.periodId !== id),
  }))
}

// ----- charts --------------------------------------------------------------

export interface ChartInput {
  incidentNumber: string
  date?: string
  provider?: string
  crew?: string
  chiefComplaint?: string
  acuity?: string
  raw?: Record<string, string>
}

export function addCharts(periodId: string, operation: OperationId, inputs: ChartInput[]): number {
  const charts: Chart[] = inputs.map((i) => ({
    id: uid('chart'),
    periodId,
    operation,
    incidentNumber: i.incidentNumber,
    date: i.date,
    provider: i.provider,
    crew: i.crew,
    chiefComplaint: i.chiefComplaint,
    acuity: i.acuity,
    raw: i.raw,
    sampled: false,
    status: 'unreviewed',
  }))
  setState((db) => ({ ...db, charts: [...db.charts, ...charts] }))
  return charts.length
}

export function deleteChart(id: string): void {
  setState((db) => ({ ...db, charts: db.charts.filter((c) => c.id !== id) }))
}

export function clearPeriodCharts(periodId: string): void {
  setState((db) => ({ ...db, charts: db.charts.filter((c) => c.periodId !== periodId) }))
}

/**
 * Random-sample selector (spec §6 Module A). Tops the sampled queue up to the
 * period target by randomly promoting unsampled charts. Already-sampled charts
 * (and any scored work) are preserved.
 */
export function drawSample(periodId: string): number {
  const db = getState()
  const period = db.qaPeriods.find((p) => p.id === periodId)
  if (!period) return 0
  const inPeriod = db.charts.filter((c) => c.periodId === periodId)
  const alreadySampled = inPeriod.filter((c) => c.sampled)
  const pool = inPeriod.filter((c) => !c.sampled)
  const need = Math.max(0, period.targetCount - alreadySampled.length)
  if (need === 0 || pool.length === 0) return 0

  // Fisher–Yates shuffle the pool, take `need`.
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const pick = new Set(shuffled.slice(0, need).map((c) => c.id))
  setState((cur) => ({
    ...cur,
    charts: cur.charts.map((c) => (pick.has(c.id) ? { ...c, sampled: true } : c)),
  }))
  return pick.size
}

/** Remove unscored charts from the sample so a fresh draw can be taken. */
export function resetSample(periodId: string): void {
  setState((db) => ({
    ...db,
    charts: db.charts.map((c) =>
      c.periodId === periodId && c.sampled && c.status !== 'scored'
        ? { ...c, sampled: false }
        : c,
    ),
  }))
}

export function saveReview(
  chartId: string,
  scores: Record<string, CriterionStatus>,
  notes: string,
  reviewer: string,
  flagged: boolean,
): void {
  const db = getState()
  const chart = db.charts.find((c) => c.id === chartId)
  if (!chart) return
  const criteria = rubricForOperation(chart.operation)
  const scorePct = computeScore(scores, criteria)
  const review: ChartReview = {
    scores,
    scorePct,
    notes,
    reviewer,
    reviewedAt: new Date().toISOString(),
    flagged,
  }
  setState((cur) => ({
    ...cur,
    charts: cur.charts.map((c) =>
      c.id === chartId ? { ...c, status: 'scored', sampled: true, review } : c,
    ),
  }))
}

export interface BotImportResult {
  matched: number
  created: number
  total: number
}

/**
 * Import a batch of QA-bot reviews into a period (file bridge). Reviews are
 * matched to existing charts by incident number; unmatched ones are added as
 * scored charts so nothing the bot reviewed is lost. See botBridge.ts for the
 * payload contract.
 */
export function importBotReviews(
  periodId: string,
  operation: OperationId,
  reviews: ExternalReview[],
): BotImportResult {
  const db = getState()
  const criteria = rubricForOperation(operation)
  const resolve = buildCriteriaResolver(criteria)
  const now = new Date().toISOString()
  const key = (s: string) => s.trim().toLowerCase()

  const existing = new Map<string, Chart>()
  for (const c of db.charts) {
    if (c.periodId === periodId) existing.set(key(c.incidentNumber), c)
  }

  const updates = new Map<string, Chart>()
  const creates: Chart[] = []
  let matched = 0
  let created = 0

  for (const r of reviews) {
    const inc = (r.incidentNumber ?? '').trim()
    if (!inc) continue

    const scores: Record<string, CriterionStatus> = {}
    if (r.criteria) {
      for (const [k, v] of Object.entries(r.criteria)) {
        const id = resolve(k)
        const status = normalizeStatus(String(v))
        if (id && status) scores[id] = status
      }
    }
    const hasScores = Object.keys(scores).length > 0
    const scorePct =
      r.scorePct != null && Number.isFinite(r.scorePct)
        ? Math.max(0, Math.min(100, Math.round(r.scorePct)))
        : hasScores
          ? computeScore(scores, criteria)
          : 0
    const flagged = r.flagged != null ? !!r.flagged : scorePct < LOW_SCORE_THRESHOLD
    const review: ChartReview = {
      scores,
      scorePct,
      notes: r.notes ?? '',
      reviewer: r.reviewer || 'Chart Review Agent',
      reviewedAt: now,
      flagged,
    }

    const match = existing.get(key(inc))
    if (match) {
      updates.set(match.id, {
        ...match,
        provider: match.provider || r.provider,
        date: match.date || r.date,
        crew: match.crew || r.crew,
        chiefComplaint: match.chiefComplaint || r.chiefComplaint,
        acuity: match.acuity || r.acuity,
        sampled: true,
        status: 'scored',
        review,
      })
      matched++
    } else {
      const chart: Chart = {
        id: uid('chart'),
        periodId,
        operation,
        incidentNumber: inc,
        date: r.date,
        provider: r.provider,
        crew: r.crew,
        chiefComplaint: r.chiefComplaint,
        acuity: r.acuity,
        sampled: true,
        status: 'scored',
        review,
      }
      creates.push(chart)
      existing.set(key(inc), chart) // guard against duplicates within the batch
      created++
    }
  }

  setState((cur) => ({
    ...cur,
    charts: [...cur.charts.map((c) => updates.get(c.id) ?? c), ...creates],
  }))
  return { matched, created, total: matched + created }
}

export function setChartInProgress(chartId: string): void {
  setState((db) => ({
    ...db,
    charts: db.charts.map((c) =>
      c.id === chartId && c.status === 'unreviewed'
        ? { ...c, status: 'in_progress' }
        : c,
    ),
  }))
}

// ----- selectors / hooks ---------------------------------------------------

export function usePeriods(): QAPeriod[] {
  return useSelector((db) => db.qaPeriods)
}

export function usePeriod(id: string | undefined): QAPeriod | undefined {
  return useSelector((db) => db.qaPeriods.find((p) => p.id === id))
}

export function usePeriodCharts(periodId: string | undefined): Chart[] {
  return useSelector((db) => db.charts.filter((c) => c.periodId === periodId))
}

export interface PeriodProgress {
  target: number
  sampled: number
  scored: number
  imported: number
  /** scored / target, clamped to 100. */
  pct: number
}

export function progressFor(charts: Chart[], target: number): PeriodProgress {
  const imported = charts.length
  const sampled = charts.filter((c) => c.sampled).length
  const scored = charts.filter((c) => c.status === 'scored').length
  const pct = target > 0 ? Math.min(100, Math.round((scored / target) * 100)) : 0
  return { target, sampled, scored, imported, pct }
}

export interface ProviderStat {
  provider: string
  reviews: number
  avgScore: number
  lowCount: number
  flagged: number
}

/** Aggregate scored reviews by provider to surface coaching candidates. */
export function providerStats(charts: Chart[]): ProviderStat[] {
  const map = new Map<string, { total: number; sum: number; low: number; flagged: number }>()
  for (const c of charts) {
    if (c.status !== 'scored' || !c.review) continue
    const key = c.provider?.trim() || 'Unknown'
    const entry = map.get(key) ?? { total: 0, sum: 0, low: 0, flagged: 0 }
    entry.total++
    entry.sum += c.review.scorePct
    if (c.review.scorePct < LOW_SCORE_THRESHOLD) entry.low++
    if (c.review.flagged) entry.flagged++
    map.set(key, entry)
  }
  return [...map.entries()]
    .map(([provider, e]) => ({
      provider,
      reviews: e.total,
      avgScore: Math.round(e.sum / e.total),
      lowCount: e.low,
      flagged: e.flagged,
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
}

export function useQASummary() {
  return useSelector((db) => {
    const active = db.qaPeriods.filter((p) => p.status === 'active')
    let target = 0
    let scored = 0
    for (const p of active) {
      target += p.targetCount
      scored += db.charts.filter((c) => c.periodId === p.id && c.status === 'scored').length
    }
    return {
      activePeriods: active.length,
      target,
      scored,
      pct: target > 0 ? Math.min(100, Math.round((scored / target) * 100)) : 0,
    }
  })
}
