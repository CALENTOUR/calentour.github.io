import { NavLink, Outlet, useLocation } from 'react-router-dom'
import OfflineBanner from './OfflineBanner'
import { APP_NAME } from '../config/constants'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { IS_DEMO } from '../demo/demoInfo'
import { resetDemo } from '../demo/reset'
import { logout } from '../services/users'

const MEMBER_NAV = [
  { to: '/tournee', icon: '🗺️', label: 'Ma tournée' },
  { to: '/stats', icon: '📊', label: 'Mes stats' },
]
const ADMIN_NAV = [
  { to: '/admin', icon: '📈', label: 'Bilan', end: true },
  { to: '/admin/carte', icon: '🗺️', label: 'Carte' },
  { to: '/admin/tournees', icon: '🚒', label: 'Tournées' },
  { to: '/admin/dons', icon: '💶', label: 'Dons' },
  { to: '/admin/reglages', icon: '⚙️', label: 'Réglages' },
]

export default function Layout() {
  const { isAdmin, profile } = useAuth()
  const { settings, year } = useData()
  const nav = isAdmin ? ADMIN_NAV : MEMBER_NAV
  // Carte de la tournée en plein écran (binôme, ou vue terrain d'un admin).
  const { pathname } = useLocation()
  const fullMap = pathname.startsWith('/tournee') || pathname.includes('/terrain') || pathname === '/admin/carte'

  return (
    <div className={`shell ${isAdmin ? 'shell-admin' : 'shell-member'}${fullMap ? ' shell-fullmap' : ''}`}>
      <header className="topbar">
        <div className="brand">🚒 <strong>{APP_NAME}</strong> <span className="brand-year">{year}</span></div>
        <div className="topbar-right">
          {IS_DEMO && <button type="button" className="btn-sm btn-ghost" onClick={resetDemo} title="Réinitialiser la démo">↺ <span className="hide-mobile">Réinitialiser la démo</span></button>}
          <span className="who small hide-mobile">{profile?.name}</span>
          <button type="button" className="btn-sm btn-ghost" onClick={logout}>Quitter</button>
        </div>
      </header>
      {isAdmin && (
        <aside className="sidebar">
          <div className="sidebar-amicale small muted">{settings?.amicale}</div>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="side-link"><span>{n.icon}</span>{n.label}</NavLink>
          ))}
        </aside>
      )}
      <main className="main">
        <OfflineBanner />
        <Outlet />
      </main>
      <nav className="tabbar">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="tab"><span className="tab-icon">{n.icon}</span><span>{n.label}</span></NavLink>
        ))}
      </nav>
    </div>
  )
}
