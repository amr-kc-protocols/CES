// Behaviour check for the placement board — spec stage 2.
//
// Ninety placements, two organisations, and a department that takes one student
// a week. The rules that matter are the ones that say no:
//
//   - a department at its cap for that week refuses another student
//   - a student cannot be in two places on one day
//   - cancelling frees the slot; a cancelled placement is not occupying anything
//   - working a placement creates the shift, and the two stay independent
//     afterwards — cancel the plan and no evidence moves
//
// Plus the arithmetic the board exists to surface: whether the capacity that
// physically exists covers what each phase is asking for, which is a question
// worth answering in October rather than December.
//
// Run: node scripts/check-placement.mjs  (or `npm run check:placement`)
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

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')
const OUT = join(tmpdir(), `ces-placement-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `
      export * from ${JSON.stringify(join(SRC, 'modules/aemt/aemtStore'))}
      export * from ${JSON.stringify(join(SRC, 'modules/aemt/placement'))}
      export * from ${JSON.stringify(join(SRC, 'data/aemtSites'))}
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
  addPlacement,
  addPreceptor,
  createCourse,
  addStudent,
  deletePreceptor,
  getState,
  phaseCoverage,
  phasesFor,
  placeableSites,
  placementIssues,
  blocking,
  seedSites,
  studentLoad,
  unitLoad,
  updatePlacement,
  updateUnit,
  weekStart,
  weeksBetween,
  workPlacement,
  DEFAULT_UNIT_CAP,
  SITE_TEMPLATES,
} = m

let checks = 0
const fails = []
const ok = (cond, msg) => {
  checks++
  if (!cond) fails.push(msg)
}

// ---------------------------------------------------------------------------
// Weeks. A cap of "one a week" is meaningless if two callers disagree about
// where the week starts.

{
  // 2026-11-09 is a Monday; 2026-11-15 the Sunday that closes that week.
  ok(weekStart('2026-11-09') === '2026-11-09', `Monday is its own week start`)
  ok(weekStart('2026-11-11') === '2026-11-09', 'Wednesday belongs to that Monday')
  ok(weekStart('2026-11-15') === '2026-11-09', 'Sunday still belongs to that Monday')
  ok(weekStart('2026-11-16') === '2026-11-16', 'the next Monday starts a new week')
  ok(weeksBetween('2026-11-09', '2026-11-29').length === 3, 'three Mondays in that span')
  ok(weeksBetween('2026-11-29', '2026-11-09').length === 0, 'a reversed range yields nothing')
  ok(weeksBetween('2026-11-11', '2026-11-11').length === 1, 'a single day is one week')
}

// ---------------------------------------------------------------------------
// The seed.

const course = createCourse({
  label: 'AEMT Oct 2026',
  startDate: '2026-10-06',
  endDate: '2027-02-04',
})
seedSites(course.id)
const readCourse = () => getState().aemtCourses.find((c) => c.id === course.id)
const sites = () => placeableSites(readCourse())
const siteNamed = (n) => sites().find((s) => s.name.includes(n))
const unitNamed = (site, n) => site.units.find((u) => u.name.includes(n))

{
  ok(sites().length === SITE_TEMPLATES.length, `every template site is seeded, got ${sites().length}`)
  ok(!!siteNamed('Shawnee Mission'), 'Shawnee Mission is on the list')
  ok(siteNamed('South Overland Park').active === true, 'South Overland Park is active')
  ok(
    siteNamed('Prairie Star').active === false,
    'Prairie Star is on file and switched off — low volume, not deleted',
  )
  ok(siteNamed('Independence').kind === 'field', 'AMR Independence is a field site')
  ok(
    siteNamed('Shawnee Mission').units.every((u) => u.weeklySlotCap === DEFAULT_UNIT_CAP),
    'every hospital department starts at the working assumption of one a week',
  )
  const preop = unitNamed(siteNamed('Shawnee Mission'), 'Pre-op')
  ok(preop.produces.includes('venipuncture'), 'pre-op is where the sticks are')
  ok(
    !unitNamed(siteNamed('Shawnee Mission'), 'L&D').produces.includes('venipuncture'),
    'L&D is not, and the board should not offer it as if it were',
  )
  ok(
    m.unitsProducing(sites(), 'io').every((x) => x.unit.name === 'ED'),
    'IO comes from the ED and nowhere else in the hospital',
  )
  ok(
    m.unitsProducing(sites(), 'venipuncture').every((x) => x.site.active !== false),
    'an inactive campus is never offered as a source',
  )

  // Re-seeding must not duplicate a site the instructor already entered.
  const before = sites().length
  seedSites(course.id)
  ok(sites().length === before, 're-seeding does not duplicate sites')
}

// ---------------------------------------------------------------------------
// Capacity. One student a week per department, and the board says no.

