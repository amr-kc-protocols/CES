import type { RubricCriterion, CriterionStatus } from '../types'

// ---------------------------------------------------------------------------
// QA rubric for patient care report (PCR) review.
//
// These are the 15 standardized chart-review questions from the Ninth Brain
// QA form (the same instrument the Chart Review Agent answers), so manual CES
// reviews and imported bot reviews score on the same scale.
//
// Two questions are phrased in reverse on the Ninth Brain form ("Were there
// any near misses…?", "Does this chart need further review…?") — here they are
// stated positively so Met is always the good answer. The Python converters
// (scripts/xlsx_to_ces.py, scripts/ces_export.py) invert them before export;
// batches must carry post-inversion values (docs/bot-bridge.md). The original
// form wording is kept in `help`.
// ---------------------------------------------------------------------------

export const QA_RUBRIC: RubricCriterion[] = [
  // ----- Assessment & Exam -----
  {
    id: 'q1',
    label: 'Physical exam documented appropriately',
    category: 'Assessment & Exam',
    weight: 1,
  },
  {
    id: 'q2',
    label: 'Patient history documented in the Patient History section',
    category: 'Assessment & Exam',
    weight: 1,
  },
  {
    id: 'q3',
    label: 'Patient appropriately monitored during transport',
    category: 'Assessment & Exam',
    weight: 1,
  },
  {
    id: 'q4',
    label: 'All crew members signed the PCR',
    category: 'Assessment & Exam',
    weight: 1,
  },
  // ----- Treatment / Procedures / Medications -----
  {
    id: 'q5',
    label: 'Actions/decisions within local standards of care / clinical practice guidelines',
    category: 'Treatment & Procedures',
    weight: 2,
    critical: true,
  },
  {
    id: 'q6',
    label: "Actions/decisions timely given the patient's condition/complaint",
    category: 'Treatment & Procedures',
    weight: 1,
  },
  {
    id: 'q7',
    label: 'All procedures documented in the appropriate PowerTools',
    category: 'Treatment & Procedures',
    weight: 1,
  },
  {
    id: 'q8',
    label: 'All medications (including those given by other caregivers) documented in the appropriate PowerTools',
    category: 'Treatment & Procedures',
    weight: 1,
  },
  // ----- Overall Evaluation -----
  {
    id: 'q9',
    label: 'Transported to an appropriate receiving facility',
    category: 'Overall Evaluation',
    weight: 1,
  },
  {
    id: 'q10',
    label: 'Mode of transport (air, ground, etc.) appropriate for patient condition',
    category: 'Overall Evaluation',
    weight: 1,
  },
  {
    id: 'q11',
    label: 'Documentation matches the documented assessments, treatments, and procedures',
    category: 'Overall Evaluation',
    weight: 1,
  },
  {
    id: 'q12',
    label: 'Documentation is clear, concise, and supports the need for ambulance transport',
    category: 'Overall Evaluation',
    weight: 1,
  },
  {
    id: 'q13',
    label: "Clinical decisions/interventions safe and appropriate for the patient's presentation",
    category: 'Overall Evaluation',
    weight: 2,
    critical: true,
  },
  {
    id: 'q14',
    label: 'No near misses, errors, or patient safety concerns to report',
    category: 'Overall Evaluation',
    weight: 2,
    critical: true,
    help: 'Ninth Brain asks this in reverse: "Were there any near misses, errors, and/or patient safety concerns that should be reported?" — a No there means Met here.',
  },
  {
    id: 'q15',
    label: 'No further review by clinical leadership needed',
    category: 'Overall Evaluation',
    weight: 1,
    help: 'Ninth Brain asks this in reverse: "Does this chart need further review by clinical leadership?" — a No there means Met here.',
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
