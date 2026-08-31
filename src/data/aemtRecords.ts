// ---------------------------------------------------------------------------
// Program records a Kansas-approved course must keep and retain for at least
// three years (K.A.R. 109-17-3; proposal §6).
//
// This list was written when CES held almost nothing, so it had two states:
// the app holds it, or it lives in somebody's drive. Both of those are now
// wrong for most of it, and the wrongness is not cosmetic — a row that says
// "kept elsewhere" is an instruction to go and find a file, and half of these
// have no file to find.
//
// Three states, because there are three genuinely different answers to "where
// is this record":
//
//   'ces'        The app holds the record itself. The tab that owns it IS the
//                record, and the only honest status is how much is in it.
//
//   'generated'  CES produces the document from the course record, on demand,
//                by a named command. There is no master copy to locate — a copy
//                in a folder is a snapshot, and the thing worth tracking is
//                whether the copy somebody FILED still matches the course.
//
//   'external'   It genuinely lives in another system and nothing here can
//                produce it. Four of these, each of which says why.
//
// THE DISTINCTION THAT KEPT GETTING LOST is between the document that STATES a
// rule and the record that PROVES it was followed. The policy manual states the
// make-up policy; it is not a record of what any student made up. `doc:forms`
// prints a blank preceptor evaluation; it is not the returned evaluations. Three
// rows here were tagged with the generator that prints their blank form or
// states their policy, which read as "this record is produced by running a
// command" — and it is not. Those rows are now where their evidence actually
// is, and `blankForm` names the command that prints the paper.
// ---------------------------------------------------------------------------

export type RecordSource = 'ces' | 'generated' | 'external'

/**
 * The npm script that produces a document, where one does.
 *
 * Used two ways, and they are not the same claim. On a 'generated' record it is
 * the command that produces THE RECORD. On a CES-held record, `blankForm` is
 * the command that prints the blank instrument the record gets collected on —
 * useful to know, and not a way of producing the record.
 */
export type RecordGenerator =
  | 'doc:syllabus'
  | 'doc:curriculum'
  | 'doc:objectives'
  | 'doc:policies'
  | 'doc:forms'
  | 'doc:application'
  | 'doc:student'

/**
 * Which stored collection has to be non-empty before a CES-held record can
 * honestly be called held. "Held in CES" was previously a label on a list,
 * printed whether or not anything had been entered — which told an auditor the
 * opposite of the truth for an empty course.
 */
export type RecordEvidence =
  | 'attendance'
  | 'skillChecks'
  | 'encounters'
  | 'students'
  | 'sessions'
  | 'completions'
  | 'makeUps'

export interface RequiredRecord {
  id: string
  label: string
  /** Where the record lives. */
  source: RecordSource
  /** For 'generated' records, the command that produces it. */
  generator?: RecordGenerator
  /**
   * Why no command can produce it. Required on every 'external' record by
   * check-records.mjs — one with no explanation is one nobody has thought
   * about, and "no generator" and "generator not written yet" look identical
   * in a list.
   */
  noGenerator?: string
  /** For CES-held records, the tab that owns it. */
  tab?: 'roster' | 'sessions' | 'hours' | 'skills' | 'clinical' | 'forms'
  /**
   * The command that prints the blank instrument this record is collected on.
   * Not a generator: the blank form is paper, the record is what comes back.
   */
  blankForm?: RecordGenerator
  why: string
  /** For CES-held records, the collection that evidences it. */
  evidence?: RecordEvidence
  /**
   * For form-backed CES records, the instrument ids that satisfy THIS record.
   *
   * Counting `formResponses` wholesale said a course had preceptor evaluations
   * on file because somebody had filled in a course evaluation. Every one of
   * the five instruments belongs to exactly one row below, which is what
   * check-records.mjs asserts.
   */
  formEvidence?: string[]
}

