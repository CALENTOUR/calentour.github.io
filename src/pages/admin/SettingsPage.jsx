import { useState } from 'react'
import { setDoc } from 'firebase/firestore'
import AccessCard from '../../components/AccessCard'
import { useToast } from '../../components/ui/Toast'
import { exportTours } from '../../lib/exports'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { settingsRef } from '../../services/paths'
import { authErrorMessage, changeMyPassword, createAccount, generatePassword, updateUser } from '../../services/users'

export default function SettingsPage() {
  const { settings, users, toursById, tours } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const [amicale, setAmicale] = useState(settings?.amicale ?? '')
  const [admin, setAdmin] = useState({ name: '', login: '' })
  const [created, setCreated] = useState(null)
  const [pwd, setPwd] = useState({ current: '', next: '' })

  const changePassword = async (e) => {
    e.preventDefault()
    try {
      await changeMyPassword(pwd.current, pwd.next)
      setPwd({ current: '', next: '' })
      toast('Mot de passe changé')
    } catch (err) {
      toast(authErrorMessage(err))
    }
  }

  const save = (data, message) => setDoc(settingsRef(), data, { merge: true })
    .then(() => toast(message))
    .catch((err) => toast(`Erreur : ${err.message}`))

  const newCampaign = () => {
    const next = (settings?.year ?? new Date().getFullYear()) + 1
    if (!window.confirm(`Démarrer la campagne ${next} ? Toutes les maisons repartent « À faire ». Les chiffres de ${settings?.year} restent consultables.`)) return
    save({ year: next }, `Campagne ${next} démarrée`)
  }
  const previousCampaign = () => save({ year: settings.year - 1 }, `Retour à la campagne ${settings.year - 1}`)

  const addAdmin = async (e) => {
    e.preventDefault()
    const password = generatePassword()
    try {
      await createAccount({ login: admin.login, password, name: admin.name, role: 'admin' })
      setCreated({ login: admin.login.trim().toLowerCase(), password })
      setAdmin({ name: '', login: '' })
    } catch (err) {
      toast(authErrorMessage(err))
    }
  }

  const admins = users.filter((u) => u.role === 'admin')
  const members = users.filter((u) => u.role !== 'admin')

  return (
    <div className="page stack-lg">
      <h1>Réglages</h1>

      <form className="card stack" onSubmit={(e) => { e.preventDefault(); save({ amicale: amicale.trim() }, 'Nom enregistré') }}>
        <h2>Amicale</h2>
        <div className="row"><input value={amicale} onChange={(e) => setAmicale(e.target.value)} placeholder="Amicale des sapeurs-pompiers de …" /><button type="submit">Enregistrer</button></div>
      </form>

      <form className="card stack" onSubmit={changePassword}>
        <h2>Mon mot de passe</h2>
        <p className="small muted">Identifiant : <code>{profile?.login}</code></p>
        <div className="row wrap">
          <input type="password" autoComplete="current-password" required value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} placeholder="Mot de passe actuel" />
          <input type="password" autoComplete="new-password" required minLength={6} value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} placeholder="Nouveau (6 caractères min.)" />
          <button type="submit">Changer</button>
        </div>
      </form>

      <div className="card stack">
        <h2>Campagne en cours : {settings?.year}</h2>
        <p className="small muted">Une campagne par année. Les rues, maisons et accès sont gardés d’une année sur l’autre.</p>
        <div className="row wrap">
          <button type="button" onClick={newCampaign}>Démarrer la campagne {(settings?.year ?? 0) + 1}</button>
          <button type="button" className="btn-ghost" onClick={previousCampaign}>Revenir à {(settings?.year ?? 0) - 1}</button>
        </div>
      </div>

      <div className="card stack">
        <h2>Vérifier les tournées</h2>
        <p className="small muted">Télécharge les rues et les maisons de toutes les tournées (sans les dons ni les comptes), pour faire vérifier les tracés et les villages.</p>
        <div className="row wrap"><button type="button" className="btn-ghost" onClick={() => exportTours(tours ?? [])}>Télécharger les tournées</button></div>
      </div>

      <div className="card stack">
        <h2>Classement</h2>
        <label className="switch">
          <input type="checkbox" checked={Boolean(settings?.rankingForMembers)} onChange={(e) => save({ rankingForMembers: e.target.checked }, e.target.checked ? 'Classement visible par les binômes' : 'Classement réservé aux administrateurs')} />
          <span>Les binômes voient le classement des tournées</span>
        </label>
      </div>

      <div className="card stack">
        <h2>Administrateurs</h2>
        <ul className="plain-list">
          {admins.map((u) => (
            <li key={u.id} className="row">
              <span className="spacer">{u.name} <code>{u.login}</code> {u.active ? '' : <span className="warn">(désactivé)</span>}</span>
              {u.id !== profile.id && (
                <button type="button" className="btn-sm btn-ghost" onClick={() => updateUser(u.id, { active: !u.active })}>{u.active ? 'Désactiver' : 'Réactiver'}</button>
              )}
            </li>
          ))}
        </ul>
        <form className="row wrap" onSubmit={addAdmin}>
          <input required value={admin.name} onChange={(e) => setAdmin((a) => ({ ...a, name: e.target.value }))} placeholder="Prénom Nom" />
          <input required value={admin.login} onChange={(e) => setAdmin((a) => ({ ...a, login: e.target.value }))} placeholder="Identifiant (ex. marie.d)" />
          <button type="submit">＋ Ajouter un administrateur</button>
        </form>
        {created && <AccessCard amicale={settings?.amicale} tour={{ number: '-', name: 'Administrateur' }} {...created} />}
      </div>

      <div className="card stack">
        <h2>Accès des binômes</h2>
        <ul className="plain-list">
          {members.map((u) => (
            <li key={u.id} className="row">
              <span className="spacer"><code>{u.login}</code> · {toursById[u.tourId] ? `Tournée ${toursById[u.tourId].number}` : 'sans tournée'} {u.active ? '' : <span className="warn">(désactivé)</span>}</span>
              <button type="button" className="btn-sm btn-ghost" onClick={() => updateUser(u.id, { active: !u.active })}>{u.active ? 'Désactiver' : 'Réactiver'}</button>
            </li>
          ))}
          {!members.length && <li className="muted small">Les accès se créent depuis chaque tournée.</li>}
        </ul>
      </div>
    </div>
  )
}
