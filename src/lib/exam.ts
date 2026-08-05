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

export type StartResult =
  | { data: ExamStart }
  | { reason: 'closed' | 'already_taken' }
  | { error: string }

export async function startExam(name: string, email: string): Promise<StartResult> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'The exam is temporarily unavailable. Please try again shortly.' }
  const { data, error } = await c.rpc('exam_start', { p_name: name, p_email: email })
  if (error) return { error: error.message }
  const d = data as Record<string, unknown>
  if (d?.error) {
    if (d.error === 'closed' || d.error === 'already_taken') return { reason: d.error }
    return { error: String(d.error) }
  }
  return { data: data as ExamStart }
}

/** responses: { [questionId]: chosen option index (0-3, ORIGINAL order) }. */
export async function submitExam(
  attemptId: string,
  responses: Record<number, number>,
): Promise<{ error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { data, error } = await c.rpc('exam_submit', { p_attempt: attemptId, p_responses: responses })
  if (error) return { error: error.message }
  const d = data as Record<string, unknown>
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
