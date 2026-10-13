import { useState } from 'react'
import { authErrorMessage, setupAmicale } from '../services/users'
import Logo from '../components/ui/Logo'

// Premier lancement : aucune amicale configurée dans Firebase.
export default function SetupPage() {
  const [form, setForm] = useState({ amicale: '', name: '', login: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await setupAmicale(form)
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card stack" onSubmit={submit}>
        <Logo size={72} className="logo-big" />
        <h1>Bienvenue</h1>
        <p className="muted">Première utilisation : crée l’amicale et ton compte administrateur.</p>
        <label>Nom de l’amicale<input required value={form.amicale} onChange={set('amicale')} placeholder="Amicale des sapeurs-pompiers de …" /></label>
        <label>Ton prénom et nom<input required value={form.name} onChange={set('name')} /></label>
        <label>Ton identifiant<input required autoCapitalize="none" value={form.login} onChange={set('login')} placeholder="ex. dylan" /></label>
        <label>Ton mot de passe<input required type="password" minLength={6} value={form.password} onChange={set('password')} /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn-primary btn-big" disabled={busy}>{busy ? 'Création…' : 'Créer l’amicale'}</button>
      </form>
    </div>
  )
}
