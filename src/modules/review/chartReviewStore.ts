import { getState, setState, useSelector } from '../../lib/store'
import { uid } from '../../lib/id'
import { pushUndo } from '../../lib/undo'
import { todayISO } from '../../lib/date'
import {
  ALL_QUESTIONS,
  isCompliant,
  isScored,
  question,
  REVIEW_SECTIONS,
  visibleQuestions,
  type ReviewQuestion,
  type ReviewType,
} from '../../data/chartReview'
import { buildXlsx, type Sheet } from '../../lib/xlsx'
import type { ChartNarrative, ChartReviewEntry } from '../../types'

// ---------------------------------------------------------------------------
// Chart review records, the running tally, and the workbook export.
//
// The tally is the reason this is a store rather than a form that emails a PDF.
// Ninth Brain answers "was this chart compliant"; what nobody could answer was
// "which question do we fail most often, and who fails it" — that needs every
// review in one place, which is what this is.
// ---------------------------------------------------------------------------

export function useChartReviews(): ChartReviewEntry[] {
  return useSelector((db) => db.chartReviews)
}

export function addChartReview(entry: Omit<ChartReviewEntry, 'id' | 'updatedAt'>): ChartReviewEntry {
  const created: ChartReviewEntry = { ...entry, id: uid('crev'), updatedAt: new Date().toISOString() }
  setState((db) => ({ ...db, chartReviews: [...db.chartReviews, created] }))
  return created
}

export function updateChartReview(id: string, patch: Partial<ChartReviewEntry>): void {
  setState((db) => ({
    ...db,
    chartReviews: db.chartReviews.map((r) =>
      r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r,
    ),
  }))
}

export function deleteChartReview(id: string): void {
  setState((db) => {
    const gone = db.chartReviews.find((r) => r.id === id)
    const goneNarrative = db.chartNarratives.find((n) => n.reviewId === id)
    if (gone) {
      // The narrative goes back with the review, or an undo would restore a
      // review whose narrative had been quietly dropped.
      pushUndo(`Deleted review of ${gone.incidentNumber || 'chart'}`, () =>
        setState((cur) => ({
          ...cur,
          chartReviews: [...cur.chartReviews, gone],
          chartNarratives: goneNarrative ? [...cur.chartNarratives, goneNarrative] : cur.chartNarratives,
        })),
      )
    }
    return {
      ...db,
      chartReviews: db.chartReviews.filter((r) => r.id !== id),
      chartNarratives: db.chartNarratives.filter((n) => n.reviewId !== id),
    }
  })
}

// ----- narratives, device-local ----------------------------------------------
//
// Held apart from the review itself because a review syncs and a narrative must
// not: it is free text about a patient. See ChartNarrative in types.ts.

export function useNarrative(reviewId: string | undefined): ChartNarrative | undefined {
  return useSelector((db) => db.chartNarratives.find((n) => n.reviewId === reviewId))
}

export function useNarrativeCount(): number {
  return useSelector((db) => db.chartNarratives.length)
}

export function saveNarrative(reviewId: string, incidentNumber: string, text: string): void {
  if (!text.trim()) return
  const entry: ChartNarrative = {
    reviewId,
    incidentNumber,
    text,
    savedAt: new Date().toISOString(),
  }
  setState((db) => ({
    ...db,
    chartNarratives: [...db.chartNarratives.filter((n) => n.reviewId !== reviewId), entry],
  }))
}

/** Drop every stored narrative. The reviews and the tally are untouched. */
export function clearNarratives(): void {
  setState((db) => {
    const gone = db.chartNarratives
    if (gone.length) {
      pushUndo(`Cleared ${gone.length} narrative${gone.length === 1 ? '' : 's'}`, () =>
        setState((cur) => ({ ...cur, chartNarratives: gone })),
      )
    }
    return { ...db, chartNarratives: [] }
  })
}

// ----- the tally -------------------------------------------------------------

export interface QuestionTally {
  question: ReviewQuestion
  section: string
  /** Reviews where this question was in scope and answered. */
  answered: number
  yes: number
  no: number
  /** Compliant answers, reading each question's own scoring. */
  compliant: number
  /** Percent compliant of those answered, or undefined when nothing is scored. */
  percent?: number
}

const SECTION_OF = new Map(
  REVIEW_SECTIONS.flatMap((s) =>
    // The section label carries its provenance, so it reaches the Tally and
    // Findings sheets without a column of its own. Anyone reconciling this
    // export against Ninth Brain needs to know which rows have no counterpart
    // there.
    s.questions.map((q) => [q.id, s.authored ? `${s.title} (written here)` : s.title] as const),
  ),
)

/**
 * Per-question counts across a set of reviews.
 *
 * A question is only counted where it was IN SCOPE. The Advanced Airway block
 * appears on maybe one review in ten, and dividing its failures by every review
 * ever filed would report an airway problem as a rounding error. Scope comes
 * from the same visibleQuestions() the form uses, so the denominator is exactly
 * the set of reviews that were asked.
 */
