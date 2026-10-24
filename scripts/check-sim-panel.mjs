// Behaviour check for the simplified simulator control panel.
//
// public/simulator/control_panel.html is the facilitator's screen for the
// ventilator course: the Day 2 cases, vitals-only starting points, the
// patient's numbers, rhythm, medications, the 12-lead and sharing to an iPad.
// Nothing else. (The full panel, with the ACLS, PALS and quarterly cases and
// the grading, is control_panel_full.html; check-simulator.mjs covers it.)
//
// What this protects, in the order a class would find it broken:
//
//   - A button that does nothing. Every control on the page names a function
//     that exists.
//   - The crew's monitor blanking because the panel reloaded. The panel used
//     to start from the defaults every time, and the defaults are a
//     disconnected patient.
//   - An iPad left frozen because the panel reloaded and forgot the session.
//   - A number that jumps on the crew's screen when the facilitator types it,
//     rather than trending there.
//   - The ventilator course's own rules: trends over the guide's times, the
//     state that starts by itself, and the "X Worse" branch Advance skips.
//
// Run: node scripts/check-sim-panel.mjs  (or `npm run check:simpanel`)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { skip } from './lib/check-kit.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const PAGE = join(here, '..', 'public', 'simulator', 'control_panel.html')
const MONITOR = join(here, '..', 'public', 'simulator', 'patient_monitor_display.html')
const SRC = readFileSync(PAGE, 'utf8')

let JSDOM, VirtualConsole
try {
  ;({ JSDOM, VirtualConsole } = await import('jsdom'))
} catch {
  skip('check-sim-panel', 'jsdom not installed', 'npm install to enable')
}

const failures = []
let checks = 0
function ok(name, cond, detail = '') {
  checks++
  if (!cond) failures.push(detail ? `${name} — ${detail}` : name)
}

/** The panel, optionally over a localStorage left by an earlier page. */
function load(storage = {}, { relay } = {}) {
  const errors = []
  const vc = new VirtualConsole().on('jsdomError', (e) => errors.push(e.message))
  const dom = new JSDOM(SRC, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://ces.local/simulator/control_panel.html',
    virtualConsole: vc,
    beforeParse(w) {
      for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
      if (relay) w.CESRelay = relay
    },
  })
  const w = dom.window
  // The checks own the clock: a glide is a question of time.
  let now = Date.now()
  w.Date.now = () => now
  const tick = (secs, fn = 'glideTick') => { now += secs * 1000; w.eval(`${fn}()`) }
  return { w, d: w.document, S: () => w.eval('S'), tick, errors, setNow: (t) => { now = t } }
}

// ---------------------------------------------------------------------------
// What is on the screen
// ---------------------------------------------------------------------------
{
  const { w, d, errors } = load()
  ok('the panel loads without a script error', errors.length === 0, errors.join('; '))
  ok('it keeps the title the app checks for', d.title === 'Simulator Control Panel')

  const groups = [...d.querySelectorAll('#caseSel optgroup')].map((g) => g.label)
  ok('the cases are the ventilator course and vitals only', JSON.stringify(groups) ===
    JSON.stringify(['Ventilator course — Day 2', 'Vitals only — no script']), groups.join(' | '))
  const values = [...d.querySelectorAll('#caseSel option')].map((o) => o.value)
  ok('no ACLS, PALS or quarterly case is offered', !values.some((v) => /megacode|pals|drowning|asthma|trauma|tbi_initial/.test(v)), values.join(','))
  ok('all six ventilator cases are', ['vent_ards', 'vent_copd', 'vent_tbi', 'vent_dka', 'vent_als', 'vent_peds'].every((k) => values.includes(k)))
  for (const v of values)
    ok(`case ${v} loads something`, v.startsWith('p:') ? !!w.eval('PRESETS')[v.slice(2)] : !!w.eval('CASES')[v])

  // A control whose handler is not a function is a button that does nothing.
  const handlers = new Set()
  for (const el of d.querySelectorAll('[onclick],[onchange]'))
    for (const attr of ['onclick', 'onchange'])
      for (const m of (el.getAttribute(attr) || '').matchAll(/([A-Za-z_]\w*)\(/g)) handlers.add(m[1])
  const missing = [...handlers].filter((f) => typeof w[f] !== 'function')
  ok('every control on the page calls something that exists', missing.length === 0, missing.join(', '))

  // What the simplification took out, held out. Comments may say where it
  // went; the markup and the code may not have it.
  const CODE = SRC.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const [what, re] of [
    ['grading', /End run|check-off|checklist|Debrief note|Crew being assessed/i],
    ['point-of-care results', /Point-of-care|sendPoc/],
    ['the arterial line and Swan-Ganz', /A-Line|Swan|artBtn|sgBtn/],
    ['the physiology lock switch', /PHYS LOCK|togglePhysLock/],
    ['the start path', /startPath|Choose a case<\/span>/],
  ]) ok(`no ${what} on the panel`, !re.test(CODE), (CODE.match(re) || [''])[0])
  ok('the monitor status and Open monitor are hidden in the app, which has its own', /body\.framed \.standalone\{display:none;\}/.test(SRC))
  ok('so is the panel\'s own title row', /body\.framed \.top\{display:none;\}/.test(SRC))
  ok('no temperature field — the LIFEPAK shows none until the crew attaches a probe', !d.getElementById('temp'))
  w.close()
}

