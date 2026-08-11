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

// ----- rule set provenance ---------------------------------------------------

/**
 * Which version of which rule the app is applying. A completion record is only
 * defensible if it says what the rules were when it was computed — regulations
 * are amended, and a packet exported today may be read in three years under a
 * different text.
 */
export interface RuleSet {
  id: string
  citation: string
  /** ISO date the version in force took effect. */
  effectiveDate: string
  /** What this app implements from it, in one line. */
  scope: string
  /** How the text was checked, so the claim is auditable. */
  verifiedAgainst: string
}

export const RULE_SETS: RuleSet[] = [
  {
    id: 'kar-109-11-8',
    citation: 'K.A.R. 109-11-8(a)(4)',
    effectiveDate: '2026-03-06',
    scope: 'Seven AEMT clinical minimum categories (A)-(G), with the nested IV-infusion and field-assessment sub-minimums.',
    verifiedAgainst:
      'Kansas Secretary of State regulation text, current version effective 6 March 2026, compared against the 24 November 2023 and 31 December 2021 predecessors.',
  },
  {
    id: 'kar-109-11-8-a2',
    citation: 'K.A.R. 109-11-8(a)(2)',
    effectiveDate: '2026-03-06',
    scope: 'Practical skills completed to the satisfaction of the primary instructor.',
    verifiedAgainst: 'Same text.',
  },
  {
    id: 'kar-109-11-8-verify',
    citation: 'K.A.R. 109-11-8',
    effectiveDate: '2026-03-06',
    scope:
      'Written verification by the primary instructor within 15 days of the final class session and before the certification examination.',
    verifiedAgainst: 'Same text.',
  },
  {
    id: 'kar-109-11-4a',
    citation: 'K.A.R. 109-11-4a',
    effectiveDate: '2024-11-01',
    scope: 'Course approval application contents, and the schedule fields every session must show.',
    verifiedAgainst: 'As amended 1 November 2024.',
  },
  {
    // Recorded because the ABSENCE of a rule is as load-bearing as a rule, and
    // is the thing everyone re-derives wrongly. Kansas approves an AEMT course
    // on whether its schedule plausibly covers the incorporated standards and
    // whether students can reach the 109-11-8 endpoints — not on a clock-hour
    // count. Every hour figure in this file is therefore a PROGRAM DESIGN
    // TARGET. None of them is a statutory minimum, and no total makes a course
    // compliant on its own.
    id: 'kar-no-hour-minimum',
    citation: 'K.A.R. 109-11-4a, 109-10-1c, 109-17-3 (read together)',
    effectiveDate: '2026-08-10',
    scope:
      'Kansas prescribes NO minimum clock, classroom, clinical or course-week total for an initial AEMT course. 109-11-4a requires an approved sponsor, a detailed schedule and identified laboratory hours; 109-10-1c incorporates the October 2014 Kansas AEMT Education Standards, which specify content and competencies but no hour minimum; 109-17-3 adds syllabus, clinical, documentation and outcome requirements, again with no minimum.',
    verifiedAgainst:
      'Checked 10 August 2026. Revisions to 109-10-1c were in process at that date and are NOT the controlling standard; re-check before relying on this.',
  },
  {
    id: 'kar-109-17-3',
    citation: 'K.A.R. 109-17-3',
    effectiveDate: '2024-11-01',
    scope: 'Program records and their three-year retention.',
    verifiedAgainst: 'As amended 1 November 2024.',
  },
  {
    id: 'nremt-pathway',
    citation: 'NREMT AEMT certification pathway',
    effectiveDate: '2024-07-01',
    scope:
      'Program Director verification replaced the ALS psychomotor examination, retired 30 June 2024. CES tracks the Kansas requirements only; the NREMT/CoAEMSP Student Minimum Competency matrix is NOT yet implemented.',
    verifiedAgainst: 'NREMT examination transition notice.',
  },
]

// ----- K.A.R. 109-11-8 clinical experience minimums --------------------------

/**
 * Where a rep may be performed. A requirement lists the settings that count
 * toward it; anything else is logged but excluded from the total.
 */
export type EncounterSetting = 'hospital' | 'field' | 'lab'

/**
 * Credentials a preceptor may hold. Which are acceptable depends on the
 * setting and the requirement: K.A.R. 109-1-1 defines a clinical preceptor as
 * a physician, PA, APRN, LPN or RN, a field internship preceptor as AEMT or
 * Paramedic, and K.A.R. 109-11-8 names who may directly supervise the ten
 * ambulance calls.
 */
export type PreceptorCredential =
  | 'aemt'
  | 'paramedic'
  | 'rn'
  | 'lpn'
  | 'aprn'
  | 'pa'
  | 'physician'

export const PRECEPTOR_LABELS: Record<PreceptorCredential, string> = {
  aemt: 'AEMT',
  paramedic: 'Paramedic',
  rn: 'RN',
  lpn: 'LPN',
  aprn: 'APRN',
  pa: 'Physician Assistant',
  physician: 'Physician',
}

/** Who may precept in each setting. */
export const SETTING_PRECEPTORS: Record<EncounterSetting, PreceptorCredential[]> = {
  // K.A.R. 109-1-1 clinical preceptor.
  hospital: ['physician', 'pa', 'aprn', 'lpn', 'rn'],
  // K.A.R. 109-1-1 field internship preceptor.
  field: ['aemt', 'paramedic'],
  // Skills lab is instructor-led, not precepted; any of the above may sign.
  lab: ['aemt', 'paramedic', 'physician', 'pa', 'aprn', 'lpn', 'rn'],
}

export interface KarMinimum {
  id: string
  label: string
  /** Total documented encounters required. */
  minimum: number
  /**
   * Settings that count toward `minimum`. Simulation counts for IO, where it
   * is the accepted method; it does not count for ECG, which the regulation
   * requires be documented on real patients during clinical or field training.
   */
  allowedSettings: EncounterSetting[]
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
  /**
   * Credentials that may supervise this requirement, where the regulation
   * names them specifically. Absent = the setting's own preceptor rule applies.
   */
  eligibleSupervisors?: PreceptorCredential[]
  /** Where the proposal plans to source these. */
  site: string
  note?: string
  /**
   * Where the number comes from.
   *
   * 'kar'     — one of the seven categories in K.A.R. 109-11-8(a)(4)(A)-(G).
   *             A statutory minimum; completion is gated on it.
   * 'program' — a competency the program tracks itself. Subsection (a)(2)
   *             requires practical skills be completed to the primary
   *             instructor's satisfaction, and a syllabus or Kansas portfolio
   *             may add its own. Tracked and reported, but never counted as a
   *             statutory minimum.
   */
  basis: 'kar' | 'program'
}

