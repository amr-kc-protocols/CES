// Behaviour check for the printed megacode check-off sheet.
//
// This is the one document in the app that leaves the building: the student
// submits it for a card renewal, so what it says has to be exactly what the
// instructor saw, and the steps on it have to be the published ones.
//
// So the check runs the whole path rather than a fixture — it loads the real
// control panel in jsdom, runs a megacode, ticks a scattering of steps the way
// an instructor would (including one in a section the patient has already left),
// ends the run, and prints the record that comes out of it. Then it asserts
// against the AHA checklist the panel itself holds:
//
//   - every Critical Performance Step appears on the sheet, verbatim
//   - a step that was checked prints a ✓ in the check column and one that was
//     not leaves it empty, as the paper form would — the sheet records what was
//     observed, not what should have happened
//   - the form's own furniture is there: the red bands, the check column
//     heading, STOP TEST, Test Results, Learning Station Competency and the
//     copyright line, with the form alone on page one
//   - the section headings are the published ones ("VF Management"), not the
//     scenario's own name for the rhythm
//   - PASS / NR is the instructor's, and the instructor block that a registry
//     needs is on the page
//   - a quarterly scenario prints no result at all, because its approved
//     document defines none
//
// Run: node scripts/check-checkoff.mjs  (or `npm run check:checkoff`)
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { skip } from './lib/check-kit.mjs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')
const PAGE = join(here, '..', 'public', 'simulator', 'control_panel.html')

let JSDOM
try {
  ;({ JSDOM } = await import('jsdom'))
} catch {
  skip('check-checkoff', 'jsdom not installed', 'npm install to enable')
}
const { build } = await import('esbuild')

const OUT = join(tmpdir(), `ces-checkoff-${process.pid}.mjs`)
await build({
  stdin: {
    contents: `export { megacodeSheetHTML, scenarioRecordHTML, runSheetHTML, runSheetTitle,
      runSheetFilename } from ${JSON.stringify(join(SRC, 'modules/simulator/checkoffSheet'))}`,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
  // esc is the only thing the sheet takes from docGen; the rest of that module
  // reaches for window and never runs here.
  plugins: [
    {
      name: 'stub-dom',
      setup(b) {
        b.onResolve({ filter: /dialog$/ }, (a) => ({ path: a.path, namespace: 'stub' }))
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: 'export const notifyUser=()=>{}',
          loader: 'js',
        }))
      },
    },
  ],
})
const { megacodeSheetHTML, scenarioRecordHTML, runSheetHTML, runSheetTitle, runSheetFilename } =
  await import(pathToFileURL(OUT).href)
rmSync(OUT, { force: true })

let checks = 0
const fails = []
const ok = (cond, msg) => {
  checks++
  if (!cond) fails.push(msg)
}

// ---------------------------------------------------------------------------
// Drive a real megacode in the real panel and take the record it produces.
// ---------------------------------------------------------------------------
function runMegacode(key, fill) {
  const dom = new JSDOM(readFileSync(PAGE, 'utf8'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://ces.local/simulator/control_panel.html',
  })
  const w = dom.window
  w.confirm = () => true
  w.document.getElementById('simScenarioSel').value = key
  w.applySimScenario()
  fill(w)
  w.endRun()
  // Gaps in the record open the prompt in the page; these fixtures answer it.
  const box = w.document.getElementById('endPrompt')
  if (box && !box.hidden) w.commitRun()
  const rec = JSON.parse(JSON.stringify(w.eval('lastRun')))
  const checklists = JSON.parse(JSON.stringify(w.eval('ACLS_CHECKLISTS')))
  w.close()
  // The panel posts this to CES, which stamps the two fields it owns.
  return { run: { ...rec, id: 'simrun-test', facilitator: 'J. Jones' }, checklists }
}