const students = ['Alex Rivera', 'Sam Chen', 'Dana Whitfield', 'Rae Okafor', 'Jo Halloran'].map(
  (n) => addStudent(course.id, n),
)
const SM = () => siteNamed('Shawnee Mission')
const preopId = () => unitNamed(SM(), 'Pre-op').id
const edId = () => unitNamed(SM(), 'ED').id

{
  const first = addPlacement(course.id, {
    studentId: students[0].id,
    date: '2026-11-10',
    siteId: SM().id,
    unitId: preopId(),
    hours: 12,
    status: 'assigned',
  })
  ok(first.ok, `the first placement in pre-op is accepted: ${first.refused ?? ''}`)

  // Same week, same department, different student and a different day.
  const second = addPlacement(course.id, {
    studentId: students[1].id,
    date: '2026-11-12',
    siteId: SM().id,
    unitId: preopId(),
    hours: 12,
    status: 'assigned',
  })
  ok(!second.ok, 'a second student in pre-op the same week is refused')
  ok(/takes 1 student a week/.test(second.refused ?? ''), `the refusal names the cap: "${second.refused}"`)
  ok(/2026-11-09/.test(second.refused ?? ''), 'and names the week that is full')

  // The next week is free.
  const nextWeek = addPlacement(course.id, {
    studentId: students[1].id,
    date: '2026-11-17',
    siteId: SM().id,
    unitId: preopId(),
    hours: 12,
    status: 'assigned',
  })
  ok(nextWeek.ok, 'the same department the following week is fine')

  // A different department the same week is fine — that is the whole point of
  // five students against six departments.
  const otherUnit = addPlacement(course.id, {
    studentId: students[1].id,
    date: '2026-11-12',
    siteId: SM().id,
    unitId: edId(),
    hours: 12,
    status: 'assigned',
  })
  ok(otherUnit.ok, 'a different department the same week is fine')

  ok(unitLoad(getState().aemtPlacements, preopId(), '2026-11-11') === 1, 'pre-op reads as full')
  ok(unitLoad(getState().aemtPlacements, edId(), '2026-11-11') === 1, 'the ED reads as full')
  ok(unitLoad(getState().aemtPlacements, preopId(), '2026-11-18') === 1, 'the next week is its own count')
}

{
  // One person, one place.
  const clash = addPlacement(course.id, {
    studentId: students[1].id,
    date: '2026-11-12',
    siteId: SM().id,
    unitId: unitNamed(SM(), 'PACU').id,
    hours: 12,
    status: 'assigned',
  })
  ok(!clash.ok, 'a student already placed that day cannot be placed again')
  ok(/already placed/.test(clash.refused ?? ''), `the refusal says why: "${clash.refused}"`)

  // An open slot is not anybody's day, so it does not clash.
  const open = addPlacement(course.id, {
    date: '2026-11-12',
    siteId: SM().id,
    unitId: unitNamed(SM(), 'PACU').id,
    hours: 12,
    status: 'open',
  })
  ok(open.ok, 'an unassigned slot on a busy day is fine')
}

{
  // Cancelling frees the slot rather than holding it.
  const held = getState().aemtPlacements.find(
    (p) => p.unitId === preopId() && weekStart(p.date) === '2026-11-09',
  )
  const cancel = updatePlacement(held.id, { status: 'cancelled' })
  ok(cancel.ok, 'a placement can always be cancelled')
  ok(
    unitLoad(getState().aemtPlacements, preopId(), '2026-11-11') === 0,
    'and the department is free again',
  )
  const refill = addPlacement(course.id, {
    studentId: students[2].id,
    date: '2026-11-11',
    siteId: SM().id,
    unitId: preopId(),
    hours: 12,
    status: 'assigned',
  })
  ok(refill.ok, 'the freed slot can be filled')
  ok(
    getState().aemtPlacements.some((p) => p.status === 'cancelled'),
    'the cancelled placement is kept, not deleted — a pattern of cancellations at one site should be visible',
  )
}

{
  // Editing a placement must not count it against its own cap.
  const mine = getState().aemtPlacements.find(
    (p) => p.studentId === students[2].id && p.unitId === preopId(),
  )
  const sameSpot = updatePlacement(mine.id, { hours: 8 })
  ok(sameSpot.ok, 'editing a placement in place does not trip its own cap')
  ok(
    getState().aemtPlacements.find((p) => p.id === mine.id).hours === 8,
    'and the edit lands',
  )
}

