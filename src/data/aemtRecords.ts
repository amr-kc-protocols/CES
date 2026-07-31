// ---------------------------------------------------------------------------
// Program records a Kansas-approved course must keep and retain for at least
// three years (K.A.R. 109-17-3; proposal §6).
//
// The app holds some of these outright — attendance, psychomotor evaluations,
// the encounter log, the evaluation forms — and cannot hold others: the
// syllabus, lesson plans, the Navigate gradebook. Rather than pretend to be a
// document store, the registry says which is which. Records held here are
// satisfied by the tab that owns them; everything else is tracked with an
// owner, a status and where the document actually lives.
// ---------------------------------------------------------------------------

export type RecordSource = 'ces' | 'external'

export interface RequiredRecord {
  id: string
  label: string
  /** Where the record lives. */
  source: RecordSource
  /** For CES-held records, the tab that owns it. */
  tab?: 'roster' | 'sessions' | 'hours' | 'skills' | 'clinical' | 'forms'
  why: string
}

export const REQUIRED_RECORDS: RequiredRecord[] = [
  {
    id: 'syllabus',
    label: 'Course syllabus',
    source: 'external',
    why: 'K.A.R. 109-1-1(ss): goals and objectives, materials, attendance policy, completion requirements, clinical/field description, discipline policies, instructor contact, and the full schedule. Filed with the approval application.',
  },
  {
    id: 'curriculum',
    label: 'Curriculum and lesson plans',
    source: 'external',
    why: 'The Kansas AEMT Educational Standards (Oct 2014) adopted by K.A.R. 109-10-1c, mapped to your sessions.',
  },
  {
    id: 'objectives',
    label: 'Clinical and field training objectives',
    source: 'external',
    why: 'What a student is expected to achieve on each rotation, given to the preceptor.',
  },
  {
    id: 'gradebook',
    label: 'Gradebook',
    source: 'external',
    why: 'Exams 60% and quizzes 40% live in the Navigate LMS. The completion record stores the attested final percentage, not the working grades.',
  },
  {
    id: 'conferences',
    label: 'Student progress conferences',
    source: 'external',
    why: 'At least one documented private conference per student, plus any called for by an affective concern.',
  },
  {
    id: 'outcomes',
    label: 'Outcome assessment and analysis',
    source: 'external',
    why: 'Pass rates and programme review, analysed by the Program Manager and Medical Director for continuous improvement.',
  },
  {
    id: 'attendance',
    label: 'Attendance and contact hours',
    source: 'ces',
    tab: 'hours',
    why: 'Held in CES — the hours grid and the 8-hour absence policy.',
  },
  {
    id: 'psychomotor',
    label: 'Psychomotor skill evaluations',
    source: 'ces',
    tab: 'skills',
    why: 'Held in CES — per-criterion results, critical failures and sign-off.',
  },
  {
    id: 'encounters',
    label: 'Patient encounter log',
    source: 'ces',
    tab: 'clinical',
    why: 'Held in CES — every rep against its shift, preceptor and K.A.R. 109-11-8 minimum.',
  },
  {
    id: 'evaluations',
    label: 'Preceptor, instructor and course evaluations',
    source: 'ces',
    tab: 'forms',
    why: 'Held in CES — the five evaluation instruments.',
  },
  {
    id: 'roster-record',
    label: 'Student roster and completions',
    source: 'ces',
    tab: 'roster',
    why: 'Held in CES — enrolment, withdrawals, and verified completions with their overrides.',
  },
]

/** Records the app does not hold, which have to be produced and tracked. */
export const EXTERNAL_RECORDS = REQUIRED_RECORDS.filter((r) => r.source === 'external')

export type RecordStatus = 'missing' | 'draft' | 'in-review' | 'approved'

export const RECORD_STATUS: { value: RecordStatus; label: string; pill: string }[] = [
  { value: 'missing', label: 'Not started', pill: 'crit' },
  { value: 'draft', label: 'Draft', pill: 'warn' },
  { value: 'in-review', label: 'In review', pill: 'info' },
  { value: 'approved', label: 'Approved', pill: 'ok' },
]

/** K.A.R. 109-17-3 — program records retained at least this long. */
export const RETENTION_YEARS = 3

/** Retention date for a course, from its end date. */
export function retentionUntil(courseEndDate: string): string {
  if (!courseEndDate) return ''
  const [y, m, d] = courseEndDate.split('-').map(Number)
  return `${y + RETENTION_YEARS}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