export const REQUIRED_RECORDS: RequiredRecord[] = [
  {
    id: 'syllabus',
    label: 'Course syllabus',
    source: 'generated',
    generator: 'doc:syllabus',
    why: 'K.A.R. 109-1-1(ss): goals and objectives, materials, attendance policy, completion requirements, clinical/field description, discipline policies, instructor contact, and the full schedule. Filed with the approval application.',
  },
  {
    id: 'curriculum',
    label: 'Curriculum and lesson plans',
    source: 'generated',
    generator: 'doc:curriculum',
    why: 'The Kansas AEMT Educational Standards (Oct 2014) adopted by K.A.R. 109-10-1c, mapped to your sessions.',
  },
  {
    id: 'objectives',
    label: 'Clinical and field training objectives',
    source: 'generated',
    generator: 'doc:objectives',
    why: 'What a student is expected to achieve on each rotation, given to the preceptor.',
  },
  {
    id: 'gradebook',
    label: 'Gradebook',
    source: 'external',
    noGenerator: 'Live data in the Navigate LMS. Nothing here can produce it, and a snapshot of it would be a claim about grades rather than the grades.',
    why: 'The Navigate pre-class component lives in the LMS; the closed-book quizzes, the three gate exams and the final are scored by the instructor. The completion record stores the attested final percentage, not the working grades.',
  },
  {
    id: 'conferences',
    label: 'Student progress conferences',
    source: 'external',
    noGenerator: 'A record of conversations that have happened, written by whoever held them. The policy manual states when one is triggered; the record itself is per-student and cannot be generated.',
    why: 'At least one documented private conference per student, plus any called for by an affective concern.',
  },
  {
    id: 'outcomes',
    label: 'Outcome assessment and analysis',
    source: 'external',
    noGenerator: 'Written after the cohort completes, against results that do not exist yet. Generating a template now would put an empty analysis on file where a reviewer expects a finding.',
    why: 'Pass rates and programme review, analysed by the Program Manager and Medical Director for continuous improvement.',
  },
  {
    id: 'policies',
    label: 'Program policies',
    source: 'generated',
    generator: 'doc:policies',
    why: 'K.A.R. 109-17-3 — attendance, grading, discipline, remediation and dismissal policies as issued to students.',
  },
  {
    // NOT the make-up POLICY, which the policy manual states and doc:policies
    // generates. This is the per-student record of what each absent student
    // actually made up, which is a different document with a different author,
    // and tagging it with doc:policies said the program could produce it by
    // running a command. It could not: the Hours tab listed what every student
    // owed and offered no way to record that any of it had been done, so the
    // list only ever grew.
    id: 'makeup',
    label: 'Late-enrolment and make-up records',
    source: 'ces',
    tab: 'hours',
    evidence: 'makeUps',
    why: 'K.A.R. 109-17-3 — how a late enrolee or an absent student made up required content, per student. Recorded against the missed session on the Hours tab; the policy it is judged against is in the program policy manual.',
  },
  {
    id: 'exam-outcomes',
    label: 'First-attempt examination outcomes',
    source: 'external',
    noGenerator: 'Comes from the National Registry after candidates sit the examination. It does not exist until then and cannot be generated in advance.',
    why: 'K.A.R. 109-17-3 — first-attempt certification examination results, monitored for programme review.',
  },
  {
    // The BLANK form is generated; the returned evaluations are held here. The
    // old row said this record lived outside CES and was produced by running
    // doc:forms — which described the empty paper, not the evidence. An auditor
    // sent to a shared drive for these would have found nothing, because they
    // are in the Forms tab.
    //
    // NOTE ON THE NAME: this record is the PRECEPTOR evaluating the STUDENT,
    // and the instrument that collects it is `clinical-daily`. The instrument
    // called `preceptor-eval` is the reverse — the student's view of the
    // preceptor — and belongs to the `evaluations` record below.
    id: 'preceptor-eval',
    label: 'Preceptor evaluations of students',
    source: 'ces',
    tab: 'forms',
    formEvidence: ['clinical-daily'],
    blankForm: 'doc:forms',
    why: 'K.A.R. 109-17-3 — the preceptor forms returned from each clinical and field rotation. One per shift; the Forms tab counts shifts without one.',
  },
  {
    id: 'instructor-eval-record',
    label: 'Student evaluations of the course and every instructor',
    source: 'ces',
    tab: 'forms',
    formEvidence: ['instructor-eval', 'course-eval'],
    blankForm: 'doc:forms',
    why: 'K.A.R. 109-17-3 — each student evaluates the course AND each instructor who taught them, not the course alone. On a joint cohort that is one evaluation per instructor per student, not one per student.',
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
    // The two instruments the K.A.R.-named rows above do not claim. Every one
    // of the five belongs to exactly one row, which is what makes the counts
    // mean anything — the old wholesale count of formResponses reported
    // preceptor evaluations on file because somebody had filled in a course
    // evaluation.
    id: 'evaluations',
    label: 'Student evaluations of preceptors, and affective behaviour records',
    source: 'ces',
    tab: 'forms',
    formEvidence: ['preceptor-eval', 'affective'],
    blankForm: 'doc:forms',
    why: 'Program quality, not a K.A.R. 109-17-3 line item: the student’s view of each preceptor, and the affective behaviour record that triggers a documented conference.',
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

/** Records CES holds outright. The tab that owns one is the record. */
export const HELD_RECORDS = REQUIRED_RECORDS.filter((r) => r.source === 'ces')

/** Documents this repository produces from the course record. */
export const GENERATED_RECORDS = REQUIRED_RECORDS.filter((r) => r.source === 'generated')

/**
 * Records that genuinely live in another system.
 *
 * Four, down from eleven. The other seven were either already here or already
 * generated, and calling them "kept elsewhere" sent whoever was assembling a
 * submission to look for files that do not exist.
 */
export const EXTERNAL_RECORDS = REQUIRED_RECORDS.filter((r) => r.source === 'external')

/** Every instrument id claimed by a record, mapped to the record claiming it. */
export const RECORD_FOR_FORM: Record<string, RequiredRecord> = Object.fromEntries(
  REQUIRED_RECORDS.flatMap((r) => (r.formEvidence ?? []).map((f) => [f, r])),
)

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

/**
 * What a FILED copy of a generated document supports.
 *
 * The question docStatus() asks — is there a location, an owner, a version, an
 * approver — is the right question about a document somebody wrote, and the
 * wrong one about a document this program prints on demand. A syllabus record
 * pointing at `syllabus_FINAL_v2.docx` with an approval date of January 2025
 * scored a clean green under docStatus(), for a cohort that did not exist when
 * that file was approved. Every field was filled in; the document was a year
 * stale and did not describe the course.
 *
 * So the only question worth asking about a generated document is whether the
 * copy that was filed was produced AFTER the last change to the course it
 * describes. CES knows both halves of that, so nobody has to remember.
 */
export interface FiledStatus {
  value: 'not-filed' | 'stale' | 'filed'
  label: string
  pill: string
  detail: string
}

export function filedStatus(
  doc: { generatedOn?: string; location?: string } | undefined,
  course: { updatedAt?: string } | undefined,
): FiledStatus {
  if (!doc?.generatedOn) {
    return {
      value: 'not-filed',
      label: 'Not filed',
      pill: 'crit',
      detail: 'Run the command and record where the copy was filed.',
    }
  }
  // updatedAt is a timestamp, generatedOn a date. Comparing the date halves
  // keeps a copy generated the same day the course was last touched from
  // reading stale, which would be technically arguable and practically noise.
  const courseDay = (course?.updatedAt ?? '').slice(0, 10)
  if (courseDay && courseDay > doc.generatedOn) {
    return {
      value: 'stale',
      label: 'Stale',
      pill: 'warn',
      detail: `Filed copy generated ${doc.generatedOn}; the course record changed on ${courseDay}. Regenerate and re-file.`,
    }
  }
  return {
    value: 'filed',
    label: 'Filed',
    pill: 'ok',
    detail: `Generated ${doc.generatedOn}${doc.location ? ` · filed at ${doc.location}` : ''}.`,
  }
}

/** K.A.R. 109-17-3 — program records retained at least this long. */
export const RETENTION_YEARS = 3

/** Retention date for a course, from its end date. */
export function retentionUntil(courseEndDate: string): string {
  if (!courseEndDate) return ''
  const [y, m, d] = courseEndDate.split('-').map(Number)
  return `${y + RETENTION_YEARS}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
