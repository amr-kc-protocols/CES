// ---------------------------------------------------------------------------
// AEMT candidate intake.
//
// A public, no-login form (candidates) writes to the `intake_submissions`
// table via the built-in anon key; only an admin can read the results back.
// The field spec lives here so the form and the admin results view render the
// exact same labels/order from one source.
// ---------------------------------------------------------------------------

import { getSupabaseClient } from './sync'

export type IntakeFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'select'
  | 'radio'
  | 'yesno'
  | 'checkboxes'
  | 'textarea'

export interface IntakeField {
  key: string
  label: string
  type: IntakeFieldType
  required?: boolean
  options?: string[]
  placeholder?: string
  help?: string
  /** Show this field only when another field currently equals a value. */
  showIf?: { key: string; equals: string }
}

export interface IntakeSection {
  title: string
  intro?: string
  fields: IntakeField[]
}

/** The AEMT selection intake — screens for time and ability to complete. */
export const AEMT_INTAKE: IntakeSection[] = [
  {
    title: 'About you',
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true, placeholder: 'name@gmr.net' },
      { key: 'phone', label: 'Mobile phone', type: 'tel', required: true },
      { key: 'employeeId', label: 'Employee # (if you have one)', type: 'text' },
      {
        key: 'operation',
        label: 'Primary station / operation',
        type: 'select',
        required: true,
        options: ['Kansas City', 'Cass County', 'Linn County', 'Other'],
      },
    ],
  },
  {
    title: 'Your time with AMR',
    fields: [
      {
        key: 'tenure',
        label: 'How long have you been with AMR?',
        type: 'select',
        required: true,
        options: [
          'Less than 6 months',
          '6–12 months',
          '1–2 years',
          '2–5 years',
          '5+ years',
          'Not currently employed by AMR',
        ],
      },
      {
        key: 'status',
        label: 'Employment status',
        type: 'radio',
        required: true,
        options: ['Full-time', 'Part-time', 'PRN / as-needed'],
      },
    ],
  },
  {
    title: 'Outside commitments',
    intro: 'This helps us understand the demands already on your schedule.',
    fields: [
      { key: 'otherJob', label: 'Do you work any other job(s) outside AMR?', type: 'yesno', required: true },
      {
        key: 'otherJobHours',
        label: 'About how many hours a week at your other job(s)?',
        type: 'text',
        showIf: { key: 'otherJob', equals: 'Yes' },
      },
      { key: 'inSchool', label: 'Are you currently enrolled in school?', type: 'yesno', required: true },
      {
        key: 'schoolDetails',
        label: 'What program, and roughly what days/hours?',
        type: 'text',
        showIf: { key: 'inSchool', equals: 'Yes' },
      },
    ],
  },
  {
    title: 'Availability & commitment',
    fields: [
      {
        key: 'availability',
        label: 'When are you generally available for class days?',
        type: 'checkboxes',
        required: true,
        options: ['Weekday mornings', 'Weekday afternoons', 'Weekday evenings', 'Weekends', 'Overnights'],
      },
      {
        key: 'conflicts',
        label:
          'Any known conflicts during a multi-week course? (vacations, planned leave, second-job shifts, childcare)',
        type: 'textarea',
      },
      {
        key: 'canCommit',
        label:
          'The AEMT course is a significant commitment over several weeks. Are you able to commit the time to complete it?',
        type: 'radio',
        required: true,
        options: ['Yes', 'No', 'Not sure yet'],
      },
      {
        key: 'why',
        label: 'Why are you interested in the AEMT program? (optional)',
        type: 'textarea',
      },
    ],
  },
]

/** Flat, ordered field list — used to render answers on the admin side. */
export const AEMT_FIELDS: IntakeField[] = AEMT_INTAKE.flatMap((s) => s.fields)

export interface IntakeSubmission {
  id: string
  created_at: string
  form: string
  data: Record<string, unknown>
  archived: boolean
  /** Selection pipeline status (added by the status migration; defaults 'New'). */
  status?: string
}

// Selection pipeline. Data-driven so adding/renaming a stage is a one-line
// edit; the pill class gives each stage an at-a-glance colour.
export const INTAKE_STATUSES = ['New', 'Shortlisted', 'Contacted', 'Accepted', 'Declined'] as const
export type IntakeStatus = (typeof INTAKE_STATUSES)[number]
export const DEFAULT_STATUS: IntakeStatus = 'New'

export const STATUS_PILL: Record<string, string> = {
  New: 'muted',
  Shortlisted: 'info',
  Contacted: 'warn',
  Accepted: 'ok',
  Declined: 'crit',
}

/** A row's status, falling back to 'New' for rows saved before the migration. */
export function statusOf(row: IntakeSubmission): IntakeStatus {
  const s = row.status
  return s && (INTAKE_STATUSES as readonly string[]).includes(s) ? (s as IntakeStatus) : DEFAULT_STATUS
}

// Submission cutoff. The instant is anchored to Central time (CDT, −05:00) so
// it closes at the right moment regardless of a candidate's device timezone;
// the display string is fixed text so everyone reads the same "Central" time.
export const AEMT_INTAKE_DEADLINE = {
  iso: '2026-08-10T17:00:00-05:00',
  display: 'Monday, August 10 at 5:00 PM (Central)',
}

export function intakeClosed(now: number = Date.now()): boolean {
  return now > new Date(AEMT_INTAKE_DEADLINE.iso).getTime()
}

const FORM_ID = 'aemt'

/** Public submit — works signed out via the built-in anon key + RLS. */
export async function submitIntake(data: Record<string, unknown>): Promise<{ error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Submissions are temporarily unavailable. Please try again shortly.' }
  const { error } = await c.from('intake_submissions').insert({ form: FORM_ID, data })
  return error ? { error: error.message } : {}
}

/** Admin only (RLS blocks everyone else). Newest first. */
export async function listIntake(): Promise<{ rows?: IntakeSubmission[]; error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { data, error } = await c
    .from('intake_submissions')
    .select('*')
    .eq('form', FORM_ID)
    .order('created_at', { ascending: false })
  return error ? { error: error.message } : { rows: (data ?? []) as IntakeSubmission[] }
}

export async function setIntakeArchived(id: string, archived: boolean): Promise<{ error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { error } = await c.from('intake_submissions').update({ archived }).eq('id', id)
  return error ? { error: error.message } : {}
}

export async function setIntakeStatus(id: string, status: IntakeStatus): Promise<{ error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { error } = await c.from('intake_submissions').update({ status }).eq('id', id)
  return error ? { error: error.message } : {}
}

export async function deleteIntake(id: string): Promise<{ error?: string }> {
  const c = await getSupabaseClient()
  if (!c) return { error: 'Cloud project not configured.' }
  const { error } = await c.from('intake_submissions').delete().eq('id', id)
  return error ? { error: error.message } : {}
}

/** Render one stored answer as display text. */
export function answerText(value: unknown): string {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  return String(value)
}
