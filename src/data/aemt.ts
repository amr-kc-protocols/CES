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

// ----- the course schedule (proposal §3, rebuilt from the text) --------------

export interface AemtBlock {
  order: number
  title: string
  /**
   * Two or three words for a calendar chip. The full title is a content line
   * running to a dozen words — correct on a filed schedule, useless in a grid
   * cell, where it truncates to 'Preparatory — EMS Systems,...' and tells the
   * reader nothing the colour did not.
   */
  short: string
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
  /**
   * Written examination time sitting in this block — section exams and the
   * comprehensive final. Classroom hours the chapter assets do not account for,
   * counted as didactic. Practical testing is lab and belongs in `labHours`.
   */
  examHours?: number
  /**
   * Psychomotor lab hours. ESTIMATED, not derived — see the note above
   * KC_BLOCK_PLAN. The instructor guide states lecture times and enumerates the
   * skill drills; it states no lab times, so anything claiming to derive these
   * would be invention dressed as publisher data.
   */
  labHours: number
  /**
   * Deliver this block without a lab week interrupting it.
   *
   * For the AHA provider courses, which are bought-in certifications with their
   * own fixed agenda. A four-hour block that straddles two class days is
   * ordinary; the same block straddling two class days three calendar weeks
   * apart is not, and that is what the interleave did to PALS before this —
   * 3.5 hours in week 3 and the last half hour in week 6, because two lab weeks
   * were released into the gap.
   *
   * It constrains only where lab weeks may be inserted. Class days stay exactly
   * the pattern's length; making an atomic block start on a fresh day instead
   * was tried and is worse, since it either files a half-hour class day or
   * merges one into a five-and-three-quarter-hour day.
   */
  atomic?: boolean
  /**
   * Standards sections placed into this block by hand, where the proposal's own
   * content sequence omitted them.
   */
  addedSections?: string[]
}

/**
 * Didactic hours for a block: the publisher's lecture time for its chapters,
 * plus the per-chapter classroom allowance, plus any examination time. AHA
 * blocks state their hours outright because AHA sets them.
 *
 * Rounded to the nearest quarter hour. A schedule is built in quarter hours;
 * carrying 9.1666… into a session's `hours` field only produces figures nobody
 * can file.
 */
export function blockDidacticHours(b: AemtBlock): number {
  const chapters = b.chapters ?? []
  const base =
    typeof b.fixedDidacticHours === 'number'
      ? b.fixedDidacticHours
      : (lectureMinutesFor(chapters) +
          taughtChaptersIn(chapters).length * PER_CHAPTER_CLASSROOM_MINUTES) /
        60
  return Math.round((base + (b.examHours ?? 0)) * 4) / 4
}

/** Skill drills the block's chapters carry — the psychomotor load behind its lab. */
export function blockSkillDrills(b: AemtBlock): number {
  return skillDrillsFor(b.chapters ?? [])
}

/**
 * LAB HOURS ARE AN ESTIMATE. Read this before changing one.
 *
 * The instructor guide states a lecture time for every chapter and names every
 * skill drill, but it states no lab times at all. There is nothing to derive
 * from, so each block's figure is judgement, sized against two things:
 *
 *   - The drills the block carries, and how many are NEW at AEMT scope rather
 *     than held from EMT. Forty-five of the guide's ninety-five drills are new
 *     (chapters 10, 11, 13, 18, 22, 35, 36, 38); a new drill needs demonstration,
 *     supervised repetition and a check-off against the sheet in
 *     data/aemtSkills.ts, where a carried-forward one is rehearsed to currency.
 *     Chapter 6's sixteen lifting-and-moving drills get nothing at all — the
 *     course does not teach that chapter, so it appears in no block.
 *   - What else the block has to fit: the AHA skills stations, extrication and
 *     MCI scenarios, and the summative practical, none of which have a drill
 *     behind them.
 *
 * The result is 86 hours over the 79 drills the schedule teaches — about 65
 * minutes per drill, or about 51 once the AHA courses, the summative practical
 * and the pharmacology hour are set aside as having no drill behind them.
 * Individual blocks run from 20 minutes per drill to over 90, because those two
 * inputs pull in different directions; the per-block comments say which is doing
 * the work.
 *
 * It is applied by hand per block rather than by formula on purpose. A formula
 * over drill counts would present this estimate as if it were the publisher's
 * data. It is not.
 */
