import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import TourMap, { piecesGeoJSON } from '../../components/map/TourMap'
import { pickStreet, touchTolerance } from '../../components/map/streetPicker'
import { snapToRoads } from '../../components/map/snapToRoads'
import { setGeoJSON } from '../../components/map/useMapLibre'
import { useToast } from '../../components/ui/Toast'
import { useData } from '../../context/DataContext'
import { newId } from '../../lib/format'
import { chainLines, distance, flatten, projectOnLine, sliceLine, unflatten } from '../../lib/geo'
import { addFoundHouses, locateOnPieces, searchHouses } from '../../lib/tourBuilder'
import { saveTour } from '../../services/tours'

const MODES = [
  { key: 'street', icon: '➕', label: 'Rue', help: 'Touche une rue : elle s’allume en orange, puis choisis « Toute la rue » ou « Ce tronçon ». Fais glisser les ronds blancs pour allonger ou raccourcir.' },
  { key: 'draw', icon: '✏️', label: 'Tracer', help: 'Touche quelques points le long de la rue, même grossièrement : le tracé se recale sur la route (en orange). Puis « Valider le tracé ».' },
  { key: 'house', icon: '🏠', label: 'Maison', help: 'Touche l’endroit d’une maison qui manque.' },
  { key: 'erase', icon: '🗑️', label: 'Retirer', help: 'Touche une maison ou un trait de rue pour le retirer.' },
]

const EMPTY = { type: 'FeatureCollection', features: [] }
const lineFeatures = (lines) => ({
  type: 'FeatureCollection',
  features: lines.map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })),
})

const MAX_HOUSE_DISTANCE = 45 // mètres : au-delà, une maison n'appartient plus à la rue

// Un trait de rue : `c` le tracé retenu, `r` la rue complète le long de laquelle
// les poignées font glisser les extrémités.
const makeLine = (coords, ref) => ({ c: flatten(coords), ...(ref ? { r: flatten(ref) } : {}) })

// Nouveau tracé quand on fait glisser l'extrémité `end` (0 début, 1 fin) jusqu'à `point`.
export function moveLineEnd(line, end, point, tolerance) {
  const c = unflatten(line.c)
  const ref = line.r ? unflatten(line.r) : c
  const from = projectOnLine(c[0], ref).along
  const to = projectOnLine(c[c.length - 1], ref).along
  const hit = projectOnLine(point, ref)
  if (hit.dist <= tolerance) {
    const a = end === 0 ? hit.along : from
    const b = end === 0 ? to : hit.along
    if (Math.abs(b - a) < 8) return null
    const sliced = sliceLine(ref, a, b)
    return makeLine(a <= b ? sliced : sliced.reverse(), line.r ? ref : null)
  }
  // En dehors de la rue : on prolonge en ligne droite jusqu'au point.
  const next = end === 0 ? [point, ...c] : [...c, point]
  const atRefEnd = line.r && distance(end === 0 ? c[0] : c[c.length - 1], end === 0 ? ref[0] : ref[ref.length - 1]) < 2
  return makeLine(next, atRefEnd ? (end === 0 ? [point, ...ref] : [...ref, point]) : null)
}

function handlesGeoJSON(tour) {
  return {
    type: 'FeatureCollection',
    features: tour.pieces.flatMap((p) => p.lines.flatMap((l, i) => {
      const c = unflatten(l.c)
      if (c.length < 2) return []
      return [0, 1].map((end) => ({
        type: 'Feature',
        properties: { pieceId: p.id, line: i, end },
        geometry: { type: 'Point', coordinates: end === 0 ? c[0] : c[c.length - 1] },
      }))
    })),
  }
}

// Maisons rattachées à une rue qui ne la longent plus après un raccourcissement.
function keepNearHouses(houses, pieces) {
  return houses.filter((h) => {
    const p = pieces.find((x) => x.id === h.pieceId)
    if (!p) return false
    return p.lines.some((l) => projectOnLine([h.lng, h.lat], unflatten(l.c)).dist <= MAX_HOUSE_DISTANCE)
  })
}

