// ---------------------------------------------------------------------------
// AMR KC AEMT program data, transcribed from the Initial Course of Instruction
// proposal (v5.1) and the Kansas regulations it cites.
//
//   K.A.R. 109-11-8    clinical experience minimums
//   K.A.R. 109-11-4a   AEMT course approval (as amended Nov 1, 2024)
//   K.A.R. 109-10-1c   adopts the Kansas AEMT Educational Standards (Oct 2014)
//
// Kept as data, not UI, so the numbers a KBEMS submission depends on live in
// one reviewable place.
// ---------------------------------------------------------------------------

// ----- K.A.R. 109-11-8 clinical experience minimums --------------------------

export interface KarMinimum {
  id: string
  label: string
  /** Total documented encounters required. */
  minimum: number
  /**
   * How many of the total must come from the FIELD internship specifically.
   * Field components are non-negotiable — they cannot be met with simulation
   * or hospital clinical encounters.
   */
  fieldMinimum?: number
  /**
   * An extra condition on a subset of the total — currently only the
   * venipuncture rule, where 10 of the 20 must initiate an IV infusion.
   */
  subRequirement?: { id: 'infusion'; label: string; minimum: number }
  /** Where the proposal plans to source these. */
  site: string
  note?: string
}

export const KAR_109_11_8: KarMinimum[] = [
  {
    id: 'venipuncture',
    label: 'Venipunctures',
    minimum: 20,
    subRequirement: { id: 'infusion', label: 'initiating an IV infusion', minimum: 10 },
    site: 'AdventHealth KC (ED / hospital units)',
    note: 'Most procedure-intensive requirement — the clinical affiliation agreement must explicitly permit it.',
  },
  {
    id: 'io',
    label: 'IO infusions',
    minimum: 5,
    site: 'Sim lab (bone injection models) or live',
    note: 'Simulation reps and live patient reps count equally toward the 5.',
  },
  {
    id: 'injection',
    label: 'IM / SubQ injections',
    minimum: 10,
    site: 'AdventHealth KC (ED / med-surg / infusion)',
  },
  {
    id: 'nebulizer',
    label: 'Nebulized breathing treatments',
    minimum: 1,
    site: 'AdventHealth KC (ED or respiratory therapy)',
  },
  {
    id: 'ecg',
    label: 'ECG application & interpretation',
    minimum: 8,
    site: 'AdventHealth clinical + field internship',
    note: 'In-class ECG lab does NOT count — must be documented encounters with real patients.',
  },
  {
    id: 'assessment',
    label: 'Complete patient assessments',
    minimum: 15,
    fieldMinimum: 10,
    site: 'AMR KC interfacility / AMR Independence 911 (10+), AdventHealth (up to 5)',
    note: 'The 10-in-field component cannot be substituted with simulation or hospital encounters.',
  },
  {
    id: 'calls',
    label: 'Supervised ambulance calls',
    minimum: 10,
    fieldMinimum: 10,
    site: 'AMR Independence 911 (primary), AMR KC interfacility (supplement)',
    note: 'Must be directly supervised by AEMT, Paramedic, physician, APRN or RN.',
  },
  {
    id: 'pcr',
    label: 'Patient care reports / charts',
    minimum: 10,
    fieldMinimum: 10,
    site: 'Field internship — both AMR sites (ImageTrend)',
  },
]

// ----- program hour targets (proposal §2) ------------------------------------

export interface HourTarget {
  id: string
  label: string
  hours: number
  note?: string
}

/**
 * The hour totals the proposal commits to. NOTE: the proposal's own §3 schedule
 * table sums to 90 didactic hours, not the ~110 claimed here — a 20-hour gap
 * that also drops the program total from ~376 to ~356. The Sessions tab
 * reconciles the schedule actually built against these targets so the gap is
 * visible before a KBEMS submission rather than after.
 */
export const KC_HOUR_TARGETS: HourTarget[] = [
  { id: 'didactic', label: 'Didactic', hours: 110, note: 'All AEMT content areas across 16 weeks.' },
  { id: 'lab', label: 'Lab / psychomotor', hours: 50, note: 'Minimum 2 instructors required on lab days.' },
  { id: 'clinical', label: 'Hospital clinical', hours: 72, note: '6 x 12-hour shifts — AdventHealth KC.' },
  { id: 'field-ift', label: 'Field — AMR KC interfacility', hours: 48, note: 'Approx. 4 x 12-hour shifts.' },
  { id: 'field-911', label: 'Field — AMR Independence 911', hours: 96, note: 'Approx. 8 x 12-hour shifts.' },
]

export const KC_TOTAL_TARGET = 376

/** Classroom time only — what the Tue/Thu sessions have to add up to. */
export const KC_CLASSROOM_TARGET = 160

// ----- course policy (proposal §5, approval doc (b2)) ------------------------

/** Missing more than this many hours of scheduled class time fails the course. */
export const MAX_ABSENT_HOURS = 8

export const MIN_PASSING_PERCENT = 80

export const GRADING = [
  { label: 'Exams (online)', weight: '60%' },
  { label: 'Quizzes / homework (online)', weight: '40%' },
  { label: 'Lab skills demonstration', weight: 'Satisfactory / Unsatisfactory' },
  { label: 'Clinical & field internship', weight: 'Satisfactory / Unsatisfactory' },
]

