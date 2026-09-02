// Behaviour check for the clinical data layer — spec stage 1.
//
// Three rules decide whether a logged rep is evidence or a claim, and all three
// are date-sensitive in ways a screen makes easy to get wrong:
//
//   - a rep counts only if the student was checked off on that skill BY THE
//     DATE OF THE SHIFT, not by today
//   - a refusal is scoped to the field it is about, so an instructor is not
//     made to fix one thing at a time at the end of a shift
//   - the free-text field blocks the save rather than warning about it
//
// Plus the seed: the rotation plan is stored as offsets so a cohort starting on
// a different day re-seeds instead of being edited into source, and that has to
// reproduce the filed dates exactly for the cohort it was written for.
//
// Run: node scripts/check-stage1.mjs  (or `npm run check:stage1`)
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// lib/store reads localStorage at module load. Give it one before anything is
// imported, so the store behaves as it does in a browser rather than throwing.
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
const OUT = join(tmpdir(), `ces-stage1-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `
      export * from ${JSON.stringify(join(SRC, 'modules/aemt/aemtStore'))}
      export * from ${JSON.stringify(join(SRC, 'data/aemtPhases'))}
      export { getState } from ${JSON.stringify(join(SRC, 'lib/store'))}
      export { CLINICAL_REQUIREMENTS, KC_START_DATE } from ${JSON.stringify(join(SRC, 'data/aemt'))}
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
        // React is stubbed rather than bundled: nothing under test is a hook,
        // and the selectors that are hooks are not called from here.
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
  addShift,
  updateShift,
  attestShift,
  clearanceGate,
  clearedOn,
  encounterCounts,
  grantSkillClearance,
  revokeSkillClearance,
  phasesFor,
  phaseOn,
  progressFor,
  seedPhases,
  shiftIssues,
  checkpointDates,
  checkpointStanding,
  PLANNED_SHIFTS,
  SKILL_CLEARANCES,
  CLINICAL_REQUIREMENTS,
  DEFICIT_CHECKPOINTS,
  KC_START_DATE,
} = m

let checks = 0
const fails = []
const ok = (cond, msg) => {
  checks++
  if (!cond) fails.push(msg)
}

const COURSE = {
  id: 'c1',
  label: 'AEMT Oct 2026',
  startDate: KC_START_DATE,
  endDate: '2027-02-04',
  createdAt: '',
  updatedAt: '',
}
const req = (id) => CLINICAL_REQUIREMENTS.find((r) => r.id === id)

/** ISO date n days on. Kept local so this script needs nothing from the app. */
const addDaysISO = (iso, n) => {
  const [y, mo, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, mo - 1, d) + n * 86_400_000)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}
/** The seeded plan for this cohort, so an edit can be compared against it. */
const seeded = (ordinal) => seedPhases(KC_START_DATE).find((p) => p.ordinal === ordinal)

// ---------------------------------------------------------------------------
// The seed. The filed cohort dates have to come back exactly, and a different
// start date has to produce the same shape without anyone editing source.

{
  const phases = seedPhases(KC_START_DATE)
  ok(KC_START_DATE === '2026-10-05', `the cohort starts ${KC_START_DATE}`)
  ok(phases.length === 5, `five phases, got ${phases.length}`)
  // Derived from the template offsets rather than a list of ISO dates. The
  // dates were hardcoded, and when the class day moved from Tuesday to Monday
  // every one of them was a line of noise hiding the one that mattered: the
  // last phase stopped landing on the last day of the course. What is worth
  // asserting is the shape — windows in order, no gaps, no overlaps — plus that
  // one boundary, which is checked on its own below.
  const inOrder = [...phases].sort((a, b) => a.ordinal - b.ordinal)
  for (let i = 0; i < inOrder.length; i++) {
    const p = inOrder[i]
    ok(p.windowStart <= p.windowEnd, `phase ${p.ordinal} does not end before it starts`)
    if (i === 0) continue
    const prev = inOrder[i - 1]
    ok(
      p.windowStart > prev.windowEnd,
      `phase ${p.ordinal} starts after phase ${prev.ordinal} ends (${prev.windowEnd} -> ${p.windowStart})`,
    )
  }
  ok(
    inOrder[0].windowStart === KC_START_DATE,
    `the first phase opens on day one, got ${inOrder[0].windowStart}`,
  )
  ok(
    phases[4].windowEnd === COURSE.endDate,
    'the last phase ends on the last day of the course',
  )
  ok(PLANNED_SHIFTS === 18, `the plan totals 18 shifts, got ${PLANNED_SHIFTS}`)
  ok(
    phases.find((p) => p.ordinal === 2).requiresClearance === 'vascular',
    'the skill-acquisition phase is the one that needs vascular access',
  )

  // Spec acceptance criterion 10, for the half of it that lives here: a
  // different cohort re-seeds rather than needing a code change.
  const next = seedPhases('2027-03-02')
  ok(next[0].windowStart === '2027-03-02', 'a re-seed starts where the new cohort starts')
  ok(
    next[4].windowEnd === addDaysISO('2027-03-02', 122),
    `a re-seed keeps the span, got ${next[4].windowEnd}`,
  )
  ok(
    next.every((p, i) => p.name === phases[i].name && p.shiftsRequired === phases[i].shiftsRequired),
    'a re-seed keeps the shape',
  )
}

