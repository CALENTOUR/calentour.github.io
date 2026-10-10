import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider, useData } from './context/DataContext'
import { ToastProvider } from './components/ui/Toast'
import { isFirebaseConfigured } from './lib/firebase'
import { logout } from './services/users'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import MapPage from './pages/MapPage'
import AddressesPage from './pages/AddressesPage'
import SectorsPage from './pages/SectorsPage'
import StatsPage from './pages/StatsPage'
import CampaignsPage from './pages/CampaignsPage'
import AdminPage from './pages/AdminPage'

function Screen({ children }) {
  return <div className="center-screen"><div className="card auth-card stack" style={{ textAlign: 'center' }}>{children}</div></div>
}

function Gate() {
  const { status, isAdmin } = useAuth()
  const { loading } = useData()

  if (status === 'loading') return <Screen><p className="muted">Chargement…</p></Screen>
  if (status === 'signedOut') return <LoginPage />
  if (status === 'noProfile' || status === 'inactive') {
    return (
      <Screen>
        <h2>Accès non autorisé</h2>
        <p className="muted">
          {status === 'inactive'
            ? 'Votre compte a été désactivé par un administrateur.'
            : 'Votre compte n’est pas encore rattaché à l’amicale. Demandez une invitation à un administrateur.'}
        </p>
        <button onClick={logout}>Se déconnecter</button>
      </Screen>
    )
  }
  if (loading) return <Screen><p className="muted">Chargement des données…</p></Screen>

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/carte" element={<MapPage />} />
        <Route path="/adresses" element={<AddressesPage />} />
        <Route path="/secteurs" element={<SectorsPage />} />
        <Route path="/statistiques" element={<StatsPage />} />
        <Route path="/campagnes" element={<CampaignsPage />} />
        {isAdmin && <Route path="/administration" element={<AdminPage />} />}
        <Route path="*" element={<Navigate to="/carte" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  if (!isFirebaseConfigured) {
    return (
      <Screen>
        <h2>Configuration Firebase manquante</h2>
        <p className="muted">
          Copiez <code>.env.example</code> en <code>.env.local</code> et renseignez les clés de votre projet Firebase,
          puis relancez <code>npm run dev</code>. Voir <code>docs/INSTALLATION.md</code>.
        </p>
        <a className="btn btn-primary" href={`${import.meta.env.BASE_URL}demo/`}>Voir la démonstration</a>
        <p className="muted small">En local, sans Firebase : <code>npm run dev:demo</code>.</p>
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
