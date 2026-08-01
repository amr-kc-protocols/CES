// ---------------------------------------------------------------------------
// Shared domain types for the AMR Clinical Education Suite.
// ---------------------------------------------------------------------------

export type OperationId = 'kc' | 'cass' | 'linn'

// ----- Module B: Kansas CE Submission Deadline Tracker ---------------------

/** KBEMS submission locations Hunter is responsible for. */
export type CELocation = 'kc' | 'linn' | 'topeka'

export type CEStatus = 'not_started' | 'in_progress' | 'submitted'

export interface CEClass {
  id: string
  instructor: string
  location: CELocation
  /** ISO date (yyyy-mm-dd) the class was held. */
  classDate: string
  /** Clinical discipline / topic, e.g. ACLS, PALS, BLS. */
  discipline: string
  status: CEStatus
  /** ISO date the submission was actually completed (set when status=submitted). */
  submittedDate?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// ----- Module A: QA Review Queue -------------------------------------------

export type CriterionStatus = 'met' | 'partial' | 'not_met' | 'na'

export interface RubricCriterion {
  id: string
  label: string
  category: string
  /** Weighting applied when computing the percentage score. */
  weight: number
  /** Critical elements pull down the overall review harder when missed. */
  critical?: boolean
  /** Only shown for the operations listed (e.g. KC critical-care items). */
  operations?: OperationId[]
  help?: string
}

export interface ChartReview {
  scores: Record<string, CriterionStatus>
  /** Weighted percentage 0–100 across non-N/A criteria. */
  scorePct: number
  notes: string
  reviewer: string
  reviewedAt: string
  /** Flagged for coaching follow-up. */
  flagged: boolean
}

export type ChartStatus = 'unreviewed' | 'in_progress' | 'scored'

export interface Chart {
  id: string
  /** Owning review period id: `${month}:${operation}`. */
  periodId: string
  operation: OperationId
  incidentNumber: string
  date?: string
  provider?: string
  crew?: string
  chiefComplaint?: string
  acuity?: string
  /** Original imported row, preserved for reference. */
  raw?: Record<string, string>
  /** True once pulled into the random review sample. */
  sampled: boolean
  status: ChartStatus
  review?: ChartReview
}

export interface QAPeriod {
  /** `${month}:${operation}`, e.g. '2026-07:kc'. */
  id: string
  /** Month key yyyy-mm. */
  month: string
  operation: OperationId
  /** Total calls for the operation that month. */
  monthlyVolume: number
  /** Sampling fraction, default 0.20 (20%). */
  samplePercent: number
  /** ceil(monthlyVolume * samplePercent). */
  targetCount: number
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

export interface Settings {
  samplePercent: number
  reviewer: string
  /** External link to the existing Kansas Class Builder tool (spec §6 Module B). */
  classBuilderUrl: string
  /** Local URL of the Ninth Brain Chart Review Agent, embedded in the QA Bot tab. */
  botUrl: string
}

// ----- Module D: New Hire Academy -------------------------------------------

export type Credential = 'emt' | 'aemt' | 'paramedic'

/** Progression: academy checklist -> FTO rides -> released. Derived, not stored. */
export type TraineePhase = 'academy' | 'fto' | 'released'

export interface AcademyCohort {
  id: string
  /** Display label, e.g. 'September 2026 Academy'. */
  label: string
  /** ISO start date. */
  startDate: string
  /** ISO end date (academy runs ~1.5 weeks). */
  endDate: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export type Employment = 'ft' | 'per_diem'

export interface Trainee {
  id: string
  cohortId: string
  name: string
  /** Home operation the hire is being onboarded for. */
  operation: OperationId
  credential: Credential
  /** Full-time / per diem, shown on generated documents. */
  employment?: Employment
  /** Employee / Kronos number, printed on compliance and skills forms. */
  employeeNumber?: string
  /** Contact email, captured at intake for the roster. */
  email?: string
  /** Contact phone, captured at intake for the roster. */
  phone?: string
  /** ISO hire date, printed on the objectives page. */
  hireDate?: string
  /** FTO name(s) assigned for the ride-along shifts. */
  ftos?: string
  /** moduleId -> ISO date completed. Absent key = not done. */
  checklist: Record<string, string>
  /** Transferring from another AMR operation — unlocks requirement waivers. */
  transfer?: boolean
  /** moduleId -> ISO date the requirement was waived (transfers only). */
  waived?: Record<string, string>
  /** Post-academy FTO observational-ride patient contacts logged so far. */
  contacts: number
  /** Contacts needed for release (spec: roughly 20-30; default 25). */
  contactTarget: number
  /** Set when the provider is released to solo practice. */
  releasedDate?: string
  notes?: string
  // ----- Digital Field Training Objectives checklist ------------------------
  /** Objective id (e.g. 'A2') -> recorded occurrence marks, oldest first. */
  fieldMarks?: Record<string, ObjectiveMark[]>
  /** Section id -> ISO date the trainee acknowledged the section complete. */
  sectionAck?: Record<string, string>
  /** Call-type exposure log: call type -> shift numbers where encountered. */
  exposure?: Record<string, number[]>
  /** Ride-along shift (1-6) currently in progress, set on the checklist. */
  currentShift?: number
  /** FTO initials stamped onto new checklist marks. */
  activeFto?: string
  /** ISO date the New Hire Orientation (exit) survey was submitted. */
  exitSurveyDate?: string
}

/** One filled slot on a field objective — an FTO-witnessed occurrence. */
export interface ObjectiveMark {
  /** ISO date the mark was recorded. */
  date: string
  /** Ride-along shift number (1-6) the occurrence happened on. */
  shift: number
  /** FTO initials, stamped from the checklist's active-FTO field. */
  fto?: string
}

// ----- Academy schedule builder ---------------------------------------------

export interface ScheduleBlock {
  id: string
  /** Display time range, e.g. '0900–0915'. Free text so times flex. */
  time: string
  title: string
  note?: string
}

export interface AcademyDay {
  id: string
  cohortId: string
  /** ISO date. Editable so days flex around instructor availability. */
  date: string
  /** Day theme, e.g. 'HR & Systems Onboarding'. */
  title: string
  /** Who delivers the day, free text. */
  facilitators?: string
  /** Logistics line, e.g. 'Meet HQ 7 AM -> Independence course'. */
  location?: string
  note?: string
  blocks: ScheduleBlock[]
}

// ----- Academy Phase 2 structured template ----------------------------------
// A date-agnostic curriculum template (sequence + block durations) that a class
// arranges onto real dates/times. The template itself lives in code
// (src/data/academyPhase2.ts); only the per-class arrangement is stored.

export type BlockKind = 'education' | 'hands-on' | 'assessment' | 'break' | 'lunch' | 'closeout'

/** Which credential track a block/segment applies to. */
export type SessionTrack = 'both' | 'emt' | 'paramedic'

export interface TemplateBlock {
  /** Minutes; clock times are computed from the session start + these. */
  durationMin: number
  title: string
  kind: BlockKind
  notes?: string
  track?: SessionTrack
  /** Field Guide resource refs (see src/data/fieldGuide.ts). */
  resources?: string[]
}

/** A segment of an at-home (flipped / LMS) session. */
export interface TemplateSegment {
  kind: 'lms' | 'flipped'
  title: string
  hours?: number
  notes?: string
  resources?: string[]
  system?: string
  submit?: string
  /** Session id this flipped work must be complete before it unlocks. */
  gatesSession?: string
}

export interface TemplateSession {
  id: string
  /** Global order across the whole academy (both weeks). */
  order: number
  /** 1 = Systems & Safety week, 2 = Clinical Depth week. */
  week: 1 | 2
  mode: 'in-person' | 'at-home'
  title: string
  objectives: string[]
  /** True for per-class sessions a cohort added (not part of the shared template). */
  custom?: boolean
  /** Default clock start ('HHMM') for this session before a class overrides it. */
  defaultStart?: string
  /** Where it's held — omitted = HQ; set for offsite/corporate days (e.g. EVOC road). */
  location?: string
  facilitatorRoles?: { role: string; lead?: boolean }[]
  /** In-person sessions run blocks; at-home sessions run segments. */
  blocks?: TemplateBlock[]
  segments?: TemplateSegment[]
  /** Cumulative retrieval: prior session ids this one pulls from. */
  retrieval?: { pullsFrom: string[]; resource?: string }
  placement?: string
}

export interface AcademyTemplate {
  id: string
  name: string
  /** Academy completion is an internal record only — never CE. */
  notCE: true
  minEducationHoursPerDay: number
  phase: { id: string; name: string }
  sessions: TemplateSession[]
}

/** Per-class scheduling layer applied to one template session. */
export interface SessionArrangement {
  cohortId: string
  sessionId: string
  /** ISO date this session is held. */
  date?: string
  /** Clock start, 'HHMM' (e.g. '0800'). Timeline is computed from here. */
  startTime?: string
  /** Assigned facilitator names for this class (free text). */
  facilitators?: string
  /**
   * Per-class edited blocks. When present, these replace the template's blocks
   * for this class (durations/titles/kinds tuned to how the class actually
   * runs). Absent = use the template default.
   */
  blocks?: TemplateBlock[]
  /** This class drops the session from its schedule (kept so it can be restored). */
  skipped?: boolean
}

/** A session a class adds on top of the template (per-cohort, not shared). */
export interface CustomSession extends TemplateSession {
  cohortId: string
  custom: true
}

// ----- Attendance -----------------------------------------------------------
// Tracks which trainee attended which academy day, across both phases, so
// missed days surface for catch-up training. `dayKey` identifies the day:
// `p1:<academyDayId>` for a Phase 1 schedule day, `p2:<sessionId>` for a
// Phase 2 clinical session. Only explicit marks are stored (no record = not
// yet taken).

export type AttendanceStatus = 'present' | 'absent'

export interface AttendanceRecord {
  cohortId: string
  traineeId: string
  /** `p1:<dayId>` or `p2:<sessionId>`. */
  dayKey: string
  status: AttendanceStatus
}

/** A schedulable academy day, unified across phases for attendance/printing. */
export interface AcademyDayRef {
  key: string
  phase: 1 | 2
  /** ISO date, or '' if a Phase 2 session hasn't been dated yet. */
  date: string
  title: string
  /**
   * Scheduled wall-clock hours for the day (first block start → last block
   * end, meal break included). Undefined when the day has no usable times.
   * Drives the payroll timesheet export.
   */
  hours?: number
  /**
   * Self-paced at-home (LMS) day: there is no attendance to mark, so the
   * timesheet credits its hours to every trainee. Timesheet-only — these days
   * are not columns in the attendance grid.
   */
  autoCredit?: boolean
}

// ----- Daily performance evaluations & clinical skill sheets -----------------

/**
 * One end-of-shift Daily Performance Evaluation, matching the legacy
 * Microsoft Forms fields. Historical imports carry only traineeName;
 * evals recorded in-app also link the trainee id.
 */
export interface DailyEval {
  id: string
  traineeId?: string
  traineeName: string
  /** ISO date of the shift being evaluated. */
  date: string
  /** Canonical FTO name completing the evaluation. */
  fto?: string
  /** 1–5 ratings; a category is absent when not scored that day. */
  scores: {
    professionalism?: number
    teamwork?: number
    patientCare?: number
    driving?: number
    stretcher?: number
    pcr?: number
  }
  strengths?: string
  improvements?: string
  /** Truck washed & patient compartment cleaned at end of shift. */
  truckWashed?: boolean
  /** Ambulance always backed with a spotter. */
  spotter?: boolean
  /** FTO's call: ready to work independently without an FTO. */
  readyIndependent?: boolean
  /** FTO's drawn initials (PNG data URL) — signs off the eval. */
  ftoInitials?: string
  /** ISO instant the FTO initialed — record-keeping timestamp. */
  ftoInitialsAt?: string
}

/** A clinical skill sheet sign-off (KC/Cass BLS sheet or Linn medic sheet). */
/** Which check-off sheet a SkillCheck record belongs to. */
export type SkillSheetId = 'bls' | 'linn-medic' | 'stretcher' | 'evoc-track' | 'rsi' | 'vent'

export interface SkillCheck {
  id: string
  traineeId?: string
  traineeName: string
  date: string
  sheet: SkillSheetId
  /** Canonical FTO/educator name who ran the assessment. */
  evaluator?: string
  /** skillId -> outcome. Absent = not yet assessed. */
  results: Record<string, 'pass' | 'fail'>
  /** Linn sheet: checked step indexes per skill (partial progress). */
  steps?: Record<string, number[]>
  comments?: string
  /** FTO/evaluator signature — PNG data URL, captured on the device. */
  evaluatorSignature?: string
  evaluatorSignedAt?: string
  /** New-hire signature — PNG data URL. */
  traineeSignature?: string
  traineeSignedAt?: string
}

/** A submitted exit survey, kept locally alongside the Google Sheet post. */
export interface SurveyResponse {
  id: string
  traineeId?: string
  submittedAt: string
  /** The exact payload posted to the survey sheet (39 keys). */
  data: Record<string, string>
}

/** A new hire assigned to ride a specific FTO crew shift on a date. */
export interface RideAssignment {
  id: string
  traineeId: string
  /** ISO date of the shift. */
  date: string
  /** Unit call sign of the crew line, e.g. 'KC105'. */
  unit: string
  /** Display snapshot of the FTO(s) aboard when assigned. */
  ftoNames?: string
  /** Display snapshot of the shift window, e.g. '1000–2000'. */
  window?: string
}

// ----- AEMT certification course (Kansas) -----------------------------------
// A state-approved Advanced EMT class: students, documented contact hours,
// psychomotor competency, and clinical/field internship. Distinct from the
// New Hire Academy — that is internal onboarding, this leads to a Kansas
// certification and an NREMT exam, so its records are the ones an audit asks
// for. Skill lists and clinical minimums are program data (src/data/aemt.ts),
// not hard-coded here.

/** Where a student stands in the course. */
export type AemtStudentStatus = 'active' | 'withdrawn' | 'completed'

/** Didactic lecture, hands-on lab, or a written/practical exam sitting. */
export type AemtSessionKind = 'didactic' | 'lab' | 'clinical' | 'exam'

/**
 * Hours a course commits to in its filed proposal. Per-course rather than
 * global: the same tool runs AMR KC's program and another sponsoring
 * organization's, and their approved hour structures differ.
 */
/**
 * Filed hour commitments. Every field is optional and independent: a course
 * may know its classroom numbers before its clinical affiliation is signed,
 * and reconciling the ones that exist beats reconciling nothing until all four
 * do. An absent field means "not filed", never zero.
 */
export interface AemtHourTargets {
  didactic?: number
  lab?: number
  /** Hospital clinical hours. */
  clinical?: number
  /** Field internship hours, all sites combined. */
  field?: number
}

/**
 * A clinical or field internship site named on the course approval
 * application. K.A.R. 109-11-4a requires the sites, and the executed
 * agreement has to be in place before the application is submitted.
 */
export interface AemtSite {
  id: string
  name: string
  kind: 'clinical' | 'field'
  /**
   * DERIVED, never chosen. Retained so existing records keep loading, but the
   * status shown and the approval gate both come from agreementStatus(), which
   * reads the evidence below. A dropdown someone sets to "Executed" is a claim
   * about a document, not the document.
   */
  agreement: 'none' | 'draft' | 'executed'
  contact?: string
  notes?: string
  /** Where the executed agreement actually lives — path, drive, file name. */
  agreementRef?: string
  /** ISO date both parties signed. */
  signedDate?: string
  /** Who signed for the site. */
  signedBySite?: string
  /** Who signed for the sponsoring organization. */
  signedByProgram?: string
  /** Period the agreement covers. */
  effectiveFrom?: string
  effectiveTo?: string
  /**
   * What the agreement actually permits students to do. K.A.R. 109-11-8
   * requires venipuncture and medication administration; an agreement that
   * does not cover them cannot support the minimums the course filed.
   */
  permits?: string
}

export interface AemtCourse {
  id: string
  /** Display label, e.g. 'Fall 2026 AEMT'. */
  label: string
  /** Sponsoring organization, e.g. 'AMR Kansas City'. */
  organization?: string
  /**
   * Primary instructor of record, named on the KBEMS application. Under
   * K.A.R. 109-17-1 they must be certified or licensed in what they teach;
   * no separate Instructor-Coordinator credential is required.
   */
  primaryInstructor?: string
  primaryInstructorCredential?: PreceptorCredentialId
  primaryInstructorCertNumber?: string
  /** Clinical and field sites named on the application. */
  sites?: AemtSite[]
  /** Kansas BEMS course approval number, printed on course records. */
  courseNumber?: string
  startDate: string
  endDate: string
  /** Course coordinator of record. */
  coordinator?: string
  medicalDirector?: string
  /** Filed hour commitments. Absent = not yet declared, so no reconciliation. */
  targets?: AemtHourTargets
  /**
   * Cardiac monitor this operation runs, by skill-sheet id. Students are
   * checked off on their own monitor only — AMR KC uses the LIFEPAK 15,
   * Wichita the Zoll X-Series.
   */
  monitorSheetId?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

/**
 * One student's check-off on one psychomotor skill sheet. Criteria are graded
 * individually; a critical-failure item fails the sheet outright, which is why
 * it is tracked separately rather than as just another failed criterion.
 */
export interface AemtSkillCheck {
  courseId: string
  studentId: string
  sheetId: string
  /** criterionId -> result. Absent = not yet assessed. */
  results: Record<string, 'pass' | 'fail'>
  /** Critical-failure items triggered, by their text. */
  criticalFailed?: string[]
  evaluator?: string
  /** ISO date the sheet was signed off as passed. */
  passedDate?: string
  /** Attributable signature behind passedDate. Absent = not evidence-grade. */
  attestation?: Attestation
}

/**
 * A completed evaluation form (see data/aemtForms.ts). Values are keyed by
 * field id; the form definition supplies the labels, so editing a form's
 * wording never rewrites stored responses.
 */
export interface AemtFormResponse {
  id: string
  courseId: string
  formId: string
  /** The student the form concerns — or, for course/instructor evals, the
   *  student who filled it in. */
  studentId?: string
  /** ISO date the evaluation covers. */
  date: string
  values: Record<string, string | number | boolean>
  submittedAt: string
  /** Set when a flagged concern (remediation / conference) has been closed out. */
  resolvedDate?: string
  resolvedBy?: string
  resolutionNote?: string
}

/**
 * A recorded course completion. Completion is a verified state, not a status
 * anyone can pick from a dropdown: it gates a student's eligibility to sit the
 * NREMT cognitive exam, so it carries who verified it and against what.
 */
export interface AemtCompletion {
  courseId: string
  studentId: string
  /** ISO date completion was recorded. */
  completedDate: string
  /**
   * The primary instructor verifying completion. K.A.R. 109-11-8 names that
   * role specifically — this is not "whoever recorded it".
   */
  verifiedBy: string
  /** True when verifiedBy is not the course's named primary instructor. */
  verifierMismatch?: boolean
  /**
   * Kansas verification is not NREMT verification. Since 1 July 2024 the NREMT
   * Program Director separately verifies each candidate met the state minimum
   * competencies before they sit the cognitive exam.
   */
  nremtVerifiedBy?: string
  nremtVerifiedDate?: string
  /**
   * Final course grade. Attested rather than computed — grades live in the
   * Navigate LMS, not in this app, so recording the figure is the honest
   * option and inventing a gradebook would be worse.
   */
  finalGradePercent: number
  /** Present only when recorded despite a readiness check that had not passed. */
  override?: {
    reason: string
    approver: string
    /** Ids of the checks that were unmet at the time. */
    unmetChecks: string[]
  }
}

/**
 * Tracking for a program record the app does not itself hold — the syllabus,
 * lesson plans, the gradebook. CES-held records need no entry; the tab that
 * owns them is the record.
 */
export interface AemtRecordDoc {
  courseId: string
  /** Matches a REQUIRED_RECORDS id in data/aemtRecords.ts. */
  typeId: string
  status: 'missing' | 'draft' | 'in-review' | 'approved'
  owner?: string
  version?: string
  approvedBy?: string
  approvedDate?: string
  /** Where the document actually lives — a path, a link, or a description. */
  location?: string
  notes?: string
}

/**
 * Append-only record of consequential actions. Written for completions,
 * overrides and revocations — the events an audit would ask about.
 */
export interface AemtAuditEvent {
  id: string
  courseId: string
  studentId?: string
  /** ISO timestamp. */
  at: string
  actor: string
  action: string
  detail: string
}

/** A KBEMS submission marked done for a course (see KBEMS_DEADLINES). */
/**
 * A KBEMS submission and its evidence. Kansas submissions go through the
 * Licensing Portal, so the portal confirmation is the receipt — "marked done"
 * on its own proves nothing to an auditor.
 */
export interface AemtDeadlineRecord {
  courseId: string
  deadlineId: string
  status: 'submitted' | 'accepted' | 'rejected' | 'corrected'
  /** ISO date it was submitted. */
  submittedDate: string
  submittedBy: string
  /** Portal confirmation / receipt number. */
  confirmationNumber?: string
  note?: string
}

export interface AemtStudent {
  id: string
  courseId: string
  name: string
  /** Kansas EMS certification number (the student's existing EMT cert). */
  certNumber?: string
  /** Employee number, for students who are also AMR staff. */
  employeeNumber?: string
  email?: string
  phone?: string
  status: AemtStudentStatus
}

/** One meeting of the class, carrying the hours it is worth. */
export interface AemtSession {
  id: string
  courseId: string
  /** ISO date. */
  date: string
  title: string
  kind: AemtSessionKind
  /** Scheduled contact hours. State approval is documented in these. */
  hours: number
  /**
   * Clock times, 'HH:MM'. K.A.R. 109-11-1a(b3) requires the filed schedule to
   * show the date AND time of each session, not just its length.
   */
  startTime?: string
  endTime?: string
  instructor?: string
  /** Instructor's qualification for this subject, per K.A.R. 109-17-1. */
  instructorCredential?: PreceptorCredentialId
  notes?: string
}

export interface AemtAttendanceRecord {
  courseId: string
  studentId: string
  sessionId: string
  status: AttendanceStatus
  /**
   * Hours credited when they differ from the session's scheduled hours —
   * a late arrival or a partial make-up. Absent = the session's hours.
   */
  hours?: number
}

/**
 * Where an encounter happened. Only 'field' counts toward the field-specific
 * minimums in K.A.R. 109-11-8 (assessments, supervised calls, PCRs).
 */
export type AemtSiteKind = 'hospital' | 'field' | 'lab'

/**
 * A clinical or field internship shift. Encounters hang off a shift rather
 * than standing alone, so every logged rep inherits a date, a site, and an
 * identified preceptor who attested to it — the difference between a count
 * someone typed and a record that can be defended.
 */
export interface AemtClinicalShift {
  id: string
  courseId: string
  studentId: string
  /** ISO date of the shift. */
  date: string
  setting: AemtSiteKind
  /** Site name, e.g. 'AdventHealth KC — ED'. */
  site: string
  /** Hours worked — feeds clinical and field hour reconciliation. */
  hours: number
  preceptorName: string
  preceptorCredential: PreceptorCredentialId
  /** Licence or certificate number, so the supervisor is identifiable. */
  preceptorCertNumber?: string
  /**
   * ISO timestamp the preceptor attested the shift record is accurate.
   * Encounters on an unattested shift are logged but not yet defensible.
   * Kept alongside `attestation` for records written before attribution was
   * required; a bare timestamp is treated as unattributed, not as evidence.
   */
  attestedAt?: string
  /** Who attested, with what standing. Absent = not evidence-grade. */
  attestation?: Attestation
  /**
   * Prior versions, newest last, captured whenever a material field changed
   * after attestation. The regulation expects a correction to be traceable,
   * not to overwrite what was signed.
   */
  revisions?: ShiftRevision[]
  notes?: string
}

/**
 * An attributable electronic signature. A name in a text box is not one: a
 * regulated record has to say who signed, under what credential, that they
 * were authenticated at the time, and what statement they agreed to.
 */
export interface Attestation {
  /** Display name of the signer. */
  by: string
  credential: PreceptorCredentialId
  /** Licence or certificate number — what makes the signer identifiable. */
  certNumber: string
  /** ISO timestamp of signature. */
  at: string
  /** The exact statement agreed to, stored with the record it attests. */
  statement: string
  /**
   * Authenticated account identity at the time of signing. Absent means the
   * device was not signed in, which keeps the record a draft.
   */
  actor: string
}

export interface ShiftRevision {
  /** ISO timestamp of the edit. */
  at: string
  /** Authenticated identity that made the change. */
  actor: string
  /** Why the record was corrected — required for a post-attestation edit. */
  reason: string
  /** Fields that changed, with their prior values. */
  changed: { field: string; from: string; to: string }[]
  /** The attestation that was invalidated by this edit, if any. */
  invalidated?: Attestation
}

/** Mirrors PreceptorCredential in data/aemt.ts. */
export type PreceptorCredentialId =
  | 'aemt'
  | 'paramedic'
  | 'rn'
  | 'lpn'
  | 'aprn'
  | 'pa'
  | 'physician'

/**
 * One line of the student patient encounter log. NEVER carries PHI — the
 * regulation-facing record is date, site, skill, count and preceptor only.
 */
/**
 * A candidate for a cohort seat.
 *
 * Employment-selection data, not a program record: it is retained under the
 * employer's HR schedule and is NOT covered by the three-year K.A.R. 109-17-3
 * clock. Kept in the same store so scoring is consistent and the records
 * survive, but reported separately wherever retention is displayed.
 */
export interface AemtCandidate {
  id: string
  courseId: string
  name: string
  employeeNumber?: string
  /** Gate id -> met. Absent = not yet assessed. */
  gates: Record<string, boolean>
  /** Additional-duty bonus tier. */
  bonusTier?: 'fto' | 'additional' | 'none'
  /** Raw marks by test section id. */
  testMarks?: Record<string, number>
  /** One entry per interviewer. Scored independently before conferring. */
  interviews?: AemtInterviewScore[]
  /** Trailing-12-month QA chart review percentage. */
  qaPercent?: number
  /** Trailing-12-month attendance percentage. */
  attendancePercent?: number
  decision?: 'advance' | 'hold' | 'declined'
  decidedBy?: string
  decidedAt?: string
  notes?: string
  createdAt: string
}

export interface AemtInterviewScore {
  /** Who scored. Two interviewers score independently, then confer. */
  scorer: string
  at: string
  /** Question id -> 1..5. */
  scores: Record<string, number>
  /** Question id -> what the candidate actually said, not an impression. */
  notes?: Record<string, string>
}

export interface AemtEncounter {
  id: string
  courseId: string
  studentId: string
  /** ISO date of the shift. */
  date: string
  siteKind: AemtSiteKind
  /** Free-text site, e.g. 'AdventHealth KC — ED'. */
  site?: string
  /** Which K.A.R. 109-11-8 requirement this counts toward (see data/aemt.ts). */
  requirementId: string
  /**
   * Reps this line represents. New records are always 1 — one row per
   * performance, because a row claiming "12" is one assertion standing in for
   * twelve procedures with one outcome and one reference between them.
   * Larger values exist only on records written before that rule and are
   * reported as unitemized.
   */
  count: number
  /**
   * Whether the student successfully performed it. K.A.R. 109-11-8 counts
   * successful performances; an unsuccessful attempt is still worth recording
   * — it is what remediation is built from — but it does not count toward a
   * minimum. Absent on records written before the distinction existed, which
   * is why those are reported separately rather than assumed successful.
   */
  outcome?: 'success' | 'attempt'
  /** Venipuncture only — whether the stick initiated an IV infusion. */
  initiatedInfusion?: boolean
  /** The shift this happened on. Encounters without one predate shift linking. */
  shiftId?: string
  /**
   * Non-PHI reference back to the source record — an ImageTrend incident
   * number or run number. Never a patient identifier.
   */
  sourceRef?: string
  preceptor?: string
  notes?: string
  /**
   * Voided rather than deleted. A regulated count that changes has to show
   * what changed and why; a row that vanishes shows neither.
   */
  voidedAt?: string
  voidedBy?: string
  voidReason?: string
}

export interface DBShape {
  version: number
  ceClasses: CEClass[]
  qaPeriods: QAPeriod[]
  charts: Chart[]
  academyCohorts: AcademyCohort[]
  trainees: Trainee[]
  academyDays: AcademyDay[]
  academyArrangements: SessionArrangement[]
  academyCustomSessions: CustomSession[]
  academyAttendance: AttendanceRecord[]
  rideAssignments: RideAssignment[]
  dailyEvals: DailyEval[]
  skillChecks: SkillCheck[]
  surveyResponses: SurveyResponse[]
  aemtCourses: AemtCourse[]
  aemtStudents: AemtStudent[]
  aemtSessions: AemtSession[]
  aemtAttendance: AemtAttendanceRecord[]
  aemtEncounters: AemtEncounter[]
  aemtShifts: AemtClinicalShift[]
  aemtDeadlines: AemtDeadlineRecord[]
  aemtSkillChecks: AemtSkillCheck[]
  aemtFormResponses: AemtFormResponse[]
  aemtCompletions: AemtCompletion[]
  aemtRecordDocs: AemtRecordDoc[]
  aemtAudit: AemtAuditEvent[]
  aemtCandidates: AemtCandidate[]
  settings: Settings
}
