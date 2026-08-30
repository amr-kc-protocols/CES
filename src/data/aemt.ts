// ---------------------------------------------------------------------------
// AEMT program data for the JOINT OCTOBER 2026 COHORT — AMR Kansas City and
// AMR Wichita running one class.
//
// This file used to hold two things in tension: Kansas City's own Initial
// Course of Instruction proposal, and Wichita's 2025 course approval, which
// Kansas City had transcribed wholesale as a template. Those two builds are
// merged here. The schedule, the gates, the grading model and the clinical
// cadence are the joint October 2026 plan both primary instructors agreed to;
// what was specific to either market — sites, instructors, campus placement —
// is carried on a campus tag rather than being replaced by the other side.
//
// Source documents:
//   AEMT_Course_Oct2026_Cohort.docx        the agreed schedule, gates, grading
//   AEMT_Clinical_Rotation_Tracker.xlsx    the rotation cadence and checkpoints
//
// Regulations cited:
//   K.A.R. 109-11-8    clinical experience minimums
//   K.A.R. 109-11-1a   course approval filing deadline
//   K.A.R. 109-11-4a   AEMT course approval contents (as amended Nov 1, 2024)
//   K.A.R. 109-10-1c   adopts the Kansas AEMT Educational Standards (Oct 2014)
//   K.A.R. 109-17-3    program records and retention
//
// Kept as data, not UI, so the numbers a KBEMS submission depends on live in
// one reviewable place.
// ---------------------------------------------------------------------------

import type { Market } from '../lib/market'

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
    // The deadline, as distinct from the contents. These were conflated in an
    // earlier version of this file, which carried a 15-day filing window under
    // the 109-11-4a citation. 109-11-4a says what the application must contain;
    // 109-11-1a(c) says when it has to be in the board office, and it is 30
    // calendar days, not 15. The joint plan cites 109-11-1a(c) and it is right.
    // Filing on the 15-day reading would have missed the deadline by a
    // fortnight and taken the whole cohort with it.
    id: 'kar-109-11-1a',
    citation: 'K.A.R. 109-11-1a(c)',
    effectiveDate: '2024-11-01',
    scope:
      'The course approval application must be in the board office no later than 30 calendar days before the first session. For a 6 October 2026 start that is Sunday 6 September; the Monday after is Labor Day, so the practical deadline is Friday 4 September 2026.',
    verifiedAgainst:
      'AEMT_Course_Oct2026_Cohort.docx §2, agreed by both primary instructors. RE-VERIFY against the current regulation text before filing — this supersedes a 15-day figure this file previously carried, and the two disagree by a fortnight.',
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
 * THE SCHEDULE IS NOT BUILT FROM THIS. Hours come from the joint October 2026
 * cohort plan; see KC_SCHEDULE below. The guide's timings are kept as a
 * cross-check that check-course-plan.mjs reports, so the distance between what
 * the publisher allots and what the schedule allots stays visible instead of
 * being rediscovered later.
 *
 * EDITION, RESOLVED. §10 of the joint plan lists the edition mismatch as a fix
 * before submission: the prior syllabus named a Fourth Edition textbook beside
 * Third Edition Navigate materials, and Wichita's 2025 filing cited ISBN
 * 978-1-284-22640-9 with a 2019 date next to a Fourth Edition title, which
 * cannot both be right. Everything is aligned to the Fourth Edition, 2023,
 * instructor guide 9781284244175 — the copy actually in hand. The ISBN Wichita
 * filed is kept below so the discrepancy stays on the record rather than being
 * quietly dropped; confirm against what the bookstore ships before the
 * application goes in.
 */
export const COURSE_TEXT = {
  title: 'Advanced Emergency Care and Transportation of the Sick and Injured',
  edition: '4th',
  copyright: 2023,
  publisher: 'AAOS / Jones & Bartlett Learning',
  isbn: '9781284244175',
  /** As Wichita's 2025 filing cited it; retained because the two disagree. */
  filedIsbn: '9781284226409',
  source: 'Instructor Resource Guide, lecture timings table',
  navigateEdition: 'Navigate, Fourth Edition — course shell, TestPrep and gradebook all on 4e.',
}

// ----- the joint cohort: who runs it, and where -----------------------------

/**
 * ONE CLASS, TWO OPERATIONS, ONE MARKET RECORD.
 *
 * Kansas City and Wichita are running the October 2026 AEMT cohort together.
 * Both primary instructors have agreed to the schedule above, and the didactic
 * is delivered jointly.
 *
 * The course record lives in the KANSAS CITY market, and that is a decision
 * rather than an accident. `records.market` plus the RLS policy in
 * supabase/migrations/2026-08-06-markets.sql hard-partitions the two markets:
 * a course row written under `wichita` is not readable from a Kansas City
 * device and vice versa. A cohort cannot straddle that line, so it sits on the
 * side that files the KBEMS approval and holds the sponsoring organization —
 * Kansas City. Wichita's students are enrolled in it, and Wichita's instructor
 * needs a market assignment of `all` (see lib/market.ts) to reach it.
 *
 * WHAT IS SHARED AND WHAT IS NOT. The didactic schedule, the gates, the
 * grading model and the skill sheets are shared: one class, one standard.
 * Clinical and field placement is LOCAL — a Wichita student is not driving to
 * Merriam for six 12-hour shifts. Every site below carries the campus it
 * serves, and so does every student; the placement board routes on it.
 */
export type Campus = Market

export const CAMPUS_LABEL: Record<Campus, string> = {
  kc: 'Kansas City',
  wichita: 'Wichita',
}

export interface CourseStaff {
  campus: Campus
  operation: string
  name: string
  credential: string
  email?: string
  /**
   * K.A.R. 109-11-8 puts the completion verification on the PRIMARY instructor.
   * A joint course still has exactly one of those; the other market's lead is a
   * co-instructor of record, named on the application and teaching to the same
   * schedule, but not the signature on a completion.
   */
  role: 'primary' | 'co-instructor'
  officeHours: string
  note?: string
}

export const COURSE_STAFF: CourseStaff[] = [
  {
    campus: 'kc',
    operation: 'AMR Kansas City',
    name: 'Jordan Jones',
    credential: 'Paramedic',
    email: 'jordan.jones@gmr.net',
    role: 'primary',
    officeHours:
      'Available by text anytime; allow a maximum of 12 hours for a reply, though most are much sooner. Teams meetings arranged as needed. Available Monday-Friday 0800-1600.',
  },
  {
    campus: 'wichita',
    operation: 'AMR Wichita',
    name: 'Cassandra Powell',
    credential: 'Paramedic',
    role: 'co-instructor',
    officeHours: '[WICHITA OFFICE HOURS — the one field still outstanding; it prints on the application.]',
    note: 'Confirmed with Wichita, 28 August 2026: still the Wichita instructor of record. The certificate number is not held here and is entered on the course record rather than in source.',
  },
]

/** The one instructor who signs completions. K.A.R. 109-11-8. */
export const PRIMARY_INSTRUCTOR = COURSE_STAFF.find((s) => s.role === 'primary')!

/** Kept under its old name for the printed application, which names one signer. */
export const KC_COURSE_STAFF = {
  primaryInstructor: PRIMARY_INSTRUCTOR.name,
  credential: PRIMARY_INSTRUCTOR.credential,
  email: PRIMARY_INSTRUCTOR.email,
  officeHours: PRIMARY_INSTRUCTOR.officeHours,
}

/**
 * Every site named on the application, both campuses.
 *
 * All of them are filed even where there is no intention of rotating through
 * them. Adding a site mid-course means going back to KBEMS for a new approval;
 * naming one costs nothing.
 */
export const KC_SITES: {
  name: string
  kind: 'clinical' | 'field'
  campus: Campus
  note: string
}[] = [
  {
    name: 'AdventHealth Shawnee Mission',
    kind: 'clinical',
    campus: 'kc',
    note: 'Primary Kansas City clinical site. 504-bed tertiary teaching hospital, Merriam KS. Six 12-hour shifts (72 h) of supervised patient skills, weighted away from the ED — pre-op is where the venipunctures are.',
  },
  {
    name: 'AdventHealth South Overland Park',
    kind: 'clinical',
    campus: 'kc',
    note: 'Second active campus under the same affiliation agreement. Overflow capacity for the Phase 2 venipuncture block without going back for a new approval.',
  },
  {
    name: 'AdventHealth Prairie Star',
    kind: 'clinical',
    campus: 'kc',
    note: 'Covered by the same agreement and named for overflow. Not rotated through — patient volume too low to be worth a placement.',
  },
  {
    name: 'Ascension Via Christi St Francis',
    kind: 'clinical',
    campus: 'wichita',
    note: 'Wichita clinical site. Six 12-hour shifts for the Wichita students. Confirmed with Wichita, 28 August 2026.',
  },
  {
    name: 'AMR Independence',
    kind: 'field',
    campus: 'kc',
    note: 'Urban 911 response. Part of the 144 h field internship.',
  },
  {
    name: 'AMR Linn County',
    kind: 'field',
    campus: 'kc',
    note: 'Rural response. Part of the 144 h field internship — the Kansas City half of the urban/rural split.',
  },
  {
    name: 'Sedgwick County EMS',
    kind: 'field',
    campus: 'wichita',
    note: 'Urban 911 response for the Wichita students. Confirmed with Wichita, 28 August 2026.',
  },
  {
    name: 'Butler County EMS',
    kind: 'field',
    campus: 'wichita',
    note: 'Rural response for the Wichita students — the Wichita half of the urban/rural split. Confirmed with Wichita, 28 August 2026.',
  },
]

