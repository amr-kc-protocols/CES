// Consistency check for the AEMT course plan.
//
// The hour figures used to be typed by hand in three places that quietly
// disagreed: the proposal's §2 filed 110 didactic hours, its §3 block table
// summed to 90, and the 16-week Tue/Thu calendar could hold neither. They are
// derived from the course text now, and these assertions are what keep them
// derived.
//
// It also loads the module for its own sake. Deriving the targets introduced a
// temporal dead zone — KC_HOUR_TARGETS called blockPlanTotals() at module
// evaluation while KC_BLOCK_PLAN was still declared below it — and that is a
// crash on app startup that `tsc` and `vite build` both pass clean. Importing
// the module here is the cheapest way to never ship it twice.
//
// Run: node scripts/check-course-plan.mjs
import { rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src')
const OUT = join(tmpdir(), `ces-plan-check-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `export * from ${JSON.stringify(join(SRC, 'data/aemt'))}`,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
})

let m
try {
  m = await import(pathToFileURL(OUT).href)
} catch (err) {
  console.log('FAIL  data/aemt.ts throws on load — the app would not start')
  console.log(`      ${err.message}`)
  rmSync(OUT, { force: true })
  process.exit(1)
}

const t = m.blockPlanTotals()
let failed = 0
const check = (ok, label, detail) => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok && detail) console.log(`        ${detail}`)
}

check(true, 'data/aemt.ts loads without throwing')

// Every chapter is either taught or explicitly carried forward from EMT.
const un = m.unscheduledChapters()
check(
  un.length === 0,
  'every non-carry-forward chapter is scheduled in a block',
  un.map((c) => `ch ${c.n} ${c.title}`).join('; '),
)

// No chapter is taught twice — double-counted lecture time inflates the hours.
const seen = new Map()
for (const b of m.KC_BLOCK_PLAN) {
  for (const c of b.chapters ?? []) seen.set(c, (seen.get(c) ?? 0) + 1)
}
const dupes = [...seen].filter(([, n]) => n > 1).map(([c]) => `ch ${c}`)
check(dupes.length === 0, 'no chapter is taught in more than one block', dupes.join(', '))

// The filed targets must equal what the plan builds, or seedShortfall reports
// a gap on every course forever — which is how the 20-hour discrepancy hid.
check(
  m.KC_HOUR_TARGETS.find((h) => h.id === 'didactic').hours === t.didactic,
  'filed didactic target equals the block plan',
)
check(
  m.KC_HOUR_TARGETS.find((h) => h.id === 'lab').hours === t.lab,
  'filed lab target equals the block plan',
)
check(
  m.KC_CLASSROOM_TARGET === t.classroom,
  'classroom target equals didactic + lab',
  `${m.KC_CLASSROOM_TARGET} vs ${t.classroom}`,
)

// Only the AHA blocks may state hours outright; everything else derives.
const typed = m.KC_BLOCK_PLAN.filter(
  (b) => typeof b.fixedDidacticHours === 'number' && (b.chapters ?? []).length > 0,
)
check(
  typed.length === 0,
  'no block both names chapters and hard-codes its hours',
  typed.map((b) => `block ${b.order}`).join(', '),
)

// A block with skill drills behind it and no lab time is the failure this
// rebuild found: chapter 13 carries 13 drills and had zero lab hours.
const noLab = m.KC_BLOCK_PLAN.filter((b) => m.blockSkillDrills(b) >= 5 && b.labHours === 0)
check(
  noLab.length === 0,
  'every block with 5+ skill drills has lab time',
  noLab.map((b) => `block ${b.order} (${m.blockSkillDrills(b)} drills)`).join(', '),
)

// The calendar has to be able to hold the content at a plausible class day.
const perDay = m.classDayLoad()
check(perDay > 0 && perDay <= 6, 'mean class day is within 6 hours', `${perDay.toFixed(2)} h`)

// The mean on its own is false comfort: it passed while the airway block asked
// for a fourteen-hour week over one week and the pharmacology block asked for
// under three. Every block has to fit its own span.
const CAP = 5
const overloaded = m.KC_BLOCK_PLAN.map((b) => ({
  b,
  perDay: (m.blockDidacticHours(b) + b.labHours) / b.spanWeeks / 2,
}))
  // The AHA provider courses are bought-in intensives, not paced by the
  // calendar — PALS and ACLS run long days by design.
  .filter((x) => x.perDay > CAP && typeof x.b.fixedDidacticHours !== 'number')
check(
  overloaded.length === 0,
  `no block exceeds ${CAP} hours per class day`,
  overloaded.map((x) => `block ${x.b.order} (${x.perDay.toFixed(2)} h)`).join(', '),
)

// Lab is an estimate, so it cannot be asserted equal to anything. What can be
// asserted is that it stays in a sane band against the drills behind it — a
// course budgeting 10 minutes or 2 hours per drill has had something typed into
// it by accident.
const labPerDrill = (t.lab * 60) / t.skillDrills
check(
  labPerDrill >= 25 && labPerDrill <= 75,
  'lab hours are within 25-75 min per skill drill',
  `${labPerDrill.toFixed(0)} min per drill across ${t.skillDrills} drills`,
)

console.log(`
  ${t.weeks} weeks · ${t.chaptersTaught} chapters · ${t.lectureHours.toFixed(1)} h publisher lecture
  + ${m.PER_CHAPTER_CLASSROOM_MINUTES} min/chapter classroom + ${t.examHours} h exams + 8 h AHA
  didactic ${t.didactic} · lab ${t.lab} (${labPerDrill.toFixed(0)} min/drill) · classroom ${t.classroom} h · ${perDay.toFixed(2)} h per class day`)

console.log(
  failed === 0
    ? '\nCourse plan is internally consistent.'
    : `\n${failed} check(s) failed.`,
)
rmSync(OUT, { force: true })
process.exit(failed === 0 ? 0 : 1)