// ---------------------------------------------------------------------------
// Switching cases in front of the crew
// ---------------------------------------------------------------------------
{
  const { w, d, S } = load()
  const box = d.getElementById('switchBox'), sel = d.getElementById('caseSel')
  w.pickCase('vent_ards')
  ok('with nothing on the monitor a case loads at once', w.eval('caseKey') === 'vent_ards' && box.hidden)
  w.toggleConnect()
  w.pickCase('vent_copd')
  ok('with the patient on the monitor it asks first', !box.hidden && /COPD/.test(d.getElementById('switchText').textContent))
  ok('and nothing has changed yet', w.eval('caseKey') === 'vent_ards' && S().hr === 112 && sel.value === 'vent_ards')
  w.cancelSwitch()
  ok('keeping the current case keeps it', w.eval('caseKey') === 'vent_ards' && box.hidden && sel.value === 'vent_ards')
  w.pickCase('vent_copd'); w.confirmSwitch()
  ok('switching switches', w.eval('caseKey') === 'vent_copd' && S().hr === 98 && box.hidden)
  w.close()
}

// ---------------------------------------------------------------------------
// Coming back after a reload
// ---------------------------------------------------------------------------
{
  const at = Date.now()
  const live = { patientConnected: true, hr: 128, rhythm: 'tachy', spo2: 84, etco2: 0, rr: 0, co2Shape: 'flat', etco2On: true }
  const { S, d, w } = load({ simState: live, 'ces.sim.panel': { at, caseKey: 'vent_ards', stateIdx: 1, stateAt: at - 42000 } })
  ok('a reload keeps the patient on the crew\'s monitor', S().patientConnected === true)
  ok('with the numbers they were reading', S().hr === 128 && S().spo2 === 84 && S().co2Shape === 'flat')
  ok('and the case and state the facilitator was in', w.eval('caseKey') === 'vent_ards' && w.eval('stateIdx') === 1)
  ok('and says so on the case card', d.querySelector('.state.active b').textContent === 'Disconnect')
  ok('with its clock still running from when the state began', d.getElementById('stateClock').textContent === 'In Disconnect · 0:42', d.getElementById('stateClock').textContent)
  ok('the restored patient is what it publishes', JSON.parse(w.localStorage.getItem('simState')).hr === 128)
  w.close()

  const stale = load({ simState: live, 'ces.sim.panel': { at: at - 13 * 3600e3, caseKey: 'vent_ards', stateIdx: 1 } })
  ok('yesterday\'s patient is not restored', stale.S().patientConnected === false && stale.S().hr === 78)
  stale.w.close()
}