// ---------------------------------------------------------------------------
// The deficit checkpoints. Five dated reviews tied to the didactic gates — the
// mechanism that turns "behind" in November into an assigned shift that week
// rather than a conversation in January.

{
  const dated = checkpointDates(KC_START_DATE)
  ok(dated.length === 5, `five checkpoints, got ${dated.length}`)
  ok(
    dated.map((c) => c.date).join(',') ===
      '2026-11-23,2026-12-16,2027-01-06,2027-01-20,2027-02-03',
    `the tracker's dates come back exactly, got ${dated.map((c) => c.date).join(', ')}`,
  )
  // Each one is a day the instructor is already standing in a classroom. A
  // checkpoint on a day nobody is in the room is a checkpoint nobody reads.
  ok(
    dated.every((c) => !!c.courseAnchor),
    'every checkpoint names the class it is tied to',
  )
  ok(
    dated.every((c, i) => i === 0 || c.shiftsFloor > dated[i - 1].shiftsFloor),
    'the shift floors only ever rise',
  )
  ok(
    dated[dated.length - 1].shiftsFloor === PLANNED_SHIFTS,
    `the last floor is the whole plan, ${PLANNED_SHIFTS}`,
  )
  ok(
    checkpointDates('2027-03-02')[0].date === '2027-04-20',
    'and a later cohort re-dates rather than needing a code change',
  )

  // A student with nothing logged is short on everything, and the shortfalls
  // name what — "assign an added shift" needs somewhere to book it.
  const bare = { id: 'cp-1', courseId: 'c1', name: 'Nobody', status: 'active' }
  const zero = checkpointStanding(
    { id: 'c1', startDate: KC_START_DATE, endDate: '2027-02-04' },
    bare,
    progressFor([], bare, []),
    [],
    '2026-12-01',
  )
  ok(zero.length === 5, 'every checkpoint is evaluated, not just the ones already past')
  ok(zero[0].due && !zero[2].due, 'and each says whether its date has arrived')
  ok(zero[0].shiftsShort === 3, `the first checkpoint reads 3 shifts short, got ${zero[0].shiftsShort}`)
  ok(
    zero[0].shortfalls.some((f) => f.key === 'venipuncture' && f.floor === 6),
    'and names the venipuncture floor rather than just saying "behind"',
  )
  ok(
    zero[0].missingClearances.includes('ecg'),
    'the ECG check-off is one of the things the week 8 review is looking for',
  )
  ok(zero.every((c) => !c.clear), 'nothing logged is clear at no checkpoint')

  // The last two checkpoints say "all minimums met" rather than listing floors.
  // Expanding that has to produce the real K.A.R. numbers, or the final review
  // passes a student who has not met them.
  const last = zero[4]
  const veni = last.shortfalls.find((f) => f.key === 'venipuncture')
  ok(veni?.floor === req('venipuncture').minimum, `the course-end floor is the K.A.R. 20, got ${veni?.floor}`)
  ok(
    last.shortfalls.some((f) => f.key === 'infusion' && f.floor === 10),
    'including the ten that must initiate an infusion',
  )
  ok(
    last.shortfalls.some((f) => f.key === 'assessmentField' && f.floor === 10),
    'and the ten assessments that must happen in the field',
  )
  // Gate 3 is the one that excludes the assessments, because they are still
  // accumulating at that point and only hours remain.
  ok(
    !zero[3].shortfalls.some((f) => f.key === 'assessment' || f.key === 'assessmentField'),
    'the Gate 3 review does not hold the assessments against a student yet',
  )
  ok(
    zero[3].shortfalls.some((f) => f.key === 'io' && f.floor === req('io').minimum),
    'but it does hold every other minimum against them',
  )
}

