// ---------------------------------------------------------------------------
// Classical item analysis for the AEMT selection exam.
//
// WHY THIS EXISTS
//
// A selection test only earns its 40% weight if it can tell candidates apart.
// This cohort is drawn from people who already passed an EMT course and a
// hiring process, so the ability band is narrow to begin with — and a test
// that is easy for that group produces a pile of scores in the high eighties
// and ranks candidates on noise.
//
// That failure is invisible from a results table sorted by percent. It shows
// up here: in the spread of the distribution, in how many items nearly
// everybody answers correctly, and in whether each item agrees with the test
// as a whole about who the stronger candidates are.
//
// THE THREE NUMBERS THAT MATTER
//
//   p-value        proportion answering correctly. Near 1.0 the item is doing
//                  no sorting work — everyone gets it, so it moves nobody's
//                  rank. Peak information is near 0.5 (a little higher for
//                  4-option multiple choice, where guessing lifts the floor
//                  to about 0.25).
//
//   discrimination point-biserial correlation between getting this item right
//                  and total score. Does this item agree with the rest of the
//                  test? Below ~0.20 it contributes little; NEGATIVE means the
//                  stronger candidates are getting it WRONG, which almost
//                  always means a miskeyed answer or an ambiguous stem.
//
//   KR-20          reliability of the whole test. This one bounds everything:
//                  a test's correlation with any outcome cannot exceed the
//                  square root of its reliability. If KR-20 is low, no
//                  blueprint change makes the test predictive — it is measuring
//                  too much noise for the signal to survive.
//
// WHAT THIS IS NOT: proof the test predicts anything. Only outcome data —
// course completion, certification pass — can show that. This shows whether
// the test is capable of discriminating at all, which is the prerequisite.
// ---------------------------------------------------------------------------

export interface AttemptResponses {
  /** The items served to this candidate, in served order. */
  questionIds: number[]
  /** questionId -> chosen option index. Missing = unanswered. */
  responses: Record<string, number>
}

export interface AnswerKey {
  /** questionId -> correct option index. */
  [questionId: string]: number
}

export interface ItemStat {
  id: number
  /** Candidates who saw this item. */
  n: number
  /** Proportion correct, 0–1. Undefined when nobody saw it. */
  p?: number
  /** Point-biserial with total score. Undefined below the minimum sample. */
  discrimination?: number
  /** Chosen counts by option index, plus omitted. */
  chosen: number[]
  omitted: number
  /** Options nobody chose — dead weight that shortens the effective item. */
  deadDistractors: number[]
  flags: ItemFlag[]
}

export type ItemFlag =
  | 'too-easy'
  | 'too-hard'
  | 'weak-discrimination'
  | 'negative-discrimination'
  | 'dead-distractors'
  | 'low-n'

export interface Distribution {
  n: number
  /** Median candidates per item — how much weight item statistics can carry. */
  medianPerItem: number
  mean: number
  sd: number
  min: number
  max: number
  median: number
  /** Percent scoring at or above 85 and 90 — the ceiling indicators. */
  atOrAbove85: number
  atOrAbove90: number
  /** 10-point buckets from 0 to 100, for a histogram. */
  buckets: { from: number; to: number; n: number }[]
}

export interface ExamAnalysis {
  distribution: Distribution
  /** KR-20. Undefined when the sample is too small to mean anything. */
  kr20?: number
  /** Upper bound on any validity coefficient: sqrt(KR-20). */
  maxValidity?: number
  items: ItemStat[]
  /** Plain-language read of whether the test can discriminate. */
  verdict: {
    level: 'ok' | 'caution' | 'problem' | 'insufficient'
    headline: string
    detail: string[]
  }
}

/**
 * Below this, per-item statistics are noise dressed as numbers. Classical item
 * analysis is usually quoted as wanting 100+ candidates; 20 is the point below
 * which we decline to draw item-level conclusions at all, and 30 the point
 * below which we still caveat them heavily.
 */
export const MIN_N_ITEM = 20
export const MIN_N_RELIABLE = 30

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function sd(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((n, x) => n + (x - m) ** 2, 0) / (xs.length - 1))
}

function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Correlation between a 0/1 item vector and total score. */
function pointBiserial(correct: number[], totals: number[]): number | undefined {
  if (correct.length < 3) return undefined
  const sdT = sd(totals)
  if (sdT === 0) return undefined
  const p = mean(correct)
  // Undefined when every candidate got it right, or every one wrong: there is
  // no variance in the item to correlate with anything.
  if (p === 0 || p === 1) return undefined
  const m1 = mean(totals.filter((_, i) => correct[i] === 1))
  const m0 = mean(totals.filter((_, i) => correct[i] === 0))
  // Population SD is the convention for the point-biserial denominator.
  const sdPop = sdT * Math.sqrt((totals.length - 1) / totals.length)
  return ((m1 - m0) / sdPop) * Math.sqrt(p * (1 - p))
}

