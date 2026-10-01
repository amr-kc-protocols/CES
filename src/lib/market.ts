// ---------------------------------------------------------------------------
// Markets — the AMR operations this app serves.
//
// Four operations: Kansas City, Wichita, Independence and Topeka. Each runs its
// own new-hire program, with its own FTOs, shifts, facilities and protocols —
// which is the reason this is a partition rather than a filter.
//
// One codebase, one deployment, one Supabase project, one set of data per
// operation. A
// market owns everything in the synced store: its own cohorts, trainees, FTO
// evaluations, surveys, AEMT program and QA. Nothing in `records` is shared.
//
// What IS shared needs no mechanism, because it was never in the store —
// skill sheets, check sheets, the K.A.R. rule sets, the AEMT curriculum and
// the how-to guides are static data compiled into the bundle. The partition
// line falls exactly on the `records` table, which is why this is a column
// and a policy rather than an architecture.
//
// Enforcement is server-side. `records.market` plus the RLS policy in
// supabase/migrations/2026-08-06-markets.sql is what actually separates the
// two; everything in this file exists so the client asks for the right thing
// and keeps its local mirror straight. A bug here is a broken screen. The
// database is what stops one market reading the other.
// ---------------------------------------------------------------------------

export type Market = 'kc' | 'wichita' | 'independence' | 'topeka'

/** What a profile may carry. `all` spans both and gets the switcher. */
export type MarketAssignment = Market | 'all'

export const MARKETS: { id: Market; name: string; short: string; abbr: string }[] = [
  // `abbr` is what the phone header shows. At 375px the market chip and the
  // app name compete for the same row, and "Kansas City" wins it — leaving the
  // brand rendered as "KC Ac…", which looks broken rather than abbreviated.
  { id: 'kc', name: 'AMR Kansas City', short: 'Kansas City', abbr: 'KC' },
  { id: 'wichita', name: 'AMR Wichita', short: 'Wichita', abbr: 'Wichita' },
  { id: 'independence', name: 'AMR Independence', short: 'Independence', abbr: 'Indep.' },
  { id: 'topeka', name: 'AMR Topeka', short: 'Topeka', abbr: 'Topeka' },
]

/**
 * The market this device is currently working in.
 *
 * Kansas City is the default because it is where every existing record and
 * every existing user already lives — a device that has never heard of markets
 * is a Kansas City device, and must keep working as one.
 */
export const DEFAULT_MARKET: Market = 'kc'

const ACTIVE_KEY = 'ces.market.active'

export function isMarket(v: unknown): v is Market {
  return v === 'kc' || v === 'wichita' || v === 'independence' || v === 'topeka'
}

export function activeMarket(): Market {
  if (typeof localStorage === 'undefined') return DEFAULT_MARKET
  const raw = localStorage.getItem(ACTIVE_KEY)
  return isMarket(raw) ? raw : DEFAULT_MARKET
}

export function marketName(id: Market): string {
  return (MARKETS.find((m) => m.id === id) ?? MARKETS[0]).name
}

/**
 * Namespace a localStorage key by market.
 *
 * Kansas City deliberately keeps the ORIGINAL, unsuffixed keys. Every device
 * in service today holds a Kansas City mirror under those names, some of it
 * with unsynced edits from a shift that has not reconnected yet. Suffixing
 * everything would have been tidier and would have silently orphaned that
 * data on the day this shipped. Every other operation is newer than that, so
 * each gets a suffix.
 */
export function marketKey(base: string, market: Market = activeMarket()): string {
  return market === 'kc' ? base : `${base}.${market}`
}

/**
 * Switch markets and reload.
 *
 * The reload is the point, not a shortcut around one. The in-memory store
 * snapshot, the sync cursor, the outbox and every mounted component's state
 * are all bound to the market that was active when they were created. Swapping
 * the backing key underneath them would leave Kansas City rows on screen under
 * a Wichita heading until something happened to re-render. A market switch is
 * rare and deliberate; starting clean is worth one page load.
 */
export function setActiveMarket(market: Market): void {
  if (typeof localStorage === 'undefined') return
  if (activeMarket() === market) return
  localStorage.setItem(ACTIVE_KEY, market)
  location.reload()
}

/**
 * Reconcile the local pick against what the server says this account may see.
 *
 * Called once the profile is known. Someone whose assignment is a single
 * market must land in it whatever this device last chose — otherwise an
 * account moved from `all` to `kc` would go on operating in Wichita from a
 * stale pick, sending writes the RLS policy will refuse and showing an empty
 * app while it does. Returns true when it had to reload.
 */
export function reconcileMarket(assignment: MarketAssignment | undefined): boolean {
  if (!assignment || assignment === 'all') return false
  if (activeMarket() === assignment) return false
  setActiveMarket(assignment)
  return true
}
