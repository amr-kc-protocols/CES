import type { CriterionStatus, RubricCriterion } from '../../types'
import { parseTable } from '../../lib/csv'

// ---------------------------------------------------------------------------
// File bridge for the Ninth Brain Chart Review Agent (the "QA bot").
//
// The bot scores charts on Hunter's machine and exports a batch; CES imports
// that batch into a QA period. This module is the contract: it parses the
// bridge payload (JSON or CSV) and normalizes free-form bot output onto the
// CES rubric. The schema is documented in docs/bot-bridge.md.
// ---------------------------------------------------------------------------

/** One chart's scored review as emitted by the bot. Most fields are optional. */
export interface ExternalReview {
  incidentNumber: string
  date?: string
  provider?: string
  crew?: string
  chiefComplaint?: string
  acuity?: string
  /** Overall QA score 0–100. If omitted, CES computes it from `criteria`. */
  scorePct?: number
  /** Per-criterion results keyed by CES criterion id OR its human label. */
  criteria?: Record<string, string>
  flagged?: boolean
  notes?: string
  reviewer?: string
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// Map the many ways a bot might phrase a status onto the four CES states.
const STATUS_ALIASES: Record<string, CriterionStatus> = {}
const addAliases = (status: CriterionStatus, words: string[]) => {
  for (const w of words) STATUS_ALIASES[norm(w)] = status
}
addAliases('met', ['met', 'yes', 'y', 'pass', 'passed', 'true', '1', 'complete', 'compliant', 'ok', 'present', 'documented', 'satisfactory'])
addAliases('partial', ['partial', 'partially', 'part', 'incomplete', 'some'])
addAliases('not_met', ['notmet', 'not_met', 'not met', 'no', 'n', 'fail', 'failed', 'false', '0', 'missing', 'absent', 'deficient', 'noncompliant'])
addAliases('na', ['na', 'n/a', 'notapplicable', 'not applicable', 'none'])

export function normalizeStatus(value: string): CriterionStatus | undefined {
  return STATUS_ALIASES[norm(value)]
}

/**
 * Build a resolver that maps a bot's criterion key (an id or a label, in any
 * casing/punctuation) onto a CES rubric criterion id. Falls back to a
 * contains-match so "Vitals documented" resolves to the `vitals` criterion.
 */
export function buildCriteriaResolver(criteria: RubricCriterion[]): (key: string) => string | undefined {
  const byId = new Map<string, string>()
  const byLabel = new Map<string, string>()
  for (const c of criteria) {
    byId.set(norm(c.id), c.id)
    byLabel.set(norm(c.label), c.id)
  }
  return (key: string) => {
    const k = norm(key)
    if (byId.has(k)) return byId.get(k)
    if (byLabel.has(k)) return byLabel.get(k)
    // contains match against labels/ids
    for (const c of criteria) {
      const nl = norm(c.label)
      const ni = norm(c.id)
      if (k && (nl.includes(k) || k.includes(nl) || k.includes(ni))) return c.id
    }
    return undefined
  }
}

export interface ParsedBatch {
  reviews: ExternalReview[]
  error?: string
}

function coerceReview(o: Record<string, unknown>): ExternalReview | null {
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const found = Object.keys(o).find((ok) => norm(ok) === norm(k))
      if (found && o[found] != null && String(o[found]).trim() !== '') return String(o[found]).trim()
    }
    return undefined
  }
  const incidentNumber = pick('incidentNumber', 'incident', 'incident_number', 'run', 'runNumber', 'pcr', 'report', 'id')
  if (!incidentNumber) return null
  const scoreRaw = pick('scorePct', 'score', 'qaScore', 'percent', 'scorePercent')
  const flaggedRaw = pick('flagged', 'flag', 'followUp', 'coaching')
  const review: ExternalReview = {
    incidentNumber,
    date: pick('date', 'callDate', 'serviceDate'),
    provider: pick('provider', 'primary', 'medic', 'clinician', 'author'),
    crew: pick('crew', 'unit', 'partner'),
    chiefComplaint: pick('chiefComplaint', 'complaint', 'chief', 'impression'),
    acuity: pick('acuity', 'priority', 'severity'),
    scorePct: scoreRaw != null ? Number(scoreRaw) : undefined,
    notes: pick('notes', 'summary', 'findings', 'comment'),
    reviewer: pick('reviewer', 'agent', 'model'),
  }
  if (scoreRaw != null && !Number.isFinite(review.scorePct)) review.scorePct = undefined
  if (flaggedRaw != null) review.flagged = ['true', 'yes', '1', 'y', 'flag', 'flagged'].includes(norm(flaggedRaw))
  const crit = (o as { criteria?: unknown }).criteria
  if (crit && typeof crit === 'object' && !Array.isArray(crit)) {
    review.criteria = {}
    for (const [k, v] of Object.entries(crit as Record<string, unknown>)) {
      review.criteria[k] = String(v)
    }
  }
  return review
}

/** Parse a JSON string ({reviews:[…]} or a bare array) or CSV text. */
export function parseBotBatch(text: string): ParsedBatch {
  const trimmed = text.trim()
  if (!trimmed) return { reviews: [], error: 'The file is empty.' }

  // JSON path
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const data = JSON.parse(trimmed) as unknown
      const arr = Array.isArray(data)
        ? data
        : Array.isArray((data as { reviews?: unknown }).reviews)
          ? (data as { reviews: unknown[] }).reviews
          : null
      if (!arr) return { reviews: [], error: 'JSON must be an array of reviews or an object with a "reviews" array.' }
      const reviews = arr
        .map((r) => (r && typeof r === 'object' ? coerceReview(r as Record<string, unknown>) : null))
        .filter((r): r is ExternalReview => r !== null)
      if (reviews.length === 0) return { reviews: [], error: 'No reviews had an incident number.' }
      return { reviews }
    } catch (e) {
      return { reviews: [], error: 'Could not parse JSON: ' + (e as Error).message }
    }
  }

  // CSV path (flat, overall-score rows)
  const table = parseTable(trimmed)
  if (table.rows.length === 0) return { reviews: [], error: 'No rows found in the file.' }
  const reviews = table.rows
    .map((row) => coerceReview(row))
    .filter((r): r is ExternalReview => r !== null)
  if (reviews.length === 0) return { reviews: [], error: 'No rows had an incident number.' }
  return { reviews }
}
