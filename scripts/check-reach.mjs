// Can a person reach every control, in every configuration?
//
// This is the check that would have caught every simulator defect reported
// from a live scenario so far. Not one of them was a missing feature; every
// one was a control that existed and had a dead path to it:
//
//   - the 12-lead popup had no close button, and HOME SCREEN tested for an
//     in-page element that has never existed;
//   - the pacing strip was rendered only inside the graded run card, so on a
//     quick preset there was nothing on the page to press;
//   - the run card's condensed bar shrank in the flow, which fought the scroll
//     and pinned the page near the top;
//   - the ENERGY, RATE and CURRENT rockers fell under 44pt at the chassis
//     scales a 1024x768 iPad actually reaches.
//
// check-simulator.mjs runs in jsdom, which has no layout, so it can only ever
// assert what the stylesheet *says*. That is exactly how the last one got
// through: the rule declared a 48px floor and the rule was correct — it set
// the arrow's width, while its height came from the key around it and landed
// at 46, then scaled to 43.5. A declaration is not a result. This script opens
// the real pages in a real browser and measures what a thumb would hit.
//
// Run: node scripts/check-reach.mjs  (or `npm run check:reach`)
//
// It needs a built dist/ and Playwright's Chromium. Without either it skips,
// the same way check-simulator skips without jsdom — a checkout that has not
// installed dev dependencies should not fail the aggregate check over it.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { skip, unmatched } from './lib/check-kit.mjs'
import { createServer } from 'node:http'

const here = dirname(fileURLToPath(import.meta.url))
const DIST = join(here, '..', 'dist', 'simulator')

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  skip('check-reach', 'playwright not installed', 'npm i playwright')
}

// Which Chromium to drive. Playwright normally finds its own, but a machine
// whose browsers were installed for a different playwright build — which is
// what the container this was written in has — leaves launch() pointing at a
// revision directory that does not exist. Look for one that does before
// giving up, and take CHROMIUM_PATH if the environment names one.
function findChromium() {
  const named = process.env.CHROMIUM_PATH
  if (named && existsSync(named)) return named
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (!root || !existsSync(root)) return null
  for (const dir of readdirSync(root).filter((d) => d.startsWith('chromium')).sort().reverse())
    for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome',
      'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const exe = join(root, dir, rel)
      if (existsSync(exe)) return exe
    }
  return null
}
async function launch() {
  try {
    return await chromium.launch()
  } catch (e) {
    const exe = findChromium()
    if (!exe) {
      console.log('  (' + String(e).split('\n')[0] + ')')
      skip('check-reach', 'no usable chromium', 'npx playwright install chromium')
    }
    return chromium.launch({ executablePath: exe })
  }
}
if (!existsSync(join(DIST, 'control_panel.html'))) {
  skip('check-reach', 'no dist/ to serve', 'npm run build first')
}

const failures = []
let checks = 0
function ok(name, cond, detail = '') {
  checks++
  if (!cond) failures.push(detail ? `${name} — ${detail}` : name)
}

