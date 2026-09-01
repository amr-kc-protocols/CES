// Behaviour check for the simulator control panel.
//
// The control panel is a standalone page under public/simulator/ that an
// instructor drives while a second window shows the patient monitor. It has no
// build step and no framework, so nothing else in this repo would catch a
// regression in it. This script loads the real page in jsdom and drives it
// through the cases that were actually wrong at review time.
//
// What these assertions are protecting:
//
//   - Arrest rhythms reading a diastolic against a systolic of zero. The
//     "diastolic must be below systolic" rule used to rewrite 0/0 as 0/10, so
//     V-Fib, asystole and PEA all showed an impossible pressure the moment any
//     other slider moved — on the arrest scenarios, which is most of what this
//     tool is used to teach.
//   - The physiology lock rewriting vitals a scenario author wrote on purpose.
//     The pediatric TBI states carry HR 67 and 72 on a sinus bradycardia,
//     correct for a 5-year-old, and both were being dragged down to 60.
//   - The A-Line being a way around the lock. It mirrors the cuff, so writing
//     an arterial pressure onto a fibrillating patient put that pressure back
//     into the cuff reading too.
//   - Two medications given close together. Each drug used to capture live
//     vitals as its own baseline and restore them when it ended, so the second
//     drug adopted the first one's effect as the patient's normal state and
//     the patient never came back down — a hemorrhagic shock patient could end
//     the scenario permanently normotensive with nothing on board.
//   - A drug leaving a floor behind in arrest. The old clamp floors (SBP 40,
//     DBP 10, SpO2 50) meant epinephrine given during asystole wore off to
//     40/10 instead of back to 0/0.
//
// The monitor is checked the same way, plus one cross-file assertion that would
// have caught the worst of what this pass found: the control panel's damping
// select emits 'over' and 'under', while the monitor tested for 'overdamped'
// and 'underdamped', so two carefully built arterial waveforms were unreachable
// and the trace stayed normal whatever the instructor picked. Nothing in either
// file could notice that on its own — only something that reads both.
//
// Run: node scripts/check-simulator.mjs  (or `npm run check:sim`)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const PAGE = join(here, '..', 'public', 'simulator', 'control_panel.html')
const MONITOR = join(here, '..', 'public', 'simulator', 'patient_monitor_display.html')

let JSDOM
try {
  ;({ JSDOM } = await import('jsdom'))
} catch {
  // Not an error. The page ships as static HTML and does not need jsdom to
  // run; a checkout that has not installed dev dependencies should not fail
  // the aggregate check over it.
  console.log('check-simulator: jsdom not installed — skipping (npm install to enable)')
  process.exit(0)
}

const failures = []
let checks = 0
function ok(name, cond, detail = '') {
  checks++
  if (!cond) failures.push(detail ? `${name} — ${detail}` : name)
}

function load(file = PAGE) {
  const dom = new JSDOM(readFileSync(file, 'utf8'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://ces.local/simulator/control_panel.html',
  })
  const w = dom.window
  // Ending a run with gaps in it opens a prompt in the page — see endRun(). It
  // used to be window.confirm(), which jsdom answers false, aborting every
  // save. Tests that are not about the prompt end runs through endRunSaving()
  // below, which answers it; the prompt's own tests drive it directly.
  try { w.confirm = () => true } catch { /* non-writable in some builds */ }
  return {
    w,
    d: w.document,
    // `let S` is a lexical binding, not a property of window.
    S: () => w.eval('S'),
    text: (id) => w.document.getElementById(id)?.textContent,
  }
}

/** End a run, answering the gaps prompt if it appears. */
function endRunSaving(w) {
  w.endRun()
  const box = w.document.getElementById('endPrompt')
  if (box && !box.hidden) w.commitRun()
}

// ---------------------------------------------------------------------------
// Physiology lock
// ---------------------------------------------------------------------------
{
  const { w, d, S, text } = load()

  ok('state is published on load', !!w.localStorage.getItem('simState'))
  ok('PA readings are blank while the catheter is off', text('sgPA') === '--- / ---', text('sgPA'))
  ok('PA controls are disabled while the catheter is off', d.getElementById('sgSbp').disabled === true)

  for (const r of ['vfib', 'asystole']) {
    w.setR(r)
    w.sv('spo2', 90) // instructor moves an unrelated slider
    ok(`${r}: pressure stays 0/0`, S().sbp === 0 && S().dbp === 0, `${S().sbp}/${S().dbp}`)
    ok(`${r}: A-Line pinned with it`, S().artSbp === 0 && S().artDbp === 0, `${S().artSbp}/${S().artDbp}`)
  }

  // An arterial line cannot put a pressure back on a fibrillating patient.
  w.setR('vfib')
  w.sv('artSbp', 120)
  ok('V-Fib survives an A-Line drag', S().sbp === 0 && S().artSbp === 0, `NIBP ${S().sbp} ART ${S().artSbp}`)

  // PEA — an organised rhythm with no pulse.
  d.getElementById('scenarioSel').value = 'pea'
  w.applyScenario()
  w.sv('etco2', 6)
  ok('PEA holds 0/0', S().sbp === 0 && S().dbp === 0, `${S().sbp}/${S().dbp}`)
  ok('PEA keeps its own rate', S().hr === 56, String(S().hr))

  // Authored states are not second-guessed; a dragged HR still is.
  d.getElementById('simScenarioSel').value = 'peds_tbi_initial'
  w.applySimScenario()
  w.applySimState('peds_tbi', 1)
  w.sv('spo2', 98)
  ok('pediatric TBI keeps HR 67', S().hr === 67, String(S().hr))
  w.applySimState('peds_tbi', 2)
  w.sv('spo2', 87)
  ok('pediatric TBI keeps HR 72', S().hr === 72, String(S().hr))

  w.setR('brady')
  w.sv('hr', 130)
  ok('a dragged HR is still capped on bradycardia', S().hr === 60, String(S().hr))
  w.setR('tachy')
  w.sv('hr', 40)
  ok('a dragged HR is still floored on tachycardia', S().hr === 100, String(S().hr))

  // V-Tach constrains the pressure but must not pin EtCO2 and RR, which used
  // to make both sliders inert.
  w.setR('vtach')
  w.sv('etco2', 20)
  ok('EtCO2 is adjustable in V-Tach', S().etco2 === 20, String(S().etco2))
  w.sv('rr', 12)
  ok('RR is adjustable in V-Tach', S().rr === 12, String(S().rr))
  // Still capped, just not at a pressure that makes unstable-VT-with-a-pulse
  // unreachable — AHA Megacode 4 runs that patient at 84/54.
  w.sv('sbp', 200)
  ok('systolic is still capped in V-Tach', S().sbp === 110, String(S().sbp))
  w.sv('sbp', 84)
  w.sv('dbp', 54)
  ok('but a perfusing V-Tach is expressible', S().sbp === 84 && S().dbp === 54, `${S().sbp}/${S().dbp}`)

  // EtCO2 in arrest reflects compression quality and must stay free.
  w.setR('vfib')
  w.sv('etco2', 22)
  ok('EtCO2 is adjustable during a worked arrest', S().etco2 === 22, String(S().etco2))
  ok('and the arrest itself still holds 0/0', S().sbp === 0 && S().dbp === 0, `${S().sbp}/${S().dbp}`)
  w.close()
}

// ---------------------------------------------------------------------------
// Panel and monitor agree
// ---------------------------------------------------------------------------
{
  const { w, d, S, text } = load()

  d.getElementById('simScenarioSel').value = 'asthma_initial'
  w.applySimScenario()
  ok('a sim that sets the capnogram moves the select', d.getElementById('co2ShapeSel').value === 'shark')
  ok('a sim that sets the patient type moves the select', d.getElementById('patientTypeSel').value === 'Adult')
  d.getElementById('simScenarioSel').value = 'peds_tbi_initial'
  w.applySimScenario()
  ok('pediatric sims set the patient type', d.getElementById('patientTypeSel').value === 'Pediatric')

  w.toggleArt()
  d.getElementById('scenarioSel').value = 'normal'
  w.applyScenario()
  w.sv('sbp', 160)
  w.sv('dbp', 90)
  ok('arterial readout follows the cuff while linked', text('arBP') === '160 / 90', text('arBP'))
  ok('MAP is recomputed with it', text('arMAP') === String(Math.round((160 + 2 * 90) / 3)), text('arMAP'))

  // The damping labels are keyed by the select's own values.
  w.sv('artDamping', 'over')
  w.refreshArt()
  ok('overdamped reads as overdamped', text('arDamp').startsWith('Overdamped'), text('arDamp'))
  w.sv('artDamping', 'under')
  w.refreshArt()
  ok('underdamped reads as underdamped', text('arDamp').startsWith('Underdamped'), text('arDamp'))

  // An A-Line set independently is the instructor's, not the scenario's.
  w.toggleArtLink()
  w.sv('artSbp', 200)
  w.sv('artDbp', 100)
  d.getElementById('scenarioSel').value = 'shock'
  w.applyScenario()
  ok('an unlinked A-Line survives a scenario', S().artSbp === 200 && S().artDbp === 100, `${S().artSbp}/${S().artDbp}`)

  w.muteAlm()
  ok('mute shows as muted', d.getElementById('almMute').className.includes('off') && text('almMute') === 'MUTED')
  w.close()
}

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------
{
  const { w, d, S } = load()

  // The engine reads performance.now() and nothing else, so time is drivable.
  let T = 0
  Object.defineProperty(w.performance, 'now', { value: () => T, configurable: true })
  const advance = (ms) => {
    T += ms
    w.drugTick()
  }

  d.getElementById('simScenarioSel').value = 'abdominal_trauma_initial'
  w.applySimScenario()
  const base = { hr: S().hr, sbp: S().sbp, dbp: S().dbp }

  w.giveDrug('push_epi') // 45s
  advance(22000)
  ok('push-dose epi raises rate and pressure', S().hr > base.hr && S().sbp > base.sbp, `HR ${S().hr} SBP ${S().sbp}`)
  advance(24000)
  ok(
    'and wears off to the patient it started from',
    S().hr === base.hr && S().sbp === base.sbp && S().dbp === base.dbp,
    `HR ${S().hr} BP ${S().sbp}/${S().dbp}`,
  )

  // Two drugs overlapping — the case that used to leave the patient healthy.
  T = 0
  w.giveDrug('push_epi')
  advance(20000)
  w.giveDrug('fluid_nacl')
  for (let i = 0; i < 40; i++) advance(5000)
  ok(
    'overlapping drugs both wear off to the untreated patient',
    S().hr === base.hr && S().sbp === base.sbp && S().dbp === base.dbp,
    `HR ${S().hr} BP ${S().sbp}/${S().dbp} — expected HR ${base.hr} BP ${base.sbp}/${base.dbp}`,
  )
  ok('the tick timer stops when nothing is on board', w.eval('drugTimer') === null)

  // Infusions taper rather than snapping back at the end of their duration.
  T = 0
  w.giveDrug('norepinephrine') // 120s
  advance(60000)
  const midSbp = S().sbp
  ok('norepinephrine raises the pressure', midSbp > base.sbp, `SBP ${midSbp}`)
  advance(54000)
  ok('it is already tapering before it ends', S().sbp < midSbp && S().sbp > base.sbp, `SBP ${S().sbp}`)
  advance(10000)
  ok('and ends exactly at baseline', S().sbp === base.sbp, `SBP ${S().sbp}`)

  // Arrest — a pressor is on board but cannot manufacture perfusion. It stays
  // 0/0 throughout, not a clamp floor and not a drug-driven pressure: a
  // saturation, a blood pressure and a perfusing rate appear only when the
  // facilitator establishes a perfusing rhythm (ROSC).
  T = 0
  w.setR('asystole')
  w.giveDrug('epi_acls')
  advance(45000)
  ok('a pressor produces no pressure on a pulseless patient', S().sbp === 0 && S().dbp === 0, `${S().sbp}/${S().dbp}`)
  ok('and does not lift the electrical rate either', S().hr === 0, `HR ${S().hr}`)
  advance(50000)
  ok('and it is still 0/0 as it wears off', S().sbp === 0 && S().dbp === 0, `${S().sbp}/${S().dbp}`)

  // But the same pressor on a perfusing patient (a driven ROSC) does work.
  T = 0
  w.setR('nsr')
  d.getElementById('scenarioSel').value = 'normal'
  w.applyScenario()
  const roscBase = S().sbp
  w.giveDrug('epi_acls')
  advance(45000)
  ok('a pressor works once the patient is perfusing', S().sbp > roscBase, `SBP ${S().sbp} from ${roscBase}`)
  advance(50000)
  ok('and wears off to the perfusing baseline', S().sbp === roscBase, `SBP ${S().sbp}`)

  // STOP holds the current numbers and cancels what is still running.
  T = 0
  w.setR('nsr')
  d.getElementById('scenarioSel').value = 'normal'
  w.applyScenario()
  w.giveDrug('push_epi')
  advance(20000)
  const frozen = { hr: S().hr, sbp: S().sbp }
  w.toggleDrugHold()
  advance(60000)
  ok('STOP holds the vitals where it was pressed', S().hr === frozen.hr && S().sbp === frozen.sbp, `HR ${S().hr} SBP ${S().sbp}`)
  ok('and leaves nothing circulating', w.eval('activeDrugs').length === 0 && w.eval('drugTimer') === null)

  // Moving the scenario on is a new patient state, not a drugged one.
  T = 0
  w.giveDrug('norepinephrine')
  advance(30000)
  w.applySimState('abdominal_trauma', 0)
  ok('applying a sim state clears drugs on board', w.eval('activeDrugs').length === 0)
  ok('and lands on that state\'s own vitals', S().sbp === 78 && S().hr === 132, `HR ${S().hr} SBP ${S().sbp}`)
  w.close()
}

// ---------------------------------------------------------------------------
// The monitor
//
// It draws to canvas, which jsdom does not implement. Everything asserted here
// is the arithmetic behind the trace rather than the pixels, so a no-op 2D
// context is enough to let the page finish loading.
// ---------------------------------------------------------------------------
const MONITOR_SRC = readFileSync(MONITOR, 'utf8')

/**
 * The monitor page, with the unit powered on.
 *
 * It now opens OFF — the crew pressing ON is part of what a megacode watches —
 * so every test that drives a key, a menu or a shock has to power it up first,
 * exactly as a crew would. `powerOn: false` gets the page as it actually opens,
 * which is what the power tests want.
 */
function loadMonitor(storage = {}, { powerOn = true } = {}) {
  // A no-op 2D context, installed before the page's script runs. Letting the
  // page execute as a real script (rather than eval'ing it afterwards) is what
  // keeps its top-level `let S` reachable from here.
  const stub = new Proxy({}, { get: (_, k) => (k === 'canvas' ? {} : () => {}), set: () => true })
  const dom = new JSDOM(MONITOR_SRC, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://ces.local/simulator/patient_monitor_display.html',
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => stub
      for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v)
    },
  })
  const w = dom.window
  if (powerOn) w.setPower(true)
  return { w, d: w.document, S: () => w.eval('S') }
}

{
  const { w, S } = loadMonitor()

  // The trace has to distinguish every damping value the control panel can send.
  const panelSrc = readFileSync(PAGE, 'utf8')
  const dampBlock = panelSrc.slice(panelSrc.indexOf('id="artDampSel"'))
  const dampOptions = [...dampBlock.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]).slice(0, 3)
  ok('control panel still offers three damping settings', dampOptions.length === 3, dampOptions.join(','))

  const sArt = w.eval('sArt')
  const curve = () => {
    const out = []
    for (let i = 0; i < 120; i++) out.push(sArt((i / 120) * (60 / 78)).toFixed(4))
    return out.join(',')
  }
  Object.assign(S(), {
    patientConnected: true, hr: 78, rhythm: 'nsr',
    artActive: true, artSbp: 120, artDbp: 60, artScale: 180, artDamping: 'normal',
  })
  const normal = curve()
  for (const opt of dampOptions.filter((o) => o !== 'normal')) {
    S().artDamping = opt
    ok(`damping "${opt}" reaches the monitor`, curve() !== normal, 'renders identically to normal')
  }

  // Per-lead transform: overall amplitude applied once, not squared.
  const applyLeadCfg = w.eval('applyLeadCfg')
  const got = applyLeadCfg(0.6, 0.3, { amp: 0.5, pAmp: 1, rAmp: 1, tAmp: 1, sDeep: 0 }) - 0.5
  ok('lead amplitude is applied once on the ST segment', Math.abs(got - 0.05) < 1e-9, `got ${got.toFixed(4)}, expected 0.0500`)

  // The PA trace has to agree with the PA numbers printed beside it.
  Object.assign(S(), { patientConnected: true, sgActive: true, sgMode: 'pa', sgSbp: 25, sgDbp: 10, sgScale: 40, hr: 78 })
  const sPA = w.eval('sPA')
  let lo = 1, hi = 0
  for (let i = 0; i < 400; i++) { const v = sPA((i / 400) * (60 / 78)); lo = Math.min(lo, v); hi = Math.max(hi, v) }
  ok('PA waveform bottoms out at the entered diastolic', Math.round(lo * 40) === 10, `renders ${(lo * 40).toFixed(1)} for an entered 10`)
  ok('PA waveform peaks at the entered systolic', Math.round(hi * 40) === 25, `renders ${(hi * 40).toFixed(1)} for an entered 25`)

  // Changing the lead has to do something in every rhythm, not just sinus.
  const sEcg = w.eval('sEcg')
  const trace = () => { const a = []; for (let i = 0; i < 200; i++) a.push(sEcg(i / 60).toFixed(4)); return a.join(',') }
  for (const rhythm of ['nsr', 'afib', 'paced', 'hb2']) {
    Object.assign(S(), { patientConnected: true, hr: 78, rhythm, lead: 'II', pvcOn: false, pacOn: false })
    const leadII = trace()
    S().lead = 'aVR'
    ok(`lead selection changes the ${rhythm} trace`, trace() !== leadII, 'aVR renders identically to lead II')
  }

  // A disconnected monitor must not draw a flat line that reads as asystole.
  S().patientConnected = false
  ok('disconnected ECG draws nothing', sEcg(1) === null, `returned ${sEcg(1)}`)
  w.close()
}

