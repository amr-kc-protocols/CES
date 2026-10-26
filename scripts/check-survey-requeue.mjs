// Behaviour check for the one-time re-send of stranded FTO exit surveys
// (requeueStrandedSurveys in lib/sync.ts).
//
// Until 2026-10-26-2-fto-survey-push.sql every survey pushed from an FTO's
// device was refused and then never sent again, so the only copy is on that
// device. The re-send is the one chance to recover them, and the order things
// happen in is not under our control: the app update can reach an FTO's phone
// before anyone runs the migration. So the thing to pin down is that nothing
// counts as done until the server has actually taken something:
//
//   - with the migration not yet applied, every send is refused — try again
//     next sign-in, do not give up after one
//   - offline mid-way — not an answer, try again, and do not burn a try
//   - nothing to send yet — not done; only an accepted survey proves the fix
//     is live
//   - once anything is accepted — done; a survey refused alongside it is one
//     the server already settled (an administrator edited or removed it)
//   - a refusal that never changes — stop after the cap, not forever
//
// Run: node scripts/check-survey-requeue.mjs  (or `npm run check:requeue`)
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

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
globalThis.window ??= globalThis
globalThis.document ??= { addEventListener() {}, visibilityState: 'visible' }

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')
const OUT = join(tmpdir(), `ces-requeue-${process.pid}.mjs`)
await build({
  stdin: {
    contents: `
      export { requeueStrandedSurveys } from ${JSON.stringify(join(SRC, 'lib/sync'))}
      export { setState, getState } from ${JSON.stringify(join(SRC, 'lib/store'))}
    `,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
})
const { requeueStrandedSurveys, setState } = await import(pathToFileURL(OUT).href)
rmSync(OUT, { force: true })

let checks = 0
const fails = []
const ok = (cond, msg) => {
  checks++
  if (!cond) fails.push(msg)
}

const KEY = 'ces.cloud.surveyRequeue.v1'
const flag = () => JSON.parse(mem.get(KEY) ?? '{}')
const RLS = { code: '42501', message: 'new row violates row-level security policy for table "records"' }

// A client whose answer per survey id is scripted: 'ok', 'rls', or 'offline'.
function client(answers) {
  const sent = []
  return {
    sent,
    from: (table) => ({
      upsert: async (row, opts) => {
        if (table !== 'records' || opts?.onConflict !== 'market,collection,id') throw new Error('unexpected call shape')
        sent.push(row)
        const a = answers[row.id] ?? 'ok'
        if (a === 'offline') throw new TypeError('Failed to fetch')
        return { error: a === 'rls' ? RLS : null }
      },
    }),
  }
}
const surveys = (...ids) =>
  setState((db) => ({ ...db, surveyResponses: ids.map((id) => ({ id, traineeId: 't1', submittedAt: '2026-10-01T00:00:00Z', data: { q: 'a' } })) }))
const reset = () => mem.delete(KEY)

// Nothing to send is not done: the migration may not be live yet, and a
// survey filed next would be stranded with no re-send left to recover it.
reset()
surveys()
let c = client({})
await requeueStrandedSurveys(c, true)
ok(!flag().done && !flag().tries && c.sent.length === 0, 'a device with no surveys was marked done, spent a try, or sent something')
surveys('later')
c = client({})
await requeueStrandedSurveys(c, true)
ok(flag().done === true && c.sent.length === 1, 'a survey stranded after an empty first run is not recovered')

// Signed out: does nothing, and does not use up a try.
reset()
surveys('s1')
c = client({})
await requeueStrandedSurveys(c, false)
ok(c.sent.length === 0 && !flag().done && !flag().tries, 'signed out, it sent something or recorded a try')

// Migration not applied yet: everything refused. Not done; counted; retried.
reset()
surveys('s1', 's2')
c = client({ s1: 'rls', s2: 'rls' })
await requeueStrandedSurveys(c, true)
ok(!flag().done && flag().tries === 1, 'all refused should leave it pending with one try counted')
ok(c.sent.length === 2, 'not every stranded survey was attempted')
ok(c.sent.every((r) => r.collection === 'surveys' && r.deleted === false && r.market === 'kc' && r.data.traineeId === 't1'),
  'the re-sent rows are not the survey records as the sync engine would send them')

// Then the migration is applied: the next sign-in recovers them and finishes.
c = client({})
await requeueStrandedSurveys(c, true)
ok(flag().done === true && c.sent.length === 2, 'after the migration, the re-send does not recover and finish')
c = client({})
await requeueStrandedSurveys(c, true)
ok(c.sent.length === 0, 'it runs again after finishing')

// Partly refused: one accepted, one the server already settled. Done.
reset()
surveys('s1', 's2')
await requeueStrandedSurveys(client({ s2: 'rls' }), true)
ok(flag().done === true, 'one accepted and one settled by an admin should count as done')

// Offline mid-way after one accepted: not an answer, so not done, no try spent.
reset()
surveys('s1', 's2', 's3')
c = client({ s2: 'offline' })
await requeueStrandedSurveys(c, true)
ok(!flag().done && !flag().tries, 'a network failure finished the re-send or spent a try')
ok(c.sent.length === 2, 'it kept sending after the connection failed')

// A refusal that never changes stops at the cap.
reset()
surveys('s1')
let attempts = 0
for (let i = 0; i < 15; i++) {
  c = client({ s1: 'rls' })
  await requeueStrandedSurveys(c, true)
  attempts += c.sent.length
}
ok(attempts === 10, `a permanently refused survey was sent ${attempts} times; the cap is 10`)

if (fails.length) {
  console.error(`check-survey-requeue: ${fails.length} of ${checks} checks FAILED\n`)
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`check-survey-requeue: ${checks} checks passed`)
