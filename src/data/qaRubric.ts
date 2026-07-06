import type { RubricCriterion, CriterionStatus } from '../types'

// ---------------------------------------------------------------------------
// Default QA rubric for patient care report (PCR) review.
//
// NOTE (spec §8, open question 4): Hunter's existing QA rubric was not provided
// in a structured form. This is a sensible EMS PCR default derived from common
// documentation-quality domains, designed to be edited/replaced once the real
// rubric is confirmed. Each criterion carries a weight; critical items are the
// clinical-safety anchors. KC-only items cover interfacility critical care.
// ---------------------------------------------------------------------------

export const QA_RUBRIC: RubricCriterion[] = [
  {
    id: 'dispatch',
    label: 'Dispatch & response times documented',
    category: 'Documentation',
    weight: 1,
  },
  {
    id: 'cc_hpi',
    label: 'Chief complaint and history of present illness documented',
    category: 'Assessment',
    weight: 2,
    critical: true,
  },
  {
    id: 'vitals',
    label: 'Complete vital sets, appropriate frequency for acuity',
    category: 'Assessment',
    weight: 2,
    critical: true,
    help: 'At least two sets; more for higher acuity or after interventions.',
  },
  {
    id: 'exam',
    label: 'Physical exam / assessment findings documented',
    category: 'Assessment',
    weight: 2,
  },
  {
    id: 'impression',
    label: 'Clinical impression supported by findings',
    category: 'Clinical Judgment',
    weight: 2,
    critical: true,
  },
  {
    id: 'interventions',
    label: 'Interventions documented with times',
    category: 'Treatment',
    weight: 2,
    critical: true,
  },
  {
    id: 'meds',
    label: 'Medications: dose, route, time, and reassessment',
    category: 'Treatment',
    weight: 2,
    critical: true,
    help: 'Every med has a documented indication and post-administration reassessment.',
  },
  {
    id: 'protocol',
    label: 'Care consistent with protocol / medical direction',
    category: 'Clinical Judgment',
    weight: 2,
    critical: true,
  },
  {
    id: 'reassess',
    label: 'Reassessment and response to treatment documented',
    category: 'Treatment',
    weight: 2,
  },
  {
    id: 'transport',
    label: 'Transport decision and destination appropriate',
    category: 'Disposition',
    weight: 1,
  },
  {
    id: 'handoff',
    label: 'Transfer of care / handoff documented with receiving provider',
    category: 'Disposition',
    weight: 1,
    critical: true,
  },
  {
    id: 'narrative',
    label: 'Narrative complete, professional, and internally consistent',
    category: 'Documentation',
    weight: 1,
  },
  // ----- KC interfacility critical-care items -----
  {
    id: 'vent',
    label: 'Ventilator settings and changes documented',
    category: 'Critical Care',
    weight: 2,
    critical: true,
    operations: ['kc'],
    help: 'Mode, rate, Vt, PEEP, FiO2 and any titration with times.',
  },
  {
    id: 'infusions',
    label: 'Vasopressor / sedative infusions: concentration, rate, titration',
    category: 'Critical Care',
    weight: 2,
    critical: true,
    operations: ['kc'],
  },
]

/** Points awarded per status, as a fraction of the criterion weight. */
export const STATUS_POINTS: Record<CriterionStatus, number | null> = {
  met: 1,
  partial: 0.5,
  not_met: 0,
  na: null, // excluded from the denominator
}

export const STATUS_LABELS: Record<CriterionStatus, string> = {
  met: 'Met',
  partial: 'Partial',
  not_met: 'Not met',
  na: 'N/A',
}

export function rubricForOperation(op: string): RubricCriterion[] {
  return QA_RUBRIC.filter((c) => !c.operations || c.operations.includes(op as never))
}

/**
 * Weighted percentage across scored (non-N/A) criteria.
 * Returns 0 when nothing scorable has been entered yet.
 */
export function computeScore(
  scores: Record<string, CriterionStatus>,
  criteria: RubricCriterion[],
): number {
  let earned = 0
  let possible = 0
  for (const c of criteria) {
    const status = scores[c.id]
    if (!status) continue
    const pts = STATUS_POINTS[status]
    if (pts === null) continue // N/A excluded
    earned += pts * c.weight
    possible += c.weight
  }
  if (possible === 0) return 0
  return Math.round((earned / possible) * 100)
}

/** A review is "low" (coaching candidate) below this weighted percentage. */
export const LOW_SCORE_THRESHOLD = 80