// ---------------------------------------------------------------------------
// Sharing to an iPad, and staying shared
// ---------------------------------------------------------------------------
{
  const joins = []
  const relay = {
    normaliseCode: (c) => String(c || '').toUpperCase().slice(0, 6),
    newSessionCode: () => 'NEWONE',
    leaveSession: () => {},
    joinSession: (o) => { joins.push(o); return { send: () => {}, code: () => o.code } },
  }
  const { w } = load({ 'ces.sim.panelSession': { code: 'KCMT24', at: Date.now() } }, { relay })
  await new Promise((r) => setTimeout(r, 50))
  ok('a session shared before a reload is rejoined', joins.length === 1 && joins[0].code === 'KCMT24', JSON.stringify(joins.map((j) => j.code)))
  joins[0].onStatus('error', 'TIMED_OUT')
  ok('a dropped session is retried rather than left on an error', w.eval('relayRetry') !== null)
  ok('and the panel says it is reconnecting', /Reconnecting/.test(w.document.getElementById('shareBox').textContent))
  ok('while sharing, the share button gives way to the code', w.document.getElementById('shareBtn').hidden && !w.document.getElementById('shareBox').hidden)
  w.eval('endSession()')
  ok('stopping sharing stops the retry and forgets the code', w.eval('relayRetry') === null && !w.localStorage.getItem('ces.sim.panelSession'))
  ok('and brings the share button back', !w.document.getElementById('shareBtn').hidden && w.document.getElementById('shareBox').hidden)
  ok('the panel keeps its own key, not the monitor\'s', !/'ces\.sim\.session'/.test(SRC))
  ok('a monitor saying hello is answered with the patient', /if\(msg\.hello\)\{ if\(bc\) bc\.postMessage\(S\); if\(relayReady\(\)\) relay\.send\(S\); \}/.test(SRC))
  ok('the whole state is republished while shared', /setInterval\(\(\)=>\{ if\(relayReady\(\)\) relay\.send\(S\); \},2000\);/.test(SRC))
  w.close()
}

// ---------------------------------------------------------------------------
// Numbers that walk
// ---------------------------------------------------------------------------
{
  const { w, d, S, tick } = load()
  w.loadCase('p:normal')
  w.commit('spo2', '87')
  ok('a typed SpO₂ does not jump', S().spo2 === 97, String(S().spo2))
  ok('the field says where it is going', d.getElementById('to-spo2').textContent === '→ 87')
  tick(5)
  ok('it is halfway at 5 s', S().spo2 === 92, String(S().spo2))
  tick(5)
  ok('and there at 10 s', S().spo2 === 87 && d.getElementById('to-spo2').textContent === '')

  w.commit('rr', '24')
  ok('the respiratory rate lands at once — it is the rate being breathed', S().rr === 24)

  w.commit('hr', '130')
  tick(4)
  ok('a sinus rhythm reads as what its rate is on the way', S().hr === 99 && S().rhythm === 'nsr', `${S().hr} ${S().rhythm}`)
  tick(6)
  ok('and becomes sinus tachycardia when it gets there', S().hr === 130 && S().rhythm === 'tachy', `${S().hr} ${S().rhythm}`)

  // Two numbers moving at once do not interrupt each other.
  w.commit('sbp', '90'); tick(5); w.commit('spo2', '80')
  tick(5)
  ok('one glide does not stop another', S().sbp === 90, String(S().sbp))

  // A field being typed in is not overwritten under the facilitator's hand.
  const f = d.getElementById('hr'); f.focus(); f.value = '14'
  w.commit('spo2', '70'); tick(2)
  ok('a field with focus is left alone', f.value === '14')
  f.blur()

  // Arrest rhythms land, with their consequences.
  w.setRhythm('vfib')
  ok('V-fib takes the pressure, the saturation and the breathing at once', S().sbp === 0 && S().dbp === 0 && S().spo2 <= 3 && S().rr === 0)
  w.commit('sbp', '120'); tick(10)
  ok('and nothing typed gives it a pressure back', S().sbp === 0)
  w.setRhythm('nsr')
  ok('a rhythm change lands with its own rate', S().hr === 78)
  w.close()
}

