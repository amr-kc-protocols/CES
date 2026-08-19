import { lazy, Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { UndoToast } from './ui'
import ErrorBoundary from './ErrorBoundary'
import { ConfirmHost, NoticeToast } from './DialogHost'
import SyncChip from './SyncChip'
import MarketSwitcher from './MarketSwitcher'
import { useCESummary } from '../modules/ce/ceStore'
import { useSyncStatus } from '../lib/sync'
import { HOME, isFullBleed, sectionOf, useVisibleNav } from '../lib/nav'
import { QA_ENABLED } from '../config/features'

// QA background sync is mounted only when QA is enabled; lazy so its deps
// (botSync → qaStore → bot-bridge) stay out of the initial chunk while paused.
const BotSyncMount = lazy(() => import('../modules/qa/BotSyncMount'))

export default function Layout() {
  const ce = useCESummary()
  const ceBadge = ce.overdue + ce.dueThisWeek
  const { configured, signedIn, market } = useSyncStatus()
  // Five cells at most, and the same five whatever the account — see lib/nav.
  const sections = useVisibleNav()
  const { pathname } = useLocation()
  const here = sectionOf(pathname)
  // Which screens supply their own chrome is declared on the nav item, so the
  // shell keeps no list of paths of its own.
  const fullBleed = isFullBleed(pathname)

  // Drives the city watermark in the masthead. Only set once the market is a
  // real fact about this account — on a local-only device it would be
  // decoration claiming to be information.
  const showMarket = configured && signedIn

  return (
    <div className="app" data-market={showMarket ? market : undefined}>
      {QA_ENABLED && (
        <Suspense fallback={null}>
          <BotSyncMount />
        </Suspense>
      )}
      <header className="topbar">
        <div className="brand">
          <img src="/pwa-192x192.png" alt="" />
          <div className="brand-text">
            AMR Kansas Academy
            <small>Clinical Education Suite</small>
          </div>
        </div>
        <div className="sync-slot">
          <MarketSwitcher />
          <SyncChip />
        </div>
      </header>

      {/* Boundary sits inside <main>, so a crashed screen keeps the header and
          the tab bar — the user can navigate out instead of being stranded. */}
      <main className={fullBleed ? 'content full-bleed' : 'content'}>
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<div className="subtle" style={{ padding: 20 }}>Loading…</div>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <div className="toast-stack">
        <UndoToast />
        <NoticeToast />
      </div>
      <ConfirmHost />

      <nav className="tabbar">
        <NavLink to={HOME.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="icon">{HOME.icon}</span>
          {HOME.label}
        </NavLink>
        {sections.map((s) => {
          // A section owns several routes, so NavLink's own matching (its path
          // only) would leave the bar dark on every screen inside one. The
          // section that claims the current path decides instead.
          const active = here?.to === s.to
          // The deadline count belongs to whichever section holds the CE
          // tracker, rather than to a tab of its own.
          const badge = s.items.some((i) => i.to === '/ce') ? ceBadge : 0
          return (
            <Link key={s.to} to={s.to} className={active ? 'active' : ''}>
              <span className="icon" style={{ position: 'relative' }}>
                {s.icon}
                {badge > 0 && <span className="badge">{badge}</span>}
              </span>
              {s.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
