// Behaviour check for CQMP — the catalogue, the KPI verdict, and the minutes.
//
// This module had no checks until the region grew from two operations to
// eight and started producing a document that goes to a regional director.
// Three things are worth pinning down:
//
//   - the catalogue. Operation ids are permanent, because a report filed in
//     January stores whatever ids were current then; renaming one in place
//     orphans its history. And which measures apply follows the service model,
//     not the city, so an interfacility unit must never acquire the bundles by
//     accident.
//
//   - the verdict. "Are we meeting these KPIs and if not why not" has to come
//     out right, and in particular a miss with nothing said about it has to be
//     reported as a miss with nothing said about it rather than passing quietly.
//
//   - the minutes. The names are people's names on a filed document, the
//     header has to carry every post, and nothing typed into a notes field may
//     escape as markup.
//
// Run: node scripts/check-cqmp.mjs  (or `npm run check:cqmp`)
import { rmSync, writeFileSync } from 'node:fs'
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

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')
const OUT = join(tmpdir(), `ces-cqmp-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `
      export * from ${JSON.stringify(join(SRC, 'data/cqmp'))}
      export * from ${JSON.stringify(join(SRC, 'modules/cqmp/cqmpStore'))}
      export { minutesHTML, minutesFilename, minutesTitle } from ${JSON.stringify(
        join(SRC, 'modules/cqmp/minutes'),
      )}
      export { getState } from ${JSON.stringify(join(SRC, 'lib/store'))}
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
        b.onResolve({ filter: /^react$/ }, (a) => ({ path: a.path, namespace: 'react-stub' }))
        b.onLoad({ filter: /.*/, namespace: 'react-stub' }, () => ({
          contents:
            'export const useMemo=(f)=>f();export const useRef=(v)=>({current:v});' +
            'export const useSyncExternalStore=()=>{throw new Error("not callable here")};' +
            'export const useState=()=>{throw new Error("not callable here")};' +
            'export const useEffect=()=>{};export default {}',
          loader: 'js',
        }))
        b.onResolve({ filter: /(dialog|sync)$/ }, (a) => ({ path: a.path, namespace: 'stub' }))
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents:
            'export const notifyUser=()=>{};export const useSyncStatus=()=>({});' +
            'export const confirmAction=async()=>true;export const getSupabaseClient=()=>null;' +
            'export const pushRecord=async()=>{};export const syncNow=async()=>{}',
          loader: 'js',
        }))
      },
    },
  ],
})
const m = await import(pathToFileURL(OUT).href)
rmSync(OUT, { force: true })

const {
  AIR_OPERATIONS,
  CQMP_KPIS,
  CQMP_OFFICERS,
  CQMP_OPERATIONS,
  CQMP_SUBMIT_URL,
  GROUND_OPERATIONS,
  createReport,
  cqmpSlots,
  cqmpOperationName,
  kpiSummary,
  meetingMinutes,
  minutesHTML,
  minutesFilename,
  officerSeed,
  percentOf,
  updateMeeting,
  updateMetric,
  getState,
  addMinuteRow,
  updateMinuteRow,
} = m

let checks = 0
const fails = []
const ok = (cond, msg) => {
  checks++
  if (!cond) fails.push(msg)
}

// ---------------------------------------------------------------------------
// The catalogue.

{
  const ids = CQMP_OPERATIONS.map((o) => o.id)
  ok(ids.length === 8, `eight operations in Region 41, got ${ids.length}`)
  ok(new Set(ids).size === ids.length, 'no duplicate operation ids')
  // The four that existed before the region was added must keep their ids, or
  // every report already filed loses its numbers.
  for (const legacy of ['kc', 'linn', 'wichita', 'winfield']) {
    ok(ids.includes(legacy), `the existing id "${legacy}" survives the regional rewrite`)
  }
  for (const added of ['independence', 'healthstar1', 'eaglemed-chanute', 'eaglemed-wichita']) {
    ok(ids.includes(added), `${added} is on the list`)
  }

  // Measures follow the service model, not the city.
  const kpisOf = (id) => CQMP_OPERATIONS.find((o) => o.id === id).kpis
  for (const interfacility of ['kc', 'wichita', 'winfield']) {
    ok(
      kpisOf(interfacility).join() === 'glucose,airway',
      `${interfacility} reports the two interfacility measures, got ${kpisOf(interfacility)}`,
    )
  }
  for (const scene of ['linn', 'independence', 'healthstar1', 'eaglemed-chanute', 'eaglemed-wichita']) {
    ok(
      kpisOf(scene).join() === 'glucose,airway,stroke,stemi',
      `${scene} reports the bundles too, got ${kpisOf(scene)}`,
    )
  }
  ok(
    CQMP_OPERATIONS.every((o) => o.kpis.every((k) => !!CQMP_KPIS[k])),
    'every measure named by an operation exists in the KPI catalogue',
  )

  ok(GROUND_OPERATIONS.length === 5, `five ground business units, got ${GROUND_OPERATIONS.length}`)
  ok(AIR_OPERATIONS.length === 3, `three air bases, got ${AIR_OPERATIONS.length}`)
  ok(
    GROUND_OPERATIONS.length + AIR_OPERATIONS.length === CQMP_OPERATIONS.length,
    'every operation is either ground or air — none falls off the minutes header',
  )
  ok(cqmpSlots().length === 26, `twenty-six measures a month, got ${cqmpSlots().length}`)
  ok(
    cqmpOperationName('a-base-that-closed') === 'a-base-that-closed',
    'an id no longer in the catalogue still renders as itself rather than a blank',
  )
}

