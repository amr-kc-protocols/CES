// Round-trip check for the instrument editor.
//
// The editor translates four different instrument formats into one shape, lets
// an admin change it, and translates back. Anything the translation forgets is
// silently deleted from the instrument the first time somebody edits it — a
// dropped `cadence` breaks the end-of-course readiness check, a dropped
// `equipmentGroup` puts the cardiac monitor sheet in front of every student,
// and neither would be visible in the editor itself.
//
// So: every bundled instrument goes through toEditor -> fromEditor untouched,
// and must come back deep-equal to what went in.
//
// Run: node scripts/check-templates.mjs
import { rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src')

// esbuild bundles the entry so nested relative imports just work; a hand-rolled
// loader could not follow checkoffSheets -> skillSheets -> lib/market.
const OUT = join(tmpdir(), `ces-templates-check-${process.pid}.mjs`)
await build({
  stdin: {
    contents: `
      export { toEditor, fromEditor } from ${JSON.stringify(join(SRC, 'modules/templates/editorModel'))}
      export { AEMT_SKILL_SHEETS } from ${JSON.stringify(join(SRC, 'data/aemtSkills'))}
      export { AEMT_FORMS } from ${JSON.stringify(join(SRC, 'data/aemtForms'))}
      export { SHEETS } from ${JSON.stringify(join(SRC, 'data/checkoffSheets'))}
      export { BUNDLED_DAILY_EVAL, NEOP_DAILY_EVAL_ID } from ${JSON.stringify(join(SRC, 'data/templateRegistry'))}
    `,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: OUT,
  // templateRegistry imports lib/templates for its side effect, which pulls in
  // react and the store. Stubbed: this check is about the translation, not the
  // registry plumbing.
  plugins: [
    {
      name: 'stub',
      setup(b) {
        b.onResolve({ filter: /lib\/templates$|^react$|lib\/store$|lib\/undo$|lib\/id$/ }, (a) => ({
          path: a.path,
          namespace: 'stub',
        }))
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: 'export function registerBundled(){}; export const uid=()=>"x"; export default {}',
          loader: 'js',
        }))
      },
    },
  ],
})
const mod = await import(pathToFileURL(OUT).href)

// Order-insensitive: the editor rebuilds an object literal, so key order moves
// around. What matters is that no key and no value is lost.
function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null)
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
}
const eq = (a, b) => canonical(a) === canonical(b)

const cases = []
for (const s of mod.AEMT_SKILL_SHEETS) cases.push({ kind: 'aemt-skill', id: s.id, body: s })
for (const f of mod.AEMT_FORMS) cases.push({ kind: 'aemt-form', id: f.id, body: f })
for (const [id, meta] of Object.entries(mod.SHEETS)) {
  cases.push({ kind: 'neop-skill', id, body: meta })
}
cases.push({
  kind: 'neop-daily-eval',
  id: mod.NEOP_DAILY_EVAL_ID,
  body: mod.BUNDLED_DAILY_EVAL,
})

let failed = 0
for (const c of cases) {
  const back = mod.fromEditor(c.kind, mod.toEditor(c.kind, c.id, c.body))
  if (!eq(c.body, back)) {
    failed++
    console.log(`FAIL  ${c.kind} / ${c.id}`)
    const before = Object.keys(c.body).sort()
    const after = Object.keys(back).sort()
    const lost = before.filter((k) => !after.includes(k))
    const gained = after.filter((k) => !before.includes(k))
    if (lost.length) console.log(`        dropped keys: ${lost.join(', ')}`)
    if (gained.length) console.log(`        added keys:   ${gained.join(', ')}`)
    for (const k of before) {
      if (after.includes(k) && !eq(c.body[k], back[k])) console.log(`        changed: ${k}`)
    }
  }
}

console.log(
  failed === 0
    ? `\nok — ${cases.length} instruments round-trip through the editor unchanged.`
    : `\n${failed} of ${cases.length} instruments lose data when edited.`,
)
rmSync(OUT, { force: true })
process.exit(failed === 0 ? 0 : 1)
