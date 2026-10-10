import { useState } from 'react'
import { APP_NAME, APP_SLOGAN } from '../config/constants'
import { authErrorMessage, login, register, resetPassword } from '../services/users'
import { IS_DEMO, DEMO_ACCOUNTS } from '../demo/demoInfo'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // login | register | reset
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const run = async (fn, success) => {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
      if (success) setMessage({ ok: true, text: success })
    } catch (err) {
      setMessage({ ok: false, text: authErrorMessage(err) })
    }
    setBusy(false)
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (mode === 'login') run(() => login(form.email, form.password))
    if (mode === 'register') run(() => register(form))
    if (mode === 'reset') run(() => resetPassword(form.email), 'Email de réinitialisation envoyé.')
  }

  return (
    <div className="center-screen">
      <div className="card auth-card">
        <div className="auth-brand">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <h1>{APP_NAME}</h1>
          <p className="muted">{APP_SLOGAN}</p>
        </div>

        {IS_DEMO && (
          <div className="stack" style={{ marginBottom: '1rem' }}>
            <div className="badge" style={{ justifySelf: 'center' }}>Version de démonstration, données fictives</div>
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.email} className="btn-blue" disabled={busy} onClick={() => run(() => login(a.email, a.password))}>
                Entrer comme {a.label}
              </button>
            ))}
          </div>
        )}

        <form className="stack" onSubmit={onSubmit}>
          {mode === 'register' && (
            <label>Nom<input required value={form.name} onChange={set('name')} autoComplete="name" /></label>
          )}
          <label>Email<input required type="email" value={form.email} onChange={set('email')} autoComplete="email" /></label>
          {mode !== 'reset' && (
            <label>
              Mot de passe
              <input required type="password" minLength={6} value={form.password} onChange={set('password')}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
            </label>
          )}
          {message && <p className={message.ok ? 'success' : 'error'}>{message.text}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Se connecter' : mode === 'register' ? 'Créer mon compte' : 'Envoyer le lien'}
          </button>
        </form>

        <div className="row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
          {mode !== 'login' && <button className="btn-ghost btn-sm" onClick={() => setMode('login')}>J’ai déjà un compte</button>}
          {mode !== 'register' && <button className="btn-ghost btn-sm" onClick={() => setMode('register')}>Première connexion</button>}
          {mode !== 'reset' && <button className="btn-ghost btn-sm" onClick={() => setMode('reset')}>Mot de passe oublié</button>}
        </div>
      </div>
    </div>
  )
}
