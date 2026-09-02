// The day-one baseline diagnostic, checked against the way the items claim to
// be written.
//
// A bank is easy to write badly and the badness is invisible on the page. Every
// rule below is one a test-wise candidate can exploit to score above their real
// knowledge, which on a DIAGNOSTIC is worse than on a graded exam: an inflated
// baseline hides the gap the whole instrument exists to find.
//
// The rules come from the conventions the National Registry writes to and the
// item-writing literature behind them (Haladyna and Downing's taxonomy, the
// NBME guide). What no script can check is whether the medicine is right —
// that is a subject-matter review, and it is why the file is prose.

import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rmSync } from 'node:fs'
import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')
const OUT = join(tmpdir(), `ces-baseline-${process.pid}.mjs`)

await build({
  stdin: {
    contents:
      `export * from ${JSON.stringify(join(SRC, 'data/aemtBaseline'))}\n` +
      `export * as A from ${JSON.stringify(join(SRC, 'data/aemtAssessments'))}\n`,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
})
const m = await import(pathToFileURL(OUT).href)
const ITEMS = m.BASELINE_ITEMS

let checks = 0
const fails = []
const ok = (cond, msg, detail = '') => {
  checks++
  if (!cond) fails.push(detail ? `${msg}\n        ${detail}` : msg)
}

// ----- the shape of the instrument -------------------------------------------

ok(ITEMS.length === 50, `the diagnostic is 50 items, got ${ITEMS.length}`)

const codes = ITEMS.map((i) => i.code)
ok(new Set(codes).size === codes.length, 'every item code is unique',
  codes.filter((c, i) => codes.indexOf(c) !== i).join(', '))

const badShape = ITEMS.filter(
  (i) => i.options.length !== 4 || new Set(i.options).size !== 4 || !(i.answer >= 0 && i.answer <= 3),
)
ok(badShape.length === 0, 'every item has four distinct options and a key inside them',
  badShape.map((i) => i.code).join(', '))

const noRationale = ITEMS.filter((i) => !i.rationale || i.rationale.length < 60)
ok(noRationale.length === 0, 'every item says why the key is right',
  noRationale.map((i) => i.code).join(', '))

// ----- the blueprint ---------------------------------------------------------
//
// The diagnostic samples the certification exam's own domain weights, or the
// per-domain scores it seeds the tracker with mean nothing.

const DOMAINS = m.A.EXAM_BLUEPRINT
const unknown = ITEMS.filter((i) => !DOMAINS.some((d) => d.id === i.domain))
ok(unknown.length === 0, 'every item belongs to a blueprint domain',
  unknown.map((i) => `${i.code}: ${i.domain}`).join(', '))

const outOfBand = []
for (const d of DOMAINS) {
  const n = ITEMS.filter((i) => i.domain === d.id).length
  const pct = (n / ITEMS.length) * 100
  if (pct < d.examMin || pct > d.examMax) {
    outOfBand.push(`${d.label}: ${n} items = ${pct}%, blueprint says ${d.examMin}-${d.examMax}%`)
  }
}
ok(outOfBand.length === 0, 'each domain is sampled inside its blueprint band',
  outOfBand.join('\n        '))

// ----- flaws a test-wise candidate can exploit -------------------------------

// "All of the above" and its relatives collapse the item to a guess and are
// explicitly out under the National Registry's conventions.
const BANNED = /\b(all|none|both|either|neither) of (the above|these)\b|^(true|false)$/i
const banned = ITEMS.filter((i) => i.options.some((o) => BANNED.test(o)))
ok(banned.length === 0, 'no item offers "all of the above" or a true/false option',
  banned.map((i) => i.code).join(', '))

// An absolute is nearly always false and a candidate who knows that scores
// without knowing the content.
const ABSOLUTE = /\b(always|never|all patients|every patient|no patient|must never|only ever)\b/i
const absolutes = ITEMS.filter((i) => i.options.some((o) => ABSOLUTE.test(o)))
ok(absolutes.length === 0, 'no option turns on an absolute term',
  absolutes.map((i) => i.code).join(', '))

// "Too long to be wrong". If the key is reliably the longest option, length is
// the answer key.
const longestIsKey = ITEMS.filter((i) => {
  const lens = i.options.map((o) => o.length)
  const max = Math.max(...lens)
  return lens[i.answer] === max && lens.filter((l) => l === max).length === 1
})
ok(
  longestIsKey.length <= ITEMS.length * 0.35,
  `the key is the single longest option in ${longestIsKey.length} of ${ITEMS.length} items — length must not be the key`,
  longestIsKey.map((i) => i.code).join(', '),
)

// Options must be homogeneous in length. One option far longer than its
// siblings draws the eye whether or not it is the key.
const lopsided = ITEMS.filter((i) => {
  const lens = i.options.map((o) => o.length)
  return Math.max(...lens) > Math.min(...lens) * 2.6
})
ok(lopsided.length === 0, 'no item has one option far longer than its siblings',
  lopsided.map((i) => `${i.code} (${i.options.map((o) => o.length).join('/')})`).join(', '))

// Key position must not be predictable.
const byPos = [0, 1, 2, 3].map((p) => ITEMS.filter((i) => i.answer === p).length)
ok(
  Math.min(...byPos) >= ITEMS.length * 0.12,
  `the key is spread across all four positions, got ${byPos.join('/')}`,
)
ok(
  Math.max(...byPos) <= ITEMS.length * 0.38,
  `no key position is over-used, got ${byPos.join('/')}`,
)

// A distinctive word shared by the stem and ONLY the key is a clang cue.
const STOP = new Set(
  ('a an the and or of to in on for with is are was were be been being you your they their it its this that these those' +
   ' patient patients should would could most best first next what which when who how why not no yes at by from as if' +
   ' has have had do does did will can may might than then them there here about into over under after before while')
    .split(' '),
)
const clang = []
for (const i of ITEMS) {
  const words = (s) => new Set(s.toLowerCase().match(/[a-z]{5,}/g) ?? [])
  const stem = words(i.stem)
  const key = words(i.options[i.answer])
  const others = i.options.filter((_, n) => n !== i.answer).flatMap((o) => [...words(o)])
  for (const w of key) {
    if (STOP.has(w) || !stem.has(w) || others.includes(w)) continue
    clang.push(`${i.code}: "${w}"`)
  }
}
ok(clang.length === 0, 'no distinctive word appears in the stem and only in the key',
  clang.join(', '))

// A negative stem inverts the task and is read past under time pressure. Where
// one is genuinely needed the negation has to be visible.
// Only a stem whose TASK is negated counts. "not responding to your voice"
// describes a patient; "at least two inches" is a quantifier. The flaw is a
// stem that asks which option is untrue, because it inverts the task and gets
// read past under time pressure.
const negative = ITEMS.filter((i) =>
  /\bexcept\b|\bleast likely\b|\bwhich .{0,40}\bnot\b/i.test(i.stem),
)
ok(
  negative.every((i) => /\b(withheld|contraindicat|avoid)/i.test(i.stem)),
  'no stem asks which option is untrue',
  negative.map((i) => i.code).join(', '),
)

// ----- scope -----------------------------------------------------------------
//
// This measures what a student ARRIVES with. An item that needs the course to
// answer measures nothing on day one.

const AEMT_ONLY = /\b(intraosseous|\bIO\b|venipuncture|IV (bolus|infusion|catheter)|supraglottic|King LT|i-gel|CPAP|capnograph|12-lead|epinephrine 1:|dextrose 50|naloxone (dose|mg))\b/i
const tooAdvanced = ITEMS.filter((i) => AEMT_ONLY.test(i.stem) || i.options.some((o) => AEMT_ONLY.test(o)))
ok(tooAdvanced.length === 0, 'no item needs AEMT scope to answer — this is an EMT-level baseline',
  tooAdvanced.map((i) => i.code).join(', '))

// ----- report ----------------------------------------------------------------

console.log(`\n  ${ITEMS.length} items · key positions ${byPos.join('/')} · longest-is-key ${longestIsKey.length}`)
for (const d of DOMAINS) {
  const n = ITEMS.filter((i) => i.domain === d.id).length
  console.log(`  ${String(n).padStart(2)}  ${String(Math.round((n / ITEMS.length) * 100)).padStart(2)}%  ${d.label} (blueprint ${d.examMin}-${d.examMax}%)`)
}

rmSync(OUT, { force: true })
if (fails.length) {
  console.log(`\n${fails.length} of ${checks} checks failed.`)
  for (const f of fails) console.log(`  FAIL  ${f}`)
  process.exit(1)
}
console.log(`\ncheck-baseline: ${checks} checks passed — the bank is written the way it says it is.`)