{
  // A 12-lead command is a timestamped one-shot; localStorage outlives it.
  const { w } = loadMonitor({ simCmd12Lead: 'open:' + (Date.now() - 86400000) })
  ok("yesterday's 12-lead command does not replay on load", w.eval('lastCmdT') > 0, 'high-water mark left at zero')
  w.close()
}

// ---------------------------------------------------------------------------
// Facilitating and grading in one pass
//
// The quarterly scenarios come from Medical Director-approved Word documents
// whose only gradeable content is an "Expected Actions" column. What is checked
// here is that the transcription stays in step with the vitals table it sits
// beside, and that a run produces the record a debrief is read from.
// ---------------------------------------------------------------------------
{
  const { w, d, S } = load()

  const docs = w.eval('SCENARIO_DOCS')
  const sims = w.eval('SIMULATIONS')

  ok('the graded scenarios are the quarterly ones', Object.keys(docs).length >= 2, Object.keys(docs).join(','))

  for (const key of Object.keys(docs)) {
    ok(`${key}: scenario exists`, !!sims[key])
    if (!sims[key]) continue
    // A state without its actions grades as a blank; a stray action list means
    // the transcription and the vitals table have drifted apart.
    ok(
      `${key}: one action list per state`,
      docs[key].states.length === sims[key].states.length,
      `${docs[key].states.length} action lists for ${sims[key].states.length} states`,
    )
    ok(`${key}: every state carries a transition trigger`, docs[key].states.every((st) => !!st.trigger))
    ok(`${key}: every state carries at least one expected action`, docs[key].states.every((st) => st.actions.length > 0))
    const b = docs[key].brief
    // A hand-off report only exists where somebody hands the patient over. The
    // ACLS megacodes are mostly scene calls with no prior provider, so it is
    // optional; the rest of the brief is what a facilitator cannot run without.
    for (const field of ['patient', 'dispatch', 'primary', 'secondary'])
      ok(`${key}: brief carries ${field}`, !!b[field])
    ok(`${key}: SAMPLE has all six elements`, b.sample.length === 6, String(b.sample.length))
  }

  // Anything that starts hidden must actually be hidden. A class rule that sets
  // a `display` outranks the user agent's `[hidden] { display: none }`, so the
  // element renders open — which is what had the scenario brief unfolding to
  // 613px on load and pushing the run off the bottom of every laptop screen.
  //
  // Checked against the stylesheet source rather than a computed style: jsdom
  // resolves `hidden` but not the class rule that beats it, so getComputedStyle
  // reports 'none' either way and can never see this.
  {
    const src = readFileSync(PAGE, 'utf8')
    const css = src.slice(src.indexOf('<style>'), src.indexOf('</style>'))
    for (const el of d.querySelectorAll('[hidden]')) {
      for (const cls of el.classList) {
        const rule = new RegExp(`\\.${cls}\\s*\\{[^}]*display\\s*:`)
        if (!rule.test(css)) continue
        ok(
          `.${cls} starts hidden despite setting a display`,
          css.includes(`.${cls}[hidden]`),
          `.${cls} sets a display, so [hidden] does not hide it — add .${cls}[hidden]{display:none}`,
        )
      }
    }
  }

  // Loading a quarterly scenario starts a run; the quick presets do not, since
  // no approved action list stands behind them.
  d.getElementById('simScenarioSel').value = 'asthma_initial'
  w.applySimScenario()
  ok('applying a quarterly scenario starts a run', !!w.eval('run'))
  ok('the run names the scenario', w.eval('run').scenario === 'asthma')
  ok('the run has a state per scenario state', w.eval('run').states.length === sims.asthma.states.length)

  // Ticking is the grading.
  w.applySimState('asthma', 1)
  w.toggleAction(0)
  w.toggleAction(2)
  ok('ticking marks the action done', w.eval('run').states[1].actions.filter((a) => a.done).length === 2)
  w.toggleAction(0)
  ok('ticking again clears it', w.eval('run').states[1].actions.filter((a) => a.done).length === 1)

  // Time follows the patient, not the wall clock of the whole session.
  ok('the state being run is the one being graded', w.eval('run').current === 1)

  w.setRunField('crew', 'Med 3 — Alvarez / Boyd')
  endRunSaving(w)
  const rec = w.eval('lastRun')
  ok('ending a run produces a record', !!rec)
  ok('the record keeps the crew', rec.crew === 'Med 3 — Alvarez / Boyd')
  ok('the record keeps the scenario name for later reading', /Asthma/.test(rec.scenarioName))
  ok('the record carries every state', rec.states.length === sims.asthma.states.length)
  ok(
    'the record carries what was and was not done',
    rec.states[1].actions.some((a) => a.done) && rec.states[1].actions.some((a) => !a.done),
  )
  ok('the run is closed once ended', w.eval('run') === null)

  // A quick preset is a vitals preset, not an assessment.
  w.eval('lastRun = null')
  d.getElementById('scenarioSel').value = 'shock'
  w.applyScenario()
  ok('a quick scenario starts no run', w.eval('run') === null)
  ok('and applies its vitals anyway', S().sbp === 78 && S().hr === 125, `${S().hr} ${S().sbp}`)
  w.close()
}

// ---------------------------------------------------------------------------
// ACLS megacodes
//
// These differ from the quarterly scenarios in one important way: the AHA
// Megacode Testing Checklist IS an approved instrument, with critical
// performance steps and a PASS / NR outcome. So the steps must come from the
// checklist rather than a hand-copy beside it, and the manual's own vitals must
// survive the physiology lock — two of them did not before these scenarios
// existed, which is why the lock was loosened.
// ---------------------------------------------------------------------------
{
  const { w, d, S } = load()
  const sims = w.eval('SIMULATIONS')
  const docs = w.eval('SCENARIO_DOCS')
  const cls = w.eval('ACLS_CHECKLISTS')

  const megacodes = Object.keys(sims).filter((k) => sims[k].checklist)
  ok('the ACLS megacodes are loaded', megacodes.length === 5, megacodes.join(','))

  for (const key of megacodes) {
    const cl = cls[sims[key].checklist]
    ok(`${key}: names a published checklist`, !!cl, sims[key].checklist)
    if (!cl) continue
    ok(
      `${key}: a checklist section per rhythm phase`,
      cl.sections.length === sims[key].states.length,
      `${cl.sections.length} sections for ${sims[key].states.length} states`,
    )
    // The AHA steps must have exactly one home. This does not detect drift
    // between two copies — there is only one copy, which is the point. What it
    // guards is that the derivation is still wired: remove it and the megacodes
    // fall back to whatever is hand-written beside them, which is how a run
    // ends up graded against something other than the published instrument.
    const derived = docs[key].states.every((st, i) => {
      const steps = cl.sections[i].steps
      return st.actions.length === steps.length && st.actions.every((a, j) => a === steps[j])
    })
    ok(`${key}: expected actions come from the checklist verbatim`, derived)
    ok(`${key}: every phase ends in Post–Cardiac Arrest Care`, /Post–Cardiac Arrest Care/.test(cl.sections[cl.sections.length - 1].title))
  }

  // The manual's numbers, which the physiology lock used to overwrite.
  const m4 = sims.megacode4.states
  ok('Megacode 4 keeps unstable VT with a pulse at 84/54', m4[0].vitals.sbp === 84 && m4[0].vitals.dbp === 54)
  ok('Megacode 4 keeps EtCO2 25 during the worked VF arrest', m4[1].vitals.etco2 === 25)
  ok('Megacode 2 keeps EtCO2 22 during the worked VF arrest', sims.megacode2.states[1].vitals.etco2 === 22)
  ok('Megacode 3 keeps EtCO2 48 in PEA', sims.megacode3.states[2].vitals.etco2 === 48)

  // Applying one has to actually produce those numbers through the lock.
  d.getElementById('simScenarioSel').value = 'megacode4'
  w.applySimScenario()
  ok('applying Megacode 4 gives the manual vitals', S().hr === 150 && S().sbp === 84 && S().dbp === 54, `${S().hr} ${S().sbp}/${S().dbp}`)
  w.applySimState('megacode4', 1)
  ok('and its VF phase keeps EtCO2 on CPR', S().etco2 === 25 && S().sbp === 0, `EtCO2 ${S().etco2} BP ${S().sbp}`)

  // The run-level half of the checklist exists for megacodes only.
  const run = () => w.eval('run')
  ok('a megacode run carries the team steps', (run().team || []).length === 2)
  ok('a megacode run carries the CPR quality block', !!run().cpr)
  ok('a megacode run starts with no result circled', run().result === null)
  w.setResult('pass')
  ok('PASS can be recorded', run().result === 'pass')
  w.setResult('pass')
  ok('and clicking it again clears it, for a mis-tap', run().result === null)
  w.setResult('nr')
  w.toggleTeam(0)
  w.toggleCpr('rate')
  w.setCpr('fraction', '82')
  endRunSaving(w)
  const rec = w.eval('lastRun')
  ok('the record carries the result', rec.result === 'nr', String(rec.result))
  ok('the record carries the team assessment', rec.team[0].done === true)
  ok('the record carries CPR quality', rec.cpr.rate === true && rec.cpr.fraction === '82')
  ok('the record names the checklist it was graded against', /Scenarios 4\/7\/10/.test(rec.checklistName), rec.checklistName)

  // A quarterly scenario has none of it — its documents define no outcome.
  w.eval('lastRun = null')
  d.getElementById('simScenarioSel').value = 'asthma_initial'
  w.applySimScenario()
  ok('a quarterly run carries no checklist', run().checklist === null)
  ok('and no PASS / NR', run().team === null && run().cpr === null)
  w.close()
}

// ---------------------------------------------------------------------------
// The LIFEPAK 15 skin: the unit, and what it is allowed to touch.
//
// The whole design rests on one boundary. The crew works the defibrillator;
// the facilitator works the patient. If the monitor ever writes a rhythm, a
// pressure or a saturation, there are two sources of truth for what the
// patient is doing and the scenario stops being drivable — so the first check
// here runs a full resuscitation on the device and asserts that not one field
// of S moved.
//
// The rest are the behaviours a crew is actually being taught: that a shock
// needs a charge, that changing energy throws the charge away, that an
// unarmed shock button does nothing, and that a unit with no electrodes on
// says so rather than advising against a shock it cannot see.
// ---------------------------------------------------------------------------
{
  const { w, S } = loadMonitor()
  const D = () => w.eval('D')
  const call = (fn) => w.eval(fn)

  Object.assign(S(), {
    patientConnected: true, hr: 180, rhythm: 'vtach', sbp: 0, dbp: 0,
    spo2: 4, etco2: 18, rr: 0, temp: 35.1, lead: 'II', alarmOn: true,
  })
  // --- charge and shock ----------------------------------------------------
  ok('the unit starts unarmed', D().charged === false && D().charging === false)

  call('deliverShock()')
  ok('an unarmed shock button delivers nothing', D().shocks === 0, `${D().shocks} shocks`)

  call('startCharge()')
  ok('CHARGE begins charging', D().charging === true)
  ok('and charging is not the same as charged', D().charged === false)

  // Jump the clock rather than waiting five seconds for it.
  w.eval('D.chargeStart = Date.now() - CHARGE_MS - 1; devTick()')
  ok('the charge completes', D().charged === true && D().charging === false)

  call('deliverShock()')
  ok('an armed shock button delivers', D().shocks === 1, `${D().shocks} shocks`)
  ok('and leaves the unit disarmed', D().charged === false)

  // Changing the energy after charging throws the charge away, as the unit
  // does — a crew that dials 360 expecting the 200 in the capacitor to follow
  // is being taught something false.
  call('startCharge()')
  w.eval('D.chargeStart = Date.now() - CHARGE_MS - 1; devTick()')
  ok('charged again', D().charged === true)
  call('nudgeEnergy(1)')
  ok('changing energy disarms the charge', D().charged === false)

  // And it disarms itself if nobody shocks.
  call('startCharge()')
  w.eval('D.chargeStart = Date.now() - CHARGE_MS - 1; devTick()')
  w.eval('D.disarmAt = Date.now() - 1; devTick()')
  ok('an unused charge disarms itself', D().charged === false)

  // --- rhythm advisory -----------------------------------------------------
  const advise = () => { w.eval('D.analyzing = true; D.analyzeUntil = 0; finishAnalyze()'); return D().advisory }
  ok('shockable rhythm advises a shock', advise() === 'SHOCK ADVISED', D().advisory)
  S().rhythm = 'asystole'
  ok('asystole advises against one', advise() === 'NO SHOCK ADVISED', D().advisory)
  S().patientConnected = false
  ok(
    'no electrodes is its own answer, not "no shock advised"',
    advise() === 'CONNECT ELECTRODES',
    D().advisory,
  )
  S().patientConnected = true
  S().rhythm = 'vtach'

  // --- lead, size, pacing --------------------------------------------------
  const devLead = w.eval('devLead')
  ok('the lead starts as the panel set it', devLead() === 'II', devLead())
  w.eval("takeLead(); D.leadIx = 2")
  ok('pressing LEAD changes the displayed lead', devLead() === 'III', devLead())
  S().lead = 'aVF'
  ok('and the facilitator changing lead takes it back', devLead() === 'aVF', devLead())

  // Size is display gain: it scales around the baseline, so it cannot turn a
  // flat line into a complex or the other way round.
  const sEcgDev = w.eval('sEcgDev')
  w.eval('D.sizeIx = SIZES.indexOf(1.0)')
  const at1 = sEcgDev(0.14)
  w.eval('D.sizeIx = SIZES.indexOf(2.0)')
  const at2 = sEcgDev(0.14)
  ok(
    'ECG size doubles the deflection about the baseline',
    Math.abs((at2 - 0.5) - 2 * (at1 - 0.5)) < 1e-9,
    `${at1.toFixed(4)} then ${at2.toFixed(4)}`,
  )
  w.eval('D.sizeIx = SIZES.indexOf(1.0)')

  // Pacing spikes are the unit's own output and appear as soon as current is
  // set. Capture is the patient's answer to them and is not the unit's to give.
  w.eval('D.pacer = true; D.pacerMa = 0; D.pacerRate = 60')
  const spikeAt = (t) => sEcgDev(t)
  ok('no spike at zero current', Math.abs(spikeAt(0) - sEcgDev(0)) < 1e-9)
  w.eval('D.pacerMa = 70')
  ok('current produces a pacing spike', spikeAt(0) > 0.9, String(spikeAt(0)))
  ok('and it is a spike, not a level', spikeAt(0.5) < 0.9, String(spikeAt(0.5)))
  w.eval('D.pacer = false; D.pacerMa = 0')

  // --- Area 4 -------------------------------------------------------------
  // Table 3-4 gives PRINT as "starts and stops printer", which makes it a
  // toggle. It shipped as a one-shot burst like the two record keys beside it,
  // so a crew could not run a strip and could not stop one either.
  ok('PRINT starts the printer', (call('printerRun(true)'), D().printing === true))
  ok('and PRINT stops it again', (call('printerRun(false)'), D().printing === false))
  ok(
    'the record keys print without latching the strip on',
    (w.eval('printerBurst(10)'), D().printing === false),
  )

  w.close()
}

{
  // The boundary, on its own page so nothing this script does to S can be
  // mistaken for something the device did. A whole resuscitation is run
  // through the unit — charge, shock, analyze, pace, print, alarms, lead —
  // and afterwards the patient must be byte-for-byte what the facilitator
  // left. This is the check that fails the day somebody makes the shock
  // button convert the rhythm "just to make the demo look right".
  const { w, S } = loadMonitor()
  Object.assign(S(), {
    patientConnected: true, hr: 180, rhythm: 'vfib', sbp: 0, dbp: 0,
    spo2: 4, etco2: 18, rr: 0, temp: 35.1, lead: 'II', alarmOn: true,
  })
  const before = JSON.stringify(S())
  w.eval(`
    startCharge(); D.chargeStart = Date.now() - CHARGE_MS - 1; devTick(); deliverShock();
    D.analyzing = true; D.analyzeUntil = 0; finishAnalyze();
    D.cpr = true; takeLead(); D.leadIx = 4; D.sizeIx = 4;
    D.pacer = true; nudgeRate(1); nudgeMa(3);
    startNibp(); D.silenceUntil = Date.now() + 1000; D.alarms = false;
    D.sunvue = true; devTick();
  `)
  const changed = []
  const a = JSON.parse(before), b = w.eval('S')
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) changed.push(k)
  ok('nothing the crew pressed changed the patient', changed.length === 0, changed.join(','))
  ok('the crew did press things', w.eval('D.log.length') > 5, `${w.eval('D.log.length')} events`)
  w.close()
}

