import { MARKETS, setActiveMarket, type Market } from '../lib/market'
import { useSyncStatus } from '../lib/sync'

// ---------------------------------------------------------------------------
// Which operation you are working in.
//
// Always visible when signed in, even for someone who only has one market. The
// two sides look identical — same screens, same tabs, same everything — so the
// only thing telling you whether that empty cohort list means "nothing
// scheduled" or "you are on the wrong side" is this label. Showing it costs a
// line; leaving it out costs someone an afternoon.
//
// The dropdown appears only for `all` accounts. Switching reloads the page,
// which is deliberate — see setActiveMarket.
// ---------------------------------------------------------------------------

export default function MarketSwitcher() {
  const { configured, signedIn, market, marketAccess } = useSyncStatus()

  // Local-only installs have one market by definition and no server to
  // disagree with, so the label would be noise.
  if (!configured || !signedIn) return null

  const current = MARKETS.find((m) => m.id === market) ?? MARKETS[0]

  if (marketAccess !== 'all') {
    return (
      <span className="market-chip" title={`You are working in ${current.name}`}>
        {/* Both rendered, one shown — CSS picks by width. A JS media query
            would re-render the header on every resize for two words. */}
        <span className="market-full">{current.short}</span>
        <span className="market-abbr">{current.abbr}</span>
      </span>
    )
  }

  // The dropdown keeps its full labels at every width. It renders for `all`
  // accounts only — one or two people who run both operations, and who are
  // reading a roster on a laptop when they switch rather than a phone in a truck.
  return (
    <label className="market-chip switch" title="Switch operation. Reloads the app.">
      <span className="sr-only">Operation</span>
      <select
        value={market}
        onChange={(e) => setActiveMarket(e.target.value as Market)}
        aria-label="Operation"
      >
        {MARKETS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.short}
          </option>
        ))}
      </select>
    </label>
  )
}
