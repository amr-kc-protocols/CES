import { lazy, Suspense } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { UndoToast } from './ui'
import ErrorBoundary from './ErrorBoundary'
import { ConfirmHost, NoticeToast } from './DialogHost'
import SyncChip from './SyncChip'
import { useCESummary } from '../modules/ce/ceStore'
import { useSyncStatus } from '../lib/sync'
import { useCan } from '../lib/role'
import { QA_ENABLED, CE_ENABLED } from '../config/features'

// QA background sync is mounted only when QA is enabled; lazy so its deps
// (botSync → qaStore → bot-bridge) stay out of the initial chunk while paused.
const BotSyncMount = lazy(() => import('../modules/qa/BotSyncMount'))

const TAB = { qa: false, ce: false, admin: false, aemt: false, review: false }

const TABS = [
  { ...TAB, to: '/', label: 'Home', icon: '🏠', end: true },
  { ...TAB, to: '/qa', label: 'QA', icon: '🩺', end: false, qa: true },
  { ...TAB, to: '/bot', label: 'QA Bot', icon: '🤖', end: false, qa: true },
  { ...TAB, to: '/ce', label: 'CE', icon: '📅', end: false, ce: true },
  // Two distinct programs. NEOP onboards new hires; AEMT is a Kansas-approved
  // certification course with its own regulator, records and retention clock.
  // The routes keep their original paths so existing links and bookmarks work.
  { ...TAB, to: '/academy', label: 'NEOP', icon: '🎓', end: false },
  // AEMT holds certification records and cohort-selection data about staff who
  // are peers of the FTOs using this app daily. Gated on its own capability
  // rather than the plain admin flag: History's rule would also hide it on a
  // local-only install, where there are no roles to enforce in the first place.
  { ...TAB, to: '/aemt', label: 'AEMT', icon: '💉', end: false, aemt: true },
  // Chart review takes patient care reports as input. Same gate as AEMT, and
  // the tab must stay hidden from crews whose own transports it reviews.
  { ...TAB, to: '/review', label: 'Review', icon: '🔎', end: false, review: true },
  { ...TAB, to: '/courses', label: 'Resources', icon: '📚', end: false },
  // History carries unredacted survey feedback about FTOs — admin eyes only.
  { ...TAB, to: '/history', label: 'History', icon: '📊', end: false, admin: true },
  { ...TAB, to: '/settings', label: 'Settings', icon: '⚙️', end: false },
].filter((t) => (QA_ENABLED || !t.qa) && (CE_ENABLED || !t.ce))

export default function Layout() {
  const ce = useCESummary()
  const ceBadge = ce.overdue + ce.dueThisWeek
  // Signed-in admin only — the local signed-out "acts as admin" convenience
  // deliberately does NOT apply here, so an FTO who signs out gains nothing.
  const { signedIn, role } = useSyncStatus()
  const { manageAemt, reviewCharts } = useCan()
  const tabs = TABS.filter(
    (t) =>
      (!t.admin || (signedIn && role === 'admin')) &&
      (!t.aemt || manageAemt) &&
      (!t.review || reviewCharts),
  )
  const { pathname } = useLocation()
  // The review tool is a dense chart table that the 900px reading column would
  // squeeze into uselessness. It supplies its own padding and chrome.
  const fullBleed = pathname.startsWith('/review')

  return (
    <div className="app">
      {QA_ENABLED && (
        <Suspense fallback={null}>
          <BotSyncMount />
        </Suspense>
      )}
      <header className="topbar">
        <div className="brand">
          <img src="/pwa-192x192.png" alt="" />
          <div className="brand-text">
            KC Academy
            <small>Clinical Education Suite</small>
          </div>
        </div>
        <div className="sync-slot">
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
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="icon" style={{ position: 'relative' }}>
              {t.icon}
              {t.to === '/ce' && ceBadge > 0 && <span className="badge">{ceBadge}</span>}
            </span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
