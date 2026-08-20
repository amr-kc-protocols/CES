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
  w.endRun()
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
  w.endRun()
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
{
  const { w, d, S } = load()
  const key = Object.keys(w.eval('SCENARIO_DOCS')).find((k) => k.startsWith('megacode'))
  w.applySimState(key, 0)
  w.startRun(key)
  w.enterRunState(0)
  w.renderSimPanel(key)
  const prompt = () => d.getElementById('pacerPrompt')
  const feed = (type, label, detail) =>
    w.onDeviceEvent({ t: new Date().toISOString(), ms: Date.now(), type, label, detail })

  ok('no pacing prompt before the crew paces', prompt() && prompt().hidden === true)
  feed('pacer', 'PACER ON', '70 ppm · 0 mA')
  ok(
    'and none at zero current',
    prompt().hidden === true,
    'the pacer is on but delivering nothing — there is nothing to capture yet',
  )
  feed('pacerCurrent', 'PACING CURRENT', '70 mA')
  feed('pacerRate', 'PACING RATE', '90 ppm')
  ok('the prompt appears once current is set', prompt().hidden === false)
  ok(
    'and carries the settings the crew dialled in',
    /90 ppm/.test(prompt().textContent) && /70 mA/.test(prompt().textContent),
    prompt().textContent.replace(/\s+/g, ' ').trim(),
  )

  // Capture is the patient answering the impulse, so it stays a press the
  // facilitator makes — but at the crew's rate, in one press, rather than
  // requiring them to know that "Paced" in the rhythm list is the answer.
  const before = { rhythm: S().rhythm, hr: S().hr }
  w.giveCapture()
  ok('giving capture paces the patient', S().rhythm === 'paced', S().rhythm)
  ok('at the rate the crew set', S().hr === 90, String(S().hr))
  ok('and the prompt offers to take it away', /Take capture away/.test(prompt().textContent))
  w.loseCapture()
  ok(
    'losing capture returns the rhythm that was there',
    S().rhythm === before.rhythm && S().hr === before.hr,
    `${S().rhythm} ${S().hr}, expected ${before.rhythm} ${before.hr}`,
  )
  ok(
    'both are on the same timeline as the crew’s presses',
    w.eval("run.device.filter(e => e.type === 'capture').length") === 2,
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
  ok(
    'the debrief checklist starts collapsed',
    /let clOpen=false;/.test(panelSrc),
    'it was 190px of the most valuable space on the screen, for controls nobody touches until the end',
  )
  ok('and its summary keeps the tally in view', /cl-tally/.test(panelSrc) && /cl-res/.test(panelSrc))

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
  const bodyPad = parseInt((rail.match(/body\.run-mode\{padding-right:(\d+)px/) || [])[1] || 0)
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

    // Condensing, with layout faked — jsdom has none.
    const past = (yes) =>
      w.eval(`document.getElementById('runSentinel').getBoundingClientRect=()=>({bottom:${yes ? -10 : 10}})`)
    const cond = () => w.eval("document.getElementById('runCard').classList.contains('condensed')")
    const width = (px) => w.eval(`Object.defineProperty(window,'innerWidth',{value:${px},configurable:true})`)
    width(1180)
    past(false); w.eval('applyRunCondense()')
    ok('the card is whole while it is still on screen', !cond())
    past(true); w.eval('applyRunCondense()')
    ok('and condenses once the page has scrolled past it', cond())
    w.eval('expandRunCard()')
    ok('a tap opens it again', !cond())
    w.eval('applyRunCondense()')
    ok('and it stays open while the facilitator works below it', !cond())
    past(false); w.eval('applyRunCondense()')
    past(true); w.eval('applyRunCondense()')
    ok('scrolling back to the top resets that', cond())
    width(1440)
    w.eval('RAIL_MQ=null; applyRunCondense()')
    ok('the rail never condenses — it costs no vertical space to start with', !cond())
    width(1180)
    w.eval('RAIL_MQ=null; endRun(); applyRunCondense()')
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

if (failures.length) {
  console.error(`check-simulator: ${failures.length} of ${checks} checks failed\n`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`check-simulator: ${checks} checks passed`)
