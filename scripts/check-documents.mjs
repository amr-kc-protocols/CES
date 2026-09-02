// Build every program document and check what came out.
//
// The document set is generated rather than typed, which removes one class of
// error entirely — two documents cannot disagree about the passing score, since
// neither of them holds it. It does not remove the others, and the ones it
// leaves are quiet:
//
//   A GENERATOR THAT NO LONGER RUNS. These scripts read the course record
//   through esbuild, so a rename in src/data breaks them at run time and
//   nowhere else. `tsc` is green, the app builds, and the syllabus is missing
//   the week somebody moved. Building all seven is the only thing that catches
//   it, so this builds all seven.
//
//   A SOURCE PATH ON A PAGE. Notes on the course record are written for whoever
//   is reading the source — "see data/aemtPhases.ts" — and doc-kit's
//   printable() strips that clause on the way to the page. printable() only
//   helps where it is called. This reads the finished .docx and looks for what
//   escaped, which is the check that does not depend on remembering.
//
//   A HOLE WHERE A VALUE WAS. `undefined`, `NaN` and `[object Object]` render
//   silently into Word and are only ever noticed by the reader.
//
//   A SECTION THAT QUIETLY STOPPED BEING PRODUCED. K.A.R. 109-1-1(ss) lists
//   what a syllabus contains; 109-17-3 lists what a course retains. Each
//   document below names the sections it owes, so a refactor that drops one
//   fails here rather than at the board.
//
// Last, the registry: K.A.R. 109-17-3 records that live outside CES must say
// either which command produces them or why no command can. "No generator" and
// "generator not written yet" look identical in a list and are different
// problems, and the difference is only visible if somebody is made to write it
// down.
//
// Run: node scripts/check-documents.mjs  (or `npm run check:documents`)
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { loadCourse, longDate, ROOT, shortDate, weekdayOf } from './lib/doc-kit.mjs'

const m = await loadCourse()
const { A, F, P: PH, R, S, STD } = m
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

let failed = 0
const check = (ok, label, detail) => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok && detail) console.log(`        ${String(detail).split('\n').join('\n        ')}`)
}

// ----- what each document owes -----------------------------------------------

const formTitles = F.AEMT_FORMS.map((f) => f.title)
const karLabels = m.CLINICAL_REQUIREMENTS.filter((r) => r.basis === 'kar').map((r) => r.label)
const scheduleDates = [...new Set(m.KC_SCHEDULE.map((r) => shortDate(r.date)))]
const pass = `${m.MIN_PASSING_PERCENT}%`
const approvalDue = m.deadlineDates(m.KBEMS_DEADLINES.find((d) => d.id === 'course-approval')).due

const DOCS = [
  {
    npm: 'doc:syllabus',
    script: 'build-syllabus.mjs',
    label: 'Course syllabus',
    // The eight elements K.A.R. 109-1-1(ss) names, in the order it names them.
    sections: [
      'Course description', 'Goals and objectives', 'Instructional materials required',
      'Attendance policy', 'Requirements for successful completion',
      'Clinical and field internship', 'Student conduct and discipline',
      'Instructional staff', 'Course schedule', 'Records',
    ],
    // The filed schedule and the working one are the same schedule or the
    // course is being run against a document nobody is holding.
    contains: [...scheduleDates, pass, ...m.COURSE_STAFF.map((s) => s.name)],
  },
  {
    npm: 'doc:curriculum',
    script: 'build-curriculum.mjs',
    label: 'Curriculum and lesson plans',
    sections: ['The curriculum this course teaches', 'Standards coverage map', 'The standard session', 'Lesson plans'],
    // K.A.R. 109-10-1c adopts the standards; a map missing one is a gap in
    // coverage that reads as a formatting change.
    contains: [...STD.STANDARDS.map((s) => s.code), m.COURSE_TEXT.title],
  },
  {
    npm: 'doc:objectives',
    script: 'build-objectives.mjs',
    label: 'Clinical and field training objectives',
    sections: [
      'For the preceptor', 'The rotation, phase by phase', 'What has to be documented',
      'Who may supervise', 'Field internship', 'Shift record',
    ],
    contains: [...karLabels, ...PH.seedPhases(m.KC_START_DATE).map((p) => p.name)],
  },
  {
    npm: 'doc:policies',
    script: 'build-forms.mjs',
    args: ['policies'],
    label: 'Program policies',
    sections: ['Admission and prerequisite work', 'Attendance', 'Grading and completion', 'Progress conferences', 'Conduct', 'Records and retention'],
    contains: [pass, `${m.RECORDS_RETENTION_YEARS}`],
  },
  {
    npm: 'doc:forms',
    script: 'build-forms.mjs',
    args: ['forms'],
    label: 'Forms packet',
    sections: ['Patient Encounter Log', ...formTitles],
    // The encounter log leaves the building in a student's pocket. The warning
    // on it is the only PHI control the paper copy has.
    contains: ['NO PATIENT IDENTIFIERS'],
  },
  {
    npm: 'doc:student',
    script: 'build-student-guide.mjs',
    label: 'Student guide',
    sections: ['How this course works', 'How you are graded', 'Attendance', 'Before the course starts', 'Week by week', 'After the course'],
    contains: [pass, ...m.PRE_COURSE_CHAPTERS.map((c) => String(c))],
  },
  {
    npm: 'doc:application',
    script: 'build-application.mjs',
    label: 'KBEMS course approval application',
    sections: ['(b2) Course Policies', '(b3) Course Schedule', '(c) Application Submission', 'Appendices'],
    // The meeting pattern and the filing deadline are the two sentences on
    // this document that a reader acts on, and both were written out by hand.
    // Both survived a start-date move: it told the board the class met
    // Tuesdays and Thursdays 0900-1300, and that the application was due eight
    // days before the date the regulation actually gives.
    contains: [...scheduleDates, m.classPatternSentence(), longDate(approvalDue)],
  },
]

