import { useCallback } from 'react'
import { getState, setState, useSelector } from '../../lib/store'
import { activeMarket, type Market } from '../../lib/market'
import { pushUndo } from '../../lib/undo'
import type { AcademyCohort, CohortPlan, DBShape, NeopProgram } from '../../types'
import { basicsProgram, bundledProgram, planFromProgram } from './program'

// ---------------------------------------------------------------------------
// The store side of an operation's NEOP: reading it, saving it, and the plan
// each cohort runs.
//
// Every value handed to a React selector here is cached by reference. The
// store's useSelector compares results shallowly, and a plan rebuilt on each
// read is a new object every time — which useSyncExternalStore reads as the
// store changing on every render, forever. A shipped program never changes at
// runtime, so it is built once per operation; a saved one is the stored object
// itself; and the plan derived from either is cached against it.
// ---------------------------------------------------------------------------

const shippedCache = new Map<Market, NeopProgram | null>()

/** The program this operation shipped with, built once. Undefined for a new operation. */
export function shippedProgram(market: Market = activeMarket()): NeopProgram | undefined {
  if (!shippedCache.has(market)) shippedCache.set(market, bundledProgram(market) ?? null)
  return shippedCache.get(market) ?? undefined
}

const basicsCache = new Map<Market, NeopProgram>()
function basicsFor(market: Market): NeopProgram {
  if (!basicsCache.has(market)) basicsCache.set(market, basicsProgram(market))
  return basicsCache.get(market)!
}

/** The operation's saved NEOP, or what it shipped with. Undefined: not set up yet. */
export function currentProgram(db: DBShape, market: Market = activeMarket()): NeopProgram | undefined {
  return db.settings.neop ?? shippedProgram(market)
}

/**
 * The program to render against when a screen needs one regardless — the
 * operation's own, else the AMR basics. A cohort screen in an operation that
 * has not finished setup still has to show its roster.
 */
export function programOrBasics(db: DBShape, market: Market = activeMarket()): NeopProgram {
  return currentProgram(db, market) ?? basicsFor(market)
}

/** Has this operation saved a NEOP of its own (rather than running the shipped one)? */
export function hasOwnProgram(db: DBShape): boolean {
  return !!db.settings.neop
}

const planCache = new WeakMap<object, CohortPlan>()
function cachedPlan(source: NeopProgram): CohortPlan {
  let plan = planCache.get(source)
  if (!plan) {
    plan = planFromProgram(source)
    planCache.set(source, plan)
  }
  return plan
}

/** The plan a cohort runs. Stable by reference for an unchanged cohort. */
export function planIn(db: DBShape, cohortId: string | undefined, market: Market = activeMarket()): CohortPlan {
  const cohort = cohortId ? db.academyCohorts.find((c) => c.id === cohortId) : undefined
  if (cohort?.plan) return cohort.plan
  const shipped = shippedProgram(market)
  if (shipped) return cachedPlan(shipped)
  return cachedPlan(programOrBasics(db, market))
}

// ----- hooks ---------------------------------------------------------------------

export function useProgram(): NeopProgram | undefined {
  return useSelector((db) => currentProgram(db))
}

export function useProgramOrBasics(): NeopProgram {
  return useSelector((db) => programOrBasics(db))
}

export function useHasOwnProgram(): boolean {
  return useSelector((db) => hasOwnProgram(db))
}

export function useCohortPlan(cohortId: string | undefined): CohortPlan {
  return useSelector((db) => planIn(db, cohortId))
}

/**
 * A plan lookup for screens that span cohorts (the NEOP list, the dashboard).
 * Re-renders when any cohort or the program changes.
 */
export function usePlanResolver(): (cohortId: string) => CohortPlan {
  const cohorts = useSelector((db) => db.academyCohorts)
  const program = useSelector((db) => db.settings.neop)
  return useCallback(
    (cohortId: string) => planIn(getState(), cohortId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cohorts, program],
  )
}

// ----- writes ----------------------------------------------------------------------

/** Save the operation's NEOP. Undoable for a few seconds, like every other save here. */
export function saveProgram(p: NeopProgram): void {
  const before = getState().settings.neop
  const saved: NeopProgram = { ...p, updatedAt: new Date().toISOString() }
  setState((db) => ({ ...db, settings: { ...db.settings, neop: saved } }))
  pushUndo('NEOP saved', () =>
    setState((db) => ({ ...db, settings: { ...db.settings, neop: before } })),
  )
}

/** The plan a new cohort starts with: the operation's NEOP as it stands. */
export function planForNewCohort(db: DBShape = getState()): CohortPlan {
  return planFromProgram(programOrBasics(db))
}

/** Bring one cohort up to the operation's current NEOP. */
export function refreshCohortPlan(cohortId: string): void {
  const db = getState()
  const before = db.academyCohorts.find((c) => c.id === cohortId)?.plan
  const plan = planFromProgram(programOrBasics(db))
  const patch = (c: AcademyCohort): AcademyCohort =>
    c.id === cohortId ? { ...c, plan, updatedAt: new Date().toISOString() } : c
  setState((s) => ({ ...s, academyCohorts: s.academyCohorts.map(patch) }))
  pushUndo('Cohort updated to your current NEOP', () =>
    setState((s) => ({
      ...s,
      academyCohorts: s.academyCohorts.map((c) => (c.id === cohortId ? { ...c, plan: before } : c)),
    })),
  )
}