// Serve dist/simulator so the pages load their own relative assets.
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.md': 'text/plain' }
const server = createServer((req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/simulator/, '') || '/'
  const file = join(DIST, name)
  if (!file.startsWith(DIST) || !existsSync(file)) { res.writeHead(404); res.end(); return }
  const ext = name.slice(name.lastIndexOf('.'))
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
  res.end(readFileSync(file))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const ORIGIN = `http://127.0.0.1:${server.address().port}/simulator`

// ---------------------------------------------------------------------------
// The probe.
//
// Two false positives this went through first, both worth keeping named. A
// control inside a display:none ancestor reports its own computed display as
// normal, so testing the element alone lets an entire hidden skin through as
// "zero-sized" — checkVisibility() walks the ancestry. And a control mid-fade
// (opacity still 1, pointer-events already none) fails a hit test while being
// deliberately out of play. Neither is a defect.
//
// What is a defect is the inverse: a control with no box, or one behind an
// overlay, that the keyboard can still reach and fire.
// ---------------------------------------------------------------------------
const PROBE = ({ touchFloor, floorOnly }) => {
  const SEL = 'button, [role="button"], input, select, textarea, a[href], [onclick]'
  const out = []
  const matched = []
  const label = (el) =>
    el.id || (el.getAttribute('onclick') || '').slice(0, 40) ||
    (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) || String(el.className)

  const owns = (el, x, y) => {
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false
    const h = document.elementFromPoint(x, y)
    return !!h && (h === el || el.contains(h))
  }
  // Is the centre of this control actually this control? Cheap, and the only
  // question for most of them.
  const reachable = (el) => {
    const r = el.getBoundingClientRect()
    return owns(el, Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2))
  }
  // What a thumb can hit, which is not the border box: a hit area widened with
  // a pseudo-element does not change the box, and an overlapping neighbour
  // shrinks what you can reach without changing it either. Only asked when the
  // box is already under the floor — walking every control would be hundreds
  // of thousands of hit tests per page for an answer already known.
  const span = (el, cx, cy, dx, dy, need) => {
    let n = 0
    while (n < need && owns(el, cx + dx * (n + 1), cy + dy * (n + 1))) n++
    return n
  }
  // The walk is in whole pixels and the box is not, so the walk alone reports
  // 44 for a target that is really 43.5 — which is exactly the case this check
  // exists for, and it passed the first time round because 44 < 44 is false.
  // So the floor is measured against the *fractional* box, and the walk is
  // used only to credit an expansion that was put there on purpose. A
  // deliberate one is worth several pixels a side; anything under two is the
  // rounding, not a design.
  const SLOP = 2
  const hitBox = (el, floor) => {
    const r = el.getBoundingClientRect()
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2)
    const reach = floor + 6
    const grow = (walked, inside) => Math.max(0, walked - inside >= SLOP ? walked - inside : 0)
    const up = span(el, cx, cy, 0, -1, reach), down = span(el, cx, cy, 0, 1, reach)
    const left = span(el, cx, cy, -1, 0, reach), right = span(el, cx, cy, 1, 0, reach)
    return {
      w: r.width + grow(left, cx - r.left) + grow(right, r.right - cx),
      h: r.height + grow(up, cy - r.top) + grow(down, r.bottom - cy),
    }
  }

  for (const el of new Set(document.querySelectorAll(SEL))) {
    const cs = getComputedStyle(el)
    const shown = el.checkVisibility
      ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      : cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity !== 0
    const rec = { id: label(el), tag: el.tagName.toLowerCase(), kind: 'ok' }

    if (!shown) {
      const was = document.activeElement
      try { el.focus({ preventScroll: true }) } catch { /* not focusable, which is the point */ }
      if (document.activeElement === el) rec.kind = 'hidden, and still in the tab order'
      try { was && was.focus && was.focus({ preventScroll: true }) } catch {}
      out.push(rec); continue
    }
    // Deliberately out of play: a faded chip mid-transition, a disabled
    // control, or anything inside an inert subtree — which is how the unit is
    // stood down behind the "turn the iPad round" notice in portrait. Covering
    // is only paint; inert is what actually takes it out of reach, and testing
    // for it here is what tells the two apart.
    if (cs.pointerEvents === 'none' || el.disabled || el.closest('[inert]')) { out.push(rec); continue }

    el.scrollIntoView({ block: 'center', inline: 'center' })
    const r = el.getBoundingClientRect()
    rec.w = Math.round(r.width); rec.h = Math.round(r.height)
    if (!rec.w || !rec.h) { rec.kind = `zero-sized (${rec.w}x${rec.h})`; out.push(rec); continue }
    if (!(r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)) {
      rec.kind = 'cannot be scrolled into view'; out.push(rec); continue
    }
    if (!reachable(el)) {
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2)
      const h = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, cx)), Math.max(0, Math.min(innerHeight - 1, cy)))
      const bl = h ? (h.closest('[id]') || h) : null
      rec.kind = 'covered by ' + (bl ? (bl.id ? '#' + bl.id : bl.tagName.toLowerCase() + '.' + String(bl.className).split(' ')[0]) : 'something')
      // Covered *and* focusable is worse than covered: it can still be fired.
      const was = document.activeElement
      try { el.focus({ preventScroll: true }) } catch {}
      if (document.activeElement === el) rec.kind += ', and still in the tab order'
      try { was && was.focus && was.focus({ preventScroll: true }) } catch {}
      out.push(rec); continue
    }
    const native = /^(button|input|select|textarea|a)$/.test(rec.tag)
    if (!(native || el.hasAttribute('tabindex'))) { rec.kind = 'no way in from the keyboard'; out.push(rec); continue }
    // Which of the floor's own selectors this control answers to. Recorded
    // even when there is no floor at this viewport, because the question the
    // caller asks afterwards is "is this selector describing anything at all",
    // and a name that matches nothing anywhere is the failure being guarded.
    let mine = null
    if (floorOnly) {
      mine = floorOnly.filter((sel) => el.matches(sel))
      for (const sel of mine) matched.push(sel)
    }
    const floored = touchFloor && (!floorOnly || mine.length > 0)
    if (floored && Math.min(rec.w, rec.h) < touchFloor) {
      const hb = hitBox(el, touchFloor)
      rec.hitW = Math.round(hb.w * 10) / 10; rec.hitH = Math.round(hb.h * 10) / 10
      // The walk stops once a direction clears the floor, so a reported number
      // at the cap means "at least this" — name the dimension that failed
      // rather than printing a pair half of which is a measuring limit.
      if (Math.min(hb.w, hb.h) < touchFloor) {
        const which = hb.h < hb.w ? `${rec.hitH}px tall` : `${rec.hitW}px wide`
        rec.kind = `${which} to a thumb, under ${touchFloor}pt`
      }
    }
    out.push(rec)
  }
  window.scrollTo(0, 0)
  // Page-level, not per-control: a layout that will not narrow past a floor
  // pushes content off the side of the window, and body is a centred flex
  // column here so it goes off *both* edges rather than merely overflowing
  // right. Name the widest offenders — the floor is usually one of them.
  const vw = document.documentElement.clientWidth
  const spill = []
  for (const el of document.querySelectorAll('body *')) {
    if (!el.checkVisibility || !el.checkVisibility()) continue
    const b = el.getBoundingClientRect()
    if (b.width === 0) continue
    if (b.right > vw + 1 || b.left < -1) spill.push(`${label(el)} [${Math.round(b.left)}..${Math.round(b.right)}]`)
  }
  const over = document.documentElement.scrollWidth > vw + 1 || spill.length > 0
  return {
    out, matched: [...new Set(matched)],
    overflow: over ? { sw: document.documentElement.scrollWidth, vw, spill: [...new Set(spill)].slice(0, 3) } : null,
  }
}