export const KC_BLOCK_PLAN: AemtBlock[] = [
  {
    order: 1,
    short: 'Preparatory',
    title:
      'Preparatory — EMS Systems, Workforce Safety & Wellness, Medical/Legal, Communications & Documentation, Medical Terminology',
    chapters: [1, 2, 3, 4, 5],
    // Chapter 2's three drills — handwashing, glove removal, exposure response.
    // Carried forward from EMT, but they are the block's only psychomotor
    // content and BSI is check-off material, so it is an hour, not zero.
    labHours: 1,
  },
  {
    order: 2,
    short: 'Anatomy & Assessment',
    title: 'The Human Body, Pathophysiology, Life Span Development; Patient Assessment',
    chapters: [7, 8, 9, 10],
    // Chapter 10's five drills are all assessment skills, and this is where the
    // K.A.R. 109-11-8 fifteen-assessment competency begins accumulating.
    labHours: 6,
  },
  {
    order: 3,
    short: 'Airway',
    title: 'Airway Management; Lab — airway, supraglottic, CPAP',
    chapters: [11],
    // Fourteen drills, nearly all new at AEMT scope: OPA, NPA, suction, CPAP,
    // King LT, LMA, i-gel, and stoma ventilation. The second-largest lab in the
    // course.
    labHours: 10,
    examHours: 1,
  },
  {
    order: 4,
    short: 'AHA PALS',
    title: 'AHA PALS Provider Course',
    fixedDidacticHours: 4,
    atomic: true,
    // Skills stations and megacode. No textbook drills behind it.
    labHours: 6,
  },
  {
    order: 5,
    short: 'Pharmacology',
    title: 'Principles of Pharmacology',
    chapters: [12],
    // No drills. Drug box familiarisation and label reading; dose calculation is
    // didactic and sits in the chapter allowance.
    labHours: 1,
  },
  { order: 6, short: 'AHA ACLS', title: 'AHA ACLS Provider Course', fixedDidacticHours: 4, atomic: true, labHours: 6 },
  {
    order: 7,
    short: 'Vascular Access & Meds',
    title: 'Vascular Access and Medication Administration; Shock; BLS Resuscitation; Lab — IV, IO, med routes',
    chapters: [13, 14, 15],
    // The heaviest psychomotor block in the course: nineteen drills, thirteen of
    // them new-scope, and it is where the K.A.R. 109-11-8 venipuncture, IO and
    // injection minimums are actually taught. It previously held ZERO lab hours.
    labHours: 18,
    examHours: 1,
  },
  {
    order: 8,
    short: 'OB & Pediatrics',
    title: 'Obstetrics and Neonatal Care; Pediatric Emergencies',
    chapters: [35, 36],
    // Eight drills, all new-scope: delivery, paediatric airway, paediatric IO,
    // and paediatric immobilisation.
    labHours: 7,
  },
  {
    order: 9,
    short: 'Respiratory & Cardiac',
    title: 'Medical Overview; Respiratory Emergencies; Cardiovascular Emergencies / ECG; Lab — ECG acquisition',
    chapters: [16, 17, 18],
    // Three drills, but one of them is cardiac monitoring, behind the eight-ECG
    // minimum; nebuliser and CPAP integration from chapter 17 runs here too.
    labHours: 5,
    examHours: 1,
  },
  {
    order: 10,
    short: 'Operations & Trauma I',
    title: 'EMS Operations; Trauma — overview, bleeding, soft tissue, chest; Lab — scenarios',
    chapters: [39, 40, 41, 42, 26, 27, 28, 31],
    // Six carry-forward drills — hemorrhage control, wound packing, tourniquet,
    // impaled object, burns — plus extrication and MCI triage scenario time.
    labHours: 6,
  },
  {
    order: 11,
    short: 'Trauma II & Medical',
    title: 'Trauma — face/neck, head/spine, abdominal, orthopaedic, environmental; Medicine — neurologic, GI/GU, endocrine/hematologic',
    chapters: [29, 30, 32, 33, 34, 19, 20, 21],
    // Nineteen drills. All carry-forward, but SMR, the traction splints and
    // helmet removal are equipment-dependent and decay fastest.
    labHours: 12,
    examHours: 1,
    // Sits with the rest of trauma. Its assessment points invert what students
    // have just been taught about shock, so it cannot be left to be picked up
    // incidentally.
    addedSections: [
      'ST10 Special Considerations in Trauma — trauma in pregnancy: abruptio placenta, why a normal heart rate and a rate under 20 mislead, loss of compression landmarks in arrest',
    ],
  },
  {
    order: 12,
    short: 'Medical & Final',
    title: 'Medicine — immunologic, toxicology, psychiatric, gynecologic; Geriatrics; Patients With Special Challenges; Final exam & NREMT prep',
    chapters: [22, 23, 24, 25, 37, 38],
    // Two drills (epinephrine auto-injector, tracheostomy suctioning) plus the
    // summative practical: every AEMT-scope station tested to NREMT format.
    labHours: 8,
    // Comprehensive written final, plus the NREMT written review.
    examHours: 4,
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

// ----- laying the blocks onto class days -------------------------------------

/**
 * The shape of a class week.
 *
 * Everything about the calendar comes from here. Block spans used to be typed
 * per block ('Weeks 2-3', spanWeeks: 2) alongside the hours, which meant the
 * two could disagree — and did, until the didactic figures were derived and the
 * spans were not.
 */
export interface ClassPattern {
  /** Weekdays carrying class, 0 = Sunday. */
  days: number[]
  /** Length of one class day, in hours. */
  hoursPerDay: number
  /** Start of the class day, minutes from midnight. */
  startMinute: number
}

/** Two four-hour classes a week, Tuesday and Thursday, 09:00-13:00. */
export const KC_CLASS_PATTERN: ClassPattern = {
  days: [2, 4],
  hoursPerDay: 4,
  startMinute: 9 * 60,
}

export const CLASS_HOURS_PER_WEEK =
  KC_CLASS_PATTERN.days.length * KC_CLASS_PATTERN.hoursPerDay

export interface PlannedSession {
  /** 0-based week from the first class week. */
  week: number
  /** Index into the pattern's days: 0 = the first class day of the week. */
  dayIndex: number
  kind: 'didactic' | 'lab'
  hours: number
  blockOrder: number
  title: string
}

interface PackedStream {
  sessions: { day: number; blockOrder: number; hours: number }[]
  /** Flat day index in which each block's last hour of this kind lands. */
  lastDayOf: Map<number, number>
  days: number
}

/**
 * Fill fixed-length class days from a queue of block segments.
 *
 * A day may carry the tail of one block and the head of the next — that is what
 * keeps every day exactly four hours instead of leaving a half-hour stub
 * whenever a block's hours are not a multiple of the class day. Each piece stays
 * its own session, so the schedule still says which block it belongs to.
 */
function packStream(
  segments: { blockOrder: number; hours: number }[],
  hoursPerDay: number,
): PackedStream {
  const sessions: { day: number; blockOrder: number; hours: number }[] = []
  const lastDayOf = new Map<number, number>()
  let day = 0
  let used = 0
  for (const seg of segments) {
    let left = seg.hours
    while (left > 1e-9) {
      const take = Math.min(hoursPerDay - used, left)
      sessions.push({ day, blockOrder: seg.blockOrder, hours: Math.round(take * 100) / 100 })
      lastDayOf.set(seg.blockOrder, day)
      used += take
      left -= take
      if (used >= hoursPerDay - 1e-9) {
        day++
        used = 0
      }
    }
  }
  return { sessions, lastDayOf, days: used > 1e-9 ? day + 1 : day }
}

/**
 * The whole course as dated-by-week class sessions.
 *
 * Didactic and lab run in SEPARATE weeks. A week is one or the other, never
 * both: didactic weeks deliver two four-hour classes, and lab is banked and
 * released as dedicated lab weeks of the same shape.
 *
 * A lab week is placed as soon as every block it practises has finished being
 * taught, which is the only ordering constraint that matters — you cannot run
 * the IV lab before the vascular access lectures. Within that constraint lab
 * lands as early as it can, so skills are current when the student reaches the
 * clinical rotations that consume them.
 */
export function buildClassPlan(pattern: ClassPattern = KC_CLASS_PATTERN): PlannedSession[] {
  const perWeek = pattern.days.length
  const byOrder = new Map(KC_BLOCK_PLAN.map((b) => [b.order, b]))

  const didactic = packStream(
    KC_BLOCK_PLAN.map((b) => ({ blockOrder: b.order, hours: blockDidacticHours(b) })).filter(
      (s) => s.hours > 0,
    ),
    pattern.hoursPerDay,
  )
  const lab = packStream(
    KC_BLOCK_PLAN.map((b) => ({ blockOrder: b.order, hours: b.labHours })).filter(
      (s) => s.hours > 0,
    ),
    pattern.hoursPerDay,
  )

  const didacticWeeks = Math.ceil(didactic.days / perWeek)
  const labWeeks = Math.ceil(lab.days / perWeek)

  /** The didactic week in which each block finishes being taught. */
  const taughtBy = new Map<number, number>()
  for (const [order, day] of didactic.lastDayOf) taughtBy.set(order, Math.floor(day / perWeek))

  /** The earliest didactic week after which each lab week may run. */
  const readyAfter: number[] = []
  for (let w = 0; w < labWeeks; w++) {
    const blocks = new Set(
      lab.sessions.filter((s) => Math.floor(s.day / perWeek) === w).map((s) => s.blockOrder),
    )
    let ready = 0
    for (const b of blocks) ready = Math.max(ready, taughtBy.get(b) ?? 0)
    readyAfter.push(ready)
  }

  /**
   * Didactic weeks that must be followed immediately by the next didactic week,
   * because an atomic block straddles the two.
   */
  const welded = new Set<number>()
  for (const b of KC_BLOCK_PLAN) {
    if (!b.atomic) continue
    const weeks = didactic.sessions
      .filter((s) => s.blockOrder === b.order)
      .map((s) => Math.floor(s.day / perWeek))
    for (let w = Math.min(...weeks); w < Math.max(...weeks); w++) welded.add(w)
  }

  // Interleave: run each didactic week, then release every lab week whose
  // content has been taught by that point — unless an atomic block is still
  // mid-delivery, in which case the lab waits a week.
  const order: { kind: 'didactic' | 'lab'; index: number }[] = []
  let nextLab = 0
  for (let w = 0; w < didacticWeeks; w++) {
    order.push({ kind: 'didactic', index: w })
    if (welded.has(w)) continue
    while (nextLab < labWeeks && readyAfter[nextLab] <= w) {
      order.push({ kind: 'lab', index: nextLab })
      nextLab++
    }
  }
  while (nextLab < labWeeks) {
    order.push({ kind: 'lab', index: nextLab })
    nextLab++
  }

  const out: PlannedSession[] = []
  order.forEach((slot, week) => {
    const stream = slot.kind === 'didactic' ? didactic : lab
    for (const s of stream.sessions) {
      if (Math.floor(s.day / perWeek) !== slot.index) continue
      const block = byOrder.get(s.blockOrder)
      out.push({
        week,
        dayIndex: s.day % perWeek,
        kind: slot.kind,
        hours: s.hours,
        blockOrder: s.blockOrder,
        title: block ? blockContentLine(block) : `Block ${s.blockOrder}`,
      })
    }
  })
  return out
}

/** The plan, built once — nothing about it varies at runtime. */
const CLASS_PLAN = buildClassPlan()

/** Calendar weeks of classroom instruction, derived from the laid-out plan. */
export const KC_COURSE_WEEKS = CLASS_PLAN.reduce((n, s) => Math.max(n, s.week + 1), 0)

/**
 * The weeks a block occupies, 1-based and inclusive, or undefined if it has no
 * class time at all. Derived, so it cannot drift from the schedule the way the
 * hand-typed 'Weeks 2-3' labels did.
 */
export function blockWeekRange(order: number): { first: number; last: number } | undefined {
  const weeks = CLASS_PLAN.filter((s) => s.blockOrder === order).map((s) => s.week)
  if (weeks.length === 0) return undefined
  return { first: Math.min(...weeks) + 1, last: Math.max(...weeks) + 1 }
}

/**
 * Short calendar labels keyed by the content line a seeded session is titled
 * with. A calendar chip has room for two or three words; a hand-added session
 * is not in here and keeps its own title.
 */
export const BLOCK_SHORT_BY_TITLE: Record<string, string> = Object.fromEntries(
  KC_BLOCK_PLAN.map((b) => [blockContentLine(b), b.short]),
)

/** 'Week 4' or 'Weeks 4-6' for display. */
export function blockWeeksLabel(order: number): string {
  const r = blockWeekRange(order)
  if (!r) return 'Unscheduled'
  return r.first === r.last ? `Week ${r.first}` : `Weeks ${r.first}-${r.last}`
}

/** Every section added on top of the filing, for a coverage note. */
export const ADDED_STANDARDS_SECTIONS: { block: string; section: string }[] = KC_BLOCK_PLAN.flatMap(
  (b) => (b.addedSections ?? []).map((section) => ({ block: blockWeeksLabel(b.order), section })),
)

/** What the block plan actually adds up to, as opposed to what §2 claims. */
export function blockPlanTotals(): {
  didactic: number
  lab: number
  classroom: number
  weeks: number
  /** Publisher lecture hours the didactic figure is built from. */
  lectureHours: number
  /** Chapters taught, ignoring carry-forward content. */
  chaptersTaught: number
  /** Written examination hours included in the didactic figure. */
  examHours: number
  /** Skill drills the scheduled chapters carry, for the lab estimate. */
  skillDrills: number
} {
  const didactic = KC_BLOCK_PLAN.reduce((n, b) => n + blockDidacticHours(b), 0)
  const lab = KC_BLOCK_PLAN.reduce((n, b) => n + b.labHours, 0)
  const weeks = KC_COURSE_WEEKS
  const lectureHours =
    KC_BLOCK_PLAN.reduce((n, b) => n + lectureMinutesFor(b.chapters ?? []), 0) / 60
  const chaptersTaught = KC_BLOCK_PLAN.reduce(
    (n, b) => n + taughtChaptersIn(b.chapters ?? []).length,
    0,
  )
  const examHours = KC_BLOCK_PLAN.reduce((n, b) => n + (b.examHours ?? 0), 0)
  const skillDrills = KC_BLOCK_PLAN.reduce((n, b) => n + blockSkillDrills(b), 0)
  return {
    didactic,
    lab,
    classroom: didactic + lab,
    weeks,
    lectureHours,
    chaptersTaught,
    examHours,
    skillDrills,
  }
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
export function classDayLoad(): number {
  const byDay = new Map<string, number>()
  for (const s of CLASS_PLAN) {
    const key = `${s.week}:${s.dayIndex}`
    byDay.set(key, (byDay.get(key) ?? 0) + s.hours)
  }
  return Math.max(...byDay.values())
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
    note: `Derived: ${blockPlanTotals().lectureHours.toFixed(1)} h of publisher lecture over ${blockPlanTotals().chaptersTaught} chapters, plus ${PER_CHAPTER_CLASSROOM_MINUTES} min per chapter of case study, Assessment in Action and quiz, plus ${blockPlanTotals().examHours} h of examinations and the AHA provider courses.`,
  },
  {
    id: 'lab',
    label: 'Lab / psychomotor',
    hours: blockPlanTotals().lab,
    note: `Estimated against the ${blockPlanTotals().skillDrills} skill drills the scheduled chapters carry. Minimum 2 instructors required on lab days.`,
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
