// Structural check for the navigation tree.
//
// The bottom bar and the four section landings both read src/lib/nav.ts, so
// the failure this guards against is not the two lists disagreeing — it is the
// tree disagreeing with the router or with the gates.
//
// Three things can break silently:
//
//  * A route is renamed and the nav item still points at the old path. The tab
//    still draws, the row still draws, and the tap lands on the catch-all,
//    which renders the dashboard as though nothing were wrong.
//  * A new item is added with a gate nobody wired, so it is visible to
//    everyone. Hiding a tab is not access control, but a row offering an FTO
//    the chart review tool is still a bug worth catching here.
//  * A sixth section is added. The whole point of the reorganisation is that
//    the bar has a fixed, small number of cells that clear the platform touch
//    minimum; nothing in the type system stops someone appending to the array.
//
// Run: node scripts/check-nav.mjs
import { readFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')

const OUT = join(tmpdir(), `ces-nav-check-${process.pid}.mjs`)
await build({
  stdin: {
    contents: `export { SECTIONS, HOME, under, sectionOf, rootsOf, visibleSections } from ${JSON.stringify(
      join(SRC, 'lib/nav'),
    )}`,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: OUT,
  // nav.ts pulls in useCan -> useSyncStatus -> the supabase client for the
  // hook it also exports. None of that is reachable from the pure exports
  // above, but the bundler still has to resolve it.
  plugins: [
    {
      name: 'stub',
      setup(b) {
        b.onResolve({ filter: /^react$|(^|\/)(role|sync)$/ }, (a) => ({ path: a.path, namespace: 'stub' }))
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: 'export const useMemo=(f)=>f(); export const useCan=()=>({}); export const useSyncStatus=()=>({})',
          loader: 'js',
        }))
      },
    },
  ],
})
const nav = await import(pathToFileURL(OUT).href)
rmSync(OUT, { force: true })

