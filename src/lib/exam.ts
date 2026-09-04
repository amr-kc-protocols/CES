// ---------------------------------------------------------------------------
// Selection exam client — AEMT cohort selection, and NEOP new-hire selection.
//
// The bank and grading live server-side (Postgres SECURITY DEFINER functions
// exam_start / exam_submit). This module only calls them: correct answers never
// reach the browser. Admin reads results straight from exam_attempts (RLS).
//
// TWO PROGRAMS, ONE ENGINE. Everything that makes this exam trustworthy is in
// the server functions, not in the questions, so the new-hire exam is a
// `program` argument rather than a second implementation. What differs between
// them is configuration, and all of it is in EXAM_PROGRAMS below — clock,
// cutoff, wording, where results are read. See the 2026-08-18 migration.
// ---------------------------------------------------------------------------

import { getSupabaseClient } from './sync'

export type ExamProgram = 'aemt' | 'neop'

export interface ExamProgramConfig {
  id: ExamProgram
  /** Line under the AMR mark on the candidate page. */
  subtitle: string
  /** Public route the candidate is sent to. */
  path: string
  /**
   * MUST MATCH THE SQL. `v_limit` in exam_start is what actually governs the
   * sitting; this exists so the candidate can be told before they start. The
   * server is authoritative — once an attempt begins the timer counts down the
   * limitSeconds in the server's response, not this constant. Only the
   * pre-start copy can drift, and it did once: the instructions advertised 40
   * minutes for a week after the server moved to 25.
   */
  limitMinutes: number
  /**
   * The close of the window, or null for a rolling exam.
   *
   * AEMT selection runs to a cohort deadline. NEOP hiring does not: a new-hire
   * exam with a date on it is an exam that quietly stops working for every
   * applicant who comes after it, which is a worse failure than any deadline
   * it was meant to enforce.
   */
  deadlineIso: string | null
  /** Who a candidate should contact when something has gone wrong. */
  contact: string
  /** The integrity statement, in display order. `*starred*` runs render bold. */
  attestation: string[]
}

export const EXAM_PROGRAMS: Record<ExamProgram, ExamProgramConfig> = {
  aemt: {
    id: 'aemt',
    subtitle: 'AEMT Program — Selection Exam',
    path: '/exam',
    limitMinutes: 25,
    deadlineIso: '2026-09-06T23:59:00-05:00',
    contact: 'the AMR KC education team',
    attestation: [
      'I am completing this exam *entirely on my own* — no notes, books, websites, apps, or other people.',
      'The answers I submit are *my own work*, and my attempt is recorded with my name and email.',
      "This exam is part of *AMR Kansas City's AEMT selection process*.",
      'Giving or receiving help is a violation of *AMR’s Standards of Conduct* and may result in *disqualification from selection* and further review.',
    ],
  },
  neop: {
    id: 'neop',
    subtitle: 'Kansas City Interfacility — Selection Exam',
    path: '/neop-exam',
    limitMinutes: 35,
    deadlineIso: null,
    contact: 'the AMR Kansas City hiring team',
    attestation: [
      // First, and stored with the attempt: the acknowledgement that they read
      // the job description. It is the whole point of the briefing that nobody
      // can later say they were not told what this operation does.
      'I have read the description of the Kansas City interfacility operation above, and I understand that *this job is not 911 scene response*.',
      'I am completing this exam *entirely on my own* — no notes, books, websites, apps, or other people.',
      'The answers I submit are *my own work*, and my attempt is recorded with my name and email.',
      'This exam is part of *AMR Kansas City’s hiring process* for the interfacility operation.',
      'Giving or receiving help may result in *my application being withdrawn from consideration*.',
    ],
  },
}

export function examConfig(program: ExamProgram = 'aemt'): ExamProgramConfig {
  return EXAM_PROGRAMS[program] ?? EXAM_PROGRAMS.aemt
}

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

export interface ExamDeadline {
  iso: string
  display: string
}

/** Null for a rolling exam — there is no date to show, and none to enforce. */
export function examDeadline(program: ExamProgram = 'aemt'): ExamDeadline | null {
  const iso = examConfig(program).deadlineIso
  return iso ? { iso, display: deadlineDisplay(iso) } : null
}

/** The AEMT deadline, kept as a named export for the candidate email copy. */
export const EXAM_DEADLINE = examDeadline('aemt') as ExamDeadline

/** The AEMT clock, likewise. */
export const EXAM_LIMIT_MINUTES = EXAM_PROGRAMS.aemt.limitMinutes

export function examClosed(program: ExamProgram = 'aemt', now: number = Date.now()): boolean {
  const d = examDeadline(program)
  return d ? now > new Date(d.iso).getTime() : false
}

export interface ExamQuestion {
  id: number
  domain: string
  stem: string
  options: string[]
  /** NEOP only: 'clinical' | 'operations' | 'fit'. Absent on the AEMT exam. */
  section?: string | null
  /** False for the NEOP preference items, which carry no key at all. */
  scored?: boolean
}