/**
 * Everything tracked as a counted clinical requirement, statutory or not.
 * Split by `basis` — read KAR_109_11_8 for the regulated seven.
 */
export const CLINICAL_REQUIREMENTS: KarMinimum[] = [
  {
    id: 'venipuncture',
    basis: 'kar',
    label: 'Venipunctures',
    minimum: 20,
    allowedSettings: ['hospital', 'field'],
    subRequirement: { id: 'infusion', label: 'initiating an IV infusion', minimum: 10 },
    site: 'AdventHealth KC (ED / hospital units)',
    note: 'Most procedure-intensive requirement — the clinical affiliation agreement must explicitly permit it.',
  },
  {
    id: 'io',
    basis: 'kar',
    label: 'IO infusions',
    minimum: 5,
    allowedSettings: ['hospital', 'field', 'lab'],
    site: 'Sim lab (bone injection models) or live',
    note: 'Simulation reps and live patient reps count equally toward the 5.',
  },
  {
    id: 'injection',
    basis: 'kar',
    label: 'IM / SubQ injections',
    minimum: 10,
    allowedSettings: ['hospital', 'field'],
    site: 'AdventHealth KC (ED / med-surg / infusion)',
  },
  {
    // NOT a statutory AEMT minimum. Nebulized treatment appears under the EMT
    // requirement at K.A.R. 109-11-8(a)(3)(B), not in the AEMT list at
    // (a)(4) — verified against the 2021, 2023 and current (6 Mar 2026)
    // regulation text, in all three of which it is absent from (a)(4).
    // Kept as a program competency under (a)(2), which requires practical
    // skills be completed to the primary instructor's satisfaction.
    id: 'nebulizer',
    basis: 'program',
    label: 'Nebulized breathing treatments',
    minimum: 1,
    allowedSettings: ['hospital', 'field'],
    site: 'AdventHealth KC (ED or respiratory therapy)',
    note: 'Program competency, not a K.A.R. 109-11-8(a)(4) minimum. Does not gate completion.',
  },
  {
    id: 'ecg',
    basis: 'kar',
    label: 'ECG application & interpretation',
    minimum: 8,
    allowedSettings: ['hospital', 'field'],
    site: 'AdventHealth clinical + field internship',
    note: 'In-class ECG lab does NOT count — must be documented encounters with real patients.',
  },
  {
    id: 'assessment',
    basis: 'kar',
    label: 'Complete patient assessments',
    minimum: 15,
    allowedSettings: ['hospital', 'field'],
    fieldMinimum: 10,
    site: 'AMR Independence / AMR Linn County (10+), AdventHealth (up to 5)',
    note: 'The 10-in-field component cannot be substituted with simulation or hospital encounters.',
  },
  {
    id: 'calls',
    basis: 'kar',
    label: 'Supervised ambulance calls',
    minimum: 10,
    allowedSettings: ['field'],
    fieldMinimum: 10,
    // Named explicitly by K.A.R. 109-11-8 — note LPN and PA are NOT on this
    // list even though an LPN may precept a hospital clinical shift.
    eligibleSupervisors: ['aemt', 'paramedic', 'physician', 'aprn', 'rn'],
    site: 'AMR Independence (urban 911), AMR Linn County (rural)',
    note: 'Must be directly supervised by an AEMT, Paramedic, physician, APRN or RN.',
  },
  {
    id: 'pcr',
    basis: 'kar',
    label: 'Patient care reports / charts',
    minimum: 10,
    allowedSettings: ['field'],
    fieldMinimum: 10,
    site: 'Field internship — both AMR sites (ImageTrend)',
  },
]

/**
 * The seven AEMT minimums in K.A.R. 109-11-8(a)(4)(A)-(G), current as of the
 * 6 March 2026 amendment. These gate course completion.
 */
export const KAR_109_11_8: KarMinimum[] = CLINICAL_REQUIREMENTS.filter(
  (r) => r.basis === 'kar',
)

/**
 * Counted competencies the program tracks that the regulation does not set a
 * number for. Reported separately so a course record never implies Kansas
 * requires something it does not.
 */
export const PROGRAM_COMPETENCIES: KarMinimum[] = CLINICAL_REQUIREMENTS.filter(
  (r) => r.basis === 'program',
)

// ----- the course text -------------------------------------------------------

/**
 * The adopted course text, and the publisher's own delivery timings.
 *
 * Transcribed from the Instructor Resource Guide. `lectureMinutes` is the time
 * the guide states for delivering that chapter's slides — hard data, not an
 * estimate of ours. `skillDrills` is how many Skill Drills the chapter carries,
 * which is the closest thing the guide gives to a psychomotor workload.
 *
 * THE SCHEDULE IS NO LONGER BUILT FROM THIS. Hours come from the Wichita course
 * approval, which Kansas City runs as its template; see KC_SCHEDULE below. The
 * guide's timings are kept as a cross-check that check-course-plan.mjs reports,
 * so the distance between what the publisher allots and what the filing allots
 * stays visible instead of being rediscovered later.
 *
 * ISBN NOTE: the Wichita filing cites 978-1-284-22640-9 and a 2019 date beside
 * a 4th-edition title, which cannot both be right — the 4th edition is 2023.
 * Kansas City uses the 4th edition, 2023, and the ISBN below is the one on the
 * Instructor Resource Guide actually in hand. Worth confirming against what the
 * bookstore ships before the application goes in.
 */
export const COURSE_TEXT = {
  title: 'Advanced Emergency Care and Transportation of the Sick and Injured',
  edition: '4th',
  copyright: 2023,
  publisher: 'AAOS / Jones & Bartlett Learning',
  isbn: '9781284244175',
  /** As the Wichita filing cites it; retained because the two disagree. */
  filedIsbn: '9781284226409',
  source: 'Instructor Resource Guide, lecture timings table',
}

/**
 * Course staff and sites of record for the Kansas City filing.
 *
 * Wichita's equivalents (Cassandra Powell; Butler County EMS and Sedgwick
 * County EMS; Ascension Via Christi St Francis) are replaced wholesale — these
 * are the only parts of the template that do not carry over.
 */
export const KC_COURSE_STAFF = {
  primaryInstructor: 'Jordan Jones',
  credential: 'Paramedic',
  email: 'jordan.jones@gmr.net',
  officeHours:
    'Available by text anytime; allow a maximum of 12 hours for a reply, though most are much sooner. Teams meetings arranged as needed. Available Monday-Friday 0800-1600.',
}

