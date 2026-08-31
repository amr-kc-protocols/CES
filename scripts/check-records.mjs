// Behaviour check for the program-records registry and the evaluation forms.
//
// The registry is a claim about where every K.A.R. 109-17-3 record lives, and
// the claim is only useful if it is true. Two ways it goes wrong, both silent:
//
//   A RECORD POINTING SOMEWHERE IT IS NOT. The syllabus said "kept elsewhere,
//   produced by doc:syllabus", which are two different answers to one question.
//   Preceptor evaluations said they lived outside CES and were produced by
//   doc:forms — that command prints the BLANK form; the returned evaluations
//   are in the Forms tab. An auditor sent to a shared drive for those would
//   have found nothing.
//
//   AN INSTRUMENT NOBODY COUNTS. Every one of the five evaluation forms has to
//   belong to exactly one record, or the counts mean nothing: counting every
//   form response wholesale reported preceptor evaluations on file because
//   somebody had filled in a course evaluation.
//
// Then the forms themselves, driven through the store rather than read. The
// defect this was written for passed every static check: `useStudentReadiness`
// counted evaluation FORMS rather than instructors, so on the joint Kansas City
// / Wichita cohort a student who evaluated one of the two instructors read
// "2 of 2 submitted" and completed. The co-instructor was evaluated by nobody,
// which is the thing K.A.R. 109-17-3 asks for by name.
//
// Run: node scripts/check-records.mjs  (or `npm run check:records`)
import { rmSync, readFileSync } from 'node:fs'
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
const ROOT = join(here, '..')
const SRC = join(ROOT, 'src')
const OUT = join(tmpdir(), `ces-records-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `
      export * from ${JSON.stringify(join(SRC, 'modules/aemt/aemtStore'))}
      export * as D from ${JSON.stringify(join(SRC, 'data/aemt'))}
      export * as R from ${JSON.stringify(join(SRC, 'data/aemtRecords'))}
      export * as F from ${JSON.stringify(join(SRC, 'data/aemtForms'))}
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
            // The hooks here are read-only selectors over a synchronous store,
            // so calling the getter is exactly what the component would see.
            'export const useSyncExternalStore=(sub,get)=>get();' +
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
const { D, R, F } = m
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

let failed = 0
const check = (ok, label, detail) => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok && detail) console.log(`        ${String(detail).split('\n').join('\n        ')}`)
}

// ----- the registry says where each record is --------------------------------

const sources = new Set(['ces', 'generated', 'external'])
check(
  R.REQUIRED_RECORDS.every((r) => sources.has(r.source)),
  'every record names one of the three places a record can be',
  R.REQUIRED_RECORDS.filter((r) => !sources.has(r.source)).map((r) => r.id).join(', '),
)

const genNoCommand = R.GENERATED_RECORDS.filter((r) => !r.generator)
check(genNoCommand.length === 0, 'every generated record names the command that produces it', genNoCommand.map((r) => r.id).join(', '))

const badCommand = R.REQUIRED_RECORDS
  .flatMap((r) => [r.generator, r.blankForm])
  .filter(Boolean)
  .filter((g) => !pkg.scripts[g])
check(badCommand.length === 0, 'every command a record names is a real npm script', [...new Set(badCommand)].join(', '))

const unexplained = R.EXTERNAL_RECORDS.filter((r) => !r.noGenerator?.trim())
check(
  unexplained.length === 0,
  'every record kept elsewhere says why nothing here can produce it',
  unexplained.map((r) => r.label).join('\n'),
)

// A 'generated' record has a command; an 'external' one has an explanation.
// Holding both is the confusion this list was rewritten to remove.
const confused = R.REQUIRED_RECORDS.filter((r) => r.generator && r.noGenerator)
check(confused.length === 0, 'no record claims a generator and an absence of one', confused.map((r) => r.id).join(', '))

// The distinction that kept getting lost: a CES-held record may name the
// command that prints its BLANK form, but that command does not produce it.
const heldWithGenerator = R.HELD_RECORDS.filter((r) => r.generator)
check(
  heldWithGenerator.length === 0,
  'no CES-held record claims to be produced by a command',
  `${heldWithGenerator.map((r) => r.id).join(', ')} — a blank form is not the record collected on it; use blankForm`,
)

