import { CQMP_KPIS, CQMP_OPERATIONS, type CqmpKpiId } from '../../data/cqmp'

// ---------------------------------------------------------------------------
// Reading the month's KPI figures out of a pasted summary.
//
// Every operation presents its own deck at the monthly meeting. Re-typing
// twenty-six percentages off eight of them is both tedious and the single most
// likely way a wrong figure reaches a regional director — so the summary gets
// pasted in and read instead.
//
// Deliberately text-in. The source is whatever the person has: a summary of the
// decks, a few lines typed out, a table copied from an email. Nothing here
// opens a file, and nothing here is stored — the pasted text lives in the box
// until the numbers are applied, and only the numbers are kept.
//
// What this does NOT do is trust itself:
//
//   - nothing is written until a person presses Apply. These figures go onto a
//     compliance document; an importer that silently filled them in would be
//     trading a typo you would catch for one you would not.
//   - every finding carries the line it came from, verbatim. A number with no
//     provenance is a number nobody can check, and the reviewer has to be able
//     to see "81.4%" sitting next to the words "blood glucose".
//   - a figure the app is unsure about says so rather than rounding its doubt
//     away. Confidence is part of the result, not a detail of the algorithm.
//
// The traps it has to avoid, all of which are real habits of these summaries:
//
//   "Goal: 90%, actual 81.4%" — reading left to right picks the target every
//   time. Percentages are classified by the words in front of them, and a
//   target-labelled one never becomes the result. It is offered as the target
//   instead, which is worth having.
//
//   "EagleMed Wichita" contains "Wichita". Operations are matched most-specific
//   first, and a matched span is blanked out before the less specific patterns
//   run, so the ground BU cannot inherit the air base's figures.
//
//   "Slide 3 of 12" survives into a summary and looks exactly like a "3 of 12"
//   case count. Those are stripped before counts are read.
// ---------------------------------------------------------------------------

/**
 * How sure the reader is.
 *
 * 'read'      — the line said it plainly: one measure, one unambiguous figure.
 * 'inferred'  — the figure had to be chosen from more than one candidate.
 * 'uncertain' — worth showing a person, not worth applying without a look.
 */
export type ReadConfidence = 'read' | 'inferred' | 'uncertain'

export interface KpiFinding {
  kpiId: CqmpKpiId
  /** The result percentage, 0–100. */
  value: number | null
  /** Case counts when the summary showed its working — better evidence than a
   *  bare percentage, because the percentage can be checked against them. */
  numerator?: number
  denominator?: number
  /** A target read off the same line, when one was labelled as such. */
  target?: number
  confidence: ReadConfidence
  /** The text this came from, verbatim and trimmed. Never paraphrased. */
  because: string
  /** 1-based line number in the pasted text, so the reviewer can go and look. */
  line: number
}

export interface KpiRead {
  /** The operation these figures are for, if it could be identified. */
  opId?: string
  opConfidence: ReadConfidence
  opBecause: string
  findings: KpiFinding[]
  /** Anything the reader wants a person to know. */
  problems: string[]
}

/**
 * Break a paste into the units a figure belongs to.
 *
 * Lines, because that is how these summaries are written — a heading naming the
 * operation, then a line per measure, or one line carrying both. A line that
 * names more than one operation is split again at the second name, so a table
 * row pasted as a single line ("Kansas City 88% | Wichita 94%") does not hand
 * both figures to whichever operation came first.
 */
export function splitPaste(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const marks = operationMarks(line)
    if (marks.length < 2) {
      out.push(line)
      continue
    }
    // Cut before each operation name after the first.
    let from = 0
    for (const mark of marks.slice(1)) {
      out.push(line.slice(from, mark.index).trim())
      from = mark.index
    }
    out.push(line.slice(from).trim())
  }
  return out.filter(Boolean)
}

// ----- operation identification ----------------------------------------------

/**
 * Patterns per operation, MOST SPECIFIC FIRST.
 *
 * The order is load-bearing. "EagleMed Wichita" has to be consumed before
 * "Wichita" is looked for, or the ground business unit claims the air base's
 * deck — which would put a rotor base's bundle compliance on an interfacility
 * unit that does not report bundles at all.
 */