// ---------------------------------------------------------------------------
// The names. These are people, on a document going to a regional director.

{
  // Fixed targets, the same on every operation. These are the numbers the
  // programme is held to, so they are pinned here rather than left to whatever
  // somebody last typed into a month.
  ok(CQMP_KPIS.airway.target === 91, `advanced airway target 91, got ${CQMP_KPIS.airway.target}`)
  ok(CQMP_KPIS.glucose.target === 75, `blood glucose target 75, got ${CQMP_KPIS.glucose.target}`)
  ok(CQMP_KPIS.stemi.target === 65, `STEMI bundle target 65, got ${CQMP_KPIS.stemi.target}`)
  ok(CQMP_KPIS.stroke.target === 88, `stroke bundle target 88, got ${CQMP_KPIS.stroke.target}`)
  ok(m.cqmpTarget('glucose') === 75, 'cqmpTarget reads the catalogue')
  ok(m.cqmpTarget('a-measure-that-was-retired') === null, 'and an unknown id has no target')
}

{
  const byRole = Object.fromEntries(CQMP_OFFICERS.map((o) => [o.role, o.name]))
  ok(byRole.rcm === 'Odie White', `RCM is Odie White, got ${byRole.rcm}`)
  ok(byRole.rcd === 'Eric Divendorf', `RCD is Eric Divendorf, got ${byRole.rcd}`)
  ok(byRole.rcqm === 'Brad Cramer', `RCQM is Brad Cramer — not Kramer, got ${byRole.rcqm}`)
  ok(byRole.rpsm === 'Kevin Morris', `RPSM is Kevin Morris — not Maurice, got ${byRole.rpsm}`)
  ok(byRole.vp === 'Scott Lenn', `the VP row exists at all, got ${byRole.vp}`)
  ok(byRole.president === 'Steve Dralle', `president is Steve Dralle — not Crowley, got ${byRole.president}`)
  ok(byRole.director === 'Craig Isom', `Region 41 director is Craig Isom, got ${byRole.director}`)
  ok(
    CQMP_OFFICERS.find((o) => o.role === 'director').title.includes('41'),
    'the director row names the region',
  )
  ok(Object.keys(officerSeed()).length === CQMP_OFFICERS.length, 'the seed covers every post')
}