/**
 * KR-20 over a set of attempts.
 *
 * Every candidate sees a different random draw, so there is no common item
 * set to compute the classical formula over. We use the standard adaptation:
 * item variances summed over the items each candidate actually saw, scaled by
 * the mean test length. It is an approximation, and it is reported as one.
 */
function kr20(items: ItemStat[], totals: number[], meanLength: number): number | undefined {
  if (totals.length < MIN_N_RELIABLE || meanLength < 2) return undefined
  const varTotal = sd(totals) ** 2
  if (varTotal === 0) return 0
  const sumPQ = items.reduce((n, it) => (it.p === undefined ? n : n + it.p * (1 - it.p)), 0)
  // Scale the summed item variance to one test's worth of items.
  const scaled = items.length ? (sumPQ / items.length) * meanLength : 0
  const k = meanLength
  return (k / (k - 1)) * (1 - scaled / varTotal)
}

export function analyseExam(
  attempts: AttemptResponses[],
  key: AnswerKey,
  optionCount = 4,
): ExamAnalysis {
  // ----- per-candidate totals, as percentages -------------------------------
  const scored = attempts.map((a) => {
    let right = 0
    for (const qid of a.questionIds) {
      const chosen = a.responses[String(qid)]
      if (chosen !== undefined && chosen === key[String(qid)]) right++
    }
    return { right, of: a.questionIds.length, pct: a.questionIds.length ? (right / a.questionIds.length) * 100 : 0 }
  })
  const pcts = scored.map((s) => s.pct)
  const totals = scored.map((s) => s.right)

  const buckets = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i * 10 + 10, n: 0 }))
  for (const p of pcts) buckets[Math.min(9, Math.floor(p / 10))].n++

  const distribution: Distribution = {
    n: pcts.length,
    mean: mean(pcts),
    sd: sd(pcts),
    min: pcts.length ? Math.min(...pcts) : 0,
    max: pcts.length ? Math.max(...pcts) : 0,
    median: median(pcts),
    atOrAbove85: pcts.length ? (pcts.filter((p) => p >= 85).length / pcts.length) * 100 : 0,
    atOrAbove90: pcts.length ? (pcts.filter((p) => p >= 90).length / pcts.length) * 100 : 0,
    medianPerItem: 0,
    buckets,
  }

  // ----- per-item -----------------------------------------------------------
  const seen = new Map<number, { correct: number[]; totals: number[]; chosen: number[]; omitted: number }>()
  attempts.forEach((a, ai) => {
    for (const qid of a.questionIds) {
      if (!seen.has(qid)) {
        seen.set(qid, { correct: [], totals: [], chosen: Array(optionCount).fill(0), omitted: 0 })
      }
      const rec = seen.get(qid)!
      const chosen = a.responses[String(qid)]
      rec.correct.push(chosen !== undefined && chosen === key[String(qid)] ? 1 : 0)
      rec.totals.push(totals[ai])
      if (chosen === undefined) rec.omitted++
      else if (chosen >= 0 && chosen < optionCount) rec.chosen[chosen]++
    }
  })

  const items: ItemStat[] = [...seen.entries()]
    .map(([id, rec]) => {
      const n = rec.correct.length
      const p = n ? mean(rec.correct) : undefined
      const discrimination = n >= MIN_N_ITEM ? pointBiserial(rec.correct, rec.totals) : undefined
      const dead = rec.chosen
        .map((c, i) => ({ c, i }))
        .filter((x) => x.c === 0 && x.i !== key[String(id)])
        .map((x) => x.i)
      const flags: ItemFlag[] = []
      if (n < MIN_N_ITEM) flags.push('low-n')

      // DIFFICULTY FLAGS NEED A SAMPLE, exactly as discrimination does.
      //
      // A proportion correct is arithmetically real at any n and meaningless
      // at small n: with one exposure every item is 0% or 100%, so a single
      // candidate answering 49 of 50 correctly makes 49 items "too easy" and
      // the one they missed "too hard". None of that is a property of the
      // items — it is a property of having asked one person.
      //
      // The p-value is still REPORTED, alongside its n, because "1 of 1
      // correct" is a true statement. It is the JUDGEMENT that waits.
      const enoughToJudge = n >= MIN_N_ITEM
      if (enoughToJudge && p !== undefined && p >= 0.95) flags.push('too-easy')
      if (enoughToJudge && p !== undefined && p <= 0.3) flags.push('too-hard')
      // Catching a miskey without crying wolf.
      //
      // A point-biserial from n candidates has a standard error near
      // 1/sqrt(n) — at n=20 that is about 0.22, so mild negative values are
      // ordinary noise. Flagging those sends someone hunting for a miskey
      // that is not there, and the tool loses their trust the first time.
      //
      // But the discrimination figure alone is a blunt detector at these
      // sample sizes: a genuinely miskeyed item can sit around -0.3, inside
      // the noise band. The giveaway is elsewhere and far more robust — when
      // an item is miskeyed, the candidates pile onto the option that is
      // actually right, and the keyed option is left with almost nobody. A
      // distractor outdrawing the key is the signature; the correlation is
      // the corroboration.
      const keyIdx = key[String(id)]
      const keyCount = keyIdx === undefined ? 0 : rec.chosen[keyIdx] ?? 0
      const topDistractor = Math.max(
        0,
        ...rec.chosen.filter((_, i) => i !== keyIdx),
      )
      const keyOutdrawn = n >= MIN_N_ITEM && topDistractor >= 2 * keyCount && topDistractor >= n * 0.4
      const se = n > 1 ? 1 / Math.sqrt(n) : Infinity
      const clearlyNegative = discrimination !== undefined && discrimination < -1.5 * se
      if (keyOutdrawn || clearlyNegative) {
        flags.push('negative-discrimination')
      } else if (discrimination !== undefined && discrimination < 0.2) {
        flags.push('weak-discrimination')
      }
      if (n >= MIN_N_ITEM && dead.length >= optionCount - 2) flags.push('dead-distractors')
      return { id, n, p, discrimination, chosen: rec.chosen, omitted: rec.omitted, deadDistractors: dead, flags }
    })
    .sort((a, b) => (b.p ?? 0) - (a.p ?? 0))

  distribution.medianPerItem = median(items.map((i) => i.n))

  const meanLength = attempts.length ? mean(attempts.map((a) => a.questionIds.length)) : 0
  const r = kr20(items, totals, meanLength)
  const maxValidity = r !== undefined && r > 0 ? Math.sqrt(r) : undefined

  return { distribution, kr20: r, maxValidity, items, verdict: verdictFor(distribution, r, items) }
}