// ---------------------------------------------------------------------------
// The ventilator course
// ---------------------------------------------------------------------------
{
  const { w, d, S, tick } = load()
  const cases = w.eval('CASES')
  for (const [k, c] of Object.entries(cases)) {
    for (const st of c.states) {
      ok(`${k} ${st.id}: capnography on`, st.vitals.etco2On === true)
      ok(`${k} ${st.id}: a waveform the panel offers`, [...d.querySelectorAll('#co2Shape option')].some((o) => o.value === st.vitals.co2Shape), st.vitals.co2Shape)
    }
    for (const st of c.states.filter((x) => x.branch))
      ok(`${k} ${st.id}: returns to a recovery state`, !!c.states[st.returnTo] && !c.states[st.returnTo].branch)
  }

  // The way on from a state is a button per trigger, named for where it goes
  // and carrying the guide's words for when.
  const go = (id) => (d.getElementById(id) ? d.getElementById(id).querySelector('b').textContent : null)
  const why = (id) => d.getElementById(id).querySelector('span').textContent
  const left = (id) => d.getElementById(id).querySelector('.left').textContent
  w.loadCase('vent_ards')
  ok('ARDS loads at baseline, at once', S().hr === 112 && S().spo2 === 90 && S().rr === 24)
  ok('the way on is Disconnect', go('advanceBtn') === '→ Disconnect')
  ok('with the guide\'s trigger on it', why('advanceBtn') === 'when the instructor disconnects at the wye during the stretcher move')
  ok('baseline offers no X Worse', go('worseBtn') === null)
  ok('the clock says where the patient is and for how long', d.getElementById('stateClock').textContent === 'In Baseline · 0:00')
  w.advance()
  ok('Disconnect: the circuit is apart at once', S().etco2 === 0 && S().co2Shape === 'flat' && S().rr === 0 && S().hr === 128)
  ok('SpO₂ starts where it was', S().spo2 === 90)
  ok('the panel says what is moving and for how long', /SpO₂ moving — 0:20 left/.test(w.eval('statusText()')), w.eval('statusText()'))
  tick(10)
  ok('SpO₂ is halfway at 10 s', S().spo2 === 87, String(S().spo2))
  tick(10)
  ok('and there at 20 s', S().spo2 === 84)
  ok('the way on skips X Worse', go('advanceBtn') === '→ Bagging')
  ok('which is offered beside it, with its trigger', go('worseBtn') === '✗ X Worse — not bagged' && why('worseBtn') === 'if there is no bagging within 1:00')
  w.eval('paintNext()')
  ok('counting down the guide\'s 60 s', left('worseBtn') === '0:40 left', left('worseBtn'))
  ok('not yet due', !d.getElementById('worseBtn').classList.contains('due'))
  tick(45, 'paintNext')
  ok('and due once the limit passes', d.getElementById('worseBtn').classList.contains('due') && /limit passed 0:05 ago/.test(left('worseBtn')), left('worseBtn'))
  ok('the clock has kept counting', d.getElementById('stateClock').textContent === 'In Disconnect · 1:05', d.getElementById('stateClock').textContent)
  w.applyState(4)
  ok('X Worse is pressed on purpose and drawn apart', d.querySelector('.state.active').classList.contains('branch'))
  ok('and its way on is back to Bagging', go('advanceBtn') === '→ Back to Bagging' && go('worseBtn') === null)
  ok('the clock starts again with the state', d.getElementById('stateClock').textContent === 'In X Worse — not bagged · 0:00')
  tick(30)
  w.advance()
  ok('a circuit back together shows CO₂ on the first breath', S().etco2 === 46 && S().rr === 24)

  // The state that starts by itself.
  w.loadCase('vent_dka')
  ok('DKA counts down to Rising CO₂ on its button', go('advanceBtn') === '→ Rising CO₂' && /starts by itself in 1:00 — tap to start now/.test(left('advanceBtn')), left('advanceBtn'))
  w.eval("autoFire('vent_dka',0)")
  ok('and starts it', w.eval('stateIdx') === 1 && S().hr === 132)
  ok('with EtCO₂ climbing over five minutes', S().etco2 === 22)
  tick(150)
  ok('halfway at 2:30', S().etco2 === 30, String(S().etco2))
  w.loadCase('vent_dka'); w.advance()
  ok('Advance takes it early and the countdown goes', w.eval('autoAt') === 0)
  w.applyState(3)
  ok('X Worse brings the PVCs', S().pvcOn === true)
  w.applyState(2)
  ok('and the way back takes them away', S().pvcOn === false)

  // A transition that is a time, not an action.
  w.loadCase('vent_tbi'); w.advance()
  ok('TBI: In range is three more minutes, counted', go('advanceBtn') === '→ In range' && left('advanceBtn') === '3:00 left', left('advanceBtn'))
  tick(181, 'paintNext')
  ok('and flagged when they are up', d.getElementById('advanceBtn').classList.contains('due'))
  w.advance()
  ok('the last state says it is the end', /End of the scenario/.test(d.getElementById('nextGo').textContent))

  // Two legs.
  w.loadCase('vent_als'); w.advance()
  ok('ALS obstructed: the small, rounded capnogram', S().co2Shape === 'rounded' && S().etco2 === 8)
  w.applyState(3); tick(60)
  ok('X Worse first leg: 130 and 72%', S().hr === 130 && S().spo2 === 72, `${S().hr} ${S().spo2}`)
  w.eval("thenFire('vent_als',3)"); tick(30)
  ok('second leg halfway: 90, reading sinus', S().hr === 90 && S().rhythm === 'nsr', `${S().hr} ${S().rhythm}`)
  tick(30)
  ok('and a bradycardia of 50 at the end', S().hr === 50 && S().rhythm === 'brady', `${S().hr} ${S().rhythm}`)

  // A preset after a case: no script, no card.
  w.loadCase('p:hypoxia')
  ok('a vitals-only start has no case card', d.getElementById('caseCard').hidden === true)
  ok('and nothing still counting down or moving', w.eval('autoAt') === 0 && Object.keys(w.eval('glides')).length === 0)
  w.close()
}

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------
{
  const { w, d, S, tick } = load()
  w.loadCase('p:normal')
  w.giveDrug('labetalol')
  tick(40, 'drugTick')
  const low = S().sbp
  ok('a drug moves the patient', low < 121, String(low))
  w.stopMeds()
  ok('stopping meds walks back rather than jumping', S().sbp === low)
  tick(10)
  ok('to where the patient was without them', S().sbp === 121, String(S().sbp))
  w.loadCase('vent_peds')
  ok('a pediatric case shows no adult dose', !/1 mg IV push/.test(d.querySelector('[data-drug="epi_acls"] .ddose').textContent))
  // Stop meds is a button that does something only while something is running.
  ok('Stop meds is off with nothing running', d.getElementById('stopMedsBtn').disabled === true)
  w.giveDrug('fentanyl')
  ok('and on while a drug is', d.getElementById('stopMedsBtn').disabled === false)
  w.stopMeds()
  ok('and off again after', d.getElementById('stopMedsBtn').disabled === true)
  w.close()
}