export const KC_SITES: { name: string; kind: 'clinical' | 'field'; note: string }[] = [
  {
    name: 'AdventHealth, Kansas City area',
    kind: 'clinical',
    note: 'Six 12-hour shifts (72 h) of supervised patient skills.',
  },
  {
    name: 'AMR Independence',
    kind: 'field',
    note: 'Urban 911 response. Part of the 144 h field internship.',
  },
  {
    name: 'AMR Linn County',
    kind: 'field',
    note: 'Rural response. Part of the 144 h field internship — the rural/urban split Wichita met with Butler and Sedgwick counties.',
  },
]

export interface TextbookChapter {
  n: number
  title: string
  /** Publisher's stated slide-delivery time. */
  lectureMinutes: number
  skillDrills?: number
  /**
   * EMT-level content an incoming AEMT student already holds, so the course
   * does not re-teach it and it earns no didactic hours. Same judgement the
   * skill sheets make in data/aemtSkills.ts, where the equivalent sheets are
   * scoped 'bls'.
   */
  carryForward?: boolean
}

export const TEXTBOOK_CHAPTERS: TextbookChapter[] = [
  { n: 1, title: "EMS Systems", lectureMinutes: 60 },
  { n: 2, title: "Workforce Safety and Wellness", lectureMinutes: 60, skillDrills: 3 },
  { n: 3, title: "Medical, Legal, and Ethical Issues", lectureMinutes: 50 },
  { n: 4, title: "Communications and Documentation", lectureMinutes: 80 },
  { n: 5, title: "Medical Terminology", lectureMinutes: 25 },
  { n: 6, title: "Lifting and Moving Patients", lectureMinutes: 60, skillDrills: 16, carryForward: true },
  { n: 7, title: "The Human Body", lectureMinutes: 145 },
  { n: 8, title: "Pathophysiology", lectureMinutes: 65 },
  { n: 9, title: "Life Span Development", lectureMinutes: 40 },
  { n: 10, title: "Patient Assessment", lectureMinutes: 100, skillDrills: 5 },
  { n: 11, title: "Airway Management", lectureMinutes: 135, skillDrills: 14 },
  { n: 12, title: "Principles of Pharmacology", lectureMinutes: 70 },
  { n: 13, title: "Vascular Access and Medication Administration", lectureMinutes: 125, skillDrills: 13 },
  { n: 14, title: "Shock", lectureMinutes: 50 },
  { n: 15, title: "BLS Resuscitation", lectureMinutes: 60, skillDrills: 6 },
  { n: 16, title: "Medical Overview", lectureMinutes: 50 },
  { n: 17, title: "Respiratory Emergencies", lectureMinutes: 105 },
  { n: 18, title: "Cardiovascular Emergencies", lectureMinutes: 80, skillDrills: 3 },
  { n: 19, title: "Neurologic Emergencies", lectureMinutes: 55 },
  { n: 20, title: "Gastrointestinal and Urologic Emergencies", lectureMinutes: 85 },
  { n: 21, title: "Endocrine and Hematologic Emergencies", lectureMinutes: 65 },
  { n: 22, title: "Immunologic Emergencies", lectureMinutes: 30, skillDrills: 1 },
  { n: 23, title: "Toxicology", lectureMinutes: 75 },
  { n: 24, title: "Psychiatric Emergencies", lectureMinutes: 35 },
  { n: 25, title: "Gynecologic Emergencies", lectureMinutes: 50 },
  { n: 26, title: "Trauma Overview", lectureMinutes: 40 },
  { n: 27, title: "Bleeding", lectureMinutes: 30, skillDrills: 4 },
  { n: 28, title: "Soft-Tissue Injuries", lectureMinutes: 70, skillDrills: 2 },
  { n: 29, title: "Face and Neck Injuries", lectureMinutes: 70, skillDrills: 3 },
  { n: 30, title: "Head and Spine Injuries", lectureMinutes: 70, skillDrills: 7 },
  { n: 31, title: "Chest Injuries", lectureMinutes: 95 },
  { n: 32, title: "Abdominal and Genitourinary Injuries", lectureMinutes: 35 },
  { n: 33, title: "Orthopaedic Injuries", lectureMinutes: 125, skillDrills: 7 },
  { n: 34, title: "Environmental Emergencies", lectureMinutes: 125, skillDrills: 2 },
  { n: 35, title: "Obstetrics and Neonatal Care", lectureMinutes: 125, skillDrills: 1 },
  { n: 36, title: "Pediatric Emergencies", lectureMinutes: 225, skillDrills: 7 },
  { n: 37, title: "Geriatric Emergencies", lectureMinutes: 130 },
  { n: 38, title: "Patients With Special Challenges", lectureMinutes: 55, skillDrills: 1 },
  { n: 39, title: "Transport Operations", lectureMinutes: 40 },
  { n: 40, title: "Vehicle Extrication, Special Rescue, and Hazardous Materials", lectureMinutes: 60 },
  { n: 41, title: "Incident Management", lectureMinutes: 35 },
  { n: 42, title: "Terrorism Response and Disaster Management", lectureMinutes: 55 },
]

/**
 * Classroom minutes each chapter costs beyond its slides, itemised.
 *
 * Slides are the spine of a session, not the whole of it. This used to be a
 * blanket 2.0x multiplier on lecture time, which was wrong in a specific way:
 * every non-lecture asset the instructor guide ships is ONE PER CHAPTER — one
 * progressive case study, one Assessment in Action, one quiz — regardless of
 * how long the chapter is. Scaling them by lecture length gave chapter 36 (225
 * min) four and a half hours of case-study time and chapter 5 (25 min) twenty
 * minutes, when both ship exactly one case study.
 *
 * So they are counted per chapter, and each is named separately so it can be
 * argued with on its own terms rather than as one lump.
 *
 * Deliberately EXCLUDED: Practice Activities. The guide describes them as
 * pre-selected quizzes the student works through on their own — "these quizzes
 * provide students with an opportunity to practice what they've learned" — not
 * something delivered in class. Counting them would be padding.
 */
export const CHAPTER_CLASSROOM_COMPONENTS: { minutes: number; label: string }[] = [
  {
    minutes: 15,
    label:
      'You are the Provider progressive case study, run as the in-class challenge the guide offers',
  },
  {
    minutes: 10,
    label: 'Assessment in Action, worked from the guide’s classroom discussion points',
  },
  { minutes: 15, label: 'Chapter quiz administered and reviewed in class' },
]

