import type {
  AcademyCohort,
  CohortPlan,
  Credential,
  NeopAudience,
  NeopChecklistItem,
  NeopLocation,
  NeopProgram,
  NeopSchedule,
  NeopSheetUse,
  SkillSheetId,
  TemplateSession,
  Trainee,
  TraineePhase,
} from '../../types'
import type { Market } from '../../lib/market'
import { MARKETS } from '../../lib/market'
import { GENERAL_MODULES, KC_MEDIC_MODULES, CREDENTIAL_LABELS } from '../../data/academy'
import { BUNDLED_SCHEDULES } from '../../data/academyPhase2'
import { BUNDLED_DOCUMENTS, WELCOME_KIT_ITEMS } from '../../data/academyTemplate'
import { BUNDLED_FTOS, FTO_ROTATION_ANCHOR } from '../../data/ftoSchedule'

// ---------------------------------------------------------------------------
// An operation's NEOP, and every rule that reads it.
//
// Kansas City, Wichita, Independence and Topeka each run a different new-hire
// program: different stations, protocols, FTOs, shifts and facilities. Until
// now each difference was a constant in src/data with a `Record<Market, …>`
// beside it, so a new operation meant a code change and a deploy, and a
// different academy week meant transcribing a calendar into TypeScript. This
// module turns all of it into one document per operation (NeopProgram), stored
// in that operation's settings and edited in the setup steps.
//
// Three rules hold it together:
//
//  1. NOTHING CHANGES UNTIL SOMEONE EDITS. Kansas City's and Wichita's
//     programs are rebuilt here from exactly the constants they ran on
//     (bundledProgram), and that is what they see until they save their own.
//     check-neop-program.mjs proves the Kansas City checklist, release rule
//     and sheet assignment come out identical for every station × credential.
//
//  2. A COHORT KEEPS WHAT IT STARTED WITH. Adding a requirement must not move
//     a hire who is already on FTO rides back to "Academy". A cohort copies the
//     checklist, release rule and schedule when it is created (CohortPlan) and
//     takes later edits only when someone asks it to.
//
//  3. COPY THE STRUCTURE, NOT THE PEOPLE. Starting Topeka from Kansas City's
//     NEOP takes Kansas City's checklist and schedule, never its FTO roster,
//     its hospitals or its station ids — those are facts about Kansas City
//     that would be wrong, not merely incomplete, in Topeka.
//
// Pure: no React, no store. The hooks are in programStore.ts.
// ---------------------------------------------------------------------------

export const ALL_CREDENTIALS: Credential[] = ['emt', 'aemt', 'paramedic']

/** The check-off sheets an operation can choose to run, in display order. */
export const SHEET_CHOICES: { id: SkillSheetId; hint: string; defaultWho?: NeopAudience }[] = [
  { id: 'stretcher', hint: 'Corporate standard. Every hire.' },
  { id: 'evoc-track', hint: 'Corporate standard. Every hire.' },
  { id: 'bls', hint: 'Clinical skills and equipment. Usually every hire.' },
  { id: 'linn-medic', hint: 'The core ALS sheet.', defaultWho: { credentials: ['paramedic'] } },
  { id: 'vent', hint: 'Ventilator management, LTV 1200.', defaultWho: { credentials: ['paramedic'] } },
  { id: 'rsi', hint: 'Rapid sequence intubation.', defaultWho: { credentials: ['paramedic'] } },
]

// ----- who something applies to ----------------------------------------------

/** Does an item meant for `who` apply to this hire? Empty means everyone. */
export function appliesTo(
  who: NeopAudience | undefined,
  t: { credential: Credential; operation: string },
): boolean {
  if (!who) return true
  if (who.credentials?.length && !who.credentials.includes(t.credential)) return false
  if (who.locations?.length && !who.locations.includes(t.operation)) return false
  return true
}

