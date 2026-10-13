import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TourMap from '../../components/map/TourMap'
import AccessCard from '../../components/AccessCard'
import { pickStreet } from '../../components/map/streetPicker'
import { setGeoJSON } from '../../components/map/useMapLibre'
import { useToast } from '../../components/ui/Toast'
import { TOUR_COLORS } from '../../config/constants'
import { useData } from '../../context/DataContext'
import { newId } from '../../lib/format'
import { projectOnLine, unflatten } from '../../lib/geo'
import { sortHouses } from '../../lib/stats'
import { findHouses, locateOnPieces, mergeSameName } from '../../lib/tourBuilder'
import { deleteTour, newPiece, saveTour } from '../../services/tours'
import { authErrorMessage, createAccount, generatePassword, updateUser } from '../../services/users'

const MODES = [
  { key: 'street', label: '➕ Rue (clic)', help: 'Touche une rue sur la carte : elle est ajoutée en entier à la tournée.' },
  { key: 'draw', label: '✏️ Tracer', help: 'Touche la carte point par point pour tracer un chemin, puis « Terminer ».' },
  { key: 'house', label: '🏠 Maison', help: 'Touche la carte à l’endroit d’une maison qui manque.' },
  { key: 'erase', label: '🗑️ Retirer', help: 'Touche une maison ou un trait de rue pour le retirer.' },
]