function ensureEditorLayers(map) {
  if (map.getLayer('others')) return
  setGeoJSON(map, 'others', EMPTY)
  setGeoJSON(map, 'preview', EMPTY)
  setGeoJSON(map, 'draft', EMPTY)
  setGeoJSON(map, 'handles', EMPTY)
  setGeoJSON(map, 'adjust', EMPTY)
  const below = map.getLayer('pieces-casing') ? 'pieces-casing' : undefined
  map.addLayer({ id: 'others', type: 'line', source: 'others', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.35, 'line-dasharray': [1.5, 1.5] } }, below)
  map.addLayer({ id: 'preview-casing', type: 'line', source: 'preview', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 14 } })
  map.addLayer({ id: 'preview', type: 'line', source: 'preview', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f97316', 'line-width': 8 } })
  map.addLayer({ id: 'adjust', type: 'line', source: 'adjust', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#f97316', 'line-width': 8, 'line-opacity': 0.9 } })
  map.addLayer({ id: 'handles', type: 'circle', source: 'handles', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 6, 17, 11], 'circle-color': '#ffffff', 'circle-stroke-color': '#0f172a', 'circle-stroke-width': 3 } })
  map.addLayer({ id: 'draft', type: 'line', source: 'draft', paint: { 'line-color': '#0f172a', 'line-width': 4, 'line-dasharray': [2, 1] } })
  map.addLayer({ id: 'draft-points', type: 'circle', source: 'draft', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 7, 'circle-color': '#0f172a', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } })
}

