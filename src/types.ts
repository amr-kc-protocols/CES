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
}

export interface DBShape {
  version: number
  ceClasses: CEClass[]
  qaPeriods: QAPeriod[]
  charts: Chart[]
  settings: Settings
}