// The stored collections a CES-held record can be evidenced by. Kept in step
// with RecordEvidence in the registry and with the counting in RecordsTab and
// the audit package — a key that resolves in one and not the others prints
// "held in CES" over an empty collection.
const uncited = R.REQUIRED_RECORDS.filter((r) => !r.citation?.trim())
check(
  uncited.length === 0,
  'every record cites the regulation it exists because of',
  `${uncited.map((r) => r.id).join(', ')} — the Records tab prints these as a requirement listing`,
)
const badCitation = R.REQUIRED_RECORDS.filter((r) => !/K\.A\.R\.|Program quality/.test(r.citation))
check(badCitation.length === 0, 'every citation names a Kansas regulation or says it is not one', badCitation.map((r) => r.id).join(', '))

const evidenceKeys = new Set([
  'attendance', 'skillChecks', 'encounters', 'students', 'sessions',
  'completions', 'makeUps', 'conferences',
])
const badEvidence = R.HELD_RECORDS.filter((r) => r.evidence && !evidenceKeys.has(r.evidence))
check(badEvidence.length === 0, 'every evidence key names a collection that exists', badEvidence.map((r) => r.id).join(', '))

const unevidenced = R.HELD_RECORDS.filter((r) => !r.evidence && !r.formEvidence)
check(
  unevidenced.length === 0,
  'every CES-held record says what evidences it',
  `${unevidenced.map((r) => r.id).join(', ')} — without one it prints "held" for an empty course`,
)

// ----- every instrument belongs to exactly one record ------------------------

const claimed = R.REQUIRED_RECORDS.flatMap((r) => r.formEvidence ?? [])
const orphanForms = F.AEMT_FORMS.filter((f) => !claimed.includes(f.id))
check(
  orphanForms.length === 0,
  'every evaluation instrument belongs to a record',
  `${orphanForms.map((f) => f.id).join(', ')} — an instrument no record claims is collected and counted by nobody`,
)
const doubleClaimed = claimed.filter((id, i) => claimed.indexOf(id) !== i)
check(doubleClaimed.length === 0, 'no instrument is claimed by two records', [...new Set(doubleClaimed)].join(', '))
const ghostForms = claimed.filter((id) => !F.AEMT_FORMS.some((f) => f.id === id))
check(ghostForms.length === 0, 'every instrument a record claims exists', [...new Set(ghostForms)].join(', '))

// ----- the forms, driven ------------------------------------------------------

const FORMS = F.AEMT_FORMS.map((f) => ({ id: f.id, cadence: f.cadence }))
const course = m.createCourse({
  label: 'check-records joint cohort',
  startDate: D.KC_START_DATE,
  endDate: D.KC_END_DATE,
  market: 'kc',
  primaryInstructor: D.PRIMARY_INSTRUCTOR.name,
  coInstructors: D.COURSE_STAFF.filter((s) => s.role !== 'primary').map((s) => s.name),
})
const student = m.addStudent(course.id, 'Check Student')
const evalCheck = () =>
  m.useStudentReadiness(course.id, undefined, [], FORMS)[0].checks.find((c) => c.id === 'evaluations')

check(
  m.instructorsOfRecord(m.useCourse(course.id)).length === D.COURSE_STAFF.length,
  'the course record can hold every instructor who teaches the cohort',
  'a joint course has one primary instructor and more than one instructor',
)

m.addFormResponse(course.id, 'course-eval', { studentId: student.id, date: '2027-02-04', values: { objectives: 5 } })
m.addFormResponse(course.id, 'instructor-eval', {
  studentId: student.id,
  date: '2027-02-04',
  values: { instructor: D.PRIMARY_INSTRUCTOR.name, knowledge: 5 },
})
const oneInstructor = evalCheck()
check(
  oneInstructor.status === 'unmet' && /instructor-eval: 1 of 2/.test(oneInstructor.detail),
  'evaluating one of two instructors does not satisfy the evaluation gate',
  oneInstructor.detail,
)

// Two evaluations of the same person are two evaluations of the same person.
m.addFormResponse(course.id, 'instructor-eval', {
  studentId: student.id,
  date: '2027-02-04',
  values: { instructor: D.PRIMARY_INSTRUCTOR.name, knowledge: 4 },
})
check(
  /instructor-eval: 1 of 2/.test(evalCheck().detail),
  'a second evaluation of the same instructor does not count as the other one',
  evalCheck().detail,
)

for (const co of D.COURSE_STAFF.filter((s) => s.role !== 'primary')) {
  m.addFormResponse(course.id, 'instructor-eval', {
    studentId: student.id,
    date: '2027-02-04',
    values: { instructor: co.name, knowledge: 4 },
  })
}
check(!/instructor-eval/.test(evalCheck().detail), 'evaluating every instructor clears that part', evalCheck().detail)