let checks = 0
const fails = []
function ok(cond, msg) {
  checks++
  if (!cond) fails.push(msg)
}
function eq(actual, expected, msg) {
  ok(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${msg}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`,
  )
}

const { SECTIONS, HOME, under, sectionOf, rootsOf, visibleSections } = nav
const appSrc = readFileSync(join(SRC, 'App.tsx'), 'utf8')
const layoutSrc = readFileSync(join(SRC, 'components/Layout.tsx'), 'utf8')

// ---------------------------------------------------------------------------
// Shape of the bar
// ---------------------------------------------------------------------------

// Home plus the sections. Five is the number the cell geometry was sized for:
// at six, a 320px phone drops below the 48dp touch minimum again.
ok(1 + SECTIONS.length <= 5, `bar has ${1 + SECTIONS.length} cells; the layout is sized for at most 5`)
ok(SECTIONS.length > 0, 'no sections defined')

for (const s of SECTIONS) {
  ok(s.items.length > 0, `section ${s.to} has no items — it would be a tab leading nowhere`)
  ok(s.to.startsWith('/'), `section path ${s.to} is not absolute`)
  ok(!!s.title && !!s.blurb, `section ${s.to} is missing its landing heading or blurb`)
  // One word. Two wrapped to two lines while every other label stayed on one,
  // which is what pushed "EMS Reference" to "Regs" in the flat bar.
  ok(!/\s/.test(s.label), `tab label ${JSON.stringify(s.label)} is more than one word`)
  for (const i of s.items) {
    ok(!!i.blurb, `item ${i.to} has no blurb — its row would be blank before any records exist`)
    ok(!!i.icon && !!i.label, `item ${i.to} is missing an icon or label`)
  }
}

// ---------------------------------------------------------------------------
// Paths are unambiguous
// ---------------------------------------------------------------------------

const allRoots = SECTIONS.flatMap(rootsOf)
const dupes = allRoots.filter((p, i) => allRoots.indexOf(p) !== i)
eq(dupes, [], 'a path appears twice in the tree, so two rows or two tabs claim it')

// Every root resolves back to the section that owns it. This is what the bar's
// highlight is computed from, so a collision means the wrong tab lights.
for (const s of SECTIONS) {
  for (const root of rootsOf(s)) {
    ok(sectionOf(root)?.to === s.to, `sectionOf(${root}) is ${sectionOf(root)?.to}, expected ${s.to}`)
    ok(sectionOf(`${root}/deep/child`)?.to === s.to, `a child of ${root} does not resolve to ${s.to}`)
  }
}

// Segment-aware, not startsWith: '/ems' must not claim '/emsreference'.
ok(under('/ems', '/ems'), 'under() rejects an exact match')
ok(under('/ems/ks', '/ems'), 'under() rejects a child path')
ok(!under('/emsreference', '/ems'), 'under() matches on a bare prefix — the wrong tab would light')
ok(sectionOf('/nope') === undefined, 'sectionOf() claims a path outside the tree')

// ---------------------------------------------------------------------------
// Every destination is a real route
// ---------------------------------------------------------------------------

const routePaths = new Set([...appSrc.matchAll(/path="([^"]+)"/g)].map((m) => m[1].replace(/^\//, '')))
for (const s of SECTIONS) {
  ok(routePaths.has(s.to.slice(1)), `section ${s.to} has no route in App.tsx — the tab would fall through to the dashboard`)
  for (const root of [...s.items.map((i) => i.to), ...s.items.flatMap((i) => i.match ?? [])]) {
    ok(routePaths.has(root.slice(1)), `${root} has no route in App.tsx`)
  }
}

// Each section landing is its own screen, and reads its own section.
for (const s of SECTIONS) {
  const name = { '/training': 'TrainingHub', '/tools': 'ToolsHub', '/reference': 'ReferenceHub', '/more': 'MoreHub' }[s.to]
  ok(!!name, `section ${s.to} has no landing screen registered in this check`)
  if (!name) continue
  const hub = readFileSync(join(SRC, `modules/sections/${name}.tsx`), 'utf8')
  ok(hub.includes(`useSection('${s.to}')`), `${name} does not read section ${s.to} from the tree`)
  ok(appSrc.includes(`path="${s.to.slice(1)}"`), `${name} is not routed`)
}

// The bar must draw from the tree rather than keep a second list. Checking for
// the call, not the import: an import survives the bar being pointed at
// something else entirely.
ok(layoutSrc.includes('useVisibleNav()'), 'Layout does not call useVisibleNav() — the bar is not drawn from the tree')
ok(layoutSrc.includes('sections.map('), 'Layout does not render the sections it read')
for (const leaf of SECTIONS.flatMap((s) => s.items.map((i) => i.to))) {
  ok(!layoutSrc.includes(`'${leaf}'`), `Layout still names ${leaf} directly — the bar is keeping its own list again`)
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

const GATES = ['manageAcademy', 'manageAemt', 'reviewCharts', 'adminSignedIn']
const NONE = { manageAcademy: false, manageAemt: false, reviewCharts: false, adminSignedIn: false }
const ALL = { manageAcademy: true, manageAemt: true, reviewCharts: true, adminSignedIn: true }

const leavesOf = (tree) => tree.flatMap((s) => s.items.map((i) => i.to)).sort()
const everyLeaf = SECTIONS.flatMap((s) => s.items.map((i) => i.to)).sort()

// Which capability guards which screen, written out independently of the tree.
//
// Deliberately a second copy. Deriving it from nav.ts would make the check
// tautological — it would pass just as happily with chart review behind the
// simulator's weaker gate, which is precisely the mistake worth catching. A
// change here has to be made on purpose.
const EXPECTED_GATES = {
  '/academy': 'always',
  '/aemt': 'manageAemt',
  '/review': 'reviewCharts',
  '/simulator': 'manageAcademy',
  '/qa': 'always',
  '/bot': 'always',
  '/courses': 'always',
  '/ems': 'always',
  '/history': 'adminSignedIn',
  '/cqmp': 'adminSignedIn',
  '/ce': 'always',
  '/settings': 'always',
}

for (const s of SECTIONS) {
  for (const i of s.items) {
    ok(i.gate === 'always' || GATES.includes(i.gate), `${i.to} uses gate ${JSON.stringify(i.gate)}, which nothing resolves`)
    ok(i.to in EXPECTED_GATES, `${i.to} is new — say in this check which capability should guard it`)
    ok(
      EXPECTED_GATES[i.to] === undefined || i.gate === EXPECTED_GATES[i.to],
      `${i.to} is gated on ${JSON.stringify(i.gate)}; this check expects ${JSON.stringify(EXPECTED_GATES[i.to])}`,
    )
  }
}

// Nothing gated is visible with no capability at all; everything is with all.
eq(leavesOf(visibleSections(ALL)), everyLeaf, 'an account with every capability cannot see every item')

// Each gate actually withholds something: turn one off against ALL and the
// items carrying it must disappear, and only those. This is the check that
// fires when a new item is given an existing gate name but the wrong one.
for (const g of GATES) {
  const withoutIt = visibleSections({ ...ALL, [g]: false })
  const expected = everyLeaf.filter((to) => {
    const item = SECTIONS.flatMap((s) => s.items).find((i) => i.to === to)
    return item.gate !== g
  })
  eq(leavesOf(withoutIt), expected, `dropping ${g} does not hide exactly the items that carry it`)
}

// The three accounts this app actually has.
const fto = visibleSections(NONE)
eq(
  fto.map((s) => s.to),
  ['/training', '/reference', '/more'],
  'a signed-in FTO should see Training, Reference and More — and no Tools tab leading to an apology',
)
eq(leavesOf(fto), ['/academy', '/courses', '/ems', '/settings'], 'the FTO leaf set is wrong')

const localOnly = visibleSections({ manageAcademy: true, manageAemt: true, reviewCharts: true, adminSignedIn: false })
ok(
  leavesOf(localOnly).includes('/simulator'),
  'a signed-out local install cannot reach the simulator — the instructor running a scenario off a laptop is who it is for',
)
ok(
  !leavesOf(localOnly).includes('/history'),
  'a signed-out local install can reach class history — the local-admin convenience must not satisfy that gate',
)

const admin = visibleSections(ALL)
ok(admin.length === SECTIONS.length, 'an administrator does not see every section')
ok(1 + admin.length <= 5, `an administrator sees ${1 + admin.length} cells`)

// ---------------------------------------------------------------------------

if (fails.length) {
  console.error(`check-nav: ${fails.length} of ${checks} checks FAILED\n`)
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`check-nav: ${checks} checks passed`)
console.log(`  bar: ${[HOME.label, ...SECTIONS.map((s) => s.label)].join(' · ')}`)
