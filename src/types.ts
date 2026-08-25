// ---------------------------------------------------------------------------
// Shared domain types for the AMR Clinical Education Suite.
// ---------------------------------------------------------------------------

export type OperationId = 'kc' | 'cass' | 'linn' | 'wichita'

// ----- Module B: Kansas CE Submission Deadline Tracker ---------------------

/** KBEMS submission locations Hunter is responsible for. */
export type CELocation = 'kc' | 'linn' | 'topeka' | 'wichita'

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
  // ----- Wichita FTO orientation agenda -------------------------------------
  // Kansas City runs the A–G objectives page above instead; these stay unset
  // there. See src/data/ftoAgenda.ts for why the two are different documents.
  /**
   * Which agenda track this hire is on. Assigned by an FTO or manager, never
   * inferred — nothing in the source documents says what decides it, and a
   * guess puts someone on the wrong length of orientation.
   */
  ftoTrack?: FtoTrackAssignment
  /** Agenda item id -> the mark recording who signed it off and when. */
  agendaMarks?: Record<string, AgendaMark>
  /** Day number -> the FTO's free-text comments for that shift. */
  agendaComments?: Record<number, string>
  /** Day number -> skills/procedures reviewed, the write-in lines. */
  agendaSkills?: Record<number, string>
  /** The release-or-remediate recommendation at the foot of the agenda. */
  agendaRecommendation?: AgendaRecommendation
}

export interface FtoTrackAssignment {
  /** 'red' | 'green' — kept loose here so types.ts owns no agenda content. */
  track: string
  /** ISO date the track was assigned. */
  date: string
  /** Who assigned it. Recorded because the choice is a judgement call. */
  by?: string
}

export interface AgendaMark {
  /** ISO date the item was signed off. */
  date: string
  /** FTO initials or name, stamped from the agenda's active-FTO field. */
  fto?: string
}

export interface AgendaRecommendation {
  /** 'remediate' | 'release'. */
  id: string
  date: string
  fto?: string
  note?: string
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
  /**
   * Which version of the daily-eval template this was scored against.
   * Absent or 0 = the bundled default, which is what every record written
   * before the template became editable was scored on.
   */
  templateVersion?: number
  /**
   * 1–5 ratings by category id; a category is absent when not scored that day.
   *
   * Was a fixed set of six keys. Widened so an operation can define its own
   * categories — the original six are simply the bundled template's ids, so
   * every historical record still reads correctly with no migration.
   */
  scores: Record<string, number | undefined>
  /** Yes/no answers by id, for checks beyond the two legacy ones below. */
  checks?: Record<string, boolean | undefined>
  /** Free-text answers by id, for prompts beyond the two legacy ones below. */
  texts?: Record<string, string | undefined>
  /** Legacy text prompts. Read and written through dailyEvalText(). */
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
  /**
   * Which version of the instrument this was assessed against. Absent or 0 =
   * the definition bundled with the app, so records written before the
   * instrument became editable need no migration.
   */
  templateVersion?: number
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
  /**
   * Which version of the instrument this was assessed against. Absent or 0 =
   * the definition bundled with the app, so records written before the
   * instrument became editable need no migration.
   */
  templateVersion?: number
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
  /**
   * Which version of the instrument this was assessed against. Absent or 0 =
   * the definition bundled with the app, so records written before the
   * instrument became editable need no migration.
   */
  templateVersion?: number
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
  /** What the hospital requires of this student before a rotation. */
  clearance?: AemtClearance
}

/**
 * A student's clinical clearance, as the affiliation agreement defines it.
 *
 * Every field here is a fact the program asserts in the letter of good standing
 * it sends the facility before a rotation, so every field is a date or a
 * result — never a "done" checkbox. A tick is a claim; a date is a record, and
 * a record is what the facility can ask to see.
 *
 * Section numbers are the AdventHealth master affiliation agreement, which is
 * the strictest of the program's agreements. A facility with lighter
 * requirements is still covered by these; one with heavier requirements would
 * need its own fields.
 */