const OP_PATTERNS: { opId: string; patterns: RegExp[] }[] = [
  {
    opId: 'eaglemed-wichita',
    patterns: [/eagle\s*-?\s*med[\s—–-]*wichita/gi, /\bem[\s-]*wichita\b/gi],
  },
  {
    opId: 'eaglemed-chanute',
    patterns: [/eagle\s*-?\s*med[\s—–-]*chanute/gi, /\bchanute\b/gi],
  },
  {
    opId: 'healthstar1',
    patterns: [/health\s*-?\s*star\s*(?:one|1|i)\b/gi, /health\s*-?\s*star\b/gi, /\bhs\s*-?\s*1\b/gi],
  },
  { opId: 'independence', patterns: [/\bindependence\b/gi] },
  { opId: 'linn', patterns: [/\blinn(?:\s*county)?\b/gi] },
  { opId: 'winfield', patterns: [/\bwinfield\b/gi] },
  { opId: 'wichita', patterns: [/\bwichita\b/gi] },
  { opId: 'kc', patterns: [/\bkansas\s*city\b/gi, /\bkcmo\b/gi, /\bkc\b/gi] },
]

interface OpHit {
  opId: string
  count: number
  first: string
}

/**
 * Underscores are word characters, so \b does not fire between "Winfield" and
 * "_April" — and that is exactly how these summaries get written. Flattened to
 * spaces, keeping the length so offsets taken here still index the original.
 */
const flatten = (text: string) => text.replace(/_+/g, ' ')

export interface OpMark {
  opId: string
  index: number
  text: string
}

/**
 * Where each operation is named in a piece of text, in order.
 *
 * Same most-specific-first consumption as `operationHits`, so "EagleMed
 * Wichita" is one mark rather than two overlapping ones.
 */
export function operationMarks(text: string): OpMark[] {
  let working = flatten(text)
  const marks: OpMark[] = []
  for (const { opId, patterns } of OP_PATTERNS) {
    for (const pattern of patterns) {
      const re = new RegExp(pattern.source, pattern.flags)
      let m: RegExpExecArray | null
      const found: OpMark[] = []
      while ((m = re.exec(working))) {
        found.push({ opId, index: m.index, text: m[0].trim() })
      }
      for (const f of found) {
        marks.push(f)
        working =
          working.slice(0, f.index) + ' '.repeat(f.text.length) + working.slice(f.index + f.text.length)
      }
    }
  }
  return marks.sort((a, b) => a.index - b.index)
}

/**
 * Count operation mentions, consuming each match so a more specific name never
 * feeds the less specific one that is contained in it.
 */
function operationHits(text: string): OpHit[] {
  let working = flatten(text)
  const hits: OpHit[] = []
  for (const { opId, patterns } of OP_PATTERNS) {
    let count = 0
    let first = ''
    for (const pattern of patterns) {
      const re = new RegExp(pattern.source, pattern.flags)
      working = working.replace(re, (match) => {
        count++
        if (!first) first = match.trim()
        // Blanked, not deleted — offsets elsewhere in this pass stay usable.
        return ' '.repeat(match.length)
      })
    }
    if (count > 0) hits.push({ opId, count, first })
  }
  return hits
}

/**
 * Whether the whole paste is about one operation, and which.
 *
 * A summary covering all eight names all eight, and picking the one mentioned
 * most would be a coin toss dressed up as an answer. So this only commits when
 * exactly one operation appears anywhere; otherwise each line is attributed on
 * its own, from the headings in the text.
 */
export function identifyOperation(lines: string[]): {
  opId?: string
  confidence: ReadConfidence
  because: string
} {
  const all = operationHits(lines.join(' \n '))
  if (all.length === 0) {
    return { opId: undefined, confidence: 'uncertain', because: 'no operation named' }
  }
  if (all.length === 1) {
    return {
      opId: all[0].opId,
      confidence: 'read',
      because: `the only operation named is “${all[0].first}”`,
    }
  }
  return {
    opId: undefined,
    confidence: 'uncertain',
    because: `names ${all.length} operations — each line is matched on its own`,
  }
}

// ----- measure identification -------------------------------------------------

/** Bundle-specific names first, so a STEMI line is not read as a stroke one. */
const KPI_PATTERNS: Record<CqmpKpiId, RegExp[]> = {
  glucose: [
    /blood\s*glucose(?:\s*verification)?/i,
    /glucose\s*(?:verification|check|obtained|documented)/i,
    /\bbgl\b/i,
    /altered\s*mental\s*status/i,
  ],
  airway: [
    /advanced\s*airway(?:\s*verification)?/i,
    /airway\s*(?:verification|confirmation)/i,
    /(?:placement|tube)\s*(?:verification|confirmation)/i,
  ],
  stroke: [/stroke\s*bundle/i, /\bstroke\b/i],
  stemi: [/stemi\s*bundle/i, /\bstemi\b/i],
}

interface KpiMention {
  kpiId: CqmpKpiId
  index: number
  text: string
}

function kpiMentions(text: string): KpiMention[] {
  const found: KpiMention[] = []
  for (const kpiId of Object.keys(KPI_PATTERNS) as CqmpKpiId[]) {
    for (const pattern of KPI_PATTERNS[kpiId]) {
      const m = pattern.exec(text)
      if (m) {
        found.push({ kpiId, index: m.index, text: m[0] })
        break
      }
    }
  }
  return found.sort((a, b) => a.index - b.index)
}

