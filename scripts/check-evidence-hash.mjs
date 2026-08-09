// Regression check for the audit package's tamper-evidence claim.
//
// The packet instructs an auditor: "Re-hashing that bundle must reproduce the
// value above." That only holds if canonical() — which runs over the LIVE
// records to produce the printed fingerprint — agrees with what JSON.stringify
// writes into the downloaded .json bundle.
//
// It did not. canonical() walked Object.keys(), which includes keys explicitly
// set to undefined, and serialised them as null; JSON.stringify drops them
// entirely. Every course that had ever had a shift attestation withdrawn or a
// skill sign-off revoked — both of which write `undefined` over a field rather
// than deleting it — shipped a packet whose fingerprint could not be checked.
//
// Run: node scripts/check-evidence-hash.mjs
// Exits non-zero on failure, so it can gate a release.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { transformSync } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src', 'modules', 'aemt', 'evidence.ts')

// Pull canonical() out of the real module rather than restating it here — a
// copy of the function under test proves nothing about the function shipped.
const ts = readFileSync(SRC, 'utf8')
  .replace(/^import[\s\S]*?from[^\n]*\n/gm, '')
  .replace(/^function canonical/m, 'export function canonical')
const js = transformSync(ts, { loader: 'ts', format: 'esm' }).code
const { canonical } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
)

const sha = (s) => createHash('sha256').update(s).digest('hex')

const cases = [
  {
    name: 'shift with a withdrawn attestation',
    records: { shifts: [{ id: 'ashift_1', hours: 12, attestedAt: undefined, attestation: undefined }] },
  },
  {
    name: 'skill check with a revoked sign-off',
    records: { skillChecks: [{ sheetId: 's1', passedDate: undefined, results: { a: 'pass' } }] },
  },
  {
    name: 'nested undefined',
    records: { course: { targets: { didactic: 110, lab: undefined } } },
  },
  {
    name: 'array holes',
    records: { encounters: [1, undefined, 3] },
  },
  {
    name: 'key order must not depend on construction',
    records: { a: { z: 1, a: 2 }, b: { a: 2, z: 1 } },
  },
  {
    name: 'zero and empty string survive',
    records: { targets: { lab: 0, note: '' } },
  },
]

let failed = 0
for (const c of cases) {
  // What the packet prints, against what a verifier computes from the file.
  const live = sha(canonical(c.records))
  const downloaded = sha(canonical(JSON.parse(JSON.stringify(c.records))))
  const ok = live === downloaded
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${c.name}`)
  if (!ok) {
    console.log(`        live       ${canonical(c.records)}`)
    console.log(`        downloaded ${canonical(JSON.parse(JSON.stringify(c.records)))}`)
  }
}

// A zero-value guard: an empty object and an object of only-undefined keys must
// hash alike, because that is what the round trip turns one into.
const emptyMatches = canonical({ a: undefined }) === canonical({})
if (!emptyMatches) {
  failed++
  console.log('FAIL  an all-undefined object must canonicalise as empty')
} else {
  console.log('ok    an all-undefined object canonicalises as empty')
}

console.log(
  failed === 0
    ? '\nEvidence fingerprints reproduce from the downloaded bundle.'
    : `\n${failed} case(s) failed — the packet's verification instructions are not true.`,
)
process.exit(failed === 0 ? 0 : 1)
