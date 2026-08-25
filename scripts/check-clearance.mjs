// Behaviour check for clinical clearance and the letter of good standing.
//
// A student cannot start a rotation until the program holds a specific list of
// dated records, and the letter it sends the facility asserts every one of them
// to a hospital. Two things therefore have to hold, and this checks both:
//
//   - the gate is judged against the day the student is due on the floor, not
//     the day someone opened the screen — a PPD that is current today and
//     lapses the week before the rotation is not clearance
//   - the letter asserts nothing the record does not hold, and refuses to
//     exist at all when the record is short
//
// Run: node scripts/check-clearance.mjs  (or `npm run check:clearance`)
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')
const OUT = join(tmpdir(), `ces-clearance-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `
      export { clearanceReview, clearanceSummary, PPD_VALID_DAYS } from ${JSON.stringify(join(SRC, 'data/aemtClearance'))}
      export { goodStandingLetterHTML, letterFilename } from ${JSON.stringify(join(SRC, 'modules/aemt/goodStandingLetter'))}
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
        b.onResolve({ filter: /dialog$/ }, (a) => ({ path: a.path, namespace: 'stub' }))
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: 'export const notifyUser=()=>{}',
          loader: 'js',
        }))
      },
    },
  ],
})
const { clearanceReview, clearanceSummary, goodStandingLetterHTML, letterFilename } = await import(
  pathToFileURL(OUT).href
)
rmSync(OUT, { force: true })

let checks = 0
const fails = []
const ok = (cond, msg) => {
  checks++
  if (!cond) fails.push(msg)
}
const stateOf = (r, id) => r.items.find((i) => i.id === id)?.state
const detailOf = (r, id) => r.items.find((i) => i.id === id)?.detail ?? ''

// A student with everything on file, for a rotation in June 2026.
const ROTATION = { rotationStart: '2026-06-01', rotationEnd: '2026-06-30', today: '2026-05-01' }
const full = {
  physicalDate: '2026-01-15',
  varicellaDate: '2019-03-02',
  hepBDate: '2018-11-20',
  mmrDate: '2001-08-14',
  tdapDate: '2022-04-05',
  fluDate: '2025-10-08',
  ppdDate: '2026-03-01',
  ppdResult: 'negative',
  backgroundDate: '2026-02-10',
  backgroundSevenYear: true,
  backgroundCleared: true,
  drugScreenDate: '2026-02-12',
  drugScreenNinePanel: true,
  drugScreenNegative: true,
  insuranceCarrier: 'Blue Cross',
  insuranceThrough: '2026-12-31',
  verifiedBy: 'J. Jones',
  verifiedAt: '2026-04-02T15:00:00.000Z',
}

{
  const r = clearanceReview(full, ROTATION)
  ok(r.ready, `a complete record clears — blocked on ${r.blocking.map((b) => b.id).join(',')}`)
  ok(clearanceSummary(r) === 'Cleared', clearanceSummary(r))
  ok(r.items.length >= 10, `${r.items.length} items reviewed`)
  ok(
    r.items.every((i) => i.clause.startsWith('§')),
    'every item names the clause it satisfies',
  )
}

// ---------------------------------------------------------------------------
// Nothing is satisfied by a tick.
// ---------------------------------------------------------------------------
{
  const r = clearanceReview({ ...full, backgroundSevenYear: false }, ROTATION)
  ok(stateOf(r, 'background') === 'missing', 'a background check of unknown scope does not clear')
  ok(/seven-year/i.test(detailOf(r, 'background')), detailOf(r, 'background'))
  ok(!r.ready, 'and it blocks the student')
}
{
  const r = clearanceReview({ ...full, drugScreenNinePanel: false }, ROTATION)
  ok(stateOf(r, 'drug') === 'missing', 'a screen not confirmed as the nine-panel does not clear')
}
{
  const r = clearanceReview({ ...full, drugScreenNegative: false }, ROTATION)
  ok(stateOf(r, 'drug') === 'missing', 'nor one with no recorded result')
}

