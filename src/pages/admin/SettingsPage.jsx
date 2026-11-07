import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMissingBuildings } from '../../lib/missingBuildings'
import { setDoc } from 'firebase/firestore'
import AccessCard from '../../components/AccessCard'
import MissingBuildings from './MissingBuildings'
import UncoveredHouses from './UncoveredHouses'
import { useUncoveredHouses } from '../../lib/uncoveredHouses'
import { useToast } from '../../components/ui/Toast'
import { exportLabels, exportTours } from '../../lib/exports'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { settingsRef } from '../../services/paths'
import { resetProgress, simulateProgress } from '../../services/simulation'
import { accessText, authErrorMessage, changeMyPassword, copyText, createAccount, createMissingAccesses, generatePassword, tourLogin, updateUser } from '../../services/users'

export default function SettingsPage() {
  const { settings, users, toursById, tours } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const [amicale, setAmicale] = useState(settings?.amicale ?? '')
  const [admin, setAdmin] = useState({ name: '', login: '' })
  const [created, setCreated] = useState(null)
  const [pwd, setPwd] = useState({ current: '', next: '' })
  const location = useLocation()
  const [tab, setTab] = useState(location.state?.tab ?? 'general')
  const [sub, setSub] = useState(location.state?.sub ?? 'missing')
  const { rows: missingRows } = useMissingBuildings(toursById)
  const missingCount = missingRows.length
  const uncoveredCount = useUncoveredHouses(tours).rows.length

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

  // Création en une fois des accès des tournées qui n'en ont pas (les autres ne bougent pas).
  const [bulk, setBulk] = useState(null) // { done, total } pendant la création, puis { created, failed }
  const activeTourIds = new Set(users.filter((u) => u.active && u.role !== 'admin' && u.tourId).map((u) => u.tourId))
  const withoutAccess = (tours ?? []).filter((t) => !activeTourIds.has(t.id))
  const createAll = async () => {
    const list = withoutAccess.map((t) => `n°${t.number} ${t.name} → ${tourLogin(t)}`).join('\n')
    if (!window.confirm(`Créer ${withoutAccess.length} accès ?\n\n${list}\n\nLes tournées qui ont déjà un accès ne sont pas touchées.`)) return
    setBulk({ done: 0, total: withoutAccess.length })
    const res = await createMissingAccesses(withoutAccess, users, (done, total) => setBulk({ done, total }))
    setBulk(res)
    toast(`${res.created.length} accès créé${res.created.length > 1 ? 's' : ''}${res.failed.length ? `, ${res.failed.length} en échec` : ''}`)
  }
  const copyAccess = (u) => copyText(accessText(u)).then((ok) => toast(ok ? (u.password ? 'Identifiant et mot de passe copiés' : 'Identifiant copié (mot de passe inconnu)') : 'Copie impossible sur cet appareil'))
  const copyAll = () => {
    const lines = members.filter((u) => u.active && toursById[u.tourId]).sort((a, b) => toursById[a.tourId].number - toursById[b.tourId].number)
      .map((u) => `Tournée ${toursById[u.tourId].number} (${toursById[u.tourId].name}) : ${u.login}${u.password ? ` / ${u.password}` : ''}`)
    copyText([`Adresse : ${window.location.href.split('#')[0]}`, ...lines].join('\n')).then((ok) => toast(ok ? 'Liste des accès copiée' : 'Copie impossible sur cet appareil'))
  }

  const admins = users.filter((u) => u.role === 'admin')
  const members = users.filter((u) => u.role !== 'admin')

  return (
    <div className="page stack-lg">
      <h1>Réglages</h1>
      <div className="segmented settings-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'general'} className={tab === 'general' ? 'on' : ''} onClick={() => setTab('general')}>Général</button>
        <button type="button" role="tab" aria-selected={tab === 'missing'} className={tab === 'missing' ? 'on' : ''} onClick={() => setTab('missing')}>
          Maisons à vérifier{missingCount + uncoveredCount ? <span className="tab-count">{missingCount + uncoveredCount}</span> : null}
        </button>
      </div>
      {tab === 'missing' ? (
        <div className="stack-lg">
          <div className="segmented settings-tabs sub-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={sub === 'missing'} className={sub === 'missing' ? 'on' : ''} onClick={() => setSub('missing')}>
              Adresses sans bâtiment physique{missingCount ? <span className="tab-count">{missingCount}</span> : null}
            </button>
            <button type="button" role="tab" aria-selected={sub === 'uncovered'} className={sub === 'uncovered' ? 'on' : ''} onClick={() => setSub('uncovered')}>
              Maisons non répertoriées dans une tournée{uncoveredCount ? <span className="tab-count">{uncoveredCount}</span> : null}
            </button>
          </div>
          {sub === 'uncovered' ? <UncoveredHouses /> : <MissingBuildings />}
        </div>
      ) : (
      <>

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
        <h2>Simulation (temporaire)</h2>
        <p className="small muted">Remplit les tournées avec un avancement au hasard pour tester l’affichage. « Remise à zéro » efface tous les passages de la campagne {settings?.year}, y compris les vrais.</p>
        <div className="row wrap">
          <button type="button" className="btn-ghost" onClick={() => simulateProgress(settings.year, tours ?? []).then(() => toast('Simulation générée')).catch((err) => toast(`Erreur : ${err.message}`))}>🎲 Générer une simulation</button>
          <button type="button" className="btn-ghost" onClick={() => window.confirm(`Remettre toutes les tournées à zéro pour ${settings.year} ?`) && resetProgress(settings.year, tours ?? []).then(() => toast('Tournées remises à zéro')).catch((err) => toast(`Erreur : ${err.message}`))}>↺ Remise à zéro</button>
        </div>
      </div>
      <div className="card stack">
        <h2>Vérifier les tournées</h2>
        <p className="small muted">Télécharge les rues et les maisons de toutes les tournées (sans les dons ni les comptes), pour faire vérifier les tracés et les villages.</p>
        <div className="row wrap"><button type="button" className="btn-ghost" onClick={() => exportTours(tours ?? [])}>Télécharger les tournées</button></div>
      </div>

      <div className="card stack">
        <h2>Étiquettes des tournées</h2>
        <p className="small muted">Document Word à imprimer et découper : une étiquette par tournée, avec les noms des membres et les secteurs.</p>
        <div className="row wrap"><button type="button" className="btn-ghost" disabled={!tours?.length} onClick={() => exportLabels(tours ?? [], { amicale: settings?.amicale, year: settings?.year }).catch((err) => toast(`Erreur : ${err.message}`))}>Générer les étiquettes (Word)</button></div>
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
        <p className="small muted">Identifiant = prénoms de la tournée (ex. noemie.mathieu), mot de passe = un mot simple. Les accès déjà créés ne sont jamais remplacés.</p>
        <div className="row wrap">
          {withoutAccess.length ? (
            <button type="button" className="btn-primary" disabled={Boolean(bulk?.total && !bulk.created)} onClick={createAll}>
              {bulk?.total && !bulk.created ? `Création… ${bulk.done}/${bulk.total}` : `🔑 Créer les ${withoutAccess.length} accès manquants`}
            </button>
          ) : <span className="small"><strong>✅ Toutes les tournées ont un accès.</strong></span>}
          {members.some((u) => u.active) && <button type="button" className="btn-ghost" onClick={copyAll}>📋 Copier tous les accès</button>}
        </div>
        {bulk?.failed?.length > 0 && (
          <ul className="plain-list small warn">
            {bulk.failed.map((f) => <li key={f.tour.id}>Tournée {f.tour.number} ({f.login}) : {f.error}</li>)}
          </ul>
        )}
        <ul className="plain-list access-list">
          {[...members].sort((a, b) => (toursById[a.tourId]?.number ?? 999) - (toursById[b.tourId]?.number ?? 999) || (b.active - a.active)).map((u) => (
            <li key={u.id} className={u.active ? '' : 'off'}>
              {toursById[u.tourId] ? <span className="tour-dot" style={{ background: toursById[u.tourId].color }}>{toursById[u.tourId].number}</span> : <span className="tour-dot">?</span>}
              <span className="access-ids">
                <strong>{u.login.split('.').map((part, i) => <span key={i}>{i ? '.' : ''}<wbr />{part}</span>)}</strong>
                <small>{u.password ? `mot de passe : ${u.password}` : 'mot de passe inconnu'}{u.active ? '' : ' · désactivé'}</small>
              </span>
              {u.active && <button type="button" className="btn-sm" onClick={() => copyAccess(u)} aria-label={`Copier l’accès ${u.login}`}>📋 Copier</button>}
              <button type="button" className="btn-sm btn-ghost access-toggle" onClick={() => updateUser(u.id, { active: !u.active })}>{u.active ? 'Désactiver' : 'Réactiver'}</button>
            </li>
          ))}
          {!members.length && <li className="muted small">Aucun accès pour l’instant.</li>}
        </ul>
      </div>
      </>
      )}
    </div>
  )
}
