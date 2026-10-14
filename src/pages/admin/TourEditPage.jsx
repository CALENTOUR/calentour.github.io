import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import TourMap, { tourPoints } from '../../components/map/TourMap'
import { fitPoints } from '../../components/map/useMapLibre'
import SectorTabs from '../../components/SectorTabs'
import { tourAreas } from '../../lib/places'
import AccessCard from '../../components/AccessCard'
import TourForm from '../../components/TourForm'
import { useToast } from '../../components/ui/Toast'
import { useData } from '../../context/DataContext'
import { sortHouses } from '../../lib/stats'
import { findHouses, mergeSameName } from '../../lib/tourBuilder'
import { removeTour, saveTour } from '../../services/tours'
import TourMapEditor from './TourMapEditor'
import { withUnits } from '../../lib/logements'
import { authErrorMessage, createAccount, generatePassword, normalizeLogin, updateUser } from '../../services/users'

export function Identity({ tour }) {
  const toast = useToast()
  const { tours } = useData()
  const save = async (values) => {
    await saveTour(tour.id, values)
    toast('Tournée enregistrée')
  }
  return (
    <div className="card stack">
      <h2>Équipe</h2>
      <TourForm initial={tour} tours={tours} onSubmit={save} />
    </div>
  )
}

export function Access({ tour }) {
  const { users, settings } = useData()
  const toast = useToast()
  const [created, setCreated] = useState(null)
  const [busy, setBusy] = useState(false)
  const accounts = users.filter((u) => u.tourId === tour.id)
  const active = accounts.find((u) => u.active)

  const [form, setForm] = useState({ login: '', password: '' })

  const create = async (e) => {
    e.preventDefault()
    const taken = new Set(users.map((u) => u.login))
    let login = normalizeLogin(form.login)
    if (login && taken.has(login)) return toast('Cet identifiant est déjà pris.')
    if (!login) {
      login = `tournee${tour.number}`
      for (let i = 2; taken.has(login); i++) login = `tournee${tour.number}-${i}`
    }
    if (form.password && form.password.length < 6) return toast('Mot de passe trop court (6 caractères minimum).')
    const password = form.password || generatePassword()
    setBusy(true)
    try {
      if (active) await updateUser(active.id, { active: false })
      await createAccount({ login, password, name: tour.name, role: 'member', tourId: tour.id })
      setCreated({ login, password })
      setForm({ login: '', password: '' })
    } catch (err) {
      toast(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card stack">
      <h2>Accès du binôme</h2>
      {created ? <AccessCard amicale={settings?.amicale} tour={tour} {...created} />
        : active ? <AccessCard amicale={settings?.amicale} tour={tour} login={active.login} />
          : <p className="muted small">Pas encore d’accès. Choisis un identifiant et un mot de passe, ou laisse vide pour qu’ils soient créés automatiquement.</p>}
      <form className="stack" onSubmit={create}>
        <input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder={`Identifiant (vide = tournee${tour.number})`} autoComplete="off" />
        <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mot de passe (vide = généré, 6 caractères min.)" autoComplete="new-password" />
        <button type="submit" className={active || created ? 'btn-ghost' : 'btn-primary'} disabled={busy}>
          {busy ? 'Création…' : active || created ? '🔄 Remplacer l’accès' : '🔑 Créer l’accès'}
        </button>
      </form>
    </div>
  )
}

export default function TourEditPage() {
  const { tourId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { toursById, statesById, users } = useData()
  const tour = toursById[tourId]
  const location = useLocation()
  // Une tournée qui vient d'être créée s'ouvre directement dans l'éditeur.
  const [editing, setEditing] = useState(Boolean(location.state?.edit))
  const [progress, setProgress] = useState(null)
  const [houseToEdit, setHouseToEdit] = useState(null)
  const tours = useMemo(() => (tour ? [tour] : []), [tour])
  const [previewHouses, setPreviewHouses] = useState(false)
  const [areaSel, setAreaSel] = useState(null)
  const [previewMap, setPreviewMap] = useState(null)
  const areas = useMemo(() => (tour ? tourAreas(tour) : []), [tour])
  const mapAreas = useMemo(() => (areas.length > 1 ? areas.map((a) => ({ ...a, active: a.id === areaSel })) : null), [areas, areaSel])

  if (!tour) return <div className="page"><p className="muted">Tournée introuvable.</p><Link to="/admin/carte">← Tournées</Link></div>

  const update = (data) => saveTour(tourId, data).catch((err) => toast(`Erreur : ${err.message}`))

  const runFind = async () => {
    setProgress(0)
    try {
      const res = await findHouses(tour, (d, n) => setProgress(d / n))
      await saveTour(tour.id, { pieces: res.pieces, houses: res.houses })
      toast(`${res.addedCount} maison${res.addedCount > 1 ? 's' : ''} ajoutée${res.addedCount > 1 ? 's' : ''}`)
    } catch (err) {
      toast(`Recherche impossible : ${err.message}. Vérifie le réseau.`)
    } finally {
      setProgress(null)
    }
  }

  const renamePiece = (p) => {
    const name = window.prompt('Nom de la rue :', p.name)
    if (!name?.trim()) return
    const merged = mergeSameName(tour.pieces.map((x) => (x === p ? { ...x, name: name.trim() } : x)), tour.houses)
    update(merged)
  }
  const movePiece = (index, dir) => {
    const pieces = [...tour.pieces]
    const [p] = pieces.splice(index, 1)
    pieces.splice(index + dir, 0, p)
    update({ pieces })
  }
  const removePiece = (p) => {
    if (!window.confirm(`Retirer « ${p.name} » et ses maisons de la tournée ?`)) return
    update({ pieces: tour.pieces.filter((x) => x !== p), houses: tour.houses.filter((h) => h.pieceId !== p.id) })
  }
  const setUnits = (house) => {
    const answer = window.prompt('Nombre de logements (0 = maison simple) :', String(house.units?.length ?? 0))
    if (answer == null) return
    const n = Number.parseInt(answer, 10) || 0
    update({ houses: tour.houses.map((h) => (h === house ? withUnits(h, n) : h)) })
  }
  const removeHouse = (house) => update({ houses: tour.houses.filter((h) => h !== house) })

  const remove = async () => {
    if (!window.confirm(`Supprimer définitivement la tournée ${tour.number} (${tour.name}) ? Ses rues, ses maisons et ses dons seront supprimés, ses accès désactivés.`)) return
    await removeTour(tour, users)
    toast(`Tournée ${tour.number} supprimée`)
    navigate('/admin/carte')
  }

  const closeEditor = () => {
    setEditing(false)
    if (location.state?.edit) navigate(location.pathname, { replace: true })
  }

  const housesByPiece = sortHouses(tour.houses, tour.pieces)
  const chooseArea = (a) => {
    setAreaSel(a?.id ?? null)
    const pts = a ? tour.pieces.filter((p) => a.pieceIds.includes(p.id)).flatMap((p) => tourPoints([{ pieces: [p] }])) : tourPoints(tours)
    fitPoints(previewMap, pts, { padding: 40, maxZoom: 18 })
  }

  return (
    <div className="page stack-lg">
      <div className="row">
        <Link to="/admin/carte" className="btn btn-ghost btn-sm" aria-label="Retour aux tournées">←</Link>
        <h1 className="spacer"><span className="swatch" style={{ background: tour.color }} />Tournée {tour.number} · {tour.name}</h1>
        <Link to={`/admin/tournees/${tour.id}/terrain`} className="btn btn-sm">📱 Vue terrain</Link>
      </div>

      <button type="button" className="btn-primary btn-hero btn-hero-edit" onClick={() => setEditing(true)}>
        <span className="btn-hero-icon" aria-hidden="true">✏️</span>
        <span className="spacer">
          <strong>Modifier la tournée sur la carte</strong>
          <span>Ajouter ou retirer des rues, ajuster leurs bouts, ajouter une maison oubliée</span>
        </span>
        <span className="btn-hero-go" aria-hidden="true">Ouvrir ›</span>
      </button>

      <div className="edit-layout">
        <div className="stack">
          <Identity key={`${tour.id}-${tour.number}-${tour.name}-${tour.color}`} tour={tour} />
          <Access tour={tour} />
        </div>

        <div className="card stack">
          <div className="row wrap">
            <h2 className="spacer">Rues et maisons</h2>
            <button type="button" className="btn-primary btn-sm" disabled={progress != null || !tour.pieces.length} onClick={runFind}>
              {progress != null ? `Recherche ${Math.round(progress * 100)} %` : '🏠 Chercher les maisons'}
            </button>
          </div>
          <SectorTabs areas={areas} active={areaSel} onChoose={chooseArea} />
          <TourMap tours={tours} statesById={statesById} flat expandable streetLabels showHouses={previewHouses} areas={mapAreas} onReady={setPreviewMap} className="edit-map" onHouseClick={(p) => { setHouseToEdit(p.houseId); setEditing(true) }} />
          <label className="check-line small">
            <input type="checkbox" checked={previewHouses} onChange={(e) => setPreviewHouses(e.target.checked)} />
            Afficher les maisons sur la carte
          </label>
        </div>
      </div>

      <div className="card stack">
        <h2>Ordre de passage <span className="muted small">({tour.pieces.length} rue{tour.pieces.length > 1 ? 's' : ''}, {tour.houses.length} maison{tour.houses.length > 1 ? 's' : ''})</span></h2>
        {tour.pieces.map((p, i) => {
          const list = housesByPiece.filter((h) => h.pieceId === p.id)
          return (
            <details key={p.id} className="piece-edit">
              <summary>
                <span className="spacer"><strong>{i + 1}. {p.name}</strong> <span className="muted small">· {list.length} maisons</span></span>
                <span className="row-actions" onClick={(e) => e.preventDefault()}>
                  <button type="button" className="btn-sm btn-ghost" disabled={!i} onClick={() => movePiece(i, -1)} aria-label="Monter">▲</button>
                  <button type="button" className="btn-sm btn-ghost" disabled={i === tour.pieces.length - 1} onClick={() => movePiece(i, 1)} aria-label="Descendre">▼</button>
                  <button type="button" className="btn-sm btn-ghost" onClick={() => renamePiece(p)}>Renommer</button>
                  <button type="button" className="btn-sm btn-ghost danger" onClick={() => removePiece(p)}>Retirer</button>
                </span>
              </summary>
              <ul className="house-edit-list">
                {list.map((h) => (
                  <li key={h.id}>
                    <span className="spacer">{h.label}{h.units?.length ? ` · 🏢 ${h.units.length} logements` : ''}</span>
                    <button type="button" className="btn-sm btn-ghost" onClick={() => setUnits(h)}>🏢 Logements</button>
                    <button type="button" className="btn-sm btn-ghost danger" onClick={() => removeHouse(h)} aria-label="Retirer">✕</button>
                  </li>
                ))}
                {!list.length && <li className="muted small">Aucune maison. Utilise « Chercher les maisons » ou « Maison non répertoriée » dans l’éditeur.</li>}
              </ul>
            </details>
          )
        })}
      </div>

      <div className="card row wrap">
        <div className="spacer">
          <strong>Supprimer la tournée</strong>
          <div className="small muted">Ses accès sont désactivés. Les dons déjà saisis sur cette tournée sortent des stats et de l’export compta : fais l’export avant.</div>
        </div>
        <button type="button" className="btn-danger" onClick={remove}>🗑️ Supprimer</button>
      </div>
      {editing && <TourMapEditor tour={tour} initialHouseId={houseToEdit} onClose={() => { setHouseToEdit(null); closeEditor() }} />}
    </div>
  )
}
