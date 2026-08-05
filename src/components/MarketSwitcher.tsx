import { MARKETS, setActiveMarket, type Market } from '../lib/market'
import { useSyncStatus } from '../lib/sync'

// ---------------------------------------------------------------------------
// Which operation you are working in.
//
// Always visible when signed in, even for someone who only has one market. The
// two sides look identical — same screens, same tabs, same empty states — so
// the only thing telling you whether an empty cohort list means "nothing
// scheduled" or "you are on the wrong side" is this. Showing it costs a line;
// leaving it out costs someone an afternoon.
//
// The emblem repeats the masthead watermark at a size that survives being read
// on a phone in daylight: Kansas City's fountain, Wichita's aircraft. The
// watermark is atmosphere; this is the part that has to actually work.
//
// The dropdown appears only for `all` accounts. Switching reloads the page,
// which is deliberate — see setActiveMarket.
// ---------------------------------------------------------------------------

function Emblem({ market }: { market: Market }) {
  if (market === 'wichita') {
    // Air Capital of the World — Cessna, Beechcraft, Learjet and Spirit.
    return (
      <svg viewBox="0 0 140 100" aria-hidden="true" focusable="false">
        <path
          d="M70 10c4.5 0 8 6 8.7 16.5l.3 9.5 38 22v10l-38-10-1 19 13 10v8l-21-5.5L49 95v-8l13-10-1-19-38 10V58l38-22 .3-9.5C62 16 65.5 10 70 10z"
          fill="currentColor"
        />
      </svg>
    )
  }
  // City of Fountains.
  return (
    <svg viewBox="0 0 140 100" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round">
        <path d="M70 16v30" />
        <path d="M70 18c-15 5-25 16-27 32" />
        <path d="M70 18c15 5 25 16 27 32" />
      </g>
      <ellipse cx="70" cy="52" rx="22" ry="5.5" fill="currentColor" />
      <path d="M66 57v14h8V57" fill="currentColor" />
      <path d="M34 74h72l-7 13H41z" fill="currentColor" />
    </svg>
  )
}

export default function MarketSwitcher() {
  const { configured, signedIn, market, marketAccess } = useSyncStatus()

  // Local-only installs have one market by definition and no server to
  // disagree with, so the label would be noise.
  if (!configured || !signedIn) return null

  const current = MARKETS.find((m) => m.id === market) ?? MARKETS[0]

  if (marketAccess !== 'all') {
    return (
      <span className="market-chip" title={`You are working in ${current.name}`}>
        <Emblem market={current.id} />
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
      <Emblem market={current.id} />
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