// ----- build them all --------------------------------------------------------

const dir = mkdtempSync(join(tmpdir(), 'ces-docs-'))
const built = []

for (const d of DOCS) {
  const out = join(dir, `${d.npm.replace(':', '-')}.docx`)
  let stdout = ''
  let error = null
  try {
    stdout = execFileSync(process.execPath, [join(ROOT, 'scripts', d.script), ...(d.args ?? []), out], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    error = e
  }
  check(!error, `${d.npm} runs`, error && `${error.message}\n${error.stderr ?? ''}`.trim())
  if (error) {
    built.push({ ...d, text: '' })
    continue
  }

  const bytes = statSync(out).size
  // A docx that packed but holds nothing still writes ~6 KB of zip furniture.
  check(bytes > 12_000, `${d.npm} produced a document of substance`, `${bytes} bytes`)

  const zip = await JSZip.loadAsync(readFileSync(out))
  const xml = await zip.file('word/document.xml').async('string')
  const text = xml
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<\/w:(?:p|tc)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
  built.push({ ...d, text, stdout })
}

// ----- what is on the pages --------------------------------------------------

/** A path or a module name that belongs in the repository and not on a page. */
const LEAKS = [
  [/\b(?:src|scripts|data|modules|lib)\/[\w/.-]+/g, 'source path'],
  [/\b[\w-]+\.(?:ts|tsx|mjs|js)\b/g, 'source file'],
  [/\b(?:TODO|FIXME|XXX)\b/g, 'unfinished note'],
  [/\bundefined\b|\bNaN\b|\[object Object\]/g, 'a value that did not render'],
]

for (const d of built) {
  if (!d.text) continue

  const missingSections = d.sections.filter((s) => !d.text.includes(s))
  check(missingSections.length === 0, `${d.npm} carries every section it owes`, missingSections.join('\n'))

  const missing = (d.contains ?? []).filter((s) => !d.text.includes(s))
  check(
    missing.length === 0,
    `${d.npm} states what the course record says`,
    `${missing.length} missing: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}`,
  )

  const hits = []
  for (const [re, what] of LEAKS) {
    for (const match of d.text.matchAll(re)) {
      const line = d.text.slice(0, match.index).split('\n').pop() + d.text.slice(match.index).split('\n')[0]
      hits.push(`${what}: "${match[0]}"  in: ${line.trim().slice(0, 120)}`)
    }
  }
  check(hits.length === 0, `${d.npm} is written for its reader, not for the repository`, hits.join('\n'))

  check(
    d.text.includes('Do not edit this file by hand'),
    `${d.npm} says it is generated`,
    'Every one of these is a snapshot; a copy without that line gets treated as the record.',
  )

  const cover = [longDate(m.KC_START_DATE), longDate(m.KC_END_DATE)]
  const missingCover = cover.filter((c) => !d.text.includes(c))
  check(missingCover.length === 0, `${d.npm} names the cohort it belongs to`, missingCover.join(', '))
}

// ----- the same document, built in the app -----------------------------------
//
// Four of these are now built inside the PWA as well, from the same Block[] the
// .docx renders. That is the whole architecture: one source, two renderers, so
// the copy a Program Manager builds on the Records tab and the copy a KBEMS
// reviewer is sent cannot say different things.
//
// "Cannot by construction" is the claim; this is the part that checks it,
// because the construction is only as good as both renderers being fed the same
// tree. Every assertion the .docx just passed is re-run against the HTML.

const appDocs = []
for (const [recordId, builderName] of Object.entries({
  syllabus: 'syllabusBlocks',
  curriculum: 'curriculumBlocks',
  objectives: 'objectivesBlocks',
  policies: 'policiesBlocks',
})) {
  const spec = DOCS.find((d) => d.npm === `doc:${recordId}`)
  const blocks = m.DOCS[builderName]()
  const html = m.docHtml(spec.label, blocks)
  // Strip tags the way a reader sees it, so the same substring checks apply.
  const text = html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<\/(?:p|div|h1|h2|h3|li|td|tr|table)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
  appDocs.push({ ...spec, npm: `app:${recordId}`, text, html, blocks })
}

for (const d of appDocs) {
  const missingSections = d.sections.filter((s) => !d.text.includes(s))
  check(missingSections.length === 0, `${d.npm} carries every section it owes`, missingSections.join('\n'))

  const missing = (d.contains ?? []).filter((s) => !d.text.includes(s))
  check(
    missing.length === 0,
    `${d.npm} states what the course record says`,
    `${missing.length} missing: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}`,
  )

  const hits = []
  for (const [re, what] of LEAKS) {
    for (const match of d.text.matchAll(re)) hits.push(`${what}: "${match[0]}"`)
  }
  check(hits.length === 0, `${d.npm} is written for its reader, not for the repository`, hits.join('\n'))

  check(
    d.text.includes('Do not edit this file by hand'),
    `${d.npm} says it is generated`,
  )
  // Stored and reopened years later, so it has to stand on its own: no
  // stylesheet to fetch, no font, nothing that stops resolving.
  const external = [...d.html.matchAll(/(?:src|href)\s*=\s*"(https?:)?\/\//g)]
  check(
    external.length === 0,
    `${d.npm} is self-contained`,
    'a retained record cannot depend on something being fetched in 2029',
  )
}

// The claim itself: same headings, same order, in both renderings.
for (const app of appDocs) {
  const filed = built.find((b) => b.npm === app.npm.replace('app:', 'doc:'))
  if (!filed?.text) continue
  const headings = app.blocks.filter((b) => b.k === 'h1').map((b) => b.text)
  const missingInDocx = headings.filter((h) => !filed.text.includes(h))
  const missingInApp = headings.filter((h) => !app.text.includes(h))
  check(
    missingInDocx.length === 0 && missingInApp.length === 0,
    `${app.npm} and ${filed.npm} carry the same ${headings.length} headings`,
    [...missingInDocx.map((h) => `missing from the .docx: ${h}`), ...missingInApp.map((h) => `missing from the app copy: ${h}`)].join('\n'),
  )
}

// The one duplication left in the set: doc-kit keeps its own date helpers for
// the two scripts that are not block-tree documents. If they ever disagree with
// the shared ones, two documents start spelling the same date differently.
const dateDrift = [...new Set(m.KC_SCHEDULE.map((r) => r.date))].filter(
  (iso) =>
    longDate(iso) !== m.longDate(iso) ||
    shortDate(iso) !== m.shortDate(iso) ||
    weekdayOf(iso) !== m.weekdayOf(iso),
)
check(
  dateDrift.length === 0,
  'the script and app date helpers spell every schedule date the same way',
  dateDrift.slice(0, 5).join(', '),
)

// A generated record with no builder is a Build button that does nothing.
const noBuilder = R.GENERATED_RECORDS.filter((r) => !m.BUILDERS[r.id])
check(
  noBuilder.length === 0,
  'every generated record can actually be built in the app',
  noBuilder.map((r) => r.id).join(', '),
)

// ----- the registry ----------------------------------------------------------
//
// Which records this document set satisfies. The registry itself is checked by
// check-records.mjs; what belongs here is the half that is about the DOCUMENTS —
// that every command a record names exists and runs, and that no command in
// package.json produces a document nobody has accounted for.

const external = R.EXTERNAL_RECORDS
const unexplained = external.filter((r) => !r.noGenerator?.trim())
check(
  unexplained.length === 0,
  'every record kept outside CES says why no command can produce it',
  unexplained.map((r) => r.label).join('\n'),
)

// Both kinds of claim on a command: the generator that produces a record, and
// the blankForm that prints the paper a CES-held record is collected on.
const namedCommands = [
  ...R.REQUIRED_RECORDS.map((r) => r.generator),
  ...R.REQUIRED_RECORDS.map((r) => r.blankForm),
].filter(Boolean)
const badScript = [...new Set(namedCommands)].filter((g) => !pkg.scripts[g])
check(badScript.length === 0, 'every command a record names is a real npm script', badScript.join(', '))

// A doc script nobody claims is either an unrecorded record or a document that
// is not one. Both are fine; being unable to tell them apart is not.
const NOT_A_RETAINED_RECORD = {
  'doc:application': 'Filed with KBEMS under K.A.R. 109-11-4a. It is a submission, not one of the records 109-17-3 retains.',
  'doc:student': 'Issued to students. The policies it restates are retained under the `policies` record; the guide itself is not a required record.',
}
const claimed = new Set(namedCommands)
const docScripts = Object.keys(pkg.scripts).filter((s) => s.startsWith('doc:') && s !== 'doc:all')
const unclaimed = docScripts.filter((s) => !claimed.has(s) && !NOT_A_RETAINED_RECORD[s])
check(unclaimed.length === 0, 'every document either satisfies a required record or says it is not one', unclaimed.join(', '))

const inAll = pkg.scripts['doc:all'] ?? ''
const notChained = docScripts.filter((s) => !inAll.includes(s))
check(notChained.length === 0, 'doc:all builds every document', notChained.join(', '))

const notChecked = docScripts.filter((s) => !DOCS.some((d) => d.npm === s))
check(notChecked.length === 0, 'every document is checked here', notChecked.join(', '))

// ----- no document describes a class that is not this one --------------------
//
// The pattern sentences are prose. A document that spells out a clock the
// course record does not have is describing a different course to whoever
// reads it, and nothing above would notice: every section is present, every
// date is real, the wrong four hours are simply asserted alongside them.
{
  const twelve = (hhmm) => {
    const h = Number(hhmm.slice(0, 2))
    const mm = hhmm.slice(2)
    return `${((h + 11) % 12) + 1}${mm === '00' ? '' : `:${mm}`}\\s*${h < 12 ? '[ap]' : '[ap]'}\\.?m\\.?`
  }
  const realClock = new RegExp(
    `\\b(?:${m.CLASS_CLOCK.start}\\s*(?:to|[–—-])\\s*${m.CLASS_CLOCK.end}` +
      `|${twelve(m.CLASS_CLOCK.start)}\\s*(?:to|[–—-])\\s*${twelve(m.CLASS_CLOCK.end)})\\b`,
    'i',
  )
  // Both spellings a document has used: "0900-1300" and "9am to 1pm". The
  // second is how the stale sentence in the application survived the first
  // version of this check.
  const anyClock =
    /\b(?:([01]\d|2[0-3])[0-5]\d\s*(?:to|[–—-])\s*([01]\d|2[0-3])[0-5]\d|\d{1,2}(?::\d\d)?\s*[ap]\.?m\.?\s*(?:to|[–—-])\s*\d{1,2}(?::\d\d)?\s*[ap]\.?m\.?)\b/gi
  // Documents legitimately print clocks that are not class: instructor office
  // hours, clinical shift spans. It is the sentence claiming class meets then
  // that is the defect, so only clocks in a sentence about class are read.
  const NOT_CLASS = /\b(office hour|available|reply|shift|rotation|clinical|internship|on-call)/i
  for (const d of built) {
    if (!d.text) continue
    const wrong = [...d.text.matchAll(anyClock)]
      .filter((x) => {
        const before = d.text.slice(0, x.index).split(/[\n.]/).pop() ?? ''
        const after = d.text.slice(x.index + x[0].length).split(/[\n.]/)[0] ?? ''
        return !NOT_CLASS.test(before + x[0] + after)
      })
      .map((x) => x[0])
      .filter((x) => !realClock.test(x))
    check(
      wrong.length === 0,
      `${d.npm} states no class time other than the one the course record keeps`,
      `${[...new Set(wrong)].join(', ')} — the pattern is ${m.CLASS_CLOCK.start} to ${m.CLASS_CLOCK.end}`,
    )
  }
}

rmSync(dir, { recursive: true, force: true })

console.log(`
  ${built.length} documents built and read back
  ${R.GENERATED_RECORDS.length} records generated here · ${R.HELD_RECORDS.filter((r) => r.blankForm).length} collected on a generated blank form · ${external.length} explained as ungeneratable
  ${scheduleDates.length} schedule dates and ${STD.STANDARDS.length} standards traced onto the page`)

console.log(
  failed === 0
    ? '\ncheck-documents: every document builds and says what the course record says.'
    : `\n${failed} check(s) failed.`,
)
process.exit(failed === 0 ? 0 : 1)