// Éditeur plein écran des rues d'une tournée : ajout d'une rue au toucher avec aperçu,
// tracé libre, maisons, retrait, et retour arrière.
export default function TourMapEditor({ tour, onClose }) {
  const toast = useToast()
  const { tours: allTours, statesById } = useData()
  const [mode, setMode] = useState('street')
  const [draft, setDraft] = useState([])
  const [preview, setPreview] = useState(null)
  const [history, setHistory] = useState([])
  const [map, setMap] = useState(null)
  const tours = useMemo(() => [tour], [tour])
  const others = useMemo(() => allTours.filter((t) => t.id !== tour.id), [allTours, tour.id])

  // Chaque modification garde l'état précédent pour « Annuler ».
  const update = (data) => {
    setHistory((h) => [...h.slice(-19), { pieces: tour.pieces, houses: tour.houses }])
    return saveTour(tour.id, data).catch((err) => toast(`Erreur : ${err.message}`))
  }
  const undo = () => {
    const last = history.at(-1)
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    saveTour(tour.id, last).catch((err) => toast(`Erreur : ${err.message}`))
    toast('Dernière modification annulée')
  }

  useEffect(() => {
    if (!map) return
    ensureEditorLayers(map)
    setGeoJSON(map, 'others', piecesGeoJSON(others))
  }, [map, others])

  useEffect(() => {
    if (!map) return
    ensureEditorLayers(map)
    setGeoJSON(map, 'preview', lineFeatures(preview ? (preview.only ? [preview.segment] : preview.lines) : []))
  }, [map, preview])

  // Tracé à main levée recalé sur les routes, affiché en orange.
  const snappedDraft = useMemo(() => (map && draft.length > 1 ? snapToRoads(map, draft) : []), [map, draft])
  useEffect(() => {
    if (!map || mode !== 'draw') return
    ensureEditorLayers(map)
    setGeoJSON(map, 'preview', lineFeatures(snappedDraft.length > 1 ? [snappedDraft] : []))
  }, [map, mode, snappedDraft])

  useEffect(() => {
    if (!map) return
    ensureEditorLayers(map)
    setGeoJSON(map, 'draft', {
      type: 'FeatureCollection',
      features: [
        ...(draft.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: draft } }] : []),
        ...draft.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } })),
      ],
    })
  }, [map, draft])

  // `lines` : [{ coords, ref }]. Une rue déjà présente reçoit les nouveaux traits.
  // Poignées aux extrémités de chaque trait, à faire glisser.
  const tourRef = useRef(tour)
  tourRef.current = tour
  const updateRef = useRef(null)
  updateRef.current = update

  // Recherche automatique des maisons le long de chaque trait ajouté ou agrandi,
  // une recherche à la fois, ajoutée à la version la plus récente de la tournée.
  const [finding, setFinding] = useState(0)
  const queue = useRef(Promise.resolve())
  const autoFind = (pieceId, coords) => {
    setFinding((n) => n + 1)
    queue.current = queue.current.then(async () => {
      try {
        const { found, pieceNames } = await searchHouses([{ id: pieceId, line: coords }])
        const latest = tourRef.current
        const res = addFoundHouses(latest, found, pieceNames)
        if (res.addedCount || res.pieces.some((p, i) => p.name !== latest.pieces[i]?.name)) await saveTour(latest.id, { pieces: res.pieces, houses: res.houses })
        if (res.addedCount) toast(`🏠 ${res.addedCount} maison${res.addedCount > 1 ? 's' : ''} ajoutée${res.addedCount > 1 ? 's' : ''}`)
      } catch (err) {
        toast(`Recherche des maisons impossible : ${err.message}. Vérifie le réseau.`)
      } finally {
        setFinding((n) => n - 1)
      }
    })
  }
  const autoFindRef = useRef(autoFind)
  autoFindRef.current = autoFind
  const dragged = useRef(0)
  useEffect(() => {
    if (!map) return
    ensureEditorLayers(map)
    setGeoJSON(map, 'handles', mode === 'draw' ? EMPTY : handlesGeoJSON(tour))
  }, [map, tour, mode])

  useEffect(() => {
    if (!map) return undefined
    let drag = null
    const result = (lngLat) => {
      const t = tourRef.current
      const piece = t.pieces.find((p) => p.id === drag.pieceId)
      const line = piece?.lines[drag.line]
      return line ? moveLineEnd(line, drag.end, [lngLat.lng, lngLat.lat], touchTolerance(map, lngLat.lat)) : null
    }
    const start = (e) => {
      const f = e.features?.[0]
      if (!f) return
      e.preventDefault()
      drag = { ...f.properties, moved: false }
      map.dragPan.disable()
      map.getCanvas().style.cursor = 'grabbing'
    }
    const move = (e) => {
      if (!drag) return
      drag.moved = true
      drag.last = e.lngLat
      const next = result(e.lngLat)
      setGeoJSON(map, 'adjust', lineFeatures(next ? [unflatten(next.c)] : []))
    }
    const end = () => {
      if (!drag) return
      const d = drag
      drag = null
      map.dragPan.enable()
      map.getCanvas().style.cursor = ''
      setGeoJSON(map, 'adjust', EMPTY)
      if (!d.moved || !d.last) return
      dragged.current = Date.now()
      drag = d
      const next = result(d.last)
      drag = null
      if (!next) return
      const t = tourRef.current
      const pieces = t.pieces.map((p) => (p.id === d.pieceId ? { ...p, lines: p.lines.map((l, i) => (i === d.line ? next : l)) } : p))
      updateRef.current({ pieces, houses: keepNearHouses(t.houses, pieces) })
      autoFindRef.current(d.pieceId, unflatten(next.c))
    }
    map.on('mousedown', 'handles', start)
    map.on('touchstart', 'handles', start)
    map.on('mousemove', move)
    map.on('touchmove', move)
    map.on('mouseup', end)
    map.on('touchend', end)
    map.on('touchcancel', end)
    return () => {
      map.off('mousedown', 'handles', start)
      map.off('touchstart', 'handles', start)
      map.off('mousemove', move)
      map.off('touchmove', move)
      map.off('mouseup', end)
      map.off('touchend', end)
      map.off('touchcancel', end)
    }
  }, [map])

  const addLines = (name, lines) => {
    const label = name ?? `Rue tracée ${tour.pieces.length + 1}`
    const made = lines.map((l) => makeLine(l.coords, l.ref))
    const existing = tour.pieces.find((p) => p.name === label)
    const pieceId = existing?.id ?? newId().slice(0, 10)
    const pieces = existing
      ? tour.pieces.map((p) => (p === existing ? { ...p, lines: [...p.lines, ...made] } : p))
      : [...tour.pieces, { id: pieceId, name: label, lines: made }]
    tourRef.current = { ...tour, pieces }
    update({ pieces })
    lines.forEach((l) => autoFind(pieceId, l.coords))
    toast(`${label} ajoutée. Fais glisser les ronds blancs pour l’ajuster.`)
  }

  const onMapClick = (e, m) => {
    if (Date.now() - dragged.current < 400) return
    if (mode === 'street') {
      const street = pickStreet(m, e.lngLat)
      if (!street) {
        setPreview(null)
        return toast('Pas de rue ici. Zoome davantage ou utilise « Tracer ».')
      }
      setPreview({ ...street, only: false })
    } else if (mode === 'draw') {
      setDraft((d) => [...d, [e.lngLat.lng, e.lngLat.lat]])
    } else if (mode === 'house') {
      if (!tour.pieces.length) return toast('Ajoute d’abord une rue.')
      const label = window.prompt('Adresse de la maison (ex. 12 rue de la Gare) :')
      if (!label?.trim()) return
      const loc = locateOnPieces(e.lngLat.lng, e.lngLat.lat, tour.pieces)
      const house = { id: newId().slice(0, 12), label: label.trim(), number: label.trim().split(' ')[0], lng: e.lngLat.lng, lat: e.lngLat.lat, pieceId: loc.pieceId, along: loc.along }
      update({ houses: [...tour.houses, house] })
    } else if (mode === 'erase') {
      const click = [e.lngLat.lng, e.lngLat.lat]
      const tol = touchTolerance(m, e.lngLat.lat)
      let best = null
      tour.pieces.forEach((p) => p.lines.forEach((l, index) => {
        const d = projectOnLine(click, unflatten(l.c)).dist
        if (d <= tol && (!best || d < best.d)) best = { p, index, d }
      }))
      if (!best) return toast('Touche un trait de rue de la tournée.')
      const { p, index } = best
      if (!window.confirm(`Retirer ce trait de « ${p.name} » ?`)) return
      const lines = p.lines.filter((_, i) => i !== index)
      const pieces = lines.length ? tour.pieces.map((x) => (x === p ? { ...x, lines } : x)) : tour.pieces.filter((x) => x !== p)
      const houses = lines.length ? tour.houses : tour.houses.filter((h) => h.pieceId !== p.id)
      update({ pieces, houses })
    }
  }

  const onHouseClick = (props) => {
    if (mode !== 'erase') return
    const house = tour.houses.find((h) => h.id === props.houseId)
    if (house && window.confirm(`Retirer « ${house.label} » ?`)) update({ houses: tour.houses.filter((h) => h.id !== house.id) })
  }

  const confirmPreview = (only) => {
    const chains = chainLines(preview.lines)
    if (only) {
      // Le tronçon touché, avec la rue entière en réserve pour l'agrandir.
      const mid = preview.segment[Math.floor(preview.segment.length / 2)]
      const ref = chains.reduce((best, ch) => (projectOnLine(mid, ch).dist < projectOnLine(mid, best).dist ? ch : best), chains[0])
      const a = projectOnLine(preview.segment[0], ref).along
      const b = projectOnLine(preview.segment[preview.segment.length - 1], ref).along
      addLines(preview.name, [{ coords: sliceLine(ref, a, b), ref }])
    } else {
      addLines(preview.name, chains.map((ch) => ({ coords: ch, ref: ch })))
    }
    setPreview(null)
  }
  const finishDraft = () => {
    if (snappedDraft.length > 1) addLines(null, [{ coords: snappedDraft, ref: snappedDraft }])
    setDraft([])
  }

  const chooseMode = (key) => {
    setMode(key)
    setDraft([])
    setPreview(null)
  }
  const activeMode = MODES.find((m) => m.key === mode)

  return createPortal(
    <div className="editor">
      <TourMap
        tours={tours} statesById={statesById} flat
        fitPadding={{ top: 120, bottom: 190, left: 40, right: 60 }}
        onMapClick={onMapClick}
        onHouseClick={mode === 'erase' ? onHouseClick : undefined}
        onReady={setMap}
        className="editor-map"
      />

      <div className="editor-top">
        <button type="button" className="btn-primary btn-sm" onClick={onClose}>✓ Terminé</button>
        <strong className="spacer ellipsis">N°{tour.number} <span className="small muted">· {tour.pieces.length} rue{tour.pieces.length > 1 ? 's' : ''}</span></strong>
        <button type="button" className="btn-sm" disabled={!history.length} onClick={undo}>↶ Annuler</button>
        <span className={`editor-count${finding ? ' busy' : ''}`}>🏠 {finding ? '…' : tour.houses.length}</span>
      </div>

      <div className="editor-bottom">
        {preview ? (
          <div className="editor-confirm">
            <strong className="ellipsis">{preview.name ?? 'Rue sans nom'}</strong>
            <div className="row">
              <button type="button" className="btn-primary spacer" onClick={() => confirmPreview(false)}>Toute la rue</button>
              {preview.lines.length > 1 && <button type="button" className="spacer" onClick={() => confirmPreview(true)}>Ce tronçon</button>}
              <button type="button" className="btn-round btn-ghost" onClick={() => setPreview(null)} aria-label="Pas celle-ci">✕</button>
            </div>
          </div>
        ) : mode === 'draw' && draft.length ? (
          <div className="row">
            <button type="button" className="spacer" onClick={() => setDraft((d) => d.slice(0, -1))}>↶ Point</button>
            <button type="button" className="btn-primary spacer" disabled={snappedDraft.length < 2} onClick={finishDraft}>Valider le tracé</button>
          </div>
        ) : (
          <div className="small editor-help">{activeMode.help}</div>
        )}
        <div className="editor-modes">
          {MODES.map((m) => (
            <button key={m.key} type="button" className={mode === m.key ? 'on' : ''} onClick={() => chooseMode(m.key)}>
              <span>{m.icon}</span>{m.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
