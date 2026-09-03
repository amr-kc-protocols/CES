// ---------------------------------------------------------------------------
// What Navigate actually ships, per chapter.
//
// Transcribed from the Jones & Bartlett Instructor Resource Guide for
// Advanced Emergency Care and Transportation of the Sick and Injured, Fourth
// Edition (9781284244175) — the tables at the front of the guide, not an
// estimate and not a reading of the platform.
//
// This exists so a student assignment can be SPECIFIC. "Do the Navigate work
// for chapter 11" is not an assignment; "Module 11, 87 minutes, plus the
// fourteen airway Skill Drills starting at Skill Drill 11-1 on page 569" is.
// The difference is whether a student can tell, on a Sunday evening, that they
// are finished.
//
// It is also what the pre-class hours on the schedule are built from. Those
// used to come from the October 2026 plan's per-WEEK aggregates, which meant
// splitting "3.6 hours for chapters 1-5" across five chapters by a proportion
// invented here. Two of those splits were wrong by about a quarter of an hour.
// Per-chapter run times from the publisher remove the guess.
// ---------------------------------------------------------------------------

/** One chapter's Navigate assets. */
export interface ChapterAssets {
  chapter: number
  title: string
  /** Interactive-lecture module run time, minutes. The student-facing figure. */
  moduleMinutes: number
  /** Instructor lecture-slide delivery time, minutes. Not student work. */
  lectureMinutes: number
  slides: number
  outlinePages: number
  /**
   * First page of the chapter in the printed text, and how many pages it runs.
   *
   * Read off the book's own table of contents. Module run time measures how
   * long the Navigate lecture plays; pages measure how much reading a student
   * is actually holding, and the two disagree enough to matter — chapter 5 is
   * eleven minutes of module against 36 pages of text.
   */
  startPage: number
  pages: number
}

