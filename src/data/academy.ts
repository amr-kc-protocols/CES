import type { Credential, TraineePhase } from '../types'

// ---------------------------------------------------------------------------
// New Hire Academy curriculum as it shipped (spec §3 domain 3 / §6 Module D).
//
// Every hire gets the general AMR block. Kansas City paramedics additionally
// get the interfacility critical-care specialization block (ventilator
// management, vasopressor & sedative infusions).
//
// These lists are now the STARTING POINT for an operation's checklist, not
// the checklist itself. Who needs what, and what a transfer may waive, is in
// the operation's NEOP — see src/modules/academy/program.ts, which builds
// Kansas City's and Wichita's shipped programs from exactly these lists.
// ---------------------------------------------------------------------------

export interface AcademyModule {
  id: string
  label: string
  block: 'general' | 'kc-medic'
}

export const GENERAL_MODULES: AcademyModule[] = [
  { id: 'stretcher', label: 'Safe stretcher operation', block: 'general' },
  { id: 'evoc', label: 'EVOC (emergency vehicle operations)', block: 'general' },
  { id: 'report_writing', label: 'Report writing (ImageTrend)', block: 'general' },
  { id: 'hr', label: 'HR onboarding', block: 'general' },
  { id: 'osha', label: 'OSHA compliance training', block: 'general' },
  { id: 'cornerstone', label: 'Cornerstone LMS modules', block: 'general' },
]

export const KC_MEDIC_MODULES: AcademyModule[] = [
  { id: 'vent', label: 'Ventilator management', block: 'kc-medic' },
  { id: 'infusions', label: 'Vasopressor & sedative infusions', block: 'kc-medic' },
]

/** Academy runs ~1.5 weeks (spec); default cohort length in calendar days. */
export const ACADEMY_LENGTH_DAYS = 10

export const PHASE_LABELS: Record<TraineePhase, string> = {
  academy: 'Academy',
  fto: 'FTO rides',
  released: 'Released',
}

export const CREDENTIAL_LABELS: Record<Credential, string> = {
  emt: 'EMT',
  aemt: 'AEMT',
  paramedic: 'Paramedic',
}
