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

/** A bare yes or no, as opposed to an explicit Met / Not met. */
const BARE_YES = /^(y|yes|true|1)$/i
const BARE_NO = /^(n|no|false|0|none)$/i

/**
 * A bot's answer, read as the CES rubric means it.
 *
 * Two rubric items are stated here as the positive of a Ninth Brain question
 * that is asked in reverse — "No near misses to report" against "Were there any
 * near misses?". An Agent answering the Ninth Brain form literally sends "No",
 * the synonym table reads "no" as Not met, and q14 is a CRITICAL item: a crew
 * with nothing to report scored a critical failure on every clean chart.
 *
 * So on a reversed item a bare yes or no is inverted, and anything explicit —
 * "Met", "Not met", "partial" — is taken at its word, because a sender who
 * writes a CES status has already done the translation. "None" is covered by
 * the same rule: on q14 it means no near misses, which is Met, where the
 * general table would read it as N/A and drop it from the score.
 */
export function statusForCriterion(
  criterion: RubricCriterion | undefined,
  value: string,
): CriterionStatus | undefined {
  if (!criterion?.reversed) return normalizeStatus(value)
  const raw = value.trim()
  if (BARE_YES.test(raw)) return 'not_met'
  if (BARE_NO.test(raw)) return 'met'
  return normalizeStatus(value)
}

/**
 * Build a resolver that maps a bot's criterion key onto a CES rubric id.
 *
 * Exact id, then a leading q-number, then an exact label — and nothing else.
 * The contains-match this replaces resolved in rubric order, so ANY key holding
 * "q1" landed on q1: "q13 clinical decisions" and "Q12: documentation" both
 * scored the physical exam item, and "documentation" always resolved to q11
 * because its label contains the word. A key that lands on the wrong question
 * is worse than one that lands nowhere — nothing in the review says it
 * happened — so an unrecognised key is now reported rather than guessed at.
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
    // "q13 clinical decisions" and "Q12: documentation" are the Agent writing
    // the id and the question together. The number is unambiguous; the prose
    // after it is not, and was what did the damage.
    const numbered = /^\s*q\s*0*(\d+)\b/i.exec(key)
    if (numbered) {
      const id = norm(`q${Number(numbered[1])}`)
      if (byId.has(id)) return byId.get(id)
    }
    if (byLabel.has(k)) return byLabel.get(k)
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
