// ---------------------------------------------------------------------------
// AEMT selection exam client.
//
// The bank and grading live server-side (Postgres SECURITY DEFINER functions
// exam_start / exam_submit). This module only calls them: correct answers never
// reach the browser. Admin reads results straight from exam_attempts (RLS).
// ---------------------------------------------------------------------------

import { getSupabaseClient } from './sync'

/**
 * The exam window, and how long a sitting lasts.
 *
 * BOTH VALUES MUST MATCH THE SQL. `v_cutoff` and `v_limit` in
 * supabase/migrations/2026-08-08-exam-hardening.sql are what actually govern
 * the exam; these exist so the candidate can be told before they start. The
 * server is authoritative — once an attempt begins, the timer counts down
 * `limitSeconds` from the server response, not this constant. Only the
 * pre-start copy can drift, and it did: the instructions advertised 40 minutes
 * for a week after the server moved to 25.
 */
export const EXAM_LIMIT_MINUTES = 25

const DEADLINE_ISO = '2026-08-17T17:00:00-05:00'

/**
 * The weekday is DERIVED, never typed.
 *
 * It previously read "Sunday, August 17" when 17 August 2026 is a Monday.
 * A candidate reading that has two different deadlines a day apart and no way
 * to tell which is meant — exactly the sort of thing that becomes a dispute
 * about somebody's place in a cohort. Computing it removes the failure mode
 * rather than correcting one instance of it.
 */
function deadlineDisplay(iso: string): string {
  const d = new Date(iso)
  // Rendered in the deadline's own timezone (US Central), not the reader's, so
  // a candidate in a different zone still sees the date the rule refers to.
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', ...opts }).format(d)
  return `${fmt({ weekday: 'long' })}, ${fmt({ month: 'long', day: 'numeric' })} at ${fmt({
    hour: 'numeric',
    minute: '2-digit',
  })} (Central)`
}

export const EXAM_DEADLINE = {
  iso: DEADLINE_ISO,
  display: deadlineDisplay(DEADLINE_ISO),
}

export function examClosed(now: number = Date.now()): boolean {
  return now > new Date(EXAM_DEADLINE.iso).getTime()
}

export interface ExamQuestion {
  id: number
  domain: string
  stem: string
  options: string[]
}

export interface ExamStart {
  attemptId: string
  startedAt: string
  limitSeconds: number
  questions: ExamQuestion[]
}

/**
 * `expired` means the attempt's clock ran out before it was submitted. The
 * server treats that as the attempt being spent — the draw happens once per
 * email, so there is no second set of questions to hand out. Clearing it is a
 * deliberate admin action, not something the candidate can trigger.
 */
export type StartResult =
  | { data: ExamStart }
  | { reason: 'closed' | 'already_taken' | 'expired' }
  | { error: string }

/**
 * The Integrity Statement the candidate agrees to.
 *
 * Kept here rather than only in the component so the exact wording can be
 * hashed and stored with the attempt. A future edit to the statement then
 * cannot silently change what a past candidate is recorded as having agreed
 * to — the stored hash simply stops matching, which is the honest outcome.
 */
export const ATTESTATION_TEXT = [
  'I am completing this exam entirely on my own — no notes, books, websites, apps, or other people.',
  'The answers I submit are my own work, and my attempt is recorded with my name and email.',
  "This exam is part of AMR Kansas City's AEMT selection process.",
  "Giving or receiving help is a violation of AMR's Standards of Conduct and may result in disqualification from selection and further review.",
].join('\n')

/** Stable, non-cryptographic digest. Identifies the wording, not a secret. */
export function attestationHash(text: string = ATTESTATION_TEXT): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0
  return `v1-${h.toString(16)}`
}

export async function startExam(
  name: string,
  email: string,
  attested?: boolean,
  signature?: string,
): Promise<StartResult> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'The exam is temporarily unavailable. Please try again shortly.' }
  const { data, error } = await c.rpc('exam_start', {
    p_name: name,
    p_email: email,
    p_attested: attested ?? null,
    p_signature: signature ?? null,
    p_attestation_hash: attested ? attestationHash() : null,
  })
  if (error) return { error: error.message }
  const d = data as Record<string, unknown>
  if (d?.error) {
    if (d.error === 'closed' || d.error === 'already_taken' || d.error === 'expired') {
      return { reason: d.error as 'closed' | 'already_taken' | 'expired' }
    }
    return { error: String(d.error) }
  }
  return { data: data as ExamStart }
}

/** responses: { [questionId]: chosen option index (0-3, ORIGINAL order) }. */
export async function submitExam(
  attemptId: string,
  responses: Record<number, number>,
): Promise<{ error?: string; expired?: boolean }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { data, error } = await c.rpc('exam_submit', { p_attempt: attemptId, p_responses: responses })
  if (error) return { error: error.message }
  const d = data as Record<string, unknown>
  if (d?.error === 'expired') return { expired: true }
  if (d?.error) return { error: String(d.error) }
  return {}
}

