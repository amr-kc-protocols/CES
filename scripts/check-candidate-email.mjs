// Behaviour check for the candidate emails.
//
// These are the only documents in the build that go to somebody who does not
// work here yet, and the only ones nobody proof-reads before sending — the
// generator fills them in and a coordinator presses send. So the failures are
// the quiet kind:
//
//   NAMING ONE MARKET AS THE WHOLE PROGRAM. Every template said "the AMR Kansas
//   City AEMT Program", which was true of a Kansas City course and became a
//   false statement the day the cohort went joint. A Wichita candidate read
//   their own acceptance letter welcoming them to somebody else's program.
//
//   PLACEHOLDERS FOR THINGS THE COURSE RECORD KNOWS. The start date was
//   `[START DATE]` in an email whose job is to say when the course starts,
//   beside a schedule that has said so precisely all along.
//
//   MACHINE FORMATTING REACHING A READER. A due date rendered "2026-09-28", and
//   the clinical minimums lower-cased their own acronyms into "5 io infusions"
//   and put a plural behind a count of one.
//
// Run: node scripts/check-candidate-email.mjs  (or `npm run check:email`)
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')
const OUT = join(tmpdir(), `ces-email-${process.pid}.mjs`)

await build({
  stdin: {
    contents:
      `export * from ${JSON.stringify(join(SRC, 'data/intakeEmail'))}\n` +
      `export * as D from ${JSON.stringify(join(SRC, 'data/aemt'))}\n`,
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
const { D } = m

let failed = 0
const check = (ok, label, detail) => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok && detail) console.log(`        ${String(detail).split('\n').join('\n        ')}`)
}

const candidate = (name, operation) => ({
  id: name,
  data: {
    name,
    operation,
    employeeId: '000000',
    tenure: '3 years',
    status: 'Full-time EMT',
    otherJob: 'No',
    inSchool: 'No',
    conflicts: '—',
    canCommit: 'Yes',
  },
})

const OPERATIONS = [...new Set(D.COURSE_STAFF.map((s) => s.operation))]
check(OPERATIONS.length >= 2, 'the cohort is staffed by more than one operation', OPERATIONS.join(', '))

const rendered = []
for (const t of m.EMAIL_TEMPLATES) {
  for (const op of OPERATIONS) {
    rendered.push({ template: t.id, operation: op, ...m.buildIntakeEmail(candidate('Test Candidate', op), t.id) })
  }
}
check(rendered.length > 0, 'every template renders for a candidate from each operation')

// ----- one program, named as one --------------------------------------------
//
// A single operation's name in the possessive position — "the AMR Wichita AEMT
// Program" — is the error. Naming both, or naming one as the location of a
// classroom, is not.
for (const op of OPERATIONS) {
  const claiming = rendered.filter((r) => r.body.includes(`${op} AEMT Program`) || r.body.includes(`${op} AEMT cohort`))
  check(
    claiming.length === 0,
    `no email calls this "${op}'s" program`,
    claiming.map((r) => `${r.template} -> ${r.operation}`).join(', '),
  )
}
// And the joint name has to actually appear, or the fix above was to delete it.
const named = rendered.filter((r) => OPERATIONS.every((op) => r.body.includes(op)))
check(
  named.length >= OPERATIONS.length,
  'the emails name every operation running the cohort',
  `${named.length} of ${rendered.length} renderings name all of ${OPERATIONS.join(' + ')}`,
)

// A candidate's own market must not change what the program is called.
for (const t of m.EMAIL_TEMPLATES) {
  const forT = rendered.filter((r) => r.template === t.id)
  const bodies = new Set(forT.map((r) => r.body))
  check(
    bodies.size === 1,
    `the ${t.id} email reads the same whichever operation the candidate is from`,
    'a market-dependent difference here is the defect that started this',
  )
}

// ----- nothing machine-formatted reaches a reader ----------------------------

for (const r of rendered) {
  const iso = [...r.body.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map((x) => x[0])
  check(iso.length === 0, `the ${r.template} email prints no raw ISO dates`, iso.join(', '))
}

// Acronyms survive, and a count of one does not sit behind a plural.
const acronyms = ['IO infusions', 'IM / SubQ injections', 'ECG application']
const offer = rendered.find((r) => r.template === 'accepted')
for (const a of acronyms) {
  check(
    offer.body.includes(a),
    `the offer prints "${a}" as written, not lower-cased`,
    'lower-casing the labels turned these into "io infusions" and "ecg application"',
  )
}
const singular = D.CLINICAL_REQUIREMENTS.filter((r) => r.minimum === 1)
for (const r of singular) {
  check(
    !offer.body.includes(`1 ${r.label.toLowerCase()}`) && !offer.body.includes(`1 ${r.label}`),
    `"${r.label}" is not printed as a count of one behind a plural`,
    'the label carries the plural; the count goes after it',
  )
}

// ----- what the course record knows, the email says --------------------------

check(
  offer.body.includes(m.COURSE_INFO.startDate) && !offer.body.includes('[START DATE]'),
  'the offer states the real course start date',
  `COURSE_INFO.startDate is "${m.COURSE_INFO.startDate}"`,
)
check(
  !offer.body.includes('[ORIENTATION'),
  'the offer states when orientation is',
  'it is the first session; the schedule has always known which one that is',
)
// The class days are the fact a candidate checks against their own bid line.
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
for (const d of D.KC_CLASS_PATTERN.days) {
  check(
    offer.body.includes(`${days[d]}s`),
    `the offer names ${days[d]}s as a class day`,
    'every student on this cohort holds a twelve-hour line; the days are what they check against',
  )
}

// ----- placeholders left are decisions, not data -----------------------------
//
// Something still bracketed is fine where it is genuinely a decision nobody has
// made. It is not fine where the course record could have answered it.
const DECISIONS = ['REPLY-BY DATE', 'SUPERVISOR REPLY-BY DATE', 'INTERVIEW WINDOW', 'INTERVIEW LOCATION', 'phone', 'email', 'INSERT SERVICE COMMITMENT TERMS']
const unexplained = [
  ...new Set(rendered.flatMap((r) => r.unfilled)),
].filter((u) => !DECISIONS.some((d) => u.includes(d)))
check(
  unexplained.length === 0,
  'every placeholder left in an email is a decision, not something the course record knows',
  unexplained.join(' '),
)

console.log(`
  ${m.EMAIL_TEMPLATES.length} templates x ${OPERATIONS.length} operations = ${rendered.length} renderings
  program named as: ${m.PROGRAM_NAME}
  course starts ${m.COURSE_INFO.startDate} · orientation ${m.COURSE_INFO.orientation}`)

console.log(
  failed === 0
    ? '\ncheck-candidate-email: every template reads correctly for a candidate from either market.'
    : `\n${failed} check(s) failed.`,
)
process.exit(failed === 0 ? 0 : 1)