/** Non-lecture classroom minutes per chapter taught. */
export const PER_CHAPTER_CLASSROOM_MINUTES = CHAPTER_CLASSROOM_COMPONENTS.reduce(
  (n, c) => n + c.minutes,
  0,
)

const CHAPTER_BY_N = new Map(TEXTBOOK_CHAPTERS.map((c) => [c.n, c]))

export function chapter(n: number): TextbookChapter | undefined {
  return CHAPTER_BY_N.get(n)
}

/** Lecture minutes for a set of chapters, ignoring carry-forward content. */
export function lectureMinutesFor(chapters: number[]): number {
  return chapters.reduce((n, c) => {
    const ch = CHAPTER_BY_N.get(c)
    return n + (ch && !ch.carryForward ? ch.lectureMinutes : 0)
  }, 0)
}

export function skillDrillsFor(chapters: number[]): number {
  return chapters.reduce((n, c) => n + (CHAPTER_BY_N.get(c)?.skillDrills ?? 0), 0)
}

/**
 * Chapters actually taught out of a list — carry-forward content earns neither
 * lecture time nor the per-chapter classroom allowance, because it is not
 * delivered.
 */
export function taughtChaptersIn(chapters: number[]): TextbookChapter[] {
  return chapters
    .map((c) => CHAPTER_BY_N.get(c))
    .filter((c): c is TextbookChapter => !!c && !c.carryForward)
}

// ----- the course schedule (Wichita template, adapted for Kansas City) -------

/**
 * THE WICHITA FILING IS THE MEASURE, NOT THE INSTRUCTOR GUIDE.
 *
 * These rows are transcribed from the AEMT Initial Instruction Course Approval
 * EagleMed filed for Wichita (course dates 1 Apr - 31 Jul 2025), which Kansas
 * City is running as the same template. Topics, hours and their dispersion are
 * copied from it; only the dates, sites and instructor change.
 *
 * That replaces a schedule derived from the publisher's Instructor Resource
 * Guide lecture timings. Where the two disagree the filing wins, by decision —
 * so the guide's chapter timings survive in TEXTBOOK_CHAPTERS above as a
 * cross-check reported by scripts/check-course-plan.mjs, and are no longer what
 * the hours are built from.
 *
 * TWO DEFECTS CARRIED OVER FROM THE SOURCE, both deliberate:
 *
 *   1. The filing's summary line reads "Didactic 110", but its own 26 schedule
 *      rows sum to 116. Lab matches at 50. Kansas City files 116 — the schedule
 *      is what KBEMS reviews against, so a summary disagreeing with it is the
 *      thing that is wrong. Decided 11 Aug 2026.
 *
 *   2. Chapters 17 and 18 are assigned twice — once in week 5 with chapter 12
 *      and 16, and again in week 9. Reproduced as filed rather than silently
 *      deduplicated, because removing them would change the week 9 hours and
 *      the whole point of this table is that it matches Wichita's.
 */

/**
 * How a session reaches the student.
 *
 * This distinction is what makes the eight-hour weekly cap meaningful. Only
 * `f2f` rows cost instructor time and room time; `assignment` rows are Navigate
 * chapter materials, quizzes and the AHA pre-course reading, which the student
 * works through on their own. Every one of the filing's ten f2f rows is exactly
 * eight hours — one Tuesday/Thursday pair at four hours each.
 */
export type Delivery = 'f2f' | 'assignment'

export interface ScheduleRow {
  order: number
  /** Course week, 1-based, numbered as the filing numbers them. */
  week: number
  /** Row label as the filing writes it. */
  label: string
  /** Two or three words, for a calendar chip. */
  short: string
  /** Topic list, as filed. */
  title: string
  delivery: Delivery
  didacticHours: number
  labHours: number
  /** Textbook chapters the row assigns. */
  chapters?: number[]
  /** Kansas AEMT Education Standards codes the row names. */
  sections?: string[]
}

