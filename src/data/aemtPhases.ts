// ---------------------------------------------------------------------------
// The clinical plan: what a student is cleared to do, and when they do it.
//
// Two things live here because they interlock. A phase says what part of the
// rotation a date falls in and what the student should have accumulated by the
// end of it; a skill clearance says what the student is permitted to touch at
// all. Phase 2 is "skill acquisition" precisely because the week 5 lab is where
// vascular access gets signed off — the phase means nothing without the
// clearance, and the clearance has nowhere to point without the phase.
//
// The distinction that matters when reading this file: phase windows are
// ADVISORY and clearances are ENFORCED. A student who picks up an extra shift
// in the middle of Phase 2 should be able to log it, and the app should not
// argue. A student who logs a venipuncture dated before anyone watched them
// perform one is making a claim the program cannot support, and that is
// refused.
//
// Nothing here is hardcoded into a screen. Phases are seeded onto the course
// record from day offsets, so a cohort with different dates re-seeds rather
// than being edited into source.
// ---------------------------------------------------------------------------

import { addDays } from '../lib/date'
import { WINTER_BREAK } from './aemt'
import type { AemtClinicalPhase, SkillClearanceCode } from '../types'

// ----- skill clearances ------------------------------------------------------

/**
 * A permission granted at a lab check-off, dated.
 *
 * `gates` names the counted requirements that cannot be logged before the
 * grant date. An empty `gates` is deliberate rather than an oversight: the
 * assessment clearance is recorded because Phase 1 requires it, but it is not
 * used to refuse counts. K.A.R. sets no such bar, and refusing a documented
 * assessment because a lab date was typed in late would delete evidence the
 * program actually holds. Vascular access and ECG are different — those are
 * invasive or interpretive skills the affiliation agreement and the syllabus
 * both put behind a check-off, and a rep claimed before one is not defensible.
 */
export interface SkillClearance {
  code: SkillClearanceCode
  label: string
  /** Requirement ids from data/aemt.ts that this clearance gates. */
  gates: string[]
  /** Where it is granted, for the instructor reading the grant screen. */
  grantedAt: string
  /** Why it is or is not enforced, shown next to the grant. */
  note: string
}

export const SKILL_CLEARANCES: SkillClearance[] = [
  {
    code: 'assessment',
    label: 'Patient assessment',
    gates: [],
    grantedAt: 'Week 3–4 lab check-off',
    note: 'Required to enter Phase 1. Recorded, but does not refuse counts — a documented assessment is evidence whether or not the lab date was entered first.',
  },
  {
    code: 'vascular',
    label: 'Vascular access & medication administration',
    gates: ['venipuncture', 'io', 'injection'],
    grantedAt: 'Week 5 lab check-off',
    note: 'Enforced. Venipuncture, IO and IM/SubQ reps dated before this are refused.',
  },
  {
    code: 'ecg',
    label: 'ECG application & interpretation',
    gates: ['ecg'],
    grantedAt: 'Week 5–6 lab check-off — deliberately ahead of the week 8 cardiology block',
    note: 'Enforced. ECG reps dated before this are refused.',
  },
]

const GATED_BY = new Map<string, SkillClearance>()
for (const c of SKILL_CLEARANCES) for (const r of c.gates) GATED_BY.set(r, c)

/** Which clearance a requirement sits behind, if any. */
export function clearanceGating(requirementId: string): SkillClearance | undefined {
  return GATED_BY.get(requirementId)
}

export function skillClearance(code: SkillClearanceCode): SkillClearance | undefined {
  return SKILL_CLEARANCES.find((c) => c.code === code)
}

// ----- clinical phases -------------------------------------------------------

/**
 * Which counted thing a phase target refers to. Requirement ids from
 * data/aemt.ts, plus the two sub-counts that are not requirements in their own
 * right: the ten venipunctures that must initiate an infusion, and the ten
 * assessments that must happen in the field.
 */
