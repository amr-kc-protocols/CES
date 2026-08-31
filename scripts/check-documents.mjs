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
import { loadCourse, longDate, ROOT, shortDate } from './lib/doc-kit.mjs'

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
    contains: [...scheduleDates],
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

// ----- the registry ----------------------------------------------------------

const external = R.REQUIRED_RECORDS.filter((r) => r.source === 'external')
const unexplained = external.filter((r) => !r.generator && !r.noGenerator?.trim())
check(
  unexplained.length === 0,
  'every record held outside CES either has a generator or says why it cannot',
  unexplained.map((r) => r.label).join('\n'),
)

const both = external.filter((r) => r.generator && r.noGenerator)
check(both.length === 0, 'no record claims a generator and an absence of one', both.map((r) => r.label).join('\n'))

const badScript = [...new Set(external.map((r) => r.generator).filter(Boolean))].filter((g) => !pkg.scripts[g])
check(badScript.length === 0, 'every named generator is a real npm script', badScript.join(', '))

// A doc script nobody claims is either an unrecorded record or a document that
// is not one. Both are fine; being unable to tell them apart is not.
const NOT_A_RETAINED_RECORD = {
  'doc:application': 'Filed with KBEMS under K.A.R. 109-11-4a. It is a submission, not one of the records 109-17-3 retains.',
  'doc:student': 'Issued to students. The policies it restates are retained under the `policies` record; the guide itself is not a required record.',
}
const claimed = new Set(external.map((r) => r.generator).filter(Boolean))
const docScripts = Object.keys(pkg.scripts).filter((s) => s.startsWith('doc:') && s !== 'doc:all')
const unclaimed = docScripts.filter((s) => !claimed.has(s) && !NOT_A_RETAINED_RECORD[s])
check(unclaimed.length === 0, 'every document either satisfies a required record or says it is not one', unclaimed.join(', '))

const inAll = pkg.scripts['doc:all'] ?? ''
const notChained = docScripts.filter((s) => !inAll.includes(s))
check(notChained.length === 0, 'doc:all builds every document', notChained.join(', '))

const notChecked = docScripts.filter((s) => !DOCS.some((d) => d.npm === s))
check(notChecked.length === 0, 'every document is checked here', notChecked.join(', '))

rmSync(dir, { recursive: true, force: true })

console.log(`
  ${built.length} documents built and read back
  ${external.length} records outside CES · ${claimed.size} generated here · ${external.length - external.filter((r) => r.generator).length} explained as ungeneratable
  ${scheduleDates.length} schedule dates and ${STD.STANDARDS.length} standards traced onto the page`)

console.log(
  failed === 0
    ? '\ncheck-documents: every document builds and says what the course record says.'
    : `\n${failed} check(s) failed.`,
)
process.exit(failed === 0 ? 0 : 1)
