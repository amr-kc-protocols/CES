// Behaviour check for the PHI validator.
//
// The course application dismisses a student who captures protected health
// information on an electronic device, so the free-text fields in this app
// refuse the save rather than warning about it. Two failures matter here and
// they pull in opposite directions:
//
//   - a miss puts a patient's name on an iPad, which is the dismissal
//   - a false positive blocks a student from logging a shift at 0300, which
//     teaches them the box is broken and to write nothing at all
//
// So the clinical shorthand this app exists to collect has to pass, and the
// shapes an identifier actually takes have to fail. Both directions are
// checked below, and the offsets are checked too — the field highlights the
// substring, so an offset that is off by one underlines the wrong words.
//
// Run: node scripts/check-phi.mjs  (or `npm run check:phi`)
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')
const OUT = join(tmpdir(), `ces-phi-${process.pid}.mjs`)

await build({
  entryPoints: [join(SRC, 'lib/phi.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
})
const { checkPhi, phiMessage, PHI_PROMPT } = await import(pathToFileURL(OUT).href)
rmSync(OUT, { force: true })

let checks = 0
const fails = []
const ok = (cond, msg) => {
  checks++
  if (!cond) fails.push(msg)
}

// ---------------------------------------------------------------------------
// What a student is supposed to write. All of it has to save.

const CLEAN = [
  'Started an 18g IV in the left AC on the second attempt.',
  '45 y/o male, chest pain. Assisted with the 12 lead.',
  'Drew a rainbow off the initial stick. Got better at anchoring the vein.',
  'Neb treatment with albuterol, RN supervised. First time driving the setup myself.',
  'Third IO of the rotation. Landmarks were easier this time than in lab.',
  'Assessment on a COPD exacerbation. Missed the accessory muscle use until my preceptor pointed at it.',
  'Wrote the PCR myself and my preceptor only changed two lines.',
  'Two ambulance calls, both BLS. Practiced the handoff report at the ED.',
  'IM injection, deltoid, 1 mL. Aspirated out of habit and got corrected.',
  '82 y/o female, hypoglycemic. D10 through the IV I placed.',
  'Shift was slow. Restocked the ALS bag and reviewed the drug box with my preceptor.',
  'Sats came up from 88% to 96% on 15 L NRB.',
  'BP 148/92, HR 110, SpO2 94%. Repeat set was better.',
  'Placed the 4 lead then the 12 lead, ST elevation in II III aVF.',
]
for (const text of CLEAN) {
  const r = checkPhi(text)
  ok(r.ok, `clinical shorthand should save: "${text}" — flagged ${JSON.stringify(r.hits)}`)
}

ok(checkPhi('').ok, 'an empty field is not a violation')
ok(checkPhi('   \n  ').ok, 'whitespace is not a violation')
ok(checkPhi(undefined).ok, 'an absent field is not a violation')

// ---------------------------------------------------------------------------
// What has to be refused.

const DIRTY = [
  ['Run 1234567, chest pain.', 'a run number'],
  ['MRN 0084412 in the ED chart.', 'a medical record number'],
  ['Called the family at 9135551212.', 'a phone number'],
  ['SSN 123-45-6789 on the face sheet.', 'a social security number'],
  ['DOB 03/14/1985.', 'a date of birth'],
  ['dob 3/4/85 per the wristband.', 'a short date of birth'],
  ['Pt: Halloran, chest pain.', 'a named patient'],
  ['Pt. Halloran was hypotensive.', 'a named patient after an abbreviation'],
  ['Patient name on the band did not match.', 'the phrase patient name'],
  ['Mr. Halloran refused transport.', 'a title and a surname'],
  ['Mrs Delacroix was in afib.', 'a title without the period'],
  ['Dr. Okafor took report.', 'a physician by name'],
  ['Picked up at 1420 Maple Street.', 'a street address'],
  ['Scene was 88 South Rockwell Ave.', 'another street address'],
  ['62 y/o Halloran, chest pain.', 'an age beside a name'],
]
for (const [text, what] of DIRTY) {
  const r = checkPhi(text)
  ok(!r.ok, `${what} must block the save: "${text}"`)
  ok(r.hits.length > 0, `${what} reports at least one hit`)
}

// ---------------------------------------------------------------------------
// Acceptance criterion: an 8-digit number blocks the save and the caller can
// highlight the exact substring that caused it.

{
  const text = 'Good shift. Ran call 20260415 with my preceptor.'
  const r = checkPhi(text)
  ok(!r.ok, 'an 8-digit number blocks the save')
  ok(r.hits.length === 1, `one hit, got ${r.hits.length}`)
  const h = r.hits[0]
  ok(h.text === '20260415', `the hit is the number itself, got "${h.text}"`)
  ok(
    text.slice(h.start, h.end) === '20260415',
    `the offsets select the number: got "${text.slice(h.start, h.end)}"`,
  )
  ok(/MRN|run number|phone/.test(h.why), `the reason names what it looks like: "${h.why}"`)
}

// Offsets have to survive whatever whitespace the sentence walker steps over,
// because the age rule is the one that reports positions from a running count.
{
  const text = 'Long shift.   72 y/o Halloran in the ED.  Learned a lot.'
  const r = checkPhi(text)
  ok(!r.ok, 'a name two sentences in is still caught')
  for (const h of r.hits) {
    ok(
      text.slice(h.start, h.end) === h.text,
      `offsets stay exact across padded sentence breaks: "${text.slice(h.start, h.end)}" vs "${h.text}"`,
    )
  }
}

// Every hit anywhere must satisfy the same contract, or the highlight lies.
for (const [text] of DIRTY) {
  const r = checkPhi(text)
  ok(
    r.hits.every((h) => text.slice(h.start, h.end) === h.text),
    `offsets address the reported text in "${text}"`,
  )
}

// ---------------------------------------------------------------------------
// Somebody who typed two identifiers is told about both, and told first about
// the one nearest the top of the box.

{
  const text = 'Mr. Halloran, run 1234567, DOB 03/14/1985.'
  const r = checkPhi(text)
  ok(r.hits.length >= 3, `three identifiers reported, got ${r.hits.length}`)
  ok(
    r.hits.every((h, i) => i === 0 || h.start >= r.hits[i - 1].start),
    'hits come back in reading order',
  )
  ok(r.hits[0].text.startsWith('Mr'), `the first hit is the first offence, got "${r.hits[0].text}"`)
}

{
  // The same span caught by two rules is one problem, not two.
  const r = checkPhi('SSN 123-45-6789.')
  const spans = new Set(r.hits.map((h) => `${h.start}:${h.end}`))
  ok(spans.size === r.hits.length, 'overlapping rules do not report the same span twice')
}

// ---------------------------------------------------------------------------
// The message under the field.

{
  ok(phiMessage(checkPhi('nothing wrong here')) === '', 'a clean field gets no message')
  const m = phiMessage(checkPhi('Run 1234567.'))
  ok(m.includes(PHI_PROMPT), 'the rejection says what to write instead')
  ok(!m.includes('1234567'), 'the message never repeats the offending text back')
  const two = phiMessage(checkPhi('Mr. Halloran, run 1234567.'))
  ok(/and 1 more/.test(two), `a second hit is counted: "${two}"`)
}

if (fails.length) {
  console.error(`check-phi: ${fails.length} of ${checks} checks failed\n`)
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log(`check-phi: ${checks} checks passed`)
