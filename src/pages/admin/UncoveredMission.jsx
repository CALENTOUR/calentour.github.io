import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import TourMap from '../../components/map/TourMap'
import { fitPoints, setGeoJSON } from '../../components/map/useMapLibre'

// Ordre de visite : de proche en proche, pour que la carte se déplace peu d'une maison à l'autre.
function visitOrder(rows, firstId) {
  const left = [...rows]
  const out = []
  let cur = left.find((r) => r.b.id === firstId) ?? left[0]
  while (cur) {
    out.push(cur.b.id)
    left.splice(left.indexOf(cur), 1)
    const [x, y] = cur.pt
    cur = left.reduce((best, r) => {
      const d = (r.pt[0] - x) ** 2 + (r.pt[1] - y) ** 2
      return !best || d < best.d ? { r, d } : best
    }, null)?.r
  }
  return out
}

// Mission plein écran : la carte des tournées va sur chaque maison hors tournée, l'une
// après l'autre. Ajouter, écarter ou passer mène à la suivante.
export default function UncoveredMission({ rows, tours, statesById, startId, onAdd, onIgnore, onClose }) {
  const [queue] = useState(() => visitOrder(rows, startId))
  const [skipped, setSkipped] = useState([])
  const [choosing, setChoosing] = useState(false)
  const [map, setMap] = useState(null)
  const done = useRef(0)
  const byId = useMemo(() => new Map(rows.map((r) => [r.b.id, r])), [rows])
  // Maison en cours : la première de la file encore hors tournée et pas passée.
  const current = queue.map((id) => byId.get(id)).find((r) => r && !skipped.includes(r.b.id)) ?? null
  const position = queue.length - queue.filter((id) => byId.has(id) && !skipped.includes(id)).length + 1

  useEffect(() => {
    if (!map) return
    setGeoJSON(map, 'uncovered', {
      type: 'FeatureCollection',
      features: rows.map((r) => ({ type: 'Feature', properties: { now: r.b.id === current?.b.id ? 1 : 0 }, geometry: { type: 'Point', coordinates: r.pt } })),
    })
    if (!map.getLayer('uncovered')) {
      map.addLayer({ id: 'uncovered', type: 'circle', source: 'uncovered', paint: {
        'circle-radius': ['case', ['==', ['get', 'now'], 1], 30, 6],
        'circle-color': ['case', ['==', ['get', 'now'], 1], 'rgba(192,73,47,0.18)', '#e0412a'],
        'circle-stroke-color': ['case', ['==', ['get', 'now'], 1], '#e0412a', '#ffffff'],
        'circle-stroke-width': ['case', ['==', ['get', 'now'], 1], 4, 2],
      } })
    }
    if (current) fitPoints(map, current.b.rings.flat(), { padding: { top: 80, bottom: 280, left: 40, right: 40 }, maxZoom: 17.5 })
  }, [map, rows, current])

  const next = (fn) => {
    setChoosing(false)
    if (fn) { done.current++; fn() } else setSkipped((s) => [...s, current.b.id])
  }
  const t = current?.nearest?.tour
  const label = current && (current.number ? `${current.number} ${current.street}` : current.street || 'Bâtiment sans adresse')
  const outline = current ? { type: 'MultiPolygon', coordinates: current.b.rings.map((r) => [r]) } : null

  return createPortal(
    <div className="editor">
      <TourMap satelliteSwitch forceLook="satellite" tours={tours} statesById={statesById} flat streetLabels autoFit={false} outline={outline} onReady={setMap} className="editor-map" />
      <div className="editor-bottom">
        {!current ? (
          <div className="editor-confirm guide-box guide-done">
            <strong className="guide-title">🏆 Mission terminée !</strong>
            <span>{done.current} maison{done.current > 1 ? 's' : ''} traitée{done.current > 1 ? 's' : ''}{skipped.length ? `, ${skipped.length} passée${skipped.length > 1 ? 's' : ''}` : ''}.</span>
            <button type="button" className="btn-primary" onClick={onClose}>Retour à la liste</button>
          </div>
        ) : (
          <div className="editor-confirm guide-box">
            <div className="row">
              <strong className="guide-title spacer">🎯 Maison {position} sur {queue.length}</strong>
              <button type="button" className="btn-sm btn-ghost" onClick={onClose}>Arrêter</button>
            </div>
            <div className="mission-bar"><i style={{ width: `${(100 * (position - 1)) / queue.length}%` }} /></div>
            <strong className="guide-house">🏠 {label} <span className="small muted">{current.city}{current.b.logements > 1 ? ` · ${current.b.logements} logements` : ''}</span></strong>
            <span className="small">{t ? `Rue la plus proche : tournée n°${t.number}, à ${Math.round(current.nearest.d)} m.` : 'Aucune rue tracée à proximité.'} Le cercle rouge montre le bâtiment, les petits points rouges les autres maisons hors tournée.</span>
            {choosing ? (
              <div className="give-btns">
                {[...tours].sort((a, b) => a.number - b.number).map((x) => (
                  <button key={x.id} type="button" onClick={() => next(() => onAdd(current, x.id))}><i style={{ background: x.color }} />N°{x.number} · {x.name}</button>
                ))}
              </div>
            ) : (
              <div className="row wrap">
                {t && <button type="button" className="btn-primary btn-big spacer" onClick={() => next(() => onAdd(current, t.id))}>✅ Ajouter à la n°{t.number}</button>}
                <button type="button" className="spacer" onClick={() => setChoosing(true)}>Autre tournée</button>
              </div>
            )}
            <div className="row">
              <button type="button" className="btn-sm spacer" onClick={() => next(() => onIgnore(current))}>🚫 Écarter (personne n’y habite)</button>
              <button type="button" className="btn-sm spacer" onClick={() => next(null)}>Passer ›</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
