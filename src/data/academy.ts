import type { Credential, OperationId, Trainee, TraineePhase } from '../types'

// ---------------------------------------------------------------------------
// New Hire Academy curriculum (spec §3 domain 3 / §6 Module D).
//
// Every hire gets the general AMR block. KC paramedics additionally get the
// interfacility critical-care specialization block (ventilator management,
// vasopressor & sedative infusions).
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
]

export const KC_MEDIC_MODULES: AcademyModule[] = [
  { id: 'vent', label: 'Ventilator management', block: 'kc-medic' },
  { id: 'infusions', label: 'Vasopressor & sedative infusions', block: 'kc-medic' },
]

/** The checklist that applies to a given hire. */
export function curriculumFor(operation: OperationId, credential: Credential): AcademyModule[] {
  const modules = [...GENERAL_MODULES]
  if (operation === 'kc' && credential === 'paramedic') {
    modules.push(...KC_MEDIC_MODULES)
  }
  return modules
}

/** Spec: release at roughly 20-30 patient contacts. */
export const RELEASE_MIN_CONTACTS = 20
export const DEFAULT_CONTACT_TARGET = 25

/** Academy runs ~1.5 weeks (spec); default cohort length in calendar days. */
export const ACADEMY_LENGTH_DAYS = 10

export function checklistDone(t: Trainee): boolean {
  return curriculumFor(t.operation, t.credential).every((m) => !!t.checklist[m.id])
}

export function phaseOf(t: Trainee): TraineePhase {
  if (t.releasedDate) return 'released'
  if (checklistDone(t)) return 'fto'
  return 'academy'
}

export const PHASE_LABELS: Record<TraineePhase, string> = {
  academy: 'Academy',
  fto: 'FTO rides',
  released: 'Released',
}

export const CREDENTIAL_LABELS: Record<Credential, string> = {
  emt: 'EMT',
  paramedic: 'Paramedic',
}