{
  // A course with no stored plan still has one to read.
  ok(phasesFor(COURSE).length === 5, 'a course with no stored phases is seeded on read')
  ok(phasesFor(undefined).length === 0, 'no course, no phases — not a crash')
  ok(phaseOn(COURSE, '2026-11-20')?.ordinal === 2, 'a November date is in phase 2')
  ok(phaseOn(COURSE, KC_START_DATE)?.ordinal === 0, 'the first day is in phase 0')
  ok(phaseOn(COURSE, '2027-02-04')?.ordinal === 4, 'the last day is in phase 4')
  // The gap before the break block is real, and saying so is better than
  // silently attaching the shift to whichever phase is nearest.
  ok(phaseOn(COURSE, '2026-12-19') === undefined, 'a date in the plan gap belongs to no phase')
  ok(phaseOn(COURSE, '2027-06-01') === undefined, 'a date past the course belongs to no phase')
}

{
  // The plan is seeded, not carved. Editing a window has to stick, and
  // resetting has to put it back — a course whose plan was never touched has
  // nothing stored, which is how "seeded on read" is meant to look.
  const course = m.createCourse({
    label: 'AEMT Oct 2026',
    startDate: KC_START_DATE,
    endDate: '2027-02-04',
  })
  const read = () => m.getState().aemtCourses.find((c) => c.id === course.id)
  ok(read().phases === undefined, 'an untouched course stores no plan of its own')
  ok(phasesFor(read()).length === 5, 'and still reads five phases')

  m.updatePhase(course.id, 2, { windowStart: '2026-11-16', windowEnd: '2026-12-24' })
  const moved = phasesFor(read()).find((p) => p.ordinal === 2)
  ok(moved.windowStart === '2026-11-16', `the moved window sticks, got ${moved.windowStart}`)
  ok(read().phases.length === 5, 'the first edit materialises the whole plan, not one phase')
  ok(
    phasesFor(read()).find((p) => p.ordinal === 1).windowEnd === seeded(1).windowEnd,
    'and leaves the phases either side where they were',
  )
  ok(phaseOn(read(), '2026-12-22')?.ordinal === 2, 'a date in the extended window is in phase 2')

  m.reseedPhases(course.id)
  ok(
    phasesFor(read()).find((p) => p.ordinal === 2).windowStart === seeded(2).windowStart,
    'resetting puts the window back to the plan',
  )
}

// ---------------------------------------------------------------------------
// Clearance gating (spec §6.3) — the date tested is the date of the shift.

const CLEARED = {
  id: 's1',
  courseId: 'c1',
  name: 'Alex Rivera',
  status: 'active',
  skillClearances: [
    { code: 'vascular', grantedOn: '2026-11-09', grantedBy: 'J. Jones', recordedAt: '' },
    { code: 'ecg', grantedOn: '2026-11-16', grantedBy: 'J. Jones', recordedAt: '' },
  ],
}
const BARE = { id: 's2', courseId: 'c1', name: 'Sam Chen', status: 'active' }

{
  for (const id of ['venipuncture', 'io', 'injection']) {
    const g = clearanceGate(CLEARED, id, '2026-11-08')
    ok(g.blocked, `${id} the day before the check-off is refused`)
    ok(g.message?.includes('2026-11-09'), `${id} refusal names the check-off date`)
    ok(!clearanceGate(CLEARED, id, '2026-11-09').blocked, `${id} on the day of the check-off counts`)
    ok(!clearanceGate(CLEARED, id, '2026-12-01').blocked, `${id} after the check-off counts`)
  }
  ok(clearanceGate(CLEARED, 'ecg', '2026-11-15').blocked, 'ECG before its own check-off is refused')
  ok(!clearanceGate(CLEARED, 'ecg', '2026-11-16').blocked, 'ECG on its check-off date counts')
  // The two gates are independent — vascular does not imply ECG.
  ok(
    clearanceGate(CLEARED, 'ecg', '2026-11-10').blocked &&
      !clearanceGate(CLEARED, 'venipuncture', '2026-11-10').blocked,
    'the vascular check-off does not silently clear ECG',
  )
}

