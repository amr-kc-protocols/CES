// Behaviour check for the candidate selection record.
//
// The record has to do two jobs a filed HR document is judged on: report the
// candidate's scoring faithfully, and justify the procedure it came from. These
// checks assert both — that the composite, the interview detail and the
// thresholds are present and correct, that the methodology and fairness rules
// are stated, and that the content fingerprint is a real SHA-256 — and emit a
// rendered sample for the eye.
//
// Run: node scripts/check-selection-record.mjs  (or `npm run check:record`)
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { rmSync, writeFileSync } from 'node:fs'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src')
const OUT = join(tmpdir(), `ces-record-check-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `export { candidateRecordBody, candidateRecordTitle, cohortRecordBody,
      recordFingerprint } from ${JSON.stringify(join(SRC, 'modules/aemt/selectionRecord'))}`,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
  // esc is the only runtime import from docGen; the rest of that file (window,
  // print) is never reached, but the bundler still resolves it — stub the DOM.
  plugins: [
    {
      name: 'stub-dom',
      setup(b) {
        b.onResolve({ filter: /dialog$/ }, (a) => ({ path: a.path, namespace: 'stub' }))
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const notifyUser=()=>{}', loader: 'js' }))
      },
    },
  ],
})
const m = await import(pathToFileURL(OUT).href)
rmSync(OUT, { force: true })
const { candidateRecordBody, cohortRecordBody, recordFingerprint } = m

let checks = 0
const fails = []
const ok = (cond, msg) => {
  checks++
  if (!cond) fails.push(msg)
}

// A realistic, complete candidate: two independent interviewers, an exam score,
// QA and attendance, an FTO bonus, a recorded decision.
const candidate = {
  id: 'cand-1',
  courseId: 'course-1',
  name: 'Alex Rivera',
  employeeNumber: '4821',
  email: 'alex.rivera@example.org',
  gates: { cert: true, tenure: true, discipline: true, attendance: true, availability: true, agreement: true },
  bonusTier: 'fto',
  examPercent: 84,
  qaPercent: 90,
  attendancePercent: 95,
  interviews: [
    {
      scorer: 'J. Jones',
      at: '2026-08-24T15:00:00.000Z',
      scores: { q1: 5, q2: 4, q3: 5, q4: 4, q5: 4, q6: 5 },
      notes: { q1: 'Twenty minutes of flashcards every morning; tracked accuracy weekly.', q3: 'Owned a failed exam and built a schedule.' },
    },
    {
      scorer: 'M. Powell',
      at: '2026-08-24T15:05:00.000Z',
      scores: { q1: 5, q2: 2, q3: 5, q4: 4, q5: 5, q6: 4 }, // q2 differs from Jones by 2
      notes: { q2: 'Prioritised the CE, told the partner early.' },
    },
  ],
  decision: 'advance',
  decidedBy: 'J. Jones',
  decidedAt: '2026-08-24T16:00:00.000Z',
  notes: 'Strong across the board.',
  createdAt: '2026-08-01T00:00:00.000Z',
}
const score = {
  test: 84,
  interview: 83.3,
  qa: 90,
  attendance: 95,
  base: 86.1,
  bonus: 5,
  composite: 91.1,
  complete: true,
  interviewRaw: 25,
  sections: [],
  blockers: [],
  gatesMet: true,
}
const course = { id: 'course-1', label: 'Fall 2026 AEMT', organization: 'AMR Kansas City', startDate: '2026-10-06', endDate: '2027-01-28' }

const meta = { actor: 'j.jones@amr', generatedAt: 'Aug 24 2026, 4:10 PM', fingerprint: 'abc123' }
const body = candidateRecordBody(candidate, score, course, meta)

// --- the candidate's scoring, reported ---
ok(/Candidate Record/.test(body), 'is a candidate record')
ok(body.includes('Alex Rivera') && body.includes('#4821'), 'names the candidate and employee number')
ok(body.includes('91.1') && body.includes('of 105'), 'reports the composite out of 105')
ok(/Threshold 70/.test(body) || body.includes('threshold 70') || body.includes('/ 70'), 'states the composite threshold')
ok(body.includes('ADVANCE'), 'shows the recorded decision')
for (const label of ['Selection test', 'Structured interview', 'QA chart review', 'Attendance record'])
  ok(body.includes(label), `composite lists the ${label} component`)
ok(body.includes('J. Jones') && body.includes('M. Powell'), 'names both interviewers')
ok(body.includes('flashcards every morning'), 'includes what the candidate actually said')
ok(/Interview total/.test(body), 'shows an interview total')
ok(body.includes('of 30') && body.includes('threshold 18'), 'states the interview total and threshold')
ok(/differed by 2 or more on/.test(body) && /Competing demands|Receiving correction|Motivation/.test(body),
  'flags the interviewer disagreement (Q2/Q5/Q6 differ by 2)')
ok(/Scoring anchors/.test(body) && body.includes('Self-directed learning'), 'prints the anchors the 1-5 were judged against')

// --- the procedure, justified ---
ok(/methodology and justification/i.test(body), 'has a methodology and justification section')
ok(/Retention is handled by the service commitment agreement/.test(body), 'states what selection is and is not for')
ok(body.includes('same six questions in the same order'), 'describes the structured method')
ok(/never asked and never scored/.test(body) && body.includes('Arrest record'), 'lists the prohibited topics as not scored')
ok(/left empty before the bar is lowered/.test(body), 'states the leave-the-seat-empty principle')
ok(/EEOC Uniform Guidelines/.test(body), 'names the governing guidance')
ok(/Records and retention/.test(body) && /HR retention schedule/.test(body) && /109-17-3/.test(body),
  'states retention: HR schedule, not the K.A.R. program clock')
ok(/Content fingerprint/.test(body) && body.includes('abc123'), 'carries the content fingerprint')
ok(/Interviewer \/ Program Manager:/.test(body), 'has a signature block')

// A candidate with no interview still produces a record that says so.
const noIv = candidateRecordBody({ ...candidate, interviews: [] }, { ...score, interviewRaw: undefined }, course, meta)
ok(/No interview recorded/.test(noIv), 'an un-interviewed candidate yields a record that says so, not a blank')

// --- the fingerprint is real ---
const fp = await recordFingerprint(candidate, score)
ok(typeof fp === 'string' && /^[0-9a-f]{64}$/.test(fp), `recordFingerprint is a SHA-256 (${(fp || '').slice(0, 12)}…)`)
const fp2 = await recordFingerprint(candidate, score)
ok(fp === fp2, 'the fingerprint is stable for the same facts')
const fp3 = await recordFingerprint({ ...candidate, examPercent: 62 }, score)
ok(fp !== fp3, 'and changes when a scoring fact changes')

// --- the cohort summary ---
const cohort = cohortRecordBody(
  course,
  [
    { candidate, score },
    { candidate: { ...candidate, id: 'c2', name: 'Sam Okafor', examPercent: 61 }, score: { ...score, composite: 64, complete: true, blockers: ['Composite at 64.0, below 70'] } },
  ],
  { actor: 'j.jones@amr', generatedAt: 'Aug 24 2026' },
)
ok(/Process Summary/.test(cohort), 'the cohort doc is a process summary')
ok(cohort.includes('Alex Rivera') && cohort.includes('Sam Okafor'), 'lists the whole field')
ok(/Clears/.test(cohort) && /Below/.test(cohort), 'marks who clears and who is below the bar')
ok(/methodology and justification/i.test(cohort), 'and carries the same methodology')

// ----- hardening: free text reaches this document, so it must be escaped -----
// Candidate names, interviewer names and "what they said" are typed by people.
// An unescaped '<' would break the document; a pasted tag would be worse.
{
  const hostile = '<script>alert(1)</script> & "quoted" <b>bold</b>'
  const nasty = {
    ...candidate,
    name: hostile,
    employeeNumber: '<img src=x onerror=1>',
    notes: hostile,
    interviews: [
      {
        scorer: hostile,
        at: '2026-08-24T15:00:00.000Z',
        scores: { q1: 4, q2: 4, q3: 4, q4: 4, q5: 4, q6: 4 },
        notes: { q1: hostile },
      },
    ],
  }
  const out = candidateRecordBody(nasty, score, { ...course, label: hostile }, meta)
  ok(!/<script>/.test(out), 'a pasted <script> tag never reaches the document raw')
  // What matters is that no TAG is produced from data. The attribute name may
  // survive as inert text inside an escaped entity (&lt;img … onerror=1&gt;),
  // which renders as visible characters and executes nothing.
  ok(!/<img|<b>bold/.test(out), 'no element is ever constructed out of typed text')
  ok(out.includes('&lt;img src=x onerror=1&gt;'), 'an injected tag is neutralised into visible text')
  ok(out.includes('&lt;script&gt;'), 'hostile text is escaped rather than dropped')
  ok(out.includes('&amp;') && out.includes('&quot;'), 'ampersands and quotes are escaped')
  // The rendered text is still readable — escaping must not eat the content.
  ok(out.includes('bold'), 'the words survive escaping')
}

// ----- edge cases that must not throw or print nonsense ---------------------
{
  // No gates object, no employee number, no notes, no bonus, nothing scored.
  const bare = {
    id: 'bare', courseId: 'c1', name: 'Pat Lee', gates: {}, createdAt: '2026-08-01T00:00:00.000Z',
  }
  const bareScore = {
    base: 0, bonus: 0, composite: 0, complete: false, sections: [],
    blockers: ['Not all components scored yet'], gatesMet: false,
  }
  let body2 = ''
  let threw = ''
  try {
    body2 = candidateRecordBody(bare, bareScore, course, meta)
  } catch (e) {
    threw = String(e.message || e)
  }
  ok(threw === '', `a bare candidate does not throw (${threw})`)
  ok(/Pat Lee/.test(body2), 'the bare record still names the candidate')
  ok(/No final decision recorded/.test(body2), 'and says no decision has been recorded')
  ok(/No interview recorded/.test(body2), 'and says no interview was recorded')
  ok(/not met/.test(body2), 'unmet gates are shown as unmet, not blank')
  ok(!/undefined|NaN|\[object Object\]/.test(body2), 'no undefined / NaN / [object Object] leaks into the document')

  // A cohort with nobody in it.
  let empty = ''
  try {
    empty = cohortRecordBody(course, [], { actor: 'a', generatedAt: 'now' })
  } catch (e) {
    empty = 'THREW: ' + e.message
  }
  ok(!/^THREW/.test(empty), 'an empty cohort does not throw')
  ok(/0 candidates/.test(empty), 'and reports zero candidates')

  // A scorer who only answered some questions.
  const partial = {
    ...candidate,
    interviews: [{ scorer: 'J. Jones', at: '2026-08-24T15:00:00.000Z', scores: { q1: 4, q3: 5 }, notes: {} }],
  }
  const pbody = candidateRecordBody(partial, score, course, meta)
  ok(!/undefined/.test(pbody), 'an unanswered question prints a dash, not undefined')
}

// The main document must never contain a raw unescaped angle bracket from data.
ok(!/<script/i.test(body), 'the ordinary record carries no script tag')

// Emit a rendered sample for the eye (not part of the pass/fail).
const CSS = `body{font-family:'Segoe UI',Arial,sans-serif;color:#111;margin:24px;font-size:12px}
h1{font-size:20px;margin:0 0 2px;color:#0b2e4f}h2{font-size:14px;margin:18px 0 6px;color:#0b2e4f;border-bottom:2px solid #0b2e4f;padding-bottom:3px}
h3{font-size:12.5px;color:#0b2e4f}.sub{color:#555;margin:0 0 14px}.sub2{color:#555;font-size:11px}
table{border-collapse:collapse;width:100%;margin:6px 0 12px}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#e8eef5;font-size:11px}.num{text-align:right;white-space:nowrap}.slot{width:40px;text-align:center}
.badge{display:inline-block;background:#0b2e4f;color:#fff;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700}
.note{background:#fef9e7;border:1px solid #e7d9a0;padding:6px 8px;margin:6px 0}.flag{background:#fde2e1;color:#b91c1c;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700}
.footer{margin-top:18px;color:#777;font-size:10px}.meta td{border:none;padding:3px 6px 3px 0}.sig span{display:inline-block;border-bottom:1px solid #333;min-width:200px;margin:0 24px 0 6px}`
const sampleFp = await recordFingerprint(candidate, score)
const sampleBody = candidateRecordBody(candidate, score, course, { actor: 'j.jones@amr', generatedAt: 'Aug 24 2026, 4:10 PM', fingerprint: sampleFp })
const outHtml = join(tmpdir(), 'ces-record-sample.html')
writeFileSync(outHtml, `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${sampleBody}</body></html>`)
console.log(`check-selection-record: sample written to ${outHtml}`)

if (fails.length) {
  console.error(`check-selection-record: ${fails.length} of ${checks} checks failed\n`)
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log(`check-selection-record: ${checks} checks passed`)