const MONITOR_STATES = {
  'ZX skin': () => {},
  'LIFEPAK skin': () => document.getElementById('skinLP').click(),
  'powered off': () => { document.getElementById('skinLP').click(); setPower(false) },
  pacing: () => { document.getElementById('skinLP').click(); D.pacer = true; D.pacerMa = 70; devTick() },
  charged: () => { document.getElementById('skinLP').click(); startCharge(); D.chargeStart = Date.now() - 99999; devTick() },
  'OPTIONS menu': () => { document.getElementById('skinLP').click(); openMenu(optionsMenu()) },
  SunVue: () => { document.getElementById('skinLP').click(); document.getElementById('kSUN').click() },
  'no patient': () => { document.getElementById('skinLP').click(); S.patientConnected = false },
}
const PANEL_STATES = {
  'nothing picked': () => {},
  'quick preset': () => { document.getElementById('scenarioSel').value = 'brady'; applyScenario() },
  'megacode running': () => { document.getElementById('simScenarioSel').value = 'megacode1'; applySimScenario(); applySimState('megacode1', 0) },
  'sheet at a later phase': () => { document.getElementById('simScenarioSel').value = 'megacode1'; applySimScenario(); applySimState('megacode1', 2) },
  'run card collapsed': () => { document.getElementById('simScenarioSel').value = 'megacode1'; applySimScenario(); applySimState('megacode1', 0); collapseRunCard() },
  pacing: () => { document.getElementById('simScenarioSel').value = 'megacode1'; applySimScenario(); applySimState('megacode1', 0)
    onDeviceEvent({ type: 'pacer', label: 'PACER ON', detail: '70 ppm' })
    onDeviceEvent({ type: 'pacerCurrent', label: 'PACING CURRENT', detail: '70 mA' }) },
  'run finished': () => { document.getElementById('simScenarioSel').value = 'megacode1'; applySimScenario(); applySimState('megacode1', 0); endRun() },
  'lines up': () => { toggleArt(); toggleSG() },
  // A megacode is graded on the sheet; a quarterly simulation is graded on the
  // per-state action list, which is a different set of controls and the only
  // thing .act is on. Every state above loads megacode1, so until this one the
  // sweep never rendered that list at all — the selector guard below is what
  // said so.
  'quarterly sim running': () => {
    document.getElementById('simScenarioSel').value = 'drowning_initial'; applySimScenario()
  },
}
// Reachability is checked everywhere. The 44pt floor is checked where a
// finger is actually plausible, which is the sizes an iPad presents — not
// every small window. A 960x720 browser window on a laptop is a mouse, and
// holding it to a thumb's minimum would be measuring a room nobody is in.
// Anything smaller than an iPad's landscape short side is reachability only.
const IPAD_VPS = [
  [1366, 1024], [1194, 834], [1180, 820], [1133, 744], [1112, 834], [1080, 810], [1024, 768],
]
const MONITOR_VPS = [[1366, 1024], [1180, 820], [1024, 768], [1366, 768], [960, 720], [820, 1180]]
// Down to a phone. The panel is a facilitator's console and not something
// carried, so the floor below is about layout rather than fitness for a phone
// — but a console that will not narrow is a console that hides its own
// controls off the edge of a small laptop window too, and 390 is where that
// shows up unmistakably.
const PANEL_VPS = [[1920, 1080], [1440, 900], [1366, 768], [1280, 800], [1180, 820],
  [820, 1180], [600, 900], [390, 844]]
