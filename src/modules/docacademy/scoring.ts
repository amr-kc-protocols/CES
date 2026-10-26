import type { Question, RubricDomainId, Track, TrainingCase } from '../../data/docAcademy/types'
import { EXAM_PASS_PCT } from '../../data/docAcademy/questions'
import { LEADERSHIP_IDS, RUBRIC } from '../../data/docAcademy/lessons'

// ---------------------------------------------------------------------------
// Deterministic scoring for the Documentation Academy. Pure functions only, so
// scripts/check-doc-academy.mjs can hold the pass rules to the brief without a
// browser. Free text is never scored here — a human reviewer does that.
// ---------------------------------------------------------------------------

export type Answers = Record<string, string[]>

export interface ExamResult {
  correct: number
  total: number
  pct: number
  passed: boolean
  missed: string[]
  missedCritical: string[]
  byDomain: Record<string, { correct: number; total: number }>
}

function sameSet(a: string[] = [], b: string[] = []): boolean {
  return a.length === b.length && a.every((x) => b.includes(x))
}

export function scoreExam(form: Question[], answers: Answers, passPct = EXAM_PASS_PCT): ExamResult {
  const byDomain: ExamResult['byDomain'] = {}
  const missed: string[] = []
  const missedCritical: string[] = []
  let correct = 0
  for (const q of form) {
    const d = (byDomain[q.domain] ??= { correct: 0, total: 0 })
    d.total++
    if (sameSet(answers[q.id], q.correctChoiceIds)) {
      correct++
      d.correct++
    } else {
      missed.push(q.id)
      if (q.criticalConcept) missedCritical.push(q.id)
    }
  }
  const total = form.length
  const pct = total ? Math.round((correct / total) * 1000) / 10 : 0
  // Integer comparison, so 24/30 is exactly 80% and passes.
  const passed = total > 0 && correct * 100 >= passPct * total
  return { correct, total, pct, passed, missed, missedCritical, byDomain }
}

export interface CaseLabResult {
  found: string[]
  missedIssues: string[]
  wrongPicks: string[]
  /** The case's answer depends on a policy nobody has supplied. */
  clarificationNeeded: boolean
}

/**
 * Practice feedback for the chart-review lab. Not part of completion: it tells
 * the learner what they found, missed, and wrongly flagged.
 */
export function scoreCaseLab(c: TrainingCase, picked: string[]): CaseLabResult {
  const expected = c.expectedIssues.map((i) => i.id)
  return {
    found: expected.filter((id) => picked.includes(id)),
    missedIssues: expected.filter((id) => !picked.includes(id)),
    wrongPicks: c.distractors.map((d) => d.id).filter((id) => picked.includes(id)),
    clarificationNeeded: (c.pendingSourceIds ?? []).length > 0,
  }
}

export type DomainScore = 0 | 1 | 2 | 'na'

export interface PracticalInput {
  scores: Partial<Record<RubricDomainId, DomainScore>>
  /** Required for every domain marked not applicable. */
  naJustification: Partial<Record<RubricDomainId, string>>
  criticalErrors: { id: string; resolved: boolean }[]
}

export interface PracticalResult {
  applicable: number
  maxPoints: number
  earned: number
  pct: number
  complete: boolean
  unjustifiedNa: RubricDomainId[]
  unresolvedCritical: string[]
  passed: boolean
}

export const PRACTICAL_PASS_PCT = 85

export function scorePractical(input: PracticalInput): PracticalResult {
  let applicable = 0
  let earned = 0
  let complete = true
  const unjustifiedNa: RubricDomainId[] = []
  for (const d of RUBRIC) {
    const s = input.scores[d.id]
    if (s === undefined) {
      complete = false
      continue
    }
    if (s === 'na') {
      if (!input.naJustification[d.id]?.trim()) unjustifiedNa.push(d.id)
      continue
    }
    applicable++
    earned += s
  }
  const maxPoints = applicable * 2
  const pct = maxPoints ? Math.round((earned / maxPoints) * 1000) / 10 : 0
  const unresolvedCritical = input.criticalErrors.filter((e) => !e.resolved).map((e) => e.id)
  const passed =
    complete &&
    maxPoints > 0 &&
    unjustifiedNa.length === 0 &&
    unresolvedCritical.length === 0 &&
    earned * 100 >= PRACTICAL_PASS_PCT * maxPoints
  return { applicable, maxPoints, earned, pct, complete, unjustifiedNa, unresolvedCritical, passed }
}

export function needsLeadership(track: Track): boolean {
  return track !== 'learner'
}

export interface CompletionInput {
  track: Track
  examPassed: boolean
  practicalPassed: boolean
  lessonsDone: string[]
  coachingApprovedBy?: string
  auditPlanApprovedBy?: string
}

/** What still stands between this learner and "Internal training completed". */
export function completionGaps(i: CompletionInput): string[] {
  const gaps: string[] = []
  if (!i.examPassed) gaps.push('Pass the common-core exam (80%)')
  if (!i.practicalPassed) gaps.push('Pass the reviewer-scored practical (85%, no unresolved critical error)')
  if (needsLeadership(i.track)) {
    const left = LEADERSHIP_IDS.filter((id) => !i.lessonsDone.includes(id))
    if (left.length) gaps.push(`Complete the leadership practicum (${left.join(', ')})`)
    if (!i.coachingApprovedBy?.trim()) gaps.push('Reviewer approval of one coaching response')
    if (!i.auditPlanApprovedBy?.trim()) gaps.push('Reviewer approval of one audit/remediation plan')
  }
  return gaps
}

const fnv = (s: string) => [...s].reduce((a, ch) => Math.imul(a ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261)

/**
 * The order each question's choices are shown in. Authored order put the right
 * answer at b or c almost every time, which a test-wise learner reads off the
 * page. Questions are taken in a stable shuffled order and their correct
 * answer dealt round-robin to each screen position, so the key is spread
 * evenly however the form is edited, and a reload shows the same order.
 */
export function displayOrders(form: Question[]): Record<string, Question['choices']> {
  const out: Record<string, Question['choices']> = {}
  const dealt = [...form].sort((a, b) => fnv(a.id) - fnv(b.id))
  dealt.forEach((q, i) => {
    const right = q.choices.filter((c) => q.correctChoiceIds.includes(c.id))
    const rest = q.choices.filter((c) => !q.correctChoiceIds.includes(c.id)).sort((a, b) => fnv(q.id + a.id) - fnv(q.id + b.id))
    if (right.length !== 1) {
      out[q.id] = [...right, ...rest].sort((a, b) => fnv(q.id + a.id) - fnv(q.id + b.id))
      return
    }
    const at = i % q.choices.length
    out[q.id] = [...rest.slice(0, at), right[0], ...rest.slice(at)]
  })
  return out
}