{
  // Spec acceptance criterion 3: field-scoped, not form-scoped. On one date,
  // one student, the vascular counts are refused and the rest are not.
  const date = '2026-11-01'
  const refused = ['venipuncture', 'io', 'injection'].filter(
    (id) => clearanceGate(CLEARED, id, date).blocked,
  )
  const accepted = ['assessment', 'calls', 'pcr', 'nebulizer'].filter(
    (id) => !clearanceGate(CLEARED, id, date).blocked,
  )
  ok(refused.length === 3, `all three vascular skills refused, got ${refused.join(',')}`)
  ok(accepted.length === 4, `assessment, calls, PCR and neb still accepted on the same date`)
}

{
  const g = clearanceGate(BARE, 'venipuncture', '2026-12-01')
  ok(g.blocked, 'a student with no check-off on file is refused')
  ok(g.grantedOn === undefined, 'and has no date to report')
  ok(/no .* check-off on file/i.test(g.message ?? ''), `the refusal says why: "${g.message}"`)
  ok(!clearanceGate(BARE, 'assessment', '2026-12-01').blocked, 'assessment is recorded, not enforced')
  ok(
    SKILL_CLEARANCES.find((c) => c.code === 'assessment').gates.length === 0,
    'the assessment clearance gates nothing — deliberate, and documented',
  )
}

// ---------------------------------------------------------------------------
// Shift entry validation (spec §6.1, §6.4), field by field.

const GOOD_SHIFT = {
  date: '2026-11-20',
  setting: 'field',
  site: 'AMR Independence 911',
  hours: 12,
  preceptorName: 'R. Alvarez',
  preceptorCredential: 'paramedic',
}
const fieldsOf = (issues) => issues.map((i) => i.field).sort()

{
  ok(shiftIssues(COURSE, GOOD_SHIFT).length === 0, 'a well-formed shift has nothing wrong with it')
  ok(
    fieldsOf(shiftIssues(COURSE, { ...GOOD_SHIFT, hours: 0 })).join() === 'hours',
    'zero hours is a shift with no hours',
  )
  ok(
    fieldsOf(shiftIssues(COURSE, { ...GOOD_SHIFT, hours: 25 })).join() === 'hours',
    'twenty-five hours is longer than a day',
  )
  ok(shiftIssues(COURSE, { ...GOOD_SHIFT, hours: 24 }).length === 0, 'twenty-four hours is allowed')
  ok(shiftIssues(COURSE, { ...GOOD_SHIFT, hours: 1 }).length === 0, 'one hour is allowed')
  ok(
    fieldsOf(shiftIssues(COURSE, { ...GOOD_SHIFT, date: '2026-09-01' })).join() === 'date',
    'a shift before the course started is not a course shift',
  )
  ok(
    fieldsOf(shiftIssues(COURSE, { ...GOOD_SHIFT, date: '2027-03-01' })).join() === 'date',
    'a shift after the course ended is not a course shift',
  )
  ok(
    shiftIssues(undefined, { ...GOOD_SHIFT, date: '2020-01-01' }).length === 0,
    'with no course in hand there is no window to be outside of',
  )
  ok(
    fieldsOf(shiftIssues(COURSE, { ...GOOD_SHIFT, preceptorCredential: 'lpn' })).join() ===
      'preceptorCredential',
    'an LPN cannot precept a field internship shift',
  )
  ok(
    shiftIssues(COURSE, {
      ...GOOD_SHIFT,
      setting: 'hospital',
      preceptorCredential: 'lpn',
    }).length === 0,
    'an LPN can precept a hospital clinical shift',
  )
  ok(
    fieldsOf(shiftIssues(COURSE, { ...GOOD_SHIFT, site: '  ' })).join() === 'site',
    'a shift needs a site',
  )
}

