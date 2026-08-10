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
    site: 'AMR KC interfacility / AMR Independence 911 (10+), AdventHealth (up to 5)',
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
    site: 'AMR Independence 911 (primary), AMR KC interfacility (supplement)',
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
 * This exists so the schedule is built from what has to be taught rather than
 * from a number somebody chose. Hours are DERIVED from it below.
 */
export const COURSE_TEXT = {
  title: 'Advanced Emergency Care and Transportation of the Sick and Injured',
  edition: '4th',
  publisher: 'AAOS / Jones & Bartlett Learning',
  isbn: '9781284244175',
  source: 'Instructor Resource Guide, lecture timings table',
}

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
 * Classroom hours planned per hour of publisher lecture time.
 *
 * Slides are the spine of a session, not the whole of it: the guide ships case
 * studies, practice activities, an "Assessment in Action" and a quiz for every
 * chapter, and all of them are classroom time the lecture figure excludes. 2.0
 * funds one hour of that work for every hour of slides.
 *
 * THIS IS THE ONE NUMBER TO ARGUE ABOUT. It is the only judgement in the hour
 * calculation — everything else is the publisher's data and arithmetic. Lower
 * it to 1.5 and the course is 26 hours shorter and mostly lecture; raise it to
 * 2.25 and it gains 13 hours of discussion and practice. It is deliberately a
 * single named constant so that argument happens once, here, in review.
 */
export const DIDACTIC_DELIVERY_RATIO = 2.0

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

// ----- the course schedule (proposal §3, rebuilt from the text) --------------

export interface AemtBlock {
  order: number
  /** Label as it appears in the proposal, e.g. 'Weeks 1-2'. */
  weeks: string
  /** How many calendar weeks the block spans. */
  spanWeeks: number
  title: string
  /**
   * Textbook chapters this block teaches. Didactic hours are DERIVED from
   * their publisher lecture times — see blockDidacticHours(). Typed hours were
   * how the plan came to disagree with itself: the proposal's §2 claimed ~110
   * didactic hours while its §3 table summed to 90, and neither was traceable
   * to what was being taught.
   */
  chapters?: number[]
  /**
   * Didactic hours stated outright rather than derived. Only for blocks with no
   * textbook behind them — the AHA PALS and ACLS provider courses, whose length
   * AHA sets.
   */
  fixedDidacticHours?: number
  labHours: number
  /**
   * Standards sections placed into this block by hand, where the proposal's own
   * content sequence omitted them.
   */
  addedSections?: string[]
}

/**
 * Didactic hours for a block: publisher lecture time times the delivery ratio,
 * or the stated figure for an AHA course.
 *
 * Rounded to the nearest quarter hour. A schedule is built in quarter hours;
 * carrying 9.1666… into a session's `hours` field only produces figures nobody
 * can file.
 */
export function blockDidacticHours(b: AemtBlock): number {
  if (typeof b.fixedDidacticHours === 'number') return b.fixedDidacticHours
  const hours = (lectureMinutesFor(b.chapters ?? []) / 60) * DIDACTIC_DELIVERY_RATIO
  return Math.round(hours * 4) / 4
}

/** Skill drills the block's chapters carry — the psychomotor load behind its lab. */
export function blockSkillDrills(b: AemtBlock): number {
  return skillDrillsFor(b.chapters ?? [])
}

export const KC_BLOCK_PLAN: AemtBlock[] = [
  { order: 1, weeks: 'Week 1', spanWeeks: 1, title: 'Preparatory — EMS Systems, Workforce Safety & Wellness, Medical/Legal, Communications & Documentation, Medical Terminology', chapters: [1, 2, 3, 4, 5], labHours: 0 },
  { order: 2, weeks: 'Weeks 2-3', spanWeeks: 2, title: 'The Human Body, Pathophysiology, Life Span Development; Patient Assessment', chapters: [7, 8, 9, 10], labHours: 4.5 },
  { order: 3, weeks: 'Week 4', spanWeeks: 1, title: 'Airway Management; Lab — airway, supraglottic, CPAP', chapters: [11], labHours: 6 },
  { order: 4, weeks: 'Week 5', spanWeeks: 1, title: 'AHA PALS Provider Course', fixedDidacticHours: 4, labHours: 4 },
  { order: 5, weeks: 'Week 6', spanWeeks: 1, title: 'Principles of Pharmacology', chapters: [12], labHours: 2 },
  { order: 6, weeks: 'Week 7', spanWeeks: 1, title: 'AHA ACLS Provider Course', fixedDidacticHours: 4, labHours: 4 },
  {
    order: 7,
    weeks: 'Weeks 8-10',
    spanWeeks: 3,
    title: 'Vascular Access and Medication Administration; Shock; BLS Resuscitation; Lab — IV, IO, med routes',
    chapters: [13, 14, 15],
    // The heaviest psychomotor block in the course: chapter 13 alone carries 13
    // skill drills, and it is where the K.A.R. 109-11-8 venipuncture, IO and
    // injection minimums are actually taught. It previously held ZERO lab hours.
    labHours: 12,
  },
  { order: 8, weeks: 'Weeks 11-12', spanWeeks: 2, title: 'Obstetrics and Neonatal Care; Pediatric Emergencies', chapters: [35, 36], labHours: 7.5 },
  {
    order: 9,
    weeks: 'Week 13',
    spanWeeks: 1,
    title: 'Medical Overview; Respiratory Emergencies; Cardiovascular Emergencies / ECG; Lab — ECG acquisition',
    chapters: [16, 17, 18],
    labHours: 3,
  },
  { order: 10, weeks: 'Weeks 14-15', spanWeeks: 2, title: 'EMS Operations; Trauma — overview, bleeding, soft tissue, chest; Lab — scenarios', chapters: [39, 40, 41, 42, 26, 27, 28, 31], labHours: 4 },
  {
    order: 11,
    weeks: 'Weeks 16-18',
    spanWeeks: 3,
    title: 'Trauma — face/neck, head/spine, abdominal, orthopaedic, environmental; Medicine — neurologic, GI/GU, endocrine/hematologic',
    chapters: [29, 30, 32, 33, 34, 19, 20, 21],
    labHours: 4,
    // Sits with the rest of trauma. Its assessment points invert what students
    // have just been taught about shock, so it cannot be left to be picked up
    // incidentally.
    addedSections: [
      'ST10 Special Considerations in Trauma — trauma in pregnancy: abruptio placenta, why a normal heart rate and a rate under 20 mislead, loss of compression landmarks in arrest',
    ],
  },
  {
    order: 12,
    weeks: 'Weeks 19-20',
    spanWeeks: 2,
    title: 'Medicine — immunologic, toxicology, psychiatric, gynecologic; Geriatrics; Patients With Special Challenges; Final exam & NREMT prep',
    chapters: [22, 23, 24, 25, 37, 38],
    labHours: 3,
  },
]