export function tally(reviews: ChartReviewEntry[]): QuestionTally[] {
  const rows = new Map<string, QuestionTally>()
  for (const q of ALL_QUESTIONS) {
    if (q.kind !== 'yesno') continue
    rows.set(q.id, {
      question: q,
      section: SECTION_OF.get(q.id) ?? '',
      answered: 0,
      yes: 0,
      no: 0,
      compliant: 0,
    })
  }

  for (const r of reviews) {
    const inScope = visibleQuestions(r.types as ReviewType[], r.categories)
    for (const q of inScope) {
      const row = rows.get(q.id)
      if (!row) continue
      const a = r.answers[q.id]
      if (typeof a !== 'boolean') continue
      row.answered++
      if (a) row.yes++
      else row.no++
      if (isCompliant(q, a)) row.compliant++
    }
  }

  for (const row of rows.values()) {
    // Flags are counted but never scored — see the Scoring type. A percentage
    // on "does this need escalation" would read as a failure rate for doing the
    // job correctly.
    if (isScored(row.question) && row.answered > 0) {
      row.percent = Math.round((row.compliant / row.answered) * 1000) / 10
    }
  }
  return [...rows.values()]
}

export interface CrewTally {
  crew: string
  reviews: number
  answered: number
  compliant: number
  percent?: number
  /** Reviews where escalation to clinical leadership was ticked. */
  escalated: number
}

/**
 * Per-crew-member rollup. A review naming two medics counts for both.
 *
 * Grouped on a normalised key, not the raw string. The crew field is free text
 * split on commas, so the same medic arrives as "Pat Lee", "pat lee" and
 * " Pat Lee " across three reviews — and this is the number a Phase 1 new hire
 * is judged on, where one person showing up as three defeats the purpose. The
 * first spelling seen is what gets displayed; nobody's name is retyped for
 * them.
 */
const crewKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')

export function crewTally(reviews: ChartReviewEntry[]): CrewTally[] {
  const rows = new Map<string, CrewTally>()
  for (const r of reviews) {
    const inScope = visibleQuestions(r.types as ReviewType[], r.categories)
    let answered = 0
    let compliant = 0
    for (const q of inScope) {
      const a = r.answers[q.id]
      if (typeof a !== 'boolean') continue
      const c = isCompliant(q, a)
      if (c === undefined) continue
      answered++
      if (c) compliant++
    }
    const escalated = r.answers['ovr.escalate'] === true ? 1 : 0
    // A review with nobody named still has to appear somewhere, or the crew
    // sheet silently totals to fewer reviews than were filed.
    for (const name of r.crew.length ? r.crew : ['(no crew recorded)']) {
      const key = crewKey(name)
      const row = rows.get(key) ?? {
        crew: name.trim(),
        reviews: 0,
        answered: 0,
        compliant: 0,
        escalated: 0,
      }
      row.reviews++
      row.answered += answered
      row.compliant += compliant
      row.escalated += escalated
      rows.set(key, row)
    }
  }
  for (const row of rows.values()) {
    if (row.answered > 0) row.percent = Math.round((row.compliant / row.answered) * 1000) / 10
  }
  return [...rows.values()].sort((a, b) => (a.percent ?? 101) - (b.percent ?? 101))
}

/** Overall compliance across a set of reviews. */
export function overall(reviews: ChartReviewEntry[]): {
  reviews: number
  answered: number
  compliant: number
  percent?: number
  escalated: number
} {
  let answered = 0
  let compliant = 0
  let escalated = 0
  for (const r of reviews) {
    for (const q of visibleQuestions(r.types as ReviewType[], r.categories)) {
      const c = isCompliant(q, r.answers[q.id])
      if (c === undefined) continue
      answered++
      if (c) compliant++
    }
    if (r.answers['ovr.escalate'] === true) escalated++
  }
  return {
    reviews: reviews.length,
    answered,
    compliant,
    escalated,
    percent: answered > 0 ? Math.round((compliant / answered) * 1000) / 10 : undefined,
  }
}

// ----- export ----------------------------------------------------------------

const answerText = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.join('; ')
  return String(v)
}

/**
 * Reviews and tally as one workbook.
 *
 * Every question gets a column on the Reviews sheet, whether or not a given
 * review was asked it — a ragged sheet cannot be filtered or pivoted, which is
 * the only reason to want it in Excel. A question that was out of scope is left
 * blank, and blank reads differently from No in every pivot table.
 */