// ----- figures ----------------------------------------------------------------

/** Words that mark the number after them as a goal rather than a result. */
const TARGET_WORDS = /(goal|target|benchmark|threshold|standard|expectation)[^.%]{0,24}$/i
/** Words that mark it as the month's actual figure. */
const RESULT_WORDS = /(actual|result|current|compliance|performance|achieved|rate|score)[^.%]{0,24}$/i

interface Figure {
  value: number
  index: number
  kind: 'target' | 'result' | 'plain'
  text: string
}

/**
 * Percentages in a piece of text, classified by what precedes them.
 *
 * "Goal: 90%  Actual: 81.4%" is the standard shape, and reading left to right
 * without looking at the labels picks the target every time.
 */
export function figuresOn(text: string): Figure[] {
  const out: Figure[] = []
  const re = /(\d{1,3}(?:\.\d+)?)\s*%/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const value = Number(m[1])
    if (!Number.isFinite(value) || value > 100) continue
    const before = text.slice(Math.max(0, m.index - 40), m.index)
    const kind: Figure['kind'] = TARGET_WORDS.test(before)
      ? 'target'
      : RESULT_WORDS.test(before)
        ? 'result'
        : 'plain'
    out.push({ value, index: m.index, kind, text: `${m[1]}%` })
  }
  return out
}

interface CountPair {
  numerator: number
  denominator: number
  index: number
  text: string
}

/**
 * Case counts — "12 of 15", "12/15".
 *
 * Stronger evidence than a bare percentage, because the percentage can be
 * checked against them. Slide and page numbering is stripped first: "slide 3 of
 * 12" is the same shape and would otherwise be read as 25% compliance.
 */
export function countsOn(text: string): CountPair[] {
  const cleaned = text.replace(/\b(?:slide|page|pg)\s*\d+\s*(?:of|\/)\s*\d+/gi, ' ')
  const out: CountPair[] = []
  const re = /(\d{1,5})\s*(?:of|\/)\s*(\d{1,5})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(cleaned))) {
    const numerator = Number(m[1])
    const denominator = Number(m[2])
    // A numerator above its denominator is not a compliance count, and a
    // denominator of zero is not a rate.
    if (denominator <= 0 || numerator > denominator) continue
    out.push({ numerator, denominator, index: m.index, text: m[0] })
  }
  return out
}

const nearest = <T extends { index: number }>(items: T[], to: number): T | undefined =>
  items.length
    ? items.reduce((best, x) =>
        Math.abs(x.index - to) < Math.abs(best.index - to) ? x : best,
      )
    : undefined

/**
 * The figure belonging to a measure named in a line.
 *
 * These summaries read "Label: value", so a figure belongs to the label it FOLLOWS,
 * not to whichever label happens to be closest. On
 *
 *   "Blood Glucose Verification 91% | Advanced Airway Verification 78%"
 *
 * the 91% sits nearer to "Advanced Airway" than the 78% does, and taking the
 * nearest gives the airway line the glucose number — the kind of quiet
 * transposition this whole module exists to avoid.
 *
 * So the window between this mention and the next one wins. Only when nothing
 * falls inside it does proximity decide, which covers the reversed layout
 * ("91% Blood Glucose").
 */
function figureFor<T extends { index: number }>(
  items: T[],
  from: number,
  until: number,
): T | undefined {
  const inWindow = items.filter((x) => x.index >= from && x.index < until)
  return inWindow.length ? inWindow[0] : nearest(items, from)
}

/** Trim to something a person can read in a review row. */
function excerpt(text: string, around: number): string {
  const from = Math.max(0, around - 60)
  const to = Math.min(text.length, around + 90)
  return (from > 0 ? '…' : '') + text.slice(from, to).trim() + (to < text.length ? '…' : '')
}

// ----- the read ----------------------------------------------------------------

/**
 * Read a pasted summary.
 *
 * A line that names an operation sets the operation for the lines after it, so
 * the ordinary shape — a heading, then a line per measure — reads correctly,
 * and so does one line carrying both. Findings before any operation is named
 * are kept but marked uncertain rather than being guessed onto whichever
 * operation happens to appear most.
 */