/** Sites serving one campus. Clinical and field placement is local, not pooled. */
export function sitesForCampus(campus: Campus) {
  return KC_SITES.filter((s) => s.campus === campus)
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

// ----- the course schedule (joint AMR Kansas City / AMR Wichita cohort) ------

/**
 * THE SCHEDULE IS THE OCTOBER 2026 JOINT COHORT PLAN, DATED AT SOURCE.
 *
 * Kansas City and Wichita are running ONE class. The two builds that used to
 * exist — Wichita's 2025 course approval, which Kansas City had transcribed as
 * a template, and Kansas City's own draft on top of it — are merged here into
 * a single schedule that both primary instructors have agreed to.
 *
 * Transcribed from AEMT_Course_Oct2026_Cohort.docx: Tuesday 6 October 2026
 * through Thursday 4 February 2027, Tuesdays and Thursdays 09:00-13:00, with
 * the two AHA provider courses pulled out onto Saturdays.
 *
 * WHAT CHANGED, AND WHY IT IS NOT A GENERATED CALENDAR ANY MORE.
 *
 * The previous version held sixteen undated course weeks and laid them onto
 * Tuesdays and Thursdays at seed time, pushing any face-to-face week that
 * collided with a holiday into the next clear week — which extended the course
 * past sixteen calendar weeks and moved every later date with it. The joint
 * plan does the opposite, deliberately: the holidays are ABSORBED rather than
 * fought, and the resulting calendar is the agreement.
 *
 *   - Thanksgiving (Thu 26 Nov) is surrendered. Week 8 is a single Tuesday
 *     session, and ACLS moves out to Saturday 5 December.
 *   - A deliberate two-week break, 21 Dec - 3 Jan, replaces four sessions that
 *     would have been half empty. Christmas Eve, Christmas Day, New Year's Eve
 *     and New Year's Day all fall inside it.
 *   - MLK Day (Mon 18 Jan) and Presidents' Day (Mon 15 Feb) never touch a
 *     Tuesday or a Thursday.
 *
 * So no session needs pushing, and a planner that pushed them would break the
 * agreed dates. Every row below carries its own date and the plan is a
 * transcription, not a projection. `buildClassPlan` still exists and still
 * returns `PlannedSession[]`, because everything downstream reads that shape —
 * but it now reads the dates rather than computing them.
 *
 * TWO DEFECTS IN THE SOURCE, both recorded rather than silently smoothed:
 *
 *   1. Week 15 is filed "D 6 / L 4" — ten hours in a week that has two
 *      four-hour sessions in it. Every other full week in the document sums to
 *      eight and the week 15 sessions are described as one didactic day and
 *      one lab day, so it is filed here as D 4 / L 4. With that correction the
 *      sixteen weeks sum to exactly 15 x 8 + 4 = 124 face-to-face hours, which
 *      is the arithmetic the rest of the document assumes.
 *
 *   2. The summary line reads "approximately 66 face-to-face didactic + 40
 *      independent pre-class = ~106 didactic". Its own rows sum to 72 didactic
 *      and its own Navigate module run times sum to 35.6 — 107.6 in total, so
 *      the ~106 is close and the 66/40 split inside it is not. The rows are
 *      filed. The document itself says to tune the split to whatever totals go
 *      to KBEMS, since the sequencing is what matters; scripts/check-course-
 *      plan.mjs reports the distance so it stays visible.
 *
 * ONE DEFECT FIXED, because the source document asks for it by name. Wichita's
 * filing assigned chapters 17 and 18 in two different weeks. §10 of the joint
 * plan lists "the prior schedule listed Chapters 17 and 18 in two different
 * weeks" among the things to fix before submission, and this schedule assigns
 * every chapter of the fourth edition exactly once.
 */

/**
 * How a session reaches the student.
 *
 * `f2f`        — Tuesday/Thursday 09:00-13:00 class. Costs instructor time and
 *                room time, and is what the eight-hour weekly cap is about.
 * `assignment` — Navigate modules, flashcards, practice activities and the AHA
 *                pre-course work, done by the student on their own.
 * `aha`        — an AHA provider course: a Saturday, eight hours, taught to
 *                AHA's curriculum rather than ours and certificated by them.
 *                Counted in its own bucket because the joint plan counts it
 *                that way ("plus 52 lab and 16 hours of AHA courses"), and
 *                because it is the one thing on the calendar that legitimately
 *                exceeds four hours in a day.
 */
export type Delivery = 'f2f' | 'assignment' | 'aha'

export interface ScheduleRow {
  order: number
  /**
   * Instructional week, 1-16. The two AHA Saturdays and the winter break carry
   * the week they sit alongside; `standalone` marks them as not part of that
   * week's Tuesday/Thursday pair.
   */
  week: number
  /** Row label as the joint plan writes it. */
  label: string
  /** Two or three words, for a calendar chip. */
  short: string
  /** What the session covers, as agreed. */
  title: string
  delivery: Delivery
  didacticHours: number
  labHours: number
  /**
   * The date this row is delivered on. Dated at source — the joint plan is a
   * calendar both instructors signed up to, not a shape to be laid down later.
   */
  date: string
  /** Clock times for anything sat in a room. Assignments carry none. */
  startTime?: string
  endTime?: string
  /**
   * Unpaid break inside the clock span, in minutes.
   *
   * The AHA provider courses run 08:00-17:00 and are eight instructional
   * hours: nine on the clock, one of them lunch. Filing 16:00 to make the
   * arithmetic work would tell a student the course ends an hour before it
   * does, on the schedule they plan their Saturday around — so the break is
   * declared instead, and the validator subtracts it.
   */
  breakMinutes?: number
  /** Textbook chapters the row assigns. */
  chapters?: number[]
  /** Kansas AEMT Education Standards codes the row covers. */
  sections?: string[]
  /** Graded or gating event this row carries. See data/aemtAssessments.ts. */
  assessmentIds?: string[]
  /**
   * Psychomotor skill sheets checked off in this session. Ids from
   * data/aemtSkills.ts.
   *
   * This is what makes the skills record and the schedule the same object.
   * Without it the two drift silently: a sheet the course carries but never
   * teaches is a check-off nobody can do, and a lab that teaches something with
   * no sheet is a competency with no evidence behind it. check-skills.mjs
   * asserts both directions.
   */
  sheetIds?: string[]
  /**
   * Skills the session teaches that the course deliberately does NOT check off,
   * each with the reason.
   *
   * Almost always BLS carry-forward: an incoming AEMT student holds a current
   * EMT certification and uses these on every shift, so re-checking them is not
   * what this course is for. Recorded rather than left implicit, because "no
   * sheet for the bag-valve mask" reads as an oversight until someone writes
   * down that it is a decision.
   */
  taughtNotChecked?: string[]
  /**
   * Not one of the week's Tuesday/Thursday sessions — a Saturday AHA course or
   * the winter break block. Excluded from the eight-hour weekly cap check,
   * which is about the Tue/Thu pattern.
   */
  standalone?: boolean
  /**
   * On the calendar for information, not as scheduled contact time.
   *
   * The winter break and the week 16 remediation block both carry zero hours
   * deliberately — one is a fortnight of clinical shifts and dated TestPrep,
   * the other is per-student work with no common figure. Both are worth seeing
   * on a schedule, and neither is a class. Marked rather than inferred from
   * `hours === 0`, because a session that SHOULD carry hours and has none is a
   * filing error the validator has to keep catching.
   */
  informational?: boolean
  /** Why this row is shaped the way it is, where that is not obvious. */
  note?: string
}

const AM = '09:00'
const PM = '13:00'

export const KC_SCHEDULE: ScheduleRow[] = [
  // ----- before the course starts -------------------------------------------
  {
    order: 0,
    week: 0,
    label: 'Pre-course · due before 6 October',
    short: 'Pre-course Ch 1-4',
    title:
      'REQUIRED BEFORE THE FIRST SESSION. Navigate Modules 1-4 (Ch 1-4): EMS Systems (PR1); Research (PR2); Workforce Safety & Wellness (PR3); Documentation (PR4); EMS Systems Communication (PR5); Therapeutic Communication (PR6); Medical/Legal & Ethical (PR7). Chapter flashcards and practice activities, plus the chapter quizzes.',
    delivery: 'assignment',
    didacticHours: 3.3,
    labHours: 0,
    date: '2026-09-29',
    chapters: [1, 2, 3, 4],
    sections: ['PR1', 'PR2', 'PR3', 'PR4', 'PR5', 'PR6', 'PR7'],
    standalone: true,
    note: 'Moved out of week 1 by decision. These four chapters are the ones an incoming EMT already works inside every shift — systems, safety, medical-legal, documentation and communication — so a classroom day spent re-covering them buys the least of any day in the course. Completing them before 6 October means the first session opens on medical terminology and the course is into A&P by its second day. The trade is that this is now a prerequisite with a completion gate, not a suggestion: a student who arrives having skipped it is behind on the week 1 quiz, which is cumulative from day one.',
  },

  // ----- week 1 -------------------------------------------------------------
  {
    order: 1,
    week: 1,
    label: 'Week 1 pre-class',
    short: 'Modules 5, 7',
    title:
      'Navigate Module 5 (Ch 5) Medical Terminology (PR9); Module 7 (Ch 7) The Human Body / Anatomy & Physiology (PR8).',
    delivery: 'assignment',
    didacticHours: 1.9,
    labHours: 0,
    date: '2026-10-06',
    chapters: [5, 7],
    sections: ['PR9', 'PR8'],
  },
  {
    order: 2,
    week: 1,
    label: 'Week 1 · Tue',
    short: 'Orientation & terminology',
    title:
      'Orientation, kept short. How the AEMT cognitive exam actually works: 135 items, linear, no backtracking, all six item types. Baseline 50-item diagnostic. Study-methods brief: why re-reading fails. Then straight into medical terminology — prefixes, suffixes and roots drilled as the vocabulary every later domain is written in.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2026-10-06',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['baseline'],
    note: 'The pre-course block is confirmed complete here. A student who has not done it is identified on day one rather than at the first quiz.',
  },
  {
    order: 3,
    week: 1,
    label: 'Week 1 · Thu',
    short: 'A&P',
    title:
      'A&P built on a perfusion and cellular-respiration spine — the oxygen delivery chain end to end. Pulled forward from week 2 by the pre-course block.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2026-10-08',
    startTime: AM,
    endTime: PM,
  },

  // ----- week 2 -------------------------------------------------------------
  {
    order: 4,
    week: 2,
    label: 'Week 2 pre-class',
    short: 'Modules 8-9',
    title:
      'Navigate Modules 8-9 (Ch 8-9): Pathophysiology (PR10); Life Span Development (PR11).',
    delivery: 'assignment',
    didacticHours: 1.1,
    labHours: 0,
    date: '2026-10-13',
    chapters: [8, 9],
    sections: ['PR10', 'PR11'],
  },
  {
    order: 5,
    week: 2,
    label: 'Week 2 · Tue',
    short: 'Pathophysiology',
    title:
      'Pathophysiology: shock states, acid-base, hypoxia vs. hypoxaemia. Life span development where it changes the assessment. Drag-and-drop drill: classify findings by shock type.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2026-10-13',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['quiz-a'],
  },
  {
    order: 6,
    week: 2,
    label: 'Week 2 · Thu',
    short: 'Clinical judgment',
    title:
      'CLINICAL JUDGMENT FOUNDATION. The six-step cycle taught explicitly as its own content — recognize cues → analyze cues → define hypothesis → generate solutions → take action → evaluate — then drilled against worked cases. All six NREMT item formats introduced and practised: multiple-response, build-list, drag-and-drop, options box, capnography graphics.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2026-10-15',
    startTime: AM,
    endTime: PM,
    note: 'The session the pre-course block paid for. Clinical Judgment is 31-35% of the certification exam and the prior course gave it no dedicated instruction at all — it was absorbed into generic review days. This is where the recovered day went, rather than into compressing the course, because every gate date after it is a commitment to Wichita and to KBEMS.',
  },

  // ----- week 3 -------------------------------------------------------------
  {
    order: 7,
    week: 3,
    label: 'Week 3 pre-class',
    short: 'Modules 10, 6',
    title:
      'Navigate Module 10 (Ch 10) Patient Assessment — Scene Size-Up (PA1); Primary Assessment (PA2); Secondary Assessment (PA4); Monitoring Devices (PA5); Reassessment (PA6). Module 6 (Ch 6) Lifting & Moving.',
    delivery: 'assignment',
    didacticHours: 1.8,
    labHours: 0,
    date: '2026-10-20',
    chapters: [10, 6],
    sections: ['PA1', 'PA2', 'PA4', 'PA5', 'PA6'],
  },
  {
    order: 8,
    week: 3,
    label: 'Week 3 · Tue',
    short: 'Assessment',
    title:
      'The patient assessment framework laid onto the six-step clinical judgment cycle taught in week 2. Scene size-up, primary and secondary assessment, monitoring devices and reassessment, each named as the step of the cycle it belongs to.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2026-10-20',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['quiz-b'],
  },
  {
    order: 9,
    week: 3,
    label: 'Week 3 · Thu',
    short: 'Assessment lab',
    title:
      'LAB: full patient assessments checked off end to end, monitoring devices, lifting and moving skill drills. Every debrief uses the six-step language taught in week 2.',
    delivery: 'f2f',
    didacticHours: 0,
    labHours: 4,
    date: '2026-10-22',
    startTime: AM,
    endTime: PM,
    note: 'Patient-assessment check-off. Grants the assessment clearance that opens Phase 1 of the rotation.',
    sheetIds: ['patient-assessment', 'glucometer'],
    taughtNotChecked: [
      'Lifting and moving — stair chair and power stretcher. BLS carry-forward: the student is credentialed on both and uses them every shift.',
      'The cardiac monitor, introduced as a monitoring device. NOT checked off here — the sheet covers the whole unit including 12-lead acquisition, and ECG is not taught until week 6. Signing it off in week 3 would date the check-off three weeks before the lab that grants the ECG clearance.',
    ],
  },

  // ----- week 4 -------------------------------------------------------------
  {
    order: 10,
    week: 4,
    label: 'Week 4 pre-class',
    short: 'Module 11',
    title:
      'Navigate Module 11 (Ch 11) Airway Management — Airway Management (AM1); Respiration (AM2); Artificial Ventilation (AM3). Skill Drill presentations.',
    delivery: 'assignment',
    didacticHours: 1.5,
    labHours: 0,
    date: '2026-10-27',
    chapters: [11],
    sections: ['AM1', 'AM2', 'AM3'],
  },
  {
    order: 11,
    week: 4,
    label: 'Week 4 · Tue',
    short: 'Airway',
    title:
      'Airway, respiration, ventilation. Capnography waveform interpretation drilled as a graphical item type.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2026-10-27',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['quiz-c'],
  },
  {
    order: 12,
    week: 4,
    label: 'Week 4 · Thu',
    short: 'Airway lab · GATE 1',
    title:
      'LAB: supraglottic airway, BVM, suction, oxygen delivery. Skill Evaluation Sheets. GATE 1 exam, final 90 minutes.',
    delivery: 'f2f',
    didacticHours: 0,
    labHours: 4,
    date: '2026-10-29',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['gate-1'],
    sheetIds: ['supraglottic-airways-igel'],
    taughtNotChecked: [
      'Bag-valve mask and oxygen delivery. BLS carry-forward — the AEMT addition is the supraglottic airway, which is checked off.',
      'Portable suction. BLS carry-forward; the sheet exists in the workbook and is available if a student needs remediation.',
    ],
  },

  // ----- week 5 -------------------------------------------------------------
  {
    order: 13,
    week: 5,
    label: 'Week 5 pre-class',
    short: 'Modules 12-13',
    title:
      'Navigate Modules 12-13 (Ch 12-13): Principles of Pharmacology (PR13); Medication Administration (PR14); Emergency Medications (PR15); Vascular Access.',
    delivery: 'assignment',
    didacticHours: 1.2,
    labHours: 0,
    date: '2026-11-03',
    chapters: [12, 13],
    sections: ['PR13', 'PR14', 'PR15'],
  },
  {
    order: 14,
    week: 5,
    label: 'Week 5 · Tue',
    short: 'Pharmacology',
    title:
      'Pharmacology principles; the AEMT formulary cold; dose calculation drills under time pressure.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2026-11-03',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['quiz-d'],
  },
  {
    order: 15,
    week: 5,
    label: 'Week 5 · Thu',
    short: 'Vascular access lab',
    title:
      'LAB: IV, IO, IM/SubQ and nebulized administration. Begin logging K.A.R. 109-11-8 counts on day one of lab.',
    delivery: 'f2f',
    didacticHours: 0,
    labHours: 4,
    date: '2026-11-05',
    startTime: AM,
    endTime: PM,
    note: 'Vascular-access check-off. Venipuncture, IO and IM/SubQ reps dated before this are refused — see data/aemtPhases.ts.',
    sheetIds: ['iv-start', 'ez-io', 'im-subq-injection', 'nebulized-treatment'],
  },

  // ----- week 6 -------------------------------------------------------------
  {
    order: 16,
    week: 6,
    label: 'Week 6 pre-class',
    short: 'Modules 14-16',
    title:
      'Navigate Modules 14-16 (Ch 14-16): Shock and Resuscitation (ST1); BLS Resuscitation; Medical Overview (MT1); Public Health (PR12); Infectious Disease (MT5).',
    delivery: 'assignment',
    didacticHours: 1.9,
    labHours: 0,
    date: '2026-11-10',
    chapters: [14, 15, 16],
    sections: ['ST1', 'MT1', 'PR12', 'MT5'],
  },
  {
    order: 17,
    week: 6,
    label: 'Week 6 · Tue',
    short: 'Shock',
    title:
      'Shock differentiated by type and by what the AEMT can actually do about each. Options-box drill.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2026-11-10',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['quiz-e'],
  },
  {
    order: 18,
    week: 6,
    label: 'Week 6 · Thu',
    short: 'Resuscitation lab',
    title:
      'LAB: resuscitation; first integrated scenarios combining airway, shock and vascular access.',
    delivery: 'f2f',
    didacticHours: 0,
    labHours: 4,
    date: '2026-11-12',
    startTime: AM,
    endTime: PM,
    note: 'ECG application check-off sits in this week or the next, deliberately ahead of the week 8 cardiology block — see the ECG decoupling note in the rotation plan.',
    sheetIds: ['ekg-acquisition', '@monitor'],
    taughtNotChecked: [
      'Mechanical CPR — LUCAS and AutoPulse. BLS carry-forward, and device familiarisation rather than an AEMT competency.',
    ],
  },

  // ----- week 7 -------------------------------------------------------------
  {
    order: 19,
    week: 7,
    label: 'Week 7 pre-class',
    short: 'Module 17',
    title:
      'Navigate Module 17 (Ch 17) Respiratory Emergencies (MT10). Ride-Alongs: Difficulty Breathing, Respiratory Distress.',
    delivery: 'assignment',
    didacticHours: 1,
    labHours: 0,
    date: '2026-11-17',
    chapters: [17],
    sections: ['MT10'],
  },
  {
    order: 20,
    week: 7,
    label: 'Week 7 · Tue',
    short: 'Respiratory',
    title:
      'Respiratory emergencies: pathophysiology → presentation → intervention. Differentiation drills (asthma vs. COPD vs. CHF vs. PE).',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2026-11-17',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['quiz-f'],
  },
  {
    order: 21,
    week: 7,
    label: 'Week 7 · Thu',
    short: 'Respiratory lab',
    title:
      'LAB: respiratory scenarios with capnography. CPAP check-off on the Flow-Safe II — the AEMT respiratory intervention the scenarios are built around. Clinical judgment debrief.',
    delivery: 'f2f',
    didacticHours: 0,
    labHours: 4,
    date: '2026-11-19',
    startTime: AM,
    endTime: PM,
    sheetIds: ['cpap-bipap-mask-flow-safe-ii'],
    taughtNotChecked: [
      'Capnography on the cardiac monitor. Already checked off in week 6 as part of the whole-unit sheet — this session is where the waveform gets used against a patient rather than located on a screen.',
    ],
  },

  // ----- week 8 — Thanksgiving week, Tuesday only ---------------------------
  {
    order: 22,
    week: 8,
    label: 'Week 8 pre-class',
    short: 'Module 18 · ACLS prep',
    title:
      'Navigate Module 18 (Ch 18) Cardiovascular Emergencies (MT8). AHA ACLS pre-course work, assigned over the holiday — low-cognitive-load work that survives a break.',
    delivery: 'assignment',
    didacticHours: 1,
    labHours: 0,
    date: '2026-11-24',
    chapters: [18],
    sections: ['MT8'],
    note: 'The AHA pre-course carries no separate hour figure. The joint plan does not quantify it and the provider course itself is counted in the 16-hour AHA block.',
  },
  {
    order: 23,
    week: 8,
    label: 'Week 8 · Tue',
    short: 'Cardiovascular',
    title:
      'Cardiovascular emergencies; ECG monitoring within AEMT scope. Flag explicitly what is ACLS-only and NOT testable at AEMT level.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2026-11-24',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['quiz-g'],
    note: 'No Thursday session. Thanksgiving falls on 26 November and is surrendered rather than fought; ACLS moves to Saturday 5 December to protect the Tue/Thu rhythm.',
  },

  // ----- week 9 -------------------------------------------------------------
  {
    order: 24,
    week: 9,
    label: 'Week 9 pre-class',
    short: 'Modules 19, 21',
    title:
      'Navigate Modules 19, 21 (Ch 19, 21): Neurology (MT2); Endocrine (MT6); Hematology (MT11). Ride-Along: Altered Mental Status.',
    delivery: 'assignment',
    didacticHours: 1.7,
    labHours: 0,
    date: '2026-12-01',
    chapters: [19, 21],
    sections: ['MT2', 'MT6', 'MT11'],
  },
  {
    order: 25,
    week: 9,
    label: 'Week 9 · Tue',
    short: 'GATE 2 · Neuro',
    title:
      'GATE 2 exam, first 90 minutes. Then stroke, seizure and altered mental status.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2026-12-01',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['gate-2'],
  },
  {
    order: 26,
    week: 9,
    label: 'Week 9 · Thu',
    short: 'Medical lab',
    title:
      'Diabetic and hematologic emergencies. LAB: medical scenarios interleaved with week 4-6 airway and shock material.',
    delivery: 'f2f',
    didacticHours: 0,
    labHours: 4,
    date: '2026-12-03',
    startTime: AM,
    endTime: PM,
  },

  // ----- Saturday 5 December — AHA ACLS -------------------------------------
  {
    order: 27,
    week: 9,
    label: 'Saturday 5 December',
    short: 'AHA ACLS',
    title: 'AHA ACLS Provider Course, 8 hours.',
    delivery: 'aha',
    didacticHours: 8,
    labHours: 0,
    date: '2026-12-05',
    startTime: '08:00',
    endTime: '17:00',
    breakMinutes: 60,
    standalone: true,
    note: 'Pulled out of the Tue/Thu rhythm so that Thanksgiving week does not cost the class a session. Most agencies run the AHA courses on Saturdays anyway.',
  },

  // ----- week 10 ------------------------------------------------------------
  {
    order: 28,
    week: 10,
    label: 'Week 10 pre-class',
    short: 'Modules 20, 22, 23',
    title:
      'Navigate Modules 20, 22, 23 (Ch 20, 22, 23): Abdominal & GI Disorders (MT3); Genitourinary/Renal (MT12); Immunology (MT4); Toxicology (MT9). Ride-Along: Allergic Reaction.',
    delivery: 'assignment',
    didacticHours: 1.8,
    labHours: 0,
    date: '2026-12-08',
    chapters: [20, 22, 23],
    sections: ['MT3', 'MT12', 'MT4', 'MT9'],
  },
  {
    order: 29,
    week: 10,
    label: 'Week 10 · Tue',
    short: 'GI/GU · Anaphylaxis',
    title:
      'GI and GU emergencies, anaphylaxis, toxidromes. High-yield medical content deliberately placed before the break, not after it.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2026-12-08',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['quiz-h'],
  },
  {
    order: 30,
    week: 10,
    label: 'Week 10 · Thu',
    short: 'Medical lab',
    title: 'LAB: medical scenarios; epinephrine and naloxone administration.',
    delivery: 'f2f',
    didacticHours: 0,
    labHours: 4,
    date: '2026-12-10',
    startTime: AM,
    endTime: PM,
  },

  // ----- week 11 ------------------------------------------------------------
  {
    order: 31,
    week: 11,
    label: 'Week 11 pre-class',
    short: 'Modules 25, 35',
    title:
      'Navigate Modules 25, 35 (Ch 25, 35): Gynecology (MT13); Obstetrics (SP1); Neonatal Care (SP2).',
    delivery: 'assignment',
    didacticHours: 1.5,
    labHours: 0,
    date: '2026-12-15',
    chapters: [25, 35],
    sections: ['MT13', 'SP1', 'SP2'],
  },
  {
    order: 32,
    week: 11,
    label: 'Week 11 · Tue',
    short: 'OB & GYN',
    title:
      'OB emergencies, normal and complicated delivery, neonatal resuscitation, gynecologic emergencies.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2026-12-15',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['quiz-i'],
  },
  {
    order: 33,
    week: 11,
    label: 'Week 11 · Thu',
    short: 'OB lab · Bridge quiz',
    title:
      'LAB: normal delivery and neonatal resuscitation, checked off. Close with a 30-item cumulative bridge quiz and hand out the break assignment in writing.',
    delivery: 'f2f',
    didacticHours: 0,
    labHours: 4,
    date: '2026-12-17',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['bridge'],
    sheetIds: ['childbirth-neonatal'],
  },

  // ----- winter break -------------------------------------------------------
  {
    order: 34,
    week: 11,
    label: 'Winter break · 21 Dec - 3 Jan',
    short: 'Break block',
    title:
      'NOT a pause. Concentrated clinical and field shifts — holiday call volume is high and students typically have PTO — plus three dated TestPrep retrieval sets by domain, due 26 December, 30 December and 3 January.',
    delivery: 'assignment',
    didacticHours: 0,
    labHours: 0,
    date: '2026-12-21',
    standalone: true,
    informational: true,
    assessmentIds: ['testprep-1', 'testprep-2', 'testprep-3'],
    note: 'Carries no didactic hours: the retrieval sets are TestPrep, and the shifts are counted as clinical and field internship hours, not classroom. Phase 3 of the rotation plan is this fortnight — four 12-hour field shifts, the highest-yield block in the whole rotation.',
  },

  // ----- week 12 ------------------------------------------------------------
  {
    order: 35,
    week: 12,
    label: 'Week 12 pre-class',
    short: 'Module 36 · PALS prep',
    title:
      'Navigate Module 36 (Ch 36) Pediatric Emergencies (SP3). AHA PALS pre-course work.',
    delivery: 'assignment',
    didacticHours: 1.8,
    labHours: 0,
    date: '2027-01-05',
    chapters: [36],
    sections: ['SP3'],
  },
  {
    order: 36,
    week: 12,
    label: 'Week 12 · Tue',
    short: 'Simulation #1',
    title:
      'FULL-LENGTH SIMULATION #1 — 135 items, 3 hours, proctored, exam conditions, ungraded. Doubles as the re-entry diagnostic: it measures what survived the break, with five weeks left to fix it.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2027-01-05',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['sim-1'],
  },
  {
    order: 37,
    week: 12,
    label: 'Week 12 · Thu',
    short: 'Peds · Item analysis',
    title:
      'Item analysis against the tracker. Pediatric assessment triangle; paediatric respiratory failure and shock. Peds content is integrated across every domain, not siloed.',
    delivery: 'f2f',
    didacticHours: 0,
    labHours: 4,
    date: '2027-01-07',
    startTime: AM,
    endTime: PM,
    note: 'Sim #1 item analysis drives every individualised assignment from here forward.',
  },

  // ----- Saturday 9 January — AHA PALS --------------------------------------
  {
    order: 38,
    week: 12,
    label: 'Saturday 9 January',
    short: 'AHA PALS',
    title: 'AHA PALS Provider Course, 8 hours.',
    delivery: 'aha',
    didacticHours: 8,
    labHours: 0,
    date: '2027-01-09',
    startTime: '08:00',
    endTime: '17:00',
    breakMinutes: 60,
    standalone: true,
  },

  // ----- week 13 ------------------------------------------------------------
  {
    order: 39,
    week: 13,
    label: 'Week 13 pre-class',
    short: 'Modules 26-29',
    title:
      'Navigate Modules 26-29 (Ch 26-29): Trauma Overview (ST2); Bleeding (ST3); Soft Tissue (ST7); Face & Neck (ST8).',
    delivery: 'assignment',
    didacticHours: 3.2,
    labHours: 0,
    date: '2027-01-12',
    chapters: [26, 27, 28, 29],
    sections: ['ST2', 'ST3', 'ST7', 'ST8'],
  },
  {
    order: 40,
    week: 13,
    label: 'Week 13 · Tue',
    short: 'Trauma',
    title:
      'Trauma kinematics, haemorrhage, soft-tissue and face/neck injuries. Compressed deliberately — trauma is 7-11% of the exam.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2027-01-12',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['quiz-j'],
  },
  {
    order: 41,
    week: 13,
    label: 'Week 13 · Thu',
    short: 'Trauma lab',
    title: 'LAB: haemorrhage control, wound management, trauma scenarios.',
    delivery: 'f2f',
    didacticHours: 0,
    labHours: 4,
    date: '2027-01-14',
    startTime: AM,
    endTime: PM,
    taughtNotChecked: [
      'Haemorrhage control — tourniquet, junctional tourniquet, pelvic binder. BLS carry-forward; all three sheets are in the workbook for remediation.',
      'Wound management and bandaging. BLS carry-forward.',
    ],
  },

  // ----- week 14 ------------------------------------------------------------
  {
    order: 42,
    week: 14,
    label: 'Week 14 pre-class',
    short: 'Modules 30-34',
    title:
      'Navigate Modules 30-34 (Ch 30-34): Nervous System Trauma (ST9); Chest Trauma (ST4); Abdominal & Genitourinary Trauma (ST5); Orthopedic Trauma (ST6); Environmental Emergencies (ST11); Special Considerations in Trauma (ST10); Multisystem Trauma (ST12).',
    delivery: 'assignment',
    didacticHours: 5.1,
    labHours: 0,
    date: '2027-01-19',
    chapters: [30, 31, 32, 33, 34],
    sections: ['ST9', 'ST4', 'ST5', 'ST6', 'ST11', 'ST10', 'ST12'],
  },
  {
    order: 43,
    week: 14,
    label: 'Week 14 · Tue',
    short: 'Multisystem trauma',
    title:
      'Head/spine, chest, abdominal, orthopaedic and environmental emergencies. Emphasis on multisystem decision-making, not injury taxonomy.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2027-01-19',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['quiz-k'],
  },
  {
    order: 44,
    week: 14,
    label: 'Week 14 · Thu',
    short: 'Trauma lab · GATE 3',
    title:
      'LAB: multisystem trauma scenarios; Ride-Alongs: Motorcycle Crash, Pediatric Trauma. GATE 3 exam, final 90 minutes.',
    delivery: 'f2f',
    didacticHours: 0,
    labHours: 4,
    date: '2027-01-21',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['gate-3'],
    taughtNotChecked: [
      'Splinting and spinal motion restriction. BLS carry-forward.',
    ],
  },

  // ----- week 15 ------------------------------------------------------------
  {
    order: 45,
    week: 15,
    label: 'Week 15 pre-class',
    short: 'Modules 24, 37-42',
    title:
      'Navigate Modules 24, 37-42 (Ch 24, 37-42): Psychiatric (MT7); Geriatrics (SP4); Special Challenges (SP5); Non-Traumatic Musculoskeletal Disorders (MT14); Principles of Safely Operating a Ground Ambulance (OP1); Incident Management (OP2); Multiple Casualty Incidents (OP3); Air Medical (OP4); Vehicle Extrication (OP5); Haz-Mat Awareness (OP6); Terrorism & Disaster (OP7). All three Soft-Skill Simulations.',
    delivery: 'assignment',
    didacticHours: 5.8,
    labHours: 0,
    date: '2027-01-26',
    chapters: [24, 37, 38, 39, 40, 41, 42],
    sections: [
      'MT7',
      'SP4',
      'SP5',
      'MT14',
      'OP1',
      'OP2',
      'OP3',
      'OP4',
      'OP5',
      'OP6',
      'OP7',
    ],
  },
  {
    order: 46,
    week: 15,
    label: 'Week 15 · Tue',
    short: 'Psych · Geri · Ops',
    title:
      'Psychiatric emergencies and de-escalation; geriatrics; patients with special challenges; the full EMS Operations block.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2027-01-26',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['quiz-l'],
    note: 'Filed by the joint plan as D 6 / L 4 across the week — ten hours in a week that holds two four-hour sessions. Filed here as D 4 / L 4; see the schedule header.',
  },
  {
    order: 47,
    week: 15,
    label: 'Week 15 · Thu',
    short: 'MCI · Soft skills',
    title:
      'LAB: MCI and triage tabletop. Soft-Skill Simulations debriefed as a group — direct Clinical Judgment preparation in communication and leadership.',
    delivery: 'f2f',
    didacticHours: 0,
    labHours: 4,
    date: '2027-01-28',
    startTime: AM,
    endTime: PM,
  },

  // ----- week 16 ------------------------------------------------------------
  {
    order: 48,
    week: 16,
    label: 'Week 16 pre-class',
    short: 'Remediation',
    title:
      'Individualised remediation generated from Sim #1, the gate exams and the per-student domain tracker.',
    delivery: 'assignment',
    didacticHours: 0,
    labHours: 0,
    date: '2027-02-02',
    informational: true,
    note: 'Per-student, so it carries no common hour figure. What each student is assigned comes out of their own item analysis.',
  },
  {
    order: 49,
    week: 16,
    label: 'Week 16 · Tue',
    short: 'Final exam',
    title:
      'FINAL COMPREHENSIVE EXAM — 135 items, 3 hours, proctored, blueprint-weighted, no backtracking. This is Simulation #2 and it counts toward the 80% completion threshold.',
    delivery: 'f2f',
    didacticHours: 4,
    labHours: 0,
    date: '2027-02-02',
    startTime: AM,
    endTime: PM,
    assessmentIds: ['final'],
  },
  {
    order: 50,
    week: 16,
    label: 'Week 16 · Thu',
    short: 'NREMT walkthrough',
    title:
      'Item analysis. Per-student remediation. NREMT application walkthrough, ATT, Pearson VUE scheduling, exam-day logistics.',
    delivery: 'f2f',
    didacticHours: 0,
    labHours: 4,
    date: '2027-02-04',
    startTime: AM,
    endTime: PM,
  },
]

/**
 * The work a student must finish before the first session.
 *
 * Week 0. It is not a week of the course and does not raise KC_COURSE_WEEKS;
 * it is the condition of turning up. Chapters 1-4 are the material an incoming
 * EMT already works inside every shift, so the classroom day they used to cost
 * bought less than any other day in the course. Spending it on clinical
 * judgment instead is the single largest re-allocation in this schedule.
 */
export const PRE_COURSE = KC_SCHEDULE.find((r) => r.week === 0)!

/** Chapters that must be complete before 6 October. */
export const PRE_COURSE_CHAPTERS = PRE_COURSE.chapters ?? []

/**
 * What the student is told, and what happens if they arrive without it.
 *
 * Written down because a prerequisite with no consequence is a suggestion, and
 * the whole reason this block moved out of week 1 is that the classroom time
 * was worth more elsewhere. If students can skip it, the time was not recovered
 * — it was lost.
 */
export const PRE_COURSE_POLICY = {
  dueBy: PRE_COURSE.date,
  /**
   * Built from the dates rather than written out. It carried both `dueBy` and
   * a hard-coded "before the first session on 6 October", which is two due
   * dates for one requirement and wrong for any re-dated cohort.
   */
  requirement: `Navigate Modules ${PRE_COURSE_CHAPTERS[0]}-${
    PRE_COURSE_CHAPTERS[PRE_COURSE_CHAPTERS.length - 1]
  } complete, including the chapter quizzes, by ${PRE_COURSE.date} — before the first session.`,
  checkedAt: 'Confirmed at orientation on day one, off the Navigate gradebook.',
  ifIncomplete:
    'The student attends, and completes the block inside the first week. It is recorded as a deficiency and reviewed at the week 8 checkpoint alongside their clinical tally — the cumulative retrieval quizzes start drawing on this material in week 1, so arriving without it compounds rather than staying still.',
}

/**
 * How far before the first session prerequisite work may legitimately fall.
 *
 * The pre-course block is dated before the course starts on purpose, so the
 * ordinary "outside the course dates" rule cannot apply to it — but dropping
 * the lower bound entirely means a session typed with the wrong year passes
 * silently, which is the exact case the flag was introduced to tell apart.
 * Six weeks is roughly the point at which work assigned "before the course"
 * stops being about this cohort.
 */
export const PRE_COURSE_MAX_LEAD_DAYS = 42

/** Instructional weeks the joint plan delivers. Sixteen, over eighteen calendar weeks. */
export const KC_COURSE_WEEKS = KC_SCHEDULE.reduce((n, r) => Math.max(n, r.week), 0)

/** The row's hours, whichever way it is delivered. */
export function rowHours(r: ScheduleRow): number {
  return r.didacticHours + r.labHours
}

/** Rounded to a tenth. Navigate module run times are quoted to one decimal. */
const tenth = (n: number) => Math.round(n * 10) / 10

export interface ScheduleTotals {
  /** Class didactic plus pre-class Navigate work. Excludes the AHA courses. */
  didactic: number
  /** Class lab. Excludes the AHA courses. */
  lab: number
  /** AHA provider-course hours, counted separately as the joint plan counts them. */
  aha: number
  /** didactic + lab + aha. */
  classroom: number
  weeks: number
  /** Instructor-led Tuesday/Thursday hours — what the eight-hour cap is about. */
  f2f: number
  /** Student self-study: Navigate modules, flashcards, practice activities, AHA pre-course. */
  assignment: number
  f2fWeeks: number
  /** Face-to-face didactic only, for the 66/40 split the joint plan quotes. */
  f2fDidactic: number
}

export function scheduleTotals(): ScheduleTotals {
  const sum = (f: (r: ScheduleRow) => number) => tenth(KC_SCHEDULE.reduce((n, r) => n + f(r), 0))
  const notAha = (r: ScheduleRow) => r.delivery !== 'aha'
  const didactic = sum((r) => (notAha(r) ? r.didacticHours : 0))
  const lab = sum((r) => (notAha(r) ? r.labHours : 0))
  const aha = sum((r) => (r.delivery === 'aha' ? rowHours(r) : 0))
  return {
    didactic,
    lab,
    aha,
    classroom: tenth(didactic + lab + aha),
    weeks: KC_COURSE_WEEKS,
    f2f: sum((r) => (r.delivery === 'f2f' ? rowHours(r) : 0)),
    assignment: sum((r) => (r.delivery === 'assignment' ? rowHours(r) : 0)),
    f2fWeeks: new Set(KC_SCHEDULE.filter((r) => r.delivery === 'f2f').map((r) => r.week)).size,
    f2fDidactic: sum((r) => (r.delivery === 'f2f' ? r.didacticHours : 0)),
  }
}

/**
 * What the joint plan's own summary line claims, kept beside what its rows sum
 * to. The distance between the two is reported by check-course-plan.mjs rather
 * than being reconciled away — the document says in terms to tune the didactic
 * split to whatever totals are filed, because the sequencing is the part that
 * matters.
 */
export const FILED_SUMMARY = {
  f2fDidactic: 66,
  assignment: 40,
  didactic: 106,
  lab: 52,
  aha: 16,
  clinical: 72,
  field: 144,
  source: 'AEMT_Course_Oct2026_Cohort.docx §3, hours line beneath the schedule table',
}

/** Every Kansas AEMT Education Standards code the schedule names. */
export const SCHEDULE_SECTIONS: string[] = [
  ...new Set(KC_SCHEDULE.flatMap((r) => r.sections ?? [])),
]

/** Chapters the schedule never assigns — a gap against the adopted text. */
export function unscheduledChapters(): TextbookChapter[] {
  const taught = new Set(KC_SCHEDULE.flatMap((r) => r.chapters ?? []))
  return TEXTBOOK_CHAPTERS.filter((c) => !taught.has(c.n))
}

/**
 * Chapters assigned more than once.
 *
 * Expected to be empty. Wichita's filing assigned chapters 17 and 18 in two
 * different weeks and Kansas City reproduced that duplication deliberately,
 * because the point of the old table was to match Wichita's. The joint plan
 * lists the duplication among the things to fix before submission, so it is
 * fixed here and this function now guards the fix instead of documenting the
 * defect.
 */
export function duplicatedChapters(): number[] {
  const seen = new Map<number, number>()
  for (const r of KC_SCHEDULE) for (const c of r.chapters ?? []) seen.set(c, (seen.get(c) ?? 0) + 1)
  return [...seen].filter(([, n]) => n > 1).map(([c]) => c).sort((a, b) => a - b)
}

// ----- the calendar ----------------------------------------------------------

/**
 * The shape of a class week.
 *
 * Tuesday and Thursday, 09:00-13:00. Wichita ran that pattern in 2025, Kansas
 * City adopted it, and the joint cohort keeps it — eight instructor-led hours a
 * week is a budget constraint both operations are working inside. The two AHA
 * Saturdays are the deliberate exception and are marked `standalone`.
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
 * Days the program does not meet, and what the schedule does about each.
 *
 * This list used to drive the calendar: a face-to-face week landing on any of
 * these was pushed a week later and the course extended. The joint plan absorbs
 * them instead, by decision, so the list is now a record of how each one is
 * handled rather than an input to a planner. `holidayOn` still answers "is this
 * date a holiday" for the calendar view, and check-course-plan.mjs still
 * asserts that no session lands on one.
 */
export const KC_HOLIDAYS: { date: string; name: string; absorbedBy: string }[] = [
  {
    date: '2026-11-26',
    name: 'Thanksgiving Day',
    absorbedBy: 'Week 8 runs Tuesday only. ACLS moves to Saturday 5 December.',
  },
  {
    date: '2026-11-27',
    name: 'Day after Thanksgiving',
    absorbedBy: 'Not a class day.',
  },
  { date: '2026-12-24', name: 'Christmas Eve', absorbedBy: 'Inside the winter break.' },
  { date: '2026-12-25', name: 'Christmas Day', absorbedBy: 'Inside the winter break.' },
  { date: '2026-12-31', name: "New Year's Eve", absorbedBy: 'Inside the winter break.' },
  { date: '2027-01-01', name: "New Year's Day", absorbedBy: 'Inside the winter break.' },
  {
    date: '2027-01-18',
    name: 'Martin Luther King Jr. Day',
    absorbedBy: 'A Monday. Does not touch the Tuesday/Thursday pattern.',
  },
  {
    date: '2027-02-15',
    name: "Presidents' Day",
    absorbedBy: 'A Monday, and after the 4 February course end.',
  },
]

const HOLIDAY_BY_DATE = new Map(KC_HOLIDAYS.map((h) => [h.date, h.name]))

export function holidayOn(iso: string): string | undefined {
  return HOLIDAY_BY_DATE.get(iso)
}

/** The winter break, as a closed date range. */
export const WINTER_BREAK = {
  start: '2026-12-21',
  end: '2027-01-03',
  note: 'Concentrated clinical and field shifts plus three dated TestPrep retrieval sets. Phase 3 of the rotation plan.',
}

export interface PlannedSession {
  /** ISO date. */
  date: string
  /** Instructional week, 1-16. Zero for the pre-course block. */
  week: number
  /** Calendar week from the first class date, 1-based. */
  calendarWeek: number
  kind: 'didactic' | 'lab' | 'aha'
  delivery: Delivery
  hours: number
  rowOrder: number
  title: string
  short: string
  /** Only rows sat in a room carry clock times. */
  startTime?: string
  endTime?: string
  /** Unpaid break inside the clock span, in minutes. */
  breakMinutes?: number
  /** On the calendar for information; carries no contact hours by design. */
  informational?: boolean
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

function daysBetween(fromISO: string, toISO: string): number {
  const [ay, am, ad] = fromISO.split('-').map(Number)
  const [by, bm, bd] = toISO.split('-').map(Number)
  const a = new Date(ay, am - 1, ad).getTime()
  const b = new Date(by, bm - 1, bd).getTime()
  return Math.round((b - a) / 86_400_000)
}

/**
 * The whole course as dated sessions.
 *
 * A transcription now, not a projection. Every row already carries the date
 * both instructors agreed to, so this reads them rather than laying an undated
 * shape onto a weekday pattern.
 *
 * `startISO` re-dates a LATER COHORT running the same shape: the offset is
 * rounded to whole weeks so Tuesdays stay Tuesdays and the Saturdays stay
 * Saturdays. It is not a way to nudge this cohort — the holidays this calendar
 * absorbs are specific to autumn 2026, and a shifted plan has to be re-checked
 * against its own year's holidays. `holidayCollisions` is what answers that.
 */
export function buildClassPlan(startISO: string = KC_START_DATE): PlannedSession[] {
  const shiftDays = Math.round(daysBetween(KC_START_DATE, startISO) / 7) * 7
  const out: PlannedSession[] = []

  for (const r of [...KC_SCHEDULE].sort((a, b) => a.order - b.order)) {
    const date = shiftDays === 0 ? r.date : addDaysISO(r.date, shiftDays)
    const calendarWeek = Math.floor(daysBetween(startISO, date) / 7) + 1
    const base = {
      date,
      week: r.week,
      calendarWeek,
      delivery: r.delivery,
      rowOrder: r.order,
      title: r.title,
      short: r.short,
      startTime: r.startTime,
      endTime: r.endTime,
      breakMinutes: r.breakMinutes,
      informational: r.informational,
    }
    // An AHA row's hours are AHA hours, whichever column they were written in.
    // Bucketing them as didactic is what made the seeded calendar report
    // sixteen hours more didactic than the course had filed.
    const segments: { kind: 'didactic' | 'lab' | 'aha'; hours: number }[] = (
      r.delivery === 'aha'
        ? [{ kind: 'aha' as const, hours: rowHours(r) }]
        : [
            { kind: 'didactic' as const, hours: r.didacticHours },
            { kind: 'lab' as const, hours: r.labHours },
          ]
    ).filter((s) => s.hours > 0)

    // A row with no hours is still a thing on the calendar — the winter break
    // and the week 16 remediation block both matter to whoever is reading it,
    // and dropping them would make the schedule lie about what the fortnight
    // between 17 December and 5 January is for.
    if (segments.length === 0) segments.push({ kind: 'didactic', hours: 0 })

    for (const seg of segments) out.push({ ...base, kind: seg.kind, hours: seg.hours })
  }
  return out
}

const CLASS_PLAN = buildClassPlan()

/** Calendar weeks the course occupies. Eighteen, for sixteen instructional weeks. */
export const KC_CALENDAR_WEEKS = CLASS_PLAN.reduce((n, s) => Math.max(n, s.calendarWeek), 0)

/** Last dated session. Thursday 4 February 2027. */
export const KC_END_DATE = CLASS_PLAN.reduce((d, s) => (s.date > d ? s.date : d), KC_START_DATE)

/**
 * Sessions that fall on a listed holiday.
 *
 * Empty for the filed calendar — that is the whole design, and the check script
 * asserts it. It stops being empty the moment someone re-dates the plan for a
 * later cohort, which is exactly when somebody needs to be told.
 */
export function holidayCollisions(
  startISO: string = KC_START_DATE,
): { date: string; holiday: string; label: string }[] {
  const out: { date: string; holiday: string; label: string }[] = []
  const seen = new Set<string>()
  for (const s of buildClassPlan(startISO)) {
    if (s.delivery === 'assignment') continue
    const h = holidayOn(s.date)
    if (!h || seen.has(s.date)) continue
    seen.add(s.date)
    out.push({ date: s.date, holiday: h, label: s.short })
  }
  return out
}

/**
 * The schedule row a skill sheet is checked off in.
 *
 * Returns the ROW, not a date. It used to re-date the plan for a given cohort
 * and hand back a `plannedDate`, which was a second implementation of
 * `buildClassPlan`'s arithmetic and a second thing to keep true — and it still
 * lied to a course with a hand-built schedule, because the filed plan says
 * "Week 5 · Thu" whether or not that course has one. The caller matches this
 * row against the course's own sessions and shows nothing when there is no
 * match, which is the honest answer.
 *
 * `@monitor` in a row's `sheetIds` stands for whichever cardiac monitor the
 * operation runs, because the joint cohort runs two and a student is checked
 * off on their own. Pass the course's monitor id to resolve it.
 */
export function sessionForSheet(
  sheetId: string,
  monitorSheetId?: string,
): ScheduleRow | undefined {
  // `@monitor` is a placeholder, not a sheet. Without this guard, passing the
  // literal string resolves to the row that contains it, which is the one way
  // this function could confidently answer a question about nothing.
  if (sheetId === '@monitor') return undefined
  return KC_SCHEDULE.find((r) =>
    (r.sheetIds ?? []).some(
      (id) => id === sheetId || (id === '@monitor' && sheetId === monitorSheetId),
    ),
  )
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
 * The hour totals the joint cohort files.
 *
 * Derived from the schedule rather than typed, so the filed target and the
 * schedule built from it cannot disagree. That is the failure this guards
 * against, and both source documents have shown it: Wichita's filing summed to
 * 116 didactic under a summary line reading 110, and the joint plan's own rows
 * sum to 72 face-to-face didactic under a summary line reading ~66. The rows
 * win, in both cases, because the schedule is what KBEMS reviews against.
 *
 * The AHA provider courses are their own line. They are sixteen instructor-led
 * hours, but they are AHA's curriculum on AHA's certificate, and the joint plan
 * counts them apart from the 106 didactic and 52 lab — so this does too.
 */
export const KC_HOUR_TARGETS: HourTarget[] = [
  {
    id: 'didactic',
    label: 'Didactic',
    hours: scheduleTotals().didactic,
    note: `${scheduleTotals().f2fDidactic} h face-to-face plus ${scheduleTotals().assignment} h of Navigate modules, flashcards, practice activities and AHA pre-course work.`,
  },
  {
    id: 'lab',
    label: 'Lab / psychomotor',
    hours: scheduleTotals().lab,
    note: 'All face-to-face. Minimum 2 instructors required on lab days.',
  },
  {
    id: 'aha',
    label: 'AHA provider courses',
    hours: scheduleTotals().aha,
    note: 'ACLS Saturday 5 December and PALS Saturday 9 January, 8 h each. Pulled onto Saturdays so Thanksgiving week does not cost the class a session.',
  },
  {
    id: 'clinical',
    label: 'Hospital clinical',
    hours: 72,
    note: '6 x 12-hour shifts. AdventHealth Kansas City for the Kansas City students, Ascension Via Christi St Francis for the Wichita students.',
  },
  {
    id: 'field',
    label: 'Field internship',
    hours: 144,
    note: '12 x 12-hour shifts. AMR Independence and AMR Linn County for Kansas City; Sedgwick County EMS and Butler County EMS for Wichita. Urban and rural in both markets.',
  },
]

/** Hospital clinical hours the program schedules. */
export const KC_CLINICAL_TARGET = 72

/** Field internship hours, both ambulance services combined. */
export const KC_FIELD_TARGET = 144

/**
 * Classroom time — didactic, lab and the AHA provider courses.
 *
 * Includes the assignment hours: the "~106 didactic" figure the joint plan
 * quotes counts Navigate pre-class work alongside classroom time. Instructor-led
 * Tuesday/Thursday time is the smaller `scheduleTotals().f2f`, and that is the
 * number the eight-hour weekly cap applies to.
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


// ----- course policy ---------------------------------------------------------

/** Missing more than this many hours of scheduled class time fails the course. */
export const MAX_ABSENT_HOURS = 8

/**
 * The make-up mechanism that keeps the absence cap from being a trapdoor.
 *
 * §10 of the joint plan asks for this by name, and the reasoning is arithmetic:
 * a six-student cohort running straight through respiratory season cannot
 * absorb an absolute cap. One bout of influenza is two missed sessions, which
 * is the whole eight hours, which ends a student's course — and with six
 * students that is roughly seventeen points off the pass rate for something
 * nobody chose.
 *
 * So the cap stands as the trigger, not the verdict. Past it, the student
 * demonstrates equivalent competency on the missed material and the
 * demonstration is documented. That is defensible to KBEMS in a way that
 * "attended every hour" is not, because it is a claim about competence rather
 * than attendance.
 */
export const ABSENCE_MAKEUP = {
  triggerHours: MAX_ABSENT_HOURS,
  requirement:
    'Documented equivalent-competency demonstration on the missed material, scheduled within 14 days of the missed session and signed by the primary instructor.',
  note: 'Recorded against the student, not waived. A make-up that is not documented is an absence.',
}

export const MIN_PASSING_PERCENT = 80

/**
 * K.A.R. 109-11-8 requires the PRIMARY INSTRUCTOR to verify in writing that
 * the student completed the course, within 15 days of the final class session
 * and before the student sits the certification examination. A program manager
 * signing in their place does not satisfy it.
 */
export const INSTRUCTOR_VERIFICATION_DAYS = 15

/**
 * The revised grading model, from §9 of the joint plan.
 *
 * WHAT CHANGED AND WHY. The model this replaces put the entire graded weight
 * on untimed online work — 60% online exams, 40% online quizzes and homework.
 * That measures a student's ability to search the eBook. The certification
 * exam measures retrieval under time pressure with no way to go back, and
 * nothing in the old model resembled it: zero percent of the grade was closed
 * book.
 *
 * Weights sum to 100. Lab skills and the clinical/field internship stay
 * satisfactory/unsatisfactory — K.A.R. 109-11-8 minimums are a floor to clear,
 * not a score to average.
 */
export interface GradingComponent {
  id: string
  label: string
  /**
   * A few words, for prose. The full labels carry their dates and their form,
   * which is right on a syllabus table and unreadable in a sentence — and
   * deriving one from the other by chopping the label at its first punctuation
   * produced "lab skills evaluations" for a line that also covers the clinical
   * and field internship.
   */
  short: string
  /** Percent of the course grade, or null for satisfactory/unsatisfactory. */
  weight: number | null
  rationale: string
}

export const GRADING_MODEL: GradingComponent[] = [
  {
    id: 'retrieval-quizzes',
    short: 'Weekly closed-book retrieval quizzes',
    label: 'In-class cumulative retrieval quizzes (closed book, proctored)',
    weight: 20,
    rationale:
      'New. Converts spacing and retrieval from a suggestion into a graded structure. Under the prior model zero percent of the grade was closed book.',
  },
  {
    id: 'gates',
    short: 'Three proctored gate exams',
    label: 'Gate exams — 3 (29 Oct, 1 Dec, 21 Jan), proctored, blueprint-weighted',
    weight: 35,
    rationale:
      'Replaces the untimed online exams. Blueprint-weighted so the grade reflects the certification exam rather than chapter count.',
  },
  {
    id: 'final',
    short: 'Final comprehensive exam',
    label: 'Final comprehensive exam, 2 February (135-item full-length mock)',
    weight: 25,
    rationale:
      'Trains pacing and stamina under the no-backtracking rule — a distinct skill from content mastery.',
  },
  {
    id: 'navigate',
    short: 'Navigate pre-class work',
    label: 'Navigate pre-class work: interactive lectures, practice activities, flashcards',
    weight: 10,
    rationale:
      'Down from 40%. Open-book online work measures search ability, not retrieval. Kept for accountability, not for grade weight.',
  },
  {
    id: 'scenario',
    short: 'Scenario and clinical judgment rubric',
    label: 'Scenario / clinical judgment rubric',
    weight: 10,
    rationale:
      'New. Clinical Judgment is 31-35% of the certification exam and the largest single domain; it deserves a graded line. Scored against the six-step cycle.',
  },
  {
    id: 'lab-clinical',
    short: 'Lab skills, clinical and field internship',
    label: 'Lab skills evaluations · clinical and field internship',
    weight: null,
    rationale:
      'Unchanged. K.A.R. 109-11-8 minimums still apply and are a floor, not a score.',
  },
]

/** Sums to 100 across the weighted components. Asserted by check-course-plan.mjs. */
export const GRADING_WEIGHT_TOTAL = GRADING_MODEL.reduce((n, c) => n + (c.weight ?? 0), 0)

/** Legacy shape, kept so the printed syllabus table renders unchanged. */
export const GRADING = GRADING_MODEL.map((c) => ({
  label: c.label,
  weight: c.weight === null ? 'Satisfactory / Unsatisfactory' : `${c.weight}%`,
}))

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
    offsetDays: -45,
    anchor: 'first-session',
    basis: 'program',
    note: 'KBEMS sets no deadline for this — the date is a CES planning target, two weeks ahead of the approval filing. It is separate because none of it is same-day work: it depends on the instructors themselves and on whoever maintains the service roster, and the course cannot be submitted until all of it is done. For the joint cohort it covers BOTH markets: the Wichita instructor and lab instructors have to be Instructional Staff on this course too, not just on Wichita’s own. STATUS 28 August 2026: every instructor is on the personnel roster in the Kansas portal. The Instructional Staff assignment is a separate step in the portal and is the one still to confirm — see below.',
    prerequisites: [
      'Every instructor is set up as INSTRUCTIONAL STAFF. This is the step people think the roster covers and it does not: a personnel-roster entry makes someone visible to the service, and only the Instructional Staff assignment makes them selectable on a course. Finalize is what surfaces the gap, on the day of filing.',
      'Both markets’ instructors are attached to THIS course, not only to their own operation.',
      'Every instructor has a Kansas Licensure system account of their own.',
      'Every instructor appears on the service personnel roster — done, 28 August 2026.',
    ],
  },
  {
    id: 'clinical-prerequisites',
    label: 'Close the prerequisites the approval application depends on',
    offsetDays: -35,
    anchor: 'first-session',
    basis: 'program',
    note: 'None of this is same-day work and all of it blocks the filing. A CES planning target set ahead of the approval deadline so the items that need another person to act have somewhere to fail early rather than on the day of filing.',
    prerequisites: [
      'Medical director signature.',
      'Letters or contracts from the ambulance service directors and the clinical facility administrators — for both markets.',
      'Instructor-of-record and lab-instructor roster, both markets.',
      'Written KBEMS answer on whether lab-simulated intraosseous infusion satisfies K.A.R. 109-11-8(a)(4). The answer changes what the clinical section of the application says, so it has to come before the application, not after it.',
      'Navigate Fourth Edition course shell built: modules assigned by week, practice activities released, TestPrep configured, gradebook weighted to the revised model.',
      'Hospital student onboarding started — badging, EHR access, immunisation verification and background checks commonly run four to six weeks at a 504-bed teaching hospital. Waiting for the course start slips Phase 2 and everything downstream of it.',
    ],
  },
  {
    id: 'course-approval',
    label: 'Submit Request for Initial Course Approval',
    offsetDays: -30,
    anchor: 'first-session',
    basis: 'kbems',
    note: 'THE SINGLE ITEM THAT CAN SINK THE COHORT. K.A.R. 109-11-1a(c) requires the application in the board office no later than 30 calendar days before the first session. For a 6 October start that is Sunday 6 September, and the Monday after it is Labor Day — so the practical deadline is Friday 4 September 2026. Filed through the KBEMS Licensing Portal: Manage → Add a New Course, course type "Initial". Save & Continue holds a draft; Finalize and Confirm Course Creation is what actually files it, and students cannot be enrolled before that.',
    prerequisites: [
      'Filed by an Instructor-Coordinator. No other role can create or finalize a course, so this cannot be delegated to whoever is free that day.',
      'Course schedule uploaded. Finalize is blocked without it.',
      'CV uploaded for every instructor who is not EMS-certified, including Allied Health instructors and the Medical Director. Finalize is blocked without it.',
      'Instructor setup complete (see above) — instructors who are not Instructional Staff cannot be attached to the course.',
      'Every clinical and field site named, including the second AdventHealth campus and the Wichita sites, even where there is no intention of rotating through them. Adding a site mid-course means going back for a new approval.',
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
