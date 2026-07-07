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
  /** ISO hire date, printed on the objectives page. */
  hireDate?: string
  /** FTO name(s) assigned for the ride-along shifts. */
  ftos?: string
  /** moduleId -> ISO date completed. Absent key = not done. */
  checklist: Record<string, string>
  /** Post-academy FTO observational-ride patient contacts logged so far. */
  contacts: number
  /** Contacts needed for release (spec: roughly 20-30; default 25). */
  contactTarget: number
  /** Set when the provider is released to solo practice. */
  releasedDate?: string
  notes?: string
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

export interface DBShape {
  version: number
  ceClasses: CEClass[]
  qaPeriods: QAPeriod[]
  charts: Chart[]
  academyCohorts: AcademyCohort[]
  trainees: Trainee[]
  academyDays: AcademyDay[]
  settings: Settings
}
