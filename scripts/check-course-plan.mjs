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
check(perDay > 0 && perDay <= 6, 'longest class day is within 6 hours', `${perDay.toFixed(2)} h`)

// Every class day is exactly the pattern's length. Blocks used to carry their
// own hand-typed spans beside their derived hours, so the two could disagree —
// and did: the airway block asked for fourteen hours in a single week while the
// pharmacology block asked for under three. Spans are derived from the plan now,
// which is what makes this assertion possible at all.
const plan = m.buildClassPlan()
const byDay = new Map()
for (const s of plan) {
  const k = `${s.week}:${s.dayIndex}`
  byDay.set(k, (byDay.get(k) ?? 0) + s.hours)
}
const cap = m.KC_CLASS_PATTERN.hoursPerDay
const overlong = [...byDay].filter(([, h]) => h > cap + 1e-9)
check(
  overlong.length === 0,
  `no class day exceeds the pattern's ${cap} hours`,
  overlong.map(([k, h]) => `${k} = ${h} h`).join(', '),
)

// A week is didactic or lab, never both. That is what 'dedicated lab weeks'
// means, and it is the whole reason the plan interleaves rather than mixing.
const kindsPerWeek = new Map()
for (const s of plan) {
  if (!kindsPerWeek.has(s.week)) kindsPerWeek.set(s.week, new Set())
  kindsPerWeek.get(s.week).add(s.kind)
}
const mixed = [...kindsPerWeek].filter(([, k]) => k.size > 1)
check(
  mixed.length === 0,
  'no week mixes didactic and lab',
  mixed.map(([w]) => `week ${w + 1}`).join(', '),
)

// A lab week may never run before the blocks it practises have been taught.
const taughtBy = new Map()
for (const s of plan) {
  if (s.kind !== 'didactic') continue
  taughtBy.set(s.blockOrder, Math.max(taughtBy.get(s.blockOrder) ?? 0, s.week))
}
const early = plan.filter(
  (s) => s.kind === 'lab' && taughtBy.has(s.blockOrder) && s.week < taughtBy.get(s.blockOrder),
)
check(
  early.length === 0,
  'no lab runs before the block it practises is taught',
  early.map((s) => `block ${s.blockOrder} lab in week ${s.week + 1}`).join(', '),
)

// An AHA provider course may span two class days, but never with a lab week in
// between: the interleave used to file the PALS didactic as 3.5 hours in week 3
// and the last half hour in week 6.
const atomicSpread = m.KC_BLOCK_PLAN.filter((b) => b.atomic).flatMap((b) => {
  const weeks = plan.filter((s) => s.blockOrder === b.order && s.kind === 'didactic').map((s) => s.week)
  if (weeks.length === 0) return []
  const span = Math.max(...weeks) - Math.min(...weeks)
  return span > 1 ? [`block ${b.order} spans ${span + 1} weeks`] : []
})
check(
  atomicSpread.length === 0,
  'no AHA provider course is interrupted by a lab week',
  atomicSpread.join(', '),
)

// The laid-out plan must carry exactly the hours the block plan says. Packing
// splits blocks across days; a rounding slip there silently loses class time.
const laidDidactic = plan.filter((s) => s.kind === 'didactic').reduce((n, s) => n + s.hours, 0)
const laidLab = plan.filter((s) => s.kind === 'lab').reduce((n, s) => n + s.hours, 0)
check(
  Math.abs(laidDidactic - t.didactic) < 0.01 && Math.abs(laidLab - t.lab) < 0.01,
  'the laid-out calendar carries the block plan hours exactly',
  `laid ${laidDidactic}/${laidLab}, plan ${t.didactic}/${t.lab}`,
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
  didactic ${t.didactic} · lab ${t.lab} (${labPerDrill.toFixed(0)} min/drill) · classroom ${t.classroom} h
  ${t.weeks} calendar weeks · ${m.KC_CLASS_PATTERN.days.length} x ${m.KC_CLASS_PATTERN.hoursPerDay} h class days · ${plan.length} sessions`)

console.log(
  failed === 0
    ? '\nCourse plan is internally consistent.'
    : `\n${failed} check(s) failed.`,
)
rmSync(OUT, { force: true })
process.exit(failed === 0 ? 0 : 1)
