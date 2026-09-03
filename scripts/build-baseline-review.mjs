// The baseline diagnostic in two readable forms.
//
//   --key      the review copy: every item with its key marked and its
//              rationale, for the subject-matter review the checks cannot do.
//   (default)  the blank form: the paper a student sits.
//
// Generated from src/data/aemtBaseline.ts, like the SQL seed, so a reviewer's
// copy and the bank a student sits are the same 50 items.

import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const SRC = join(ROOT, 'src')
const OUT = join(tmpdir(), `ces-bl-review-${process.pid}.mjs`)

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
const withKey = process.argv.includes('--key')
const LETTER = ['A', 'B', 'C', 'D']
const DOMAIN_LABEL = Object.fromEntries(m.A.EXAM_BLUEPRINT.map((d) => [d.id, d.label]))

const wrap = (s, width, indent = '') => {
  const out = []
  let line = ''
  for (const w of s.split(' ')) {
    if ((line + ' ' + w).trim().length > width) {
      out.push(line.trim())
      line = w
    } else line += ' ' + w
  }
  if (line.trim()) out.push(line.trim())
  return out.map((l, i) => (i === 0 ? l : indent + l)).join('\n')
}

const L = []
L.push('AEMT DAY-ONE BASELINE DIAGNOSTIC')
L.push(withKey ? 'REVIEW COPY — ANSWER KEY AND RATIONALE' : 'STUDENT FORM')
L.push('')
if (withKey) {
  L.push('50 items. UNGRADED — this seeds the per-student domain tracker so every')
  L.push('later measurement has a zero point. It decides nothing.')
  L.push('')
  L.push('SCOPE IS EMT. Every item should be answerable by a certified EMT on the')
  L.push('day they walk in. An item needing the course to answer measures nothing.')
  L.push('')
  L.push('WHAT TO LOOK FOR, since the automated checks cannot:')
  L.push('  - Is the keyed answer clinically correct, and is it the BEST option')
  L.push('    rather than merely a defensible one?')
  L.push('  - Is any distractor actually correct, or defensible under some protocol?')
  L.push('  - Does any item turn on a number that has moved between guideline')
  L.push('    editions, or on local protocol rather than national standard?')
  L.push('  - Is any item below or above EMT level?')
  L.push('')
  L.push('Mark items by code. BD-42 (cannula percentage) and BD-33 (compression')
  L.push('depth) are the two most worth a second look.')
} else {
  L.push('50 items. Choose the ONE BEST answer for each.')
  L.push('This is ungraded and does not affect your standing in the course.')
  L.push('')
  L.push('Name: ______________________________   Date: ______________')
}
L.push('')
L.push('='.repeat(72))

let n = 0
let lastDomain = ''
for (const it of ITEMS) {
  if (it.domain !== lastDomain) {
    lastDomain = it.domain
    const count = ITEMS.filter((x) => x.domain === it.domain).length
    L.push('')
    L.push(`--- ${DOMAIN_LABEL[it.domain]} (${count} items) ${'-'.repeat(Math.max(0, 44 - DOMAIN_LABEL[it.domain].length))}`)
  }
  n++
  L.push('')
  L.push(`${String(n).padStart(2)}. [${it.code}] ${wrap(it.stem, 68, '    ')}`)
  L.push('')
  it.options.forEach((o, i) => {
    const mark = withKey && i === it.answer ? '*' : ' '
    L.push(`   ${mark}${LETTER[i]}) ${wrap(o, 63, '       ')}`)
  })
  if (withKey) {
    L.push('')
    L.push(`      KEY: ${LETTER[it.answer]}`)
    L.push(`      ${wrap(it.rationale, 64, '      ')}`)
  }
}

L.push('')
L.push('='.repeat(72))
if (withKey) {
  L.push('')
  L.push('ANSWER KEY')
  L.push('')
  for (let i = 0; i < ITEMS.length; i += 5) {
    L.push(
      '  ' +
        ITEMS.slice(i, i + 5)
          .map((it, j) => `${String(i + j + 1).padStart(2)}. ${LETTER[it.answer]}`)
          .join('    '),
    )
  }
  L.push('')
  L.push('DOMAIN MIX, against the certification exam blueprint')
  L.push('')
  for (const d of m.A.EXAM_BLUEPRINT) {
    const c = ITEMS.filter((x) => x.domain === d.id).length
    L.push(
      `  ${String(c).padStart(2)}  ${String(Math.round((c / ITEMS.length) * 100)).padStart(2)}%  ${d.label.padEnd(34)} blueprint ${d.examMin}-${d.examMax}%`,
    )
  }
}
L.push('')
L.push('Generated from src/data/aemtBaseline.ts — mark up by item code; edits go')
L.push('to the source, and `npm run sql:baseline` reloads the bank from it.')
L.push('')

const out = resolve(
  process.argv.find((a) => a.endsWith('.txt')) ??
    join(ROOT, 'build', withKey ? 'AEMT-Baseline-Diagnostic-REVIEW.txt' : 'AEMT-Baseline-Diagnostic-STUDENT.txt'),
)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, L.join('\n'))
console.log(`Wrote ${out}  (${ITEMS.length} items)`)