export type PhaseTargetKey =
  | 'venipuncture'
  | 'infusion'
  | 'io'
  | 'injection'
  | 'nebulizer'
  | 'ecg'
  | 'assessment'
  | 'assessmentField'
  | 'calls'
  | 'pcr'

export const PHASE_TARGET_LABELS: Record<PhaseTargetKey, string> = {
  venipuncture: 'Venipunctures',
  infusion: '…initiating an infusion',
  io: 'IO infusions',
  injection: 'IM / SubQ injections',
  nebulizer: 'Nebulized treatments',
  ecg: 'ECG application',
  assessment: 'Patient assessments',
  assessmentField: '…in the field',
  calls: 'Supervised ambulance calls',
  pcr: 'Patient care reports',
}

/**
 * The phase plan, as offsets from the course start date.
 *
 * Offsets rather than dates so that seeding a cohort that starts on a different
 * Tuesday produces the same shape without anyone editing this file. The gap
 * between Phase 2 ending on day 73 and Phase 3 starting on day 76 is the
 * weekend before the break block, and it is deliberate — a date landing in a
 * gap simply belongs to no phase, which is the truth.
 */
export interface PhaseTemplate {
  ordinal: number
  name: string
  startOffsetDays: number
  endOffsetDays: number
  requiresClearance: SkillClearanceCode | null
  shiftsRequired: number
  hospitalShifts: number
  fieldShifts: number
  targets: Partial<Record<PhaseTargetKey, number>>
}

export const PHASE_TEMPLATE: PhaseTemplate[] = [
  {
    ordinal: 0,
    name: 'No clinical',
    startOffsetDays: 0,
    endOffsetDays: 19,
    requiresClearance: null,
    shiftsRequired: 0,
    hospitalShifts: 0,
    fieldShifts: 0,
    targets: {},
  },
  {
    ordinal: 1,
    name: 'Assessment & documentation',
    startOffsetDays: 20,
    endOffsetDays: 33,
    requiresClearance: 'assessment',
    shiftsRequired: 2,
    hospitalShifts: 0,
    fieldShifts: 2,
    targets: { assessment: 4, pcr: 2, calls: 2 },
  },
  {
    ordinal: 2,
    name: 'Skill acquisition',
    startOffsetDays: 34,
    endOffsetDays: 73,
    requiresClearance: 'vascular',
    shiftsRequired: 7,
    hospitalShifts: 4,
    fieldShifts: 3,
    targets: {
      venipuncture: 16,
      infusion: 8,
      injection: 10,
      ecg: 6,
      nebulizer: 1,
      assessment: 3,
      pcr: 2,
      calls: 2,
    },
  },
  {
    ordinal: 3,
    name: 'Break block',
    startOffsetDays: 76,
    endOffsetDays: 89,
    requiresClearance: null,
    shiftsRequired: 4,
    hospitalShifts: 0,
    fieldShifts: 4,
    targets: { assessmentField: 5, pcr: 3, calls: 6 },
  },
  {
    ordinal: 4,
    name: 'Integration & team lead',
    startOffsetDays: 90,
    endOffsetDays: 122,
    requiresClearance: null,
    shiftsRequired: 5,
    hospitalShifts: 2,
    fieldShifts: 3,
    targets: { assessment: 3, pcr: 3 },
  },
]

/** Total shifts the plan expects. The 18 every projection is measured against. */
export const PLANNED_SHIFTS = PHASE_TEMPLATE.reduce((n, p) => n + p.shiftsRequired, 0)

/**
 * Materialise the plan against a course's start date.
 *
 * Called on seeding and on re-seeding. The result is stored on the course, so
 * an instructor who moves a window because a site changed its availability
 * keeps that edit until they deliberately re-seed.
 */
