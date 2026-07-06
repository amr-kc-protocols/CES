import { NavLink, Outlet } from 'react-router-dom'
import { useCESummary } from '../modules/ce/ceStore'
import { useBotSyncRunner } from '../modules/qa/botSync'

const TABS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/qa', label: 'QA Queue', icon: '🩺', end: false },
  { to: '/bot', label: 'QA Bot', icon: '🤖', end: false },
  { to: '/ce', label: 'CE Deadlines', icon: '📅', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', end: false },
]

export default function Layout() {
  const ce = useCESummary()
  const ceBadge = ce.overdue + ce.dueThisWeek
  useBotSyncRunner()

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/pwa-192x192.png" alt="" />
          <div>
            AMR CES
            <small>Clinical Education Suite</small>
          </div>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

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
