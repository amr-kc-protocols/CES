// Consistency check for the chart review questionnaire and its export.
//
// The question set is a transcription of a form in another system, and it grows
// a category block at a time. These assertions are what stop a paste going
// wrong quietly: a duplicated id silently overwrites an answer, a question left
// out of the export loses data nobody notices until someone asks for it back,
// and mis-scoring either of the two inverted questions turns a crew's worst
// charts into their best.
//
// It also builds a real workbook and reads it back, because the xlsx writer in
// this repo is hand-rolled and a malformed zip is a file Excel refuses to open
// with no useful message.
//
// Run: node scripts/check-chart-review.mjs
import { rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'
import { unzipSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src')
const OUT = join(tmpdir(), `ces-chart-review-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `
      export * from ${JSON.stringify(join(SRC, 'data/chartReview'))}
      export { buildXlsx, columnName, safeSheetName } from ${JSON.stringify(join(SRC, 'lib/xlsx'))}
      export { reviewWorkbook, tally, crewTally, overall, unanswered } from ${JSON.stringify(join(SRC, 'modules/review/chartReviewStore'))}
    `,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
})

let m
try {
  m = await import(pathToFileURL(OUT).href)
} catch (err) {
  console.log('FAIL  the chart review modules throw on load')
  console.log(`      ${err.message}`)
  rmSync(OUT, { force: true })
  process.exit(1)
}

let failed = 0
const check = (ok, label, detail) => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok && detail) console.log(`        ${detail}`)
}

check(true, 'chart review modules load')

// ----- the question set ------------------------------------------------------

const ids = m.ALL_QUESTIONS.map((q) => q.id)
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
check(
  dupes.length === 0,
  'no question id is used twice',
  // Answers are keyed by id, so a duplicate does not merely look untidy: the
  // second question silently reads and writes the first one's answer.
  [...new Set(dupes)].join(', '),
)

const unscored = m.ALL_QUESTIONS.filter((q) => q.kind === 'yesno' && !q.scoring)
check(unscored.length === 0, 'every yes/no question declares its scoring', unscored.map((q) => q.id).join(', '))

// The inverted pair, pinned by id. Getting either wrong reports a near miss as
// a pass. Everything else is a documentation question — a No is a charting gap
// — so the compliant answer is Yes.
const inverted = m.ALL_QUESTIONS.filter((q) => q.scoring === 'no-good').map((q) => q.id).sort()
check(
  inverted.join(',') === 'ovr.nearMiss,ovr.safetyConcerns',
  'the inverted questions are exactly the near-miss and safety-concern pair',
  `found: ${inverted.join(', ') || 'none'}`,
)
check(
  m.question('ovr.escalate')?.scoring === 'flag',
  'escalation to clinical leadership is a flag, not a scored failure',
)

const badOptions = m.ALL_QUESTIONS.filter(
  (q) => (q.kind === 'select' || q.kind === 'multi') && !(q.options ?? []).length,
)
check(badOptions.length === 0, 'every select and multi question has options', badOptions.map((q) => q.id).join(', '))

// Every category on the CQM list either has a question block or is recorded as
// not having one yet. Silence is how a block goes missing after an upload.
const withSections = new Set(
  m.REVIEW_SECTIONS.filter((s) => s.when && 'category' in s.when).map((s) => s.when.category),
)
const missing = m.REVIEW_CATEGORIES.filter(
  (c) => c !== 'Other' && !withSections.has(c) && !m.CATEGORIES_WITHOUT_SECTIONS.includes(c),
)
check(
  missing.length === 0,
  'every review category has a question block, or is declared as still to come',
  `neither: ${missing.join(', ')}`,
)
if (m.CATEGORIES_WITHOUT_SECTIONS.length) {
  console.log(
    `      pending — no question block transcribed yet: ${m.CATEGORIES_WITHOUT_SECTIONS.join(', ')}`,
  )
}

// Authored blocks are fine, but they must say so. An unlabelled one would be
// indistinguishable from the transcribed questions the form's credibility rests
// on.
const authoredTitles = m.AUTHORED_SECTIONS.map((s) => s.title)
check(
  m.AUTHORED_SECTIONS.every((s) => !!s.intro),
  'every authored section explains where its questions came from',
  m.AUTHORED_SECTIONS.filter((s) => !s.intro).map((s) => s.title).join(', '),
)
check(
  authoredTitles.join(',') === 'Trauma Review',
  'Trauma is the only section written here rather than transcribed',
  `authored: ${authoredTitles.join(', ') || 'none'}`,
)

const orphanSections = [...withSections].filter((c) => !m.REVIEW_CATEGORIES.includes(c))
check(
  orphanSections.length === 0,
  'no category block is keyed to a category nobody can select',
  orphanSections.join(', '),
)

// ----- visibility ------------------------------------------------------------

const common = m.visibleQuestions(['newhire'], []).map((q) => q.id)
check(
  !common.includes('cqm.categories') && common.includes('dem.locations') && common.includes('nh.phase'),
  'a new-hire review shows the backbone and the phase question, not the CQM block',
)
const cqmOnly = m.visibleQuestions(['cqm'], []).map((q) => q.id)
check(
  cqmOnly.includes('cqm.categories') && !cqmOnly.includes('nh.phase') && !cqmOnly.includes('ams.glucose'),
  'a CQM review with no category ticked shows no category block',
)
const withAms = m.visibleQuestions(['cqm'], ['Altered Mental Status']).map((q) => q.id)
check(withAms.includes('ams.glucose'), 'ticking a category reveals its block')

// Every transcribed block, spot-checked by one id each, so a block dropped in a
// later paste shows up here rather than as a quietly shorter form.
const BLOCK_IDS = {
  'Altered Mental Status': 'ams.glucose',
  'Advanced Airway': 'aw.capnography',
  'Overdose Management': 'od.vitals',
  Stroke: 'str.lastKnownWell',
  'Cardiac Arrest': 'ca.bystanderCpr',
  'Lights and Sirens': 'ls.transport',
  STEMI: 'stemi.twelveLead',
  Trauma: 'tr.triageCriteria',
}
const blockMisses = Object.entries(BLOCK_IDS).filter(
  ([cat, qid]) => !m.visibleQuestions(['cqm'], [cat]).some((q) => q.id === qid),
)
check(
  blockMisses.length === 0,
  `all ${Object.keys(BLOCK_IDS).length} transcribed category blocks reveal their questions`,
  blockMisses.map(([c]) => c).join(', '),
)

// Ticking two categories brings both blocks, and neither drags the other in.
const two = m.visibleQuestions(['cqm'], ['Stroke', 'STEMI']).map((q) => q.id)
check(
  two.includes('str.lastKnownWell') && two.includes('stemi.twelveLead') && !two.includes('ca.rosc'),
  'two categories bring exactly their own two blocks',
)
// Categories are meaningless without CQM: a stale category left on a review
// switched back to new-hire only must not drag its block along.
const staleCategory = m.visibleQuestions(['newhire'], ['Altered Mental Status']).map((q) => q.id)
check(
  !staleCategory.includes('ams.glucose'),
  'a category block needs CQM selected, not just the category',
)

// A no-patient-contact review must not be asked the patient-care backbone, and
// must still be asked the universal outcome questions under the same ids — a
// second set would split the near-miss count across two rows of the tally.
const np = m.visibleQuestions(['nopatient'], []).map((q) => q.id)
check(
  !np.includes('dem.locations') && !np.includes('trt.procedures') && !np.includes('asm.history'),
  'a no-patient-contact review skips the patient-care backbone',
  np.filter((id) => id.startsWith('dem.') || id.startsWith('trt.') || id.startsWith('asm.')).join(', '),
)
check(
  np.includes('np.narrative') && np.includes('np.signatures'),
  'a no-patient-contact review asks its own short block',
)
check(
  np.includes('ovr.nearMiss') && np.includes('ovr.safetyConcerns') && np.includes('ovr.escalate'),
  'the outcome questions are asked on every review type, under the same ids',
  np.filter((id) => id.startsWith('ovr.')).join(', ') || 'none present',
)
const care = m.visibleQuestions(['cqm'], []).map((q) => q.id)
check(
  !care.includes('np.narrative') && care.includes('dem.locations') && care.includes('ovr.nearMiss'),
  'a patient-care review gets the backbone and the outcome questions, not the short block',
)

// ----- the tally -------------------------------------------------------------

const review = (answers, extra = {}) => ({
  id: 'r' + Math.random(),
  types: ['cqm'],
  categories: [],
  incidentNumber: '1',
  crew: ['Pat Lee'],
  reviewer: 'R',
  reviewedAt: '2026-08-01',
  serviceDate: '2026-08-01',
  answers,
  status: 'complete',
  updatedAt: '',
  ...extra,
})

// A Yes on the near-miss question is a FAILURE, and a No is compliant.
const t1 = m.tally([review({ 'ovr.nearMiss': true }), review({ 'ovr.nearMiss': false })])
const nm = t1.find((r) => r.question.id === 'ovr.nearMiss')
check(
  nm.answered === 2 && nm.yes === 1 && nm.compliant === 1 && nm.percent === 50,
  'a Yes on the near-miss question counts as non-compliant',
  `answered ${nm.answered} yes ${nm.yes} compliant ${nm.compliant} pct ${nm.percent}`,
)

// The flag is counted but never scored.
const esc = m.tally([review({ 'ovr.escalate': true })]).find((r) => r.question.id === 'ovr.escalate')
check(esc.answered === 1 && esc.percent === undefined, 'the escalation flag is counted but not scored')

// Out-of-scope questions must not enter the denominator.
const scoped = m.tally([review({ 'ams.glucose': true }, { categories: ['Altered Mental Status'] }), review({})])
const ams = scoped.find((r) => r.question.id === 'ams.glucose')
check(
  ams.answered === 1,
  'a category question is only counted on reviews that were asked it',
  `answered ${ams.answered}, expected 1`,
)

// An unanswered question is not a failure.
const partial = m.tally([review({ 'dem.locations': true }), review({})])
const dem = partial.find((r) => r.question.id === 'dem.locations')
check(dem.answered === 1 && dem.percent === 100, 'an unanswered question is left out, not counted as No')

// A review naming two people counts for both.
const ct = m.crewTally([review({ 'dem.locations': true }, { crew: ['A', 'B'] })])
check(
  ct.length === 2 && ct.every((c) => c.reviews === 1 && c.percent === 100),
  'a review naming two crew members counts for both',
)
const noCrew = m.crewTally([review({}, { crew: [] })])
check(
  noCrew.length === 1 && noCrew[0].crew === '(no crew recorded)',
  'a review with no crew still appears on the crew sheet',
)

// ----- the workbook ----------------------------------------------------------

const sheets = m.reviewWorkbook([
  review(
    { 'dem.locations': false, 'ovr.nearMiss': false, 'cqm.categories': ['Trauma'] },
    { questionNotes: { 'dem.locations': 'Destination recorded as "hospital" with no name' } },
  ),
])
check(
  sheets.length === 4,
  'the workbook has Reviews, Findings, Tally and By crew',
  `${sheets.length} sheets: ${sheets.map((x) => x.name).join(', ')}`,
)

// The Findings sheet is what a supervisor works from: one row per
// non-compliant answer, carrying the reviewer's note.
const findings = sheets.find((x) => x.name === 'Findings')
check(
  findings.rows.length === 2 &&
    findings.rows[1][4] === 'Are the Incident Location and Destination Location recorded correctly?' &&
    findings.rows[1][5] === 'No' &&
    String(findings.rows[1][6]).includes('no name'),
  'a non-compliant answer reaches the Findings sheet with its note',
  JSON.stringify(findings.rows[1] ?? null),
)

// An answer left behind by a de-selected section must not export as though the
// question had been put. Tick a category, answer its block, untick it: the
// answers stay in the record, and the Reviews sheet used to print them while
// the Tally and Findings sheets correctly ignored them.
const staleSheets = m.reviewWorkbook([
  review(
    { 'aw.capnography': true, 'dem.locations': false, 'np.location': true },
    { types: ['nopatient'], categories: [] },
  ),
])
const staleHeader = staleSheets[0].rows[0]
const staleRow = staleSheets[0].rows[1]
const outOfScope = ['Waveform Capnography', 'Are the Incident Location and Destination Location recorded correctly?']
  .map((p) => [p, staleRow[staleHeader.indexOf(p)]])
  .filter(([, v]) => v !== '')
check(
  outOfScope.length === 0,
  'answers to de-selected questions are blank on the Reviews sheet',
  outOfScope.map(([p, v]) => `${p.slice(0, 30)}=${JSON.stringify(v)}`).join(', '),
)

// The per-crew rollup is what a Phase 1 new hire is judged on. Free-text names
// arriving as "Pat Lee", "pat lee" and " Pat Lee " used to split one medic into
// three, each with a third of their reviews.
const cased = m.crewTally([
  review({ 'dem.locations': true }, { crew: ['Pat Lee'] }),
  review({ 'dem.locations': true }, { crew: ['pat lee'] }),
  review({ 'dem.locations': true }, { crew: ['  Pat   Lee '] }),
])
check(
  cased.length === 1 && cased[0].reviews === 3 && cased[0].crew === 'Pat Lee',
  'crew names differing only by case or spacing are one person',
  `${cased.length} row(s): ${cased.map((c) => `${JSON.stringify(c.crew)} x${c.reviews}`).join(', ')}`,
)

// What "mark the rest compliant" fills in. Filling every unanswered question
// with Yes would tick the near-miss and safety-concern boxes on every chart.
check(
  m.compliantAnswer(m.question('dem.locations')) === true &&
    m.compliantAnswer(m.question('ovr.nearMiss')) === false &&
    m.compliantAnswer(m.question('ovr.safetyConcerns')) === false &&
    m.compliantAnswer(m.question('ovr.escalate')) === undefined &&
    m.compliantAnswer(m.question('cqm.setting')) === undefined,
  'the compliant answer is Yes, except No on the inverted pair and nothing for flags',
  `locations=${m.compliantAnswer(m.question('dem.locations'))} nearMiss=${m.compliantAnswer(m.question('ovr.nearMiss'))} escalate=${m.compliantAnswer(m.question('ovr.escalate'))}`,
)

// A compliant answer must NOT appear as a finding, and neither must a flag.
const clean = m.reviewWorkbook([review({ 'dem.locations': true, 'ovr.escalate': true })]).find(
  (x) => x.name === 'Findings',
)
check(
  clean.rows.length === 1,
  'compliant answers and flags produce no findings rows',
  `${clean.rows.length - 1} unexpected row(s)`,
)

const header = sheets[0].rows[0]
const missingCols = m.ALL_QUESTIONS.filter((q) => !header.includes(q.prompt))
check(
  missingCols.length === 0,
  'every question has a column on the Reviews sheet',
  missingCols.map((q) => q.id).join(', '),
)
check(
  sheets[0].rows[0].length === sheets[0].rows[1].length,
  'the Reviews header and its rows are the same width',
  `${sheets[0].rows[0].length} vs ${sheets[0].rows[1].length}`,
)

const bytes = m.buildXlsx(sheets)
check(bytes.length > 0 && bytes[0] === 0x50 && bytes[1] === 0x4b, 'the workbook is a zip archive')

// Read the archive back the way a spreadsheet would: walk the central
// directory, pull each part out, and parse it. A stored zip with a wrong offset
// or a bad CRC opens as "file is corrupt" and nothing else.
function readZip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let eocd = buf.length - 22
  while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error('no end-of-central-directory record')
  const count = dv.getUint16(eocd + 10, true)
  let at = dv.getUint32(eocd + 16, true)
  const out = new Map()
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(at, true) !== 0x02014b50) throw new Error(`bad central header at entry ${i}`)
    const method = dv.getUint16(at + 10, true)
    const size = dv.getUint32(at + 24, true)
    const nameLen = dv.getUint16(at + 28, true)
    const extraLen = dv.getUint16(at + 30, true)
    const commentLen = dv.getUint16(at + 32, true)
    const offset = dv.getUint32(at + 42, true)
    const name = new TextDecoder().decode(buf.subarray(at + 46, at + 46 + nameLen))
    // Local header: skip its own variable-length fields to find the data.
    const lnLen = dv.getUint16(offset + 26, true)
    const leLen = dv.getUint16(offset + 28, true)
    const start = offset + 30 + lnLen + leLen
    const raw = buf.subarray(start, start + size)
    out.set(name, method === 0 ? raw : unzipSync(raw))
    at += 46 + nameLen + extraLen + commentLen
  }
  return out
}

let parts
try {
  parts = readZip(bytes)
  check(true, 'the archive reads back through its central directory')
} catch (err) {
  check(false, 'the archive reads back through its central directory', err.message)
  parts = new Map()
}

const required = [
  '[Content_Types].xml',
  '_rels/.rels',
  'xl/workbook.xml',
  'xl/_rels/workbook.xml.rels',
  'xl/styles.xml',
  'xl/worksheets/sheet1.xml',
  'xl/worksheets/sheet4.xml',
]
const absent = required.filter((n) => !parts.has(n))
check(absent.length === 0, 'the archive holds every part a workbook needs', absent.join(', '))

// Well-formedness, checked the cheap way: every part must parse as XML. Node
// has no DOM parser, so this is a tag-balance walk, which catches the failure
// that actually happens — an unescaped & or < from pasted narrative.
function xmlBalanced(raw) {
  // Strip the <?xml?> declaration and any comments first. The tag regex below
  // cannot match them — '?' and '!' are not name characters — so left in place
  // they read as stray text and every part fails.
  const text = raw.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '')
  const stack = []
  const re = /<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g
  let match
  let at = 0
  while ((match = re.exec(text))) {
    // Anything between tags must not contain a raw < or &.
    const between = text.slice(at, match.index)
    if (/[<]/.test(between) || /&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(between)) {
      return `unescaped character before <${match[2]}>`
    }
    at = re.lastIndex
    if (match[3] === '/') continue
    if (match[1] === '/') {
      if (stack.pop() !== match[2]) return `mismatched </${match[2]}>`
    } else stack.push(match[2])
  }
  return stack.length ? `unclosed <${stack[stack.length - 1]}>` : ''
}

const dec = new TextDecoder()
const badXml = [...parts].map(([n, b]) => [n, xmlBalanced(dec.decode(b))]).filter(([, e]) => e)
check(badXml.length === 0, 'every part is well-formed XML', badXml.map(([n, e]) => `${n}: ${e}`).join('; '))

// The nasty characters have to survive the round trip escaped, not raw.
const nasty = m.buildXlsx([{ name: 'T', rows: [['a & b < c > d " e \' f']] }])
const sheet1 = dec.decode(readZip(nasty).get('xl/worksheets/sheet1.xml'))
check(
  sheet1.includes('a &amp; b &lt; c &gt; d') && !/>a & b/.test(sheet1),
  'special characters are escaped in cell text',
)

console.log(`
  ${m.REVIEW_SECTIONS.length} sections · ${m.ALL_QUESTIONS.length} questions
  ${m.ALL_QUESTIONS.filter((q) => q.kind === 'yesno').length} scored yes/no · ${
    m.ALL_QUESTIONS.filter((q) => q.scoring === 'no-good').length
  } inverted · ${m.ALL_QUESTIONS.filter((q) => q.scoring === 'flag').length} flags
  ${withSections.size} of ${m.REVIEW_CATEGORIES.length - 1} review categories have a question block
  ${m.AUTHORED_SECTIONS.length} section(s) written here rather than transcribed: ${m.AUTHORED_SECTIONS.map((s) => s.title).join(', ') || 'none'}`)

console.log(
  failed === 0 ? '\nChart review questionnaire is consistent.' : `\n${failed} check(s) failed.`,
)
rmSync(OUT, { force: true })
process.exit(failed === 0 ? 0 : 1)