export const CHAPTER_ASSETS: ChapterAssets[] = [
  { chapter: 1, title: 'EMS Systems', moduleMinutes: 26, lectureMinutes: 60, slides: 65, outlinePages: 24, startPage: 2, pages: 31 },
  { chapter: 2, title: 'Workforce Safety and Wellness', moduleMinutes: 57, lectureMinutes: 60, slides: 65, outlinePages: 34, startPage: 33, pages: 56 },
  { chapter: 3, title: 'Medical, Legal, and Ethical Issues', moduleMinutes: 40, lectureMinutes: 50, slides: 54, outlinePages: 31, startPage: 89, pages: 34 },
  { chapter: 4, title: 'Communications and Documentation', moduleMinutes: 82, lectureMinutes: 80, slides: 81, outlinePages: 31, startPage: 123, pages: 56 },
  { chapter: 5, title: 'Medical Terminology', moduleMinutes: 11, lectureMinutes: 25, slides: 27, outlinePages: 12, startPage: 179, pages: 36 },
  { chapter: 6, title: 'Lifting and Moving Patients', moduleMinutes: 40, lectureMinutes: 60, slides: 62, outlinePages: 29, startPage: 215, pages: 47 },
  { chapter: 7, title: 'The Human Body', moduleMinutes: 94, lectureMinutes: 145, slides: 149, outlinePages: 42, startPage: 262, pages: 105 },
  { chapter: 8, title: 'Pathophysiology', moduleMinutes: 55, lectureMinutes: 65, slides: 69, outlinePages: 22, startPage: 367, pages: 62 },
  { chapter: 9, title: 'Life Span Development', moduleMinutes: 13, lectureMinutes: 40, slides: 45, outlinePages: 16, startPage: 429, pages: 23 },
  { chapter: 10, title: 'Patient Assessment', moduleMinutes: 67, lectureMinutes: 100, slides: 102, outlinePages: 41, startPage: 452, pages: 88 },
  { chapter: 11, title: 'Airway Management', moduleMinutes: 87, lectureMinutes: 135, slides: 139, outlinePages: 41, startPage: 540, pages: 96 },
  { chapter: 12, title: 'Principles of Pharmacology', moduleMinutes: 23, lectureMinutes: 70, slides: 74, outlinePages: 32, startPage: 636, pages: 51 },
  { chapter: 13, title: 'Vascular Access and Medication Administration', moduleMinutes: 46, lectureMinutes: 125, slides: 128, outlinePages: 41, startPage: 687, pages: 79 },
  { chapter: 14, title: 'Shock', moduleMinutes: 35, lectureMinutes: 50, slides: 52, outlinePages: 19, startPage: 766, pages: 37 },
  { chapter: 15, title: 'BLS Resuscitation', moduleMinutes: 39, lectureMinutes: 60, slides: 65, outlinePages: 29, startPage: 803, pages: 51 },
  { chapter: 16, title: 'Medical Overview', moduleMinutes: 37, lectureMinutes: 50, slides: 53, outlinePages: 19, startPage: 854, pages: 27 },
  { chapter: 17, title: 'Respiratory Emergencies', moduleMinutes: 61, lectureMinutes: 105, slides: 106, outlinePages: 36, startPage: 881, pages: 58 },
  { chapter: 18, title: 'Cardiovascular Emergencies', moduleMinutes: 54, lectureMinutes: 80, slides: 84, outlinePages: 24, startPage: 939, pages: 52 },
  { chapter: 19, title: 'Neurologic Emergencies', moduleMinutes: 42, lectureMinutes: 55, slides: 59, outlinePages: 26, startPage: 991, pages: 42 },
  { chapter: 20, title: 'Gastrointestinal and Urologic Emergencies', moduleMinutes: 31, lectureMinutes: 85, slides: 89, outlinePages: 32, startPage: 1033, pages: 34 },
  { chapter: 21, title: 'Endocrine and Hematologic Emergencies', moduleMinutes: 60, lectureMinutes: 65, slides: 67, outlinePages: 28, startPage: 1067, pages: 44 },
  { chapter: 22, title: 'Immunologic Emergencies', moduleMinutes: 34, lectureMinutes: 30, slides: 32, outlinePages: 16, startPage: 1111, pages: 26 },
  { chapter: 23, title: 'Toxicology', moduleMinutes: 41, lectureMinutes: 75, slides: 80, outlinePages: 37, startPage: 1137, pages: 42 },
  { chapter: 24, title: 'Psychiatric Emergencies', moduleMinutes: 43, lectureMinutes: 35, slides: 40, outlinePages: 22, startPage: 1179, pages: 34 },
  { chapter: 25, title: 'Gynecologic Emergencies', moduleMinutes: 23, lectureMinutes: 50, slides: 51, outlinePages: 22, startPage: 1213, pages: 25 },
  { chapter: 26, title: 'Trauma Overview', moduleMinutes: 30, lectureMinutes: 40, slides: 45, outlinePages: 15, startPage: 1238, pages: 37 },
  { chapter: 27, title: 'Bleeding', moduleMinutes: 45, lectureMinutes: 30, slides: 34, outlinePages: 15, startPage: 1275, pages: 36 },
  { chapter: 28, title: 'Soft-Tissue Injuries', moduleMinutes: 60, lectureMinutes: 70, slides: 74, outlinePages: 20, startPage: 1311, pages: 44 },
  { chapter: 29, title: 'Face and Neck Injuries', moduleMinutes: 54, lectureMinutes: 70, slides: 72, outlinePages: 25, startPage: 1355, pages: 40 },
  { chapter: 30, title: 'Head and Spine Injuries', moduleMinutes: 60, lectureMinutes: 70, slides: 74, outlinePages: 27, startPage: 1395, pages: 68 },
  { chapter: 31, title: 'Chest Injuries', moduleMinutes: 61, lectureMinutes: 95, slides: 97, outlinePages: 25, startPage: 1463, pages: 38 },
  { chapter: 32, title: 'Abdominal and Genitourinary Injuries', moduleMinutes: 37, lectureMinutes: 35, slides: 40, outlinePages: 16, startPage: 1501, pages: 30 },
  { chapter: 33, title: 'Orthopaedic Injuries', moduleMinutes: 86, lectureMinutes: 125, slides: 129, outlinePages: 33, startPage: 1531, pages: 66 },
  { chapter: 34, title: 'Environmental Emergencies', moduleMinutes: 62, lectureMinutes: 125, slides: 128, outlinePages: 36, startPage: 1597, pages: 59 },
  { chapter: 35, title: 'Obstetrics and Neonatal Care', moduleMinutes: 68, lectureMinutes: 125, slides: 126, outlinePages: 28, startPage: 1656, pages: 59 },
  { chapter: 36, title: 'Pediatric Emergencies', moduleMinutes: 105, lectureMinutes: 225, slides: 229, outlinePages: 58, startPage: 1715, pages: 78 },
  { chapter: 37, title: 'Geriatric Emergencies', moduleMinutes: 107, lectureMinutes: 130, slides: 134, outlinePages: 29, startPage: 1793, pages: 54 },
  { chapter: 38, title: 'Patients With Special Challenges', moduleMinutes: 44, lectureMinutes: 55, slides: 59, outlinePages: 22, startPage: 1847, pages: 35 },
  { chapter: 39, title: 'Transport Operations', moduleMinutes: 41, lectureMinutes: 40, slides: 43, outlinePages: 20, startPage: 1882, pages: 43 },
  { chapter: 40, title: 'Vehicle Extrication, Special Rescue, and Hazardous Materials', moduleMinutes: 60, lectureMinutes: 60, slides: 65, outlinePages: 20, startPage: 1925, pages: 42 },
  { chapter: 41, title: 'Incident Management', moduleMinutes: 24, lectureMinutes: 35, slides: 37, outlinePages: 16, startPage: 1967, pages: 27 },
  { chapter: 42, title: 'Terrorism Response and Disaster Management', moduleMinutes: 31, lectureMinutes: 55, slides: 58, outlinePages: 23, startPage: 1994, pages: 33 },
]