function Identity({ tour }) {
  const toast = useToast()
  const [form, setForm] = useState({ number: tour.number, a: tour.members?.[0] ?? '', b: tour.members?.[1] ?? '', color: tour.color })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async (e) => {
    e.preventDefault()
    const members = [form.a, form.b].map((x) => x.trim()).filter(Boolean)
    await saveTour(tour.id, { number: Number(form.number) || tour.number, members, name: members.join(' / ') || tour.name, color: form.color })
    toast('Tournée enregistrée')
  }
  return (
    <form className="card stack" onSubmit={save}>
      <h2>Binôme</h2>
      <div className="form-grid">
        <label>N° de tournée<input type="number" min="1" value={form.number} onChange={set('number')} /></label>
        <label>Pompier 1<input value={form.a} onChange={set('a')} placeholder="Prénom" /></label>
        <label>Pompier 2<input value={form.b} onChange={set('b')} placeholder="Prénom (facultatif)" /></label>
      </div>
      <div className="chips">
        {TOUR_COLORS.map((c) => (
          <button key={c} type="button" className={`color-dot ${form.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setForm((f) => ({ ...f, color: c }))} aria-label={`Couleur ${c}`} />
        ))}
      </div>
      <button type="submit" className="btn-primary">Enregistrer</button>
    </form>
  )
}

function Access({ tour }) {
  const { users, settings } = useData()
  const toast = useToast()
  const [created, setCreated] = useState(null)
  const [busy, setBusy] = useState(false)
  const accounts = users.filter((u) => u.tourId === tour.id)
  const active = accounts.find((u) => u.active)

  const create = async () => {
    setBusy(true)
    const taken = new Set(users.map((u) => u.login))
    let login = `tournee${tour.number}`
    for (let i = 2; taken.has(login); i++) login = `tournee${tour.number}-${i}`
    const password = generatePassword()
    try {
      if (active) await updateUser(active.id, { active: false })
      await createAccount({ login, password, name: tour.name, role: 'member', tourId: tour.id })
      setCreated({ login, password })
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
          : <p className="muted small">Pas encore d’accès. Un clic crée l’identifiant et le mot de passe à donner au binôme.</p>}
      <button type="button" className={active || created ? 'btn-ghost' : 'btn-primary'} disabled={busy} onClick={create}>
        {busy ? 'Création…' : active || created ? '🔄 Nouveau mot de passe (remplace l’accès)' : '🔑 Créer l’accès'}
      </button>
    </div>
  )
}

export default function TourEditPage() {
  const { tourId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { toursById, statesById } = useData()
  const tour = toursById[tourId]
  const [mode, setMode] = useState(null)
  const [draft, setDraft] = useState([])
  const [progress, setProgress] = useState(null)
  const mapRef = useRef(null)
  const tours = useMemo(() => (tour ? [tour] : []), [tour])

  const update = (data) => saveTour(tourId, data).catch((err) => toast(`Erreur : ${err.message}`))

  // Tracé en cours affiché sur la carte.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    setGeoJSON(map, 'draft', {
      type: 'FeatureCollection',
      features: draft.length > 1
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: draft } }]
        : draft.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } })),
    })
    if (!map.getLayer('draft')) {
      map.addLayer({ id: 'draft', type: 'line', source: 'draft', paint: { 'line-color': '#0f172a', 'line-width': 4, 'line-dasharray': [2, 1] } })
      map.addLayer({ id: 'draft-points', type: 'circle', source: 'draft', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 6, 'circle-color': '#0f172a' } })
    }
  }, [draft])

  if (!tour) return <div className="page"><p className="muted">Tournée introuvable.</p><Link to="/admin/tournees">← Tournées</Link></div>

  const addLines = (name, lines) => {
    const label = name ?? `Rue tracée ${tour.pieces.length + 1}`
    const existing = tour.pieces.find((p) => p.name === label)
    const pieces = existing
      ? tour.pieces.map((p) => (p === existing ? { ...p, lines: [...p.lines, ...newPiece(label, lines).lines] } : p))
      : [...tour.pieces, newPiece(label, lines)]
    update({ pieces })
    toast(`${label} ajoutée`)
  }

  const onMapClick = (e, map) => {
    if (mode === 'street') {
      const street = pickStreet(map, e.lngLat)
      if (!street) return toast('Pas de rue ici. Zoome davantage ou utilise « Tracer ».')
      addLines(street.name, street.lines)
    } else if (mode === 'draw') {
      setDraft((d) => [...d, [e.lngLat.lng, e.lngLat.lat]])
    } else if (mode === 'house') {
      if (!tour.pieces.length) return toast('Ajoute d’abord une rue.')
      const label = window.prompt('Adresse de la maison (ex. 12 rue de la Gare) :')
      if (!label) return
      const loc = locateOnPieces(e.lngLat.lng, e.lngLat.lat, tour.pieces)
      const house = { id: newId().slice(0, 12), label: label.trim(), number: label.trim().split(' ')[0], lng: e.lngLat.lng, lat: e.lngLat.lat, pieceId: loc.pieceId, along: loc.along }
      update({ houses: [...tour.houses, house] })
    } else if (mode === 'erase') {
      const click = [e.lngLat.lng, e.lngLat.lat]
      for (const p of tour.pieces) {
        const index = p.lines.findIndex((l) => projectOnLine(click, unflatten(l.c)).dist < 15)
        if (index < 0) continue
        if (!window.confirm(`Retirer ce trait de « ${p.name} » ?`)) return
        const lines = p.lines.filter((_, i) => i !== index)
        const pieces = lines.length ? tour.pieces.map((x) => (x === p ? { ...x, lines } : x)) : tour.pieces.filter((x) => x !== p)
        const houses = lines.length ? tour.houses : tour.houses.filter((h) => h.pieceId !== p.id)
        update({ pieces, houses })
        return
      }
    }
  }

  const onHouseClick = (props) => {
    if (mode === 'erase') {
      const house = tour.houses.find((h) => h.id === props.houseId)
      if (house && window.confirm(`Retirer « ${house.label} » ?`)) update({ houses: tour.houses.filter((h) => h.id !== house.id) })
    }
  }

  const finishDraft = () => {
    if (draft.length > 1) addLines(null, [draft])
    setDraft([])
  }

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
    const n = Math.max(0, Math.min(200, Number.parseInt(answer, 10) || 0))
    const units = Array.from({ length: n }, (_, i) => house.units?.[i] ?? { id: `u${i + 1}`, label: `Appt ${i + 1}` })
    update({ houses: tour.houses.map((h) => (h === house ? { ...h, units } : h)) })
  }
  const removeHouse = (house) => update({ houses: tour.houses.filter((h) => h !== house) })

  const remove = async () => {
    if (!window.confirm(`Supprimer définitivement la tournée ${tour.number} (${tour.name}) ?`)) return
    await deleteTour(tour.id)
    navigate('/admin/tournees')
  }

  const housesByPiece = sortHouses(tour.houses, tour.pieces)
  const activeMode = MODES.find((m) => m.key === mode)

  return (
    <div className="page stack-lg">
      <div className="row">
        <Link to="/admin/tournees" className="btn btn-ghost btn-sm">←</Link>
        <h1 className="spacer"><span className="swatch" style={{ background: tour.color }} />Tournée {tour.number} · {tour.name}</h1>
        <Link to={`/admin/tournees/${tour.id}/terrain/tout`} className="btn btn-sm">📱 Vue terrain</Link>
      </div>

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
          <div className="segmented wrap">
            {MODES.map((m) => (
              <button key={m.key} type="button" className={mode === m.key ? 'on' : ''} onClick={() => { setMode(mode === m.key ? null : m.key); setDraft([]) }}>{m.label}</button>
            ))}
          </div>
          {activeMode && (
            <div className="row small hint">
              <span className="spacer">{activeMode.help}</span>
              {mode === 'draw' && <button type="button" className="btn-sm btn-primary" disabled={draft.length < 2} onClick={finishDraft}>Terminer</button>}
            </div>
          )}
          <TourMap
            tours={tours} statesById={statesById} flat
            onMapClick={mode ? onMapClick : undefined}
            onHouseClick={mode === 'erase' ? onHouseClick : undefined}
            onReady={(m) => { mapRef.current = m }}
            className="edit-map"
          />
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
                {!list.length && <li className="muted small">Aucune maison. Utilise « Chercher les maisons » ou le mode 🏠 Maison.</li>}
              </ul>
            </details>
          )
        })}
      </div>

      <button type="button" className="btn-ghost danger" onClick={remove}>Supprimer cette tournée</button>
    </div>
  )
}
