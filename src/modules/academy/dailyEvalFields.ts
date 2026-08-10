import type { DailyEval } from '../../types'

// ---------------------------------------------------------------------------
// Reading a daily evaluation's answers, wherever they are stored.
//
// The original form had two yes/no confirmations and two comment prompts, each
// with its own column on DailyEval. Those columns hold thousands of historical
// answers, so widening the form did not move them — anything an operation adds
// goes into the generic `checks` / `texts` maps beside them, and these helpers
// read whichever place a given field lives in.
//
// The alternative was a data migration that rewrote every existing evaluation
// into the new shape. That is a lot of risk for a cosmetic gain, and it would
// have made records written before the change indistinguishable from ones
// written after — which is exactly the distinction the version pin exists to
// preserve.
// ---------------------------------------------------------------------------

/** Field ids that predate the generic maps and keep their own column. */
const LEGACY_CHECKS = ['truckWashed', 'spotter'] as const
const LEGACY_TEXTS = ['strengths', 'improvements'] as const

type LegacyCheck = (typeof LEGACY_CHECKS)[number]
type LegacyText = (typeof LEGACY_TEXTS)[number]

export function dailyEvalCheck(e: DailyEval, id: string): boolean | undefined {
  if ((LEGACY_CHECKS as readonly string[]).includes(id)) {
    const legacy = e[id as LegacyCheck]
    // A newer record may carry the answer in the map even for a legacy id —
    // prefer the column, fall back to the map.
    return legacy !== undefined ? legacy : e.checks?.[id]
  }
  return e.checks?.[id]
}

export function dailyEvalText(e: DailyEval, id: string): string | undefined {
  if ((LEGACY_TEXTS as readonly string[]).includes(id)) {
    const legacy = e[id as LegacyText]
    return legacy !== undefined && legacy !== '' ? legacy : e.texts?.[id]
  }
  return e.texts?.[id]
}