export interface AemtClearance {
  /** Physical examination (§4.4). */
  physicalDate?: string
  /** Immunisations (§4.4). Hepatitis B may be a signed declination instead. */
  varicellaDate?: string
  /** A negative titer means the student must be vaccinated before the rotation. */
  varicellaTiter?: 'positive' | 'negative'
  hepBDate?: string
  hepBDeclined?: boolean
  mmrDate?: string
  tdapDate?: string
  /** Influenza is seasonal, and the agreement allows masking instead. */
  fluDate?: string
  /** Tuberculosis screening — must be within one year of the rotation (§4.4). */
  ppdDate?: string
  ppdResult?: 'negative' | 'positive'
  /** A positive PPD needs a clear chest film and no active symptoms. */
  cxrDate?: string
  cxrClear?: boolean
  /** Criminal background check (§4.5). */
  backgroundDate?: string
  /** Every city, county and state lived or worked in for seven years. */
  backgroundSevenYear?: boolean
  /** Screened against the facility's disqualification list, not disqualified. */
  backgroundCleared?: boolean
  /** Drug screen (§4.6). */
  drugScreenDate?: string
  /** The agreement names nine specific analytes; a five-panel is not this. */
  drugScreenNinePanel?: boolean
  drugScreenNegative?: boolean
  /** Personal health insurance, in force for the rotation (§4.8). */
  insuranceCarrier?: string
  insuranceThrough?: string
  /**
   * Employed by the facility and in good standing, which exempts the student
   * from the physical, the background check and the drug screen (§4.21).
   * Immunisations and TB screening are NOT exempt.
   */
  facilityEmployee?: boolean
  notes?: string
  /** Who last checked these records against the source documents, and when. */
  verifiedBy?: string
  verifiedAt?: string
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
  /**
   * How the session reaches the student.
   *
   * 'f2f'        — instructor-led, in the room. Costs instructor and room time,
   *                and is what the eight-hour weekly cap governs.
   * 'assignment' — Navigate chapter materials, quizzes and AHA pre-course work
   *                the student completes on their own.
   *
   * Absent means face-to-face, so sessions written before this field existed
   * keep counting as class time rather than silently leaving the room.
   */
  delivery?: 'f2f' | 'assignment'
  /**
   * Written by the schedule seeder rather than by hand.
   *
   * Lets a rebuild tell its own output from a coordinator's. Sessions seeded
   * before this field existed do not carry it, so a rebuild also matches on
   * title against the filed plan — and offers to clear the remainder
   * explicitly, since a plan change renames the very titles it would match on.
   */
  seeded?: boolean
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
// ---------------------------------------------------------------------------
// Chart review — the Ninth Brain Suite questionnaire, run in CES.
//
// NOT the `ChartReview` above. That belongs to the QA sampling queue, which is
// switched off (QA_ENABLED = false) and scores charts against weighted criteria
// tied to a monthly sample. This is the Ninth Brain form: a fixed questionnaire
// whose sections appear according to the review type and the CQM categories
// ticked. The two are left separate rather than merged — one is dormant, and
// folding a live instrument into a disabled feature to save a name is how a
// rename ends up rewriting records nobody meant to touch.
//
// NO PATIENT IDENTIFIERS. A review carries the run number, the date of service
// and who was on the truck. Everything a reviewer needs to read about the
// patient stays in ImageTrend, which is the system of record and the one with
// the access controls that go with it.
// ---------------------------------------------------------------------------

export type ChartReviewStatus = 'draft' | 'complete'

export interface ChartReviewEntry {
  id: string
  /** 'newhire' and/or 'cqm', as selected at the top of the form. */
  types: string[]
  /** CQM review categories ticked. Each appends its own question block. */
  categories: string[]
  /** Free text when 'Other' is among the categories. */
  categoryOther?: string
  /** PCR / incident number in ImageTrend. The join back to the chart. */
  incidentNumber: string
  /** Date of service — what a monthly or quarterly tally groups on. */
  serviceDate?: string
  /** Crew whose care is under review. Drives the per-employee tally. */
  crew: string[]
  reviewer: string
  /** ISO date the review was completed. */
  reviewedAt: string
  /**
   * Answers keyed by question id from data/chartReview.ts. Yes/No questions
   * store booleans; selects store their option string; multi-selects an array.
   */
  answers: Record<string, boolean | string | string[]>
  /**
   * Why a question was answered the way it was, keyed by question id.
   *
   * Only meaningful on non-compliant answers, and only those are prompted for.
   * "Procedures not documented" tells a crew nothing; "two IV attempts appear
   * in the narrative only, with no Procedures entry" is something they can fix
   * on the next chart.
   */
  questionNotes?: Record<string, string>
  notes?: string
  status: ChartReviewStatus
  /**
   * Where the answers came from. Absent means a person filled the form in.
   *
   * 'import' means the app read them off a PCR export. It is recorded because
   * an auto-answered review and a hand-answered one carry different weight in
   * an audit, and because a mapping that turns out to be wrong needs to be
   * findable after the fact.
   */
  source?: 'import'
  /**
   * Per-question provenance for an imported review: how sure the app was and
   * what it read. Keyed by question id, same as `answers`.
   *
   * Kept so nothing is a black box — a reviewer can see that "no phone number"
   * came off the Patient's Phone Number field rather than being assumed.
   */
  answerSources?: Record<string, { confidence: string; because: string }>
  /**
   * What the import wants a human to look at. Empty on a chart that read clean.
   */
  flags?: { severity: string; title: string; detail: string; questionId?: string }[]
  updatedAt: string
}

/**
 * A chart's narrative, held on this device only.
 *
 * A reviewer cannot judge whether the exam supports the reason for transport
 * without reading what the crew wrote, so the narrative has to be on screen
 * during a review. It is also free text about a patient — the one thing in an
 * export that is certain to carry names, addresses and history.
 *
 * So it is kept OUT of ChartReviewEntry deliberately. Review entries sync to
 * the server and go into the exported workbook; narratives do neither. They
 * live in this slice, which is absent from the sync SLICES list, so they stay
 * in this browser's storage on the machine that read the PDF and nowhere else.
 * Clearing them is a button away, and deleting a review deletes its narrative.
 */
export interface ChartNarrative {
  /** The review this belongs to. Deleting the review deletes this. */
  reviewId: string
  /** Only so a reviewer can tell which chart they are reading. */
  incidentNumber: string
  text: string
  savedAt: string
}

export interface AemtCandidate {
  id: string
  courseId: string
  name: string
  employeeNumber?: string
  /**
   * The email the candidate sat the selection exam under. This is the only
   * link between a candidate record and their attempt — exam_attempts is
   * keyed on email, and it is a public no-login form, so nothing else joins
   * them. Stored lowercased to match how the exam normalises it.
   */
  email?: string
  /** Gate id -> met. Absent = not yet assessed. */
  gates: Record<string, boolean>
  /** Additional-duty bonus tier. */
  bonusTier?: 'fto' | 'additional' | 'none'
  /**
   * Selection exam result, pulled from exam_attempts by email. This is the
   * 40% test component; `testMarks` below only supplements it.
   */
  examPercent?: number
  /** ISO date the exam result was pulled, so a stale figure is visible. */
  examPulledAt?: string
  /**
   * Raw marks by test section id, for supplementary sections run on paper.
   * Optional — see the header of data/aemtSelection.ts.
   */
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

// ---------------------------------------------------------------------------
// CQMP — the monthly KPI review deck.
//
// One report per month per market. The numbers come off the GMR Clinical
// Analytics dashboards by hand: the KPI is read from the chart, the chart is
// screenshotted, and the pair is what leadership is shown. Both halves are
// captured here so the deck can be rebuilt months later without going back to
// a dashboard whose rolling window has since moved on.
//
// Which operations and measures a report covers comes from data/cqmp.ts, not
// from here — see that file for why the two operation lists are separate.
// ---------------------------------------------------------------------------

/**
 * A dashboard screenshot attached to a measure.
 *
 * The image itself is NOT in this record. Screenshots run to hundreds of
 * kilobytes each even after downscaling, and this record syncs — a year of
 * decks would be tens of megabytes of base64 in localStorage and in the
 * `records` table, which is a mirror of the whole database on every device.
 * The bytes live in IndexedDB (modules/cqmp/images.ts) under `key`, on the
 * device that captured them; everything else about the month syncs normally.
 *
 * The visible consequence: open last month's report on a second device and
 * the numbers, notes and targets are all there, but the screenshots are not.
 * The generated deck says so rather than silently dropping a chart.
 */
export interface CqmpImageRef {
  /** Key into the IndexedDB image store. */
  key: string
  /** Original file name, so a missing image can still be identified. */
  name: string
  /** Pixel size after downscaling — the deck needs it to place the image. */
  width: number
  height: number
  /** Bytes stored, for the storage read-out on the report screen. */
  size: number
  addedAt: string
}

/** One measure, for one operation, in one month. */
export interface CqmpMetric {
  /** Operation id from data/cqmp.ts. */
  opId: string
  /** Measure id from data/cqmp.ts. */
  kpiId: string
  /**
   * The headline percentage, 0–100. Null until it is entered — a measure with
   * no result is reported as "not reported" rather than as a zero, because a
   * dashboard that returned no qualifying patients and a month nobody pulled
   * are very different things to put in front of leadership.
   */
  value: number | null
  /** Optional case counts. When both are present, `value` is derived from them. */
  numerator?: number | null
  denominator?: number | null
  /**
   * Target for this measure, this month. Carried forward from the previous
   * report when a new month is opened. Null means no target is asserted, and
   * the deck then shows the result without a met/not-met call — the strategic
   * plan's numbers are not hard-coded here, because a wrong target on a
   * leadership slide is worse than no target at all.
   */
  target: number | null
  /** Why the number is what it is. Printed on the slide under the result. */
  notes?: string
  images: CqmpImageRef[]
}

export interface CqmpReport {
  id: string
  /** The month being reported, 'YYYY-MM'. One report per month per market. */
  month: string
  /** Who is presenting. Printed on the title slide. */
  presenter?: string
  /** Month-level narrative — printed on the closing slide of the deck. */
  summary?: string
  metrics: CqmpMetric[]
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Quarterly simulation runs.
//
// One record per scenario run at the sim lab. The gradeable content is the
// scenario's own "Expected Actions" — the Word documents these scenarios come
// from carry no scoring rubric, and inventing one would be assessing crews
// against something no medical director approved.
//
// So a run records what the facilitator observed: which expected actions the
// crew performed, in which state, and how long the patient spent in each. No
// score, no pass/fail. What a debrief needs is the list of what was and was not
// done, and that is exactly what this holds.
// ---------------------------------------------------------------------------

export interface SimRunState {
  /** State id within the scenario, e.g. 'worsening'. */
  id: string
  /** Label as it read at run time, so a reworded scenario still renders. */
  label: string
  /**
   * The AHA checklist section this phase is graded under — "VF Management",
   * not the scenario's own name for the rhythm. Megacodes only, and absent on
   * runs recorded before the printed sheet existed, which fall back to `label`.
   */
  section?: string
  /** Seconds the patient spent in this state. */
  seconds: number
  /** The state's expected actions, and whether the crew was seen to do each. */
  actions: { text: string; done: boolean }[]
}

/**
 * The run-level half of an AHA Megacode Testing Checklist.
 *
 * Present only on ACLS megacode runs. Team behaviour and CPR quality are
 * assessed once for the whole code rather than in any one rhythm, and the
 * instructor circles PASS or needs-remediation at the end. The quarterly
 * scenarios have none of this — their approved documents define no outcome,
 * which is why these fields are optional rather than part of every run.
 */
export interface SimRunChecklist {
  /** Key into the control panel's ACLS_CHECKLISTS, e.g. 'brady_vf_asys'. */
  checklist: string
  /** Which published checklist, as it read at run time. */
  checklistName: string
  team: { text: string; done: boolean }[]
  cpr: {
    rate: boolean
    depth: boolean
    recoil: boolean
    /** Written in by the instructor, so kept as typed rather than coerced. */
    fraction: string
    ventRate: string
  }
  /** null when the instructor ended the run without circling one. */
  result: 'pass' | 'nr' | null
  /**
   * The instructor of record, as the printed sheet is signed. Initials and the
   * AHA instructor number are what a training centre files with a card
   * renewal; both are typed on the sheet in the control panel and carried
   * forward between runs on that machine.
   */
  instructorInitials?: string
  instructorNumber?: string
}

/**
 * One press at the defibrillator, as the monitor reported it.
 *
 * The crew works the LIFEPAK skin themselves; every control posts what it did
 * to the control panel, which timestamps it against the run. This is the only
 * part of a run nobody had to remember to write down, and it is what the
 * timing questions on the checklist — time to first shock, whether
 * compressions came straight back after one — are answered from.
 */
export interface SimRunDeviceEvent {
  /** Seconds from the start of the run. */
  at: number
  /** Machine key: 'shock', 'charge', 'analyze', 'cpr', 'pacer', 'autotick'… */
  type: string
  /** What the device called it — 'SHOCK', 'ALARMS SILENCED', 'SHOCK ADVISED'. */
  label: string
  /** The specifics: '200J synchronized · shock #2', '80 ppm', 'III'. */
  detail: string
}

export interface SimRun extends Partial<SimRunChecklist> {
  /** Present once a run has been driven from the monitor; absent otherwise. */
  device?: SimRunDeviceEvent[]
  id: string
  /** Scenario key in the control panel's SIMULATIONS, e.g. 'drowning'. */
  scenario: string
  /**
   * Scenario name and subtitle as they read at run time. Denormalised on
   * purpose: the scenarios live in a static file that gets revised between
   * quarters, and a record has to keep meaning after that.
   */
  scenarioName: string
  startedAt: string
  endedAt: string
  /** Free text — the crew being assessed. Roles vary by scenario. */
  crew: string
  /** Stamped from Settings.reviewer when the run is saved. */
  facilitator: string
  states: SimRunState[]
  /** Anything the facilitator wants carried into the debrief. */
  notes?: string
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
  chartReviews: ChartReviewEntry[]
  /** Device-local, never synced. See ChartNarrative. */
  chartNarratives: ChartNarrative[]
  templates: TemplateVersion[]
  cqmpReports: CqmpReport[]
  simRuns: SimRun[]
  settings: Settings
}

// ---------------------------------------------------------------------------
// Editable instruments.
//
// Skill sheets and evaluation forms ship as code in src/data, which made every
// wording change a deploy. They are now editable in-app — but an instrument
// that competency records point at cannot simply be mutated. A criterion
// renamed after somebody was graded against it silently changes what their
// assessment says they did, and for the AEMT sheets that assessment is a
// K.A.R. 109-11-8(a)(2) record retained for three years.
//
// So an edit publishes a NEW VERSION. Records pin the version they were graded
// under and always render against it. Version 0 means "the definition bundled
// with the app, unmodified" — a record from before any edit needs no migration
// and no stored copy, it simply resolves to the default.
// ---------------------------------------------------------------------------

/** Which registry an editable instrument belongs to. */
export type TemplateKind =
  /** AEMT psychomotor skill sheets (data/aemtSkills.ts). */
  | 'aemt-skill'
  /** AEMT evaluation forms, incl. the preceptor daily eval (data/aemtForms.ts). */
  | 'aemt-form'
  /** NEOP academy clinical/check-off sheets (data/skillSheets.ts). */
  | 'neop-skill'
  /** The NEOP FTO end-of-shift daily performance evaluation. */
  | 'neop-daily-eval'

export type TemplateStatus = 'draft' | 'published' | 'archived'

/**
 * One published (or in-progress) revision of an instrument.
 *
 * `body` holds the whole definition — AemtSkillSheet, AemtFormDef, NeopSkillSheet
 * or DailyEvalTemplate depending on `kind`. Storing it whole rather than as a
 * diff is what makes a historical record renderable years later without
 * reconstructing anything.
 */
export interface TemplateVersion {
  id: string
  kind: TemplateKind
  /** Stable instrument id, e.g. 'iv-start' or 'clinical-daily'. */
  templateId: string
  /** 1-based. Version 0 is reserved for the bundled default. */
  version: number
  status: TemplateStatus
  /** The definition itself, shaped by `kind`. */
  body: unknown
  /** What changed and why — shown in the version history and the audit package. */
  note?: string
  createdAt: string
  createdBy: string
  publishedAt?: string
  publishedBy?: string
  /** Authored in-app rather than shipped with a bundled default behind it. */
  custom?: boolean
}

/** Rating categories and prompts on the NEOP daily performance evaluation. */
export interface DailyEvalTemplate {
  id: string
  title: string
  /** 1–5 rating rows. Ids are the keys under DailyEval.scores. */
  categories: { id: string; label: string }[]
  /** Yes/no confirmations, e.g. truck washed, spotter used. */
  checks: { id: string; label: string }[]
  /** Free-text prompts, e.g. strengths / areas to improve. */
  texts: { id: string; label: string }[]
  /** The FTO's readiness call. Kept separate — it is not just another check. */
  readinessLabel: string
}