// ---------------------------------------------------------------------------
// Dates expire, and they expire against the rotation.
// ---------------------------------------------------------------------------
{
  // PPD from June 2025: current on the day someone looks (May 2026), lapsed
  // before the student is due on the floor.
  const r = clearanceReview({ ...full, ppdDate: '2025-05-20' }, ROTATION)
  ok(stateOf(r, 'ppd') === 'missing', `a PPD that lapses before the rotation is not clearance — ${detailOf(r, 'ppd')}`)
  const today = clearanceReview({ ...full, ppdDate: '2025-05-20' }, { today: '2025-06-01' })
  ok(stateOf(today, 'ppd') === 'ok', 'though it stands on a day it is still current')
}
{
  // Current at the start, lapses mid-rotation.
  const r = clearanceReview({ ...full, ppdDate: '2025-06-15' }, ROTATION)
  ok(stateOf(r, 'ppd') === 'expiring', `flagged when it runs out during the rotation — ${detailOf(r, 'ppd')}`)
  ok(!r.ready, 'and that blocks too — it would lapse on the floor')
}
{
  const r = clearanceReview({ ...full, insuranceThrough: '2026-06-10' }, ROTATION)
  ok(stateOf(r, 'insurance') === 'expiring', 'insurance that lapses mid-rotation is flagged')
}

// ---------------------------------------------------------------------------
// The two-step items.
// ---------------------------------------------------------------------------
{
  const r = clearanceReview({ ...full, varicellaDate: undefined, varicellaTiter: 'negative' }, ROTATION)
  ok(stateOf(r, 'varicella') === 'missing', 'a negative varicella titer is not immunity')
  ok(/vaccination required/i.test(detailOf(r, 'varicella')), detailOf(r, 'varicella'))
}
{
  const r = clearanceReview({ ...full, varicellaDate: undefined, varicellaTiter: 'positive' }, ROTATION)
  ok(stateOf(r, 'varicella') === 'noted', 'a positive titer is')
}
{
  const r = clearanceReview({ ...full, hepBDate: undefined }, ROTATION)
  ok(stateOf(r, 'hepb') === 'missing', 'no hepatitis B and no declination blocks')
  const dec = clearanceReview({ ...full, hepBDate: undefined, hepBDeclined: true }, ROTATION)
  ok(stateOf(dec, 'hepb') === 'noted', 'a signed declination satisfies it, as the agreement allows')
}
{
  const pos = clearanceReview({ ...full, ppdResult: 'positive' }, ROTATION)
  ok(stateOf(pos, 'ppd') === 'missing', 'a positive PPD alone does not clear')
  const filmed = clearanceReview(
    { ...full, ppdResult: 'positive', cxrDate: '2026-03-03', cxrClear: true },
    ROTATION,
  )
  ok(stateOf(filmed, 'ppd') === 'ok', 'a positive PPD with a clear film does')
}

// ---------------------------------------------------------------------------
// Influenza is the one they can work without.
// ---------------------------------------------------------------------------
{
  const winter = clearanceReview(
    { ...full, fluDate: undefined },
    { rotationStart: '2026-12-01', rotationEnd: '2026-12-20', today: '2026-11-01' },
  )
  ok(stateOf(winter, 'flu') === 'noted', 'no flu shot in season is a note, not a closed door')
  ok(/mask/i.test(detailOf(winter, 'flu')), detailOf(winter, 'flu'))
  ok(winter.blocking.every((b) => b.id !== 'flu'), 'and it does not block')
}

// ---------------------------------------------------------------------------
// The facility's own employees (§4.21).
// ---------------------------------------------------------------------------
{
  const emp = clearanceReview(
    {
      varicellaDate: '2019-03-02',
      hepBDate: '2018-11-20',
      mmrDate: '2001-08-14',
      tdapDate: '2022-04-05',
      ppdDate: '2026-03-01',
      ppdResult: 'negative',
      insuranceCarrier: 'Blue Cross',
      facilityEmployee: true,
    },
    ROTATION,
  )
  ok(stateOf(emp, 'physical') === 'exempt', 'a facility employee is exempt from the physical')
  ok(stateOf(emp, 'background') === 'exempt', 'the background check')
  ok(stateOf(emp, 'drug') === 'exempt', 'and the drug screen')
  ok(stateOf(emp, 'ppd') === 'ok', 'but not from TB screening')
  ok(stateOf(emp, 'mmr') === 'ok', 'or immunisations')
  ok(emp.ready, `and clears on that basis — blocked on ${emp.blocking.map((b) => b.id).join(',')}`)
}