// Scenario 2: Bradycardia -> VF -> Asystole -> PCAC. Ticked the way a real
// sheet ends up — most of it, not all of it.
const { run, checklists } = runMegacode('megacode2', (w) => {
  w.setRunField('crew', 'A. Rivera')
  w.setRunField('notes', 'Prompt defibrillation; pauses over 10 seconds twice.')
  w.setInstructor('instructorInitials', 'JJ')
  w.setInstructor('instructorNumber', 'KS-114-2026')
  w.toggleTeam(0)
  w.toggleCpr('rate')
  w.toggleCpr('depth')
  w.setCpr('fraction', '82', 0, 100)
  w.setCpr('ventRate', '10', 0, 60)
  // Walk the code, ticking every step except one in each of the first two
  // sections — including one ticked after the patient has moved on, which is
  // the correction the paper sheet allows and the old per-phase column did not.
  const states = w.eval('run.states.length')
  for (let si = 0; si < states; si++) {
    w.applySimState('megacode2', si)
    const n = w.eval(`run.states[${si}].actions.length`)
    for (let ai = 0; ai < n; ai++) {
      if (si < 2 && ai === 1) continue // deliberately left unobserved
      if (!w.eval(`run.states[${si}].actions[${ai}].done`)) w.toggleActionAt(si, ai)
    }
  }
  // Back up the sheet: the step skipped in section 1, ticked while the patient
  // is in post-arrest care.
  w.toggleActionAt(0, 1)
  w.setResult('pass')
})

const sheet = megacodeSheetHTML(run)

// The record itself, before anything is printed from it.
ok(run.checklist === 'brady_vf_asys', `the run carries its checklist — got ${run.checklist}`)
ok(
  run.states[1].section === 'VF Management',
  `the published section heading is on the record — got "${run.states[1].section}"`,
)
ok(run.instructorNumber === 'KS-114-2026', 'the instructor number is on the record')
ok(
  run.states[0].actions[1].done === true,
  'a step ticked after the patient moved on is recorded against its own section',
)
ok(run.states[1].actions[1].done === false, 'and a step never ticked stays untold')

// ---------------------------------------------------------------------------
// Every published step, verbatim, with the instructor's tick against it.
// ---------------------------------------------------------------------------
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const CHECKED = '&#9745;' // ☑ — the boxes the form itself prints
const EMPTY = '&#9744;' // ☐
const TICK = '&#10003;' // ✓ — what goes in the check column

/**
 * The check cell printed against a given step.
 *
 * The published form has no box in that column, only a space to put a check in,
 * so a checked step carries a ✓ and an unchecked one carries nothing at all.
 */
function tickFor(html, step) {
  const row = html.match(
    new RegExp(
      `<tr(?: class="alt")?><td>${esc(step).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</td><td class="tick">([\\s\\S]*?)</td></tr>`,
    ),
  )
  return row ? row[1].trim() : null
}
const isChecked = (cell) => cell === TICK

const cl = checklists[run.checklist]
let missing = 0
let wrongTick = 0
cl.sections.forEach((sec, si) => {
  if (!sheet.includes(`<td colspan="2">${esc(sec.title)}</td>`)) missing++
  sec.steps.forEach((step, ai) => {
    const cell = tickFor(sheet, step)
    if (cell === null) {
      missing++
      return
    }
    if (isChecked(cell) !== run.states[si].actions[ai].done) wrongTick++
  })
})
ok(missing === 0, `${missing} published steps or section headings are missing from the sheet`)
ok(wrongTick === 0, `${wrongTick} steps print a check that is not what the instructor recorded`)

// Named explicitly, because these two are the whole point of the assertion above.
ok(isChecked(tickFor(sheet, 'Recognizes VF')), 'a step the instructor checked prints a ✓')
ok(
  tickFor(sheet, 'Clears before analyze and shock') === '',
  'a step never checked leaves the cell empty, as it would be on paper',
)
ok(
  /VF Management/.test(sheet) && !/colspan="2">Ventricular fibrillation/.test(sheet),
  "sections are headed by the published title, not the scenario's own phase name",
)

