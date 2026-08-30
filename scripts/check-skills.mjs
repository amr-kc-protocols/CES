// Coverage check between the course schedule and the psychomotor skill sheets.
//
// These are two lists that drift apart silently, and each direction of drift is
// its own failure:
//
//   A sheet the course carries but never teaches is a check-off nobody can
//   ever do. It sits in the Skills tab looking like work outstanding, for
//   sixteen weeks, and the student is marked incomplete on a competency the
//   schedule never gave them a lab for.
//
//   A lab that teaches something with no sheet is a competency with no
//   evidence behind it. That is the worse direction: the week 3 lab granted
//   the assessment clearance that opens Phase 1 of the rotation with no
//   instrument to grant it against, so the clearance was a date somebody typed
//   rather than a record of anyone watching.
//
// So every 'advanced' sheet has to be named by a session, and every session
// that teaches a skill has to either name its sheet or say in `taughtNotChecked`
// why it does not have one. Almost all of those are BLS carry-forward: an
// incoming AEMT student holds a current EMT certification and uses the skill on
// every shift, and re-checking it is not what this course is for. That is a
// decision, and writing it down is what stops it reading as an oversight.
//
// Run: node scripts/check-skills.mjs  (or `npm run check:skills`)
import { rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src')
const OUT = join(tmpdir(), `ces-skills-check-${process.pid}.mjs`)

await build({
  stdin: {
    contents:
      `export * from ${JSON.stringify(join(SRC, 'data/aemt'))}\n` +
      `export * as S from ${JSON.stringify(join(SRC, 'data/aemtSkills'))}\n` +
      `export * as P from ${JSON.stringify(join(SRC, 'data/aemtPhases'))}\n`,
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
const { S, P } = m

let failed = 0
const check = (ok, label, detail) => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok && detail) console.log(`        ${detail}`)
}

// `@monitor` stands for whichever cardiac monitor the operation runs — AMR KC
// the LIFEPAK 15, Wichita the Zoll X-Series. The schedule cannot name one,
// because the joint cohort runs both and a student is checked off on their own.
const MONITOR = '@monitor'
const namedIds = new Set(m.KC_SCHEDULE.flatMap((r) => r.sheetIds ?? []))
const sheetIds = new Set(S.AEMT_SKILL_SHEETS.map((s) => s.id))

// ----- every named sheet exists ---------------------------------------------

const unknown = [...namedIds].filter((id) => id !== MONITOR && !sheetIds.has(id))
check(
  unknown.length === 0,
  'every sheet the schedule names exists in the workbook',
  unknown.join(', '),
)

check(
  namedIds.has(MONITOR),
  `the schedule uses ${MONITOR} rather than naming one monitor — the joint cohort runs two`,
)
check(
  S.MONITOR_SHEETS.length === 2 &&
    S.MONITOR_SHEETS.every((s) => S.SKILL_SCOPE[s.id] === 'advanced'),
  'both monitors are on file and both are advanced-scope',
  S.MONITOR_SHEETS.map((s) => `${s.id}=${S.SKILL_SCOPE[s.id]}`).join(', '),
)

// ----- every advanced sheet is taught ---------------------------------------

const advanced = S.sheetsByScope('advanced')
const untaught = advanced.filter(
  (s) => !namedIds.has(s.id) && !(s.equipmentGroup === 'monitor' && namedIds.has(MONITOR)),
)
check(
  untaught.length === 0,
  'every advanced sheet is checked off in a session the schedule actually holds',
  untaught.map((s) => `${s.id} (${s.title})`).join('; '),
)

// ----- every lab accounts for what it teaches -------------------------------
//
// A lab session with neither a sheet nor a stated carry-forward is the gap this
// check exists to catch. Scenario and tabletop sessions legitimately have
// neither, so they are named rather than pattern-matched — a session that
// stops being a scenario should have to come back here and say so.
const NO_CHECKOFF_LABS = new Set([
  'Week 9 · Thu', // medical scenarios interleaved with earlier material
  'Week 10 · Thu', // medical scenarios; epi and naloxone are the IM/SubQ sheet
  'Week 12 · Thu', // paediatric assessment and item analysis
  'Week 15 · Thu', // MCI tabletop and soft-skill simulation debrief
  'Week 16 · Thu', // item analysis and the NREMT walkthrough
])
const labs = m.KC_SCHEDULE.filter((r) => r.labHours > 0)
const unaccounted = labs.filter(
  (r) =>
    !NO_CHECKOFF_LABS.has(r.label) &&
    (r.sheetIds ?? []).length === 0 &&
    (r.taughtNotChecked ?? []).length === 0,
)
check(
  unaccounted.length === 0,
  'every lab either names its check-off sheets or says why it has none',
  unaccounted.map((r) => `${r.label} — ${r.short}`).join('; '),
)

// A lab in the exempt list that has since grown sheets means the list is stale.
const staleExempt = labs.filter(
  (r) => NO_CHECKOFF_LABS.has(r.label) && (r.sheetIds ?? []).length > 0,
)
check(
  staleExempt.length === 0,
  'no session is both exempt from check-offs and carrying them',
  staleExempt.map((r) => r.label).join('; '),
)

// ----- the clearances the schedule grants ------------------------------------
//
// Each skill clearance is granted at a lab, and each gates counted requirements.
// A clearance granted where nothing is checked off is a date with no evidence
// under it — which is exactly what the assessment clearance was.
const CLEARANCE_LAB = {
  assessment: 'Week 3 · Thu',
  vascular: 'Week 5 · Thu',
  ecg: 'Week 6 · Thu',
}
for (const c of P.SKILL_CLEARANCES) {
  const label = CLEARANCE_LAB[c.code]
  const row = m.KC_SCHEDULE.find((r) => r.label === label)
  check(
    !!row && (row.sheetIds ?? []).length > 0,
    `the ${c.code} clearance is granted at a lab that checks something off (${label})`,
    row ? `${row.short} names no sheets` : `no row labelled ${label}`,
  )
}

// The requirements each clearance gates must be requirements that exist.
const reqIds = new Set(m.CLINICAL_REQUIREMENTS.map((r) => r.id))
const badGates = P.SKILL_CLEARANCES.flatMap((c) => c.gates).filter((g) => !reqIds.has(g))
check(badGates.length === 0, 'every gated requirement exists', badGates.join(', '))

// ----- the counted requirements have somewhere to be learned -----------------
//
// Every K.A.R. minimum is a skill a student performs on a patient. Each one
// should have a sheet they were checked off on first, or the first live
// attempt is the first time anyone watched them.
const REQUIREMENT_SHEET = {
  venipuncture: 'iv-start',
  io: 'ez-io',
  injection: 'im-subq-injection',
  nebulizer: 'nebulized-treatment',
  ecg: 'ekg-acquisition',
  assessment: 'patient-assessment',
  // Supervised ambulance calls and PCRs are not psychomotor skills — a call is
  // a shift and a PCR is a document. Named here so their absence is a decision.
  calls: null,
  pcr: null,
}
const missingReq = m.CLINICAL_REQUIREMENTS.filter((r) => !(r.id in REQUIREMENT_SHEET))
check(
  missingReq.length === 0,
  'every counted requirement is accounted for against a sheet, or explicitly has none',
  missingReq.map((r) => r.id).join(', '),
)
for (const [reqId, sheetId] of Object.entries(REQUIREMENT_SHEET)) {
  if (!sheetId) continue
  check(
    sheetIds.has(sheetId) && namedIds.has(sheetId),
    `${reqId} has a check-off sheet, taught before the first live rep (${sheetId})`,
  )
}

// The nebulized treatment is the one counted item that is NOT a K.A.R. AEMT
// minimum — it belongs to the EMT list at (a)(3)(B). Pinned because the sheet
// existing makes it easy to assume otherwise.
check(
  m.CLINICAL_REQUIREMENTS.find((r) => r.id === 'nebulizer').basis === 'program',
  'the nebulized treatment is tracked as a program competency, not a K.A.R. AEMT minimum',
)

// ----- draft sheets are declared --------------------------------------------

const drafts = S.AEMT_SKILL_SHEETS.filter((s) => s.draft)
const empty = S.AEMT_SKILL_SHEETS.filter((s) => S.criterionCount(s) === 0)
check(empty.length === 0, 'every sheet has criteria', empty.map((s) => s.id).join(', '))

// Critical failures apply to a PROCEDURE PERFORMED ON A PATIENT, where one act
// fails the whole skill regardless of what else went right. They do not apply
// to a device-familiarisation sheet: there is no way to fail locating the
// ETCO2 waveform that endangers anybody. The source workbook takes the same
// view — only the IV and LUCAS sheets carry one — so the rule here is scoped to
// the patient-facing sheets authored for this course rather than applied
// blanket to every draft.
const PROCEDURE_SHEETS = [
  'im-subq-injection',
  'nebulized-treatment',
  'patient-assessment',
  'childbirth-neonatal',
]
const noCritical = PROCEDURE_SHEETS.map((id) => S.skillSheet(id)).filter(
  (s) => !s || s.criticalFailures.length === 0,
)
check(
  noCritical.length === 0,
  'every authored patient-procedure sheet carries critical failures',
  noCritical.map((s) => s?.id ?? 'missing').join(', '),
)
check(
  PROCEDURE_SHEETS.every((id) => S.skillSheet(id)?.draft === true),
  'and every one is marked draft, pending Medical Director review',
)

// Criterion ids are what a check-off is stored against. Two sheets sharing one
// would cross-contaminate two students' records.
const allCriteria = S.AEMT_SKILL_SHEETS.flatMap((s) =>
  s.sections.flatMap((sec) => sec.criteria.map((c) => c.id)),
)
const dupeCriteria = allCriteria.filter((id, i) => allCriteria.indexOf(id) !== i)
check(
  dupeCriteria.length === 0,
  'every criterion id is unique across the whole workbook',
  [...new Set(dupeCriteria)].join(', '),
)

const dupeSheets = S.AEMT_SKILL_SHEETS.map((s) => s.id).filter(
  (id, i, a) => a.indexOf(id) !== i,
)
check(dupeSheets.length === 0, 'every sheet id is unique', dupeSheets.join(', '))

const unscoped = S.AEMT_SKILL_SHEETS.filter((s) => !S.SKILL_SCOPE[s.id])
check(
  unscoped.length === 0,
  'every sheet is scoped bls / advanced / paramedic',
  unscoped.map((s) => s.id).join(', '),
)

// A paramedic-scope sheet named by the schedule would put a student in front of
// a skill outside their credential.
const outOfScope = [...namedIds].filter(
  (id) => id !== MONITOR && S.SKILL_SCOPE[id] === 'paramedic',
)
check(
  outOfScope.length === 0,
  'no session checks a student off on a paramedic-scope skill',
  outOfScope.join(', '),
)

const course = S.sheetsForCourse('lifepak-15')
console.log(`
  ${S.AEMT_SKILL_SHEETS.length} sheets in the workbook · ${advanced.length} advanced · ${S.sheetsByScope('bls').length} BLS carry-forward · ${S.sheetsByScope('paramedic').length} above scope
  ${course.length} checked off in one course (${course.length - 1} common + 1 monitor)
  ${drafts.length} authored here rather than transcribed — these need Medical Director review before use:
${drafts.map((s) => `    ${s.title}`).join('\n')}
  ${labs.length} lab sessions · ${labs.filter((r) => (r.sheetIds ?? []).length).length} carry check-offs · ${labs.filter((r) => (r.taughtNotChecked ?? []).length).length} state a carry-forward`)

console.log(
  failed === 0 ? '\ncheck-skills: schedule and skill sheets agree.' : `\n${failed} check(s) failed.`,
)
process.exit(failed === 0 ? 0 : 1)