export interface ExamAttempt {
  id: string
  name: string
  email: string
  started_at: string
  submitted_at: string | null
  score: number | null
  total: number
  percent: number | null
}

/** Admin only (RLS). Completed attempts, highest score first. */
export async function listExamResults(): Promise<{ rows?: ExamAttempt[]; error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { data, error } = await c
    .from('exam_attempts')
    .select('*')
    .not('submitted_at', 'is', null)
    .is('voided_at', null)
    .order('percent', { ascending: false })
  return error ? { error: error.message } : { rows: (data ?? []) as ExamAttempt[] }
}

/* -------------------------------------------------------------------------
 * Item analysis (admin)
 *
 * These two reads are what the test-quality panel runs on. Both are already
 * permitted by the existing RLS policies — "admin reads exam bank" and "admin
 * reads exam attempts" — so this widens nothing: any admin could already
 * fetch the key with one call. It is worth knowing that it happens, though.
 * The bank's answers reach an ADMIN browser here; they still never reach a
 * candidate's, which is the guarantee the design actually makes.
 * ---------------------------------------------------------------------- */

export interface AttemptRow {
  id: string
  question_ids: number[]
  responses: Record<string, number> | null
}

/** Submitted attempts with their served items and raw responses. */
export async function listAttemptsForAnalysis(): Promise<{ rows?: AttemptRow[]; error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { data, error } = await c
    .from('exam_attempts')
    .select('id, question_ids, responses')
    .not('submitted_at', 'is', null)
    // A voided attempt must not move an item's difficulty or discrimination.
    .is('voided_at', null)
  return error ? { error: error.message } : { rows: (data ?? []) as AttemptRow[] }
}

export interface BankRow {
  id: number
  domain: string
  stem: string
  /** The four choices, in bank order. The exam shuffles display order. */
  options: string[]
  answer: number
}

/** The bank, with the key. Admin only, by RLS. */
export async function listExamBank(): Promise<{ rows?: BankRow[]; error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { data, error } = await c.from('exam_questions').select('id, domain, stem, options, answer')
  return error ? { error: error.message } : { rows: (data ?? []) as BankRow[] }
}

/* -------------------------------------------------------------------------
 * Resetting an attempt (admin)
 *
 * One attempt per email is the rule, so a candidate whose sitting went wrong —
 * a dead submit button, a flat battery, a phone that rang — is locked out
 * until someone clears it. That was a SQL job; this makes it a button, which
 * matters because the person who needs it is usually mid-conversation with the
 * candidate. The `for all` policy from the markets migration already permits
 * an admin to delete within their own market, so no new grant is involved.
 * ---------------------------------------------------------------------- */

export interface UnfinishedAttempt {
  id: string
  name: string
  email: string
  started_at: string
  limit_seconds: number
}

/** Started but never submitted — still running, or out of time. Admin only. */
export async function listUnfinishedAttempts(): Promise<{
  rows?: UnfinishedAttempt[]
  error?: string
}> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { data, error } = await c
    .from('exam_attempts')
    .select('id, name, email, started_at, limit_seconds')
    .is('submitted_at', null)
    .is('voided_at', null)
    .order('started_at', { ascending: false })
  return error ? { error: error.message } : { rows: (data ?? []) as UnfinishedAttempt[] }
}

/** Whether this attempt's clock has run out. */
export function attemptExpired(a: UnfinishedAttempt, now: number = Date.now()): boolean {
  return now > new Date(a.started_at).getTime() + a.limit_seconds * 1000
}

/**
 * Clear an attempt so the candidate can sit the exam again.
 *
 * VOIDS the row rather than deleting it. A voided attempt stops counting
 * everywhere — results, unfinished list, item analysis — and stops blocking
 * the candidate, but it stays in the table.
 *
 * Deleting would take the integrity agreement with it: the tick, the typed
 * signature, the timestamp and the hash of the wording, all stored for exactly
 * the case where an attempt is later questioned. It would also leave no record
 * that a reset happened or who decided it. On an instrument that decides who
 * gets a seat, the evidence should not vanish at the moment somebody exercises
 * discretion over it.
 *
 * `voided_at` is set to a placeholder here; a trigger overwrites it with the
 * server clock and stamps `voided_by` from the session, so an account cannot
 * name a different one. The reason is the caller's to supply.
 */
export async function resetAttempt(id: string, reason?: string): Promise<{ error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { error } = await c
    .from('exam_attempts')
    .update({ voided_at: new Date().toISOString(), void_reason: reason?.trim() || null })
    .eq('id', id)
  return error ? { error: error.message } : {}
}
