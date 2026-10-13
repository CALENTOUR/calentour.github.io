import { useState } from 'react'
import { APP_NAME, APP_SLOGAN } from '../config/constants'
import { useData } from '../context/DataContext'
import { IS_DEMO, DEMO_ACCOUNTS } from '../demo/demoInfo'
import { authErrorMessage, login } from '../services/users'
import Logo from '../components/ui/Logo'

export default function LoginPage() {
  const { settings } = useData()
  const [form, setForm] = useState({ login: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (credentials) => {
    setBusy(true)
    setError('')
    try {
      await login(credentials.login, credentials.password)
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <Logo size={72} className="logo-big" />
        <h1>{APP_NAME}</h1>
        <p className="muted">{settings?.amicale || APP_SLOGAN}</p>
        {IS_DEMO && (
          <div className="stack demo-box">
            <strong>Démonstration (données fictives)</strong>
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.login} type="button" className={a.role === 'admin' ? 'btn-primary' : 'btn-blue'} disabled={busy} onClick={() => submit(a)}>
                Entrer comme {a.label}
              </button>
            ))}
          </div>
        )}
        <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(form) }}>
          <label>Identifiant
            <input autoComplete="username" autoCapitalize="none" required value={form.login} onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))} placeholder="ex. tournee7" />
          </label>
          <label>Mot de passe
            <input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary btn-big" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        </form>
        <p className="small muted">Identifiant oublié ? Demande à un administrateur de l’amicale.</p>
      </div>
    </div>
  )
}
