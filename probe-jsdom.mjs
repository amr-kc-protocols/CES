import { readFileSync } from 'node:fs'
const { JSDOM } = await import('jsdom')
const SRC = readFileSync('public/simulator/patient_monitor_display.html','utf8')
const stub = new Proxy({}, { get:(_,k)=>(k==='canvas'?{}:()=>{}), set:()=>true })
const dom = new JSDOM(SRC,{runScripts:'dangerously',pretendToBeVisual:true,
  url:'https://ces.local/simulator/patient_monitor_display.html',
  beforeParse(w){ w.HTMLCanvasElement.prototype.getContext=()=>stub }})
const w = dom.window
w.setPower(true)
const D = w.eval('D')
console.log('powered on:', D.on)
w.document.getElementById('kALARMS').click()
console.log('after 1 ALARMS click — alarms:', w.eval('D.alarms'), 'silenced:', w.eval('Date.now()<D.silenceUntil'))
w.document.getElementById('kOPTIONS').click()
console.log('OPTIONS menu:', w.eval('D.menu&&D.menu.title'), '| items:', w.eval('D.menu?D.menu.items.length:0'))
w.eval('D.menuIx=1; menuSelect()')
console.log('after selecting Alarms:', w.eval('D.menu&&D.menu.title'))
w.eval('D.menuIx=1; menuSelect()')
console.log('after selecting Off — D.alarms:', w.eval('D.alarms'))
w.document.getElementById('kALARMS').click()
console.log('ALARMS key now — alarms:', w.eval('D.alarms'), 'silenced:', w.eval('Date.now()<D.silenceUntil'))
console.log('CLICKS WORK IN JSDOM ✓')
