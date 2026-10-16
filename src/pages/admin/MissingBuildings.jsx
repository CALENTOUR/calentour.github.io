import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ui/Toast'
import { useData } from '../../context/DataContext'
import { runMissingScan, useMissingBuildings } from '../../lib/missingBuildings'
import { saveTour } from '../../services/tours'

// Réglages > Maisons sans bâtiment : les maisons de toutes les tournées dont l'adresse ne
// tombe sur aucun bâtiment de l'IGN, à placer, à garder telles quelles ou à retirer.
export default function MissingBuildings() {
  const { tours, toursById } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const { scan, progress, rows } = useMissingBuildings(toursById)
  const run = () => runMissingScan(tours)
  useEffect(() => {
    if (!scan && !progress && tours?.length) run()
  }, [tours?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const kept = (tours ?? []).flatMap((tour) => (tour.houses ?? []).filter((h) => h.noBuilding).map((house) => ({ tour, house })))

  const setHouse = (tour, house, change) => {
    const houses = change ? tour.houses.map((h) => (h.id === house.id ? change(h) : h)) : tour.houses.filter((h) => h.id !== house.id)
    return saveTour(tour.id, { houses }).catch((err) => toast(`Erreur : ${err.message}`))
  }
  // Placement guidé : toutes les maisons de la tournée à la suite, en commençant par celle-ci.
  const place = ({ tour, house }) => {
    const ids = rows.filter((r) => r.tour.id === tour.id).map((r) => r.house.id)
    navigate(`/admin/tournees/${tour.id}`, { state: { edit: true, guideIds: house ? [house.id, ...ids.filter((id) => id !== house.id)] : ids } })
  }
  const byTour = [...new Map(rows.map((r) => [r.tour.id, r.tour])).values()]
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
          <h2>{rows.length ? `${rows.length} maison${rows.length > 1 ? 's' : ''} à traiter` : '✅ Aucune maison à traiter'}</h2>
          {rows.length > 0 && (
            <div className="mission-start">
              <strong>🎯 Mission placement</strong>
              <span className="small">La carte passe en photo satellite et va sur chaque maison, l’une après l’autre. Tu touches son toit, tu valides, et on passe à la suivante.</span>
              <div className="row wrap">
                {byTour.map((t) => {
                  const n = rows.filter((r) => r.tour.id === t.id).length
                  return <button key={t.id} type="button" className="btn-primary" onClick={() => place({ tour: t })}><span className="tour-dot" style={{ background: t.color }}>{t.number}</span> {n} maison{n > 1 ? 's' : ''}</button>
                })}
              </div>
            </div>
          )}
          <ul className="plain-list missing-list">
            {rows.map((r) => (
              <li key={r.house.id} className="row wrap">
                <span className="tour-dot" style={{ background: r.tour.color }}>{r.tour.number}</span>
                <span className="spacer"><strong>{r.house.label}</strong> <span className="small muted">{r.house.city ?? ''}</span></span>
                <button type="button" className="btn-sm btn-primary" onClick={() => place(r)}>📍 Placer</button>
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
