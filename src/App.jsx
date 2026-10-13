import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider, useData } from './context/DataContext'
import { ToastProvider } from './components/ui/Toast'
import Layout from './components/Layout'
import { isFirebaseConfigured } from './lib/firebase'
import { logout } from './services/users'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import PiecePage from './pages/member/PiecePage'
import MyStatsPage from './pages/member/MyStatsPage'
import DashboardPage from './pages/admin/DashboardPage'
import ToursPage from './pages/admin/ToursPage'
import ToursMapPage from './pages/admin/ToursMapPage'
import TourEditPage from './pages/admin/TourEditPage'
import DonsPage from './pages/admin/DonsPage'
import SettingsPage from './pages/admin/SettingsPage'

function Screen({ children }) {
  return <div className="login-screen"><div className="login-card stack">{children}</div></div>
}

function Gate() {
  const { status, isAdmin } = useAuth()
  const { settings, loading } = useData()

  if (status === 'loading' || settings === undefined) return <Screen><div className="logo-big spin">🚒</div><p className="muted">Chargement…</p></Screen>
  if (status === 'signedOut') return settings === null ? <SetupPage /> : <LoginPage />
  if (status === 'noProfile' || status === 'inactive') {
    return (
      <Screen>
        <h2>Accès non autorisé</h2>
        <p className="muted">{status === 'inactive' ? 'Cet accès a été désactivé. Demande ton nouvel identifiant à un administrateur.' : 'Ce compte n’est pas rattaché à l’amicale.'}</p>
        <button onClick={logout}>Se déconnecter</button>
      </Screen>
    )
  }
  if (loading) return <Screen><div className="logo-big spin">🚒</div><p className="muted">Chargement de la tournée…</p></Screen>

  return (
    <Routes>
      <Route element={<Layout />}>
        {!isAdmin && (
          <>
            <Route path="/tournee" element={<PiecePage />} />
            <Route path="/tournee/:pieceId" element={<PiecePage />} />
            <Route path="/stats" element={<MyStatsPage />} />
          </>
        )}
        {isAdmin && (
          <>
            <Route path="/admin" element={<DashboardPage />} />
            <Route path="/admin/carte" element={<ToursMapPage />} />
            <Route path="/admin/tournees" element={<ToursPage />} />
            <Route path="/admin/tournees/:tourId" element={<TourEditPage />} />
            <Route path="/admin/tournees/:tourId/terrain" element={<PiecePage />} />
            <Route path="/admin/tournees/:tourId/terrain/:pieceId" element={<PiecePage />} />
            <Route path="/admin/dons" element={<DonsPage />} />
            <Route path="/admin/reglages" element={<SettingsPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to={isAdmin ? '/admin' : '/tournee'} replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  if (!isFirebaseConfigured) {
    return (
      <Screen>
        <div className="logo-big">🚒</div>
        <h2>Configuration Firebase manquante</h2>
        <p className="muted">Renseignez les clés Firebase (voir <code>docs/INSTALLATION.md</code>).</p>
        <a className="btn btn-primary" href={`${import.meta.env.BASE_URL}demo/`}>Voir la démonstration</a>
      </Screen>
    )
  }
  return (
    <ToastProvider>
      <AuthProvider>
        <DataProvider>
          <HashRouter>
            <Gate />
          </HashRouter>
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