export function readPastedKpis(text: string): KpiRead[] {
  const lines = splitPaste(text)
  const overall = identifyOperation(lines)
  const known = new Set(CQMP_OPERATIONS.map((o) => o.id))
  const byOp = new Map<string, KpiFinding[]>()
  const problems: string[] = []
  // Only commit up front when the whole paste is about one operation. A summary
  // covering all eight starts unassigned and picks its operation up from the
  // headings as it goes.
  let current = overall.opId
  let currentBecause = overall.because
  let currentConfidence = overall.confidence
  const opNotes = new Map<string, { because: string; confidence: ReadConfidence }>()
  if (current) opNotes.set(current, { because: currentBecause, confidence: currentConfidence })

  lines.forEach((line, i) => {
    const lineNo = i + 1
    // A heading naming exactly one operation moves the pointer.
    const hits = operationHits(line)
    if (hits.length === 1 && known.has(hits[0].opId) && hits[0].opId !== current) {
      current = hits[0].opId
      currentBecause = `line ${lineNo} says “${hits[0].first}”`
      currentConfidence = 'read'
      if (!opNotes.has(current)) {
        opNotes.set(current, { because: currentBecause, confidence: currentConfidence })
      }
    }

    const mentions = kpiMentions(line)
    if (mentions.length === 0) return
    const figures = figuresOn(line)
    const counts = countsOn(line)
    if (figures.length === 0 && counts.length === 0) return

    mentions.forEach((mention, mi) => {
      // Where this measure's territory on the line ends.
      const until = mentions[mi + 1]?.index ?? line.length
      const operation = CQMP_OPERATIONS.find((o) => o.id === current)
      // A measure the operation does not report is a sign the line was matched
      // to the wrong operation, not something to quietly file.
      if (operation && !operation.kpis.includes(mention.kpiId)) {
        problems.push(
          `Line ${lineNo} reports ${CQMP_KPIS[mention.kpiId].short.toLowerCase()}, which ${
            operation.name
          } does not report. Check it is matched to the right operation.`,
        )
        return
      }

      const results = figures.filter((f) => f.kind !== 'target')
      const preferred = results.filter((f) => f.kind === 'result')
      const pool = preferred.length ? preferred : results
      const figure = figureFor(pool, mention.index, until)
      const count = figureFor(counts, mention.index, until)
      const targetFigure = figureFor(
        figures.filter((f) => f.kind === 'target'),
        mention.index,
        until,
      )

      let value: number | null = figure ? figure.value : null
      let confidence: ReadConfidence =
        mentions.length === 1 && pool.length === 1 ? 'read' : 'inferred'

      if (count) {
        const derived = Math.round((count.numerator / count.denominator) * 10000) / 100
        if (value === null) {
          value = derived
          // Counts alone are unambiguous arithmetic — as good as read.
          confidence = mentions.length === 1 ? 'read' : 'inferred'
        } else if (Math.abs(derived - value) > 1) {
          // The summary disagrees with itself. Keep the stated percentage, since
          // that is what was reported, but do not pretend to be sure.
          confidence = 'uncertain'
          problems.push(
            `Line ${lineNo}: ${CQMP_KPIS[mention.kpiId].short.toLowerCase()} shows ${
              figure?.text
            } but ${count.text} works out to ${derived}%.`,
          )
        }
      }

      if (value === null) return
      const key = current ?? '?'
      if (!byOp.has(key)) byOp.set(key, [])
      byOp.get(key)!.push({
        kpiId: mention.kpiId,
        value,
        numerator: count?.numerator,
        denominator: count?.denominator,
        target: targetFigure?.value,
        confidence: current ? confidence : 'uncertain',
        because: excerpt(line, mention.index),
        line: lineNo,
      })
    })
  })

  if (byOp.size === 0) {
    return [
      {
        opId: overall.opId,
        opConfidence: overall.confidence,
        opBecause: overall.because,
        findings: [],
        problems: [
          ...problems,
          'No KPI figures found. Each line needs the measure and its percentage together — "Blood glucose verification: 81.4%".',
        ],
      },
    ]
  }

  return [...byOp.entries()].map(([opId, findings]) => ({
    opId: opId === '?' ? undefined : opId,
    opConfidence: opNotes.get(opId)?.confidence ?? 'uncertain',
    opBecause: opNotes.get(opId)?.because ?? overall.because,
    // Later line wins for a measure named twice — a summary table at the top
    // and detail below should resolve to the detail.
    findings: dedupe(findings),
    problems,
  }))
}

function dedupe(findings: KpiFinding[]): KpiFinding[] {
  const best = new Map<string, KpiFinding>()
  const rank: Record<ReadConfidence, number> = { read: 3, inferred: 2, uncertain: 1 }
  for (const f of findings) {
    const prior = best.get(f.kpiId)
    // Prefer the more confident read; between equals, prefer the later line.
    if (!prior || rank[f.confidence] > rank[prior.confidence] || f.line > prior.line) {
      if (!prior || rank[f.confidence] >= rank[prior.confidence]) best.set(f.kpiId, f)
    }
  }
  return [...best.values()].sort((a, b) => a.line - b.line)
}