// Shift-cadence instruments are owed per shift, which nothing counted before.
const SHIFTS = 4
for (let i = 0; i < SHIFTS; i++) {
  m.addShift(course.id, student.id, {
    date: `2026-11-${10 + i * 2}`,
    hours: 12,
    setting: 'clinical',
    site: 'Check Hospital',
    preceptorName: 'A. Nurse',
    preceptorCredential: 'rn',
  })
}
const shiftForms = F.AEMT_FORMS.filter((f) => f.cadence === 'shift')
const owedNow = evalCheck().detail
check(
  shiftForms.every((f) => new RegExp(`${f.id}: 0 of ${SHIFTS}`).test(owedNow)),
  `${SHIFTS} logged shifts owe ${SHIFTS} of each per-shift instrument`,
  owedNow,
)

for (const f of shiftForms) {
  for (let i = 0; i < SHIFTS; i++) {
    m.addFormResponse(course.id, f.id, { studentId: student.id, date: `2026-11-${10 + i * 2}`, values: { note: 'x' } })
  }
}
for (const f of F.AEMT_FORMS.filter((x) => x.cadence === 'ongoing')) {
  m.addFormResponse(course.id, f.id, { studentId: student.id, date: '2026-12-15', values: { integrity: 3 } })
}
check(evalCheck().status === 'met', 'the gate passes once every instrument is accounted for', evalCheck().detail)

// ----- make-ups ---------------------------------------------------------------

m.seedKcSchedule(course.id, D.KC_START_DATE)
const classSessions = m.useSessions(course.id).filter((s) => s.kind !== 'assignment')
const missed = classSessions.slice(2, 4)
for (const s of missed) m.setAttendance(course.id, student.id, s.id, 'absent')

const owedBefore = m.useStudentHours(course.id)[0]
check(
  owedBefore.makeUpOwed.length === missed.length && owedBefore.makeUpsDone.length === 0,
  'a missed session owes a make-up until one is recorded',
  `${owedBefore.makeUpOwed.length} owed, ${owedBefore.makeUpsDone.length} done`,
)

check(
  m.recordMakeUp(student.id, missed[0].id, { date: '2026-10-20', what: '   ', by: 'J Jones' }).ok === false,
  'a make-up with no description is refused',
  '"made up" is not a description of equivalent competency',
)
check(
  m.recordMakeUp(student.id, classSessions[0].id, { date: '2026-10-20', what: 'Module and lab', by: 'J Jones' }).ok === false,
  'a make-up against a session with no absence is refused',
)

m.recordMakeUp(student.id, missed[0].id, {
  date: '2026-10-20',
  what: 'Completed the module and demonstrated glucometry to the lab checklist.',
  by: D.PRIMARY_INSTRUCTOR.name,
})
const after = m.useStudentHours(course.id)[0]
check(
  after.makeUpOwed.length === missed.length - 1 && after.makeUpsDone.length === 1,
  'recording one make-up closes that session and only that session',
  `${after.makeUpOwed.length} owed, ${after.makeUpsDone.length} done`,
)
// The whole point: the make-up is evidence of competency, not an eraser.
check(
  after.missed.length === missed.length &&
    after.missedHours === owedBefore.missedHours &&
    after.classAbsentHours === owedBefore.classAbsentHours,
  'a make-up does not restore the missed hours or erase the absence',
  `${after.missed.length} absences, ${after.missedHours} h still missed`,
)

m.setAttendance(course.id, student.id, missed[0].id, 'present')
const corrected = m
  .useAemtAttendance(course.id)
  .find((a) => a.studentId === student.id && a.sessionId === missed[0].id)
check(
  !!corrected?.makeUp,
  'correcting an attendance mark does not silently delete the make-up record',
  'it is retained for three years under K.A.R. 109-17-3',
)

console.log(`
  ${R.REQUIRED_RECORDS.length} required records — ${R.HELD_RECORDS.length} held in CES, ${R.GENERATED_RECORDS.length} generated here, ${R.EXTERNAL_RECORDS.length} genuinely elsewhere
  ${F.AEMT_FORMS.length} instruments, each claimed by exactly one record · ${F.AEMT_FORMS.filter((f) => f.draft).length} still marked draft
  ${D.COURSE_STAFF.length} instructors of record on the joint cohort`)

console.log(
  failed === 0
    ? '\ncheck-records: the registry says where each record is, and the counts count the right things.'
    : `\n${failed} check(s) failed.`,
)
process.exit(failed === 0 ? 0 : 1)