{
  const inactive = addPlacement(course.id, {
    studentId: students[3].id,
    date: '2026-11-10',
    siteId: siteNamed('Prairie Star').id,
    unitId: unitNamed(siteNamed('Prairie Star'), 'ED').id,
    hours: 12,
    status: 'assigned',
  })
  ok(!inactive.ok, 'a site that is not in use this cohort refuses placements')
  ok(/not in use/.test(inactive.refused ?? ''), `and says so: "${inactive.refused}"`)

  const outside = addPlacement(course.id, {
    studentId: students[3].id,
    date: '2027-06-01',
    siteId: SM().id,
    unitId: unitNamed(SM(), 'Med-surg').id,
    hours: 12,
    status: 'assigned',
  })
  ok(!outside.ok, 'a date past the end of the course is refused')
}

{
  // A cap that is raised takes effect immediately — this is the number most
  // likely to change the moment AdventHealth answers.
  updateUnit(course.id, SM().id, preopId(), { weeklySlotCap: 2 })
  const second = addPlacement(course.id, {
    studentId: students[3].id,
    date: '2026-11-12',
    siteId: SM().id,
    unitId: preopId(),
    hours: 12,
    status: 'assigned',
  })
  ok(second.ok, 'raising the cap admits a second student that week')
  updateUnit(course.id, SM().id, preopId(), { weeklySlotCap: DEFAULT_UNIT_CAP })
  const third = addPlacement(course.id, {
    studentId: students[4].id,
    date: '2026-11-13',
    siteId: SM().id,
    unitId: preopId(),
    hours: 12,
    status: 'assigned',
  })
  ok(!third.ok, 'lowering it back refuses the next one')
  ok(
    getState().aemtPlacements.filter(
      (p) => p.unitId === preopId() && weekStart(p.date) === '2026-11-09' && p.status !== 'cancelled',
    ).length === 2,
    'placements made under the higher cap are not retroactively destroyed',
  )
}

// ---------------------------------------------------------------------------
// Phase notes are said, not enforced.

{
  const issues = placementIssues(
    {
      studentId: students[0].id,
      date: '2026-10-12',
      siteId: SM().id,
      unitId: unitNamed(SM(), 'L&D').id,
      hours: 12,
      status: 'assigned',
    },
    {
      placements: getState().aemtPlacements,
      sites: sites(),
      phases: phasesFor(readCourse()),
      courseStart: '2026-10-06',
      courseEnd: '2027-02-04',
    },
  )
  const note = issues.find((i) => i.severity === 'note')
  ok(!!note, 'placing into the no-clinical phase is worth saying')
  ok(blocking(issues).length === 0, 'and is not refused — the plan is advisory')
  ok(/no-clinical/.test(note.message), `the note names the phase: "${note.message}"`)
}

// ---------------------------------------------------------------------------
// Working a placement creates the shift, and the two stay independent.

{
  const p = getState().aemtPlacements.find((x) => x.status === 'assigned' && x.unitId === preopId())
  const worked = workPlacement(p.id, {
    preceptorName: 'K. Doyle',
    preceptorCredential: 'rn',
    preceptorCertNumber: 'K-1234',
  })
  ok(worked.ok, `a placement can be recorded as worked: ${worked.refused ?? ''}`)
  const shift = getState().aemtShifts.find((s) => s.id === worked.shiftId)
  ok(!!shift, 'and a shift record exists')
  ok(shift.date === p.date, 'the shift takes the placement date')
  ok(shift.setting === 'hospital', 'and the setting from the site kind')
  ok(
    shift.site.includes('Shawnee Mission') && shift.site.includes('Pre-op'),
    `the shift names the department, not just the hospital: "${shift.site}"`,
  )
  ok(shift.preceptorName === 'K. Doyle', 'and the preceptor who actually signed')
  ok(
    getState().aemtPlacements.find((x) => x.id === p.id).status === 'worked',
    'the placement is marked worked',
  )
  ok(
    getState().aemtPlacements.find((x) => x.id === p.id).shiftId === worked.shiftId,
    'and linked to the shift',
  )

  const again = workPlacement(p.id, { preceptorName: 'Someone Else', preceptorCredential: 'rn' })
  ok(!again.ok, 'a placement cannot be worked twice into two shifts')

  // Cancelling the plan must not touch the evidence.
  updatePlacement(p.id, { status: 'cancelled' })
  ok(
    !!getState().aemtShifts.find((s) => s.id === worked.shiftId),
    'cancelling the plan leaves the shift on the record',
  )
  updatePlacement(p.id, { status: 'worked' })
}

{
  const open = getState().aemtPlacements.find((x) => x.status === 'open')
  const r = workPlacement(open.id, { preceptorName: 'K. Doyle', preceptorCredential: 'rn' })
  ok(!r.ok, 'an open slot with nobody in it cannot be worked')
  ok(/Assign a student/.test(r.refused ?? ''), `and says what to do: "${r.refused}"`)
}

// ---------------------------------------------------------------------------
// Preceptors are a contact list, and removing one must not touch evidence.