{
  // The LED assertions need a live page: these are behaviours, not stylesheet
  // values, and every one of them failed before this pass.
  const { w } = loadMonitor()
  const call = (fn) => w.eval(fn)
// ---- LED behaviour, as Tables 3-1 to 3-3 describe it --------------------
// The manual is precise about these and the distinctions matter to a crew:
// an LED that is "illuminated" is not one that "flashes", and one that
// "flashes with detection of each QRS" is driven by the patient rather than
// by a timer. All six of the assertions below failed before this pass.
const cls = (id) => {
  const e = w.document.getElementById(id)
  return e ? [...e.classList].filter((c) => c !== 'led').sort().join('+') || 'off' : 'MISSING'
}
const tick = () => call('devTick()')

// "LED illuminated when AED is analyzing the ECG, and flashes when user is
// prompted to push ANALYZE." Two states, two behaviours.
w.eval('D.analyzing = true; D.analyzeUntil = Date.now() + 9e5; D.reanalyzeAt = 0')
tick()
ok('ANALYZE is illuminated while analyzing', cls('ledANALYZE') === 'on', cls('ledANALYZE'))
w.eval('D.analyzing = false; D.reanalyzeAt = Date.now() - 1')
tick()
ok('and flashes when a rhythm check is due', cls('ledANALYZE') === 'flash', cls('ledANALYZE'))
w.eval('D.reanalyzeAt = Date.now() + 9e5')
tick()
ok('and is dark in between', cls('ledANALYZE') === 'off', cls('ledANALYZE'))

// "LED illuminated when alarms are enabled and flashes when an alarm
// condition occurs." Silencing is not disabling — the LED going dark told a
// crew the alarms were off when they had two minutes of quiet.
w.eval('D.alarms = true; D.silenceUntil = Date.now() + 6e4')
tick()
ok('ALARMS stays illuminated while silenced', cls('ledALARMS') === 'amber', cls('ledALARMS'))
w.eval('D.alarms = false; D.silenceUntil = 0')
tick()
ok('and is dark when alarms are off', cls('ledALARMS') === 'off', cls('ledALARMS'))
w.eval('D.alarms = true; almBreaching = true')
tick()
ok('and flashes on an alarm condition', cls('ledALARMS').includes('flash'), cls('ledALARMS'))
w.eval('almBreaching = false')

// "Flashes with detection of each QRS." A detector, not a timer: it runs on
// the samples the trace is drawn from, so it finds nothing in a flat line.
const scanQrs = w.eval('scanQrs')
const spx = 125
const beats = (rateBpm, seconds) => {
  // A synthetic trace: baseline with a narrow spike once per beat.
  w.eval('qrsArmed = true; qrsLastT = -1')
  const n = Math.round(seconds * spx)
  const per = 60 / rateBpm
  let found = 0
  for (let i = 0; i < n; i += 64) {
    const chunk = []
    for (let j = i; j < Math.min(i + 64, n); j++) {
      const t = j / spx
      const phase = ((t % per) + per) % per
      chunk.push(phase < 0.03 ? 0.95 : 0.5)
    }
    found += scanQrs(chunk, i / spx, spx)
  }
  return found
}
ok('QRS detection tracks 60/min', beats(60, 10) === 10, `${beats(60, 10)} in 10s`)
ok('and 150/min', beats(150, 10) === 25, `${beats(150, 10)} in 10s`)
const flat = (() => {
  w.eval('qrsArmed = true; qrsLastT = -1')
  return scanQrs(new Array(1200).fill(0.5), 0, spx)
})()
ok('and finds nothing in a flat line', flat === 0, `${flat} detections on a flat trace`)
const noTrace = (() => {
  w.eval('qrsArmed = true; qrsLastT = -1')
  return scanQrs(new Array(1200).fill(null), 0, spx)
})()
ok('and nothing at all with the patient disconnected', noTrace === 0, `${noTrace} detections`)
// Refractory blanking: a complex with a rebound must count once, not twice.
const doubled = (() => {
  w.eval('qrsArmed = true; qrsLastT = -1')
  const n = 10 * spx, per = 60 / 150
  const out = []
  for (let j = 0; j < n; j++) {
    const ph = ((j / spx) % per + per) % per
    out.push(ph < 0.03 || (ph > 0.05 && ph < 0.075) ? 0.95 : 0.5)
  }
  return scanQrs(out, 0, spx)
})()
ok(
  'a complex with a rebound is one detection, not two',
  doubled === 25,
  `${doubled} detections where 25 beats occurred`,
)

// "Flashes with each current pulse" — the pacer's own clock, so the LED and
// the spikes on the trace cannot disagree.
const pacePulsed = w.eval('pacePulsed')
const paces = (rate, ma, seconds) => {
  w.eval(`D.pacer = true; D.pacerMa = ${ma}; D.pacerRate = ${rate}; D.pacePaused = false; lastPacePhase = 1`)
  let n = 0
  for (let i = 0; i < seconds * 200; i++) if (pacePulsed(i / 200)) n++
  return n
}
ok('pacing pulses at the set rate', paces(60, 70, 10) === 10, `${paces(60, 70, 10)} in 10s at 60ppm`)
ok('and follows the rate up', paces(120, 70, 10) === 20, `${paces(120, 70, 10)} in 10s at 120ppm`)
ok('and stops at zero current', paces(60, 0, 10) === 0, `${paces(60, 0, 10)} pulses with no current`)
// "Temporarily slows pacing rate", Table 3-2.
w.eval('D.pacer = true; D.pacerMa = 70; D.pacerRate = 80; D.pacePaused = true; lastPacePhase = 1')
let paused = 0
for (let i = 0; i < 2000; i++) if (pacePulsed(i / 200)) paused++
ok('PAUSE slows the pacing rate', paused === 4, `${paused} in 10s at 80ppm paused — a quarter of 13`)
w.eval('D.pacer = false; D.pacerMa = 0; D.pacePaused = false')

// ---- the alarm tone ----------------------------------------------------
// A browser will not start audio until the page has been interacted with, and
// nothing guarantees anyone has touched the monitor window before a parameter
// goes out of range. So the tone is gated on being armed, and the notice
// saying it is not armed is itself the control that arms it — an alarm that is
// silent until someone happens to click the screen is worse than one that is
// honestly visual, because a crew learns to trust a sound that may never come.
call('audioArmed = false; alarmTone(false)')
call('alarmTone(true)')
ok('an unarmed page stays silent', w.eval('!almTimer'), 'a tone nobody could hear was started')
call('audioArmed = true; alarmTone(true)')
ok('and sounds once armed', w.eval('!!almTimer'))
call('alarmTone(false)')
ok('and stops when the breach clears', w.eval('!almTimer'))
ok('the notice is the control that arms it', /id="armAudio" onclick="armAudio\(\)"/.test(MONITOR_SRC))
ok('and it stands down once armed', /#armAudio\.armed\{opacity:0/.test(MONITOR_SRC))
ok(
  'pressing any key on the unit arms it too',
  /addEventListener\('click',e=>\{e\.preventDefault\(\);armAudio\(\);/.test(MONITOR_SRC),
)

// The tone follows the banner exactly: both mute paths silence both.
const alarmState = (patch) => {
  Object.assign(w.eval('S'), patch)
  w.eval('audioArmed = true')
  call('upNums()')
  return {
    tone: !!w.eval('almTimer'),
    banner: w.eval("document.getElementById('alm').classList.contains('shown')"),
  }
}
const alarmBase = {
  patientConnected: true, rhythm: 'nsr', hr: 38, spo2: 96,
  alarmOn: true, alarmMuted: false, hrAlarmLow: 50, hrAlarmHigh: 120, spo2AlarmLow: 94,
}
w.eval('D.alarms = true; D.silenceUntil = 0')
let al = alarmState(alarmBase)
ok('a breach sounds and shows', al.tone && al.banner, `tone ${al.tone}, banner ${al.banner}`)
w.eval('D.silenceUntil = Date.now() + 6e4')
al = alarmState(alarmBase)
ok('silencing at the unit stops both', !al.tone && !al.banner, `tone ${al.tone}, banner ${al.banner}`)
w.eval('D.silenceUntil = 0')
al = alarmState({ ...alarmBase, alarmMuted: true })
ok('and so does muting from the panel', !al.tone && !al.banner, `tone ${al.tone}, banner ${al.banner}`)
al = alarmState({ ...alarmBase, hr: 72, alarmMuted: false })
ok('a resolved breach falls silent', !al.tone && !al.banner, `tone ${al.tone}, banner ${al.banner}`)
call('alarmTone(false)')

ok('the P3 placeholder is gone', !/class="bc bP3"/.test(MONITOR_SRC), 'a cell with no state behind it')

// ---- the speed dial ----------------------------------------------------
// "Scrolls through and selects screen or menu items", Table 3-3. Both halves:
// the menu half worked, the screen half did nothing at all.
const SCREEN_ITEMS = w.eval('SCREEN_ITEMS')
call('closeMenu(); clearHomeSel()')
ok('the home screen starts with nothing selected', w.eval('D.homeSel') === -1)
call('dialTurn(1)')
ok('turning the dial selects a screen item', w.eval('D.homeSel') === 0, String(w.eval('D.homeSel')))
call('dialTurn(1); dialTurn(1)')
ok('and moves along them', w.eval('D.homeSel') === 2, String(w.eval('D.homeSel')))
call('dialTurn(-1)')
ok('and back', w.eval('D.homeSel') === 1, String(w.eval('D.homeSel')))
for (let i = 0; i < SCREEN_ITEMS.length; i++) call('dialTurn(1)')
ok('and wraps rather than stopping', w.eval('D.homeSel') === 1, String(w.eval('D.homeSel')))
ok(
  'the selected item is the one highlighted',
  w.eval(
    'D.homeSel >= 0 && !!document.getElementById(SCREEN_ITEMS[D.homeSel].el) &&' +
      ' document.getElementById(SCREEN_ITEMS[D.homeSel].el).classList.contains("sel")',
  ),
  `homeSel is ${w.eval('D.homeSel')}`,
)

// Pressing on the ECG channel reaches the lead and size lists, and picking
// from them drives the real controls rather than a display of them.
call('closeMenu(); clearHomeSel(); D.homeSel = 0; dialPress()')
ok('pressing on a screen item opens its menu', w.eval('D.menu && D.menu.title') === 'ECG', String(w.eval('D.menu && D.menu.title')))
call('D.menuIx = 0; menuSelect()')
ok('and the ECG menu reaches the lead list', w.eval('D.menu && D.menu.title') === 'LEAD')
const leadBefore = w.eval('devLead()')
call('D.menuIx = 3; menuSelect()')
ok('choosing a lead actually changes the lead', w.eval('devLead()') === 'aVR', `${leadBefore} -> ${w.eval('devLead()')}`)
ok('and returns to the ECG menu', w.eval('D.menu && D.menu.title') === 'ECG')
call('D.menuIx = 1; menuSelect()')
ok('the ECG menu reaches the size list', w.eval('D.menu && D.menu.title') === 'SIZE')
call('D.menuIx = 3; menuSelect()')
ok('and choosing a size changes the gain', w.eval('ecgSize()') === 2, String(w.eval('ecgSize()')))

// Parameter menus read the limits actually in force rather than inventing an
// editor whose result the panel would overwrite a second later.
w.eval('S.hrAlarmLow = 44; S.hrAlarmHigh = 133')
call('closeMenu(); D.homeSel = 1; dialPress()')
const hrLines = w.eval('D.menu.items.map(i => i.label)').join(' | ')
ok('a parameter menu shows the live alarm limits', /44/.test(hrLines) && /133/.test(hrLines), hrLines)
call('closeMenu(); D.homeSel = 4; dialPress()')
ok(
  'and says so plainly where there are none',
  /No alarm limits/.test(w.eval('D.menu.items.map(i => i.label)').join(' ')),
)
call('closeMenu(); clearHomeSel()')

// A press in the EVENT menu marks exactly one event.
call('openMenu(eventMenu())')
const evBefore = w.eval("D.log.filter(e => e.type === 'event').length")
call('D.menuIx = 3; menuSelect()')
const evAfter = w.eval("D.log.filter(e => e.type === 'event').length")
ok('selecting an event marks one event', evAfter === evBefore + 1, `${evBefore} -> ${evAfter}`)
ok('and closes the menu', w.eval('D.menu') === null)

// The drag-versus-press decision. Taken on the step remainder, a drag that
// happened to land on an exact multiple of the step size was read as a press
// — and in the EVENT menu that silently logged an event nobody chose.
ok(
  'drag-versus-press is decided on distance travelled, not the step remainder',
  /const moved=dragY!==null&&travel>6;/.test(MONITOR_SRC),
  'a drag landing on a step boundary would select whatever it stopped on',
)
ok('and travel accumulates the absolute movement', /travel\+=Math\.abs\(dy\);/.test(MONITOR_SRC))

// "Charges the defibrillator in Manual mode" / "Increases or decreases
// energy level in Manual mode", Table 3-1. Neither is available while the
// Shock Advisory System is running.
w.eval('D.analyzing = true; D.charged = false; D.charging = false')
const eBefore = w.eval('energy()')
call('nudgeEnergy(1)')
ok('ENERGY SELECT is inert during an analysis', w.eval('energy()') === eBefore, 'energy moved mid-analysis')
call('startCharge()')
ok('and CHARGE is too', w.eval('D.charging') === false, 'the unit charged mid-analysis')
w.eval('D.analyzing = false')
call('nudgeEnergy(1)')
ok('and both work again once it finishes', w.eval('energy()') !== eBefore)
  w.close()
}

{
  // Cross-file. Both of these fail silently in the room: a device event with
  // no icon draws a bullet in the facilitator's timeline, and an auto-tick
  // whose pattern matches no real step simply never fires, which looks exactly
  // like a crew that did not do the thing.
  const panelSrc = readFileSync(PAGE, 'utf8')

  // Area 4 keys, labelled as Table 3-4 labels them.
  for (const label of ['12-LEAD', 'TRANSMIT', 'CODE', 'PRINT'])
    ok(`the unit has a ${label} key`, MONITOR_SRC.includes(`>${label}`), 'missing from Area 4')

  const emitted = [...MONITOR_SRC.matchAll(/logEvent\('([a-zA-Z0-9]+)'/g)].map((m) => m[1])
  const uniq = [...new Set(emitted)]
  ok('the monitor emits device events', uniq.length > 10, `${uniq.length} kinds`)
  const iconBlock = panelSrc.slice(panelSrc.indexOf('const DEV_ICON='))
  const icons = new Set(
    [...iconBlock.slice(0, iconBlock.indexOf('};')).matchAll(/([a-zA-Z0-9]+):'/g)].map((m) => m[1]),
  )
  const missing = uniq.filter((t) => !icons.has(t))
  ok('every event the monitor sends has an icon on the panel', missing.length === 0, missing.join(','))

  const patterns = [...panelSrc.matchAll(/match:\/(.+?)\/i/g)].map((m) => m[1])
  ok('the panel auto-ticks from the device', patterns.length >= 3, `${patterns.length} rules`)
  const steps = [...panelSrc.matchAll(/^\s+'([^']{12,})',$/gm)].map((m) => m[1])
  for (const pat of patterns) {
    const re = new RegExp(pat, 'i')
    ok(`auto-tick /${pat}/ matches a real checklist step`, steps.some((t) => re.test(t)))
  }

  // The facilitator stays the assessor of record: a tick that came from the
  // device is marked as such and comes off on a click.
  ok('auto-ticks are marked in the UI', /auto-tag/.test(panelSrc) && /from monitor/.test(panelSrc))
  ok('and clicking one clears the mark', /if\(a\.auto\) delete a\.auto/.test(panelSrc))

  // ---- iPad usability ----------------------------------------------------
  // The unit is worked with gloved thumbs on a tablet, so the sizes below are
  // not styling. Measured before this pass, twelve of eighteen controls were
  // under Apple's 44pt minimum on every iPad and the three rockers — ENERGY
  // SELECT, RATE and CURRENT, the ones tapped repeatedly under pressure —
  // were 20 to 23pt. The floors are set in design pixels against the worst
  // landscape scale the chassis reaches (~0.93 on an iPad mini), so 48 design
  // px is what clears 44pt there.
  const cssNum = (re, what) => {
    const m = MONITOR_SRC.match(re)
    ok(`${what} is still declared`, !!m, 'rule is gone')
    return m ? parseFloat(m[1]) : 0
  }
  const TOUCH_FLOOR = 48
  ok(
    'chassis keys clear the touch floor',
    cssNum(/\.k\{[^}]*?min-height:(\d+)px/s, 'the key height') >= TOUCH_FLOOR,
    'below 48 design px',
  )
  ok(
    'the two-column areas clear it too',
    cssNum(/\.arow \.k\{[^}]*?min-height:(\d+)px/s, 'the two-column key height') >= TOUCH_FLOOR,
    'below 48 design px',
  )
  ok(
    'rocker arrows clear it',
    cssNum(/\.updown \.ud\{[^}]*?flex:0 0 (\d+)px/s, 'the rocker arrow width') >= TOUCH_FLOOR,
    'below 48 design px — these were the smallest controls on the unit',
  )
  ok(
    'the Area 4 keys clear it',
    cssNum(/\.fk\{flex:0 0 (\d+)px/, 'the Area 4 key height') >= TOUCH_FLOOR,
    'below 48 design px',
  )
  ok(
    'the skin switch clears the raw 44pt minimum',
    cssNum(/\.skb\{min-width:(\d+)px/, 'the skin switch size') >= 44,
    'below 44px — it does not scale with the chassis',
  )

  // The chassis is 1141px wide. Positioned absolutely it widened the layout
  // viewport on a touch device, so innerWidth came back as 1141 rather than
  // the iPad's 834 and the fit concluded it already fitted.
  ok(
    'the chassis cannot widen the layout viewport',
    /body\.lp-skin #device\{[^}]*?position:fixed/s.test(MONITOR_SRC),
    'position:fixed is gone — portrait will report the wrong viewport width',
  )
  ok('pinch and double-tap zoom are off', /user-scalable=no/.test(MONITOR_SRC))
  ok('the page cannot rubber-band', /overscroll-behavior:none/.test(MONITOR_SRC))
  ok(
    'a long press does not raise the iOS callout',
    /-webkit-touch-callout:none/.test(MONITOR_SRC),
    'holding ON to power down would select text instead',
  )
  ok(
    'the speed dial takes the gesture rather than the page',
    /\.dial\{[^}]*?touch-action:none/s.test(MONITOR_SRC),
    'dragging it would scroll instead of turning it',
  )
  // iOS leaves :hover stuck on whatever was tapped last.
  const hoverBlock = MONITOR_SRC.slice(MONITOR_SRC.indexOf('@media (hover:hover)'))
  const strayHover = /^\s*\.(k|fk|rk|updown|on-k|charge-k|alarms-k|ic)[^{]*:hover/m.test(
    MONITOR_SRC.slice(0, MONITOR_SRC.indexOf('@media (hover:hover)')),
  )
  ok('control hover styles are behind a pointer query', !strayHover, 'a bare :hover would stick on iOS')
  ok('and the query actually contains them', /\.k:hover/.test(hoverBlock.slice(0, 700)))
  ok('portrait is handled rather than shrunk into', /id="rotate"/.test(MONITOR_SRC))
  ok(
    'the fit follows the visual viewport',
    /visualViewport/.test(MONITOR_SRC),
    "Safari's toolbar would leave the unit hanging off the bottom",
  )

  // A channel delivers to every other subscriber in the same page, so the
  // monitor hears its own device posts. Merging one would put a __device key
  // into the patient state.
  ok(
    'the monitor ignores device events as state',
    /e\.data\.__monitor\|\|e\.data\.__device\) return/.test(MONITOR_SRC),
  )
  ok(
    'the run record carries the device timeline',
    /device:run\.device\.slice\(\)/.test(panelSrc),
  )
}

// ---------------------------------------------------------------------------
// Pacing capture, and the second device
// ---------------------------------------------------------------------------
//
// Reported twice from live scenarios: the patient will not capture however far
// the crew turn the current up. Two reasons.
//
// The prompt only ever existed inside the graded run card, so on a quick preset
// — or a megacode scrolled far enough for the card to condense — there was no
// control to press and the pacer did nothing at all.
//
// And capture was a press somebody had to find. It now answers the current at a
// threshold, which is what a patient does. The monitor still writes nothing:
// this is the panel deciding, on an event the crew generated.
{
  const { w, d, S } = load()
  const strips = () => [...d.querySelectorAll('.pacer-prompt')]
  // A stub rather than undefined, so a page with no strip at all fails the
  // assertion above and every one after it, instead of crashing the run.
  const strip = () => strips()[0] || { hidden: null, textContent: '' }
  const feed = (type, label, detail) =>
    w.onDeviceEvent({ t: new Date().toISOString(), ms: Date.now(), type, label, detail })
  const crank = (ma) => feed('pacerCurrent', 'PACING CURRENT', ma + ' mA')

  // No scenario at all: the strip has to be reachable anyway.
  ok('there is a pacing strip before any scenario is picked', strips().length >= 1)
  ok('and it is out of the way while the pacer is off', strip().hidden === true)

  w.eval("document.getElementById('scenarioSel').value='brady'; applyScenario()")
  ok('the patient is a symptomatic bradycardia', S().rhythm === 'brady', S().rhythm)

  feed('pacer', 'PACER ON', '70 ppm · 0 mA')
  ok('the pacer coming on brings the strip up', strip().hidden === false)
  ok('nothing captures at zero current', S().rhythm === 'brady', S().rhythm)

  const threshold = w.eval('captureThreshold')
  ok('there is a capture threshold to answer', threshold >= 40 && threshold <= 100, `${threshold} mA`)
  crank(threshold - 10)
  ok('under the threshold the patient stays where they were', S().rhythm === 'brady', S().rhythm)
  ok('and the strip says what it is waiting for', /NO CAPTURE/.test(strip().textContent))

  feed('pacerRate', 'PACING RATE', '80 ppm')
  crank(threshold)
  ok('at the threshold the patient captures', S().rhythm === 'paced', S().rhythm)
  ok('at the rate the crew dialled in', S().hr === 80, String(S().hr))
  ok('and the strip says so', /CAPTURED/.test(strip().textContent))

  feed('pacerRate', 'PACING RATE', '90 ppm')
  ok('a captured patient follows the rate dial', S().hr === 90, String(S().hr))

  crank(threshold - 10)
  ok('backing the current off loses capture', S().rhythm === 'brady', S().rhythm)
  ok('and gives back the rhythm that was there', S().hr === 40, String(S().hr))
  crank(threshold)
  ok('and putting it back regains it', S().rhythm === 'paced')

  // The facilitator overruling the model, in both directions.
  w.loseCapture(false)
  ok(
    'taking capture away by hand says this patient needs more than that',
    w.eval('captureThreshold') > threshold,
    `${w.eval('captureThreshold')} mA, crew at ${threshold}`,
  )
  ok('and it is not handed straight back on the next press', S().rhythm === 'brady')
  crank(w.eval('captureThreshold'))
  ok('the crew turning it up further gets there', S().rhythm === 'paced', S().rhythm)
  crank(20)
  w.giveCapture(false)
  ok(
    'giving it by hand at a low current says this one captures early',
    w.eval('captureThreshold') === 20,
    `${w.eval('captureThreshold')} mA`,
  )

  feed('pacer', 'PACER OFF', '')
  ok('switching the pacer off drops capture', S().rhythm === 'brady', S().rhythm)
  ok('and stands the strip down', strip().hidden === true)

  // Pacing does nothing to VF or pulseless VT, and a simulator that converted
  // them on a current dial would teach the wrong thing.
  for (const r of ['vfib', 'vtach']) {
    w.setR(r)
    w.eval('setCaptureThreshold(70)')
    feed('pacer', 'PACER ON', '70 ppm · 0 mA')
    crank(200)
    ok(`pacing does not convert ${r}`, S().rhythm === r, S().rhythm)
    ok('and the strip says why', /will not capture/.test(strip().textContent))
    feed('pacer', 'PACER OFF', '')
  }

  // Capture is evaluated on what the crew did, never on a timer — otherwise a
  // facilitator moving the patient to the next phase with the pacer still
  // running would be undone the moment they let go.
  const key = Object.keys(w.eval('SCENARIO_DOCS')).find((k) => k.startsWith('megacode'))
  w.applySimState(key, 0)
  w.startRun(key)
  w.enterRunState(0)
  w.renderSimPanel(key)
  ok('there is a strip in the run card too', strips().length >= 2, `${strips().length}`)
  w.eval('setCaptureThreshold(70)')
  feed('pacer', 'PACER ON', '70 ppm · 0 mA')
  crank(70)
  ok('the megacode bradycardia captures', S().rhythm === 'paced', S().rhythm)
  ok(
    'and every strip on the page carries it, not just the first',
    strips().every((el) => /CAPTURED/.test(el.textContent)),
    strips().map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)).join(' // '),
  )
  w.applySimState(key, 1)
  const chosen = S().rhythm
  ok(
    'and the next phase is not undone by a pacer still switched on',
    chosen !== 'paced',
    `${chosen} — the phase the facilitator chose was overwritten`,
  )
  // The crew are still working, and none of what they do next is a pacer
  // press. The patient the facilitator has just chosen is one pacing *would*
  // capture and the pacer is still on above the threshold, so evaluating on
  // any device event at all would hand them straight back to it.
  w.setR('brady')
  ok('the facilitator puts up a rhythm pacing would capture', w.eval('pacingIndicated()') === true)
  ok('with the crew still pacing above the threshold', w.eval('pacer.on && pacer.ma >= captureThreshold') === true)
  feed('cpr', 'CPR ON', '')
  feed('shock', 'SHOCK DELIVERED', '200 J')
  feed('analyze', 'ANALYZING', '')
  ok(
    'and nothing that is not a pacer press re-captures them',
    S().rhythm === 'brady',
    `${S().rhythm} — a press that was not at the pacer moved the patient`,
  )
  ok('while the next pacer press still does', (crank(w.eval('captureThreshold')), S().rhythm === 'paced'), S().rhythm)

  ok(
    'every capture is on the same timeline as the crew’s presses',
    w.eval("run.device.filter(e => e.type === 'capture').length") > 0,
  )
  w.close()
}

{
  // The second device. BroadcastChannel and localStorage are same-origin AND
  // same-browser: they carry the two windows on one laptop and cannot reach an
  // iPad across the room at all. The relay is the third path, and it is
  // additive — with no session, everything below still works as it did.
  const panelSrc = readFileSync(PAGE, 'utf8')

  ok('the panel publishes state to a session', /if\(relayReady\(\)\) relay\.send\(S\);/.test(panelSrc))
  ok(
    'and still publishes on the same-machine channel',
    /if\(bc\) bc\.postMessage\(S\);/.test(panelSrc),
    'the local path must survive — it is what works with no network',
  )
  ok('the monitor sends its heartbeat up the relay', /if\(relayReady\(\)\) relay\.sendBack\(hb\);/.test(MONITOR_SRC))
  ok(
    'and every device event with it',
    /if\(relayReady\(\)\) relay\.sendBack\(\{__device:ev\}\);/.test(MONITOR_SRC),
  )
  ok(
    'the monitor never adopts a heartbeat as patient state',
    /if\(st&&!st\.__monitor&&!st\.__device\) S=\{\.\.\.S,\.\.\.st\};/.test(MONITOR_SRC),
    'the relay carries three kinds of message on one channel',
  )
  for (const f of [PAGE, MONITOR])
    ok(
      `${f.endsWith('control_panel.html') ? 'the panel' : 'the monitor'} loads the relay`,
      /<script type="module" src="\/simulator\/relay\.js"><\/script>/.test(readFileSync(f, 'utf8')),
    )

  // Session codes get read off a laptop screen and typed on an iPad by someone
  // standing up.
  const relaySrc = readFileSync(join(here, '..', 'src', 'simulator', 'relay.ts'), 'utf8')
  const alpha = relaySrc.match(/const ALPHABET = '([^']+)'/)?.[1] ?? ''
  ok('the session alphabet exists', alpha.length > 0)
  for (const ch of ['O', '0', 'I', '1', 'L', 'S', '5', 'B', '8'])
    ok(`session codes avoid ${ch}`, !alpha.includes(ch), 'misread on a projector or a small screen')
}

// ---------------------------------------------------------------------------
// Facilitator usability
//
// One person drives the scenario and grades the crew. Measured on a 1280x720
// laptop, the things they touch every few seconds — the patient states, the
// expected actions, the device timeline — were being pushed below the fold by
// things touched once: two scenario pickers, the brief, and the team/CPR/
// PASS-NR strip that is filled in at the debrief. The rhythm buttons and the
// drug grid sat 800px further down again.
// ---------------------------------------------------------------------------
{
  const panelSrc = readFileSync(PAGE, 'utf8')

  ok(
    'the run card follows the facilitator down the page',
    /\.run-card\{[^}]*position:sticky/s.test(panelSrc),
    'scrolling to the drug grid would cost sight of the phase and the unticked actions',
  )
  ok(
    'and cannot grow taller than the screen it is stuck to',
    /\.run-card\{max-height:calc\(100vh/.test(panelSrc),
  )
  ok(
    'setup furniture stands down once a run is under way',
    /body\.run-active \.scenario-row\{display:none;\}/.test(panelSrc),
  )
  ok('and can be brought back without ending the run', /function toggleSetup\(\)/.test(panelSrc))
  // The megacode check-off is laid out as the AHA sheet: one column of steps in
  // the published order, the tick column on the right, and the result at the
  // foot. It replaced a per-phase actions column with team behaviour, CPR
  // quality and PASS / NR collapsed into a separate strip below the columns —
  // neither of which is where an instructor's eye expects them on that form.
  ok('the sheet scrolls inside the card rather than growing it', /\.sheet\{[^}]*overflow-y:auto/s.test(panelSrc))
  // Not sticky, deliberately: three rows of result and instructor fields
  // following the scroll spent a megacode sitting on top of the steps being
  // checked. It sits at the foot of the form, as it does on paper.
  ok('the result block sits at the foot rather than following the scroll',
     /\.sh-foot\{background:var\(--surface-2\)/.test(panelSrc) && !/\.sh-foot\{position:sticky/.test(panelSrc))
  ok('and the tick column is on the right, as the form has it', /\.sh-row \.box\{margin-left:auto/.test(panelSrc))

  // Exactly one. A second delegated handler double-fires every activation, and
  // on a toggle — every expected action is one — two clicks cancel out, so
  // ticking an action from the keyboard silently does nothing.
  const keyHandlers = (panelSrc.match(/document\.addEventListener\('keydown'/g) || []).length
  ok(
    'there is exactly one keyboard-activation handler',
    keyHandlers === 1,
    `${keyHandlers} of them — two would cancel each other out on anything that toggles`,
  )

  // The 12-lead lives in a window the crew can close. The panel's button used
  // to be a local boolean, so closing it at the unit left the facilitator's
  // button reading "Close" and swallowed their next press.
  ok(
    'the monitor reports whether the 12-lead is actually up',
    /__monitor:1,lead12:/.test(MONITOR_SRC),
  )
  ok('and the panel follows it rather than guessing', /function sync12Lead\(/.test(panelSrc))
  ok('the panel acts on that heartbeat field', /sync12Lead\(!!e\.data\.lead12\)/.test(panelSrc))

  // ...and the crew at the unit need a way out of it. Reported from a live
  // scenario: once the 12-lead was up there was no way off it. The popup had
  // no close control of its own, and HOME SCREEN — the key the manual makes
  // the way back to the home display — tested for an in-page element named
  // `lead12` that has never existed, because the 12-lead is a separate window
  // held in `w12Lead`. So the guard was always false and HOME did nothing.
  const twelve = MONITOR_SRC.slice(
    MONITOR_SRC.indexOf('function open12Lead'),
    MONITOR_SRC.indexOf('function close12Lead'),
  )
  ok('the 12-lead window carries its own close control', /class="closebtn"/.test(twelve))
  ok('that control calls close12()', /onclick="close12\(\)"/.test(twelve))
  ok('and Escape works from inside it', /if\(e\.key==='Escape'\) close12\(\)/.test(twelve))
  ok(
    'a window that cannot close itself says so rather than looking stuck',
    /id="closeHint"/.test(twelve),
  )
  ok(
    'nothing looks for the 12-lead as an element in this document',
    !/getElementById\('lead12'\)/.test(MONITOR_SRC),
    'a popup window is not a node here — that guard can never be true',
  )
  {
    // Behavioural: HOME SCREEN closes an open 12-lead, and does not open one.
    const { w } = loadMonitor()
    w.eval('setPower(true)')
    let closed = 0
    w.eval('w12Lead={closed:false,close(){this.closed=true;window.__closed=(window.__closed||0)+1}}')
    w.document.getElementById('kHOME').dispatchEvent(new w.MouseEvent('click', { bubbles: true }))
    closed = w.eval('window.__closed||0')
    ok('HOME SCREEN closes the 12-lead window', closed === 1, `close() called ${closed} times`)
    ok('and lets go of the handle', w.eval('w12Lead===null'))
    let opened = 0
    w.eval('open12Lead=function(){window.__opened=(window.__opened||0)+1}')
    w.document.getElementById('kHOME').dispatchEvent(new w.MouseEvent('click', { bubbles: true }))
    opened = w.eval('window.__opened||0')
    ok('HOME SCREEN never opens one', opened === 0, 'it is a way back, not a toggle')
    w.close()
  }

  // ---- What the run card costs the rest of the console ------------------
  // Reported from a live ACLS megacode: the panel goes "clunky" once the run
  // card is up. Measured mid-code at 1366x768 it was 411px of a 768px viewport
  // — 54% of the screen held permanently while the facilitator worked the
  // vitals, capnography and drug controls in what was left. Two answers by
  // width: a rail in the dead margin beside the 960px page on wide screens, a
  // 52px summary line on narrow ones.
  // Found by its content, not by the number in it, so moving the breakpoint
  // fails the breakpoint check rather than silently emptying this slice.
  const railAt = panelSrc.search(/@media \(min-width:\d+px\)\{\n\s*\/\* run-mode alone/)
  const railBlock = railAt < 0 ? '' : panelSrc.slice(railAt)
  const rail = railBlock.slice(0, railBlock.indexOf('\n}'))
  ok('the run card has a wide-screen rail', rail.includes('.run-card{position:fixed'))
  const railW = parseInt((rail.match(/\.run-card\{[^}]*?width:(\d+)px/s) || [])[1] || 0)
  const bodyPad = parseInt((rail.match(/body\.run-mode:not\(\.sheet-run\)\{padding-right:(\d+)px/) || [])[1] || 0)
  ok(
    'the page is padded clear of the rail',
    railW > 0 && bodyPad >= railW,
    `rail ${railW}px, padding ${bodyPad}px — content would sit under it`,
  )
  const threshold = parseInt((rail.match(/@media \(min-width:(\d+)px\)/) || [])[1] || 0)
  ok(
    'the rail only turns on where there is room for it',
    threshold >= railW + 900,
    `${threshold}px is not enough for a ${railW}px rail beside the page`,
  )
  // The rail is a column, and the three-column band inside it has to be told
  // so *after* the rule it is beating — a media query adds no specificity.
  ok('the band goes to one column in the rail', /\.run-cols\{grid-template-columns:1fr/.test(rail))
  const threeCol = panelSrc.indexOf('.run-cols{display:grid;grid-template-columns:1fr 1.35fr 1fr')
  ok('the full-width band is still three columns', threeCol >= 0, 'the rule this order depends on is gone')
  ok(
    'and the rail override comes after the rule it beats',
    threeCol >= 0 && railAt >= 0 && threeCol < railAt,
    'source order puts the three-column rule last, so the rail would keep three columns',
  )

  ok('narrow screens get a condensed bar instead', /\.run-card\.condensed \.run-cols/.test(panelSrc))
  // The bar must leave the flow rather than shrink in it. Shrinking took 357px
  // out of the document above the scroll position, which pulled the sentinel
  // back into view, which expanded the card again — measured, the page went
  // 150 -> 0 -> 150 -> 0 on repeated wheels and a scrollTo(600) settled at 244,
  // exactly where the sentinel's bottom edge sits. Reported as the panel being
  // "sticky at the top and not scrolling down properly".
  ok(
    'the condensed bar is out of the flow',
    /\.run-card\.condensed\{[^}]*?position:fixed/s.test(panelSrc),
    'shrinking it in place changes the document height and fights the scroll',
  )
  ok(
    'and the space it left is held open',
    /if\(want&&wrap\) wrap\.style\.height=card\.offsetHeight\+'px';/.test(panelSrc),
    'without this the sentinel moves and the card oscillates',
  )
  ok(
    'measured before the class changes, not after',
    panelSrc.indexOf("wrap.style.height=card.offsetHeight+'px'") <
      panelSrc.indexOf("card.classList.toggle('condensed',want)"),
    'after the class lands the card is 52px and the wrapper freezes at the wrong height',
  )
  ok(
    'and released when it expands again',
    /if\(!want&&wrap\) wrap\.style\.height='';/.test(panelSrc),
  )
  {
    // Behavioural: the document height must not move when the bar condenses.
    const { w } = load()
    w.eval("document.getElementById('simScenarioSel').value='megacode1'; applySimScenario()")
    const card = w.document.getElementById('runCard')
    const wrap = w.document.getElementById('runWrap')
    ok('the card sits in a wrapper that can hold its place', !!wrap && wrap.contains(card))
    // jsdom has no layout, so offsetHeight is 0 either way — what is checkable
    // here is that the wrapper is frozen and released in step with the class.
    Object.defineProperty(w, 'innerWidth', { value: 1180, configurable: true })
    w.eval('RAIL_MQ=null; collapseRunCard()')
    ok('condensing freezes the wrapper', wrap.style.height !== '', `height "${wrap.style.height}"`)
    w.eval('expandRunCard()')
    ok('and expanding releases it', wrap.style.height === '', `height "${wrap.style.height}"`)
    w.close()
  }
  ok('the bar carries the phase, the tally and the clock', /id="rmClock"/.test(panelSrc) && /rm-phase/.test(panelSrc) && /rm-num/.test(panelSrc))
  ok('and a way to end the run without opening the card', /class="end-btn rm-end"/.test(panelSrc))
  ok('the bar is a tap target in its own right', /\.run-mini\{[^}]*?min-height:52px/s.test(panelSrc))
  const endH = parseInt((panelSrc.match(/\.run-mini \.rm-end\{[^}]*?min-height:(\d+)px/s) || [])[1] || 0)
  ok('its End button clears 44pt', endH >= 44, `${endH}px`)

  {
    const { w } = load()
    w.eval("document.getElementById('simScenarioSel').value='megacode1'; applySimScenario()")
    // The clock. run.states[i].seconds is only banked when a state is left, so
    // reading the totals alone stops the clock the moment a run starts.
    const t0 = w.eval('runElapsed()')
    w.eval('run.enteredAt -= 5000')
    const t1 = w.eval('runElapsed()')
    ok('the run clock counts the state on screen', t1 - t0 >= 5, `${t0} -> ${t1}`)
    const tally0 = w.eval('JSON.stringify(miniTally())')
    w.eval('toggleAction(0)')
    const tally1 = w.eval('JSON.stringify(miniTally())')
    ok('the tally follows a tick', JSON.parse(tally1).done === JSON.parse(tally0).done + 1, `${tally0} -> ${tally1}`)

    // Collapsing is the facilitator's choice, not the scroll position's.
    //
    // This used to collapse itself as soon as the page scrolled past the card,
    // which is what was reported as the megacode controls "disappearing": a
    // facilitator who scrolled down to give a drug and then needed to change a
    // rhythm at the top found the card gone. Scrolling down is not a statement
    // that you are done with the controls, so the card now stays whole however
    // far the page scrolls, and collapses only when asked.
    const past = (yes) =>
      w.eval(`document.getElementById('runSentinel').getBoundingClientRect=()=>({bottom:${yes ? -10 : 10}})`)
    const cond = () => w.eval("document.getElementById('runCard').classList.contains('condensed')")
    const width = (px) => w.eval(`Object.defineProperty(window,'innerWidth',{value:${px},configurable:true})`)
    width(1180)
    past(false); w.eval('applyRunCondense()')
    ok('the card is whole while it is still on screen', !cond())
    past(true); w.eval('applyRunCondense()')
    ok('and stays whole once the page has scrolled past it', !cond(), 'the controls vanished on scroll')
    w.eval('collapseRunCard()')
    ok('collapsing by hand condenses it', cond())
    past(false); w.eval('applyRunCondense()')
    ok('and scrolling back to the top does not reopen it', cond(), 'scroll position must not drive the card')
    w.eval('expandRunCard()')
    ok('a tap opens it again', !cond())
    past(true); w.eval('applyRunCondense()')
    ok('and it stays open while the facilitator works below it', !cond())
    ok('there is a collapse control in the header', /onclick="collapseRunCard\(\)"/.test(panelSrc))
    ok('the card is no longer driven by the scroll event', !/addEventListener\('scroll',applyRunCondense/.test(panelSrc))
    width(1440)
    w.eval('RAIL_MQ=null; applyRunCondense()')
    ok('the rail never condenses — it costs no vertical space to start with', !cond())
    width(1180)
    w.eval('RAIL_MQ=null; endRun(); if(!document.getElementById("endPrompt").hidden) commitRun(); applyRunCondense()')
    ok(
      'the finished-run summary never condenses',
      !cond(),
      'it has no bar to fall back to and would collapse to an empty strip',
    )
    w.close()
  }

  // ---- The monitor on a second device -----------------------------------
  // Reported from a live scenario: the iPad joined the session, drew a few
  // seconds of the relayed rhythm and went blank. Two independent causes, both
  // of them about localStorage being a *local* thing.
  ok(
    'the localStorage poll asks whether it is allowed to run',
    /setInterval\(\(\)=>\{\n\s*if\(localStateAllowed\(\)\) ld\(\);/.test(MONITOR_SRC),
    'the poll merges the local snapshot unconditionally',
  )
  ok(
    'a joined relay session stops it',
    /if\(relay&&relayState!=='error'\) return false;/.test(MONITOR_SRC),
  )
  ok('and a channel that has delivered stops it too', /return !bcDelivered;/.test(MONITOR_SRC))
  ok('the channel says when it has delivered', /bcDelivered=true;/.test(MONITOR_SRC))

  {
    // Behavioural, with the stale copy an iPad carries after the panel has
    // ever been open on it — patientConnected:false, which is how the monitor
    // draws no patient at all.
    const stale = JSON.stringify({ hr: 78, rhythm: 'nsr', patientConnected: false, spo2: 97 })
    const { w } = loadMonitor({ simState: stale })
    w.eval(`window.CESRelay={normaliseCode:c=>String(c).toUpperCase().slice(0,6),
      joinSession:o=>{window.__feed=o.onState;o.onStatus('live');return{send(){},sendBack(){}}},
      leaveSession(){}}`)
    w.eval("joinSession('ABC234')")
    const RELAYED = { hr: 176, rhythm: 'vtach', patientConnected: true, spo2: 84 }
    w.eval(`window.__feed(${JSON.stringify(RELAYED)})`)
    ok('relayed state lands', w.eval('S.hr') === 176 && w.eval('S.patientConnected') === true)
    // The poll's own body, run directly: 250ms of real time is not worth
    // waiting for, and this is exactly what the interval does.
    w.eval('if(localStateAllowed()) ld()')
    ok(
      'and the poll leaves it alone while a session is live',
      w.eval('S.hr') === 176 && w.eval('S.patientConnected') === true,
      `HR ${w.eval('S.hr')}, connected ${w.eval('S.patientConnected')}`,
    )
    // ...and the stale copy really would have wrecked it, so the check above
    // is not passing because there was nothing to clobber.
    w.eval('ld()')
    ok(
      'the local snapshot really is the thing that used to blank the screen',
      w.eval('S.patientConnected') === false,
      'nothing stale in localStorage — the guard above proves nothing',
    )
    w.close()
  }
  {
    // With no session and no channel delivery, the poll is still the fallback
    // it was built as.
    const { w } = loadMonitor({ simState: JSON.stringify({ hr: 44, rhythm: 'brady' }) })
    ok('a monitor on its own still reads local state', w.eval('localStateAllowed()') === true)
    w.eval('bcDelivered=true')
    ok('and stands down once the channel has proven itself', w.eval('localStateAllowed()') === false)
    w.close()
  }

  // Broadcast keeps no history, so a monitor only hears what is said after it
  // subscribes. The panel publishes on change, which left an iPad that joined
  // mid-scenario — the normal order — on its defaults until the next slider
  // moved, and put it back there after every reconnect.
  const keepalive = panelSrc.match(/setInterval\(\(\)=>\{ if\(relayReady\(\)\) relay\.send\(S\); \},(\d+)\);/)
  ok('the panel republishes state while a session is live', !!keepalive, 'a monitor joining late hears nothing')
  ok(
    'often enough that joining is not a wait',
    keepalive && +keepalive[1] <= 5000 && +keepalive[1] >= 500,
    keepalive ? `${keepalive[1]}ms` : 'no cadence',
  )
  ok(
    'and it does not send into a session that is not live',
    /function relayReady\(\)\{ return relay&&relayState==='live'; \}/.test(panelSrc),
  )

  // Two strip items on the ZX skin were divs with an onclick and no way in
  // from the keyboard.
  const stripButtons = (MONITOR_SRC.match(/class="ic"[^>]*role="button"/g) || []).length
  ok('the ZX strip controls are reachable from the keyboard', stripButtons === 2, `${stripButtons} of 2`)
}

// ---------------------------------------------------------------------------
// Starting a scenario is a clean slate
//
// The most damaging defect at review: a scenario inherited the last one's
// device settings, medication history, therapy mode and shock count. Scenario
// 4's first shock recorded as shock #4; later scenarios opened in AED or pacing
// mode. The reset spans both files — the panel clears its own med log and
// device feed and bumps a token, the monitor watches the token and returns the
// unit to its power-on baseline.
// ---------------------------------------------------------------------------
{
  const { w, d, S } = load()

  // Panel side: a new graded scenario clears what the last run left behind.
  d.getElementById('simScenarioSel').value = 'megacode1'
  w.applySimScenario()
  w.giveDrug('epi_acls')
  w.onDeviceEvent({ t: new Date().toISOString(), ms: Date.now(), type: 'shock', label: 'SHOCK', detail: '200J · shock #1' })
  ok('a drug is on the log during the first scenario', w.eval('drugLog').length > 0)
  ok('and a press is on the device timeline', w.eval('deviceFeed').length > 0)
  const token0 = w.eval('S.deviceReset') || 0

  d.getElementById('simScenarioSel').value = 'megacode4'
  w.applySimScenario()
  ok('starting a new scenario clears the medication log', w.eval('drugLog').length === 0)
  ok('and clears the device timeline', w.eval('deviceFeed').length === 0)
  ok('and bumps the device-reset token for the monitor', (w.eval('S.deviceReset') || 0) > token0, `${token0} -> ${w.eval('S.deviceReset')}`)

  // The concrete leak: a capnogram shape one scenario sets must not carry into
  // the next, which does not set it.
  d.getElementById('simScenarioSel').value = 'asthma_initial'
  w.applySimScenario()
  ok('asthma sets the shark-fin capnogram', S().co2Shape === 'shark', S().co2Shape)
  d.getElementById('simScenarioSel').value = 'megacode1'
  w.applySimScenario()
  ok('the next scenario does not inherit the shark-fin capnogram', S().co2Shape === 'normal', S().co2Shape)
  w.close()
}

{
  // Monitor side: two consecutive scenarios produce identical initial device
  // state regardless of what happened in the first run.
  const { w, S } = loadMonitor()
  const RESET_FIELDS = [
    'mode', 'energyIx', 'charging', 'charged', 'shocks', 'lastShockAt', 'sync', 'cpr',
    'analyzing', 'advisory', 'reanalyzeAt', 'pacer', 'pacerRate', 'pacerMa', 'pacePaused',
    'alarms', 'silenceUntil', 'nibpUntil', 'leadIx', 'leadFromPanel', 'sizeIx', 'sunvue',
  ]
  const snap = () => {
    const D = w.eval('D')
    return RESET_FIELDS.map((k) => `${k}=${JSON.stringify(D[k])}`).join(',') + `,log=${w.eval('D.log.length')}`
  }
  // Powering the unit on is itself an event, so the log starts at one entry —
  // cleared here so the baseline is the device, not the harness.
  w.eval('D.log.length = 0')
  const baseline = snap()

  // A full first run: a shock count, AED advisory, a lead and size change, the
  // pacer up, alarms silenced, energy at 360, an event log.
  const messyRun = () =>
    w.eval(`
      D.shocks = 4; D.mode = 'aed'; D.advisory = 'SHOCK ADVISED'; D.charged = true;
      D.sync = true; D.energyIx = ENERGIES.indexOf(360); D.leadIx = 2; D.sizeIx = 4;
      D.pacer = true; D.pacerMa = 80; D.pacerRate = 90; D.pacePaused = true;
      D.silenceUntil = Date.now() + 9e4; D.alarms = false; D.sunvue = true;
      D.log.push({ type: 'shock' }, { type: 'shock' }, { type: 'shock' }, { type: 'shock' });
    `)
  const resetArrives = () => w.eval('S.deviceReset = (S.deviceReset || 0) + 1; devTick()')

  messyRun()
  resetArrives()
  const afterFirst = snap()
  ok('a scenario reset returns the unit to its power-on baseline', afterFirst === baseline, afterFirst)

  // A different first run entirely, then the same reset.
  w.eval(`D.mode = 'aed'; D.shocks = 9; D.pacerMa = 130; D.leadIx = 5; D.sizeIx = 1; D.sunvue = true;`)
  resetArrives()
  const afterSecond = snap()
  ok('two consecutive scenarios start identical regardless of the first run', afterSecond === afterFirst, afterSecond)
  ok('and the shock count is back to zero', w.eval('D.shocks') === 0, String(w.eval('D.shocks')))
  ok('and the therapy mode is back to Manual', w.eval('D.mode') === 'manual', w.eval('D.mode'))
  ok('and the event log is cleared', w.eval('D.log.length') === 0, String(w.eval('D.log.length')))
  w.close()
}

// ---------------------------------------------------------------------------
// AED / SYNC / defibrillation as one explicit state machine
//
// The review reached illegal combinations by reading a handful of booleans in
// whatever order each handler happened to: AED SYNC, a synchronized shock on a
// plain tap, SYNC still armed after the shock, ENERGY SELECT changing joules
// without leaving AED, and no auto-charge after SHOCK ADVISED. defibState() is
// the single derivation the transitions below are checked against.
// ---------------------------------------------------------------------------
{
  const { w, S } = loadMonitor()
  const D = () => w.eval('D')
  const state = () => w.eval('defibState()')
  const chargeThrough = () => w.eval('D.chargeStart = Date.now() - CHARGE_MS - 1; devTick()')
  Object.assign(S(), { patientConnected: true, rhythm: 'vfib', sbp: 0, dbp: 0, spo2: 3, lead: 'II' })

  // Manual defibrillation: idle → charging → ready → shock → idle.
  ok('the unit starts in MANUAL_IDLE', state() === 'MANUAL_IDLE', state())
  w.eval('startCharge()')
  ok('CHARGE moves to MANUAL_CHARGING', state() === 'MANUAL_CHARGING', state())
  chargeThrough()
  ok('and completes to MANUAL_READY', state() === 'MANUAL_READY', state())
  w.eval('deliverShock()')
  ok('a shock returns to MANUAL_IDLE', state() === 'MANUAL_IDLE', state())

  // AED: analyze enters the mode, a shockable rhythm auto-charges, ready.
  w.eval('startAnalyze()')
  ok('ANALYZE enters AED mode', state() === 'AED_ANALYZING' && D().mode === 'aed', `${state()} mode ${D().mode}`)
  w.eval('D.analyzeUntil = 0; devTick()')
  ok('a shockable rhythm auto-charges in AED, no CHARGE press', state() === 'AED_CHARGING' || state() === 'AED_READY', state())
  chargeThrough()
  ok('and reaches AED_READY', state() === 'AED_READY', state())

  // ENERGY SELECT is the way out of AED into Manual (Table 3-1).
  w.eval('nudgeEnergy(1)')
  ok('ENERGY SELECT leaves AED for Manual', D().mode === 'manual', D().mode)
  ok('and throws the charge away with it', D().charged === false)

  // SYNC is a manual-mode modifier: it cannot be armed in AED, so "AED SYNC"
  // is unreachable.
  w.eval('aedReset(); D.mode = "aed"; D.analyzing = true')
  w.document.getElementById('kSYNC').dispatchEvent(new w.Event('click'))
  ok('SYNC cannot be armed in AED mode', D().sync === false, 'AED SYNC was reachable')

  // Entering AED clears any SYNC that was set in manual.
  w.eval('aedReset(); D.mode = "manual"; D.sync = true')
  w.eval('startAnalyze()')
  ok('entering AED clears a SYNC left on from manual', D().sync === false && D().mode === 'aed', `sync ${D().sync} mode ${D().mode}`)

  // Synchronized cardioversion: armed → charged → SYNC_READY → shock disarms SYNC.
  w.eval('exitAedToManual(); aedReset(); D.mode = "manual"; D.sync = true')
  S().rhythm = 'vtach'
  ok('SYNC in manual is SYNC_ARMED', state() === 'SYNC_ARMED', state())
  w.eval('startCharge()'); chargeThrough()
  ok('a charged SYNC is SYNC_READY', state() === 'SYNC_READY', state())
  w.eval('deliverShock()')
  ok('a synchronized shock disarms SYNC afterwards', D().sync === false, 'SYNC stayed armed after the shock')
  ok('and the shock recorded itself as synchronized', w.eval("D.log.some(e => e.type === 'shock' && /synchronized/.test(e.detail))"))

  /* The SHOCK key delivers on a press, synchronized or not.

     It used to refuse a tap while SYNC was armed and ask for a press-and-hold,
     after the manual's description of holding SHOCK until the unit fires on
     the next R wave. In a classroom that read as a broken button — reported
     from a live megacode as the cardioversion failing to fire — so a press is
     a press, and the hold path still works for crews taught that way. */
  const shk = w.document.getElementById('kSHOCK')
  w.eval('aedReset(); D.sync = true; D.charged = true; D.shocks = 0')
  shk.dispatchEvent(new w.Event('pointerdown'))
  shk.dispatchEvent(new w.Event('pointerup'))
  ok('a press delivers a synchronized shock', D().shocks === 1, `${D().shocks} shocks from a press`)
  ok('and disarms SYNC behind it', D().sync === false)
  // ...as does a plain manual defibrillation.
  w.eval('aedReset(); D.sync = false; D.charged = true; D.shocks = 0')
  shk.dispatchEvent(new w.Event('pointerdown'))
  shk.dispatchEvent(new w.Event('pointerup'))
  ok('a manual defibrillation delivers on a tap', D().shocks === 1, `${D().shocks} shocks from a tap`)
  // An uncharged unit still does nothing, whatever the mode.
  w.eval('aedReset(); D.sync = true; D.charged = false; D.shocks = 0')
  shk.dispatchEvent(new w.Event('pointerdown'))
  shk.dispatchEvent(new w.Event('pointerup'))
  ok('an uncharged unit delivers nothing', D().shocks === 0, `${D().shocks} shocks with no charge`)
  ok('the hold path is still wired', /bindHold\('kSHOCK'/.test(MONITOR_SRC))
  w.close()
}

// ---------------------------------------------------------------------------
// Physiologic invariants: a pulseless patient does not perfuse
//
// The review found pulseless VT and VF drawing an "Excellent" SpO2 pleth
// against a saturation of 3, and a pressor lifting an arrest's NIBP from 0/0 to
// 17/8 and raising the electrical rate. A patient with no pulse has no
// pulsatile flow for the probe and no pressure for a drug to raise.
// ---------------------------------------------------------------------------
{
  const { w, d, S } = loadMonitor()
  const sSpo2 = w.eval('sSpo2')
  const pleth = () => [0, 0.15, 0.3, 0.45, 0.6, 0.75].map((t) => sSpo2(t))
  const flat = (a) => a.every((v) => Math.abs(v - a[0]) < 1e-9)

  // Pulseless VT: sbp 0 with an electrical rate. No pleth, no SpO2 number.
  Object.assign(S(), { patientConnected: true, rhythm: 'vtach', hr: 180, sbp: 0, dbp: 0, spo2: 3, spo2Quality: 'excellent' })
  w.eval('upNums()')
  ok('pulseless VT shows no SpO2 number', d.getElementById('nSpo2').textContent === '---', d.getElementById('nSpo2').textContent)
  ok('and draws no plethysmograph', flat(pleth()), 'a pleth on a pulseless patient')

  // PEA: an organized rhythm at a rate, still no pulse.
  Object.assign(S(), { rhythm: 'brady', hr: 40, sbp: 0, dbp: 0, spo2: 0 })
  w.eval('upNums()')
  ok('PEA shows no SpO2 number', d.getElementById('nSpo2').textContent === '---', d.getElementById('nSpo2').textContent)
  ok('and no pleth', flat(pleth()))

  // A perfusing VT (Megacode 4's 84/54 with a pulse) reads normally.
  Object.assign(S(), { rhythm: 'vtach', hr: 150, sbp: 84, dbp: 54, spo2: 94, spo2Quality: 'excellent' })
  w.eval('upNums()')
  ok('a perfusing VT shows its SpO2', d.getElementById('nSpo2').textContent === '94', d.getElementById('nSpo2').textContent)
  ok('and draws a real pleth', !flat(pleth()), 'a perfusing patient with a flat pleth')

  // No SpO2 low alarm fires on a --- : a value that is not shown cannot breach.
  Object.assign(S(), {
    rhythm: 'vfib', hr: 0, sbp: 0, dbp: 0, spo2: 3,
    alarmOn: true, alarmMuted: false, spo2AlarmLow: 94, hrAlarmLow: 50, hrAlarmHigh: 120,
  })
  w.eval('D.alarms = true; D.silenceUntil = 0; upNums()')
  ok(
    'a pulseless SpO2 raises no low-SpO2 alarm',
    !d.getElementById('nSpo2').classList.contains('alarming'),
    'a --- was flashing as a low saturation',
  )
  w.close()
}

{
  // The capnogram follows the patient rather than lingering. A shark-fin or a
  // CPR pattern set in an earlier phase must not carry into ROSC.
  const { w, d, S } = load()
  d.getElementById('simScenarioSel').value = 'asthma_initial'
  w.applySimScenario()
  ok('asthma runs a shark-fin capnogram', S().co2Shape === 'shark', S().co2Shape)
  // A megacode phase that names no shape gets a normal capnogram.
  d.getElementById('simScenarioSel').value = 'megacode1'
  w.applySimScenario()
  ok('a phase that names no capnogram gets a normal one', S().co2Shape === 'normal', S().co2Shape)
  // Manually setting one, then moving to a phase that names none, clears it.
  w.sv('co2Shape', 'shark')
  ok('a manual capnogram takes', S().co2Shape === 'shark')
  w.applySimState('megacode1', 3) // ROSC — names no shape
  ok('and does not linger into a phase that names none (ROSC)', S().co2Shape === 'normal', S().co2Shape)
  w.close()
}

// ---------------------------------------------------------------------------
// The monitor always has a way to join a session
//
// Reported from a live scenario: after "Not now" once, a session started later
// on the console had no route in at the monitor — #joinBox was hidden and
// empty, and nothing brought it back. Dismissing the prompt must never remove
// the join path.
// ---------------------------------------------------------------------------
{
  const { w, d } = loadMonitor()
  ok('there is a permanent join control', !!d.getElementById('joinTab'))

  w.eval('setJoinUi("off")')
  ok('the join prompt offers a "Not now"', /Not now/.test(d.getElementById('joinBox').innerHTML))

  w.eval('dismissJoin()')
  ok('dismissing hides the prompt', d.getElementById('joinBox').hidden === true)
  ok('but leaves the persistent tab in place', d.getElementById('joinTab').hidden === false)

  w.eval('openJoinPrompt()')
  ok(
    'and the tab reopens a working join form',
    d.getElementById('joinBox').hidden === false && /id="joinCode"/.test(d.getElementById('joinBox').innerHTML),
    'the join path was gone after a dismissal',
  )

  // Even while connected, the tab offers a way to change session — the box is
  // otherwise hidden so the crew see a monitor, not a notice.
  w.eval('relay={code:()=>"ABC234",status:()=>"live"}; relayState="live"; forceJoinOpen=false; setJoinUi("live")')
  ok('a live session hides the prompt', d.getElementById('joinBox').hidden === true)
  ok('but the tab shows the session and stays reachable', d.getElementById('joinTab').classList.contains('live'))
  w.eval('openJoinPrompt()')
  ok('and it opens a change-session form while live', d.getElementById('joinBox').hidden === false && /id="joinCode"/.test(d.getElementById('joinBox').innerHTML))
  w.close()
}

// ---------------------------------------------------------------------------
// The generated ECG agrees with the scenario text
//
// The review found VF rendering as a repeating template (ventricular flutter,
// not chaos), a Doppler pressure printed with a diastolic it cannot have, and
// 12-leads that did not show the stated inferior injury, hyperkalaemia or long
// QT. Each scenario stage now carries a testable ECG contract the printout is
// built from, checked here against the vitals and the text beside it.
// ---------------------------------------------------------------------------
{
  // VF is chaotic, not periodic.
  const { w, S } = loadMonitor()
  Object.assign(S(), { patientConnected: true, rhythm: 'vfib' })
  const sEcg = w.eval('sEcg')
  let diffs = 0, n = 0, lo = 1, hi = 0
  for (let t = 0; t < 3; t += 0.02) {
    n++
    if (Math.abs(sEcg(t) - sEcg(t + 0.2)) > 0.05) diffs++
    lo = Math.min(lo, sEcg(t)); hi = Math.max(hi, sEcg(t))
  }
  ok('VF does not repeat as a fixed template', diffs > n * 0.5, `${diffs}/${n} points differ a cycle apart`)
  ok('VF has coarse fibrillatory amplitude', hi - lo > 0.4, `range ${(hi - lo).toFixed(2)}`)
  ok('and stays within the trace bounds', lo >= 0 && hi <= 1, `${lo.toFixed(2)}..${hi.toFixed(2)}`)
  ok('the 12-lead computes QTc by Bazett', /qtVal\s*\/\s*Math\.sqrt\(rr\)/.test(MONITOR_SRC))
  ok('and flows the per-stage ECG contract into the 12-lead', /ecg:\s*S\.ecg\s*\|\|\s*null/.test(MONITOR_SRC))
  w.close()
}

{
  const { w, d, S } = load()
  const sims = w.eval('SIMULATIONS')
  const docs = w.eval('SCENARIO_DOCS')

  // Doppler yields a systolic only — no diastolic may be printed beside it.
  for (const st of sims.megacode3.states) {
    ok(`Megacode 3 "${st.id}" prints no Doppler diastolic`, !/\d+\/\d+\s*\(?Doppler/i.test(st.display), st.display)
  }
  ok('Megacode 3 still shows a Doppler systolic', /Doppler/.test(sims.megacode3.states[0].display))
  ok('and the brief explains why', /systolic only|systolic\b/i.test(docs.megacode3.brief.hpi) && /Doppler/.test(docs.megacode3.brief.hpi))

  // The three stages the review named each carry a contract that matches the
  // text beside them.
  const inj = sims.megacode3.states[0].ecg
  ok('Megacode 3 carries an inferior-injury contract', !!inj && /inferior/i.test(inj.interp) && /V4R/.test(inj.interp))
  ok('matching the note that describes the same injury', /II, III, aVF/.test(sims.megacode3.states[0].note) && /V4R/.test(sims.megacode3.states[0].note))

  const hyperk = sims.megacode4.states[3].ecg
  ok('Megacode 4 ROSC carries a hyperkalaemia contract', !!hyperk && /hyperkal/i.test(hyperk.interp))
  ok('with a marginally wide QRS, not the generic 90 ms', hyperk.qrs > 90, `${hyperk.qrs} ms`)
  ok('and its text describes the peaked T waves', /peaked T/i.test(sims.megacode4.states[3].note))

  const lqt = sims.megacode5.states[0].ecg
  ok('Megacode 5 carries a long-QT contract', !!lqt && /(prolonged|long) QT/i.test(lqt.interp))
  // The stated long QT must actually compute to a prolonged QTc at this rate —
  // the review's point was that a raw QT alone establishes nothing.
  const qtc = Math.round(lqt.qt / Math.sqrt(60 / sims.megacode5.states[0].vitals.hr))
  ok('and its QT computes to a genuinely prolonged QTc', qtc >= 500, `QTc ${qtc} ms at HR ${sims.megacode5.states[0].vitals.hr}`)

  // The contract flows to the monitor, and a stage without one clears it.
  d.getElementById('simScenarioSel').value = 'megacode3'
  w.applySimScenario()
  ok('applying a stage with a contract sets S.ecg', !!S().ecg && /inferior/i.test(S().ecg.interp))
  w.applySimState('megacode3', 1) // pVT — no contract
  ok('and moving to a stage without one clears it', S().ecg === null, JSON.stringify(S().ecg))
  w.close()
}

// ---------------------------------------------------------------------------
// LIFEPAK 15 fidelity tickets
// ---------------------------------------------------------------------------
{
  const { w, d, S } = loadMonitor()
  const D = () => w.eval('D')

  // HR blanks to --- while the unit is actively pacing (the pacing pulses swamp
  // the rate meter) — it must not read the paced number.
  Object.assign(S(), { patientConnected: true, rhythm: 'nsr', hr: 70, sbp: 110, dbp: 70 })
  w.eval('D.pacer = true; D.pacerMa = 70; upNums()')
  ok('HR shows --- during active pacing', d.getElementById('nHR').textContent === '---', d.getElementById('nHR').textContent)
  w.eval('D.pacerMa = 0; upNums()')
  ok('and shows the rate again when pacing current is off', d.getElementById('nHR').textContent === '70', d.getElementById('nHR').textContent)
  w.eval('D.pacer = false')

  // LEAD and SIZE open their menus rather than cycling a value per press.
  d.getElementById('kLEAD').dispatchEvent(new w.Event('click'))
  ok('LEAD opens the lead menu', (D().menu || {}).title === 'LEAD', String((D().menu || {}).title))
  w.eval('closeMenu()')
  d.getElementById('kSIZE').dispatchEvent(new w.Event('click'))
  ok('SIZE opens the size menu', (D().menu || {}).title === 'SIZE', String((D().menu || {}).title))
  w.eval('closeMenu()')

  // The chosen skin persists.
  w.eval("setSkin('lp')")
  ok('the skin is remembered', w.localStorage.getItem('ces.sim.skin') === 'lp')

  // CODE SUMMARY is a trainee-visible report built from the event log.
  w.eval("D.log.length=0; D.log.push({ms:Date.now(),type:'shock',label:'SHOCK',detail:'200J synchronized · shock #1'},{ms:Date.now(),type:'cpr',label:'CPR metronome ON',detail:''})")
  const rep = w.eval('buildCodeSummary()')
  ok('CODE SUMMARY counts the shocks', /Shocks delivered:\s*1/.test(rep), rep.slice(0, 120))
  ok('and lists the events', /SHOCK/.test(rep) && /CPR metronome ON/.test(rep))
  ok('CODE SUMMARY opens a report, not just a log line', /openCodeSummary\(\)/.test(MONITOR_SRC))

  // The audio check sounds a confirmation the first time it arms.
  ok('the audio check beeps on arming', /if\(audioArmed&&!was\)\s*beep/.test(MONITOR_SRC))
  ok('and the control reads as a test', /Audio check/.test(MONITOR_SRC))
  w.close()
}

{
  // The monitor opens in the LIFEPAK skin when told to, and can be locked.
  const { w, d } = loadMonitor({ 'ces.sim.skin': 'lp' })
  ok('a remembered LP skin opens in the LIFEPAK skin', d.body.classList.contains('lp-skin'))
  ok('the skin can be forced by URL param', /q\.get\('skin'\)/.test(MONITOR_SRC))
  ok('and locked so a competency session cannot switch it', /q\.get\('lock'\)/.test(MONITOR_SRC))
  ok('a locked skin hides the switch', /body\.skin-locked #skinLP\{display:none/.test(MONITOR_SRC))
  w.close()

  // The panel opens the monitor in the LP skin (this is the LIFEPAK program).
  const panelSrc = readFileSync(PAGE, 'utf8')
  ok('Open Monitor opens the LIFEPAK skin', /patient_monitor_display\.html\?skin=lp/.test(panelSrc))

  // The 12-lead carries calibration and acquisition metadata.
  ok('the 12-lead prints its paper speed', /25 mm\/s/.test(MONITOR_SRC))
  ok('and its gain', /10 mm\/mV/.test(MONITOR_SRC))
  ok('and a filter band', /0\.05[–-]150 Hz/.test(MONITOR_SRC))
  ok('and an acquisition date', /id="acqDate"/.test(MONITOR_SRC))

  // PRINT emerges as ECG paper, not blank stock.
  ok(
    'the printer paper is an ECG strip, not blank',
    /\.printdoor\.printing::after\{[^}]*repeating-linear-gradient/s.test(MONITOR_SRC),
    'the paper background is plain stock',
  )
}

// ---------------------------------------------------------------------------
// Facilitator workflow: a run is a competency record
//
// The review saved a PASS with 1 of 18 actions observed and no crew name.
// Ending a run now surfaces what is missing and asks before saving anyway, and
// the CPR numeric fields are constrained to sane ranges.
// ---------------------------------------------------------------------------
{
  const { w, d, S } = load()

  // A PASS with almost nothing observed, no crew, no note, is flagged.
  d.getElementById('simScenarioSel').value = 'megacode1'
  w.applySimScenario()
  w.setResult('pass')
  const warns = w.eval('runWarnings()')
  ok('an empty PASS run warns about the student name', warns.some((x) => /student|crew/.test(x)), warns.join(' | '))
  ok('and about the sheet having no instructor on it', warns.some((x) => /instructor/.test(x)), warns.join(' | '))
  ok('and about the missing result being unobserved actions', warns.some((x) => /1 of 18|of \d+ expected/.test(x)) || warns.some((x) => /PASS/.test(x)), warns.join(' | '))
  ok('and about the missing debrief note', warns.some((x) => /debrief/.test(x)))

  // The prompt is part of the page, not window.confirm() — a browser that
  // suppresses dialogs used to turn End run into a button that did nothing.
  w.confirm = () => {
    throw new Error('endRun must not reach window.confirm')
  }
  w.endRun()
  const prompt = d.getElementById('endPrompt')
  ok('a run with gaps opens the prompt in the page', prompt && !prompt.hidden)
  ok(
    'and the prompt lists what is missing',
    /student name/.test(d.getElementById('endPromptList').textContent),
    d.getElementById('endPromptList').textContent,
  )
  ok('nothing is saved while it is open', w.eval('run') !== null && w.eval('lastRun') === null)
  w.closeEndPrompt()
  ok('going back leaves the run open, unsaved', w.eval('run') !== null && w.eval('lastRun') === null)
  ok('and closes the prompt', prompt.hidden)

  // A complete run does not warn.
  const key = 'megacode1'
  const sims = w.eval('SIMULATIONS')
  // Observe every action across every phase.
  for (let i = 0; i < sims[key].states.length; i++) {
    w.applySimState(key, i)
    const acts = w.eval(`run.states[${i}].actions.length`)
    for (let j = 0; j < acts; j++) if (!w.eval(`run.states[${i}].actions[${j}].done`)) w.toggleAction(j)
  }
  w.setRunField('crew', 'Med 3 — Alvarez / Boyd')
  w.setRunField('notes', 'Strong code; timely defibrillation.')
  w.setInstructor('instructorInitials', 'JJ')
  if (w.eval('run.result') !== 'pass') w.setResult('pass') // setResult toggles; ensure PASS
  ok('a complete, labelled PASS run has nothing to warn about', w.eval('runWarnings()').length === 0, w.eval('runWarnings()').join(' | '))

  // CPR numeric fields are clamped to their range.
  w.setCpr('fraction', '140', 0, 100)
  ok('compression fraction clamps to 100', w.eval("run.cpr.fraction") === '100', w.eval('run.cpr.fraction'))
  w.setCpr('fraction', '-5', 0, 100)
  ok('and cannot go below 0', w.eval("run.cpr.fraction") === '0', w.eval('run.cpr.fraction'))
  w.setCpr('ventRate', '99', 0, 60)
  ok('ventilation rate clamps to its ceiling', w.eval("run.cpr.ventRate") === '60', w.eval('run.cpr.ventRate'))
  w.close()
}

{
  // a11y: the grading controls report their pressed state and the panel has a
  // visible focus ring.
  const panelSrc = readFileSync(PAGE, 'utf8')
  ok('state buttons report aria-pressed', /class="state-btn[^"]*"[^>]*aria-pressed=/.test(panelSrc))
  ok('expected-action toggles report aria-pressed', /class="act[^"]*"[^>]*aria-pressed=/.test(panelSrc))
  ok('the PASS/NR buttons report aria-pressed', /class="res-btn pass[^"]*"[^>]*aria-pressed=/.test(panelSrc))
  ok('the CPR numeric inputs are labelled and bounded', /aria-label="[^"]+"[^>]*value=/.test(panelSrc) && /min="0" max="100"/.test(panelSrc))
  ok('there is a visible focus ring', /:focus-visible\{[^}]*outline/s.test(panelSrc))
}

// ---------------------------------------------------------------------------
// Clinical content: the ACLS bradycardia and toxicology agents
//
// The review found no way to record atropine, a chronotropic infusion, or the
// calcium-channel-blocker / hyperkalaemia therapies the megacodes call for.
// ---------------------------------------------------------------------------
{
  const { w, d, S } = load()
  const DRUGS = w.eval('DRUGS')
  const panelSrc = readFileSync(PAGE, 'utf8')
  for (const k of ['atropine', 'dopamine', 'calcium', 'bicarb', 'insulin_dextrose', 'glucagon']) {
    ok(`the palette carries ${k}`, !!DRUGS[k], 'missing from the drug engine')
    ok(`and ${k} has a button`, panelSrc.includes(`data-drug="${k}"`), 'missing from the palette')
  }

  // Time is drivable through performance.now, as the other drug tests do.
  let T = 0
  Object.defineProperty(w.performance, 'now', { value: () => T, configurable: true })
  const advance = (ms) => { T += ms; w.drugTick() }

  // Atropine raises the rate on a perfusing bradycardia.
  d.getElementById('scenarioSel').value = 'brady'
  w.applyScenario()
  const hr0 = S().hr
  w.giveDrug('atropine')
  advance(20000)
  ok('atropine raises the rate on a perfusing bradycardia', S().hr > hr0, `HR ${S().hr} from ${hr0}`)
  advance(30000)
  ok('and wears off', S().hr === hr0, `HR ${S().hr}`)

  // But on a pulseless patient no agent manufactures perfusion (P0-3 holds for
  // the new drugs too).
  T = 0
  w.setR('asystole')
  w.giveDrug('calcium')
  advance(45000)
  ok('calcium produces no pressure on a pulseless patient', S().sbp === 0 && S().dbp === 0, `${S().sbp}/${S().dbp}`)
  w.close()
}

{
  // Program coaching notes are added to the megacodes without overwriting the
  // AHA-transcribed manual text.
  const { w, d } = load()
  const sims = w.eval('SIMULATIONS')

  const coach = (key, idx) => sims[key].states[idx].coach || ''
  ok('bradycardia coaching names pacing and an infusion', /pacing/i.test(coach('megacode1', 0)) && /(dopamine|epinephrine) infusion/i.test(coach('megacode1', 0)), coach('megacode1', 0))
  ok('the transplant case says atropine is ineffective, pace early', /denervated|ineffective/i.test(coach('megacode3', 0)) && /pacing/i.test(coach('megacode3', 0)))
  ok('the hyperkalaemia PEA defers to local protocol and is cautious on calcium/bicarb', /local protocol/i.test(coach('megacode4', 2)) && /not universally proven|cautious/i.test(coach('megacode4', 2)))
  ok('the CCB overdose names insulin/vasopressors/calcium as primary', /high-dose insulin/i.test(coach('megacode5', 0)) && /uncertain/i.test(coach('megacode5', 0)))

  // The AHA-transcribed note is still there beside the coaching — not replaced.
  ok('the manual note survives alongside the coaching', /heart transplant/i.test(sims.megacode3.states[0].note))

  // And it renders as a distinct, labelled block.
  d.getElementById('simScenarioSel').value = 'megacode5'
  w.applySimScenario()
  const panelHtml = d.getElementById('runCard').innerHTML + d.getElementById('simStatePanel').innerHTML
  ok('coaching renders as a labelled program note', /Program coaching/.test(panelHtml), 'coaching note not shown')
  w.close()
}

// ---------------------------------------------------------------------------
// The scenario drives itself off what the crew actually did
//
// A graded run starts with nothing attached: the crew is assessed on finding
// the rhythm, not on reading it off a screen that was live before they touched
// the patient. The facilitator marks each intervention as they watch it happen,
// and the monitor follows — the leads bring the screen up, oxygen moves the
// saturation, an advanced airway puts capnography on. Each mark also ticks
// whichever published checklist step it satisfies, so it is one tap, not two.
// ---------------------------------------------------------------------------
{
  const { w, d, S } = load()

  d.getElementById('simScenarioSel').value = 'megacode1'
  w.applySimScenario()
  ok('a graded run starts with the monitor blank', S().patientConnected === false, 'the screen was live before the crew touched the patient')
  ok('and with nothing marked as done', w.eval('JSON.stringify(crewDid)') === JSON.stringify({ monitor: false, o2: 'none', airway: 'none', access: 'none' }), w.eval('JSON.stringify(crewDid)'))

  // Leads on is what makes the screen live.
  w.setIntervention('monitor', true)
  ok('marking the monitor attached brings the screen up', S().patientConnected === true)
  ok('and it lands on the timeline', w.eval("deviceFeed.some(e => e.type === 'intervention' && /MONITOR/.test(e.label))"))
  // ...and satisfies the published step that names it, without editing that text.
  ok(
    'and ticks the checklist step that names placing the monitor',
    w.eval("run.states[run.current].actions.some(a => a.done && /places monitor|Places monitor/i.test(a.text))"),
    'the facilitator would have to tick it a second time by hand',
  )

  // Oxygen: a gradual climb toward the stage's target, not a jump.
  w.setIntervention('o2', 'nrb15')
  const startSpo2 = S().spo2
  const goal = w.eval('JSON.stringify(o2Goal())')
  ok('oxygen sets a target above where the patient started', JSON.parse(goal).target > startSpo2, goal)
  w.eval('o2Tick(); o2Tick()')
  const afterTwo = S().spo2
  ok('and the saturation climbs toward it rather than jumping', afterTwo > startSpo2 && afterTwo < JSON.parse(goal).target, `${startSpo2} -> ${afterTwo}, target ${JSON.parse(goal).target}`)
  for (let i = 0; i < 400; i++) w.eval('o2Tick()')
  ok('and settles at the target', S().spo2 === JSON.parse(goal).target, `${S().spo2} vs ${JSON.parse(goal).target}`)
  ok('the oxygen device is on the timeline', w.eval("deviceFeed.some(e => /OXYGEN/.test(e.label))"))

  // An advanced airway is what puts waveform capnography on the screen.
  ok('capnography is off until an airway is placed', S().etco2On === false, 'EtCO2 was already displayed')
  w.setIntervention('airway', 'ett')
  ok('an advanced airway turns capnography on', S().etco2On === true)
  w.close()
}

{
  // Oxygen cannot fix every hypoxia, and the scenarios say which.
  const { w, d, S } = load()
  d.getElementById('simScenarioSel').value = 'asthma_initial'
  w.applySimScenario()
  w.setIntervention('monitor', true)
  const before = S().spo2
  w.setIntervention('o2', 'nrb15')
  const g = w.eval('JSON.stringify(o2Goal())')
  ok('a scenario can say oxygen alone will not work', JSON.parse(g).blocked === true, g)
  for (let i = 0; i < 30; i++) w.eval('o2Tick()')
  ok('and then the saturation does not move on oxygen', S().spo2 === before, `${before} -> ${S().spo2}`)
  ok('and the timeline records that it did not respond', w.eval("deviceFeed.some(e => /NO RESPONSE/.test(e.label))"))

  // A pulseless patient never responds — there is no perfusion to carry it.
  w.setR('vfib')
  ok('oxygen does nothing for a pulseless patient', w.eval('o2Goal()') === null, 'an arrest was given an oxygen target')
  w.close()
}

{
  // Defibrillation transitions: the panel counts the shocks the script is
  // written around and offers the move as one tap. It never moves the patient
  // itself — a miscounted shock would otherwise convert a rhythm nobody did.
  const { w, d, S } = load()
  const sims = w.eval('SIMULATIONS')
  const withCue = Object.keys(sims).filter((k) => (sims[k].states || []).some((st) => st.advanceOn))
  ok('the defibrillation scenarios script a shock count', withCue.length === 5, withCue.join(','))

  d.getElementById('simScenarioSel').value = 'megacode1'
  w.applySimScenario()
  w.applySimState('megacode1', 1) // pulseless VT — scripted to move after the third shock
  ok('the pVT stage is scripted around three shocks', sims.megacode1.states[1].advanceOn.shocks === 3)
  ok('there is no cue before any shock', w.eval('advanceCue()') === null)

  const shock = () =>
    w.onDeviceEvent({ t: new Date().toISOString(), ms: Date.now(), type: 'shock', label: 'SHOCK', detail: '200J · shock' })
  const advBtn = () => {
    const b = d.querySelector('.adv-btn')
    return b ? `${b.className}|${b.textContent.trim()}` : 'MISSING'
  }
  ok('the stage offers a plain advance before any shock', /→ Advance to/.test(advBtn()), advBtn())

  shock(); shock()
  ok('and none after two', w.eval('advanceCue()') === null, 'the cue fired early')
  shock()
  const cue = w.eval('JSON.stringify(advanceCue())')
  ok('the third shock cues the transition', cue !== 'null', cue)
  ok('and the cue names the stage it moves to', /PEA/.test(cue), cue)
  // The cue has to reach the screen, not just the model. The count changes on a
  // device event, and nothing else repaints the card — so without an explicit
  // repaint the button sat there reading "Advance" while the shock that scripts
  // the transition had already been delivered.
  ok('and the button on screen becomes the cue', /cued/.test(advBtn()) && /Shock 3 delivered/.test(advBtn()), advBtn())

  // The cue is an offer. Until it is taken, the patient has not moved.
  ok('the patient has not moved on its own', w.eval('activeStateIdx') === 1, 'the panel converted the rhythm by itself')
  w.advanceStage()
  ok('taking the cue moves the patient on', w.eval('activeStateIdx') === 2)
  ok('and the shock count starts again for the new stage', w.eval('run.stageShocks') === 0, String(w.eval('run.stageShocks')))
  ok('so the cue is gone', w.eval('advanceCue()') === null)

  // The plain Advance control exists whatever the stage.
  const src = readFileSync(PAGE, 'utf8')
  ok('every stage offers a one-tap advance', /advanceStage\(\)"/.test(src))
  ok('and the last stage offers none', (w.applySimState('megacode1', 3), w.eval('nextStage()') === null))
  w.close()
}

{
  // Interventions belong to the run, like everything else it leaves behind.
  const { w, d, S } = load()
  d.getElementById('simScenarioSel').value = 'megacode1'
  w.applySimScenario()
  w.setIntervention('monitor', true)
  w.setIntervention('o2', 'nc4')
  w.setIntervention('access', 'io')
  ok('the interventions are set', w.eval("crewDid.o2") === 'nc4' && w.eval("crewDid.access") === 'io')
  d.getElementById('simScenarioSel').value = 'megacode4'
  w.applySimScenario()
  ok('a new scenario clears them', w.eval('JSON.stringify(crewDid)') === JSON.stringify({ monitor: false, o2: 'none', airway: 'none', access: 'none' }), w.eval('JSON.stringify(crewDid)'))
  ok('and blanks the monitor again', S().patientConnected === false)
  ok('and stops any oxygen trend', w.eval('o2Timer') === null)
  w.close()
}

// ---------------------------------------------------------------------------
// What a full megacode turned up
//
// Walking Megacode 1 end to end in a browser — leads, oxygen, access, airway,
// three shocks, the transition, epinephrine, ROSC, end run — found four things
// the unit checks had not: a step credited for work nobody did, a tick
// attributed to the wrong observer, the oxygen model overruling the scenario
// author, and a ticker still running after the run was over.
// ---------------------------------------------------------------------------
{
  const { w, d, S } = load()
  d.getElementById('simScenarioSel').value = 'megacode1'
  w.applySimScenario()

  // The published first step names three acts. Marking one must not tick it.
  const bundled = () =>
    w.eval("run.states[run.current].actions.find(a => /Starts oxygen.*places monitor.*starts IV/i.test(a.text)) || {}")
  w.setIntervention('monitor', true)
  ok(
    'marking the monitor does not credit the step that also names oxygen and IV',
    bundled().done !== true,
    'the crew was credited for oxygen and access they had not established',
  )
  // The step that names only the leads does tick.
  ok(
    'but the step that names only the leads does',
    w.eval("run.states[run.current].actions.some(a => a.done && /Places monitor leads/i.test(a.text))"),
  )
  w.setIntervention('o2', 'nrb15')
  ok('still not credited with two of the three done', bundled().done !== true)
  w.setIntervention('access', 'iv')
  ok('and it ticks once all three are marked', bundled().done === true, 'the bundled step never ticks')

  // A tick from the interventions strip is the facilitator's observation, not
  // the defibrillator reporting itself.
  ok(
    'an intervention tick is attributed to the facilitator',
    w.eval("run.states[run.current].actions.find(a => /Places monitor leads/i.test(a.text)).auto") === 'crew',
    'it was credited to the monitor',
  )
  w.onDeviceEvent({ t: '', ms: Date.now(), type: 'pacer', label: 'PACER ON', detail: '' })
  ok(
    'and a press at the defibrillator is attributed to the monitor',
    w.eval("run.states[run.current].actions.some(a => a.auto === 'monitor')"),
  )
  ok('the two are labelled differently on screen', /from interventions/.test(readFileSync(PAGE, 'utf8')))
  w.close()
}

{
  // The scenario author owns the numbers a stage carries. Oxygen the crew put
  // on earlier must not drag them somewhere else on a stage change — the ROSC
  // stage's authored 94% was climbing to 99% on its own.
  const { w, d, S } = load()
  d.getElementById('simScenarioSel').value = 'megacode1'
  w.applySimScenario()
  w.setIntervention('monitor', true)
  w.setIntervention('o2', 'nrb15')
  ok('oxygen starts a trend while the crew is acting', w.eval('!!o2Timer'))
  for (let i = 0; i < 40; i++) w.eval('o2Tick()')
  ok('and it moves the saturation', S().spo2 > 92, String(S().spo2))

  w.applySimState('megacode1', 3) // ROSC — authored at 94
  ok('a stage change stops the trend', w.eval('o2Timer') === null, 'the trend outlived the stage that started it')
  ok("and the stage's authored saturation stands", S().spo2 === 94, `${S().spo2} — the model overrode the author`)

  // Ending a run must leave nothing still moving the patient.
  w.setIntervention('o2', 'bvm')
  ok('the crew changing oxygen starts it again', w.eval('!!o2Timer'))
  endRunSaving(w)
  ok('ending the run stops the oxygen trend', w.eval('o2Timer') === null, 'it went on changing the patient behind the summary')
  w.close()
}

// ---------------------------------------------------------------------------
// The check-off sheet.
//
// A megacode is graded on the AHA Megacode Testing Checklist, so the run card
// lays that sheet out: the whole form in one column, the tick box on the right,
// the result at the foot. The quarterly scenarios have no such instrument and
// keep the per-phase actions column.
// ---------------------------------------------------------------------------
{
  const { w, d } = load()
  const panelSrcNow = readFileSync(PAGE, 'utf8')
  d.getElementById('simScenarioSel').value = 'megacode4'
  w.applySimScenario()
  const card = () => d.getElementById('runCard').innerHTML

  ok('a megacode renders the sheet', /class="sheet"/.test(card()))
  ok('headed as the published checklist', /Megacode Testing Checklist: Scenarios 4\/7\/10/.test(card()))
  ok('with the student and the date of test at the head', /Student/.test(card()) && /Date of test/.test(card()))
  ok('and the check column named as the form names it', /check if done correctly/.test(card()))

  // Every section, in the published order, not only the phase on screen.
  const headings = [...card().matchAll(/class="sh-sec-h">\s*([^<]+?)\s*</g)].map((m) => m[1])
  ok(
    'the whole form is on screen, in order',
    headings[0] === 'Team Leader/Team Members' &&
      headings.includes('Tachycardia Management') &&
      headings.includes('VF Management') &&
      headings.includes('PEA Management') &&
      headings.includes('Post–Cardiac Arrest Care'),
    headings.join(' | '),
  )
  ok('the phase the patient is in is marked', /class="sh-sec now"/.test(card()))

  // The correction the paper sheet allows: go back up the page.
  w.applySimState('megacode4', 2)
  ok('the run has moved to the third phase', w.eval('run.current') === 2)
  w.toggleActionAt(0, 1)
  ok(
    'a step in a section already left can still be ticked',
    w.eval('run.states[0].actions[1].done') === true,
    'on paper the whole sheet is in front of you',
  )
  ok('and it is ticked on screen', /class="sh-row done"/.test(card()))

  // Re-rendering the card replaces the sheet's markup, and a fresh element
  // starts at scrollTop 0 — which sent the instructor back to the top of the
  // form on every tick. Measured in a browser; jsdom lays nothing out, so what
  // is asserted here is that the render banks the position and puts it back.
  ok(
    'the render banks the sheet scroll position',
    /const scrollWas=sheetScrollState\(\);/.test(panelSrcNow),
  )
  ok('and restores it before scrolling to the phase', /restoreSheetScroll\(scrollWas\);\s*\n\s*syncSheetScroll\(\);/.test(panelSrcNow))

  // Starting a run must not scroll the card: the scenario, the student's name
  // and End run are all at the top of it, and the first section is where the
  // view already is.
  ok(
    'the first phase of a run does not scroll the card',
    /if\(wasPhase<0\) return;/.test(panelSrcNow),
  )
  // Every tick replaces the row that was clicked, and focus goes with it.
  ok('sheet rows carry a key that survives the re-render', /data-k="\$\{esc\(key\|\|''\)\}"/.test(panelSrcNow))
  w.eval("document.querySelectorAll('.sh-row')[3].focus()")
  const key = w.eval("document.activeElement.dataset.k")
  w.eval("document.activeElement.click()")
  ok(
    'and focus lands back on the same step after it',
    w.eval('document.activeElement.dataset.k') === key,
    `focus went to ${w.eval("document.activeElement.className||document.activeElement.tagName")}`,
  )

  // STOP TEST and the result block the sheet closes with.
  ok('the sheet closes with STOP TEST', /sh-stop/.test(card()) && /Stop test/i.test(card()))
  ok('over the PASS / NR the instructor circles', /res-btn pass/.test(card()) && /res-btn nr/.test(card()))
  ok('and the instructor block a registry needs', /Instr\. initials/.test(card()) && /Instr\. number/.test(card()))

  // The instructor is the same person all morning.
  w.setInstructor('instructorInitials', 'JJ')
  w.setInstructor('instructorNumber', 'KS-114')
  ok('the instructor is remembered on this machine', /KS-114/.test(w.localStorage.getItem('ces.sim.instructor') || ''))
  w.startRun('megacode4')
  ok('and carried into the next run', w.eval('run.instructorNumber') === 'KS-114', w.eval('run.instructorNumber'))

  // The published section heading goes onto the record, so a sheet printed
  // months later carries the headings it was graded under.
  w.applySimState('megacode4', 1)
  endRunSaving(w)
  ok(
    'the record carries the published section headings',
    w.eval("lastRun.states[1].section") === 'VF Management',
    w.eval('lastRun.states[1].section'),
  )
  ok('and the instructor of record', w.eval('lastRun.instructorInitials') === 'JJ')
  w.close()
}

{
  // A megacode is graded on the sheet, so the sheet is the window: no rail, and
  // the form gets the width and the height.
  const { w, d } = load()
  const src = readFileSync(PAGE, 'utf8')
  d.getElementById('simScenarioSel').value = 'megacode2'
  w.applySimScenario()
  ok('a megacode marks the page as a sheet run', d.body.classList.contains('sheet-run'))
  ok('and stands the rail down whatever the width', w.eval('railMode()') === false)
  ok(
    'the rail rules are scoped out of it',
    /body\.run-mode:not\(\.sheet-run\)\{padding-right/.test(src) &&
      /body:not\(\.sheet-run\) \.run-card\{position:fixed/.test(src),
  )
  ok(
    'the sheet takes the wide column and a taller box',
    /\.run-card\.sheet-run \.run-cols\{grid-template-columns:minmax\(190px,\.62fr\) minmax\(0,2\.5fr\)/.test(src) &&
      /\.run-card\.sheet-run \.sheet\{max-height:min\(72vh,780px\)/.test(src),
  )
  // The rail's overflow override must not reach a megacode, or the form sits in
  // a capped box with no way to scroll it.
  ok(
    'and it can still be scrolled',
    /body:not\(\.sheet-run\) \.sheet\{max-height:none;overflow:visible;\}/.test(src),
  )
  // A quarterly scenario keeps the layout it had.
  d.getElementById('simScenarioSel').value = 'drowning_initial'
  w.applySimScenario()
  ok('a quarterly scenario keeps the rail', !d.body.classList.contains('sheet-run'))
  w.close()
}

{
  // Capnography through an arrest: the patient is not breathing, but once the
  // crew have an advanced airway in they are ventilating, and the capnogram
  // shows their breaths at the rate the algorithm asks for.
  const { w, d, S } = load()
  d.getElementById('simScenarioSel').value = 'megacode2'
  w.applySimScenario()
  w.applySimState('megacode2', 1) // VF: authored RR 0, EtCO2 22
  ok('the arrest state carries the author’s numbers', S().rr === 0 && S().etco2 === 22)
  w.setIntervention('airway', 'ett')
  ok('an advanced airway turns capnography on', S().etco2On === true)
  ok('and ventilates at 10/min — one breath every six seconds', S().rr === 10, String(S().rr))
  ok('with a CPR capnogram', S().co2Shape === 'cpr', S().co2Shape)
  ok("the author's EtCO₂ is untouched", S().etco2 === 22, String(S().etco2))

  // It follows the patient into the next arrest stage rather than being set once.
  w.applySimState('megacode2', 2) // asystole, authored RR 0
  ok('the ventilation rate holds through the next arrest stage', S().rr === 10, String(S().rr))

  // A basic airway is not an advanced one.
  w.setIntervention('airway', 'basic')
  w.applySimState('megacode2', 2)
  ok('a basic airway does not ventilate for them', S().rr === 0, String(S().rr))
  w.close()
}

{
  // The EtCO₂ surge — the ROSC sign the crew is meant to notice.
  const { w, d, S } = load()
  d.getElementById('simScenarioSel').value = 'megacode2'
  w.applySimScenario()
  w.applySimState('megacode2', 1)
  w.setIntervention('airway', 'ett')
  ok('the surge is offered while it would mean something', w.eval('surgeReady()') === true)
  ok('and is on the card', /EtCO₂ surge/.test(d.getElementById('runCard').innerHTML))

  const start = S().etco2
  w.etco2Surge()
  ok('it does not jump the number', S().etco2 === start, 'a step change reads as a slider being moved')
  for (let i = 0; i < 4; i++) w.eval('surgeFloat+=(42-' + start + ')/12; setVital("etco2",Math.round(surgeFloat))')
  ok('it climbs', S().etco2 > start, String(S().etco2))
  ok('and the patient has not moved on', w.eval('activeStateIdx') === 1, 'the transition stays the facilitator’s')

  // Anything still moving the patient stops when the stage or the run does.
  w.applySimState('megacode2', 3)
  ok('a stage change stops the surge', w.eval('surgeTimer') === null)
  ok("and the ROSC stage's authored EtCO₂ stands", S().etco2 === 50, String(S().etco2))
  ok('the surge is not offered once there is a pulse', w.eval('surgeReady()') === false)
  w.close()
}

{
  // Advance is pressed at every rhythm change, standing up, while watching a
  // crew. Under the state list it is 590px down a stacked layout and not on
  // screen at all once the card is condensed, so it is rendered three times and
  // the CSS shows one.
  const { w, d } = load()
  const src = readFileSync(PAGE, 'utf8')
  d.getElementById('simScenarioSel').value = 'megacode2'
  w.applySimScenario()
  const card = () => d.getElementById('runCard').innerHTML

  const copies = [...card().matchAll(/class="adv-btn (adv-[a-z]+)/g)].map((m) => m[1])
  ok(
    'Advance is rendered under the states, in the header and in the condensed bar',
    ['adv-col', 'adv-head', 'adv-mini'].every((c) => copies.includes(c)),
    copies.join(' | '),
  )
  ok('two of the three are hidden by default', /\.adv-btn\.adv-head, \.adv-btn\.adv-mini\{display:none;\}/.test(src))
  ok(
    'the header copy takes over where the columns stack',
    /@media \(max-width:820px\)\{[\s\S]*?\.run-card \.adv-btn\.adv-col\{display:none;\}[\s\S]*?\.adv-btn\.adv-head\{display:block/.test(src),
  )
  ok(
    'and the condensed bar shows its own',
    /\.run-card\.condensed \.adv-btn\.adv-mini\{display:block/.test(src),
  )
  // The quick scenarios render Advance into the in-grid card, where it is the
  // only copy there is — the stacked-layout hide must not reach it.
  ok(
    'the quick scenarios keep their Advance at every width',
    /\.run-card \.adv-btn\.adv-col\{display:none;\}/.test(src) && !/^\.adv-btn\.adv-col\{display:none/m.test(src),
  )

  // Every copy says the same thing, including once the cue is up — which is a
  // property of the stage, so this has to be a stage that is scripted around
  // shocks.
  w.applySimState('megacode2', 1)
  w.eval('run.stageShocks=9; renderSimPanel("megacode2")')
  const labels = [...d.querySelectorAll('.adv-btn')].map((b) => b.textContent.trim())
  ok('every copy carries the same label', new Set(labels).size === 1, labels.join(' | '))
  ok('and the cue when the scripted shocks have landed', /⚡/.test(labels[0] || ''), labels[0])

  // The condensed bar is itself a button that expands the card; advancing from
  // it must not also open the card back up.
  w.eval('RAIL_MQ=null; collapseRunCard()')
  const before = w.eval('run.current')
  d.querySelector('.adv-btn.adv-mini').click()
  ok('advancing from the condensed bar moves the patient', w.eval('run.current') === before + 1)
  ok(
    'and leaves the card condensed',
    d.getElementById('runCard').classList.contains('condensed'),
    'the tap fell through to the bar behind it',
  )
  ok('every copy is a 44px target', /\.adv-btn\{display:block;width:100%;min-height:44px/.test(src))
  w.close()
}

{
  // Type. The check rows were 10.2px and the two labels above them 9px in the
  // tone the tokens reserve for non-essential text — that is the student's name
  // and the date of test, read across a classroom.
  const src = readFileSync(PAGE, 'utf8')
  ok('the check rows are set at .72rem', /\.sh-row\{[^}]*font-size:\.72rem/s.test(src))
  ok('the section bands at .66rem', /\.sh-sec-h\{[^}]*font-size:\.66rem/s.test(src))
  ok('the sheet head fields at .72rem', /\.sh-meta input\{[^}]*font-size:\.72rem/s.test(src))
  ok(
    'and nothing on the sheet is left in the faintest tone',
    !/\.sh-[a-z-]+[^{]*\{[^}]*color:var\(--t-faint\)/s.test(src),
  )
  ok('the transition prose is readable at arm’s length', /\.trig\{font-size:\.66rem;color:var\(--t\)/.test(src))
  ok('and so is the debrief summary', /\.run-sum\{font-size:\.68rem/.test(src))
}

{
  // Ended by mistake. End run & save sits beside controls that get pressed
  // constantly, and until now it was final: the record was filed and putting it
  // right meant deleting it in CES and running the scenario again.
  const { w, d } = load()
  d.getElementById('simScenarioSel').value = 'megacode2'
  w.applySimScenario()
  w.setRunField('crew', 'Alex Rivera')
  w.setRunField('notes', 'Good code.')
  w.setInstructor('instructorInitials', 'JJ')
  w.applySimState('megacode2', 1)
  w.toggleActionAt(0, 0)
  w.toggleActionAt(1, 2)
  w.setResult('pass')
  endRunSaving(w)
  ok('the run is closed and summarised', w.eval('run') === null && !!w.eval('lastRun'))
  ok('and the summary offers a way back', /Reopen this run/.test(d.getElementById('runCard').innerHTML))

  w.reopenRun()
  ok('reopening puts the run back on the clock', !!w.eval('run') && w.eval('lastRun') === null)
  ok('with the steps that were checked', w.eval('run.states[0].actions[0].done') === true)
  ok('and the ones that were not', w.eval('run.states[1].actions[0].done') === false)
  ok('with the result', w.eval('run.result') === 'pass')
  ok('the student', w.eval('run.crew') === 'Alex Rivera')
  ok('the instructor', w.eval('run.instructorInitials') === 'JJ')
  ok('the note', w.eval('run.notes') === 'Good code.')
  ok('and the time already banked', w.eval('run.states.reduce((n,s)=>n+s.seconds,0)') >= 0)
  ok('the clock is running again', w.eval('run.current') >= 0 && w.eval('!!run.enteredAt'))

  // Reopening has to take the record back off CES, or ending the run a second
  // time leaves two records of one megacode.
  ok(
    'and CES is told to withdraw the record it filed',
    /postMessage\(\{type:'ces-sim-unsave'\}/.test(readFileSync(PAGE, 'utf8')),
  )

  // Ending it again files one record, not a second.
  w.toggleActionAt(1, 0)
  endRunSaving(w)
  ok('ending it again produces one finished run', !!w.eval('lastRun') && w.eval('run') === null)
  ok('carrying the extra step', w.eval('lastRun.states[1].actions[0].done') === true)
  w.close()
}

{
  // A quarterly scenario has no AHA sheet — its approved document defines no
  // outcome — so it keeps the per-phase actions column and gains no result.
  const { w, d } = load()
  d.getElementById('simScenarioSel').value = 'drowning_initial'
  w.applySimScenario()
  const card = () => d.getElementById('runCard').innerHTML
  ok('the quarterly scenario is running', w.eval('run && run.scenario') === 'drowning')
  ok('a quarterly scenario renders no check-off sheet', !/class="sheet"/.test(card()))
  ok('and keeps its expected-actions column', /Expected actions/.test(card()))
  ok('with no PASS / NR to circle', !/res-btn/.test(card()))
  w.close()
}

// ---------------------------------------------------------------------------
// Measurements, not vital signs.
//
// A cuff reading and a temperature are things somebody took. The screen used to
// hand both over the moment the panel published them, which at ROSC meant the
// crew were told the pressure was back before anyone had put a cuff on the
// patient — the assessment done for them.
// ---------------------------------------------------------------------------
{
  const { w, d, S } = loadMonitor()
  Object.assign(S(), { patientConnected: true, hr: 76, sbp: 118, dbp: 76, temp: 36.8 })

  ok('the unit opens with no cuff reading', w.eval('D.nibp') === null)
  ok('and no temperature probe on the patient', w.eval('D.tempProbe') === false)

  w.startNibp()
  ok('pressing NIBP starts a cycle', w.eval('nibpBusy()') === true)
  w.finishNibp()
  const reading = w.eval('D.nibp')
  ok('the cycle produces a reading', reading && reading.sys === 118 && reading.dia === 76, JSON.stringify(reading))

  // A snapshot, not a mirror: the patient moves on, the reading does not.
  Object.assign(S(), { sbp: 180, dbp: 108 })
  ok(
    'and it does not follow the patient afterwards',
    w.eval('D.nibp.sys') === 118,
    'a cuff reading is of the moment it was taken',
  )

  // In an arrest there is nothing for a cuff to find.
  Object.assign(S(), { sbp: 0, dbp: 0 })
  w.eval('D.nibpUntil=0')
  w.startNibp()
  w.finishNibp()
  ok('a cycle in arrest produces no reading', w.eval('D.nibp') === null)
  ok('and says so', /NIBP UNABLE TO MEASURE/.test(MONITOR_SRC))

  // Temperature waits for a probe, and the probe is on the block's own menu.
  ok('the temperature block has a probe control', /Place temperature probe/.test(MONITOR_SRC))
  ok('and the display is gated on it', /\(nc\|\|!D\.tempProbe\)\?'---'/.test(MONITOR_SRC))

  // A new scenario is a unit nobody has measured anything with yet.
  w.eval('D.nibp={sys:1,dia:1,at:1}; D.tempProbe=true; resetDevice()')
  ok('a new scenario clears both', w.eval('D.nibp') === null && w.eval('D.tempProbe') === false)
  w.close()
}

// ---------------------------------------------------------------------------
// Ventilation through an advanced airway.
//
// An arrest state carries RR 0, which is true of the patient and stops being
// what the monitor should show the moment somebody puts a tube in and starts
// bagging them. Two rates: one breath every six seconds in an arrest, faster
// once there is a pulse — and the capnogram has to be drawn at whichever one
// is running, which is where this was wrong. The CPR trace was drawn at a
// fixed 100 per minute, the compression rate, so a crew ventilating once every
// six seconds watched a waveform chattering ten times faster than they bagged.
// ---------------------------------------------------------------------------
{
  const { w, d, S } = load()
  d.getElementById('simScenarioSel').value = 'megacode2'
  w.applySimScenario()

  w.applySimState('megacode2', 1) // VF — authored RR 0
  w.setIntervention('airway', 'ett')
  ok('an arrest is ventilated at one breath every six seconds', S().rr === 10, String(S().rr))
  ok('with the CPR capnogram', S().co2Shape === 'cpr', S().co2Shape)

  w.applySimState('megacode2', 3) // ROSC — a pulse, and still being bagged
  ok('a patient with a pulse is ventilated faster', S().rr === 12, String(S().rr))
  ok('and the capnogram goes back to a normal waveform', S().co2Shape === 'normal', S().co2Shape)
  ok("and the stage's authored EtCO₂ still stands", S().etco2 === 50, String(S().etco2))

  // A scenario that authored its own waveform keeps it — this rule owns the
  // two shapes it switches between and nothing else.
  w.eval("S.co2Shape='shark'")
  w.setIntervention('airway', 'sga')
  ok('an authored waveform is left alone', S().co2Shape === 'shark', S().co2Shape)
  w.close()
}

{
  // Monitor side: the CPR capnogram is drawn at the ventilation rate.
  const { w, S } = loadMonitor()
  Object.assign(S(), { patientConnected: true, etco2On: true, etco2: 22, co2Shape: 'cpr', rr: 10 })
  const sCo2 = w.eval('sCo2')
  // Sample a whole minute at 20Hz and count the breaths — a rising edge out of
  // the baseline is one ventilation.
  const breaths = (rate) => {
    Object.assign(S(), { rr: rate })
    let n = 0
    let was = false
    for (let i = 0; i < 60 * 20; i++) {
      const v = sCo2(i / 20)
      const up = v > 0.25
      if (up && !was) n++
      was = up
    }
    return n
  }
  const at10 = breaths(10)
  const at20 = breaths(20)
  ok('the CPR capnogram draws one breath per ventilation', at10 >= 9 && at10 <= 11, `${at10} breaths at RR 10`)
  ok('and follows the rate when it changes', at20 >= 18 && at20 <= 22, `${at20} breaths at RR 20`)
  ok(
    'not the compression rate it used to be locked to',
    at10 < 30,
    `${at10} breaths at RR 10 — the old trace drew 100/min whatever the crew did`,
  )
  ok('compressions still show on the trace', /COMPRESSION_RATE/.test(MONITOR_SRC))
  w.close()
}

// ---------------------------------------------------------------------------
// The ON key, and the screen staying up.
// ---------------------------------------------------------------------------
{
  // The unit as it opens: off, the way it sits on the shelf. The crew turning
  // it on is the first thing they do with it, and on a megacode it is part of
  // what is being watched.
  const { w, d } = loadMonitor({}, { powerOn: false })
  ok('the unit opens powered off', w.eval('D.on') === false)
  ok('with a dark screen', d.body.classList.contains('powered-off'))

  const el = () => d.getElementById('kON')
  // Down and up with nothing between them is a tap — the hold that powers the
  // unit off is a real three-second timer, which no synchronous press reaches.
  const press = () => {
    const k = el()
    k.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true }))
    k.dispatchEvent(new w.PointerEvent('pointerup', { bubbles: true }))
  }
  press()
  ok('a press brings it up', w.eval('D.on') === true)
  ok('through a self test', d.body.classList.contains('booting'))
  ok('and the screen with it', !d.body.classList.contains('powered-off'))

  // A press while it is already on does nothing — powering down is the harder
  // gesture on purpose, because it is the one that loses the screen mid-code.
  press()
  ok('a second press leaves it on', w.eval('D.on') === true, 'a stray press must not black out the screen')

  // Three seconds of hold is what takes it down.
  ok('powering off takes a three-second hold', /const POWER_OFF_HOLD_MS=3000/.test(MONITOR_SRC))
  ok('and that is what the key is wired to', /bindHold\('kON',POWER_OFF_HOLD_MS/.test(MONITOR_SRC))
  w.eval('setPower(false)')
  ok('which turns it off', w.eval('D.on') === false)
  ok('and darkens the screen', d.body.classList.contains('powered-off'))

  // Off is off: no alarm can sound through a unit that is switched off.
  ok('alarms are gated on the unit being on', /const almShow=D\.on&&/.test(MONITOR_SRC))
  // Powering off is not a reset — the shock count and the log are the crew's.
  w.eval('D.shocks=3; setPower(false); setPower(true)')
  ok('and the shock count survives a power cycle', w.eval('D.shocks') === 3)

  // The screen wake lock, which is what stops an iPad locking mid-code.
  ok('the monitor holds a screen wake lock', /navigator\.wakeLock\.request\('screen'\)/.test(MONITOR_SRC))
  ok('and takes it again when the page comes back', /visibilitychange/.test(MONITOR_SRC))
  ok('every call is guarded', /if\(!\('wakeLock' in navigator\)/.test(MONITOR_SRC))
  w.close()
}

if (failures.length) {
  console.error(`check-simulator: ${failures.length} of ${checks} checks failed\n`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`check-simulator: ${checks} checks passed`)