export const KC_SCHEDULE: ScheduleRow[] = [
  {
    order: 1,
    week: 1,
    label: 'Week 1 Class',
    short: 'Orientation & Preparatory',
    title:
      'Introduction & Orientation; Course Syllabus/Schedule; EMS Systems (PR1); Research (PR2); Workforce Safety & Wellness (PR3); Documentation (PR4); EMS Systems Communication (PR5); Therapeutic Communication (PR6); Medical/Legal Ethical (PR7); Medical Terminology (PR9)',
    delivery: 'f2f',
    didacticHours: 8,
    labHours: 0,
    sections: ['PR1', 'PR2', 'PR3', 'PR4', 'PR5', 'PR6', 'PR7', 'PR9'],
  },
  {
    order: 2,
    week: 1,
    label: 'Week 1 Assignments',
    short: 'Ch 1-6',
    title: 'Chapters 1-6; chapter materials, quizzes & exams',
    delivery: 'assignment',
    didacticHours: 4,
    labHours: 0,
    chapters: [1, 2, 3, 4, 5, 6],
  },
  {
    order: 3,
    week: 2,
    label: 'Week 2 Assignments',
    short: 'Ch 7-10',
    title:
      'Chapters 7-10; Anatomy & Physiology (PR8); Pathophysiology (PR10); Life Span Development (PR11); Scene Size-Up (PA1); Primary Assessment (PA2); Secondary Assessment (PA4); Reassessment (PA6); chapter materials, quizzes & exams',
    delivery: 'assignment',
    didacticHours: 8,
    labHours: 0,
    chapters: [7, 8, 9, 10],
    sections: ['PR8', 'PR10', 'PR11', 'PA1', 'PA2', 'PA4', 'PA6'],
  },
  {
    order: 4,
    week: 3,
    label: 'Week 3 Assignments',
    short: 'Ch 11 Airway',
    title:
      'Chapter 11; Airway Management (AM1); Respiration (AM2); Artificial Ventilation (AM3); review previous assignments; chapter materials, quizzes & exams',
    delivery: 'assignment',
    didacticHours: 2,
    labHours: 0,
    chapters: [11],
    sections: ['AM1', 'AM2', 'AM3'],
  },
  {
    order: 5,
    week: 3,
    label: 'Week 3 Class',
    short: 'Assessment & Airway Lab',
    title:
      'A&P/Pathophysiology review; Patient Assessment skills; Monitoring Devices (PA5); Airway Management skills; Medication Administration skills; Intro to ECG monitoring',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 4,
    sections: ['PA5'],
  },
  {
    order: 6,
    week: 4,
    label: 'Week 4 Assignments',
    short: 'PALS pre-course',
    title: 'PALS pre-course requirements; study and prepare for PALS; AHA PALS Provider Book',
    delivery: 'assignment',
    didacticHours: 6,
    labHours: 0,
  },
  {
    order: 7,
    week: 4,
    label: 'PALS class',
    short: 'AHA PALS',
    title: 'AHA PALS Provider Course',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 4,
  },
  {
    order: 8,
    week: 5,
    label: 'Week 5 Assignments',
    short: 'Ch 12, 16-18',
    title:
      'Chapters 12, 16-18; Principles of Pharmacology (PR13); Emergency Medications (PR15); Public Health (PR12); Medical Overview (MT1); Infectious Disease (MT5); chapter materials, quizzes & exams',
    delivery: 'assignment',
    didacticHours: 6,
    labHours: 0,
    chapters: [12, 16, 17, 18],
    sections: ['PR13', 'PR15', 'PR12', 'MT1', 'MT5'],
  },
  {
    order: 9,
    week: 5,
    label: 'Week 5 Class',
    short: 'Meds & ECG Lab',
    title:
      'Review previous assignments; Medication Administration skills; ECG monitoring; Airway skills checkoff',
    delivery: 'f2f',
    didacticHours: 2,
    labHours: 6,
  },
  {
    order: 10,
    week: 6,
    label: 'Week 6 Assignments',
    short: 'ACLS pre-course',
    title: 'ACLS pre-course requirements; study and prepare for ACLS; AHA ACLS Provider Book',
    delivery: 'assignment',
    didacticHours: 4,
    labHours: 0,
  },
  {
    order: 11,
    week: 6,
    label: 'ACLS class',
    short: 'AHA ACLS',
    title: 'AHA ACLS Provider Course',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 4,
  },
  {
    order: 12,
    week: 7,
    label: 'Week 7 Assignments',
    short: 'Ch 13-15',
    title:
      'Chapters 13-15; Medication Administration (PR14); Shock and Resuscitation (ST1); chapter materials, quizzes & exams',
    delivery: 'assignment',
    didacticHours: 4,
    labHours: 0,
    chapters: [13, 14, 15],
    sections: ['PR14', 'ST1'],
  },
  {
    order: 13,
    week: 8,
    label: 'Week 8 Assignments',
    short: 'Ch 35-36 OB & Peds',
    title: 'Chapters 35, 36; Obstetrics (SP1); Neonatal Care (SP2); Pediatrics (SP3)',
    delivery: 'assignment',
    didacticHours: 6,
    labHours: 0,
    chapters: [35, 36],
    sections: ['SP1', 'SP2', 'SP3'],
  },
  {
    order: 14,
    week: 9,
    label: 'Week 9 Assignments',
    short: 'Ch 17-18 Resp & Cardiac',
    title:
      'Chapters 17, 18; Respiratory (MT10); Cardiovascular (MT8); chapter materials, quizzes & exams',
    delivery: 'assignment',
    didacticHours: 4,
    labHours: 0,
    chapters: [17, 18],
    sections: ['MT10', 'MT8'],
  },
  {
    order: 15,
    week: 9,
    label: 'Week 9 Class',
    short: 'ECG & Meds Checkoff',
    title: 'Review previous assignments; ECG practice; Medication Administration skills checkoff',
    delivery: 'f2f',
    didacticHours: 2,
    labHours: 6,
  },
  {
    order: 16,
    week: 10,
    label: 'Week 10 Assignments',
    short: 'Ch 39-42 Operations',
    title:
      'Chapters 39-42; Principles of Safely Operating a Ground Ambulance (OP1); Incident Management (OP2); Multiple Casualty Incidents (OP3); Air Medical (OP4); Vehicle Extrication (OP5); Haz-Mat Awareness (OP6); Terrorism & Disaster (OP7); chapter materials, quizzes & exams',
    delivery: 'assignment',
    didacticHours: 6,
    labHours: 0,
    chapters: [39, 40, 41, 42],
    sections: ['OP1', 'OP2', 'OP3', 'OP4', 'OP5', 'OP6', 'OP7'],
  },
  {
    order: 17,
    week: 11,
    label: 'Week 11 Class',
    short: 'Scenario Skills',
    title: 'Review previous materials; scenario skills',
    delivery: 'f2f',
    didacticHours: 2,
    labHours: 6,
  },
  {
    order: 18,
    week: 11,
    label: 'Week 11 Assignments',
    short: 'Ch 26-28 Trauma',
    title:
      'Chapters 26-28; Trauma Overview (ST2); Special Considerations in Trauma (ST10); Multisystem Trauma (ST12); Bleeding (ST3); Soft Tissue (ST7)',
    delivery: 'assignment',
    didacticHours: 6,
    labHours: 0,
    chapters: [26, 27, 28],
    sections: ['ST2', 'ST10', 'ST12', 'ST3', 'ST7'],
  },
  {
    order: 19,
    week: 12,
    label: 'Week 12 Assignments',
    short: 'Ch 29-31 Trauma',
    title:
      'Chapters 29-31; Head, Face, Neck & Spine (ST8); Chest Trauma (ST4); Nervous System Trauma (ST9)',
    delivery: 'assignment',
    didacticHours: 6,
    labHours: 0,
    chapters: [29, 30, 31],
    sections: ['ST8', 'ST4', 'ST9'],
  },
  {
    order: 20,
    week: 13,
    label: 'Week 13 Class',
    short: 'NR Practice',
    title: 'Review previous materials; National Registry practice',
    delivery: 'f2f',
    didacticHours: 2,
    labHours: 6,
  },
  {
    order: 21,
    week: 13,
    label: 'Week 13 Assignments',
    short: 'Ch 32-34 Trauma',
    title:
      'Chapters 32-34; Abdominal & Genitourinary Trauma (ST5); Orthopedic Trauma (ST6); Environmental Emergencies (ST11)',
    delivery: 'assignment',
    didacticHours: 6,
    labHours: 0,
    chapters: [32, 33, 34],
    sections: ['ST5', 'ST6', 'ST11'],
  },
  {
    order: 22,
    week: 14,
    label: 'Week 14 Assignments',
    short: 'Ch 19-21 Medical',
    title:
      'Chapters 19-21; Neurology (MT2); Abdominal & GI Disorders (MT3); Genitourinary/Renal (MT12); Endocrine (MT6); Hematology (MT11)',
    delivery: 'assignment',
    didacticHours: 6,
    labHours: 0,
    chapters: [19, 20, 21],
    sections: ['MT2', 'MT3', 'MT12', 'MT6', 'MT11'],
  },
  {
    order: 23,
    week: 15,
    label: 'Week 15 Class',
    short: 'NR Practice',
    title: 'Review previous materials; National Registry practice',
    delivery: 'f2f',
    didacticHours: 1,
    labHours: 7,
  },
  {
    order: 24,
    week: 15,
    label: 'Week 15 Assignments',
    short: 'Ch 22, 25, 37',
    title:
      'Chapters 22, 25 & 37; Immunology (MT4); Gynecology (MT13); Geriatrics (SP4); Special Challenges (SP5)',
    delivery: 'assignment',
    didacticHours: 6,
    labHours: 0,
    chapters: [22, 25, 37],
    sections: ['MT4', 'MT13', 'SP4', 'SP5'],
  },
  {
    order: 25,
    week: 16,
    label: 'Week 16 Assignments',
    short: 'Ch 23, 24, 38',
    title:
      'Chapters 23, 24 & 38; Toxicology (MT9); Psychiatric (MT7); Non-Traumatic Musculoskeletal Disorders (MT14)',
    delivery: 'assignment',
    didacticHours: 6,
    labHours: 0,
    chapters: [23, 24, 38],
    sections: ['MT9', 'MT7', 'MT14'],
  },
  {
    order: 26,
    week: 16,
    label: 'Week 16 Class',
    short: 'Final Exam & NR Prep',
    title: 'Final exam; National Registry board prep',
    delivery: 'f2f',
    didacticHours: 1,
    labHours: 7,
  },
]

