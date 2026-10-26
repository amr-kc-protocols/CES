// Behaviour check for the Ambulance Documentation & Review Academy.
//
// The build brief's acceptance criteria are mostly arithmetic and references,
// which is exactly what drifts when someone edits a lesson in a hurry:
//
//   - the agenda totals 480 instructional minutes (360 core + 120 leadership),
//     and the four 2-hour sessions account for every minute of every lesson
//   - Form A matches the blueprint: 30 items, ≥ 20 scenario-based, per-domain
//     counts as written
//   - every lesson, scored question and case issue resolves to real source ids
//   - no scored item rests on a local policy nobody has supplied — that is how
//     a pending branch would issue a definitive answer
//   - the pass rules: 80% knowledge; 85% practical with N/A removed from the
//     denominator, 14/16 passing and 13/16 not, and any unresolved critical
//     error failing regardless of score
//   - completion needs both knowledge and practical, plus the leadership
//     practicum and two human sign-offs for every track except field provider
//
// Run: node scripts/check-doc-academy.mjs  (or `npm run check:docacademy`)
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// The store and the sync mapping persist through localStorage.
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

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')
const OUT = join(tmpdir(), `ces-docacademy-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `
      export * from ${JSON.stringify(join(SRC, 'data/docAcademy/lessons'))}
      export * from ${JSON.stringify(join(SRC, 'data/docAcademy/questions'))}
      export * from ${JSON.stringify(join(SRC, 'data/docAcademy/cases'))}
      export * from ${JSON.stringify(join(SRC, 'data/docAcademy/sources'))}
      export * from ${JSON.stringify(join(SRC, 'modules/docacademy/scoring'))}
      export * as store from ${JSON.stringify(join(SRC, 'modules/docacademy/academyStore'))}
      export { getState } from ${JSON.stringify(join(SRC, 'lib/store'))}
      export { toRecords, applyRemote } from ${JSON.stringify(join(SRC, 'lib/records'))}
    `,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
})
const m = await import(pathToFileURL(OUT).href)
rmSync(OUT, { force: true })

let checks = 0
const fails = []
const ok = (cond, msg) => {
  checks++
  if (!cond) fails.push(msg)
}

const { LESSONS, SESSIONS, CORE_IDS, LEADERSHIP_IDS, RUBRIC, lessonsFor } = m
const { EXAM_FORM_A, BASELINE, EXAM_BLUEPRINT } = m
const { CASES, PRIORITY_CASE_IDS, SOURCES, SOURCE_BY_ID } = m
const sum = (xs) => xs.reduce((a, b) => a + b, 0)

// --- Agenda ----------------------------------------------------------------
const core = LESSONS.filter((l) => CORE_IDS.includes(l.id))
const lead = LESSONS.filter((l) => LEADERSHIP_IDS.includes(l.id))
ok(sum(core.map((l) => l.minutes)) === 360, `common core is ${sum(core.map((l) => l.minutes))} min, not 360`)
ok(sum(lead.map((l) => l.minutes)) === 120, `leadership is ${sum(lead.map((l) => l.minutes))} min, not 120`)
ok(sum(LESSONS.map((l) => l.minutes)) === 480, 'agenda does not total 480 instructional minutes')
ok(sum(lessonsFor('learner').map((l) => l.minutes)) === 360, 'field-provider track is not the 360-minute core')
for (const t of ['fto', 'manager', 'educator']) {
  ok(sum(lessonsFor(t).map((l) => l.minutes)) === 480, `${t} track is not 480 minutes`)
}
for (const l of core) ok(l.tracks.length === 4, `${l.id} is core but not assigned to every track`)
for (const l of lead) ok(!l.tracks.includes('learner'), `${l.id} is leadership but assigned to field providers`)

for (const s of SESSIONS) {
  ok(sum(s.slices.map((x) => x.minutes)) === 120, `${s.id} is ${sum(s.slices.map((x) => x.minutes))} min, not 120`)
}
for (const l of LESSONS) {
  const scheduled = sum(SESSIONS.flatMap((s) => s.slices).filter((x) => x.lessonId === l.id).map((x) => x.minutes))
  ok(scheduled === l.minutes, `${l.id} has ${l.minutes} min but sessions schedule ${scheduled}`)
}
ok(new Set(LESSONS.map((l) => l.id)).size === LESSONS.length, 'duplicate lesson id')

// --- Exam blueprint --------------------------------------------------------
ok(EXAM_FORM_A.length === 30, `Form A has ${EXAM_FORM_A.length} items, not 30`)
ok(EXAM_FORM_A.filter((q) => q.scenarioFacts.length > 0).length >= 20, 'Form A has fewer than 20 scenario-based items')
for (const [d, n] of Object.entries(EXAM_BLUEPRINT)) {
  const got = EXAM_FORM_A.filter((q) => q.domain === d).length
  ok(got === n, `domain ${d} has ${got} items; blueprint says ${n}`)
}
ok(sum(Object.values(EXAM_BLUEPRINT)) === 30, 'blueprint does not total 30')
ok(BASELINE.length === 10, 'baseline is not ten questions')

const allQ = [...EXAM_FORM_A, ...BASELINE]
ok(new Set(allQ.map((q) => q.id)).size === allQ.length, 'duplicate question id')
for (const q of allQ) {
  const ids = q.choices.map((c) => c.id)
  ok(q.correctChoiceIds.length > 0, `${q.id} has no correct answer`)
  ok(q.correctChoiceIds.every((c) => ids.includes(c)), `${q.id} keys a choice that does not exist`)
  ok(ids.every((c) => q.rationaleByChoice[c]?.trim()), `${q.id} is missing a rationale for a choice`)
  ok(q.sourceIds.length > 0, `${q.id} cites no source`)
  ok(LESSONS.some((l) => l.id === q.lessonId), `${q.id} points at unknown lesson ${q.lessonId}`)
}

// Where the right answer lands on screen. Four-choice items only; no position
// may carry more than 40% of the key, and every position must be used.
for (const q of EXAM_FORM_A) ok(m.displayOrders(EXAM_FORM_A)[q.id].map((c) => c.id).sort().join() === q.choices.map((c) => c.id).sort().join(), `${q.id} loses or duplicates a choice when shuffled`)
const four = EXAM_FORM_A.filter((q) => q.choices.length === 4)
const at = [0, 0, 0, 0]
const shown = m.displayOrders(EXAM_FORM_A)
for (const q of four) at[shown[q.id].findIndex((c) => q.correctChoiceIds.includes(c.id))]++
ok(at.every((n) => n > 0 && n <= Math.ceil(four.length * 0.4)), `correct answers sit at screen positions ${at.join('/')}; mix them`)

// --- References ------------------------------------------------------------
const known = (id) => id in SOURCE_BY_ID
ok(new Set(SOURCES.map((s) => s.id)).size === SOURCES.length, 'duplicate source id')
for (const s of SOURCES) {
  ok(s.owner?.trim() && s.nextReviewOn, `${s.id} has no owner or next review date`)
  ok(s.nextReviewOn >= s.checkedOn, `${s.id} is due for review before it was checked`)
  if (s.authority !== 'local_policy') ok(!!s.url, `${s.id} is a public source with no link`)
}
for (const l of LESSONS) {
  for (const id of [...l.sourceIds, ...l.sections.flatMap((s) => s.sourceIds)]) ok(known(id), `${l.id} cites unknown source ${id}`)
  for (const id of l.caseIds) ok(CASES.some((c) => c.id === id), `${l.id} uses unknown case ${id}`)
  for (const id of l.questionIds) ok(allQ.some((q) => q.id === id), `${l.id} lists unknown question ${id}`)
  for (const id of l.prerequisites) ok(LESSONS.some((x) => x.id === id), `${l.id} has unknown prerequisite ${id}`)
  ok(l.approval !== 'published' || l.sourceIds.every((id) => SOURCE_BY_ID[id].verification === 'reviewed'),
    `${l.id} is published while citing an unreviewed source`)
}
for (const q of allQ) for (const id of q.sourceIds) ok(known(id), `${q.id} cites unknown source ${id}`)

// No pending local branch may issue a definitive answer: a scored item may not
// rest on local policy that has not been supplied.
for (const q of EXAM_FORM_A) {
  for (const id of q.sourceIds) {
    ok(SOURCE_BY_ID[id]?.verification !== 'local_pending', `${q.id} is scored but rests on pending local policy ${id}`)
  }
}

// --- Cases -----------------------------------------------------------------
ok(CASES.length === 16, `case bank has ${CASES.length} cases, not 16`)
for (const id of PRIORITY_CASE_IDS) {
  const c = CASES.find((x) => x.id === id)
  ok(c?.authored, `priority case ${id} is not authored`)
  if (!c) continue
  ok(c.narrative && c.expectedIssues.length > 0 && c.distractors.length > 0 && c.reviewerRubric.length > 0,
    `priority case ${id} is missing its vignette, issues, distractors or reviewer key`)
}
for (const c of CASES) {
  for (const i of [...c.expectedIssues, ...c.distractors]) {
    for (const id of i.sourceIds) ok(known(id), `${c.id}/${i.id} cites unknown source ${id}`)
  }
  for (const id of c.pendingSourceIds ?? []) ok(SOURCE_BY_ID[id]?.verification === 'local_pending', `${c.id} pends on ${id}, which is not pending`)
  const ids = [...c.expectedIssues, ...c.distractors].map((i) => i.id)
  ok(new Set(ids).size === ids.length, `${c.id} reuses an issue id`)
  for (const lid of c.lessonIds) ok(LESSONS.some((l) => l.id === lid), `${c.id} points at unknown lesson ${lid}`)
}
// The hospice/PCS branch must be able to end in "clarification needed".
const k02 = m.scoreCaseLab(CASES.find((c) => c.id === 'K02'), [])
ok(k02.clarificationNeeded, 'K02 (hospice) cannot end in billing/compliance clarification')
const k12 = m.scoreCaseLab(CASES.find((c) => c.id === 'K12'), ['overwrite', 'amendment'])
ok(k12.found.includes('amendment') && k12.wrongPicks.includes('overwrite') && k12.missedIssues.includes('time_conflict'),
  'case lab does not separate found, missed and unsupported picks')

// --- Pass rules ------------------------------------------------------------
const key = Object.fromEntries(EXAM_FORM_A.map((q) => [q.id, q.correctChoiceIds]))
const wrongOn = (n) => {
  const a = { ...key }
  for (const q of EXAM_FORM_A.slice(0, n)) a[q.id] = [q.choices.find((c) => !q.correctChoiceIds.includes(c.id)).id]
  return a
}
ok(m.scoreExam(EXAM_FORM_A, key).pct === 100, 'a perfect paper does not score 100%')
ok(m.scoreExam(EXAM_FORM_A, wrongOn(6)).passed, '24/30 (80%) does not pass')
ok(!m.scoreExam(EXAM_FORM_A, wrongOn(7)).passed, '23/30 passes')
ok(!m.scoreExam(EXAM_FORM_A, {}).passed, 'a blank paper passes')
ok(m.scoreExam(EXAM_FORM_A, wrongOn(1)).missedCritical.length === (EXAM_FORM_A[0].criticalConcept ? 1 : 0),
  'a missed critical concept is not reported')

ok(RUBRIC.length === 8, 'practical rubric does not have eight domains')
const ids = RUBRIC.map((d) => d.id)
const scores = (vals) => Object.fromEntries(ids.map((id, i) => [id, vals[i]]))
const P = (vals, extra = {}) => m.scorePractical({ scores: scores(vals), naJustification: {}, criticalErrors: [], ...extra })
ok(P([2, 2, 2, 2, 2, 2, 1, 1]).passed, '14/16 does not pass the practical')
ok(!P([2, 2, 2, 2, 2, 1, 1, 1]).passed, '13/16 passes the practical')
ok(!P([2, 2, 2, 2, 2, 2, 2, 2], { criticalErrors: [{ id: 'fabrication', resolved: false }] }).passed,
  'an unresolved critical error does not fail a perfect practical')
ok(P([2, 2, 2, 2, 2, 2, 2, 2], { criticalErrors: [{ id: 'fabrication', resolved: true }] }).passed,
  'a resolved critical error still fails the practical')
ok(!P([2, 2, 2, 2, 2, 2, 2, 'na']).passed, 'N/A without a justification passes')
const na = P([2, 2, 2, 2, 2, 2, 1, 'na'], { naJustification: { [ids[7]]: 'No coaching component in this case' } })
ok(na.passed && na.maxPoints === 14, 'N/A is not removed from the denominator')
ok(!m.scorePractical({ scores: {}, naJustification: {}, criticalErrors: [] }).passed, 'an unscored practical passes')

// --- Completion ------------------------------------------------------------
const base = { examPassed: true, practicalPassed: true, lessonsDone: [] }
ok(m.completionGaps({ ...base, track: 'learner' }).length === 0, 'a field provider with both passes is not complete')
ok(m.completionGaps({ ...base, track: 'learner', practicalPassed: false }).length === 1, 'knowledge alone completes the course')
ok(m.completionGaps({ ...base, track: 'learner', examPassed: false }).length === 1, 'practical alone completes the course')
ok(m.completionGaps({ ...base, track: 'fto' }).length === 3, 'an FTO completes without the leadership practicum and sign-offs')
ok(m.completionGaps({ ...base, track: 'manager', lessonsDone: LEADERSHIP_IDS, coachingApprovedBy: 'A', auditPlanApprovedBy: 'B' }).length === 0,
  'a manager with everything is not complete')

// --- Records on the shared store ------------------------------------------
// Signed out, this is an instructor install: a learner carries no userId.
const { store, getState, toRecords, applyRemote } = m
const lid = store.addLearner('  Test Medic ', 'fto')
const learner = getState().docLearners.find((l) => l.id === lid)
ok(learner && learner.name === 'Test Medic' && learner.userId === undefined, 'a signed-out learner is not stored as created')
store.recordAttempt(lid, { id: 'att1', form: 'A', answers: {}, correct: 24, total: 30, pct: 80, passed: true })
store.recordAttempt(lid, { id: 'att1', form: 'A', answers: {}, correct: 0, total: 30, pct: 0, passed: false })
const atts = getState().docAttempts.filter((a) => a.learnerId === lid)
ok(atts.length === 1 && atts[0].pct === 80, 'a replayed attempt id duplicates or overwrites the attempt')
store.savePractical(lid, { caseId: 'K12', reviewer: 'R', scores: {}, naJustification: {}, criticalErrors: [], feedback: '' })
store.setSignoff(lid, 'coachingApproved', 'R')
const reviews = getState().docReviews.filter((r) => r.learnerId === lid)
ok(reviews.length === 1 && reviews[0].practical && reviews[0].coachingApproved, 'practical and sign-off do not land on one review row')

// A learner who enrolled signed in keeps their userId on every row derived
// from them — it is what the server's read policy keys on.
const owned = { ...learner, id: 'dl_owned', userId: 'user-1' }
const withOwned = { ...getState(), docLearners: [...getState().docLearners, owned] }
const recs = [...toRecords(withOwned).values()]
for (const c of ['docLearners', 'docAttempts', 'docReviews']) {
  ok(recs.some((r) => r.collection === c), `${c} does not sync — it is missing from lib/records.ts`)
}
const back = applyRemote({ ...getState(), docLearners: [] }, recs.filter((r) => r.collection === 'docLearners'))
ok(back.docLearners.some((l) => l.id === 'dl_owned' && l.userId === 'user-1'), 'a learner row does not survive the sync round trip with its userId')

store.removeLearner(lid)
ok(!getState().docAttempts.some((a) => a.learnerId === lid) && !getState().docReviews.some((r) => r.learnerId === lid),
  "removing a learner leaves their attempts or review behind")

// ---------------------------------------------------------------------------
if (fails.length) {
  console.error(`check-doc-academy: ${fails.length} of ${checks} checks FAILED\n`)
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`check-doc-academy: ${checks} checks passed`)
console.log(`  ${LESSONS.length} lessons · ${EXAM_FORM_A.length}+${BASELINE.length} questions · ${CASES.length} cases (${CASES.filter((c) => c.authored).length} authored) · ${SOURCES.length} sources`)
