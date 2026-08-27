// Behaviour check for reading the month's KPI figures out of a pasted summary.
//
// Eight operations report twenty-six measures, and the figures in the paste
// become the figures on a compliance document. A reader that gets one wrong
// trades a typo you would catch for one you would not, so it has to be right
// about the things these summaries actually do:
//
//   "Goal: 90%, actual 81.4%" — reading left to right picks the target every
//   single time. The label in front of a percentage decides what it is.
//
//   "EagleMed Wichita" contains "Wichita". The ground business unit must never
//   inherit the air base's figures, because they would arrive carrying bundle
//   compliance for a unit that does not report bundles.
//
//   "Slide 3 of 12" survives a summary and is the same shape as a case count,
//   which would read as 25%.
//
//   Two measures on one line. The figure belongs to the label it follows, not
//   to whichever label is nearest.
//
// And about its own confidence: a figure it had to guess at has to say so,
// because the UI switches the guesses off by default and that is the only thing
// standing between a bad read and a regional director.
//
// Run: node scripts/check-kpi-import.mjs  (or `npm run check:kpiimport`)
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')
const OUT = join(tmpdir(), `ces-deck-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `
      export * from ${JSON.stringify(join(SRC, 'modules/cqmp/kpiParse'))}
      export { CQMP_OPERATIONS } from ${JSON.stringify(join(SRC, 'data/cqmp'))}
    `,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
})
const m = await import(pathToFileURL(OUT).href)
rmSync(OUT, { force: true })

const { readPastedKpis, splitPaste, operationMarks, figuresOn, countsOn, CQMP_OPERATIONS } = m

let checks = 0
const fails = []
const ok = (cond, msg) => {
  checks++
  if (!cond) fails.push(msg)
}

const find = (read, kpiId) => read.findings.find((f) => f.kpiId === kpiId)
const only = (text) => readPastedKpis(text)[0]

// ---------------------------------------------------------------------------
// Splitting the paste. Lines are the unit, and a line naming two operations is
// cut so neither takes the other's figures.

{
  ok(splitPaste('a\n\n  b  \nc').join('|') === 'a|b|c', 'blank lines and padding go')
  const split = splitPaste('Kansas City 88% | Wichita 94%')
  ok(split.length === 2, `a two-operation line is cut in two, got ${split.length}`)
  ok(/Kansas City/.test(split[0]) && !/Wichita/.test(split[0]), 'the first half keeps only its own')
  ok(/Wichita/.test(split[1]) && !/Kansas City/.test(split[1]), 'and so does the second')
  // The name that contains another name must not be cut through the middle.
  ok(splitPaste('EagleMed Wichita 91%').length === 1, 'EagleMed Wichita is one name, not two')
  const marks = operationMarks('EagleMed Wichita and Wichita')
  ok(marks.length === 2, `both are marked, got ${marks.length}`)
  ok(marks[0].opId === 'eaglemed-wichita', 'the air base first')
  ok(marks[1].opId === 'wichita', 'the ground BU second')
}

// ---------------------------------------------------------------------------
// Operation names, including the ones that contain each other.

{
  const opOf = (line) => only(`${line}\nBlood glucose 90%`).opId
  ok(opOf('Kansas City') === 'kc', 'Kansas City')
  ok(opOf('Linn County') === 'linn', 'Linn County')
  ok(opOf('Winfield_April') === 'winfield', 'an underscore is a word boundary too')
  ok(opOf('Independence') === 'independence', 'Independence')
  ok(opOf('Health Star 1') === 'healthstar1', 'Health Star 1')
  ok(opOf('HealthStar One') === 'healthstar1', 'spelled as one word')
  ok(opOf('EagleMed Chanute') === 'eaglemed-chanute', 'EagleMed Chanute')
  ok(opOf('Chanute') === 'eaglemed-chanute', 'Chanute alone is the Chanute base')

  // The trap: the air base's name contains the ground BU's name.
  ok(opOf('EagleMed Wichita') === 'eaglemed-wichita', 'EagleMed Wichita is the air base')
  ok(opOf('EagleMed-Wichita') === 'eaglemed-wichita', 'hyphenated, still the air base')
  ok(opOf('Wichita') === 'wichita', 'and Wichita alone is the ground BU')

  const nameless = only('Blood glucose verification: 88%')
  ok(nameless.opId === undefined, 'a paste naming nobody is not guessed at')
  ok(
    nameless.findings.every((f) => f.confidence === 'uncertain'),
    'and anything read from it is uncertain',
  )
}

// ---------------------------------------------------------------------------
// Figures, and the labels that decide what they mean.

{
  const f = figuresOn('Blood Glucose Verification   Goal: 90%   Actual: 81.4%')
  ok(f.length === 2, `both percentages seen, got ${f.length}`)
  ok(f.find((x) => x.value === 90).kind === 'target', 'the one after "Goal" is a target')
  ok(f.find((x) => x.value === 81.4).kind === 'result', 'the one after "Actual" is a result')
  ok(figuresOn('Compliance 94%')[0].kind === 'result', '"compliance" marks a result')
  ok(figuresOn('94%')[0].kind === 'plain', 'a bare percentage is neither')
  ok(figuresOn('Target 90% benchmark')[0].kind === 'target', 'target before the number')
  ok(figuresOn('140%').length === 0, 'a percentage above 100 is not a compliance rate')
}

{
  const c = countsOn('Advanced airway verification: 12 of 15 documented')
  ok(c.length === 1 && c[0].numerator === 12 && c[0].denominator === 15, '"12 of 15" reads as counts')
  ok(countsOn('12/15 charts').length === 1, 'and so does "12/15"')
  ok(countsOn('Slide 3 of 12   Blood glucose 9 of 10').length === 1, 'slide numbering is not a count')
  ok(countsOn('Slide 3 of 12   Blood glucose 9 of 10')[0].numerator === 9, 'and the real count survives')
  ok(countsOn('Page 2 of 8').length === 0, 'page numbering either')
  ok(countsOn('20 of 15').length === 0, 'a numerator above its denominator is not a rate')
  ok(countsOn('5 of 0').length === 0, 'and nothing is out of zero')
}

// ---------------------------------------------------------------------------
// A realistic summary of one operation.

{
  const r = only(`Linn County — April 2026
Blood Glucose Verification: goal 90%, actual 96.2% (25 of 26 AMS patients)
Advanced Airway Verification: goal 90%, actual 100% (4 of 4)
Stroke Bundle Compliance: goal 90%, actual 82.4% (14 of 17). Two charts missing last known well.
STEMI Bundle Compliance: goal 90%, actual 91.7% (11 of 12)`)

  ok(r.opId === 'linn', `matched to Linn County, got ${r.opId}`)
  ok(r.findings.length === 4, `all four measures found, got ${r.findings.length}`)

  const glucose = find(r, 'glucose')
  ok(glucose.value === 96.2, `glucose is the actual, not the goal — got ${glucose.value}`)
  ok(glucose.target === 90, `and the goal is captured as the target, got ${glucose.target}`)
  ok(glucose.numerator === 25 && glucose.denominator === 26, 'with the case counts')
  ok(glucose.confidence === 'read', `a clean line is a confident read, got ${glucose.confidence}`)
  ok(glucose.line === 2, `and names its line, got ${glucose.line}`)
  ok(/Blood Glucose/i.test(glucose.because), `and quotes it: "${glucose.because}"`)

  ok(find(r, 'airway').value === 100, 'airway at 100%')
  ok(find(r, 'stroke').value === 82.4, 'stroke below goal')
  ok(find(r, 'stemi').value === 91.7, 'STEMI above it')
  ok(r.problems.length === 0, `nothing to flag on a clean paste, got ${r.problems.join('; ')}`)
  ok(r.findings.every((f) => f.value !== 90), 'no measure was filled in with the 90% goal')
}

// ---------------------------------------------------------------------------
// One paste covering the whole region.

{
  const reads = readPastedKpis(`Kansas City
Blood glucose verification: 88%
Advanced airway verification: 92%

Health Star 1
Blood glucose verification: 93%
Stroke bundle compliance: 88%

EagleMed Chanute
Blood glucose verification: 97%
STEMI bundle compliance: 75%`)

  ok(reads.length === 3, `three operations found, got ${reads.length}`)
  const at = (id) => reads.find((r) => r.opId === id)
  ok(!!at('kc') && !!at('healthstar1') && !!at('eaglemed-chanute'), 'all three identified')
  ok(find(at('kc'), 'glucose').value === 88, 'Kansas City glucose 88')
  ok(find(at('healthstar1'), 'glucose').value === 93, 'Health Star glucose 93')
  ok(find(at('healthstar1'), 'stroke').value === 88, 'Health Star stroke 88')
  ok(find(at('eaglemed-chanute'), 'glucose').value === 97, 'EagleMed Chanute glucose 97')
  ok(find(at('eaglemed-chanute'), 'stemi').value === 75, 'EagleMed Chanute STEMI 75')
  ok(!find(at('eaglemed-chanute'), 'stroke'), 'and the heading boundary held — no bleed between them')
  ok(
    at('healthstar1').opConfidence === 'read',
    'a heading on its own line is a confident match',
  )
}

// ---------------------------------------------------------------------------
// Two measures on one line: each figure goes to the label it follows.

{
  const r = only(`Independence
Blood Glucose Verification 91% | Advanced Airway Verification 78%`)
  ok(find(r, 'glucose').value === 91, `glucose takes its own figure, got ${find(r, 'glucose')?.value}`)
  ok(find(r, 'airway').value === 78, `airway takes its own, got ${find(r, 'airway')?.value}`)
  ok(
    r.findings.every((f) => f.confidence === 'inferred'),
    'and both are marked inferred, because a choice was made',
  )
}

// ---------------------------------------------------------------------------
// The paste disagreeing with itself, and saying so.

{
  const r = only(`Winfield
Blood Glucose Verification actual: 95% (12 of 20 patients)`)
  const glucose = find(r, 'glucose')
  ok(glucose.value === 95, 'the stated percentage is what was reported, so it is kept')
  ok(glucose.confidence === 'uncertain', 'but the read is marked uncertain')
  ok(
    r.problems.some((p) => /works out to 60%/.test(p)),
    `and the disagreement is spelled out: ${r.problems.join('; ')}`,
  )
}

// ---------------------------------------------------------------------------
// A measure the operation does not report is a sign the line is misfiled.

{
  const r = only(`Kansas City
Blood Glucose Verification actual: 88%
Stroke Bundle Compliance actual: 91%`)
  ok(r.opId === 'kc', 'matched to Kansas City')
  ok(!!find(r, 'glucose'), 'the measure it does report is read')
  ok(!find(r, 'stroke'), 'the one it does not report is refused')
  ok(r.problems.some((p) => /does not report/.test(p)), `and says why: ${r.problems.join('; ')}`)
  ok(
    CQMP_OPERATIONS.find((o) => o.id === 'kc').kpis.includes('stroke') === false,
    'because Kansas City is interfacility and does not carry the bundles',
  )
}

// ---------------------------------------------------------------------------
// Nothing to read.

{
  const r = only('Everyone did fine this month, no concerns raised.')
  ok(r.findings.length === 0, 'prose with no figures yields none')
  ok(
    r.problems.some((p) => /needs the measure and its percentage together/.test(p)),
    'and says what shape the lines need to be in',
  )
  ok(readPastedKpis('').length >= 0, 'an empty paste does not throw')
}

{
  // A summary table at the top and detail below: the detail wins.
  const r = only(`Winfield
Blood glucose 88%
Blood glucose verification: 91.5% (61 of 67)`)
  ok(r.findings.length === 1, `one figure for one measure, got ${r.findings.length}`)
  ok(find(r, 'glucose').value === 91.5, `the later, fuller line wins, got ${find(r, 'glucose').value}`)
  ok(find(r, 'glucose').numerator === 61, 'and brings its counts')
}

if (fails.length) {
  console.error(`check-kpi-import: ${fails.length} of ${checks} checks failed\n`)
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log(`check-kpi-import: ${checks} checks passed`)