{
  // Spec acceptance criterion 4, and the reason it is field-scoped: the
  // reflection is refused while everything else about the shift is accepted.
  const issues = shiftIssues(COURSE, {
    ...GOOD_SHIFT,
    reflection: 'Ran call 20260415 with my preceptor.',
  })
  ok(fieldsOf(issues).join() === 'reflection', `only the reflection is wrong, got ${fieldsOf(issues)}`)
  ok(/Describe the skill/.test(issues[0].message), 'the message says what to write instead')
  ok(
    !issues[0].message.includes('20260415'),
    'the message does not repeat the offending text back',
  )
  ok(
    shiftIssues(COURSE, { ...GOOD_SHIFT, reflection: 'Second IO. Landmarks easier than in lab.' })
      .length === 0,
    'a reflection about the skill saves',
  )
  // Two things wrong is two messages, on two fields.
  const both = shiftIssues(COURSE, {
    ...GOOD_SHIFT,
    hours: 40,
    reflection: 'Mr. Halloran was hypotensive.',
  })
  ok(
    fieldsOf(both).join() === 'hours,reflection',
    `both problems are reported at once, got ${fieldsOf(both)}`,
  )
}

// ---------------------------------------------------------------------------
// The store refuses the write, not just the button.

{
  const result = addShift('c1', 's1', {
    ...GOOD_SHIFT,
    reflection: 'Pt. Halloran, run 1234567.',
  })
  ok(!result.ok, 'the store refuses a shift whose reflection carries PHI')
  ok(!result.shift, 'and writes nothing')
  ok(/Describe the skill/.test(result.refused ?? ''), 'and says what to write instead')

  const clean = addShift('c1', 's1', { ...GOOD_SHIFT, reflection: 'Good shift. Two IVs.' })
  ok(clean.ok && !!clean.shift, 'a clean reflection saves')
  const edit = updateShift(clean.shift.id, { reflection: 'DOB 03/14/1985 on the band.' })
  ok(!edit.ok, 'editing a reflection into PHI is refused too')
  const stored = m.getState().aemtShifts.find((s) => s.id === clean.shift.id)
  ok(
    stored.reflection === 'Good shift. Two IVs.',
    `the refused edit left the stored reflection alone, got "${stored.reflection}"`,
  )
  ok(
    !JSON.stringify(m.getState()).includes('03/14/1985'),
    'the rejected text is nowhere in the store — not in the record, not in the audit trail',
  )
}

// ---------------------------------------------------------------------------
// The tally. A rep counts only when every condition holds, and the clearance
// is one of them — including retroactively, when one is withdrawn.

const attested = (shift) => ({
  ...shift,
  attestedAt: '2026-12-01T00:00:00.000Z',
  attestation: {
    by: shift.preceptorName,
    credential: shift.preceptorCredential,
    certNumber: 'K-1234',
    at: '2026-12-01T00:00:00.000Z',
    statement: 'attested',
    actor: 'jordan',
  },
})

const HOSP_BEFORE = attested({
  id: 'sh-early',
  courseId: 'c1',
  studentId: 's1',
  date: '2026-11-02',
  setting: 'hospital',
  site: 'AdventHealth KC — ED',
  hours: 12,
  preceptorName: 'K. Doyle',
  preceptorCredential: 'rn',
})
const HOSP_AFTER = attested({ ...HOSP_BEFORE, id: 'sh-late', date: '2026-11-20' })
const SHIFTS = [HOSP_BEFORE, HOSP_AFTER]

const stick = (id, shiftId, infusion = false) => ({
  id,
  courseId: 'c1',
  studentId: 's1',
  date: SHIFTS.find((s) => s.id === shiftId).date,
  siteKind: 'hospital',
  requirementId: 'venipuncture',
  count: 1,
  outcome: 'success',
  initiatedInfusion: infusion,
  shiftId,
})

