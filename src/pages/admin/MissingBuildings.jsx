import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ui/Toast'
import { useData } from '../../context/DataContext'
import { scanMissing } from '../../lib/ignBuildings'
import { saveTour } from '../../services/tours'

// Dernière recherche, gardée pendant la visite pour ne pas tout recharger à chaque retour sur l'onglet.
let lastScan = null

// Réglages > Maisons sans bâtiment : les maisons de toutes les tournées dont l'adresse ne
// tombe sur aucun bâtiment de l'IGN, à placer, à garder telles quelles ou à retirer.
export default function MissingBuildings({ onCount }) {
  const { tours, toursById } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const [scan, setScan] = useState(lastScan)
  const [progress, setProgress] = useState(null)

  const run = async () => {
    setProgress({ done: 0, total: 0 })
    try {
      const res = await scanMissing(tours ?? [], (done, total) => setProgress({ done, total }))
      lastScan = { ...res, ids: res.missing.map(({ tour, house }) => [tour.id, house.id, house.lng, house.lat]) }
      setScan(lastScan)
    } finally {
      setProgress(null)
    }
  }
  useEffect(() => {
    if (!lastScan && tours?.length) run()
  }, [tours?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Liste à jour : les maisons déplacées, gardées ou retirées depuis la recherche disparaissent.
  const rows = (scan?.ids ?? []).map(([tourId, houseId, lng, lat]) => {
    const tour = toursById[tourId]
    const house = tour?.houses?.find((h) => h.id === houseId)
    return house && !house.noBuilding && house.lng === lng && house.lat === lat ? { tour, house } : null
  }).filter(Boolean).sort((a, b) => a.tour.number - b.tour.number || String(a.house.label).localeCompare(String(b.house.label), 'fr', { numeric: true }))
  const kept = (tours ?? []).flatMap((tour) => (tour.houses ?? []).filter((h) => h.noBuilding).map((house) => ({ tour, house })))
  useEffect(() => { onCount?.(scan ? rows.length : null) }, [scan, rows.length, onCount])

  const setHouse = (tour, house, change) => {
    const houses = change ? tour.houses.map((h) => (h.id === house.id ? change(h) : h)) : tour.houses.filter((h) => h.id !== house.id)
    return saveTour(tour.id, { houses }).catch((err) => toast(`Erreur : ${err.message}`))
  }
  const place = ({ tour, house }) => navigate(`/admin/tournees/${tour.id}`, { state: { edit: true, move: true, houseId: house.id } })
  const keep = ({ tour, house }) => setHouse(tour, house, (h) => ({ ...h, noBuilding: true })).then(() => toast(`« ${house.label} » ne sera plus signalée`))
  const remove = ({ tour, house }) => window.confirm(`Retirer « ${house.label} » de la tournée n°${tour.number} ?`) && setHouse(tour, house).then(() => toast(`« ${house.label} » retirée`))
  const restore = ({ tour, house }) => setHouse(tour, house, ({ noBuilding, ...h }) => h) // eslint-disable-line no-unused-vars

  return (
    <div className="stack-lg">
      <div className="card stack">
        <h2>Maisons sans bâtiment</h2>
        <p className="small muted">
          Adresses qui ne tombent sur aucun bâtiment, ni sur le plan ni au cadastre (bâtiments de l’IGN). Souvent un point d’adresse posé au bout d’un chemin ou au milieu de la rue.
          Pour chacune : la placer sur son toit, la garder telle quelle si c’est normal (elle ne sera plus signalée), ou la retirer.
        </p>
        <div className="row wrap">
          <button type="button" className="btn-ghost" disabled={Boolean(progress) || !tours?.length} onClick={run}>
            {progress ? `Recherche… ${progress.total ? `${progress.done}/${progress.total} zones` : ''}` : '↻ Relancer la recherche'}
          </button>
          {scan && !progress && <span className="small muted">{scan.checked} maisons vérifiées{scan.failed ? `, ${scan.failed} zone${scan.failed > 1 ? 's' : ''} sans réponse de l’IGN (réessaie plus tard)` : ''}</span>}
        </div>
      </div>

      {scan && (
        <div className="card stack">
          <h2>{rows.length ? `${rows.length} maison${rows.length > 1 ? 's' : ''} à traiter` : 'Aucune maison à traiter'}</h2>
          <ul className="plain-list missing-list">
            {rows.map((r) => (
              <li key={r.house.id} className="row wrap">
                <span className="tour-dot" style={{ background: r.tour.color }}>{r.tour.number}</span>
                <span className="spacer"><strong>{r.house.label}</strong> <span className="small muted">{r.house.city ?? ''}</span></span>
                <button type="button" className="btn-sm btn-primary" onClick={() => place(r)}>📍 Placer sur la carte</button>
                <button type="button" className="btn-sm btn-ghost" onClick={() => keep(r)}>Pas de bâtiment, c’est normal</button>
                <button type="button" className="btn-sm btn-ghost" onClick={() => remove(r)}>🗑️ Retirer</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {kept.length > 0 && (
        <div className="card stack">
          <h2>Gardées sans bâtiment ({kept.length})</h2>
          <ul className="plain-list missing-list">
            {kept.map((r) => (
              <li key={r.house.id} className="row wrap">
                <span className="tour-dot" style={{ background: r.tour.color }}>{r.tour.number}</span>
                <span className="spacer">{r.house.label} <span className="small muted">{r.house.city ?? ''}</span></span>
                <button type="button" className="btn-sm btn-ghost" onClick={() => restore(r)}>Signaler à nouveau</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
