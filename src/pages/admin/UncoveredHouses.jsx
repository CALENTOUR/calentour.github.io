import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { useData } from '../../context/DataContext'
import { houseFromBuilding } from '../../lib/addressCheck'
import { runUncoveredScan, useUncoveredHouses } from '../../lib/uncoveredHouses'
import { saveTour } from '../../services/tours'

const FAR = 150 // m : au-delà, la maison n'est au bord d'aucune rue tracée
const photo = ([lng, lat]) => `https://www.geoportail.gouv.fr/carte?c=${lng},${lat}&z=19&l0=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)&permalink=yes`

// Réglages > Maisons hors tournée : bâtiments habités des villages des tournées qu'aucune
// tournée n'a, à ajouter à une tournée ou à écarter (grange, maison en ruine…).
export default function UncoveredHouses() {
  const { tours, toursById } = useData()
  const toast = useToast()
  const { buildings, progress, error, rows } = useUncoveredHouses(tours)
  const [choosing, setChoosing] = useState(null)
  // La recherche part toute seule à la première ouverture de l'onglet.
  useEffect(() => {
    if (!buildings && !progress && !error && tours?.length) runUncoveredScan(tours)
  }, [tours?.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const byCity = useMemo(() => {
    const map = new Map()
    for (const r of [...rows].sort((a, b) => (a.nearest?.d ?? Infinity) - (b.nearest?.d ?? Infinity))) {
      const city = r.city || 'Commune inconnue'
      if (!map.has(city)) map.set(city, [])
      map.get(city).push(r)
    }
    return [...map].sort((a, b) => a[0].localeCompare(b[0], 'fr'))
  }, [rows])

  const add = (r, tourId) => {
    setChoosing(null)
    const tour = toursById[tourId]
    if (!tour) return
    const house = houseFromBuilding(r.b, tour)
    saveTour(tour.id, { houses: [...tour.houses, house] })
      .then(() => toast(`« ${house.label} » ajoutée à la tournée n°${tour.number}`))
      .catch((err) => toast(`Erreur : ${err.message}`))
  }
  const ignore = (r) => {
    const tour = r.nearest?.tour ?? tours?.[0]
    if (!tour) return
    const skipBan = [...new Set([...(tour.skipBan ?? []), r.b.id, ...r.b.addresses])]
    saveTour(tour.id, { skipBan }).then(() => toast('Écartée : elle ne sera plus proposée')).catch((err) => toast(`Erreur : ${err.message}`))
  }
  const label = (r) => (r.number ? `${r.number} ${r.street}` : r.street || 'Bâtiment sans adresse')

  return (
    <div className="stack-lg">
      <div className="card stack">
        <h2>Maisons hors tournée</h2>
        <p className="small muted">
          Tous les bâtiments habités des communes des tournées (base des bâtiments BDNB), moins ceux qu’une tournée a déjà.
          Ce qui reste n’est dans aucune tournée : une rue oubliée, un écart, une ferme. Ajoute-la à une tournée, ou écarte-la si personne n’y habite.
        </p>
        <div className="row wrap">
          <button type="button" className={buildings ? 'btn-ghost' : 'btn-primary'} disabled={Boolean(progress) || !tours?.length} onClick={() => runUncoveredScan(tours)}>
            {progress ? `Téléchargement… ${progress.done}/${progress.total} communes` : buildings ? '↻ Relancer' : '🔎 Chercher les maisons oubliées'}
          </button>
          {progress && <span className="small muted">Quelques secondes à une minute par commune.</span>}
          {error && <span className="small warn">Recherche impossible : {error}. Réessaie dans quelques minutes.</span>}
        </div>
      </div>

      {buildings && (
        <div className="card stack">
          <h2>{rows.length ? `${rows.length} maison${rows.length > 1 ? 's' : ''} hors tournée` : '✅ Aucune maison oubliée'}</h2>
          {byCity.map(([city, list]) => (
            <div key={city} className="stack">
              <h3>{city} <span className="muted small">({list.length})</span></h3>
              <ul className="plain-list missing-list">
                {list.map((r) => {
                  const t = r.nearest?.tour
                  const far = !t || r.nearest.d > FAR
                  return (
                    <li key={r.b.id} className="row wrap">
                      <span className="spacer">
                        <strong>{label(r)}</strong>
                        <span className="small muted">{r.b.logements > 1 ? ` · ${r.b.logements} logements` : ''} · {t ? `à ${Math.round(r.nearest.d)} m de la tournée n°${t.number}` : 'aucune rue tracée'}{far ? ' (rue sans tournée ?)' : ''}</span>
                      </span>
                      <a className="btn btn-sm btn-ghost" href={photo(r.pt)} target="_blank" rel="noreferrer">🗺️ Voir</a>
                      {t && <button type="button" className="btn-sm btn-primary" onClick={() => add(r, t.id)}><span className="tour-dot" style={{ background: t.color }}>{t.number}</span> Ajouter</button>}
                      {choosing === r.b.id ? (
                        <select autoFocus className="give-select" defaultValue="" onChange={(e) => add(r, e.target.value)} onBlur={() => setChoosing(null)} aria-label="Tournée qui reçoit la maison">
                          <option value="" disabled>Tournée…</option>
                          {[...(tours ?? [])].sort((a, b) => a.number - b.number).map((x) => <option key={x.id} value={x.id}>n°{x.number} · {x.name}</option>)}
                        </select>
                      ) : <button type="button" className="btn-sm btn-ghost" onClick={() => setChoosing(r.b.id)}>Autre tournée</button>}
                      <button type="button" className="btn-sm btn-ghost" onClick={() => ignore(r)}>Écarter</button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
