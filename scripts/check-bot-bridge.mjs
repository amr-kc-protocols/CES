// Checks for the Ninth Brain Chart Review Agent bridge.
//
// The bridge takes somebody else's answers and turns them into this app's
// numbers, which is exactly where a wrong answer is hardest to see: the review
// looks complete, the score looks plausible, and nothing on screen says the
// answer landed on a different question than the one it was written for.
//
// Three failures this pins down, all of them silent:
//
//   - Q14 and Q15 are stated in CES as the positive of a question Ninth Brain
//     asks in reverse. An Agent answering the form literally sends "No" for
//     "any near misses?", the synonym table reads "no" as Not met, and q14 is
//     a CRITICAL item — so a crew with nothing to report scored a critical
//     failure on every clean chart.
//   - A critical item missed is 2 points of 18. A chart Met on everything else
//     scores 89%, sails past the 80% coaching threshold, and is never seen.
//   - The criterion resolver fell back to a substring match in rubric order,
//     so any key containing "q1" — "q13 clinical decisions", "Q12:
//     documentation" — scored q1 instead.
//
// Run: node scripts/check-bot-bridge.mjs  (or `npm run check:bridge`)
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// The QA store is localStorage-backed, and the import path under test writes
// through it. A Map is enough to make it a real round trip.
const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => void mem.set(k, String(v)),
  removeItem: (k) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size
  },
}

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')
const OUT = join(tmpdir(), `ces-bot-bridge-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `
      export * from ${JSON.stringify(join(SRC, 'modules/qa/botBridge'))}
      export * from ${JSON.stringify(join(SRC, 'data/qaRubric'))}
      export { createPeriod, importBotReviews, addCharts, saveReview, periodId } from ${JSON.stringify(
        join(SRC, 'modules/qa/qaStore'),
      )}
      export { getState } from ${JSON.stringify(join(SRC, 'lib/store'))}
    `,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
  plugins: [
    {
      name: 'stub-dom',
      setup(b) {
        b.onResolve({ filter: /^react$/ }, (a) => ({ path: a.path, namespace: 'react-stub' }))
        b.onLoad({ filter: /.*/, namespace: 'react-stub' }, () => ({
          contents:
            'export const useMemo=(f)=>f();export const useRef=(v)=>({current:v});' +
            'export const useSyncExternalStore=()=>{throw new Error("not callable here")};' +
            'export const useState=()=>{throw new Error("not callable here")};' +
            'export const useEffect=()=>{};export default {}',
          loader: 'js',
        }))
        b.onResolve({ filter: /(dialog|sync)$/ }, (a) => ({ path: a.path, namespace: 'stub' }))
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents:
            'export const notifyUser=()=>{};export const useSyncStatus=()=>({});' +
            'export const confirmAction=async()=>true;export const getSupabaseClient=()=>null;' +
            'export const pushRecord=async()=>{};export const syncNow=async()=>{}',
          loader: 'js',
        }))
      },
    },
  ],
})

const m = await import(pathToFileURL(OUT).href)
rmSync(OUT, { force: true })

let checks = 0
const fails = []
const ok = (cond, label, detail) => {
  checks++
  if (!cond) fails.push(detail ? `${label} — ${detail}` : label)
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!cond && detail) console.log(`        ${detail}`)
}

const crit = (id) => m.QA_RUBRIC.find((c) => c.id === id)

// ----- the two reversed questions -------------------------------------------

ok(
  crit('q14').reversed === true && crit('q15').reversed === true,
  'the two questions Ninth Brain asks in reverse are marked as reversed',
)
ok(
  m.QA_RUBRIC.filter((c) => c.reversed).length === 2,
  'and nothing else is',
  m.QA_RUBRIC.filter((c) => c.reversed).map((c) => c.id).join(', '),
)

// The spec's acceptance rows: a literal answer to the form's own wording, and
// an explicit CES status, both have to land on Met.
ok(m.statusForCriterion(crit('q14'), 'No') === 'met', 'q14 "No" — no near misses — is Met')
ok(m.statusForCriterion(crit('q14'), 'Met') === 'met', 'q14 "Met" is Met, taken at its word')
ok(m.statusForCriterion(crit('q14'), 'Yes') === 'not_met', 'q14 "Yes" — there was one — is Not met')
ok(
  m.statusForCriterion(crit('q14'), 'none') === 'met',
  'q14 "none" means no near misses, not "not applicable"',
  String(m.statusForCriterion(crit('q14'), 'none')),
)
ok(m.statusForCriterion(crit('q15'), 'no') === 'met', 'q15 "no" — no further review needed — is Met')
ok(
  m.statusForCriterion(crit('q14'), 'not_met') === 'not_met',
  'an explicit Not met on a reversed item is not inverted a second time',
)
// Everything else keeps reading the way it always has.
ok(m.statusForCriterion(crit('q1'), 'No') === 'not_met', 'a No on an ordinary item is still Not met')
ok(m.statusForCriterion(crit('q1'), 'Yes') === 'met', 'a Yes on an ordinary item is still Met')
ok(m.statusForCriterion(undefined, 'yes') === 'met', 'an unknown criterion falls back to the synonym table')

// ----- which question an answer belongs to ----------------------------------

const resolve = m.buildCriteriaResolver(m.QA_RUBRIC)
ok(resolve('q13') === 'q13', 'an exact id resolves to itself')
ok(resolve('Q13') === 'q13', 'casing does not matter')
ok(
  resolve('q13 clinical decisions') === 'q13',
  'a key that writes the id and the question together resolves on the id',
  String(resolve('q13 clinical decisions')),
)
ok(
  resolve('Q12: documentation') === 'q12',
  'and so does one with punctuation after the number',
  String(resolve('Q12: documentation')),
)
ok(
  resolve('Physical exam documented appropriately') === 'q1',
  'an exact label still resolves',
  String(resolve('Physical exam documented appropriately')),
)
ok(
  resolve('documentation') === undefined,
  'a bare word that merely appears in a label resolves to nothing, rather than to q11',
  String(resolve('documentation')),
)
ok(
  resolve('near misses') === undefined,
  'no substring match survives anywhere',
  String(resolve('near misses')),
)

// ----- a critical item missed cannot pass -----------------------------------

const allMet = Object.fromEntries(m.QA_RUBRIC.map((c) => [c.id, 'met']))
ok(
  m.computeScore({ ...allMet, q13: 'not_met' }, m.QA_RUBRIC) === 89,
  'the arithmetic that hid this: one critical item missed still scores 89%',
  String(m.computeScore({ ...allMet, q13: 'not_met' }, m.QA_RUBRIC)),
)

const period = m.createPeriod({ month: '2026-08', operation: 'kc', monthlyVolume: 100 })
const res = m.importBotReviews(period.id, 'kc', [
  {
    incidentNumber: '900000001',
    // Everything met except one critical item — and the payload saying, as an
    // Agent's payload would, that it need not be flagged.
    criteria: { ...allMet, q13: 'not_met' },
    flagged: false,
  },
  {
    // The clean chart that used to arrive as a critical failure: a literal
    // answer to the form's own reversed wording.
    incidentNumber: '900000002',
    criteria: { ...allMet, q14: 'No', q15: 'No' },
  },
  {
    incidentNumber: '900000003',
    criteria: { q1: 'met', documentation: 'not_met', 'q13 clinical decisions': 'met' },
  },
])

const charts = m.getState().charts.filter((c) => c.periodId === period.id)
const byRun = new Map(charts.map((c) => [c.incidentNumber, c]))

const failed = byRun.get('900000001')
ok(
  failed.review.scorePct === 89 && failed.review.criticalFail === true && failed.review.flagged === true,
  'a chart that misses a critical item is flagged although it scores 89%',
  `score ${failed.review.scorePct} criticalFail ${failed.review.criticalFail} flagged ${failed.review.flagged}`,
)

const clean = byRun.get('900000002')
ok(
  clean.review.scores.q14 === 'met' && clean.review.scores.q15 === 'met',
  'a literal "No" to the reversed questions imports as Met',
  JSON.stringify({ q14: clean.review.scores.q14, q15: clean.review.scores.q15 }),
)
ok(
  clean.review.scorePct === 100 && clean.review.criticalFail === false && clean.review.flagged === false,
  'so the clean chart scores 100 and is not flagged',
  `score ${clean.review.scorePct} criticalFail ${clean.review.criticalFail} flagged ${clean.review.flagged}`,
)

const guessed = byRun.get('900000003')
ok(
  guessed.review.scores.q1 === 'met' && guessed.review.scores.q13 === 'met',
  'the keys that do resolve are scored',
  JSON.stringify(guessed.review.scores),
)
ok(
  guessed.review.scores.q11 === undefined,
  'an unresolvable key does not land on the question whose label contains it',
  JSON.stringify(guessed.review.scores),
)
ok(
  res.unmatched.length === 1 && res.unmatched[0].key === 'documentation',
  'and it is reported to the importer instead of being guessed at',
  JSON.stringify(res.unmatched),
)

// A reviewer working by hand gets the same rule, so the two paths cannot
// disagree about the same chart.
m.addCharts(period.id, 'kc', [{ incidentNumber: '900000004' }])
const manual = m.getState().charts.find((c) => c.incidentNumber === '900000004')
m.saveReview(manual.id, { ...allMet, q5: 'not_met' }, '', 'Hunter', false)
const manualSaved = m.getState().charts.find((c) => c.id === manual.id)
ok(
  manualSaved.review.criticalFail === true && manualSaved.review.flagged === true,
  'a manual review that marks a critical item Not met is flagged without ticking the box',
  `criticalFail ${manualSaved.review.criticalFail} flagged ${manualSaved.review.flagged}`,
)

console.log(`\n  ${m.QA_RUBRIC.length} rubric items · ${m.QA_RUBRIC.filter((c) => c.critical).length} critical · ${
  m.QA_RUBRIC.filter((c) => c.reversed).length
} reversed`)

if (fails.length) {
  console.error(`\ncheck-bot-bridge: ${fails.length} of ${checks} checks failed`)
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log(`\ncheck-bot-bridge: ${checks} checks passed`)