/** "Everyone", "Paramedics", "Paramedics at Kansas City or Cass County". */
export function describeAudience(who: NeopAudience | undefined, locations: NeopLocation[]): string {
  const creds = who?.credentials ?? []
  const locs = who?.locations ?? []
  const credPart =
    creds.length === 0 || creds.length === ALL_CREDENTIALS.length
      ? ''
      : joinOr(creds.map((c) => plural(CREDENTIAL_LABELS[c])))
  const locNames = locs.map((id) => locations.find((l) => l.id === id)?.name ?? id)
  const locPart = locs.length === 0 ? '' : `at ${joinOr(locNames)}`
  if (!credPart && !locPart) return 'Everyone'
  if (!credPart) return `Everyone ${locPart}`
  return locPart ? `${credPart} ${locPart}` : credPart
}

const plural = (s: string) => `${s}s`

function joinOr(xs: string[]): string {
  if (xs.length <= 1) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`
}

// ----- the checklist and the phases it drives ----------------------------------

/** The requirements that apply to this hire, in the program's order. */
export function checklistFor(plan: Pick<CohortPlan, 'checklist'>, t: Trainee): NeopChecklistItem[] {
  return plan.checklist.filter((m) => appliesTo(m.who, t))
}

/**
 * A requirement counts when completed — or waived for an AMR transfer.
 *
 * Both maps are optional-chained: this runs for every trainee on cohort load,
 * so a row that reached storage without a checklist (an older save, a partial
 * sync) would otherwise take out the whole cohort view rather than showing
 * that one trainee as having nothing done.
 */
export function itemSatisfied(t: Trainee, id: string): boolean {
  return !!t.checklist?.[id] || !!t.waived?.[id]
}

export function checklistDone(plan: Pick<CohortPlan, 'checklist'>, t: Trainee): boolean {
  return checklistFor(plan, t).every((m) => itemSatisfied(t, m.id))
}

export function phaseOf(t: Trainee, plan: Pick<CohortPlan, 'checklist'>): TraineePhase {
  if (t.releasedDate) return 'released'
  if (checklistDone(plan, t)) return 'fto'
  return 'academy'
}

/**
 * Contacts needed before release. The operation's floor, unless the hire's own
 * target is lower (an AMR transfer with field time elsewhere) — then theirs.
 */
export function requiredContacts(t: Trainee, plan: Pick<CohortPlan, 'release'>): number {
  return Math.min(plan.release.minContacts, t.contactTarget)
}

export function releaseEligible(t: Trainee, plan: Pick<CohortPlan, 'checklist' | 'release'>): boolean {
  return phaseOf(t, plan) === 'fto' && t.contacts >= requiredContacts(t, plan)
}

export function isWaivable(plan: Pick<CohortPlan, 'checklist'>, id: string): boolean {
  return !!plan.checklist.find((m) => m.id === id)?.waivable
}

// ----- sheets ----------------------------------------------------------------------

/** The check-off sheets this hire works through, in the program's order. */
export function sheetsFor(program: Pick<NeopProgram, 'sheets'>, t: Trainee): SkillSheetId[] {
  return program.sheets.filter((s) => appliesTo(s.who, t)).map((s) => s.id)
}

// ----- stations ----------------------------------------------------------------

/** A station's name, falling back to its id for one since removed from the program. */
export function locationName(program: Pick<NeopProgram, 'locations'> | undefined, id: string): string {
  return program?.locations.find((l) => l.id === id)?.name ?? id
}

export function locationShort(program: Pick<NeopProgram, 'locations'> | undefined, id: string): string {
  const l = program?.locations.find((x) => x.id === id)
  return l?.short || l?.name || id
}

// ----- what shipped with the app -------------------------------------------------

/** Kansas City's own stations, by the ids every existing trainee carries. */
const KC_LOCATIONS: NeopLocation[] = [
  { id: 'kc', name: 'Kansas City', short: 'KC' },
  { id: 'cass', name: 'Cass County (MO)', short: 'Cass' },
  { id: 'linn', name: 'Linn County (KS)', short: 'Linn' },
]

/**
 * Which general modules a transfer can have waived. Report writing stays (the
 * ImageTrend workflow is local) and the critical-care block never is.
 */
const WAIVABLE = new Set(['stretcher', 'evoc', 'hr', 'osha', 'cornerstone'])

const generalChecklist = (): NeopChecklistItem[] =>
  GENERAL_MODULES.map((m) => ({ id: m.id, label: m.label, waivable: WAIVABLE.has(m.id) }))

/**
 * Kansas City's checklist, as curriculumFor() computed it: the general block
 * for everyone, ventilator management for Kansas City and Cass paramedics (not
 * Linn), and the infusion block for Kansas City paramedics only.
 */
function kcChecklist(): NeopChecklistItem[] {
  const [vent, infusions] = KC_MEDIC_MODULES
  return [
    ...generalChecklist(),
    { id: vent.id, label: vent.label, who: { credentials: ['paramedic'], locations: ['kc', 'cass'] } },
    { id: infusions.id, label: infusions.label, who: { credentials: ['paramedic'], locations: ['kc'] } },
  ]
}

/**
 * Kansas City's sheets, as clinicalSheetsFor() assigned them: BLS for every
 * hire, the core ALS sheet for every paramedic, RSI for Linn paramedics and the
 * ventilator sheet for the others, plus the two corporate standards.
 */
const KC_SHEETS: NeopSheetUse[] = [
  { id: 'bls' },
  { id: 'linn-medic', who: { credentials: ['paramedic'] } },
  { id: 'rsi', who: { credentials: ['paramedic'], locations: ['linn'] } },
  { id: 'vent', who: { credentials: ['paramedic'], locations: ['kc', 'cass'] } },
  { id: 'stretcher' },
  { id: 'evoc-track' },
]

/** Wichita runs the corporate standards only — no BLS, ALS or airway sheet. */
const CORPORATE_SHEETS: NeopSheetUse[] = [{ id: 'stretcher' }, { id: 'evoc-track' }]

const DEFAULT_RELEASE = { minContacts: 20, defaultTarget: 25 }

/**
 * The program an operation shipped with, or undefined where nothing shipped.
 *
 * Built fresh on every call from the constants the app ran on before NEOPs
 * were editable, so it can never drift from them — and so a caller can mutate
 * what it gets back without touching the next caller's copy.
 */
export function bundledProgram(market: Market): NeopProgram | undefined {
  const schedule = BUNDLED_SCHEDULES[market]
  const ftos = BUNDLED_FTOS[market]
  const documents = BUNDLED_DOCUMENTS[market]
  if (!schedule || !ftos || !documents) return undefined
  const base = {
    schema: 1 as const,
    credentials: [...ALL_CREDENTIALS],
    release: { ...DEFAULT_RELEASE },
    schedule: clone(schedule),
    ftos: clone(ftos),
    documents: clone(documents),
    updatedAt: '',
  }
  if (market === 'kc') {
    return {
      ...base,
      name: 'AMR Kansas City New Hire Academy',
      header: 'AMR KC — NEW HIRE ACADEMY',
      locations: clone(KC_LOCATIONS),
      checklist: kcChecklist(),
      sheets: clone(KC_SHEETS),
    }
  }
  if (market === 'wichita') {
    return {
      ...base,
      name: 'AMR Wichita New Hire Academy',
      header: 'AMR WICHITA — NEW HIRE ACADEMY',
      locations: [{ id: 'wichita', name: 'Wichita', short: 'ICT' }],
      checklist: generalChecklist(),
      sheets: clone(CORPORATE_SHEETS),
    }
  }
  return undefined
}

// ----- starting points for the setup steps --------------------------------------

export type StartingPoint = 'basics' | 'blank' | `copy:${Market}`

const operationName = (market: Market) => MARKETS.find((m) => m.id === market)?.short ?? market

/**
 * The AMR basics: what every operation runs, and nothing that is one
 * operation's own. The general checklist, the two corporate check-off sheets,
 * a five-day academy week of the sessions every AMR academy teaches, the
 * standard release rule and the shared welcome kit. No FTOs, no hospitals.
 */
export function basicsProgram(market: Market): NeopProgram {
  const name = operationName(market)
  return {
    schema: 1,
    name: `AMR ${name} New Hire Academy`,
    header: `AMR ${name.toUpperCase()} — NEW HIRE ACADEMY`,
    locations: [{ id: market, name }],
    credentials: [...ALL_CREDENTIALS],
    checklist: generalChecklist(),
    release: { ...DEFAULT_RELEASE },
    schedule: {
      name: `AMR ${name} New Hire Academy`,
      minEducationHoursPerDay: 5,
      weeks: [{ n: 1, label: 'Academy week' }],
      sessions: BASIC_WEEK.map((s) => clone(s)),
    },
    sheets: clone(CORPORATE_SHEETS),
    ftos: { names: [], evaluators: [], crews: [], anchor: FTO_ROTATION_ANCHOR },
    documents: { facilities: [], keyPoints: [], welcomeKit: clone(WELCOME_KIT_ITEMS), roadmap: false },
    updatedAt: '',
  }
}

/** Nothing at all but the operation's name and the release rule. */
export function blankProgram(market: Market): NeopProgram {
  const p = basicsProgram(market)
  return {
    ...p,
    checklist: [],
    sheets: [],
    schedule: { ...p.schedule, sessions: [] },
    documents: { ...p.documents, welcomeKit: [] },
  }
}

/**
 * Another operation's shipped program, minus everything that is a fact about
 * that operation: its FTOs and shifts, its hospitals, its stations. Anything
 * targeted at one of its stations becomes targeted at nobody's station in
 * particular — "paramedics at Kansas City or Cass" becomes "paramedics".
 */
export function copiedProgram(from: Market, into: Market): NeopProgram | undefined {
  const src = bundledProgram(from)
  if (!src) return undefined
  const mine = basicsProgram(into)
  const unstation = <T extends { who?: NeopAudience }>(x: T): T => {
    if (!x.who?.locations) return x
    const { locations: _drop, ...rest } = x.who
    void _drop
    return { ...x, who: rest.credentials?.length ? rest : undefined }
  }
  // Two sheets that were split by station in the source (RSI at Linn, the
  // ventilator sheet elsewhere) both become "every paramedic" once the
  // stations go. Keep the copy but let the setup step show it plainly.
  return {
    ...src,
    name: mine.name,
    header: mine.header,
    locations: mine.locations,
    checklist: src.checklist.map(unstation),
    sheets: src.sheets.map(unstation),
    schedule: { ...src.schedule, name: mine.name },
    ftos: mine.ftos,
    documents: { ...src.documents, facilities: [], keyPoints: [] },
    updatedAt: '',
  }
}

export function startingProgram(point: StartingPoint, market: Market): NeopProgram {
  if (point === 'blank') return blankProgram(market)
  if (point.startsWith('copy:')) {
    const from = point.slice(5) as Market
    // Copying your own operation's shipped program keeps everything — it is
    // the same operation, so the stations, FTOs and hospitals are still true.
    if (from === market) return bundledProgram(market) ?? basicsProgram(market)
    return copiedProgram(from, market) ?? basicsProgram(market)
  }
  return basicsProgram(market)
}

/** Operations whose shipped program can be copied. */
export function copyableOperations(): Market[] {
  return MARKETS.map((m) => m.id).filter((m) => !!bundledProgram(m))
}

// ----- cohorts ---------------------------------------------------------------------

/** The part of a program a cohort keeps. Deep-copied: later edits must not reach it. */
export function planFromProgram(p: Pick<NeopProgram, 'checklist' | 'release' | 'schedule'>): CohortPlan {
  return clone({ checklist: p.checklist, release: p.release, schedule: p.schedule })
}

/**
 * The plan a cohort runs.
 *
 * Its own snapshot if it has one. A cohort from before NEOPs were editable has
 * none, and gets the program its operation shipped with — which is precisely
 * what it was running, so nothing about an in-flight cohort changes the day
 * this ships. Failing both (a new operation's cohort that somehow predates its
 * setup), the operation's current program, then the AMR basics.
 */
export function planOf(
  cohort: Pick<AcademyCohort, 'plan'> | undefined,
  market: Market,
  current?: NeopProgram,
): CohortPlan {
  if (cohort?.plan) return cohort.plan
  const shipped = bundledProgram(market)
  if (shipped) return planFromProgram(shipped)
  return planFromProgram(current ?? basicsProgram(market))
}

/** Has the cohort's plan drifted from the operation's current program? */
export function planDiffers(plan: CohortPlan, program: NeopProgram): boolean {
  return JSON.stringify(planFromProgram(program)) !== JSON.stringify(plan)
}

// ----- editing helpers used by the setup steps ------------------------------------

/** A stable id from a label, unique among `taken`. Never reused once stored. */
export function idFromLabel(label: string, taken: Iterable<string>, prefix = ''): string {
  const used = new Set(taken)
  const base =
    prefix +
    (label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'item')
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

/** Sessions in academy order: by week, then by their order within it. */
export function sortSessions(sessions: TemplateSession[]): TemplateSession[] {
  return [...sessions].sort((a, b) => (a.week !== b.week ? a.week - b.week : a.order - b.order))
}

/** Renumber `order` so it runs 1…n across the whole academy. */
export function renumber(sessions: TemplateSession[]): TemplateSession[] {
  return sortSessions(sessions).map((s, i) => ({ ...s, order: i + 1 }))
}

/** A new in-person session with a plain day's shape the facilitator can edit. */
export function newSession(week: number, taken: Iterable<string>, title = 'New session'): TemplateSession {
  return {
    id: idFromLabel(title, taken, 's-'),
    order: 9999,
    week,
    mode: 'in-person',
    title,
    objectives: [],
    defaultStart: '0900',
    blocks: [
      { durationMin: 150, kind: 'education', title: 'Morning' },
      { durationMin: 60, kind: 'lunch', title: 'Lunch' },
      { durationMin: 150, kind: 'education', title: 'Afternoon' },
      { durationMin: 30, kind: 'closeout', title: 'Housekeeping & closeout' },
    ],
  }
}

/** Anything a facilitator must fix before saving. Kept short on purpose. */
export function programProblems(p: NeopProgram): string[] {
  const out: string[] = []
  if (!p.name.trim()) out.push('Give your NEOP a name.')
  if (p.locations.length === 0) out.push('Add at least one station.')
  if (p.credentials.length === 0) out.push('Pick at least one credential you hire.')
  if (p.checklist.some((m) => !m.label.trim())) out.push('A checklist item has no name.')
  if (p.release.minContacts < 0 || p.release.defaultTarget < 0) out.push('Contacts cannot be negative.')
  const ids = p.locations.map((l) => l.id)
  if (new Set(ids).size !== ids.length) out.push('Two stations share an id.')
  return out
}

// ----- the basic academy week -------------------------------------------------------

const DAY = (
  id: string,
  order: number,
  title: string,
  objectives: string[],
  extra: Partial<TemplateSession> = {},
): TemplateSession => ({
  id,
  order,
  week: 1,
  mode: 'in-person',
  title,
  objectives,
  defaultStart: '0900',
  blocks: [
    { durationMin: 150, kind: 'education', title: 'Morning' },
    { durationMin: 60, kind: 'lunch', title: 'Lunch' },
    { durationMin: 150, kind: 'education', title: 'Afternoon' },
    { durationMin: 30, kind: 'closeout', title: 'Housekeeping & closeout' },
  ],
  ...extra,
})

/**
 * The days every AMR academy teaches, in a plain shape: titles and objectives
 * an operation recognises, block times it will want to change. Deliberately
 * not Kansas City's sessions — those name Kansas City's facilitators, rooms
 * and hospitals.
 */
const BASIC_WEEK: TemplateSession[] = [
  DAY('basic-hr', 1, 'HR & systems onboarding', [
    'Complete systems access (Okta, Ninth Brain, Cornerstone)',
    'Finish pre-shift HR items',
  ]),
  DAY('basic-evoc-class', 2, 'EVOC classroom', ['Emergency vehicle operations — classroom portion']),
  DAY('basic-evoc-road', 3, 'EVOC road course', ['Emergency vehicle operations — driving course'], {
    checkoffs: ['evoc-track'],
  }),
  DAY('basic-pcr', 4, 'Documentation (ImageTrend)', ['Enter a complete chart independently']),
  DAY('basic-stretcher', 5, 'Stretcher & equipment check-off', ['Demonstrate safe stretcher handling (GMR v3.2)'], {
    checkoffs: ['stretcher'],
  }),
]

// ----- small utilities ---------------------------------------------------------------

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

export { clone as cloneProgramPart }

/** Shown wherever a schedule is printed or summarised. */
export function scheduleSummary(s: NeopSchedule): string {
  const n = s.sessions.length
  const w = s.weeks.length
  return `${n} session${n === 1 ? '' : 's'} over ${w} week${w === 1 ? '' : 's'}`
}
