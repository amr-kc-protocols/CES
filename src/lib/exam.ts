// ---------------------------------------------------------------------------
// AEMT selection exam client.
//
// The bank and grading live server-side (Postgres SECURITY DEFINER functions
// exam_start / exam_submit). This module only calls them: correct answers never
// reach the browser. Admin reads results straight from exam_attempts (RLS).
// ---------------------------------------------------------------------------

import { getSupabaseClient } from './sync'

export const EXAM_DEADLINE = {
  iso: '2026-08-17T17:00:00-05:00',
  display: 'Sunday, August 17 at 5:00 PM (Central)',
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

export async function startExam(name: string, email: string): Promise<StartResult> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'The exam is temporarily unavailable. Please try again shortly.' }
  const { data, error } = await c.rpc('exam_start', { p_name: name, p_email: email })
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
  return error ? { error: error.message } : { rows: (data ?? []) as AttemptRow[] }
}

export interface BankRow {
  id: number
  domain: string
  stem: string
  answer: number
}

/** The bank, with the key. Admin only, by RLS. */
export async function listExamBank(): Promise<{ rows?: BankRow[]; error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { data, error } = await c.from('exam_questions').select('id, domain, stem, answer')
  return error ? { error: error.message } : { rows: (data ?? []) as BankRow[] }
}