const BY_CHAPTER = new Map(CHAPTER_ASSETS.map((c) => [c.chapter, c]))

export function chapterAssets(n: number): ChapterAssets | undefined {
  return BY_CHAPTER.get(n)
}

/**
 * Navigate module time for a set of chapters, in hours to one decimal.
 *
 * Module run time only. It does not include reading the chapter, the
 * flashcards or the practice activities, which vary by student and which no
 * publisher figure covers — so this is the floor of what a week's pre-class
 * work costs, and the assignment sheet says so rather than implying it is the
 * whole of it.
 */
export function moduleHours(chapters: number[]): number {
  const mins = chapters.reduce((n, c) => n + (BY_CHAPTER.get(c)?.moduleMinutes ?? 0), 0)
  return Math.round((mins / 60) * 10) / 10
}

/** Pages of printed text a set of chapters runs to. */
export function chapterPages(chapters: number[]): number {
  return chapters.reduce((n, c) => n + (BY_CHAPTER.get(c)?.pages ?? 0), 0)
}

/**
 * Page range for a set of chapters, as a reader would write it: "881-938".
 *
 * Contiguous runs are collapsed, because "1395-1530" is one thing to find in
 * a book and "1395-1462, 1463-1500, 1501-1530" is three.
 */
export function pageRange(chapters: number[]): string {
  const sorted = [...chapters]
    .map((c) => BY_CHAPTER.get(c))
    .filter((a): a is ChapterAssets => !!a)
    .sort((a, b) => a.startPage - b.startPage)
  if (!sorted.length) return ''
  const runs: [number, number][] = []
  for (const a of sorted) {
    const last = runs[runs.length - 1]
    if (last && last[1] === a.startPage) last[1] = a.startPage + a.pages
    else runs.push([a.startPage, a.startPage + a.pages])
  }
  return runs.map(([s, e]) => `${s}-${e - 1}`).join(', ')
}

// ----- skill drills ----------------------------------------------------------

export interface SkillDrill {
  /** As printed, e.g. '11-14'. */
  n: string
  title: string
  /** Page in the Fourth Edition. */
  page: number
}

