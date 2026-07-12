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

export type Credential = 'emt' | 'paramedic'

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
  settings: Settings
}