{
  const prec = addPreceptor(course.id, {
    siteId: SM().id,
    name: 'K. Doyle',
    credential: 'rn',
    certNumber: 'K-1234',
    active: true,
  })
  const target = getState().aemtPlacements.find((p) => p.status === 'assigned')
  updatePlacement(target.id, { preceptorId: prec.id })
  ok(
    getState().aemtPlacements.find((p) => p.id === target.id).preceptorId === prec.id,
    'a placement can name a preceptor',
  )
  const shiftsBefore = getState().aemtShifts.length
  deletePreceptor(prec.id)
  ok(
    getState().aemtPlacements.find((p) => p.id === target.id).preceptorId === undefined,
    'removing them clears the pointer',
  )
  ok(
    !!getState().aemtPlacements.find((p) => p.id === target.id),
    'and keeps the placement — the shift still has to happen',
  )
  ok(getState().aemtShifts.length === shiftsBefore, 'shifts already worked are untouched')
  ok(
    getState().aemtShifts.some((s) => s.preceptorName === 'K. Doyle'),
    'and still carry the name they were signed under',
  )
}

// ---------------------------------------------------------------------------
// The arithmetic the board exists to surface.

{
  const phases = phasesFor(readCourse())
  const cover = phaseCoverage(phases, sites(), getState().aemtPlacements, 5, 'clinical')
  ok(cover.length === 4, `the four phases with clinical in them, got ${cover.length}`)

  const p2 = cover.find((c) => c.phase.ordinal === 2)
  ok(p2.demand === 20, `Phase 2 needs 4 hospital shifts x 5 students = 20, got ${p2.demand}`)
  // Two active campuses x 7 departments x 1/week, over the Phase 2 window.
  ok(p2.supply > p2.demand, `Phase 2 supply ${p2.supply} covers demand ${p2.demand}`)
  ok(p2.shortfall === 0, 'so there is no shortfall to escalate')

  // The point of the number: switch off the second campus and it stops fitting
  // comfortably. This is the arithmetic that has to be looked at in October.
  const oneCampus = sites().map((s) =>
    s.name.includes('South Overland Park') ? { ...s, active: false } : s,
  )
  const solo = phaseCoverage(phases, oneCampus, getState().aemtPlacements, 5, 'clinical').find(
    (c) => c.phase.ordinal === 2,
  )
  ok(
    solo.supply < p2.supply,
    'losing the second campus halves the slots that exist',
  )

  // Field is where the rotation actually strains: twelve of each student's
  // eighteen shifts are field shifts, and capacity is FTO-staffed trucks. At
  // the pessimistic seed of one truck per agency per week the board must report
  // a shortfall rather than quietly implying the plan fits.
  const field = phaseCoverage(phases, sites(), getState().aemtPlacements, 5, 'field')
  const f3 = field.find((c) => c.phase.ordinal === 3)
  ok(f3.demand === 20, `the break block needs 4 field shifts x 5 students, got ${f3.demand}`)
  ok(f3.shortfall > 0, 'and at one truck per agency per week it does not fit — the board says so')
  ok(
    field.reduce((n, c) => n + c.demand, 0) === 60,
    `sixty of the ninety placements are field, got ${field.reduce((n, c) => n + c.demand, 0)}`,
  )
  ok(
    cover.reduce((n, c) => n + c.demand, 0) === 30,
    'and thirty are hospital — ninety in total, as the plan says',
  )
  // Raising the FTO count is what fixes it, which is the question for the CES.
  const moreTrucks = sites().map((s) =>
    s.kind === 'field' ? { ...s, units: s.units.map((u) => ({ ...u, weeklySlotCap: 4 })) } : s,
  )
  const eased = phaseCoverage(phases, moreTrucks, [], 5, 'field').find((c) => c.phase.ordinal === 3)
  ok(eased.shortfall < f3.shortfall, 'more FTO-staffed trucks is what closes the gap')
  ok(
    phaseCoverage(phases, sites(), [], 5, 'clinical').every((c) => c.placed === 0),
    'nothing placed reads as nothing placed',
  )
}

{
  const load = studentLoad(students, getState().aemtPlacements)
  ok(load.length === 5, 'every student is on the list, including the unplaced ones')
  ok(
    load.every((l) => l.assigned >= l.worked),
    'worked can never exceed assigned',
  )
  ok(
    load.some((l) => l.worked === 1),
    'the student whose placement was worked reads as one worked',
  )
  ok(
    !load.some((l) => l.assigned > 0 && l.student.name === 'Jo Halloran'),
    'the student whose only placement was refused has none',
  )
}

if (fails.length) {
  console.error(`check-placement: ${fails.length} of ${checks} checks failed\n`)
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log(`check-placement: ${checks} checks passed`)