export function reviewWorkbook(reviews: ChartReviewEntry[]): Sheet[] {
  const questions = ALL_QUESTIONS
  const header = [
    'Review ID',
    'Status',
    'Incident / PCR',
    'Date of service',
    'Review types',
    'CQM categories',
    'Crew',
    'Reviewer',
    'Reviewed on',
    'Notes',
    ...questions.map((q) => q.prompt),
  ]

  const rows = reviews.map((r) => {
    // Only what this review was actually asked. Ticking a category, answering
    // its block and then unticking it leaves the answers behind in the record,
    // and without this they exported as though the question had been put — the
    // Tally and Findings sheets already filter by scope, so the three sheets
    // disagreed about the same review.
    const inScope = new Set(visibleQuestions(r.types as ReviewType[], r.categories).map((q) => q.id))
    return [
      r.id,
      r.status,
      r.incidentNumber,
      r.serviceDate ?? '',
      r.types.join('; '),
      [...r.categories, r.categoryOther ? `Other: ${r.categoryOther}` : '']
        .filter(Boolean)
        .join('; '),
      r.crew.join('; '),
      r.reviewer,
      r.reviewedAt,
      r.notes ?? '',
      ...questions.map((q) => (inScope.has(q.id) ? answerText(r.answers[q.id]) : '')),
    ]
  })

  const t = tally(reviews)
  const tallyRows: (string | number)[][] = [
    ['Section', 'Question', 'Scoring', 'Answered', 'Yes', 'No', 'Compliant', '% compliant'],
    ...t.map((row) => [
      row.section,
      row.question.prompt,
      row.question.scoring === 'no-good'
        ? 'No is compliant'
        : row.question.scoring === 'flag'
          ? 'Flag — not scored'
          : 'Yes is compliant',
      row.answered,
      row.yes,
      row.no,
      isScored(row.question) ? row.compliant : '',
      row.percent ?? '',
    ]),
  ]

  const c = crewTally(reviews)
  const crewRows: (string | number)[][] = [
    ['Crew member', 'Reviews', 'Questions scored', 'Compliant', '% compliant', 'Escalated'],
    ...c.map((row) => [
      row.crew,
      row.reviews,
      row.answered,
      row.compliant,
      row.percent ?? '',
      row.escalated,
    ]),
  ]

  // One row per non-compliant answer, with the reviewer's note. This is the
  // sheet a supervisor actually works from: the Reviews sheet says a chart
  // scored 86%, this one says which four questions and why.
  const findingRows: (string | number)[][] = [
    ['Incident / PCR', 'Date of service', 'Crew', 'Section', 'Question', 'Answer', 'Why'],
  ]
  for (const r of reviews) {
    for (const q of visibleQuestions(r.types as ReviewType[], r.categories)) {
      if (isCompliant(q, r.answers[q.id]) !== false) continue
      findingRows.push([
        r.incidentNumber,
        r.serviceDate ?? '',
        r.crew.join('; '),
        SECTION_OF.get(q.id) ?? '',
        q.prompt,
        answerText(r.answers[q.id]),
        r.questionNotes?.[q.id] ?? '',
      ])
    }
  }

  return [
    {
      name: 'Reviews',
      rows: [header, ...rows],
      widths: [14, 10, 16, 14, 16, 26, 24, 18, 14, 30, ...questions.map(() => 22)],
    },
    { name: 'Findings', rows: findingRows, widths: [16, 14, 24, 22, 70, 9, 60] },
    { name: 'Tally', rows: tallyRows, widths: [22, 70, 18, 11, 8, 8, 11, 12] },
    { name: 'By crew', rows: crewRows, widths: [26, 10, 17, 11, 12, 11] },
  ]
}

/** The workbook as bytes, for the download and for tests. */
export function reviewWorkbookBytes(reviews: ChartReviewEntry[]): Uint8Array {
  return buildXlsx(reviewWorkbook(reviews))
}

/** Every question id, so the check script can assert the export covers them. */
export function exportedQuestionIds(): string[] {
  return ALL_QUESTIONS.map((q) => q.id)
}

export function blankReview(reviewer: string): Omit<ChartReviewEntry, 'id' | 'updatedAt'> {
  return {
    types: [],
    categories: [],
    incidentNumber: '',
    serviceDate: todayISO(),
    crew: [],
    reviewer,
    reviewedAt: todayISO(),
    answers: {},
    questionNotes: {},
    status: 'draft',
  }
}

/** Questions still unanswered on a review, in form order. */
export function unanswered(r: Pick<ChartReviewEntry, 'types' | 'categories' | 'answers'>): ReviewQuestion[] {
  return visibleQuestions(r.types as ReviewType[], r.categories).filter((q) => {
    const a = r.answers[q.id]
    if (!q.required) return false
    if (Array.isArray(a)) return a.length === 0
    return a === undefined || a === ''
  })
}

export { question }

/** Reviews within a date range, by date of service. */
export function inRange(reviews: ChartReviewEntry[], from?: string, to?: string): ChartReviewEntry[] {
  return reviews.filter((r) => {
    const d = r.serviceDate ?? r.reviewedAt
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  })
}

/** Current state, for callers outside React. */
export function allReviews(): ChartReviewEntry[] {
  return getState().chartReviews
}