// ----- 16-week block plan (proposal §3) --------------------------------------

export interface AemtBlock {
  order: number
  /** Label as it appears in the proposal, e.g. 'Weeks 1-2'. */
  weeks: string
  /** How many calendar weeks the block spans. */
  spanWeeks: number
  title: string
  didacticHours: number
  labHours: number
}

/**
 * The proposal's content sequence. Hours are transcribed exactly as filed —
 * deliberately NOT adjusted to make the totals reconcile, so the discrepancy
 * stays visible instead of being silently papered over here.
 */
export const KC_BLOCK_PLAN: AemtBlock[] = [
  { order: 1, weeks: 'Weeks 1-2', spanWeeks: 2, title: 'Preparatory — EMS Systems, Research, Safety & Wellness, Documentation, Communication, Medical/Legal, Terminology', didacticHours: 16, labHours: 0 },
  { order: 2, weeks: 'Week 3', spanWeeks: 1, title: 'A&P, Pathophysiology, Lifespan Development; Patient Assessment', didacticHours: 8, labHours: 0 },
  { order: 3, weeks: 'Week 4', spanWeeks: 1, title: 'Airway Management & Monitoring Devices; Lab — assessment, airway, ECG intro', didacticHours: 2, labHours: 6 },
  { order: 4, weeks: 'Week 5', spanWeeks: 1, title: 'AHA PALS Provider Course', didacticHours: 4, labHours: 4 },
  { order: 5, weeks: 'Week 6', spanWeeks: 1, title: 'Pharmacology, Emergency Medications, Public Health, Infectious Disease; Lab — med admin, airway check-off', didacticHours: 6, labHours: 6 },
  { order: 6, weeks: 'Week 7', spanWeeks: 1, title: 'AHA ACLS Provider Course', didacticHours: 4, labHours: 4 },
  { order: 7, weeks: 'Week 8', spanWeeks: 1, title: 'Medication Administration; Shock and Resuscitation', didacticHours: 4, labHours: 0 },
  { order: 8, weeks: 'Week 9', spanWeeks: 1, title: 'Obstetrics, Neonatal Care, Pediatrics — pediatric IO, OB medication management', didacticHours: 6, labHours: 0 },
  { order: 9, weeks: 'Week 10', spanWeeks: 1, title: 'Respiratory, Cardiovascular / ECG; Lab — ECG practice, med admin check-off', didacticHours: 4, labHours: 6 },
  { order: 10, weeks: 'Weeks 11-12', spanWeeks: 2, title: 'EMS Operations; Trauma — overview, bleeding, chest, soft tissue, multisystem; Lab — scenarios', didacticHours: 14, labHours: 6 },
  { order: 11, weeks: 'Weeks 13-14', spanWeeks: 2, title: 'Trauma — head/spine, nervous system, abdominal, orthopedic, environmental; Medicine — neuro, GI, GU, endocrine, heme', didacticHours: 14, labHours: 7 },
  { order: 12, weeks: 'Weeks 15-16', spanWeeks: 2, title: 'Medicine — immunology, gynecology, toxicology, psychiatric, MSK; Geriatrics; Final exam & NREMT prep', didacticHours: 8, labHours: 11 },
]

/** What the block plan actually adds up to, as opposed to what §2 claims. */
export function blockPlanTotals(): { didactic: number; lab: number; classroom: number } {
  const didactic = KC_BLOCK_PLAN.reduce((s, b) => s + b.didacticHours, 0)
  const lab = KC_BLOCK_PLAN.reduce((s, b) => s + b.labHours, 0)
  return { didactic, lab, classroom: didactic + lab }
}

// ----- KBEMS submission deadlines (proposal §6, §8) --------------------------

export interface KbemsDeadline {
  id: string
  label: string
  /** Days relative to a course anchor; negative = before. */
  offsetDays: number
  anchor: 'first-session' | 'last-session'
  note: string
}

export const KBEMS_DEADLINES: KbemsDeadline[] = [
  {
    id: 'course-approval',
    label: 'Submit Request for Initial Course Approval',
    offsetDays: -15,
    anchor: 'first-session',
    note: 'At least 15 days before the first session, through the KBEMS Licensing Portal. Requires the full syllabus and signed clinical/field agreements.',
  },
  {
    id: 'student-registration',
    label: 'Submit student registration forms',
    offsetDays: 20,
    anchor: 'first-session',
    note: 'Within 20 days of the first class session, through the KBEMS Licensing Portal.',
  },
  {
    id: 'psychomotor-host',
    label: 'Begin NREMT psychomotor exam host approval',
    offsetDays: 35,
    anchor: 'first-session',
    note: 'No later than Week 6 — the approval process needs 8 to 12 weeks lead time.',
  },
  {
    id: 'roster',
    label: 'Submit KBEMS student roster (passed / failed / dropped)',
    offsetDays: 10,
    anchor: 'last-session',
    note: 'Within 10 days of the last class session.',
  },
]

/** Program records retention, K.A.R. 109-11-4a. */
export const RECORDS_RETENTION_YEARS = 3