/** Course weeks the filing runs. */
export const KC_COURSE_WEEKS = KC_SCHEDULE.reduce((n, r) => Math.max(n, r.week), 0)

/** The row's hours, whichever way it is delivered. */
export function rowHours(r: ScheduleRow): number {
  return r.didacticHours + r.labHours
}

export function scheduleTotals(): {
  didactic: number
  lab: number
  classroom: number
  weeks: number
  /** Instructor-led hours — what the weekly cap and the budget are about. */
  f2f: number
  /** Student self-study hours: Navigate materials, quizzes, AHA pre-course. */
  assignment: number
  f2fWeeks: number
} {
  const sum = (f: (r: ScheduleRow) => number) => KC_SCHEDULE.reduce((n, r) => n + f(r), 0)
  const f2f = sum((r) => (r.delivery === 'f2f' ? rowHours(r) : 0))
  return {
    didactic: sum((r) => r.didacticHours),
    lab: sum((r) => r.labHours),
    classroom: sum(rowHours),
    weeks: KC_COURSE_WEEKS,
    f2f,
    assignment: sum((r) => (r.delivery === 'assignment' ? rowHours(r) : 0)),
    f2fWeeks: new Set(KC_SCHEDULE.filter((r) => r.delivery === 'f2f').map((r) => r.week)).size,
  }
}

/** Kept for the standards-coverage note; every section the filing names. */
export const SCHEDULE_SECTIONS: string[] = [
  ...new Set(KC_SCHEDULE.flatMap((r) => r.sections ?? [])),
]

/** Chapters the filing never assigns — a gap against the adopted text. */
export function unscheduledChapters(): TextbookChapter[] {
  const taught = new Set(KC_SCHEDULE.flatMap((r) => r.chapters ?? []))
  return TEXTBOOK_CHAPTERS.filter((c) => !taught.has(c.n))
}

/** Chapters the filing assigns more than once. Wichita duplicates 17 and 18. */
export function duplicatedChapters(): number[] {
  const seen = new Map<number, number>()
  for (const r of KC_SCHEDULE) for (const c of r.chapters ?? []) seen.set(c, (seen.get(c) ?? 0) + 1)
  return [...seen].filter(([, n]) => n > 1).map(([c]) => c).sort((a, b) => a - b)
}

// ----- laying the schedule onto dates ----------------------------------------

/**
 * The shape of a class week.
 *
 * Wichita ran face-to-face Tuesday and Thursday, 09:00-13:00, and Kansas City
 * keeps that. Eight instructor-led hours a week is a budget constraint, not a
 * preference — the planner will extend the course rather than exceed it.
 */
export interface ClassPattern {
  /** Weekdays carrying class, 0 = Sunday. */
  days: number[]
  /** Length of one class day, in hours. */
  hoursPerDay: number
  /** Start of the class day, minutes from midnight. */
  startMinute: number
}

export const KC_CLASS_PATTERN: ClassPattern = {
  days: [2, 4],
  hoursPerDay: 4,
  startMinute: 9 * 60,
}

export const CLASS_HOURS_PER_WEEK = KC_CLASS_PATTERN.days.length * KC_CLASS_PATTERN.hoursPerDay

/** First class session: Tuesday 6 October 2026. */
export const KC_START_DATE = '2026-10-06'

/**
 * Days the program does not meet.
 *
 * Only dates falling on a class weekday matter, but the whole holiday is listed
 * so the reason is legible when someone asks why week 13 moved. A face-to-face
 * week that would land on any of these is pushed a week later and the course
 * extends — the filing's content is fixed, so the calendar is what gives.
 *
 * Assignment weeks are NOT pushed. They cost no instructor time and the student
 * works through them on their own schedule, so a holiday inside one changes
 * nothing about what the program owes.
 */
export const KC_HOLIDAYS: { date: string; name: string }[] = [
  { date: '2026-11-26', name: 'Thanksgiving Day' },
  { date: '2026-11-27', name: 'Day after Thanksgiving' },
  { date: '2026-12-24', name: 'Christmas Eve' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-31', name: "New Year's Eve" },
  { date: '2027-01-01', name: "New Year's Day" },
  { date: '2027-01-18', name: 'Martin Luther King Jr. Day' },
  { date: '2027-02-15', name: "Presidents' Day" },
]

const HOLIDAY_BY_DATE = new Map(KC_HOLIDAYS.map((h) => [h.date, h.name]))

export function holidayOn(iso: string): string | undefined {
  return HOLIDAY_BY_DATE.get(iso)
}

export interface PlannedSession {
  /** ISO date. */
  date: string
  /** Course week, as the filing numbers it. */
  week: number
  /** Calendar week from the first class date, 1-based. Differs from `week` once a holiday pushes something. */
  calendarWeek: number
  kind: 'didactic' | 'lab'
  delivery: Delivery
  hours: number
  rowOrder: number
  title: string
  short: string
  /** Only face-to-face rows carry clock times; assignments are not sat in a room. */
  startTime?: string
  endTime?: string
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60)
  return `${String(h).padStart(2, '0')}:${String(Math.round(minutes % 60)).padStart(2, '0')}`
}

