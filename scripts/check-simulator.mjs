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
  return {
    w,
    d: w.document,
    // `let S` is a lexical binding, not a property of window.
    S: () => w.eval('S'),
    text: (id) => w.document.getElementById(id)?.textContent,
  }
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
  w.sv('sbp', 200)
  ok('systolic is still capped in V-Tach', S().sbp === 62, String(S().sbp))
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

  // Arrest — no clamp floor may survive the drug.
  T = 0
  w.setR('asystole')
  w.giveDrug('epi_acls')
  advance(45000)
  ok('epinephrine produces a pressure in arrest', S().sbp > 0, `SBP ${S().sbp}`)
  advance(50000)
  ok('which returns to 0/0, not a clamp floor', S().sbp === 0 && S().dbp === 0, `${S().sbp}/${S().dbp}`)

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
}

// ---------------------------------------------------------------------------
// The monitor
//
// It draws to canvas, which jsdom does not implement. Everything asserted here
// is the arithmetic behind the trace rather than the pixels, so a no-op 2D
// context is enough to let the page finish loading.
// ---------------------------------------------------------------------------
const MONITOR_SRC = readFileSync(MONITOR, 'utf8')

function loadMonitor(storage = {}) {
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

if (failures.length) {
  console.error(`check-simulator: ${failures.length} of ${checks} checks failed\n`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`check-simulator: ${checks} checks passed`)