{
  const encounters = [
    stick('e1', 'sh-early', true),
    stick('e2', 'sh-early'),
    stick('e3', 'sh-late', true),
    stick('e4', 'sh-late'),
  ]
  const p = progressFor(encounters, CLEARED, SHIFTS).find((x) => x.requirement.id === 'venipuncture')
  ok(p.total === 2, `only the two after the check-off count, got ${p.total}`)
  ok(p.uncleared === 2, `the two before it are named as uncleared, got ${p.uncleared}`)
  ok(p.ineligible === 2, 'and are reported as logged-but-not-counting')
  ok(p.sub === 1, `only the counting stick that started an infusion counts, got ${p.sub}`)

  // Spec acceptance criterion 2. The app cannot represent more infusions than
  // venipunctures — an infusion is a flag on a stick, not a separate number —
  // so the invariant is structural rather than a validation message.
  const all = progressFor(encounters, CLEARED, SHIFTS)
  ok(
    all.every((x) => x.sub <= x.total),
    'no requirement can report more sub-counts than counts',
  )

  // Nothing counts for a student who was never checked off.
  const none = progressFor(
    encounters.map((e) => ({ ...e, studentId: 's2' })),
    BARE,
    SHIFTS,
  ).find((x) => x.requirement.id === 'venipuncture')
  ok(none.total === 0, `an uncleared student counts nothing, got ${none.total}`)
  ok(none.uncleared === 4, `and all four are named as uncleared, got ${none.uncleared}`)
}

{
  // encounterCounts is the single gate, and it refuses without a student
  // rather than defaulting to "cleared".
  const e = stick('e5', 'sh-late')
  ok(encounterCounts(e, req('venipuncture'), HOSP_AFTER, CLEARED), 'a cleared rep counts')
  ok(
    !encounterCounts(e, req('venipuncture'), HOSP_AFTER, undefined),
    'an omitted student is not treated as cleared',
  )
  ok(
    !encounterCounts(stick('e6', 'sh-early'), req('venipuncture'), HOSP_BEFORE, CLEARED),
    'a rep before the check-off does not count',
  )
  // Assessment is not gated, so the same early shift carries it.
  ok(
    encounterCounts(
      { ...stick('e7', 'sh-early'), requirementId: 'assessment' },
      req('assessment'),
      HOSP_BEFORE,
      CLEARED,
    ),
    'an assessment on the same early shift still counts',
  )
}

// ---------------------------------------------------------------------------
// Granting and withdrawing, through the store.

{
  const student = m.addStudent('c1', 'Dana Whitfield')
  const read = () => m.getState().aemtStudents.find((s) => s.id === student.id)
  ok(clearedOn(read(), 'vascular') === undefined, 'a fresh student is cleared for nothing')

  grantSkillClearance(student.id, 'vascular', '2026-11-09', {
    actor: 'jordan',
    grantedBy: 'J. Jones',
  })
  ok(clearedOn(read(), 'vascular') === '2026-11-09', 'the grant reads back as a date, not a tick')
  ok(
    read().skillClearances.find((c) => c.code === 'vascular').grantedBy === 'J. Jones',
    'and records who signed it off',
  )

  // The date is the whole point, so correcting it must replace rather than
  // stack — two rows for one check-off is two answers to one question.
  grantSkillClearance(student.id, 'vascular', '2026-11-02', { actor: 'jordan' })
  ok(read().skillClearances.length === 1, 'correcting the date does not leave two grants behind')
  ok(clearedOn(read(), 'vascular') === '2026-11-02', 'the corrected date is what is read back')
  const moved = m
    .getState()
    .aemtAudit.filter((a) => a.studentId === student.id)
  ok(moved.length === 2, `both the grant and the correction are audited, got ${moved.length}`)
  ok(
    moved[1].detail.includes('2026-11-09') && moved[1].detail.includes('2026-11-02'),
    `the audit line carries the move: "${moved[1].detail}"`,
  )

  revokeSkillClearance(student.id, 'vascular', 'jordan', 'recorded against the wrong student')
  ok(clearedOn(read(), 'vascular') === undefined, 'a withdrawal removes the date')
  ok(
    m.getState().aemtAudit.some((a) => a.action.includes('WITHDRAWN')),
    'and is audited as a withdrawal',
  )
  ok(
    m.getState().aemtAudit.some((a) => a.detail.includes('wrong student')),
    'with the reason it was given',
  )
}

if (fails.length) {
  console.error(`check-stage1: ${fails.length} of ${checks} checks failed\n`)
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log(`check-stage1: ${checks} checks passed`)
