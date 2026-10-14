import { useEffect, useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import OfflineBanner from './OfflineBanner'
import Logo from './ui/Logo'
import { IconCash, IconDashboard, IconMap, IconPie, IconSliders, IconTour } from './ui/Icons'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { IS_DEMO } from '../demo/demoInfo'
import { resetDemo } from '../demo/reset'
import { formatEuro, formatPercent } from '../lib/format'
import { globalStats } from '../lib/stats'
import { logout } from '../services/users'
import { saveTour } from '../services/tours'
import { autoCountUnits } from '../lib/logements'

const MEMBER_NAV = [
  { to: '/tournee', icon: <IconTour />, label: 'Ma tournée' },
  { to: '/stats', icon: <IconDashboard />, label: 'Tableau de bord' },
]
// Menu admin : une tuile par rubrique, avec sa couleur et un chiffre clé.
const ADMIN_NAV = [
  { to: '/admin', icon: <IconPie />, tone: 'green', label: 'Tableau de bord', short: 'Bilan', end: true, stat: (g) => `${formatPercent(g.progress)} fait` },
  { to: '/admin/carte', icon: <IconMap />, tone: 'brand', label: 'Tournées', stat: (g, n) => `${n} binôme${n > 1 ? 's' : ''}` },
  { to: '/admin/dons', icon: <IconCash />, tone: 'ocre', label: 'Dons', stat: (g) => formatEuro(g.amount) },
  { to: '/admin/reglages', icon: <IconSliders />, tone: 'blue', label: 'Réglages', stat: () => 'Accès, export' },
]

export default function Layout() {
  const { isAdmin, profile } = useAuth()
  const { settings, year, tours, statesById } = useData()
  const global = useMemo(() => (isAdmin ? globalStats(tours, statesById) : null), [isAdmin, tours, statesById])
  const nav = isAdmin ? ADMIN_NAV : MEMBER_NAV
  // Côté admin, les logements des immeubles sont comptés tout seuls auprès de l'IGN pour les nouvelles maisons.
  useEffect(() => {
    if (!isAdmin || IS_DEMO || !tours?.length) return undefined
    const timer = setTimeout(() => autoCountUnits(tours, saveTour), 3000)
    return () => clearTimeout(timer)
  }, [isAdmin, tours])
  // Carte de la tournée en plein écran (binôme, ou vue terrain d'un admin).
  const { pathname } = useLocation()
  const fullMap = /^\/tournee\/./.test(pathname) || /\/terrain\/./.test(pathname) || pathname === '/admin/carte'

  return (
    <div className={`shell ${isAdmin ? 'shell-admin' : 'shell-member'}${fullMap ? ' shell-fullmap' : ''}`}>
      <header className="topbar">
        <div className="brand"><Logo size={30} className="brand-mark" /><strong className="wordmark">Calen<span>Tour</span></strong> <span className="brand-year">{year}</span></div>
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
            <NavLink key={n.to} to={n.to} end={n.end} className={`side-tile tone-${n.tone}`}>
              <span className="side-tile-icon">{n.icon}</span>
              <span className="side-tile-text"><strong>{n.label}</strong><small>{n.stat(global, tours.length)}</small></span>
            </NavLink>
          ))}
          <div className="side-goal">
            <span className="side-goal-label">Objectif de l’amicale</span>
            <div className="side-goal-bar"><i style={{ width: `${Math.round(global.progress * 100)}%` }} /></div>
            <strong>{global.done} maisons sur {global.total}</strong>
          </div>
        </aside>
      )}
      <main className="main">
        <OfflineBanner />
        <Outlet />
      </main>
      <nav className="tabbar">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={`tab${n.tone ? ` tone-${n.tone}` : ''}`}><span className="tab-icon">{n.icon}</span><span className="tab-label">{n.short ?? n.label}</span></NavLink>
        ))}
      </nav>
    </div>
  )
}