// ---------------------------------------------------------------------------
// The letter asserts nothing the record does not hold.
// ---------------------------------------------------------------------------
const course = {
  id: 'c1',
  label: 'Fall 2026 AEMT',
  organization: 'American Medical Response',
  courseNumber: 'K-2026-114',
  startDate: '2026-09-01',
  endDate: '2027-02-28',
  coordinator: 'J. Jones',
}
const site = {
  id: 's1',
  name: 'AdventHealth Shawnee Mission',
  kind: 'clinical',
  agreement: 'executed',
  contact: 'Amber Delphia, RN, MSN',
  effectiveFrom: '2026-07-31',
}
const student = { id: 'st1', courseId: 'c1', name: 'Alex Rivera', status: 'active', clearance: full }

{
  const html = goodStandingLetterHTML(student, course, {
    site,
    rotationStart: '2026-06-01',
    rotationEnd: '2026-06-30',
    contactName: 'J. Jones',
    contactTitle: 'Clinical Education Manager',
    letterDate: '2026-05-01',
  })
  ok(!!html, 'a cleared student gets a letter')
  ok(/Alex Rivera/.test(html), 'naming the student')
  ok(/AdventHealth Shawnee Mission/.test(html), 'and the facility')
  ok(/Amber Delphia/.test(html), 'addressed to the liaison')
  ok(/good standing/i.test(html), 'as a letter of good standing')
  ok(/seven years/.test(html), 'the background check states its seven-year scope')
  ok(/nine-panel/i.test(html) && /cocaine metabolite/.test(html), 'the drug screen names the panel')
  ok(/Tuberculin skin test/.test(html), 'the TB screen is stated')
  ok(/\$1,000,000 per claim/.test(html), 'the insurance limits are stated')
  ok(/effective/.test(html) && /2026/.test(html), 'and the agreement it is written under')
  ok(!/undefined|NaN|\[facility\]/.test(html), 'nothing prints as a placeholder')

  // A record with a gap produces no letter at all.
  const short = { ...student, clearance: { ...full, drugScreenDate: undefined } }
  ok(
    goodStandingLetterHTML(short, course, { site, rotationStart: '2026-06-01' }) === null,
    'a student short of the drug screen gets no letter',
  )
  const lapsing = { ...student, clearance: { ...full, ppdDate: '2025-05-20' } }
  ok(
    goodStandingLetterHTML(lapsing, course, { site, rotationStart: '2026-06-01' }) === null,
    'nor one whose PPD has lapsed by the rotation',
  )
  ok(goodStandingLetterHTML({ ...student, clearance: undefined }, course) === null, 'nor one with no record at all')
}

{
  // The employee letter says why three items are absent rather than leaving
  // gaps for the reader to notice.
  const emp = {
    ...student,
    clearance: {
      varicellaDate: '2019-03-02',
      hepBDate: '2018-11-20',
      mmrDate: '2001-08-14',
      tdapDate: '2022-04-05',
      fluDate: '2025-10-08',
      ppdDate: '2026-03-01',
      ppdResult: 'negative',
      insuranceCarrier: 'Blue Cross',
      facilityEmployee: true,
    },
  }
  const html = goodStandingLetterHTML(emp, course, { site, rotationStart: '2026-06-01' })
  ok(!!html, 'a facility employee gets a letter')
  ok(/section 4\.21/.test(html), 'citing the exemption')
  ok(!/nine-panel/i.test(html), 'and does not claim a drug screen it does not hold')
  ok(!/preceding seven years/.test(html), 'nor a background check')
  ok(/Tuberculin skin test/.test(html), 'while still stating the TB screen, which is not exempt')
}

{
  // Anything typed by a person is data, not markup.
  const nasty = {
    ...student,
    name: '<img src=x onerror=1>',
    clearance: { ...full, insuranceCarrier: '<script>x()</script>' },
  }
  const html = goodStandingLetterHTML(nasty, course, { site, rotationStart: '2026-06-01' })
  ok(!/<img|<script/i.test(html), 'a name or carrier containing markup is escaped')
  ok(/Good_Standing/.test(letterFilename(student, site)), 'the download is named for what it is')
}

if (fails.length) {
  console.error(`check-clearance: ${fails.length} of ${checks} checks failed\n`)
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log(`check-clearance: ${checks} checks passed`)