const isIpad = (w, h) => IPAD_VPS.some(([a, b]) => a === w && b === h)

const browser = await launch()
async function sweep(label, url, states, vps, seed, touchAt, floorOnly) {
  const bad = []
  const seen = new Set()
  for (const [w, h] of vps) {
    const touch = touchAt(w, h) ? 44 : 0
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch > 0 })
    if (process.stderr.isTTY) process.stderr.write(`\r  ${label} ${w}x${h}${touch ? ' touch' : '     '}      `)
    for (const [name, fn] of Object.entries(states)) {
      const p = await ctx.newPage()
      const errs = []
      p.on('pageerror', (e) => errs.push(String(e)))
      // Seeded before the first script runs rather than set-and-reload: these
      // pages read localStorage on load, and reloading every configuration
      // doubled the run for nothing.
      if (seed) await p.addInitScript(seed)
      await p.goto(url, { waitUntil: 'load' })
      await p.evaluate(fn).catch((e) => errs.push('setup: ' + e))
      await p.waitForTimeout(300)
      const { out: rows, matched, overflow } = await p.evaluate(PROBE, { touchFloor: touch, floorOnly: floorOnly || null })
      for (const sel of matched) seen.add(sel)
      if (overflow) bad.push({
        id: '(page)', tag: 'body',
        kind: `${overflow.sw}px of content in a ${overflow.vw}px window — ${overflow.spill.join('; ')}`,
        where: `${w}x${h} / ${name}`,
      })
      if (process.env.REACH_DEBUG) {
        const r = rows.find((x) => x.id === process.env.REACH_DEBUG)
        if (r) console.error(`  [debug] ${w}x${h}/${name} floor=${touch} ${JSON.stringify(r)}`)
      }
      for (const r of rows) if (r.kind !== 'ok') bad.push({ ...r, where: `${w}x${h} / ${name}` })
      for (const e of errs) bad.push({ id: '(page)', kind: 'threw: ' + e, where: `${w}x${h} / ${name}` })
      await p.close()
    }
    await ctx.close()
  }
  return { bad, seen }
}