// ---------------------------------------------------------------------------
// The 12-lead, on whichever path the monitor is on
// ---------------------------------------------------------------------------
{
  const { w, S } = load()
  ok('with no monitor open the 12-lead button is off', w.document.getElementById('btn12Lead').disabled === true)
  w.eval('heardMonitor({__monitor:1,lead12:false})')
  ok('a monitor saying it is there turns it on', w.document.getElementById('btn12Lead').disabled === false)
  w.toggle12Lead()
  ok('the 12-lead request is in the patient state', S().cmd12 && S().cmd12.open === true)
  w.eval('heardMonitor({__monitor:1,lead12:false})')
  ok('the button follows what the monitor reports', w.document.getElementById('btn12Lead').textContent === 'Open 12-lead on monitor')
  w.close()

  // The monitor acts on a request made after it started, never one before.
  const stub = new Proxy({}, { get: (_, k) => (k === 'canvas' ? {} : () => {}), set: () => true })
  const mdom = new JSDOM(readFileSync(MONITOR, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://ces.local/simulator/patient_monitor_display.html',
    beforeParse(mw) {
      mw.HTMLCanvasElement.prototype.getContext = () => stub
      mw.localStorage.setItem('simState', JSON.stringify({ cmd12: { open: true, t: 1 } }))
      mw.open = () => null   // a tablet that blocks the pop-up
    },
  })
  const m = mdom.window
  m.eval('check12Cmd()')
  ok('a request older than the monitor is not replayed', !m.document.getElementById('tap12'))
  m.eval('S.cmd12={open:true,t:2}; check12Cmd()')
  ok('a new one is acted on, and a blocked pop-up becomes a tap', m.document.getElementById('tap12') && !m.document.getElementById('tap12').hidden)
  m.eval('S.cmd12={open:false,t:3}; check12Cmd()')
  ok('closing it takes the tap away', m.document.getElementById('tap12').hidden)
  m.close()
}

if (failures.length) {
  console.error(`check-sim-panel: ${failures.length} of ${checks} checks failed\n`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`check-sim-panel: ${checks} checks passed`)