/**
 * The break phase is the WINTER BREAK, not a day-count that happened to land on
 * it once.
 *
 * Phase 3 exists because there is no class for a fortnight — that is the whole
 * reason it can carry four concentrated field shifts. It was expressed as an
 * offset from the course start, which was true of the cohort it was written
 * for and quietly stopped being true the moment the start date moved and the
 * holidays did not: phase 3 drifted to 27 December while the break stayed on
 * 21 December, so a plan built from it would have told students to run
 * concentrated shifts through a week when class had resumed.
 *
 * So phases 3 and 4 are anchored to the break instead, and phase 2 ends where
 * the break begins. Only phases 0 to 2 are counted from day one, which is what
 * they are actually about — how long before a student is cleared to do
 * anything.
 */
function windowFor(p: PhaseTemplate, startDate: string): { start: string; end: string } {
  const breakStart = WINTER_BREAK.start
  const breakEnd = WINTER_BREAK.end
  if (p.ordinal === 3) return { start: breakStart, end: breakEnd }
  if (p.ordinal === 4) {
    return { start: addDays(breakEnd, 1), end: addDays(startDate, p.endOffsetDays) }
  }
  if (p.ordinal === 2) {
    // Ends the Friday before the break: the weekend between belongs to
    // neither, which is true and better than pretending one of them owns it.
    return { start: addDays(startDate, p.startOffsetDays), end: addDays(breakStart, -3) }
  }
  return {
    start: addDays(startDate, p.startOffsetDays),
    end: addDays(startDate, p.endOffsetDays),
  }
}

export function seedPhases(startDate: string): AemtClinicalPhase[] {
  return PHASE_TEMPLATE.map((p) => ({
    ordinal: p.ordinal,
    name: p.name,
    windowStart: windowFor(p, startDate).start,
    windowEnd: windowFor(p, startDate).end,
    requiresClearance: p.requiresClearance,
    shiftsRequired: p.shiftsRequired,
    hospitalShifts: p.hospitalShifts,
    fieldShifts: p.fieldShifts,
    targets: { ...p.targets },
  }))
}

// ----- deficit checkpoints ---------------------------------------------------

/**
 * Five dated reviews of the skill tally, anchored to the didactic gates.
 *
 * The reasoning is arithmetic and unsentimental. Eighteen shifts across roughly
 * fourteen usable weeks is about 1.3 shifts a week per student, and a student
 * who is one shift behind in November is four behind in January — by which
 * point the only slack left is the two reserve hospital shifts. So the tally is
 * read on fixed dates and a student below the floor gets an added shift ASSIGNED
 * that week, not a conversation in January.
 *
 * These are floors, not targets. Being at the floor is not comfortable; it is
 * the line below which the rotation stops being recoverable. And a shortfall
 * that is site availability rather than the student is escalated to the site
 * immediately — that one has a long lead time and no late fix.
 *
 * Offsets rather than dates, for the same reason the phases use them: a cohort
 * starting on a different Tuesday re-seeds rather than being edited into source.
 */
export interface DeficitCheckpoint {
  id: string
  /** Days from the course start date. */
  offsetDays: number
  /** The didactic event this review is tied to, so it is never a standalone diary entry. */
  courseAnchor: string
  /** Shifts that should be logged by this date. */
  shiftsFloor: number
  /** Cumulative floors on the counted requirements. */
  floors: Partial<Record<PhaseTargetKey, number>>
  /** Clearances that should be signed off by this date. */
  clearances?: SkillClearanceCode[]
  /**
   * Every K.A.R. minimum should be complete by here. Listed keys are the
   * exceptions — at Gate 3 the assessments are still accumulating and only
   * hours remain.
   */
  allMinimumsExcept?: PhaseTargetKey[]
  actionIfBelow: string
}

