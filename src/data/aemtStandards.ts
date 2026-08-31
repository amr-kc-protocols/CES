// ---------------------------------------------------------------------------
// The Kansas AEMT Education Standards, as this course names them.
//
// K.A.R. 109-10-1c adopts the October 2014 Kansas AEMT Education Standards, and
// a course is approved partly on whether its schedule plausibly covers them.
// These 61 codes were transcribed onto the schedule from Wichita's 2025 filing
// and carried across when the two builds were merged — but they lived only
// inside the prose of each row's `title`, as "EMS Systems (PR1)".
//
// That was fine while nothing had to READ them. The curriculum document has to:
// it prints a coverage map of every standard against the dated session that
// teaches it, which is the artifact a KBEMS reviewer checks the adoption
// against. Parsing that back out of prose would mean the map silently loses a
// standard the day somebody rewords a title.
//
// So the codes are data. `SCHEDULE_SECTIONS` still derives from the schedule,
// and check-course-plan.mjs asserts the two lists agree — a code on a row with
// no entry here, or an entry no row uses, is a gap in the coverage argument.
// ---------------------------------------------------------------------------

/** The seven instructional areas the standards are grouped under. */
export const STANDARD_GROUPS: Record<string, string> = {
  PR: 'Preparatory',
  PA: 'Patient Assessment',
  AM: 'Airway Management, Respiration and Artificial Ventilation',
  MT: 'Medicine',
  ST: 'Shock and Trauma',
  SP: 'Special Patient Populations',
  OP: 'EMS Operations',
}

export interface Standard {
  /** As the filing writes it, e.g. 'PR1'. */
  code: string
  /** The two-letter group prefix; a key of STANDARD_GROUPS. */
  group: string
  label: string
}

export const STANDARDS: Standard[] = [
  { code: 'PR1', group: 'PR', label: 'EMS Systems' },
  { code: 'PR2', group: 'PR', label: 'Research' },
  { code: 'PR3', group: 'PR', label: 'Workforce Safety & Wellness' },
  { code: 'PR4', group: 'PR', label: 'Documentation' },
  { code: 'PR5', group: 'PR', label: 'EMS Systems Communication' },
  { code: 'PR6', group: 'PR', label: 'Therapeutic Communication' },
  { code: 'PR7', group: 'PR', label: 'Medical/Legal & Ethical' },
  { code: 'PR8', group: 'PR', label: 'The Human Body / Anatomy & Physiology' },
  { code: 'PR9', group: 'PR', label: 'Medical Terminology' },
  { code: 'PR10', group: 'PR', label: 'Pathophysiology' },
  { code: 'PR11', group: 'PR', label: 'Life Span Development' },
  { code: 'PR12', group: 'PR', label: 'Public Health' },
  { code: 'PR13', group: 'PR', label: 'Principles of Pharmacology' },
  { code: 'PR14', group: 'PR', label: 'Medication Administration' },
  { code: 'PR15', group: 'PR', label: 'Emergency Medications' },
  { code: 'PA1', group: 'PA', label: 'Scene Size-Up' },
  { code: 'PA2', group: 'PA', label: 'Primary Assessment' },
  { code: 'PA4', group: 'PA', label: 'Secondary Assessment' },
  { code: 'PA5', group: 'PA', label: 'Monitoring Devices' },
  { code: 'PA6', group: 'PA', label: 'Reassessment' },
  { code: 'AM1', group: 'AM', label: 'Airway Management' },
  { code: 'AM2', group: 'AM', label: 'Respiration' },
  { code: 'AM3', group: 'AM', label: 'Artificial Ventilation' },
  { code: 'MT1', group: 'MT', label: 'Medical Overview' },
  { code: 'MT2', group: 'MT', label: 'Neurology' },
  { code: 'MT3', group: 'MT', label: 'Abdominal & GI Disorders' },
  { code: 'MT4', group: 'MT', label: 'Immunology' },
  { code: 'MT5', group: 'MT', label: 'Infectious Disease' },
  { code: 'MT6', group: 'MT', label: 'Endocrine' },
  { code: 'MT7', group: 'MT', label: 'Psychiatric' },
  { code: 'MT8', group: 'MT', label: 'Cardiovascular Emergencies' },
  { code: 'MT9', group: 'MT', label: 'Toxicology' },
  { code: 'MT10', group: 'MT', label: 'Respiratory Emergencies' },
  { code: 'MT11', group: 'MT', label: 'Hematology' },
  { code: 'MT12', group: 'MT', label: 'Genitourinary/Renal' },
  { code: 'MT13', group: 'MT', label: 'Gynecology' },
  { code: 'MT14', group: 'MT', label: 'Non-Traumatic Musculoskeletal Disorders' },
  { code: 'ST1', group: 'ST', label: 'Shock and Resuscitation' },
  { code: 'ST2', group: 'ST', label: 'Trauma Overview' },
  { code: 'ST3', group: 'ST', label: 'Bleeding' },
  { code: 'ST4', group: 'ST', label: 'Chest Trauma' },
  { code: 'ST5', group: 'ST', label: 'Abdominal & Genitourinary Trauma' },
  { code: 'ST6', group: 'ST', label: 'Orthopedic Trauma' },
  { code: 'ST7', group: 'ST', label: 'Soft Tissue' },
  { code: 'ST8', group: 'ST', label: 'Face & Neck' },
  { code: 'ST9', group: 'ST', label: 'Nervous System Trauma' },
  { code: 'ST10', group: 'ST', label: 'Special Considerations in Trauma' },
  { code: 'ST11', group: 'ST', label: 'Environmental Emergencies' },
  { code: 'ST12', group: 'ST', label: 'Multisystem Trauma' },
  { code: 'SP1', group: 'SP', label: 'Obstetrics' },
  { code: 'SP2', group: 'SP', label: 'Neonatal Care' },
  { code: 'SP3', group: 'SP', label: 'Pediatric Emergencies' },
  { code: 'SP4', group: 'SP', label: 'Geriatrics' },
  { code: 'SP5', group: 'SP', label: 'Special Challenges' },
  { code: 'OP1', group: 'OP', label: 'Principles of Safely Operating a Ground Ambulance' },
  { code: 'OP2', group: 'OP', label: 'Incident Management' },
  { code: 'OP3', group: 'OP', label: 'Multiple Casualty Incidents' },
  { code: 'OP4', group: 'OP', label: 'Air Medical' },
  { code: 'OP5', group: 'OP', label: 'Vehicle Extrication' },
  { code: 'OP6', group: 'OP', label: 'Haz-Mat Awareness' },
  { code: 'OP7', group: 'OP', label: 'Terrorism & Disaster' },
]

const BY_CODE = new Map(STANDARDS.map((s) => [s.code, s]))

export function standard(code: string): Standard | undefined {
  return BY_CODE.get(code)
}

/** A code with its label, for printing. Falls back to the bare code. */
export function standardLabel(code: string): string {
  const s = BY_CODE.get(code)
  return s ? `${s.code} — ${s.label}` : code
}

/** Standards in one group, in filing order. */
export function standardsIn(group: string): Standard[] {
  return STANDARDS.filter((s) => s.group === group)
}
