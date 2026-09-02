// Sweep every authored string in the course record for dates that name a day
// this cohort does not have, and for weekday claims that contradict the date.
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const OUT = join(tmpdir(), 'stale.mjs')
await build({
  stdin: { contents:
    `export * as D from ${JSON.stringify(join(SRC, 'data/aemt'))}\n` +
    `export * as A from ${JSON.stringify(join(SRC, 'data/aemtAssessments'))}\n` +
    `export * as P from ${JSON.stringify(join(SRC, 'data/aemtPhases'))}\n` +
    `export * as S from ${JSON.stringify(join(SRC, 'data/aemtSites'))}\n`,
    resolveDir: SRC, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: OUT,
})
const m = await import(pathToFileURL(OUT).href)
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const real = new Set(m.D.KC_SCHEDULE.map(r => r.date))
const spell = iso => { const [y,mo,d]=iso.split('-').map(Number); return `${d} ${MONTHS[mo-1]}` }
const known = new Set([...m.D.KC_SCHEDULE.map(r=>spell(r.date)), spell(m.D.KC_START_DATE), spell(m.D.KC_END_DATE),
  spell(m.D.WINTER_BREAK.start), spell(m.D.WINTER_BREAK.end), ...m.D.KC_HOLIDAYS.map(h=>spell(h.date)),
  ...m.D.KBEMS_DEADLINES.flatMap(d => { const x=m.D.deadlineDates(d); return [spell(x.due), spell(x.filedBy)] })])

const strings = []
const walk = (v, path) => {
  if (typeof v === 'string') strings.push([path, v])
  else if (Array.isArray(v)) v.forEach((x,i)=>walk(x, `${path}[${i}]`))
  else if (v && typeof v === 'object') for (const [k,x] of Object.entries(v)) walk(x, `${path}.${k}`)
}
for (const [ns, mod] of [['D',m.D],['A',m.A],['P',m.P],['S',m.S]])
  for (const [k,v] of Object.entries(mod)) if (typeof v !== 'function') walk(v, `${ns}.${k}`)

console.log('=== dates named that this cohort does not have ===')
const seen = new Set()
for (const [path, s] of strings) {
  for (const mm of s.matchAll(/\b(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December)(?! \d{4})\b/g)) {
    const sp = `${Number(mm[1])} ${mm[2]}`
    if (known.has(sp)) continue
    const key = path+sp; if (seen.has(key)) continue; seen.add(key)
    console.log(`  ${sp.padEnd(14)} ${path}`)
    console.log(`      …${s.slice(Math.max(0,mm.index-70), mm.index+70).replace(/\s+/g,' ')}…`)
  }
}
console.log('\n=== weekday claims that contradict the date ===')
for (const [path, s] of strings) {
  for (const mm of s.matchAll(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) (\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December)\b/g)) {
    const day = Number(mm[2]), mon = MONTHS.indexOf(mm[3]) + 1
    // try both course years
    const ok = [2026, 2027].some(y => DAYS[new Date(Date.UTC(y, mon-1, day)).getUTCDay()] === mm[1])
    if (!ok) console.log(`  ${mm[0]}  in ${path}`)
  }
}