export const DEFICIT_CHECKPOINTS: DeficitCheckpoint[] = [
  {
    id: 'wk7',
    offsetDays: 42,
    courseAnchor: 'Week 7 — the last class before Thanksgiving',
    shiftsFloor: 3,
    floors: { venipuncture: 6, assessment: 2, pcr: 2, calls: 2 },
    clearances: ['ecg'],
    actionIfBelow:
      'Assign one added shift before 5 December. If the shortfall is site availability rather than the student, escalate to the site now — that is a lead-time problem and it does not fix itself.',
  },
  {
    id: 'wk10',
    offsetDays: 66,
    courseAnchor: 'Week 10 — the last class before the winter break',
    shiftsFloor: 9,
    floors: {
      venipuncture: 16,
      injection: 10,
      ecg: 6,
      nebulizer: 1,
      assessment: 7,
      pcr: 4,
      calls: 4,
    },
    actionIfBelow:
      'Add shifts into the break block. This is the last window with real slack in it — 48 hours inside 14 days, no class competing for the time, and holiday call volume is high.',
  },
  {
    id: 'wk12',
    offsetDays: 94,
    courseAnchor: 'Week 12 — the class after Simulation #1',
    shiftsFloor: 13,
    floors: { venipuncture: 20, infusion: 10, assessment: 12, pcr: 7, calls: 10 },
    actionIfBelow:
      'The venipuncture requirement should be closed here. If it is not, the two reserve hospital shifts go to this student.',
  },
  {
    id: 'wk14',
    offsetDays: 108,
    courseAnchor: 'Week 14 — Gate 3',
    shiftsFloor: 16,
    floors: {},
    allMinimumsExcept: ['assessment', 'assessmentField'],
    actionIfBelow:
      'A student still missing a skill minimum at Gate 3 is at serious risk of an incomplete. Formal progress conference, documented.',
  },
  {
    id: 'end',
    offsetDays: 122,
    courseAnchor: 'Week 16 — the last class day',
    shiftsFloor: 18,
    floors: {},
    allMinimumsExcept: [],
    actionIfBelow:
      'Incomplete clinical or field hours means an incomplete course, which means the student is not eligible for the ATT. There is no exception available at this point.',
  },
]

/** The checkpoints as dates, against a course's start. */
export function checkpointDates(startDate: string): (DeficitCheckpoint & { date: string })[] {
  return DEFICIT_CHECKPOINTS.map((c) => ({ ...c, date: addDays(startDate, c.offsetDays) }))
}

/**
 * The floors a checkpoint imposes, with `allMinimumsExcept` expanded.
 *
 * Expanded rather than special-cased at the call site: "all minimums met" and
 * "20 venipunctures, 10 IV initiations, 5 IOs…" are the same claim, and a
 * caller that had to know which form a checkpoint used would get one of them
 * wrong.
 */
export function checkpointFloors(
  c: DeficitCheckpoint,
  minimums: { id: string; minimum: number; fieldMinimum?: number; subRequirement?: { minimum: number } }[],
): Partial<Record<PhaseTargetKey, number>> {
  const out: Partial<Record<PhaseTargetKey, number>> = { ...c.floors }
  if (c.allMinimumsExcept) {
    const skip = new Set<string>(c.allMinimumsExcept)
    for (const r of minimums) {
      if (skip.has(r.id)) continue
      out[r.id as PhaseTargetKey] = r.minimum
      if (r.subRequirement && !skip.has('infusion')) out.infusion = r.subRequirement.minimum
      if (r.fieldMinimum && r.id === 'assessment' && !skip.has('assessmentField')) {
        out.assessmentField = r.fieldMinimum
      }
    }
  }
  return out
}

/**
 * Where the departments that actually produce each skill are.
 *
 * Used by the projection alerts, which are a later stage — but it is seed data,
 * and the point of it is that "you are short on venipunctures" is useless while
 * "you are short on venipunctures, book pre-op" is an instruction. Kept here so
 * the alert has somewhere to read from the moment it is built.
 */
export const SKILL_DEPARTMENTS: Record<PhaseTargetKey, string[]> = {
  venipuncture: ['Pre-op / same-day surgery', 'ED'],
  infusion: ['Pre-op / same-day surgery'],
  io: ['ED'],
  injection: ['PACU', 'Infusion center', 'Med-surg'],
  nebulizer: ['ED', 'Respiratory therapy'],
  ecg: ['ED', 'PACU'],
  assessment: ['ED', 'Field'],
  assessmentField: ['Field'],
  calls: ['Field'],
  pcr: ['Field'],
}
