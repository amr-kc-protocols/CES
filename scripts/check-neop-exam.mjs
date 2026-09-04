// Consistency check for the NEOP selection exam.
//
// Three files have to agree, and none of them can see the others at runtime:
// the question bank (scripts/neop-exam-bank.mjs, which is deliberately outside
// src/ so no answer key is ever bundled into the app), the candidate briefing
// (src/data/kcOperation.ts), and the interview instrument
// (src/data/neopSelection.ts, which carries the probe and the reading of each
// preference option positionally).
//
// What these assertions are actually protecting:
//
//   - An operations item whose `ref` names a briefing section that does not
//     exist. The candidate is asked about our operation from a document that
//     never told them the answer, which measures whether they already work
//     here — the opposite of the point.
//   - A preference item with an answer key, or a scored item without one. The
//     database constraint catches this too; catching it here means catching it
//     before it reaches the database.
//   - A signals array that has slipped out of step with its options, which
//     would print the wrong flag beside a real person's answer.
//   - A duplicate code, which the upsert would turn into one item quietly
//     overwriting another.
//   - The generated seed SQL drifting from the bank it was generated from.
//
// Run: node scripts/check-neop-exam.mjs  (or `npm run check:neop`)
import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'
import { CLINICAL, OPERATIONS, FIT } from './neop-exam-bank.mjs'
import {
  buildInstallSql,
  buildSeedSql,
  INSTALL_PARTS,
  INSTALL_PATH,
  SEED_PATH,
  items,
} from './gen-neop-exam.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src')
const OUT = join(tmpdir(), `ces-neop-exam-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `
      export { KC_BRIEFING, NEEDS_CONFIRMATION } from ${JSON.stringify(join(SRC, 'data/kcOperation'))}
      export { NEOP_SECTIONS, FIT_ITEMS, NEOP_THRESHOLDS } from ${JSON.stringify(join(SRC, 'data/neopSelection'))}
      export { EXAM_PROGRAMS } from ${JSON.stringify(join(SRC, 'lib/exam'))}
    `,
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
} finally {
  rmSync(OUT, { force: true })
}

const { KC_BRIEFING, NEEDS_CONFIRMATION, NEOP_SECTIONS, FIT_ITEMS, EXAM_PROGRAMS } = m

let failures = 0
const fail = (msg, detail) => {
  failures++
  console.log(`FAIL  ${msg}`)
  if (detail) console.log(`      ${detail}`)
}
const pass = (msg) => console.log(`ok    ${msg}`)

// ----- every item is well formed -------------------------------------------
const all = items()
const bad = []
for (const i of all) {
  if (!i.code || !/^[a-z0-9-]+$/.test(i.code)) bad.push(`${i.code}: code must be lower-case kebab`)
  if (!i.stem || !i.stem.trim()) bad.push(`${i.code}: empty stem`)
  if (!Array.isArray(i.options) || i.options.length !== 4)
    bad.push(`${i.code}: needs exactly 4 options, has ${i.options?.length}`)
  if (new Set(i.options).size !== i.options.length) bad.push(`${i.code}: duplicate options`)
  if (i.section === 'fit') {
    if (i.answer !== null && i.answer !== undefined)
      bad.push(`${i.code}: preference items must have answer: null — this one is keyed`)
  } else if (!Number.isInteger(i.answer) || i.answer < 0 || i.answer > 3) {
    bad.push(`${i.code}: scored item needs an answer index 0-3, has ${i.answer}`)
  }
}
if (bad.length) fail(`${bad.length} malformed item(s)`, bad.join('\n      '))
else pass(`${all.length} items well formed (${CLINICAL.length} clinical, ${OPERATIONS.length} operations, ${FIT.length} preference)`)

// ----- codes are unique ----------------------------------------------------
const dupes = all.map((i) => i.code).filter((c, n, xs) => xs.indexOf(c) !== n)
if (dupes.length) fail(`duplicate item codes: ${[...new Set(dupes)].join(', ')}`)
else pass('every item code is unique')

// ----- operations items key to a briefing section --------------------------
const refs = new Set(KC_BRIEFING.map((s) => s.ref))
const orphans = OPERATIONS.filter((i) => !refs.has(i.ref)).map((i) => `${i.code} -> ${i.ref}`)
if (orphans.length)
  fail('operations items reference briefing sections that do not exist', orphans.join('\n      '))
else pass(`all ${OPERATIONS.length} operations items key to a briefing section`)

// A briefing section nothing asks about is not an error, but it is worth
// knowing: it is a section a candidate has no reason to read carefully.
const unasked = [...refs].filter((r) => !OPERATIONS.some((i) => i.ref === r))
if (unasked.length) console.log(`note  briefing sections with no exam item: ${unasked.join(', ')}`)

// ----- the bank can fill the draw ------------------------------------------
for (const spec of NEOP_SECTIONS) {
  if (spec.draw === null) continue
  const n = all.filter((i) => i.section === spec.id && i.answer !== null).length
  if (n < spec.draw) fail(`${spec.id}: draw is ${spec.draw} but the bank has ${n}`)
  else if (n < spec.draw * 1.5)
    console.log(
      `note  ${spec.id}: ${n} items for a draw of ${spec.draw} — two candidates will see much the same exam`,
    )
  else pass(`${spec.id}: ${n} items for a draw of ${spec.draw}`)
}

// ----- preference items line up with the interview instrument --------------
const fitCodes = new Set(FIT.map((i) => i.code))
const probeCodes = new Set(FIT_ITEMS.map((f) => f.code))
const noProbe = [...fitCodes].filter((c) => !probeCodes.has(c))
const noItem = [...probeCodes].filter((c) => !fitCodes.has(c))
if (noProbe.length)
  fail(
    'preference items with no entry in src/data/neopSelection.ts',
    `${noProbe.join(', ')} — the interviewer would see the answer with no probe beside it`,
  )
if (noItem.length)
  fail(
    'entries in src/data/neopSelection.ts with no item in the bank',
    `${noItem.join(', ')} — a probe for a question nobody is asked`,
  )
if (!noProbe.length && !noItem.length) pass(`all ${FIT.length} preference items have an interview probe`)

const misaligned = FIT_ITEMS.filter((f) => {
  const item = FIT.find((i) => i.code === f.code)
  return item && f.signals.length !== item.options.length
}).map((f) => f.code)
if (misaligned.length)
  fail(
    'signal maps that do not match their options one-for-one',
    `${misaligned.join(', ')} — signals are positional, so this puts the wrong flag on a real answer`,
  )
else pass('every signal map lines up with its options')

// ----- the preference section has to stay non-obvious ----------------------
// Transparency is a property a human has to judge — whether an option reads as
// the wanted one cannot be computed. These catch the two relapses that CAN be:
// an item with two "right" answers, and an option that names the job back at
// the candidate.
const twoRight = FIT_ITEMS.filter(
  (f) => f.signals.filter((x) => x === 'consistent').length > 1,
).map((f) => f.code)
if (twoRight.length)
  fail(
    'preference items with more than one option marked consistent',
    `${twoRight.join(', ')} — two right answers is the same as none`,
  )
else pass('no preference item has two preferred answers')

const withLean = FIT_ITEMS.filter((f) => f.signals.includes('discuss')).length
if (withLean < 8)
  fail(
    `only ${withLean} preference items carry a lean toward scene or fire work`,
    'the interviewer is shown a pattern across the section, and a pattern needs items — at least 8',
  )
else pass(`${withLean} of ${FIT_ITEMS.length} preference items carry a lean`)

// Phrases that hand a candidate the answer. Extend the list, do not weaken it.
const TELLS = ['described above', 'the work described', 'as described']
const tells = []
for (const i of FIT) {
  for (const text of [i.stem, ...i.options]) {
    const hit = TELLS.find((t) => text.toLowerCase().includes(t))
    if (hit) tells.push(`${i.code}: "${hit}"`)
  }
}
if (tells.length)
  fail('preference options that point back at the job description', tells.join('\n      '))
else pass('no preference option quotes the job description back at the candidate')

// ----- the generated SQL is current ----------------------------------------
let onDisk = ''
try {
  onDisk = readFileSync(SEED_PATH, 'utf8')
} catch {
  /* reported below */
}
if (onDisk !== buildSeedSql())
  fail(
    'supabase/neop_exam_questions_seed.sql is out of date',
    'run: node scripts/gen-neop-exam.mjs',
  )
else pass('the generated seed SQL matches the bank')

// ----- reordered options under a reused code --------------------------------
// exam_attempts.responses stores an option INDEX, so reordering the options of
// an item that keeps its code silently changes what every stored answer meant.
// Rewording in place is fine and is the point of the upsert; reordering is not.
//
// Compared against the seed as of the last commit, and only when git is
// available — a shallow clone or an exported tarball skips this rather than
// failing on it. A warning, not a failure: on a bank nobody has sat yet it is
// harmless, and only the author knows which of the two it is.
try {
  const { execFileSync } = await import('node:child_process')
  const prev = execFileSync('git', ['show', 'HEAD:supabase/neop_exam_questions_seed.sql'], {
    cwd: join(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const parse = (txt) => {
    const rows = new Map()
    const re =
      /\('(?:clinical|operations|fit)', '([a-z0-9-]+)', '(?:[^']|'')*', '(?:[^']|'')*', array\[((?:'(?:[^']|'')*',?)+)\]/g
    for (const m of txt.matchAll(re)) {
      rows.set(m[1], (m[2].match(/'(?:[^']|'')*'/g) ?? []).map((o) => o.slice(1, -1)))
    }
    return rows
  }
  const before = parse(prev)
  const after = parse(buildSeedSql())
  const reordered = []
  for (const [code, opts] of after) {
    const was = before.get(code)
    if (!was) continue
    // Same set of options in a different order is the dangerous case. A changed
    // set is either a reword (fine) or a redefinition (the author's call).
    if (was.length === opts.length && was.join('|') !== opts.join('|')) {
      const sameSet = [...was].sort().join('|') === [...opts].sort().join('|')
      if (sameSet) reordered.push(code)
    }
  }
  if (reordered.length)
    console.log(
      `note  options reordered under a reused code: ${reordered.join(', ')} — give these a NEW code if any attempt has already served them`,
    )
} catch {
  // No git, no previous seed, or a first commit. Nothing to compare against.
}

// ----- the one-paste installer is current -----------------------------------
let installed = ''
try {
  installed = readFileSync(INSTALL_PATH, 'utf8')
} catch {
  /* reported below */
}
if (installed !== buildInstallSql())
  fail(
    'supabase/neop_install.sql is out of date',
    'run: node scripts/gen-neop-exam.mjs — this is the file somebody pastes into a live project',
  )
else pass('the one-paste installer matches the migrations and the bank')

// ----- what actually closes the exam ---------------------------------------
// Twice now the exam has been shut when it was meant to be open, and both times
// the cause was the same shape: the cutoff is a constant compiled into
// exam_start, several files define exam_start, and only some of them moved.
//
// The second time was worse than the first. The reopen migration was written,
// merged and run, and the exam stayed shut — because neop_install.sql, the file
// this repo tells you to paste when the exam looks broken, was generated from a
// list of migrations that had not been told about the reopen. Pasting it put
// the expired constant back. The obvious remedy re-broke it.
//
// So: every migration that redefines exam_start must be in the installer, and
// the cutoff that ends up installed must be the one the client advertises.
const MIGRATIONS = join(__dirname, '..', 'supabase', 'migrations')
// Same-day migrations carry a sequence number (2026-09-04-1-, -2-) precisely so
// that sorting filenames sorts them in the order they must run.
const redefines = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .filter((f) => readFileSync(join(MIGRATIONS, f), 'utf8').includes('function public.exam_start'))
  .sort()
const listed = INSTALL_PARTS.filter((p) => p[0] === 'migrations').map((p) => p[1])
const newest = redefines[redefines.length - 1]

// Superseded migrations are deliberately NOT in the installer — it starts at
// the one that creates the current signature. What matters is only that the
// definition left standing at the end of the paste is the newest one.
if (listed[listed.length - 1] !== newest)
  fail(
    'the one-paste installer does not end with the newest exam_start migration',
    `installer ends with ${listed[listed.length - 1] ?? 'nothing'}, newest is ${newest}.\n      ` +
      'Add it to INSTALL_PARTS in scripts/gen-neop-exam.mjs and run npm run gen:neop — otherwise ' +
      'pasting neop_install.sql reverts exam_start to an older definition.',
  )
else pass(`the one-paste installer ends with ${newest}`)

if (listed.join('|') !== [...listed].sort().join('|'))
  fail(
    'the installer lists exam_start migrations out of order',
    `the LAST definition in the pasted file wins, so they must run oldest to newest: ${listed.join(', ')}`,
  )
else pass('the installer runs the exam_start migrations oldest to newest')

/**
 * The cutoff each program ends up with, read from the LAST exam_start in a
 * file — which is the definition Postgres is left holding after the paste.
 */
const installedCutoffs = (sql) => {
  // CREATE, not just the name: schema.sql ends with revoke/grant lines naming
  // the same function, and anchoring on the bare name sliced past the body.
  // Both cutoffs then read as absent and this check agreed with a client that
  // advertised no deadline — it passed the exact defect it was written for.
  const at = sql.lastIndexOf('create or replace function public.exam_start')
  if (at < 0) return null
  const body = sql.slice(at)
  // The aemt branch is the `if`, the neop branch the `else`.
  const branch = /if v_program = 'aemt' then([\s\S]*?)\n  else([\s\S]*?)\n  end if;/.exec(body)
  if (!branch) return null
  // No assignment at all means no cutoff, which is the same thing as null.
  const lit = (chunk) => {
    const c = /v_cutoff\s*:=\s*('[^']*'|null)/.exec(chunk)
    return !c || c[1] === 'null' ? null : c[1].slice(1, -1)
  }
  return { aemt: lit(branch[1]), neop: lit(branch[2]) }
}

const SCHEMA_PATH = join(__dirname, '..', 'supabase', 'schema.sql')
const cutoffFailures = failures
for (const [label, path] of [
  ['supabase/neop_install.sql', INSTALL_PATH],
  ['supabase/schema.sql', SCHEMA_PATH],
]) {
  let sql = ''
  try {
    sql = readFileSync(path, 'utf8')
  } catch {
    fail(`${label} is missing`)
    continue
  }
  const got = installedCutoffs(sql)
  // Not finding the function is a failed check, never a quiet pass.
  if (!got) {
    fail(
      `${label}: could not read the per-program branch out of exam_start`,
      'this check cannot see what it is meant to verify — fix the parser, do not ignore it',
    )
    continue
  }
  for (const program of ['aemt', 'neop']) {
    const client = EXAM_PROGRAMS[program].deadlineIso
    const server = got[program]
    if (server === null && client === null) continue
    if (server === null || client === null) {
      fail(
        `${label}: ${program} cutoff disagrees with src/lib/exam.ts`,
        `installed ${server ?? 'no cutoff'}, client advertises ${client ?? 'no deadline'} — ` +
          'the server is what enforces and the client is what candidates read',
      )
      continue
    }
    if (new Date(server.replace(' ', 'T')).getTime() !== new Date(client).getTime())
      fail(
        `${label}: ${program} cutoff is not the deadline candidates are shown`,
        `installed ${server}, client advertises ${client}`,
      )
  }
}
if (failures === cutoffFailures)
  pass('the installed cutoffs are the deadlines the app advertises')

// ----- the honesty ledger --------------------------------------------------
const stale = NEEDS_CONFIRMATION.filter((c) => !refs.has(c.ref)).map((c) => c.ref)
if (stale.length) fail(`NEEDS_CONFIRMATION names sections that no longer exist: ${stale.join(', ')}`)
else if (NEEDS_CONFIRMATION.length)
  console.log(
    `note  ${NEEDS_CONFIRMATION.length} briefing statement(s) still awaiting confirmation from the operation`,
  )

console.log(failures ? `\n${failures} check(s) failed` : '\nNEOP exam: all checks passed')
process.exit(failures ? 1 : 0)