/**
 * The Skill Drills the IRG lists for the AEMT course, by chapter.
 *
 * Only 17 of the 42 chapters carry any. An assignment that says "complete the
 * Skill Drills" for a chapter with none sends a student looking for something
 * that is not there, which is how a class learns to skim the sheet.
 */
export const SKILL_DRILLS: Record<number, SkillDrill[]> = {
  2: [
    { n: '2-1', title: 'Handwashing', page: 40 },
    { n: '2-2', title: 'Proper Glove Removal Technique', page: 41 },
    { n: '2-3', title: 'Preventing a Potential Exposure', page: 46 },
  ],
  6: [
    { n: '6-1', title: 'Performing the Power Lift', page: 220 },
    { n: '6-2', title: 'Performing a Two-Person Body Drag', page: 223 },
    { n: '6-3', title: 'Performing the Diamond Carry', page: 227 },
    { n: '6-4', title: 'Performing the One-Handed Carry', page: 229 },
    { n: '6-5', title: 'One-Person Technique for Removing an Unresponsive Patient from a Vehicle', page: 231 },
    { n: '6-6', title: 'Performing the Rapid Extrication Technique', page: 233 },
    { n: '6-7', title: 'The Direct Ground Lift', page: 236 },
    { n: '6-8', title: 'Extremity Lift', page: 237 },
    { n: '6-9', title: 'Direct Carry', page: 238 },
    { n: '6-10', title: 'Draw Sheet Method', page: 239 },
    { n: '6-11', title: 'Using a Scoop Stretcher', page: 240 },
    { n: '6-12', title: 'Lifting a Patient from the Ground', page: 241 },
    { n: '6-13', title: 'Moving a Patient from a Chair to a Stair Chair', page: 242 },
    { n: '6-14', title: 'Loading a Stretcher into an Ambulance', page: 247 },
    { n: '6-15', title: 'Using a Stair Chair', page: 251 },
    { n: '6-16', title: 'Carrying a Patient on Stairs', page: 252 },
  ],
  10: [
    { n: '10-1', title: 'Performing a Rapid Full-Body Scan', page: 483 },
    { n: '10-2', title: 'Assessing Blood Glucose Level', page: 507 },
    { n: '10-3', title: 'Performing a Full-Body Exam', page: 508 },
    { n: '10-4', title: 'Obtaining Blood Pressure by Auscultation', page: 520 },
    { n: '10-5', title: 'Obtaining Blood Pressure by Palpation', page: 521 },
  ],
  11: [
    { n: '11-1', title: 'Positioning the Unresponsive Patient', page: 569 },
    { n: '11-2', title: 'Suctioning a Patient\u2019s Airway', page: 575 },
    { n: '11-3', title: 'Inserting an Oral Airway into an Adult', page: 577 },
    { n: '11-4', title: 'Inserting an Oral Airway With a 90° Rotation', page: 577 },
    { n: '11-5', title: 'Inserting a Nasal Airway', page: 579 },
    { n: '11-6', title: 'Placing an Oxygen Cylinder Into Service', page: 584 },
    { n: '11-7', title: 'Mouth-to-Mask Ventilation', page: 592 },
    { n: '11-8', title: 'Using CPAP', page: 600 },
    { n: '11-9', title: 'Suctioning of a Stoma', page: 603 },
    { n: '11-10', title: 'Ventilating Through a Stoma Using a Resuscitation Mask', page: 605 },
    { n: '11-11', title: 'Ventilating a Stoma with a Bag-Mask Device', page: 606 },
    { n: '11-12', title: 'Inserting a King LT Airway', page: 610 },
    { n: '11-13', title: 'LMA Insertion', page: 613 },
    { n: '11-14', title: 'Inserting an i-gel Supraglottic Airway', page: 616 },
  ],
  13: [
    { n: '13-1', title: 'Spiking the Bag', page: 704 },
    { n: '13-2', title: 'Obtaining Vascular Access', page: 711 },
    { n: '13-3', title: 'Gaining IO Access With an EZ-IO Device', page: 726 },
    { n: '13-4', title: 'Drawing Medication from an Ampule', page: 738 },
    { n: '13-5', title: 'Drawing Medication from a Vial', page: 740 },
    { n: '13-6', title: 'Administering Medication via the Subcutaneous Route', page: 742 },
    { n: '13-7', title: 'Administering Medication via the IM Route', page: 745 },
    { n: '13-8', title: 'Administering Medication via the Sublingual Route', page: 746 },
    { n: '13-9', title: 'Administrating Medication via the Intranasal Route', page: 747 },
    { n: '13-10', title: 'Assisting a Patient with a Metered-Dose Inhaler', page: 750 },
    { n: '13-11', title: 'Administering a Medication via a Small-Volume Nebulizer', page: 752 },
    { n: '13-12', title: 'Administering Medication via the IV Bolus Route', page: 753 },
    { n: '13-13', title: 'Administering Medication via the IO Route', page: 754 },
  ],
  15: [
    { n: '15-1', title: 'Performing Chest Compressions', page: 814 },
    { n: '15-2', title: 'Performing One-Rescuer Adult CPR', page: 820 },
    { n: '15-3', title: 'Performing Two-Rescuer Adult CPR', page: 821 },
    { n: '15-4', title: 'Performing Infant Chest Compressions', page: 831 },
    { n: '15-5', title: 'Performing CPR on a Child', page: 832 },
    { n: '15-6', title: 'Removing a Foreign Body Airway Obstruction in an Unresponsive Child', page: 843 },
  ],
  18: [
    { n: '18-1', title: 'Administering Nitroglycerin', page: 965 },
    { n: '18-2', title: 'AED and CPR', page: 975 },
    { n: '18-3', title: 'Performing Cardiac Monitoring', page: 980 },
  ],
  22: [
    { n: '22-1', title: 'Using an EpiPen Auto-injector', page: 1127 },
  ],
  27: [
    { n: '27-1', title: 'Managing External Hemorrhage', page: 1293 },
    { n: '27-2', title: 'Packing a Wound', page: 1295 },
    { n: '27-3', title: 'Applying a Commercial Tourniquet (Combat Application Tourniquet)', page: 1297 },
    { n: '27-4', title: 'Managing Internal Hemorrhage', page: 1303 },
  ],
  28: [
    { n: '28-1', title: 'Stabilizing an Impaled Object', page: 1328 },
    { n: '28-2', title: 'Caring for Burns', page: 1340 },
  ],
  29: [
    { n: '29-1', title: 'Removing a Foreign Object From Under the Upper Eyelid', page: 1373 },
    { n: '29-2', title: 'Stabilizing a Foreign Object Impaled in the Eye', page: 1374 },
    { n: '29-3', title: 'Controlling Bleeding From a Neck Injury', page: 1387 },
  ],
  30: [
    { n: '30-1', title: 'Performing Manual In-Line Stabilization', page: 1431 },
    { n: '30-2', title: 'Application of a Cervical Collar', page: 1432 },
    { n: '30-3', title: 'Performing SMR of a Supine Adult Patient', page: 1436 },
    { n: '30-4', title: 'Using a Scoop Stretcher', page: 1440 },
    { n: '30-5', title: 'Placing a Patient on a Full-Body Vacuum Mattress', page: 1442 },
    { n: '30-6', title: 'Performing Immobilization of a Seated Adult Patient', page: 1445 },
    { n: '30-7', title: 'Removing a Helmet', page: 1449 },
  ],
  33: [
    { n: '33-1', title: 'Assessing Neurovascular Status', page: 1552 },
    { n: '33-2', title: 'Caring for Musculoskeletal Injuries', page: 1556 },
    { n: '33-3', title: 'Applying a Hare Traction Splint', page: 1560 },
    { n: '33-4', title: 'Applying a Sager Traction Splint', page: 1562 },
    { n: '33-5', title: 'Applying a Rigid Splint', page: 1564 },
    { n: '33-6', title: 'Applying a Vacuum Splint', page: 1566 },
    { n: '33-7', title: 'Splinting the Hand and Wrist', page: 1578 },
  ],
  34: [
    { n: '34-1', title: 'Treating for Heat Exhaustion', page: 1619 },
    { n: '34-2', title: 'Stabilizing a Suspected Spinal Injury in the Water', page: 1630 },
  ],
  35: [
    { n: '35-1', title: 'Delivering the Newborn', page: 1682 },
  ],
  36: [
    { n: '36-1', title: 'Positioning the Airway in a Pediatric Patient', page: 1732 },
    { n: '36-2', title: 'Inserting an Oropharyngeal Airway in a Pediatric Patient', page: 1750 },
    { n: '36-3', title: 'Inserting a Nasopharyngeal Airway in a Pediatric Patient', page: 1751 },
    { n: '36-4', title: 'One-Person Bag-Mask Device Ventilation on a Pediatric Patient', page: 1755 },
    { n: '36-5', title: 'Pediatric IO Access and Infusion', page: 1761 },
    { n: '36-6', title: 'Immobilizing a Pediatric Patient', page: 1773 },
    { n: '36-7', title: 'Immobilizing a Patient Found in a Car Seat', page: 1774 },
  ],
  38: [
    { n: '38-1', title: 'Suctioning and Cleaning a Tracheostomy Tube', page: 1864 },
  ],
}

