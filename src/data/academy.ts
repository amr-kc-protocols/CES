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
  { id: 'osha', label: 'OSHA compliance training', block: 'general' },
  { id: 'cornerstone', label: 'Cornerstone LMS modules', block: 'general' },
]

export const KC_MEDIC_MODULES: AcademyModule[] = [
  { id: 'vent', label: 'Ventilator management', block: 'kc-medic' },
  { id: 'infusions', label: 'Vasopressor & sedative infusions', block: 'kc-medic' },
]

/**
 * Requirements that can be waived for hires transferring in from another AMR
 * operation — they've already done these there. Report writing stays (local
 * ImageTrend workflow), and the critical-care block is never waivable:
 * ventilator training is required for every paramedic coming into KC or Cass.
 */
export const WAIVABLE_MODULE_IDS = new Set(['stretcher', 'evoc', 'hr', 'osha', 'cornerstone'])

/** The checklist that applies to a given hire. */
export function curriculumFor(operation: OperationId, credential: Credential): AcademyModule[] {
  const modules = [...GENERAL_MODULES]
  if (credential === 'paramedic') {
    // Ventilator management is required for KC and Cass paramedics (not Linn);
    // the infusion block is KC's interfacility critical-care work only.
    if (operation === 'kc' || operation === 'cass') modules.push(KC_MEDIC_MODULES[0])
    if (operation === 'kc') modules.push(KC_MEDIC_MODULES[1])
  }
  return modules
}

/** Spec: release at roughly 20-30 patient contacts. */
export const RELEASE_MIN_CONTACTS = 20
export const DEFAULT_CONTACT_TARGET = 25

/**
 * Contacts needed before release. Normally the spec's 20 floor, but a lowered
 * per-trainee target (an AMR transfer with field time elsewhere) wins.
 */
export function requiredContacts(t: Trainee): number {
  return Math.min(RELEASE_MIN_CONTACTS, t.contactTarget)
}

/** Academy runs ~1.5 weeks (spec); default cohort length in calendar days. */
export const ACADEMY_LENGTH_DAYS = 10

/** A module counts when completed — or waived for an AMR transfer. */
export function moduleSatisfied(t: Trainee, moduleId: string): boolean {
  return !!t.checklist[moduleId] || !!t.waived?.[moduleId]
}

export function checklistDone(t: Trainee): boolean {
  return curriculumFor(t.operation, t.credential).every((m) => moduleSatisfied(t, m.id))
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
