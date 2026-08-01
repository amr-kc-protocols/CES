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
  /**
   * For CES-held records: which stored collection has to be non-empty before
   * the record can honestly be called held. "Held in CES" was previously a
   * label on a list, printed whether or not anything had been entered — which
   * told an auditor the opposite of the truth for an empty course.
   */
  evidence?:
    | 'attendance'
    | 'skillChecks'
    | 'encounters'
    | 'formResponses'
    | 'students'
    | 'sessions'
    | 'completions'
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
    id: 'policies',
    label: 'Program policies',
    source: 'external',
    why: 'K.A.R. 109-17-3 — attendance, grading, discipline, remediation and dismissal policies as issued to students.',
  },
  {
    id: 'makeup',
    label: 'Late-enrolment and make-up schedules',
    source: 'external',
    why: 'K.A.R. 109-17-3 — how a late enrolee or an absent student made up required content, per student.',
  },
  {
    id: 'exam-outcomes',
    label: 'First-attempt examination outcomes',
    source: 'external',
    why: 'K.A.R. 109-17-3 — first-attempt certification examination results, monitored for programme review.',
  },
  {
    id: 'preceptor-eval',
    label: 'Preceptor evaluations of students',
    source: 'external',
    why: 'K.A.R. 109-17-3 — the preceptor forms returned from each clinical and field rotation.',
  },
  {
    id: 'instructor-eval-record',
    label: 'Student evaluations of the course and every instructor',
    source: 'external',
    why: 'K.A.R. 109-17-3 — each student evaluates the course AND each instructor who taught them, not the course alone.',
  },
  {
    id: 'attendance',
    evidence: 'attendance',
    label: 'Attendance and contact hours',
    source: 'ces',
    tab: 'hours',
    why: 'Held in CES — the hours grid and the 8-hour absence policy.',
  },
  {
    id: 'psychomotor',
    evidence: 'skillChecks',
    label: 'Psychomotor skill evaluations',
    source: 'ces',
    tab: 'skills',
    why: 'Held in CES — per-criterion results, critical failures and sign-off.',
  },
  {
    id: 'encounters',
    evidence: 'encounters',
    label: 'Patient encounter log',
    source: 'ces',
    tab: 'clinical',
    why: 'Held in CES — every rep against its shift, preceptor and K.A.R. 109-11-8 minimum.',
  },
  {
    id: 'evaluations',
    evidence: 'formResponses',
    label: 'Preceptor, instructor and course evaluations',
    source: 'ces',
    tab: 'forms',
    why: 'Held in CES — the five evaluation instruments.',
  },
  {
    id: 'schedule-record',
    label: 'Approved course schedule',
    source: 'ces',
    tab: 'sessions',
    evidence: 'sessions',
    why: 'K.A.R. 109-11-4a — date, time, subject, instructor and lab hours of every session.',
  },
  {
    id: 'completion-record',
    label: 'Completion verifications',
    source: 'ces',
    tab: 'roster',
    evidence: 'completions',
    why: 'K.A.R. 109-11-8 — written verification by the primary instructor within 15 days of the final session.',
  },
  {
    id: 'roster-record',
    evidence: 'students',
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

// ----- derived agreement status ----------------------------------------------

export interface AgreementStatus {
  value: 'none' | 'draft' | 'executed'
  label: string
  pill: string
  /** What is still missing before this can be called executed. */
  missing: string[]
  /** Executed, but the covered period does not include the course. */
  outOfPeriod?: boolean
}

/**
 * What the evidence actually supports.
 *
 * An agreement is executed when there is a document to point at, both parties
 * signed it, it says when it takes effect, and it says what students may do.
 * Anything short of that is in negotiation at best — regardless of what
 * someone selected from a menu.
 */
export function agreementStatus(
  site: {
    agreementRef?: string
    signedDate?: string
    signedBySite?: string
    signedByProgram?: string
    effectiveFrom?: string
    effectiveTo?: string
    permits?: string
  },
  course?: { startDate?: string; endDate?: string },
): AgreementStatus {
  const missing: string[] = []
  if (!site.agreementRef?.trim()) missing.push('document location')
  if (!site.signedDate) missing.push('signature date')
  if (!site.signedBySite?.trim()) missing.push('site signatory')
  if (!site.signedByProgram?.trim()) missing.push('program signatory')
  if (!site.effectiveFrom) missing.push('effective date')
  if (!site.permits?.trim()) missing.push('permitted scope')

  if (missing.length === 0) {
    // Signed, but does it cover the course being run under it?
    const from = site.effectiveFrom!
    const to = site.effectiveTo
    const startsLate = !!course?.startDate && from > course.startDate
    const endsEarly = !!to && !!course?.endDate && to < course.endDate
    if (startsLate || endsEarly) {
      return {
        value: 'draft',
        label: 'Outside course dates',
        pill: 'crit',
        missing: [],
        outOfPeriod: true,
      }
    }
    return { value: 'executed', label: 'Executed', pill: 'ok', missing: [] }
  }
  // Something is on file, but not enough to call it executed.
  const started = !!site.agreementRef?.trim() || !!site.signedDate
  return started
    ? { value: 'draft', label: 'In negotiation', pill: 'warn', missing }
    : { value: 'none', label: 'Not started', pill: 'crit', missing }
}

/**
 * What an external record's evidence supports.
 *
 * "Approved" used to be a menu choice, so a record could read approved with no
 * location, no owner, no version and no approver — which is exactly the state
 * an inventory exists to expose. The status is now computed from the fields,
 * and the label names what is missing.
 */
export function docStatus(doc?: {
  location?: string
  owner?: string
  version?: string
  approvedBy?: string
  approvedDate?: string
}): { value: RecordStatus; label: string; pill: string; missing: string[] } {
  if (!doc) return { value: 'missing', label: 'Not started', pill: 'crit', missing: ['everything'] }
  const missing: string[] = []
  if (!doc.location?.trim()) missing.push('location')
  if (!doc.owner?.trim()) missing.push('owner')
  if (!doc.version?.trim()) missing.push('version')
  if (!doc.approvedBy?.trim()) missing.push('approver')
  if (!doc.approvedDate) missing.push('approval date')

  if (missing.length === 0) return { value: 'approved', label: 'Approved', pill: 'ok', missing }
  // A location alone means the document exists somewhere; without one there is
  // nothing to review.
  if (!doc.location?.trim()) {
    return { value: 'missing', label: 'No document', pill: 'crit', missing }
  }
  return missing.length <= 2
    ? { value: 'in-review', label: 'In review', pill: 'info', missing }
    : { value: 'draft', label: 'Draft', pill: 'warn', missing }
}

/** K.A.R. 109-17-3 — program records retained at least this long. */
export const RETENTION_YEARS = 3

/** Retention date for a course, from its end date. */
export function retentionUntil(courseEndDate: string): string {
  if (!courseEndDate) return ''
  const [y, m, d] = courseEndDate.split('-').map(Number)
  return `${y + RETENTION_YEARS}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