export function skillDrills(chapters: number[]): SkillDrill[] {
  return chapters.flatMap((c) => SKILL_DRILLS[c] ?? [])
}

// ----- virtual ride-alongs ---------------------------------------------------

/**
 * The seventeen ride-along videos, and the chapter each is meant to be watched
 * alongside. Assigned by chapter rather than by name, so a week that picks up a
 * chapter picks up its video without anyone maintaining a second list.
 */
export const RIDE_ALONGS: { name: string; chapters: number[] }[] = [
  { name: 'Allergic Reaction', chapters: [22] },
  { name: 'Assault', chapters: [3] },
  { name: 'Difficulty Breathing', chapters: [17] },
  { name: 'Respiratory Distress', chapters: [17] },
  { name: 'Fall in Apartment', chapters: [37] },
  { name: 'Geriatric Altered Mental Status', chapters: [37] },
  { name: 'Altered Mental Status', chapters: [19] },
  { name: 'Mass-Casualty Incident Drill', chapters: [41] },
  { name: 'Motorcycle Crash', chapters: [30] },
  { name: 'Pediatric Trauma', chapters: [36] },
  { name: 'Psychiatric Emergency', chapters: [24] },
  { name: 'Attempted Suicide', chapters: [24] },
  { name: 'Weakness', chapters: [15] },
  { name: 'COPD', chapters: [17] },
  { name: 'Cardiac Arrest', chapters: [15] },
  { name: 'Seizure', chapters: [19] },
  { name: 'GI Bleed', chapters: [20] },
]

export function rideAlongs(chapters: number[]): string[] {
  const want = new Set(chapters)
  return RIDE_ALONGS.filter((r) => r.chapters.some((c) => want.has(c))).map((r) => r.name)
}

// ----- the soft-skill simulations --------------------------------------------

/**
 * Three conversations, one day in the life of an AEMT. The platform does not
 * report a score for them — they are affective practice, and the joint plan
 * debriefs all three as a group in week 15 as direct Clinical Judgment work.
 */
export const SOFT_SKILL_SIMULATIONS = [
  {
    n: 1,
    title: 'Communication in Critical Situations',
    summary:
      'AEMTs Alex and Sean are called to a bar where a patient has a potentially life-threatening emergency. Communicating with the patient and the partner to make the scene safe for everyone.',
  },
  {
    n: 2,
    title: 'Team Conflict Resolution',
    summary:
      'Back at the station after Conversation 1. Resolving a conflict with your partner that came out of the last call.',
  },
  {
    n: 3,
    title: 'De-escalation in the Field',
    summary:
      'A vehicle collision, and the patient\u2019s father arrives upset. De-escalating so the patient gets the best care available.',
  },
]
