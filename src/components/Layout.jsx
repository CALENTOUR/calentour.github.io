import { useEffect, useMemo, useRef } from 'react'
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
import { autoCheckAddresses, needsCheck } from '../lib/addressCheck'
import { useToast } from './ui/Toast'

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
  // Côté admin, les nouvelles maisons sont vérifiées toutes seules : d'abord avec la BDNB
  // (position, doublons, dépendances, tournées en double, maisons oubliées), puis les
  // logements des immeubles sont comptés auprès de l'IGN. Un seul travail à la fois, pour
  // que l'un n'écrase pas les maisons enregistrées par l'autre.
  const toast = useToast()
  const latest = useRef({ tours, statesById })
  latest.current = { tours, statesById }
  useEffect(() => {
    if (!isAdmin || IS_DEMO || !tours?.length) return undefined
    const timer = setTimeout(() => {
      if (!needsCheck(tours)) return autoCountUnits(tours, saveTour)
      autoCheckAddresses(() => latest.current.tours, latest.current.statesById, saveTour, (r) => {
        const parts = [
          r.moved && `${r.moved} replacée${r.moved > 1 ? 's' : ''} sur leur bâtiment`,
          r.duplicates && `${r.duplicates} doublon${r.duplicates > 1 ? 's' : ''} retiré${r.duplicates > 1 ? 's' : ''}`,
          r.annexes && `${r.annexes} dépendance${r.annexes > 1 ? 's' : ''} retirée${r.annexes > 1 ? 's' : ''}`,
          r.shared && `${r.shared} en double entre tournées`,
          r.added && `${r.added} oubliée${r.added > 1 ? 's' : ''} ajoutée${r.added > 1 ? 's' : ''}`,
        ].filter(Boolean)
        if (parts.length) toast(`Adresses vérifiées : ${parts.join(', ')}`)
      })
    }, 3000)
    return () => clearTimeout(timer)
  }, [isAdmin, tours, toast])
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