/**
 * The block's full content line — the proposal's title plus any standards
 * sections added to it. This is what a session should be titled: a schedule
 * that omits the additions is the same schedule that lost them in the first
 * place. Only the section codes are appended, not their full descriptions,
 * which stay in `addedSections` for the plan view.
 */
export function blockContentLine(b: AemtBlock): string {
  if (!b.addedSections?.length) return b.title
  const codes = b.addedSections.map((s) => s.split(' — ')[0])
  return `${b.title}; ${codes.join('; ')}`
}

/** Every section added on top of the filing, for a coverage note. */
export const ADDED_STANDARDS_SECTIONS: { block: string; section: string }[] = KC_BLOCK_PLAN.flatMap(
  (b) => (b.addedSections ?? []).map((section) => ({ block: b.weeks, section })),
)

/** What the block plan actually adds up to, as opposed to what §2 claims. */
export function blockPlanTotals(): {
  didactic: number
  lab: number
  classroom: number
  weeks: number
  /** Publisher lecture hours the didactic figure is built from. */
  lectureHours: number
} {
  const didactic = KC_BLOCK_PLAN.reduce((n, b) => n + blockDidacticHours(b), 0)
  const lab = KC_BLOCK_PLAN.reduce((n, b) => n + b.labHours, 0)
  const weeks = KC_BLOCK_PLAN.reduce((n, b) => n + b.spanWeeks, 0)
  const lectureHours =
    KC_BLOCK_PLAN.reduce((n, b) => n + lectureMinutesFor(b.chapters ?? []), 0) / 60
  return { didactic, lab, classroom: didactic + lab, weeks, lectureHours }
}

/**
 * Chapters in the text that no block teaches.
 *
 * Carry-forward chapters are expected here and are not a gap; anything else is
 * content the course adopted a book for and then did not schedule.
 */
export function unscheduledChapters(): TextbookChapter[] {
  const taught = new Set(KC_BLOCK_PLAN.flatMap((b) => b.chapters ?? []))
  return TEXTBOOK_CHAPTERS.filter((c) => !taught.has(c.n) && !c.carryForward)
}

/** Hours a class day must carry for the plan to fit its own calendar. */
export function classDayLoad(daysPerWeek = 2): number {
  const t = blockPlanTotals()
  return t.classroom / t.weeks / daysPerWeek
}

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
  {
    id: 'didactic',
    label: 'Didactic',
    hours: blockPlanTotals().didactic,
    note: `Derived: ${blockPlanTotals().lectureHours.toFixed(1)} h of publisher lecture at ${DIDACTIC_DELIVERY_RATIO}x, plus the AHA provider courses.`,
  },
  {
    id: 'lab',
    label: 'Lab / psychomotor',
    hours: blockPlanTotals().lab,
    note: 'Minimum 2 instructors required on lab days.',
  },
  { id: 'clinical', label: 'Hospital clinical', hours: 72, note: '6 x 12-hour shifts — AdventHealth KC.' },
  { id: 'field-ift', label: 'Field — AMR KC interfacility', hours: 48, note: 'Approx. 4 x 12-hour shifts.' },
  { id: 'field-911', label: 'Field — AMR Independence 911', hours: 96, note: 'Approx. 8 x 12-hour shifts.' },
]

/** Hospital clinical hours the program schedules. */
export const KC_CLINICAL_TARGET = 72

/** Field internship hours, both sites combined. */
export const KC_FIELD_TARGET = 144

/**
 * Classroom time only — what the Tue/Thu sessions have to add up to.
 *
 * DERIVED from the block plan, not typed. This is the number that used to be
 * wrong in two directions at once: the proposal's §2 claimed ~110 didactic
 * hours, its §3 schedule table summed to 90, and the 16-week Tue/Thu calendar
 * could hold neither. Deriving it means the plan, the target and the schedule
 * cannot disagree — change what is taught and the target follows.
 *
 * A PROGRAM DESIGN TARGET, not a Kansas requirement. Kansas prescribes no
 * minimum clock, classroom or course-week total for an initial AEMT course
 * (see the `kar-no-hour-minimum` rule set above); approval turns on whether the
 * submitted schedule plausibly covers the incorporated standards and whether
 * students can reach the K.A.R. 109-11-8 endpoints.
 */
export const KC_CLASSROOM_TARGET = blockPlanTotals().classroom

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
