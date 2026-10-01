// Check an operation's NEOP — the data that replaced Kansas City's and
// Wichita's hard-coded academy rules.
//
// The promise this rework made is that NOTHING CHANGES until someone edits:
// Kansas City and Wichita run exactly what they ran before, now expressed as
// data. So the rules as they stood before the rework are frozen below, copied
// from the last commit that had them, and the new data is held to them for
// every station × credential. If someone later edits the shipped programs,
// this is what tells them they changed what a Kansas City paramedic is
// required to do.
//
// Also checked: starting points (copying another operation's NEOP must not
// carry its FTOs, hospitals or station ids), the cohort snapshot that keeps a
// running cohort's checklist still when the NEOP changes, and that the four
// operations agree between the app and the database migration.
//
// Run: node scripts/check-neop-program.mjs
import { readFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')
const OUT = join(tmpdir(), `ces-neop-program-check-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `
      export * from ${JSON.stringify(join(SRC, 'modules/academy/program'))}
      export { MARKETS, isMarket } from ${JSON.stringify(join(SRC, 'lib/market'))}
      export { BUNDLED_SCHEDULES } from ${JSON.stringify(join(SRC, 'data/academyPhase2'))}
    `,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: OUT,
  logLevel: 'error',
})
const m = await import(pathToFileURL(OUT).href)
rmSync(OUT, { force: true })

let failures = 0
let passes = 0
function ok(label, cond, detail = '') {
  if (cond) passes++
  else {
    failures++
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ----- the rules as they were, frozen ----------------------------------------
// From src/data/academy.ts and src/data/checkoffSheets.ts at 0c8b840, the
// commit before NEOPs became editable.

const LEGACY_GENERAL = ['stretcher', 'evoc', 'report_writing', 'hr', 'osha', 'cornerstone']
const LEGACY_WAIVABLE = new Set(['stretcher', 'evoc', 'hr', 'osha', 'cornerstone'])
function legacyCurriculum(operation, credential) {
  const out = [...LEGACY_GENERAL]
  if (credential === 'paramedic') {
    if (operation === 'kc' || operation === 'cass') out.push('vent')
    if (operation === 'kc') out.push('infusions')
  }
  return out
}
function legacySheets(market, t) {
  const clinical =
    market !== 'kc' ? [] : t.credential !== 'paramedic' ? ['bls'] : ['bls', 'linn-medic', t.operation === 'linn' ? 'rsi' : 'vent']
  return [...clinical, 'stretcher', 'evoc-track']
}
const LEGACY_CHECKOFFS = {
  kc: { p1s3: ['evoc-track'], p1s5: ['stretcher', 'bls'] },
  wichita: { p1s3: ['evoc-track'], p1s5: ['stretcher'] },
}

const trainee = (operation, credential, extra = {}) => ({
  id: 't',
  cohortId: 'c',
  name: 'T',
  operation,
  credential,
  checklist: {},
  contacts: 0,
  contactTarget: 25,
  ...extra,
})

// ----- four operations ---------------------------------------------------------

const ids = m.MARKETS.map((x) => x.id)
ok('the app knows four operations', eq(ids, ['kc', 'wichita', 'independence', 'topeka']), ids.join(','))
for (const id of ids) ok(`${id} is recognised as an operation`, m.isMarket(id))
ok('and nothing else is', !m.isMarket('all') && !m.isMarket('cass'))

const migration = readFileSync(join(ROOT, 'supabase/migrations/2026-10-01-four-operations.sql'), 'utf8')
const schema = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
for (const [file, sql] of [['the migration', migration], ['schema.sql', schema]]) {
  const checks = [...sql.matchAll(/check \(market in \(([^)]*)\)\)/g)].map((x) => x[1])
  ok(`${file} widens all four market checks`, checks.length === 4, `${checks.length} found`)
  for (const c of checks) {
    for (const id of ids) ok(`${file}: ${id} allowed in (${c})`, c.includes(`'${id}'`))
  }
  ok(`${file}: 'all' is allowed on profiles only`, checks.filter((c) => c.includes("'all'")).length === 1)
}

// ----- Kansas City runs exactly what it ran ------------------------------------

const kc = m.bundledProgram('kc')
ok('Kansas City ships a NEOP', !!kc)
const kcPlan = m.planFromProgram(kc)
for (const op of ['kc', 'cass', 'linn']) {
  for (const cred of ['emt', 'aemt', 'paramedic']) {
    const t = trainee(op, cred)
    const now = m.checklistFor(kcPlan, t).map((x) => x.id)
    ok(`KC ${op} ${cred}: same checklist as before`, eq(now, legacyCurriculum(op, cred)), `${now} vs ${legacyCurriculum(op, cred)}`)
    for (const id of now) {
      ok(`KC ${op} ${cred}: ${id} waivable exactly as before`, m.isWaivable(kcPlan, id) === LEGACY_WAIVABLE.has(id))
    }
    const sheets = m.sheetsFor(kc, t)
    ok(`KC ${op} ${cred}: same sheets as before, same order`, eq(sheets, legacySheets('kc', t)), `${sheets} vs ${legacySheets('kc', t)}`)
  }
}
ok('KC releases at 20 and starts hires at 25', kc.release.minContacts === 20 && kc.release.defaultTarget === 25)
ok('KC keeps its station ids, which every existing hire carries', eq(kc.locations.map((l) => l.id), ['kc', 'cass', 'linn']))
ok('KC header unchanged on the folder label', kc.header === 'AMR KC — NEW HIRE ACADEMY')

const kcSched = kc.schedule
ok('KC academy still runs two weeks', eq(kcSched.weeks.map((w) => w.n), [1, 2]))
ok('KC academy still has its ten sessions', kcSched.sessions.length === 10, String(kcSched.sessions.length))
ok('KC minimum teaching hours still 5', kcSched.minEducationHoursPerDay === 5)
for (const s of kcSched.sessions) {
  const want = LEGACY_CHECKOFFS.kc[s.id]
  ok(`KC ${s.id}: check-offs as before`, eq(s.checkoffs, want), `${s.checkoffs} vs ${want}`)
}
ok('KC FTO roster carried over', kc.ftos.crews.length > 0 && kc.ftos.names.includes('David Richardson'))
ok('KC evaluators kept apart from FTOs', eq(kc.ftos.evaluators, ['Jordan Jones']) && !kc.ftos.names.includes('Jordan Jones'))
ok('KC hospitals carried over', kc.documents.facilities.length === 10)

// ----- and so does Wichita -----------------------------------------------------

const ict = m.bundledProgram('wichita')
ok('Wichita ships a NEOP', !!ict)
const ictPlan = m.planFromProgram(ict)
for (const cred of ['emt', 'aemt', 'paramedic']) {
  const t = trainee('wichita', cred)
  ok(`Wichita ${cred}: general block only, as before`, eq(m.checklistFor(ictPlan, t).map((x) => x.id), legacyCurriculum('wichita', cred)))
  ok(`Wichita ${cred}: corporate sheets only, as before`, eq(m.sheetsFor(ict, t), legacySheets('wichita', t)))
}
ok('Wichita academy is its one week', eq(ict.schedule.weeks.map((w) => w.n), [1]))
for (const s of ict.schedule.sessions) {
  ok(`Wichita ${s.id}: check-offs as before`, eq(s.checkoffs, LEGACY_CHECKOFFS.wichita[s.id]))
}
ok('Wichita has no hospitals until it enters them', ict.documents.facilities.length === 0)
ok('Wichita FTOs listed without invented lines', ict.ftos.names.length === 5 && ict.ftos.crews.length === 0)

// ----- the new operations ship nothing ----------------------------------------

for (const op of ['independence', 'topeka']) {
  ok(`${op} ships no NEOP — it builds its own`, m.bundledProgram(op) === undefined)
}

// ----- starting points ----------------------------------------------------------

const basics = m.basicsProgram('topeka')
ok('basics: the six general requirements', eq(basics.checklist.map((x) => x.id), LEGACY_GENERAL))
ok('basics: report writing is not waivable, the other five are', basics.checklist.every((x) => !!x.waivable === LEGACY_WAIVABLE.has(x.id)))
ok('basics: the two corporate sheets', eq(basics.sheets.map((x) => x.id), ['stretcher', 'evoc-track']))
ok('basics: a five-day week', basics.schedule.sessions.length === 5 && eq(basics.schedule.weeks.map((w) => w.n), [1]))
ok('basics: road course carries the EVOC check-off', eq(basics.schedule.sessions.find((s) => s.id === 'basic-evoc-road')?.checkoffs, ['evoc-track']))
ok('basics: stretcher day carries the stretcher check-off', eq(basics.schedule.sessions.find((s) => s.id === 'basic-stretcher')?.checkoffs, ['stretcher']))
ok('basics: release at 20, target 25', basics.release.minContacts === 20 && basics.release.defaultTarget === 25)
ok('basics: named for the operation', basics.name === 'AMR Topeka New Hire Academy' && basics.header === 'AMR TOPEKA — NEW HIRE ACADEMY')
ok('basics: one station, the operation itself', eq(basics.locations, [{ id: 'topeka', name: 'Topeka' }]))
ok('basics: no FTOs, no hospitals', basics.ftos.names.length === 0 && basics.ftos.crews.length === 0 && basics.documents.facilities.length === 0)
ok('basics: the welcome kit does not list a roadmap the basics do not offer', !basics.documents.roadmap && basics.documents.welcomeKit.every((k) => !/roadmap/i.test(k.item)))
ok('basics: no problems to fix before saving', m.programProblems(basics).length === 0, m.programProblems(basics).join(' '))

const blank = m.blankProgram('independence')
ok('blank: nothing on the checklist, schedule or sheets', blank.checklist.length === 0 && blank.schedule.sessions.length === 0 && blank.sheets.length === 0)
ok('blank: still saveable', m.programProblems(blank).length === 0)

const copied = m.copiedProgram('kc', 'topeka')
ok('copying KC takes its checklist', eq(copied.checklist.map((x) => x.id), kc.checklist.map((x) => x.id)))
ok('copying KC takes its schedule', copied.schedule.sessions.length === 10)
ok('but not its FTOs or shifts', copied.ftos.names.length === 0 && copied.ftos.crews.length === 0 && copied.ftos.evaluators.length === 0)
ok('nor its hospitals or transfer rules', copied.documents.facilities.length === 0 && copied.documents.keyPoints.length === 0)
ok('nor its stations', eq(copied.locations, [{ id: 'topeka', name: 'Topeka' }]))
ok('nothing in the copy still points at a KC station', [...copied.checklist, ...copied.sheets].every((x) => !x.who?.locations))
ok('"paramedics at KC or Cass" becomes "paramedics"', eq(copied.checklist.find((x) => x.id === 'vent')?.who, { credentials: ['paramedic'] }))
ok('the copy is named for the operation copying it', copied.name === 'AMR Topeka New Hire Academy' && copied.schedule.name === copied.name)
const own = m.startingProgram('copy:kc', 'kc')
ok("copying an operation's own NEOP keeps its people", own.ftos.crews.length === kc.ftos.crews.length)
ok('a new operation is offered KC and Wichita to copy', eq(m.copyableOperations(), ['kc', 'wichita']))

// ----- a cohort keeps what it started with --------------------------------------

const plan = m.planFromProgram(basics)
basics.checklist.push({ id: 'later', label: 'Added later' })
basics.release.minContacts = 99
ok('a cohort plan is a copy, not a reference', plan.checklist.length === 6 && plan.release.minContacts === 20)
ok('a cohort with a plan runs that plan', m.planOf({ plan }, 'topeka', basics) === plan)
ok('a cohort from before runs what its operation shipped', eq(m.planOf({}, 'kc'), kcPlan))
ok('a cohort in a new operation without a plan runs the current NEOP', m.planOf({}, 'topeka', basics).checklist.length === 7)
ok('the cohort notices the NEOP has moved on', m.planDiffers(plan, basics))
ok('and does not when it has not', !m.planDiffers(m.planFromProgram(kc), kc))

// ----- the phases ----------------------------------------------------------------

const p6 = m.planFromProgram(m.basicsProgram('topeka'))
const done = Object.fromEntries(LEGACY_GENERAL.map((id) => [id, '2026-10-01']))
ok('nothing ticked: in the academy', m.phaseOf(trainee('topeka', 'emt'), p6) === 'academy')
ok('everything ticked: on FTO rides', m.phaseOf(trainee('topeka', 'emt', { checklist: done }), p6) === 'fto')
ok('waived counts as done', m.phaseOf(trainee('topeka', 'emt', { checklist: { report_writing: 'x' }, waived: { stretcher: 'x', evoc: 'x', hr: 'x', osha: 'x', cornerstone: 'x' } }), p6) === 'fto')
ok('released wins', m.phaseOf(trainee('topeka', 'emt', { releasedDate: '2026-11-01' }), p6) === 'released')
ok('an empty checklist goes straight to FTO rides', m.phaseOf(trainee('topeka', 'emt'), { checklist: [] }) === 'fto')
const p15 = { ...p6, release: { minContacts: 15, defaultTarget: 18 } }
ok('release follows the operation’s count', m.releaseEligible(trainee('topeka', 'emt', { checklist: done, contacts: 15, contactTarget: 18 }), p15))
ok('and not before it', !m.releaseEligible(trainee('topeka', 'emt', { checklist: done, contacts: 14, contactTarget: 18 }), p15))
ok('a transfer’s lower target wins', m.requiredContacts(trainee('topeka', 'emt', { contactTarget: 10 }), p15) === 10)

// ----- who something applies to ---------------------------------------------------

const locs = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Bravo' }]
ok('no audience: everyone', m.appliesTo(undefined, { credential: 'emt', operation: 'a' }))
ok('credential narrows', !m.appliesTo({ credentials: ['paramedic'] }, { credential: 'emt', operation: 'a' }))
ok('station narrows', !m.appliesTo({ locations: ['b'] }, { credential: 'emt', operation: 'a' }))
ok('both must hold', m.appliesTo({ credentials: ['emt'], locations: ['a'] }, { credential: 'emt', operation: 'a' }))
ok('described plainly: everyone', m.describeAudience(undefined, locs) === 'Everyone')
ok('described plainly: one credential', m.describeAudience({ credentials: ['paramedic'] }, locs) === 'Paramedics')
ok('described plainly: credential and station', m.describeAudience({ credentials: ['emt', 'aemt'], locations: ['b'] }, locs) === 'EMTs or AEMTs at Bravo')
ok('described plainly: all three credentials is everyone', m.describeAudience({ credentials: ['emt', 'aemt', 'paramedic'] }, locs) === 'Everyone')

// ----- small helpers ---------------------------------------------------------------

ok('ids come from labels', m.idFromLabel('Protocol Test!', []) === 'protocol-test')
ok('and never collide', m.idFromLabel('Protocol test', ['protocol-test', 'protocol-test-2']) === 'protocol-test-3')
ok('a nameless NEOP cannot be saved', m.programProblems({ ...m.basicsProgram('kc'), name: ' ' }).length === 1)
ok('nor one with no stations', m.programProblems({ ...m.basicsProgram('kc'), locations: [] }).length === 1)
const renum = m.renumber([
  { id: 'x', week: 2, order: 1 },
  { id: 'y', week: 1, order: 9 },
  { id: 'z', week: 1, order: 2 },
])
ok('sessions renumber in academy order', eq(renum.map((s) => `${s.id}${s.order}`), ['z1', 'y2', 'x3']))

if (failures) {
  console.log(`\ncheck-neop-program: ${failures} of ${failures + passes} checks failed`)
  process.exit(1)
}
console.log(`check-neop-program: ${passes} checks passed — every operation's NEOP is what it says it is.`)