export interface ExamStart {
  attemptId: string
  startedAt: string
  limitSeconds: number
  program?: ExamProgram
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
 * The wording is stored ONCE, in EXAM_PROGRAMS above, and both the page and
 * the hash are derived from it. They used to be two copies of the same
 * sentences in two files, which is a promise that they will differ eventually
 * — and the whole purpose of storing the hash is that a later edit cannot
 * silently change what a past candidate is recorded as having agreed to. The
 * emphasis markers are stripped before hashing, so re-bolding a phrase does
 * not invalidate every attestation on record.
 */
export function attestationLines(program: ExamProgram = 'aemt'): string[] {
  return examConfig(program).attestation
}

export function attestationText(program: ExamProgram = 'aemt'): string {
  return attestationLines(program)
    .map((l) => l.replace(/\*/g, ''))
    .join('\n')
}

export const ATTESTATION_TEXT = attestationText('aemt')

/** Stable, non-cryptographic digest. Identifies the wording, not a secret. */
export function attestationHash(text: string = ATTESTATION_TEXT): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0
  return `v1-${h.toString(16)}`
}

/* -------------------------------------------------------------------------
 * When the database has not been set up yet
 *
 * This exam needs a SQL file to have been run against the Supabase project —
 * the functions and the bank do not ship with the app. Nothing verifies that,
 * and on 18 August a candidate opening /neop-exam got the raw PostgREST string
 *
 *   Could not find the function public.exam_start(p_attestation_hash, ...)
 *   in the schema cache
 *
 * printed on the page, under our logo, above a Start button that did nothing.
 * The frontend had been deployed and the migration had not, which is a normal
 * thing to happen and an unacceptable thing for an applicant to be shown.
 *
 * So the two audiences get different messages from the same failure. The
 * candidate gets a sentence that tells them what to do about it, because there
 * is nothing else they can do. An administrator gets the specific problem and
 * the file to run, on their own screen, where it is actionable.
 *
 * Deliberately NOT a fallback to the old function signature. Guessing a call
 * that might work would serve some other exam, or the right exam with the
 * wrong rules, and would hide the setup error until somebody noticed the
 * results were strange.
 * ---------------------------------------------------------------------- */

interface Postgrestish {
  code?: string
  message: string
}

/**
 * True when the failure is "this project has not had the SQL run against it".
 *
 * PGRST202 is PostgREST's "no function matches"; PGRST204 and 42703 are the
 * column-missing pair, which is what an admin read of exam_attempts.program
 * returns on a project that stopped at the previous schema. The message match
 * is a fallback: the codes are stable but not contractual.
 */
export function isSetupError(err: Postgrestish | null | undefined): boolean {
  if (!err) return false
  if (err.code === 'PGRST202' || err.code === 'PGRST204' || err.code === '42703') return true
  return /could not find the function|does not exist|schema cache/i.test(err.message ?? '')
}

/** What an administrator should do about it, in one string. */
export const SETUP_INSTRUCTIONS =
  'The exam is not installed on this Supabase project yet. In the SQL Editor, run supabase/migrations/2026-08-18-neop-selection-exam.sql, then 2026-08-19-neop-exam-sections-and-clock.sql, then supabase/neop_exam_questions_seed.sql. If those have already been run, the schema cache may be stale — run: notify pgrst, \'reload schema\';'

export async function startExam(
  name: string,
  email: string,
  attested?: boolean,
  signature?: string,
  program: ExamProgram = 'aemt',
): Promise<StartResult> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'The exam is temporarily unavailable. Please try again shortly.' }
  const { data, error } = await c.rpc('exam_start', {
    p_name: name,
    p_email: email,
    p_attested: attested ?? null,
    p_signature: signature ?? null,
    p_attestation_hash: attested ? attestationHash(attestationText(program)) : null,
    p_program: program,
  })
  if (error) {
    if (isSetupError(error)) {
      // The detail belongs in the console for whoever is debugging it, and
      // nowhere near the person trying to sit an exam.
      console.error('[exam] not installed on this project:', error.message, '\n', SETUP_INSTRUCTIONS)
      return {
        error: `This exam is temporarily unavailable. Please contact ${examConfig(program).contact} — they will get it reopened.`,
      }
    }
    return { error: error.message }
  }
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
  program?: ExamProgram
  /** Present because the results read is `select *`; the NEOP screen uses both. */
  question_ids?: number[]
  responses?: Record<string, number> | null
}

/** Admin only (RLS). Completed attempts for one program, highest score first. */
export async function listExamResults(
  program: ExamProgram = 'aemt',
): Promise<{ rows?: ExamAttempt[]; error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { data, error } = await c
    .from('exam_attempts')
    .select('*')
    .eq('program', program)
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
export async function listAttemptsForAnalysis(
  program: ExamProgram = 'aemt',
): Promise<{ rows?: AttemptRow[]; error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { data, error } = await c
    .from('exam_attempts')
    .select('id, question_ids, responses')
    .eq('program', program)
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
  /** Null on an unscored item — the NEOP preference section has no key. */
  answer: number | null
  section?: string | null
  code?: string | null
}

/** The bank for one program, with the key. Admin only, by RLS. */
export async function listExamBank(
  program: ExamProgram = 'aemt',
): Promise<{ rows?: BankRow[]; error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { data, error } = await c
    .from('exam_questions')
    .select('id, domain, stem, options, answer, section, code')
    .eq('program', program)
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
export async function listUnfinishedAttempts(
  program: ExamProgram = 'aemt',
): Promise<{
  rows?: UnfinishedAttempt[]
  error?: string
}> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { data, error } = await c
    .from('exam_attempts')
    .select('id, name, email, started_at, limit_seconds')
    .eq('program', program)
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