// The Team Leader block, laid out as the form lays it out.
ok(
  /<td colspan="2">Team Leader\/Team Members<\/td>/.test(sheet),
  'the sheet opens with the Team Leader/Team Members band',
)
ok(
  isChecked(tickFor(sheet, 'Team Leader assigns team member roles')),
  'a checked team step prints a ✓',
)
ok(
  tickFor(sheet, 'Team Leader ensures that team members communicate well') === '',
  'an unchecked team step leaves the cell empty',
)
// The five CPR measures are one row across the form, not five rows down it.
ok(/Ensures high-quality<br>CPR at all times/.test(sheet), 'the CPR quality row is on the sheet')
ok(
  /Compression<br>rate 100-120\/min<br><span class="bx">&#9745;/.test(sheet),
  'a measured CPR box prints checked, in the form’s own wording',
)
ok(
  /Chest<br>recoil<br><span class="bx">&#9744;/.test(sheet),
  'and one that was not measured prints an empty box',
)
ok(/>82<\/span>%/.test(sheet) && />10<\/span>/.test(sheet), 'the written-in CPR numbers are on the sheet')

// The furniture that makes it the form rather than a report about it.
ok(/Student Name/.test(sheet) && /A\. Rivera/.test(sheet), 'the student is named at the head')
ok(/Date of Test/.test(sheet), 'the date of test is at the head')
ok(/Check if done<br>correctly/.test(sheet), 'the check column is headed as the form heads it')
ok(/background: #c9161d/.test(sheet), 'the section bands are the form’s red')
ok(/Learning Station Competency/.test(sheet), 'the Learning Station Competency block is printed')
ok(
  /© 2025 American Heart Association/.test(sheet),
  'and the copyright line the form carries',
)
ok(/STOP TEST/.test(sheet), 'STOP TEST separates the steps from the result')
const picked = (html, which) =>
  new RegExp(`(&#974[45];)</span> ${which}<`).exec(html)?.[1] === CHECKED
ok(picked(sheet, 'PASS') && !picked(sheet, 'NR'), 'PASS is checked and NR is not')
ok(/Instructor Initials[\s\S]{0,120}?JJ/.test(sheet), 'the instructor initials are on the sheet')
ok(/Instructor Number[\s\S]{0,120}?KS-114-2026/.test(sheet), 'and the instructor number')
ok(/American Heart Association/.test(sheet), 'the steps are attributed to their source')
ok(/facilitated by J\. Jones/.test(sheet), 'and the sheet says who ran it')
ok(!/undefined|NaN/.test(sheet), 'nothing prints as undefined or NaN')

// A result the instructor never circled must not become one on paper.
const noResult = megacodeSheetHTML({ ...run, result: null })
ok(
  !picked(noResult, 'PASS') && !picked(noResult, 'NR'),
  'a run with no result circled prints both boxes empty',
)

// A record from before the printed sheet existed: no section, no instructor.
const old = {
  ...run,
  instructorInitials: undefined,
  instructorNumber: undefined,
  states: run.states.map((s) => ({ ...s, section: undefined })),
}
const oldSheet = megacodeSheetHTML(old)
ok(!/undefined/.test(oldSheet), 'an older record prints without undefined anywhere')
const oldHeadings = [...oldSheet.matchAll(/class="sec"><td colspan="2">([^<]*)</g)].map((m) => m[1])
ok(
  oldHeadings.length === cl.sections.length + 1 && oldHeadings.every((h) => h.trim()),
  `every section still has a heading from the phase label — got ${JSON.stringify(oldHeadings)}`,
)
ok(
  oldHeadings.includes(run.states[1].label),
  `and it is the phase's own label — expected "${run.states[1].label}"`,
)

// Page one has to be the form and nothing else — it is what gets submitted.
ok(/@page \{ size: letter/.test(sheet), 'the sheet sets its own page so the table lands where the form’s does')
ok(
  sheet.trim().endsWith('</div>') && /aha-prov[\s\S]*$/.test(sheet.slice(sheet.indexOf('© 2025'))),
  'the copyright line and the stamp close the sheet',
)
// One page, and it stays one page: a submission is the sheet the training
// centre knows, and a second sheet stapled behind it is a thing to lose.
ok(!/page-break-before: always/.test(sheet), 'nothing on the sheet forces a second page')
ok(
  !/class="rec-notes"/.test(sheet) && !/Instructor notes/.test(sheet),
  'the debrief note is not on the sheet — it stays on the run in CES',
)
ok(
  megacodeSheetHTML({ ...run, notes: 'x'.repeat(4000) }).length -
    megacodeSheetHTML({ ...run, notes: '' }).length ===
    0,
  'and a long note cannot grow it',
)

// Anything typed by a person is data, not markup.
const nasty = megacodeSheetHTML({ ...run, crew: '<img src=x onerror=1>', notes: '<script>x()</script>' })
ok(!/<img|<script/i.test(nasty), 'a name or note containing markup is escaped')

// ---------------------------------------------------------------------------
// A quarterly scenario. No pass mark exists, so none is printed.
// ---------------------------------------------------------------------------
const { run: quarterly } = runMegacode('drowning_initial', (w) => {
  w.setRunField('crew', 'Med 7 — Boyd / Chen')
  w.applySimState('drowning', 0)
  w.toggleActionAt(0, 0)
})
ok(quarterly.scenario === 'drowning' && quarterly.states.length > 0, 'the quarterly run recorded its phases')
ok(!quarterly.checklist, 'and carries no checklist')
const record = scenarioRecordHTML(quarterly)
ok(/Simulation performance record/.test(record), 'a quarterly run prints as a performance record')
ok(!/PASS/.test(record) && !/STOP TEST/.test(record), 'with no result and no STOP TEST')
ok(!/Instructor Number/.test(record), 'and no instructor number — nothing is being certified')
ok(
  !/American Heart Association/.test(record) && /class="aha-t rec"/.test(record),
  'and none of the AHA form’s livery — a practice record must not read as a certification document',
)
ok(
  /Position the patient and suction the airway/.test(record),
  "the scenario's own expected actions are on it",
)
// The note the megacode sheet cannot carry is still printed here: this record
// is the program's own paperwork, not a submission, and can run to two pages.
const noted = scenarioRecordHTML({ ...quarterly, notes: 'Slow to suction; coached.' })
ok(/class="rec-notes"/.test(noted) && /Slow to suction/.test(noted), 'the record carries the debrief note')

// What the crew did at the defibrillator, on the paper the debrief is held
// from. It was on screen in the run detail and nowhere on the printout, which
// is the wrong way round for an arrest case: shock count and timing is the one
// objective measurement this simulator takes.
const withDevice = scenarioRecordHTML({
  ...quarterly,
  device: [
    { at: 42, type: 'shock', label: 'SHOCK', detail: '16J · 2 J/kg' },
    { at: 51, type: 'cpr', label: 'CPR RESUMED', detail: '' },
  ],
})
ok(/At the monitor/.test(withDevice), 'the record carries the device timeline')
ok(/0:42/.test(withDevice) && /16J · 2 J\/kg/.test(withDevice), 'with the clock and the energy')
ok(/1 shock/.test(withDevice), 'and counts the shocks')
ok(!/At the monitor/.test(record), 'a run with nothing at the monitor prints no empty timeline')
// The AHA sheet is a transcription of a published form and gains no rows it
// does not have; only the program's own record is ours to shape.
ok(!/At the monitor/.test(sheet), 'the AHA megacode sheet is left as the published form')

// The provenance line used to call every ungraded run a quarterly one. The
// PALS practice cases are neither quarterly nor ours.
ok(
  !/approved\s+for this quarter/.test(record),
  'the record does not claim every ungraded scenario is a quarterly one',
)

// A branch the run never took is not evidence about the crew.
//
// The PALS practice cases branch: case 11 goes to "Cardioverted" or to "No
// Cardioversion — Worsening Perfusion", never both, and the second only happens
// when the crew fails to cardiovert. Counting the untaken branch read a crew
// who did everything right as 11 of 14 and printed the branch they correctly
// never caused as a column of misses.
const branched = {
  ...quarterly,
  states: [
    { id: 'a', label: 'Unstable', seconds: 40, actions: [
      { text: 'Cardiovert at 0.5-1 J/kg', done: true },
      { text: 'Apply the monitor', done: true },
    ] },
    { id: 'b', label: 'No Cardioversion — Worsening Perfusion', seconds: 0, actions: [
      { text: 'Recognise worsening perfusion', done: false },
      { text: 'Cardiovert without further delay', done: false },
    ] },
    { id: 'c', label: 'Cardioverted — Sinus Rhythm', seconds: 30, actions: [
      { text: 'Reassess after conversion', done: true },
    ] },
  ],
}
const branchedHtml = scenarioRecordHTML(branched)
ok(/observed<\/span> 3 of 3/.test(branchedHtml), 'the untaken branch leaves the denominator')
ok(/No Cardioversion — Worsening Perfusion<\/td><td class="tick">not reached/.test(branchedHtml),
  'and is named as not reached rather than ruled off')
ok(!/Recognise worsening perfusion/.test(branchedHtml),
  'its actions are not printed as misses the crew never had the chance to commit')
ok(/branch this patient did not take/.test(branchedHtml), 'and the record says why it is not counted')
// A state that was entered still counts every action, ticked or not.
const entered = scenarioRecordHTML({
  ...branched,
  states: branched.states.map((st) => (st.id === 'b' ? { ...st, seconds: 25 } : st)),
})
ok(/observed<\/span> 3 of 5/.test(entered), 'a state the run DID enter keeps its unticked actions in the count')
ok(/Recognise worsening perfusion/.test(entered), 'and prints them')
// A tick inside a state entered and left within the same second still counts.
const sameSecond = scenarioRecordHTML({
  ...branched,
  states: branched.states.map((st) =>
    st.id === 'b' ? { ...st, actions: [{ ...st.actions[0], done: true }, st.actions[1]] } : st,
  ),
})
ok(/observed<\/span> 4 of 5/.test(sameSecond), 'a ticked action counts as having reached the state')

// Megacodes are sequential and keep the whole-scenario denominator: the "PASS
// with most of the critical actions unobserved" warning depends on it.
const shortMegacode = megacodeSheetHTML({
  ...run,
  states: run.states.map((st, i) => (i === run.states.length - 1 ? { ...st, seconds: 0, actions: st.actions.map((a) => ({ ...a, done: false })) } : st)),
})
ok(!/not reached/.test(shortMegacode), 'the AHA sheet is unchanged — every published step still prints')

ok(runSheetHTML(quarterly) === record, 'runSheetHTML picks the record for a quarterly run')
ok(runSheetHTML(run) === sheet, 'and the AHA sheet for a megacode')
ok(/Megacode Testing Checklist — A\. Rivera/.test(runSheetTitle(run)), 'the print title names the student')
ok(
  /^Megacode-checklist-A\. Rivera-\d{4}-\d{2}-\d{2}$/.test(runSheetFilename(run)),
  `the download filename is datestamped — got ${runSheetFilename(run)}`,
)

// Emit a rendered sample for the eye (not part of the pass/fail).
const DOC_CSS = `body{font-family:'Segoe UI',Arial,sans-serif;color:#111;margin:24px;font-size:12px}
h1{font-size:20px;margin:0 0 2px;color:#0b2e4f}h2{font-size:14px;margin:18px 0 6px;color:#0b2e4f;border-bottom:2px solid #0b2e4f;padding-bottom:3px}
table{border-collapse:collapse;width:100%;margin:6px 0 12px}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#e8eef5;font-size:11px}.meta td{border:none;padding:3px 6px 3px 0}`
const out = join(tmpdir(), 'ces-checkoff-sample.html')
writeFileSync(out, `<!doctype html><html><head><meta charset="utf-8"><style>${DOC_CSS}</style></head><body>${sheet}</body></html>`)
console.log(`check-checkoff: sample written to ${out}`)

if (fails.length) {
  console.error(`check-checkoff: ${fails.length} of ${checks} checks failed\n`)
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log(`check-checkoff: ${checks} checks passed`)