{
  // The filing link. Held as data rather than typed into a component, so the
  // day the form is replaced it is one edit and not a hunt.
  ok(/^https:\/\//.test(CQMP_SUBMIT_URL), 'the submission form is https')
  ok(/smartsheet\.com/.test(CQMP_SUBMIT_URL), 'and points at the Smartsheet intake form')
  ok(
    CQMP_SUBMIT_URL === 'https://app.smartsheet.com/b/form/2a67f3482aeb40ec869d56f12ce8c2b8',
    'at the form id that was given',
  )
}

// ---------------------------------------------------------------------------
// The verdict: are we meeting these, and if not why not.

const APRIL = createReport('2026-04')
const MARCH = createReport('2026-03')

{
  ok(APRIL.metrics.length === 26, `a new month opens with all 26 slots, got ${APRIL.metrics.length}`)
  ok(
    !!APRIL.meeting?.officers?.rcm,
    'and with the officer roster already on it, so the minutes are never anonymous',
  )
}

const read = (id) => getState().cqmpReports.find((r) => r.id === id)

{
  // March: 95 clears every target (75/91/88/65), so April has a baseline to
  // move against.
  for (const { opId, kpiId } of cqmpSlots()) {
    updateMetric(MARCH.id, opId, kpiId, { value: 95 })
  }
  const marchSummary = kpiSummary(read(MARCH.id), undefined)
  ok(marchSummary.met === 26, `March meets everything, got ${marchSummary.met}`)
  ok(marchSummary.unexplained.length === 0, 'and has nothing to explain')
}

{
  // April: 93 clears every target. Then two deliberate misses — one explained,
  // one not — and one measure nobody reported.
  for (const { opId, kpiId } of cqmpSlots()) {
    updateMetric(APRIL.id, opId, kpiId, { value: 93 })
  }
  updateMetric(APRIL.id, 'kc', 'glucose', {
    value: 62.4,
    notes: 'ImageTrend Power Tools consolidation moved the glucose field; crews are re-adapting.',
  })
  updateMetric(APRIL.id, 'eaglemed-chanute', 'stemi', { value: 51, notes: '' })
  updateMetric(APRIL.id, 'winfield', 'airway', { value: null })

  const s = kpiSummary(read(APRIL.id), read(MARCH.id))
  ok(s.rows.length === 26, `every measure gets a verdict, got ${s.rows.length}`)
  ok(s.below === 2, `two below target, got ${s.below}`)
  ok(s.notReported === 1, `one not reported, got ${s.notReported}`)
  ok(s.met === 23, `twenty-three met, got ${s.met}`)
  ok(s.met + s.below + s.notReported + s.noTarget === 26, 'the four verdicts partition the measures')

  ok(s.unexplained.length === 1, `one miss with nothing said about it, got ${s.unexplained.length}`)
  ok(
    s.unexplained[0].operation.id === 'eaglemed-chanute' && s.unexplained[0].kpiId === 'stemi',
    'and it is the right one',
  )
  const explained = s.rows.find((r) => r.operation.id === 'kc' && r.kpiId === 'glucose')
  ok(explained.status === 'below', 'the explained miss is still a miss')
  ok(!explained.needsExplanation, 'but is not flagged as unexplained')
  ok(/Power Tools/.test(explained.why), 'and carries its reason')

  // A measure nobody reported is not a miss — it is a gap, and the two must
  // not be conflated on a slide in front of leadership.
  const missing = s.rows.find((r) => r.operation.id === 'winfield' && r.kpiId === 'airway')
  ok(missing.status === 'not-reported', 'an unreported measure reads as unreported')
  ok(!missing.needsExplanation, 'and is not demanded an explanation it cannot have')

  // Movement against last month.
  // 95.0 in March to 62.4 in April. The delta is against last month, not
  // against the target — those are different questions and the column says so.
  ok(explained.delta === -32.6, `KC glucose moved -32.6 points, got ${explained.delta}`)
  ok(missing.delta === null, 'a month with no number has no delta')
}

{
  // A measure right on its target is met, not missed.
  const edge = createReport('2026-02')
  updateMetric(edge.id, 'kc', 'glucose', { value: 75 })
  updateMetric(edge.id, 'kc', 'airway', { value: 90.9 })
  const s = kpiSummary(read(edge.id), undefined)
  const at = (op, k) => s.rows.find((r) => r.operation.id === op && r.kpiId === k)
  ok(at('kc', 'glucose').status === 'met', 'exactly on target is met')
  ok(at('kc', 'airway').status === 'below', 'a tenth under is below')

  // A target left on a metric from before the standards were fixed must not
  // override the catalogue, or an old month would be judged by an old number.
  updateMetric(edge.id, 'kc', 'glucose', { value: 80, target: 99 })
  ok(
    kpiSummary(read(edge.id), undefined).rows.find(
      (r) => r.operation.id === 'kc' && r.kpiId === 'glucose',
    ).status === 'met',
    'a stale target stored on the metric is ignored in favour of the catalogue',
  )
}

// ---------------------------------------------------------------------------
// Meeting length, including the typo that would otherwise print negative.

{
  ok(meetingMinutes({ startTime: '11:00', endTime: '13:07' }) === 127, '11:00 to 13:07 is 127 min')
  ok(meetingMinutes({ startTime: '11:00' }) === null, 'one time alone gives no duration')
  ok(meetingMinutes(undefined) === null, 'no meeting gives no duration')
  ok(meetingMinutes({ startTime: 'noon', endTime: '13:07' }) === null, 'unparseable gives null')
  ok(meetingMinutes({ startTime: '25:00', endTime: '13:07' }) === null, 'an impossible hour gives null')
  ok(
    meetingMinutes({ startTime: '23:30', endTime: '00:15' }) === 45,
    'a meeting that crosses midnight wraps rather than printing a negative duration',
  )
}

{
  ok(percentOf(81, 100) === 81, 'percent from counts')
  ok(percentOf(2, 3) === 66.67, `rounded to two places, got ${percentOf(2, 3)}`)
  ok(percentOf(5, 0) === null, 'no denominator, no percentage')
}

// ---------------------------------------------------------------------------
// The minutes.

{
  updateMeeting(APRIL.id, {
    date: '2026-05-08',
    startTime: '11:00',
    endTime: '13:07',
    attendees: [
      { name: 'Jordan Jones', title: 'Clinical Education Specialist' },
      { name: 'Odie White', title: 'RCM' },
    ],
    absent: [{ name: 'Louis Schmidt', title: '' }],
  })
  addMinuteRow(APRIL.id, 'agenda', {
    topic: 'KPIs — 911 & Scene Flight Operations',
    notes: 'Stroke and STEMI bundle compliance reviewed.',
    action: 'Continue monitoring bundle compliance trends',
    status: 'open',
  })
  addMinuteRow(APRIL.id, 'aqms', {
    topic: '2026 New Metrics',
    notes: 'Progress noted on new 2026 performance metrics.',
    status: 'open',
  })

  const html = minutesHTML(read(APRIL.id), read(MARCH.id))

  ok(/Regional Clinical Manager Quality &amp; Safety Meeting Minutes/.test(html) ||
     /Regional Clinical Manager Quality & Safety Meeting Minutes/.test(html),
     'the minutes carry the meeting title')
  // The KPI table has to come before the agenda — that is the point of
  // generating the document rather than typing it.
  ok(
    html.indexOf('Key Performance Indicators') < html.indexOf('Agenda Items'),
    'the KPI table comes before the agenda items',
  )
  ok(
    html.indexOf('Key Performance Indicators') < html.indexOf('Attendees'),
    'and before the attendee grid',
  )
  ok(/23 of 26 measures met target/.test(html), 'the lede answers the question in one sentence')
  ok(/91.0%/.test(html), 'the airway target prints from the catalogue')
  ok(/65.0%/.test(html), 'and so does the STEMI one')
  ok(
    /Blood glucose \(75%\)/.test(html),
    'the definitions footnote carries each target',
  )
  ok(/Explanation required/.test(html), 'an unexplained miss is printed as such')
  ok(/Power Tools/.test(html), 'and an explained one prints its explanation')
  ok(/127 min/.test(html), 'the duration is computed onto the header')

  for (const o of CQMP_OFFICERS) {
    ok(html.includes(o.name), `${o.title} (${o.name}) appears in the header`)
  }
  for (const op of CQMP_OPERATIONS) {
    ok(html.includes(op.name), `${op.name} appears on the minutes`)
  }
  ok(/Ground BUs/.test(html) && /Air Bases/.test(html), 'ground and air are listed separately')
  ok(/Craig Isom/.test(html) && /Submitted to/.test(html), 'the submission line names the director')
  ok(/Jordan Jones/.test(html), 'attendees print')
  ok(/Louis Schmidt/.test(html), 'and so does anyone absent')
  ok(/2026 New Metrics/.test(html), 'the AQM row prints')
  ok(/Patient Safety Issues/.test(html), 'the safety table prints even when empty')
  ok(minutesFilename(read(APRIL.id)) === 'CQMP_Meeting_Minutes_2026-04', 'the file is named for its month')

  // A rendered sample for the eye, taken here — before the escaping test below
  // fills the document with angle brackets.
  const sample = join(tmpdir(), 'ces-cqmp-minutes-sample.html')
  writeFileSync(sample, html)
  console.log(`check-cqmp: sample written to ${sample}`)
}

{
  // Anything a person typed is data, not markup.
  const row = read(APRIL.id).meeting.agenda[0]
  updateMinuteRow(APRIL.id, 'agenda', row.id, { topic: '<script>alert(1)</script>' })
  updateMeeting(APRIL.id, { attendees: [{ name: '<img src=x onerror=1>', title: 'RCM' }] })
  updateMetric(APRIL.id, 'eaglemed-chanute', 'stemi', {
    value: 72,
    target: 90,
    notes: '<b>bold claim</b>',
  })
  const html = minutesHTML(read(APRIL.id), read(MARCH.id))
  ok(!/<script>/.test(html), 'a topic containing markup is escaped')
  ok(!/<img src=x/.test(html), 'so is an attendee name')
  ok(!/<b>bold claim<\/b>/.test(html), 'and so is an explanation')
  ok(/&lt;b&gt;bold claim/.test(html), 'the text itself still reads back')
}

{
  // A month with nothing entered still produces a filable document rather than
  // throwing — most months start that way.
  const empty = createReport('2026-01')
  const html = minutesHTML(read(empty.id), undefined)
  ok(/0 of 26 measures met target/.test(html), 'an empty month says so plainly')
  ok(!/Explanation required/.test(html), 'and demands no explanations for numbers nobody entered')
  ok(html.length > 2000, 'the document is still complete')
}

if (fails.length) {
  console.error(`check-cqmp: ${fails.length} of ${checks} checks failed\n`)
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log(`check-cqmp: ${checks} checks passed`)
