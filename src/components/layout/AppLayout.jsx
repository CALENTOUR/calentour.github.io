import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { APP_NAME, APP_SLOGAN, ROLE_LABELS } from '../../config/constants'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { logout } from '../../services/users'
import { IS_DEMO } from '../../demo/demoInfo'

const NAV = [
  { to: '/carte', label: 'Carte 3D', icon: '🗺️' },
  { to: '/adresses', label: 'Adresses', icon: '🏠' },
  { to: '/secteurs', label: 'Secteurs', icon: '🧭' },
  { to: '/statistiques', label: 'Statistiques', icon: '📊' },
  { to: '/campagnes', label: 'Campagnes', icon: '📅' },
  { to: '/administration', label: 'Administration', icon: '⚙️', adminOnly: true },
]

export default function AppLayout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { profile, isAdmin } = useAuth()
  const { activeCampaign, pendingWrites } = useData()
  const online = useOnlineStatus()

  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className={`app ${open ? 'menu-open' : ''}`}>
      <button className="menu-toggle" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">☰</button>
      <div className="backdrop" onClick={() => setOpen(false)} />
      <aside className="sidebar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <div>
            <strong>{APP_NAME}</strong>
            <span>{APP_SLOGAN}</span>
          </div>
        </div>
        <nav className="nav">
          {NAV.filter((n) => !n.adminOnly || isAdmin).map((n) => (
            <NavLink key={n.to} to={n.to}>
              <span className="icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="badge" style={{ width: 'fit-content' }}>
            📅 {activeCampaign ? `Campagne ${activeCampaign.year}` : 'Aucune campagne active'}
          </div>
          <div className={`status-pill ${online ? '' : 'offline'}`}>
            <span className="led" />
            {online
              ? pendingWrites ? 'Synchronisation…' : 'En ligne, à jour'
              : 'Hors ligne : saisies gardées sur l’appareil'}
          </div>
          <div>
            <strong>{profile?.name}</strong>
            <div className="muted">{ROLE_LABELS[profile?.role]}</div>
          </div>
          <button className="btn-sm" onClick={logout}>Se déconnecter</button>
          {IS_DEMO && (
            <button
              className="btn-sm btn-ghost"
              onClick={async () => {
                const { resetDemo } = await import('../../demo/store')
                resetDemo()
              }}
            >
              Réinitialiser la démo
            </button>
          )}
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