const seedPatient = () =>
  localStorage.setItem('simState', JSON.stringify({
    patientConnected: true, hr: 72, rhythm: 'nsr', spo2: 96, etco2: 36, rr: 14, etco2On: true,
  }))

const { bad: monBad } = await sweep('monitor', `${ORIGIN}/patient_monitor_display.html`, MONITOR_STATES, MONITOR_VPS, seedPatient, isIpad)
// The panel is the facilitator's laptop, and compact on purpose — every pixel
// above the cards is a pixel of the scenario they cannot see. So the floor is
// not applied to all of it. It is applied to the controls tapped *while a code
// is running*, with a crew to watch at the same time: the expected actions,
// the checklist, the result, the patient states and the way out. The vitals
// sliders and setup selects stay at the density a pointer wants.
// .cl-* until the check-off sheet replaced that UI. Those classes are on no
// element now, and a selector that matches nothing is not a passing check —
// it is a check that stopped running. The sheet's own controls take their
// place: the tick rows, the CPR-quality fields, and the identity and result
// fields at its head and foot.
// A list, not a comma-joined string, so that each name can be held to
// describing something. As a string this was three dead names long — the
// .cl-* classes went with the UI they described, and `el.matches()` on a
// selector that matches nothing raises nothing, so the panel's grading
// controls stopped being measured while this check went on reporting a pass.
// The assertion after the sweep is what makes that loud.
const GRADING = ['.act', '.sh-row', '.sh-write input', '.sh-meta input', '.sh-foot input',
  '.res-btn', '.end-btn', '.pp-btn', '.state-btn']
const { bad: panelBad, seen: panelSeen } = await sweep('panel', `${ORIGIN}/control_panel.html`,
  PANEL_STATES, PANEL_VPS, null, (w) => w <= 1180, GRADING)
await browser.close()
server.close()

// One line per distinct defect, however many configurations it shows up in.
function report(label, bad) {
  const by = new Map()
  for (const d of bad) {
    const k = `${d.id} :: ${d.kind.replace(/\d+x\d+/g, 'NxN')}`
    if (!by.has(k)) by.set(k, { ...d, where: [] })
    by.get(k).where.push(d.where)
  }
  ok(
    `every control on the ${label} can be reached and hit`,
    by.size === 0,
    [...by.values()].map((v) => `\n      ${v.kind} — <${v.tag || '?'}> ${v.id}` +
      `\n        ${v.where.length}x: ${v.where.slice(0, 3).join('; ')}${v.where.length > 3 ? ' …' : ''}`).join(''),
  )
  return by.size
}
const nMon = report('monitor', monBad)
const nPanel = report('control panel', panelBad)

// The list above is the whole of what the 44pt floor applies to on the panel.
// A name in it that no state and no viewport ever put on a control is not a
// control that passed — it is a control the check has lost track of, and it
// reads identically to coverage from the outside.
const dead = unmatched(GRADING, panelSeen)
ok(
  'every selector in the panel\'s 44pt list still describes a control',
  dead.length === 0,
  dead.length ? `\n      matched nothing in ${Object.keys(PANEL_STATES).length} states ` +
    `x ${PANEL_VPS.length} viewports: ${dead.join(', ')}` +
    '\n      (renamed or deleted? a selector that matches nothing reports a pass)' : '',
)

if (failures.length) {
  console.error(`check-reach: ${failures.length} of ${checks} checks failed\n`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(
  `check-reach: ${checks} checks passed — ` +
  `${MONITOR_VPS.length * Object.keys(MONITOR_STATES).length} monitor and ` +
  `${PANEL_VPS.length * Object.keys(PANEL_STATES).length} panel configurations, ` +
  `${nMon + nPanel} problems`,
)