function verdictFor(d: Distribution, r: number | undefined, items: ItemStat[]) {
  const detail: string[] = []
  if (d.n < MIN_N_ITEM) {
    return {
      level: 'insufficient' as const,
      headline: `${d.n} submitted attempt${d.n === 1 ? '' : 's'} — too few to judge the test`,
      detail: [
        `Item statistics need at least ${MIN_N_ITEM} candidates before they mean anything, and reliability at least ${MIN_N_RELIABLE}.`,
        'The score distribution below is still worth a look: if it is already bunched at the top with only a few candidates, it will not spread out with more.',
      ],
    }
  }

  const tooEasy = items.filter((i) => i.flags.includes('too-easy')).length
  const weak = items.filter(
    (i) => i.flags.includes('weak-discrimination') || i.flags.includes('negative-discrimination'),
  ).length
  const negative = items.filter((i) => i.flags.includes('negative-discrimination')).length

  // The ceiling: scores bunched high, with little spread left to rank on.
  const ceiling = d.mean >= 85 || d.atOrAbove85 >= 50 || d.sd < 8
  if (ceiling) {
    detail.push(
      `Mean ${d.mean.toFixed(0)}%, SD ${d.sd.toFixed(1)}, and ${d.atOrAbove85.toFixed(0)}% of candidates at or above 85%. Scores are bunched near the top, so the ranking is being decided by a small number of items.`,
    )
  }
  if (tooEasy) {
    detail.push(
      `${tooEasy} item${tooEasy === 1 ? '' : 's'} answered correctly by 95% or more. These do not sort anybody — they lengthen the test without informing the decision.`,
    )
  }
  if (negative) {
    detail.push(
      `${negative} item${negative === 1 ? ' has' : 's have'} clearly NEGATIVE discrimination — the stronger candidates are getting them wrong. Check the answer key on these first; a miskey is the usual cause.`,
    )
  } else if (weak) {
    detail.push(
      `${weak} item${weak === 1 ? '' : 's'} discriminate below 0.20, contributing little to the ranking.`,
    )
  }
  if (r !== undefined) {
    detail.push(
      `KR-20 ${r.toFixed(2)}. A test cannot correlate with any outcome above the square root of its reliability, so this caps any validity coefficient at about ${Math.sqrt(Math.max(0, r)).toFixed(2)}.`,
    )
  }

  const level = ceiling || negative > 0 || (r !== undefined && r < 0.6)
    ? ('problem' as const)
    : tooEasy > items.length / 3 || weak > items.length / 3
      ? ('caution' as const)
      : ('ok' as const)

  const headline =
    level === 'problem'
      ? 'This test is not separating candidates well'
      : level === 'caution'
        ? 'This test separates candidates, but a lot of items are doing no work'
        : 'This test is discriminating adequately'

  // Every candidate sees a different draw, so per-item samples are a fraction
  // of the candidate count. Say so — an admin reading a discrimination figure
  // deserves to know how many people it rests on.
  if (d.medianPerItem < MIN_N_RELIABLE) {
    detail.push(
      `Item statistics rest on a median of ${d.medianPerItem} candidates each, because every candidate draws a different set. Treat individual item figures as indicative; the distribution and reliability above are on firmer ground.`,
    )
  }
  if (!detail.length) detail.push('No ceiling effect, no miskeyed items, and reliability within the usual range.')
  return { level, headline, detail }
}