/**
 * The whole course as dated sessions.
 *
 * One course week per calendar week, except that a face-to-face week landing on
 * a holiday is pushed to the next clear week — which is what extends the course
 * past sixteen calendar weeks.
 *
 * A face-to-face row is split across the pattern's class days: eight hours
 * becomes 4 + 4, and where a week mixes didactic and lab the didactic is placed
 * first so the lecture precedes the lab practising it.
 */
export function buildClassPlan(
  startISO: string = KC_START_DATE,
  pattern: ClassPattern = KC_CLASS_PATTERN,
): PlannedSession[] {
  const out: PlannedSession[] = []
  const perWeek = pattern.days.length
  // Anchor on the first class weekday on or after the start date.
  let anchor = startISO
  for (let i = 0; i < 7; i++) {
    const [y, m, d] = anchor.split('-').map(Number)
    if (new Date(y, m - 1, d).getDay() === pattern.days[0]) break
    anchor = addDaysISO(anchor, 1)
  }

  let calendarWeek = 0
  for (let week = 1; week <= KC_COURSE_WEEKS; week++) {
    const rows = KC_SCHEDULE.filter((r) => r.week === week)
    const f2f = rows.filter((r) => r.delivery === 'f2f')

    // Push past any week whose class days collide with a holiday.
    if (f2f.length > 0) {
      for (;;) {
        const dates = pattern.days.map((d) =>
          addDaysISO(anchor, calendarWeek * 7 + (d - pattern.days[0])),
        )
        if (!dates.some((iso) => HOLIDAY_BY_DATE.has(iso))) break
        calendarWeek++
      }
    }

    const dateFor = (dayIndex: number) =>
      addDaysISO(anchor, calendarWeek * 7 + (pattern.days[dayIndex] - pattern.days[0]))

    // Assignments are logged against the week's first class day: they are what
    // the student is told to go away and do, and that is when they are told.
    for (const r of rows.filter((x) => x.delivery === 'assignment')) {
      out.push({
        date: dateFor(0),
        week,
        calendarWeek: calendarWeek + 1,
        kind: 'didactic',
        delivery: 'assignment',
        hours: r.didacticHours,
        rowOrder: r.order,
        title: r.title,
        short: r.short,
      })
    }

    // Face-to-face: fill each class day to the pattern's length, didactic first.
    let dayIndex = 0
    let used = 0
    for (const r of f2f) {
      for (const seg of [
        { kind: 'didactic' as const, hours: r.didacticHours },
        { kind: 'lab' as const, hours: r.labHours },
      ]) {
        let left = seg.hours
        while (left > 1e-9 && dayIndex < perWeek) {
          const take = Math.min(pattern.hoursPerDay - used, left)
          const startMin = pattern.startMinute + Math.round(used * 60)
          const endMin = startMin + Math.round(take * 60)
          out.push({
            date: dateFor(dayIndex),
            week,
            calendarWeek: calendarWeek + 1,
            kind: seg.kind,
            delivery: 'f2f',
            hours: Math.round(take * 100) / 100,
            rowOrder: r.order,
            title: r.title,
            short: r.short,
            startTime: clock(startMin),
            endTime: clock(endMin),
          })
          used += take
          left -= take
          if (used >= pattern.hoursPerDay - 1e-9) {
            dayIndex++
            used = 0
          }
        }
      }
    }
    calendarWeek++
  }
  return out
}

const CLASS_PLAN = buildClassPlan()

/** Calendar weeks the course occupies once holidays have pushed it. */
export const KC_CALENDAR_WEEKS = CLASS_PLAN.reduce((n, s) => Math.max(n, s.calendarWeek), 0)

/** Last dated session, for the course end date. */
export const KC_END_DATE = CLASS_PLAN.reduce((d, s) => (s.date > d ? s.date : d), KC_START_DATE)

/**
 * Weeks a holiday actually displaced.
 *
 * Detected as a JUMP in calendar week, not as calendarWeek !== week. Once one
 * week is pushed every later week is offset too, and comparing the two numbers
 * directly reported all of them as displaced — four weeks, when only one had
 * collided with anything.
 */
export function holidayShifts(): { week: number; holiday: string; date: string }[] {
  const out: { week: number; holiday: string; date: string }[] = []
  const firstOf = new Map<number, PlannedSession>()
  for (const s of CLASS_PLAN) if (!firstOf.has(s.week)) firstOf.set(s.week, s)

  let previous = 0
  for (let week = 1; week <= KC_COURSE_WEEKS; week++) {
    const s = firstOf.get(week)
    if (!s) continue
    if (previous > 0 && s.calendarWeek - previous > 1) {
      // The collision sits in the week this one skipped over.
      const skipped = KC_CLASS_PATTERN.days
        .map((d) => addDaysISO(s.date, -7 + (d - KC_CLASS_PATTERN.days[0])))
        .map((iso) => HOLIDAY_BY_DATE.get(iso))
        .find(Boolean)
      out.push({ week, holiday: skipped ?? 'a holiday', date: s.date })
    }
    previous = s.calendarWeek
  }
  return out
}

/** Short calendar labels keyed by the title a seeded session carries. */
export const BLOCK_SHORT_BY_TITLE: Record<string, string> = Object.fromEntries(
  KC_SCHEDULE.map((r) => [r.title, r.short]),
)

// ----- program hour targets (proposal §2) ------------------------------------

export interface HourTarget {
  id: string
  label: string
  hours: number
  note?: string
}

/**
 * The hour totals Kansas City files, taken from the Wichita schedule table.
 *
 * Didactic is 116, the sum of the filing's own rows — NOT the 110 its summary
 * line states. Lab is 50, where the two agree. The decision and its reasoning
 * are recorded above KC_SCHEDULE.
 *
 * Derived from the schedule rather than typed, so the filed target and the
 * schedule built from it cannot disagree. That is the failure this replaced:
 * the earlier KC proposal claimed ~110 didactic in one section while its own
 * table summed to 90.
 */
