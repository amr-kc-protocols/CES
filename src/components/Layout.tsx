import { lazy, Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { UndoToast } from './ui'
import { useCESummary } from '../modules/ce/ceStore'
import { QA_ENABLED, CE_ENABLED } from '../config/features'

// QA background sync is mounted only when QA is enabled; lazy so its deps
// (botSync → qaStore → bot-bridge) stay out of the initial chunk while paused.
const BotSyncMount = lazy(() => import('../modules/qa/BotSyncMount'))

const TABS = [
  { to: '/', label: 'Home', icon: '🏠', end: true, qa: false, ce: false },
  { to: '/qa', label: 'QA', icon: '🩺', end: false, qa: true, ce: false },
  { to: '/bot', label: 'QA Bot', icon: '🤖', end: false, qa: true, ce: false },
  { to: '/ce', label: 'CE', icon: '📅', end: false, qa: false, ce: true },
  { to: '/academy', label: 'Academy', icon: '🎓', end: false, qa: false, ce: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', end: false, qa: false, ce: false },
].filter((t) => (QA_ENABLED || !t.qa) && (CE_ENABLED || !t.ce))

export default function Layout() {
  const ce = useCESummary()
  const ceBadge = ce.overdue + ce.dueThisWeek

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
          <div>
            AMR KC Academy
            <small>New Hire &amp; FTO Portal</small>
          </div>
        </div>
      </header>

      <main className="content">
        <Suspense fallback={<div className="subtle" style={{ padding: 20 }}>Loading…</div>}>
          <Outlet />
        </Suspense>
      </main>

      <UndoToast />

      <nav className="tabbar">
        {TABS.map((t) => (
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