export const KC_HOUR_TARGETS: HourTarget[] = [
  {
    id: 'didactic',
    label: 'Didactic',
    hours: scheduleTotals().didactic,
    note: `${scheduleTotals().f2f - scheduleTotals().lab} h face-to-face plus ${scheduleTotals().assignment} h of Navigate chapter materials, quizzes and AHA pre-course work.`,
  },
  {
    id: 'lab',
    label: 'Lab / psychomotor',
    hours: scheduleTotals().lab,
    note: 'All face-to-face. Minimum 2 instructors required on lab days.',
  },
  {
    id: 'clinical',
    label: 'Hospital clinical',
    hours: 72,
    note: '6 x 12-hour shifts — AdventHealth, Kansas City area.',
  },
  {
    id: 'field',
    label: 'Field internship',
    hours: 144,
    note: 'AMR Independence and AMR Linn County, to cover both urban 911 and rural response.',
  },
]

/** Hospital clinical hours the program schedules. */
export const KC_CLINICAL_TARGET = 72

/** Field internship hours, both ambulance services combined. */
export const KC_FIELD_TARGET = 144

/**
 * Classroom time — didactic plus lab, as the filing counts it.
 *
 * Includes the assignment hours: the filing's "Didactic 110/116" figure counts
 * Navigate chapter work alongside classroom time, and Kansas City is filing the
 * same template. Instructor-led time is the smaller `scheduleTotals().f2f`, and
 * that is the number the eight-hour weekly cap applies to.
 *
 * A PROGRAM DESIGN TARGET, not a Kansas requirement. Kansas prescribes no
 * minimum clock, classroom or course-week total for an initial AEMT course
 * (see the `kar-no-hour-minimum` rule set above); approval turns on whether the
 * submitted schedule plausibly covers the incorporated standards and whether
 * students can reach the K.A.R. 109-11-8 endpoints.
 */
export const KC_CLASSROOM_TARGET = scheduleTotals().classroom

/** Everything the student is scheduled for: classroom, lab, clinical, field. */
export const KC_TOTAL_TARGET = KC_CLASSROOM_TARGET + KC_CLINICAL_TARGET + KC_FIELD_TARGET


// ----- course policy (proposal §5, approval doc (b2)) ------------------------

/** Missing more than this many hours of scheduled class time fails the course. */
export const MAX_ABSENT_HOURS = 8

export const MIN_PASSING_PERCENT = 80

/**
 * K.A.R. 109-11-8 requires the PRIMARY INSTRUCTOR to verify in writing that
 * the student completed the course, within 15 days of the final class session
 * and before the student sits the certification examination. A program manager
 * signing in their place does not satisfy it.
 */
export const INSTRUCTOR_VERIFICATION_DAYS = 15

export const GRADING = [
  { label: 'Exams (online)', weight: '60%' },
  { label: 'Quizzes / homework (online)', weight: '40%' },
  { label: 'Lab skills demonstration', weight: 'Satisfactory / Unsatisfactory' },
  { label: 'Clinical & field internship', weight: 'Satisfactory / Unsatisfactory' },
]

// ----- KBEMS submission deadlines (proposal §6, §8) --------------------------

export interface KbemsDeadline {
  id: string
  label: string
  /** Days relative to a course anchor; negative = before. */
  offsetDays: number
  anchor: 'first-session' | 'last-session'
  note: string
  /**
   * Where the date comes from. 'kbems' — a deadline Kansas sets, and missing it
   * has a regulatory consequence. 'program' — CES planning lead time for work
   * KBEMS imposes no date on. The distinction is shown in the UI: an invented
   * date must never be read as a rule.
   */
  basis?: 'kbems' | 'program'
  /**
   * Conditions that must already hold before this can be submitted. The portal
   * enforces these by refusing to finalize, which surfaces them on the day of
   * filing — too late to fix the ones that need another person to act.
   */
  prerequisites?: string[]
}

export const KBEMS_DEADLINES: KbemsDeadline[] = [
  {
    id: 'instructor-setup',
    label: 'Set up every instructor in the Licensure system',
    offsetDays: -30,
    anchor: 'first-session',
    basis: 'program',
    note: 'KBEMS sets no deadline for this — the date is a CES planning target, two weeks ahead of the approval filing. It is separate because none of it is same-day work: it depends on the instructors themselves and on whoever maintains the service roster, and the course cannot be submitted until all of it is done.',
    prerequisites: [
      'Every instructor has a Kansas Licensure system account of their own.',
      'Every instructor appears on the service roster.',
      'Every instructor is set up as Instructional Staff — a roster entry alone does not make them selectable on a course.',
    ],
  },
  {
    id: 'course-approval',
    label: 'Submit Request for Initial Course Approval',
    offsetDays: -15,
    anchor: 'first-session',
    basis: 'kbems',
    note: 'At least 15 days before the first session, through the KBEMS Licensing Portal: Manage → Add a New Course, course type "Initial". Requires the full syllabus and signed clinical/field agreements. Save & Continue holds a draft; Finalize and Confirm Course Creation is what actually files it, and students cannot be enrolled before that.',
    prerequisites: [
      'Filed by an Instructor-Coordinator. No other role can create or finalize a course, so this cannot be delegated to whoever is free that day.',
      'Course schedule uploaded. Finalize is blocked without it.',
      'CV uploaded for every instructor who is not EMS-certified, including Allied Health instructors and the Medical Director. Finalize is blocked without it.',
      'Instructor setup complete (see above) — instructors who are not Instructional Staff cannot be attached to the course.',
    ],
  },
  {
    id: 'student-registration',
    label: 'Submit student registration forms',
    offsetDays: 20,
    anchor: 'first-session',
    basis: 'kbems',
    note: 'Within 20 days of the first class session, through the KBEMS Licensing Portal. Students can only be enrolled once the course itself has been finalized and confirmed.',
  },
  {
    id: 'nremt-verification',
    label: 'Confirm NREMT Program Director verification pathway',
    offsetDays: 35,
    anchor: 'first-session',
    basis: 'program',
    note: 'NREMT retired the ALS psychomotor examination on 30 June 2024 — there is no exam host to arrange. Since 1 July 2024 the Program Director verifies each candidate met the state minimum competency requirements, through the NREMT site, before the candidate sits the cognitive exam. Confirm who holds that role and that they have NREMT Program Director access.',
  },
  {
    id: 'roster',
    label: 'Submit KBEMS student roster (passed / failed / dropped)',
    offsetDays: 10,
    anchor: 'last-session',
    basis: 'kbems',
    note: 'Within 10 days of the last class session.',
  },
]

/** Program records retention, K.A.R. 109-11-4a. */
export const RECORDS_RETENTION_YEARS = 3
