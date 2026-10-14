import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import TourMap, { piecesGeoJSON, tourPoints } from '../../components/map/TourMap'
import { pickStreet, touchTolerance } from '../../components/map/streetPicker'
import { roadGraph, snapToRoads } from '../../components/map/snapToRoads'
import { fitPoints, setGeoJSON } from '../../components/map/useMapLibre'
import SectorTabs from '../../components/SectorTabs'
import AddHouseSheet from '../../components/AddHouseSheet'
import { useToast } from '../../components/ui/Toast'
import { useData } from '../../context/DataContext'
import { newId } from '../../lib/format'
import { chainLines, distance, flatten, lineLength, projectOnLine, samplePoints, sliceLine, unflatten } from '../../lib/geo'
import { tourAreas } from '../../lib/places'
import { addFoundHouses, locateOnPieces, searchHouses } from '../../lib/tourBuilder'
import { housesWithoutBuilding } from '../../components/map/houseBuildings'
import { withUnits } from '../../lib/logements'
import { saveTour } from '../../services/tours'

const MODES = [
  { key: 'street', icon: '➕', label: 'Ajouter une rue entière', desc: 'Toucher une rue de la carte', help: 'Touche une rue : elle s’allume en orange, puis choisis « Toute la rue » ou « Ce tronçon ». Pour allonger ou raccourcir, fais glisser un rond blanc, ou touche-le puis touche l’endroit voulu.' },
  { key: 'draw', icon: '✏️', label: 'Tracer un bout de rue', desc: 'Départ puis arrivée', help: 'Touche le point de départ, puis le point d’arrivée : le tracé suit la route tout seul.' },
  { key: 'house', icon: '🏠', label: 'Modifier les maisons', desc: 'Ajouter, retirer, prendre, placer', help: 'Touche une maison de la tournée pour la retirer ou la déplacer, une maison grisée d’une autre tournée pour la prendre, ou un endroit vide pour ajouter une maison non répertoriée.' },
  { key: 'eraser', icon: '🧽', label: 'Gomme', desc: 'Effacer un bout ou une rue' },
]
const ERASERS = [
  { key: 'brush', label: 'Effacer un bout', help: 'Appuie sur une rue et glisse le doigt (ou la souris) le long du bout à effacer.' },
  { key: 'delete', label: 'Supprimer une rue', help: 'Touche une rue pour la supprimer en entier, ou une maison pour la retirer.' },
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
// `route(a, b)` relie deux points par la route (recalage) quand on sort de la rue d'origine.
export function moveLineEnd(line, end, point, tolerance, route = (a, b) => [a, b]) {
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
  // En dehors de la rue d'origine : on prolonge en suivant la route jusqu'au point.
  const tip = end === 0 ? c[0] : c[c.length - 1]
  const path = route(tip, point).slice(1)
  if (!path.length) return null
  const next = end === 0 ? [...path.reverse(), ...c] : [...c, ...path]
  const atRefEnd = line.r && distance(tip, end === 0 ? ref[0] : ref[ref.length - 1]) < 2
  const nextRef = atRefEnd ? (end === 0 ? [...path, ...ref] : [...ref, ...path]) : next
  return makeLine(next, nextRef)
}

// Efface d'un trait tout ce qui passe sous la gomme (`brush`, rayon en mètres).
// Renvoie les morceaux restants (0, 1 ou plusieurs traits), ou null si la gomme n'y touche pas.
export function eraseFromLine(line, brush, radius) {
  const dense = samplePoints(unflatten(line.c), 2)
  const near = (p) => (brush.length > 1 ? projectOnLine(p, brush).dist : distance(p, brush[0])) <= radius
  if (!dense.some(near)) return null
  const runs = []
  let run = []
  for (const p of dense) {
    if (near(p)) {
      if (run.length) runs.push(run)
      run = []
    } else run.push(p)
  }
  if (run.length) runs.push(run)
  const ref = line.r ?? line.c
  return runs.filter((r) => r.length > 1 && lineLength(r) > 5).map((r) => ({ c: flatten(r), r: ref }))
}

function handlesGeoJSON(tour, picked) {
  return {
    type: 'FeatureCollection',
    features: tour.pieces.flatMap((p) => p.lines.flatMap((l, i) => {
      const c = unflatten(l.c)
      if (c.length < 2) return []
      return [0, 1].map((end) => ({
        type: 'Feature',
        properties: { pieceId: p.id, line: i, end, picked: picked && picked.pieceId === p.id && picked.line === i && picked.end === end ? 1 : 0 },
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
  setGeoJSON(map, 'eraser', EMPTY)
  const below = map.getLayer('pieces-casing') ? 'pieces-casing' : undefined
  map.addLayer({ id: 'others', type: 'line', source: 'others', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.22, 'line-dasharray': [1.5, 1.5] } }, below)
  map.addLayer({ id: 'preview-casing', type: 'line', source: 'preview', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 14 } })
  map.addLayer({ id: 'preview', type: 'line', source: 'preview', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f97316', 'line-width': 8 } })
  map.addLayer({ id: 'adjust', type: 'line', source: 'adjust', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#f97316', 'line-width': 8, 'line-opacity': 0.9 } })
  map.addLayer({ id: 'eraser', type: 'line', source: 'eraser', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#c0492f', 'line-width': 40, 'line-opacity': 0.3 } })
  map.addLayer({ id: 'handles', type: 'circle', source: 'handles', minzoom: 14.5, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 8, 17, 13], 'circle-color': ['case', ['==', ['get', 'picked'], 1], '#f97316', '#ffffff'], 'circle-stroke-color': '#1f2a24', 'circle-stroke-width': 3 } })
  map.addLayer({ id: 'draft-points', type: 'circle', source: 'draft', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 7, 'circle-color': '#0f172a', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } })
}

// Éditeur plein écran des rues d'une tournée : ajout d'une rue au toucher avec aperçu,
// tracé qui suit la route, maisons, gomme, et retour arrière.
export default function TourMapEditor({ tour, onClose, initialHouseId = null }) {
  const toast = useToast()
  const { tours: allTours, statesById } = useData()
  const [mode, setMode] = useState(initialHouseId ? 'house' : 'street')
  const [newPoint, setNewPoint] = useState(null)
  const [eraser, setEraser] = useState('brush')
  const [preview, setPreview] = useState(null)
  const [drawStart, setDrawStart] = useState(null)
  const [picked, setPicked] = useState(null)
  const [history, setHistory] = useState([])
  const [map, setMap] = useState(null)
  // Les pastilles des maisons restent cachées sauf demande, ou quand on travaille sur les maisons.
  const [housesOn, setHousesOn] = useState(false)
  const [areaSel, setAreaSel] = useState(null)
  const areas = useMemo(() => tourAreas(tour), [tour])
  const mapAreas = useMemo(() => (areas.length > 1 ? areas.map((a) => ({ ...a, active: a.id === areaSel })) : null), [areas, areaSel])
  const others = useMemo(() => allTours.filter((t) => t.id !== tour.id), [allTours, tour.id])
  // En mode maisons, les maisons des autres tournées apparaissent grisées pour pouvoir les prendre.
  const tours = useMemo(() => (mode === 'house' ? [tour, ...others] : [tour]), [mode, tour, others])
  const [houseSel, setHouseSel] = useState(() => tour.houses.find((h) => h.id === initialHouseId) ?? null)
  const [moving, setMoving] = useState(null)
  const [giveTo, setGiveTo] = useState('')
  const [missing, setMissing] = useState(null)

  const tourRef = useRef(tour)
  tourRef.current = tour

  // Chaque modification garde l'état précédent pour « Annuler ».
  const update = (data) => {
    const t = tourRef.current
    setHistory((h) => [...h.slice(-19), { pieces: t.pieces, houses: t.houses }])
    tourRef.current = { ...t, ...data }
    return saveTour(t.id, data).catch((err) => toast(`Erreur : ${err.message}`))
  }
  const undo = () => {
    const last = history.at(-1)
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    saveTour(tour.id, last).catch((err) => toast(`Erreur : ${err.message}`))
    toast('Dernière modification annulée')
  }
  const updateRef = useRef(update)
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

  // Remplace un trait par sa nouvelle version (ou le supprime), et range les maisons.
  const replaceLine = (pieceId, index, nextLines) => {
    const t = tourRef.current
    const pieces = t.pieces
      .map((p) => (p.id === pieceId ? { ...p, lines: p.lines.flatMap((l, i) => (i === index ? nextLines : [l])) } : p))
      .filter((p) => p.lines.length)
    updateRef.current({ pieces, houses: keepNearHouses(t.houses, pieces) })
  }

  // Graphe des routes autour d'un point, gardé tant qu'on reste dans la zone.
  const graphRef = useRef(null)
  const routeFrom = (m, a, b) => {
    const g = graphRef.current
    const inside = (p) => g && p[0] > g.w && p[0] < g.e && p[1] > g.s && p[1] < g.n
    if (!inside(a) || !inside(b)) {
      const pts = [a, b]
      const margin = 0.012
      graphRef.current = {
        graph: roadGraph(m, pts, margin),
        w: Math.min(a[0], b[0]) - margin, e: Math.max(a[0], b[0]) + margin,
        s: Math.min(a[1], b[1]) - margin * 0.66, n: Math.max(a[1], b[1]) + margin * 0.66,
      }
    }
    return snapToRoads(m, [a, b], graphRef.current.graph)
  }
  const routeRef = useRef(routeFrom)
  routeRef.current = routeFrom

  useEffect(() => {
    if (!map) return
    ensureEditorLayers(map)
    setGeoJSON(map, 'others', piecesGeoJSON(others))
  }, [map, others])

  useEffect(() => {
    if (!map) return
    ensureEditorLayers(map)
    setGeoJSON(map, 'preview', lineFeatures(preview ? preview.lines : []))
  }, [map, preview])

  const showHandles = mode === 'street' || (mode === 'eraser' && eraser === 'delete')
  useEffect(() => {
    if (!map) return
    ensureEditorLayers(map)
    setGeoJSON(map, 'handles', showHandles ? handlesGeoJSON(tour, picked) : EMPTY)
  }, [map, tour, showHandles, picked])

  // Point de départ du tracé.
  useEffect(() => {
    if (!map) return
    ensureEditorLayers(map)
    setGeoJSON(map, 'draft', {
      type: 'FeatureCollection',
      features: drawStart ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: drawStart } }] : [],
    })
    if (!drawStart) setGeoJSON(map, 'adjust', EMPTY)
  }, [map, drawStart])

  // Pendant le tracé, le trait suit la route jusqu'au pointeur (souris).
  const drawRef = useRef(drawStart)
  drawRef.current = drawStart
  useEffect(() => {
    if (!map) return undefined
    let frame = 0
    const onMove = (e) => {
      if (!drawRef.current) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!drawRef.current) return
        const path = routeRef.current(map, drawRef.current, [e.lngLat.lng, e.lngLat.lat])
        setGeoJSON(map, 'adjust', lineFeatures([path]))
      })
    }
    map.on('mousemove', onMove)
    return () => {
      cancelAnimationFrame(frame)
      map.off('mousemove', onMove)
    }
  }, [map])

  // Poignées (glisser) et gomme (appuyer et glisser).
  const modeRef = useRef({ mode, eraser })
  modeRef.current = { mode, eraser }
  const dragged = useRef(0)
  useEffect(() => {
    if (!map) return undefined
    let drag = null
    let brush = null
    const result = (lngLat) => {
      const t = tourRef.current
      const line = t.pieces.find((p) => p.id === drag.pieceId)?.lines[drag.line]
      const point = [lngLat.lng, lngLat.lat]
      return line ? moveLineEnd(line, drag.end, point, touchTolerance(map, lngLat.lat), (a, b) => routeRef.current(map, a, b)) : null
    }
    const startHandle = (e) => {
      const f = e.features?.[0]
      if (!f) return
      e.preventDefault()
      drag = { ...f.properties, moved: false }
      map.getCanvas().style.cursor = 'grabbing'
    }
    const startBrush = (e) => {
      const { mode: m, eraser: er } = modeRef.current
      if (m !== 'eraser' || er !== 'brush') return
      e.preventDefault()
      brush = [[e.lngLat.lng, e.lngLat.lat]]
      setGeoJSON(map, 'eraser', lineFeatures([[brush[0], brush[0]]]))
    }
    const move = (e) => {
      const point = [e.lngLat.lng, e.lngLat.lat]
      if (brush) {
        brush.push(point)
        setGeoJSON(map, 'eraser', lineFeatures([brush]))
        return
      }
      if (!drag) return
      drag.moved = true
      drag.last = e.lngLat
      const next = result(e.lngLat)
      setGeoJSON(map, 'adjust', lineFeatures(next ? [unflatten(next.c)] : []))
    }
    const end = () => {
      if (brush) {
        const b = brush
        brush = null
        setGeoJSON(map, 'eraser', EMPTY)
        dragged.current = Date.now()
        // Rayon de la gomme : moitié de son épaisseur à l'écran (40 px).
        const radius = touchTolerance(map, b[0][1]) * (20 / 22)
        const t = tourRef.current
        let changed = false
        const pieces = t.pieces.map((p) => ({
          ...p,
          lines: p.lines.flatMap((l) => {
            const kept = eraseFromLine(l, b, radius)
            if (!kept) return [l]
            changed = true
            return kept
          }),
        })).filter((p) => p.lines.length)
        if (changed) updateRef.current({ pieces, houses: keepNearHouses(t.houses, pieces) })
        return
      }
      if (!drag) return
      const d = drag
      map.getCanvas().style.cursor = ''
      setGeoJSON(map, 'adjust', EMPTY)
      if (!d.moved || !d.last) {
        drag = null
        return
      }
      dragged.current = Date.now()
      const next = result(d.last)
      drag = null
      if (!next) return
      replaceLine(d.pieceId, d.line, [next])
      autoFindRef.current(d.pieceId, unflatten(next.c))
    }
    map.on('mousedown', 'handles', startHandle)
    map.on('touchstart', 'handles', startHandle)
    map.on('mousedown', startBrush)
    map.on('touchstart', startBrush)
    map.on('mousemove', move)
    map.on('touchmove', move)
    map.on('mouseup', end)
    map.on('touchend', end)
    map.on('touchcancel', end)
    return () => {
      map.off('mousedown', 'handles', startHandle)
      map.off('touchstart', 'handles', startHandle)
      map.off('mousedown', startBrush)
      map.off('touchstart', startBrush)
      map.off('mousemove', move)
      map.off('touchmove', move)
      map.off('mouseup', end)
      map.off('touchend', end)
      map.off('touchcancel', end)
    }
  }, [map])

  // `lines` : [{ coords, ref }]. Une rue déjà présente reçoit les nouveaux traits.
  const addLines = (name, lines) => {
    const t = tourRef.current
    const label = name ?? `Rue tracée ${t.pieces.length + 1}`
    const made = lines.map((l) => makeLine(l.coords, l.ref))
    const existing = t.pieces.find((p) => p.name === label)
    const pieceId = existing?.id ?? newId().slice(0, 10)
    const pieces = existing
      ? t.pieces.map((p) => (p === existing ? { ...p, lines: [...p.lines, ...made] } : p))
      : [...t.pieces, { id: pieceId, name: label, lines: made }]
    update({ pieces })
    lines.forEach((l) => autoFind(pieceId, l.coords))
    toast(`${label} ajoutée`)
  }

  // Ligne de la tournée la plus proche du toucher.
  const nearestLine = (m, lngLat) => {
    const click = [lngLat.lng, lngLat.lat]
    const tol = touchTolerance(m, lngLat.lat)
    let best = null
    tour.pieces.forEach((p) => p.lines.forEach((l, index) => {
      const d = projectOnLine(click, unflatten(l.c)).dist
      if (d <= tol && (!best || d < best.d)) best = { p, index, d }
    }))
    return best
  }

  const onMapClick = (e, m) => {
    if (Date.now() - dragged.current < 400) return
    const point = [e.lngLat.lng, e.lngLat.lat]

    // Poignée touchée : on la choisit, puis le prochain toucher la déplace.
    if (showHandles) {
      const box = [[e.point.x - 20, e.point.y - 20], [e.point.x + 20, e.point.y + 20]]
      const h = m.queryRenderedFeatures(box, { layers: ['handles'] })[0]
      if (h) {
        const { pieceId, line, end } = h.properties
        const same = picked && picked.pieceId === pieceId && picked.line === line && picked.end === end
        setPicked(same ? null : { pieceId, line, end })
        if (!same) toast('Touche maintenant l’endroit où la rue doit s’arrêter')
        return
      }
      if (picked) {
        const line = tour.pieces.find((p) => p.id === picked.pieceId)?.lines[picked.line]
        const next = line && moveLineEnd(line, picked.end, point, touchTolerance(m, e.lngLat.lat), (a, b) => routeFrom(m, a, b))
        setPicked(null)
        if (next) {
          replaceLine(picked.pieceId, picked.line, [next])
          autoFind(picked.pieceId, unflatten(next.c))
        }
        return
      }
    }

    if (mode === 'street') {
      const street = pickStreet(m, e.lngLat)
      if (!street) {
        setPreview(null)
        return toast('Pas de rue ici. Zoome davantage ou utilise « Tracer ».')
      }
      setPreview(street)
    } else if (mode === 'draw') {
      if (!drawStart) {
        graphRef.current = null
        setDrawStart(point)
        return
      }
      const path = routeFrom(m, drawStart, point)
      setDrawStart(null)
      if (path.length > 1 && lineLength(path) > 5) addLines(null, [{ coords: path, ref: path }])
    } else if (mode === 'house') {
      if (moving) {
        const loc = locateOnPieces(point[0], point[1], tour.pieces)
        update({ houses: tour.houses.map((h) => (h.id === moving ? { ...h, lng: point[0], lat: point[1], pieceId: loc?.pieceId ?? h.pieceId, along: loc?.along ?? h.along } : h)) })
        setMoving(null)
        return toast('Maison déplacée')
      }
      if (houseSel) return setHouseSel(null)
      if (!tour.pieces.length) return toast('Ajoute d’abord une rue.')
      setNewPoint(e.lngLat)
    } else if (mode === 'eraser' && eraser === 'delete') {
      const best = nearestLine(m, e.lngLat)
      if (!best) return toast('Touche une rue de la tournée.')
      if (!window.confirm(`Supprimer toute la rue « ${best.p.name} » et ses maisons ?`)) return
      update({ pieces: tour.pieces.filter((x) => x !== best.p), houses: tour.houses.filter((h) => h.pieceId !== best.p.id) })
    }
  }

  // Mode maisons : une maison de la tournée s'ouvre, une maison d'une autre tournée se prend.
  const onHouseEdit = (props) => {
    if (props.tourId === tour.id) {
      const house = tour.houses.find((h) => h.id === props.houseId)
      setHouseSel(house ?? null)
      setGiveTo('')
      return
    }
    const other = others.find((t) => t.id === props.tourId)
    const house = other?.houses.find((h) => h.id === props.houseId)
    if (!house) return
    if (!window.confirm(`Prendre « ${house.label} » dans cette tournée ? Elle sera retirée de la tournée n°${other.number} (${other.name}).`)) return
    const loc = locateOnPieces(house.lng, house.lat, tour.pieces)
    saveTour(other.id, { houses: other.houses.filter((h) => h.id !== house.id) }).catch((err) => toast(`Erreur : ${err.message}`))
    update({ houses: [...tour.houses, { ...house, pieceId: loc?.pieceId ?? null, along: loc?.along ?? 0 }] })
    toast(`« ${house.label} » ajoutée à la tournée`)
  }

  const setUnitsSel = (delta) => {
    const next = withUnits(houseSel, Math.max(1, houseSel.units?.length || 1) + delta)
    update({ houses: tourRef.current.houses.map((h) => (h.id === next.id ? next : h)) })
    setHouseSel(next)
  }

  const removeHouse = () => {
    const house = houseSel
    const target = others.find((t) => t.id === giveTo)
    if (target) {
      const loc = locateOnPieces(house.lng, house.lat, target.pieces ?? [])
      saveTour(target.id, { houses: [...target.houses, { ...house, pieceId: loc?.pieceId ?? null, along: loc?.along ?? 0 }] }).catch((err) => toast(`Erreur : ${err.message}`))
    }
    update({ houses: tour.houses.filter((h) => h.id !== house.id) })
    setHouseSel(null)
    toast(target ? `« ${house.label} » donnée à la tournée n°${target.number}` : `« ${house.label} » retirée`)
  }

  // Maisons sans bâtiment sur le plan, dans la zone affichée.
  useEffect(() => {
    if (!map || mode !== 'house') return undefined
    const run = () => setMissing(housesWithoutBuilding(map, tourRef.current.houses))
    run()
    map.on('idle', run)
    return () => map.off('idle', run)
  }, [map, mode, tour])
  const showMissing = () => {
    const h = missing?.[0]
    if (!h) return
    map.easeTo({ center: [h.lng, h.lat], zoom: Math.max(map.getZoom(), 18.5) })
    setHouseSel(h)
  }

  const onHouseClick = (props) => {
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

  const chooseMode = (key) => {
    setMode(key)
    setDrawStart(null)
    setPreview(null)
    setPicked(null)
    setHouseSel(null)
    setMoving(null)
  }
  const activeMode = MODES.find((m) => m.key === mode)
  const showHouses = housesOn || mode === 'house' || (mode === 'eraser' && eraser === 'delete')
  const EDIT_PAD = { top: 170, bottom: 230, left: 40, right: 60 }
  const chooseArea = (a) => {
    setAreaSel(a?.id ?? null)
    const pts = a ? tour.pieces.filter((p) => a.pieceIds.includes(p.id)).flatMap((p) => tourPoints([{ pieces: [p] }])) : tourPoints(tours)
    fitPoints(map, pts, { padding: EDIT_PAD, maxZoom: 18.5 })
  }
  const help = mode === 'eraser' ? ERASERS.find((x) => x.key === eraser).help
    : picked ? 'Touche l’endroit où la rue doit s’arrêter (sur la rue pour raccourcir, plus loin pour l’allonger).'
      : mode === 'draw' && drawStart ? 'Touche maintenant le point d’arrivée.'
        : activeMode.help

  return createPortal(
    <div className="editor">
      <TourMap
        tours={tours} statesById={statesById} flat focusTourId={mode === 'house' ? tour.id : null} autoFit={false}
        showHouses={showHouses} streetLabels areas={mapAreas}
        fitPadding={{ top: 170, bottom: 230, left: 40, right: 60 }}
        onMapClick={onMapClick}
        onHouseClick={mode === 'eraser' && eraser === 'delete' ? onHouseClick : moving ? undefined : (p) => { if (mode !== 'house') { setMode('house'); setPreview(null); setDrawStart(null) } onHouseEdit(p) }}
        onReady={setMap}
        className="editor-map"
      />

      <div className="editor-head">
        <div className="editor-top">
          <button type="button" className="btn-done" onClick={onClose}>✓ Terminer</button>
          <strong className="spacer ellipsis">N°{tour.number} {tour.name} <span className="small muted">· {tour.pieces.length} rue{tour.pieces.length > 1 ? 's' : ''}</span></strong>
          <button type="button" className="btn-sm" disabled={!history.length} onClick={undo}>↶ Annuler</button>
          <label className={`layer-btn editor-houses${showHouses ? ' on' : ''}${finding ? ' busy' : ''}`} title="Afficher les maisons sur la carte">
            <input type="checkbox" checked={showHouses} disabled={showHouses && !housesOn} onChange={(e) => setHousesOn(e.target.checked)} />
            🏠 Afficher les maisons ({finding ? '…' : tour.houses.length})
          </label>
        </div>
        <SectorTabs areas={areas} active={areaSel} onChoose={chooseArea} />
      </div>

      <div className="editor-bottom">
        {mode === 'house' && houseSel ? (
          <div className="editor-confirm house-edit">
            <strong className="ellipsis">🏠 {houseSel.label}{houseSel.units?.length ? ` · ${houseSel.units.length} logements` : ''}</strong>
            {moving ? (
              <div className="row"><span className="small spacer">Touche l’endroit exact de la maison sur le plan.</span><button type="button" className="btn-sm" onClick={() => setMoving(null)}>Annuler</button></div>
            ) : (
              <>
                <div className="row units-step">
                  <span className="spacer">🏢 Logements</span>
                  <button type="button" className="btn-sm" onClick={() => setUnitsSel(-1)} aria-label="Un logement de moins">−</button>
                  <strong>{Math.max(1, houseSel.units?.length ?? 1)}</strong>
                  <button type="button" className="btn-sm" onClick={() => setUnitsSel(1)} aria-label="Un logement de plus">+</button>
                </div>
                <div className="row">
                  <button type="button" className="spacer" onClick={() => setMoving(houseSel.id)}>📍 Déplacer / placer sur le plan</button>
                  <button type="button" className="btn-round btn-ghost" onClick={() => setHouseSel(null)} aria-label="Fermer">✕</button>
                </div>
                <div className="row">
                  <select className="spacer" value={giveTo} onChange={(e) => setGiveTo(e.target.value)} aria-label="Donner à">
                    <option value="">Retirer sans la donner</option>
                    {[...others].sort((a, b) => a.number - b.number).map((t) => <option key={t.id} value={t.id}>Donner à la tournée n°{t.number} · {t.name}</option>)}
                  </select>
                  <button type="button" className="btn-danger" onClick={removeHouse}>Retirer</button>
                </div>
              </>
            )}
          </div>
        ) : preview ? (
          <div className="editor-confirm">
            <strong className="ellipsis">{preview.name ?? 'Rue sans nom'}</strong>
            <div className="row">
              <button type="button" className="btn-primary spacer" onClick={() => confirmPreview(false)}>Toute la rue</button>
              {preview.lines.length > 1 && <button type="button" className="spacer" onClick={() => confirmPreview(true)}>Ce tronçon</button>}
              <button type="button" className="btn-round btn-ghost" onClick={() => setPreview(null)} aria-label="Pas celle-ci">✕</button>
            </div>
          </div>
        ) : (
          <div className="row">
            {mode === 'house' && !picked ? (
              <ul className="small editor-help spacer house-help">
                <li><b>Retirer ou déplacer</b> une maison : touche-la (couleur vive).</li>
                <li><b>Prendre</b> la maison d’une autre tournée : touche-la (couleur pâle), elle quittera l’autre tournée.</li>
                <li><b>Ajouter</b> une maison non répertoriée : touche un endroit vide.</li>
              </ul>
            ) : <div className="small editor-help spacer">{help}</div>}
            {mode === 'draw' && drawStart && <button type="button" className="btn-sm" onClick={() => setDrawStart(null)}>✕</button>}
          </div>
        )}
        {mode === 'house' && !houseSel && missing?.length > 0 && (
          <button type="button" className="missing-alert" onClick={showMissing}>⚠️ {missing.length} maison{missing.length > 1 ? 's' : ''} sans bâtiment sur le plan ici : touche pour la placer</button>
        )}
        {mode === 'eraser' && (
          <div className="segmented">
            {ERASERS.map((x) => (
              <button key={x.key} type="button" className={eraser === x.key ? 'on' : ''} onClick={() => setEraser(x.key)}>{x.label}</button>
            ))}
          </div>
        )}
        <div className="editor-modes">
          {MODES.map((m) => (
            <button key={m.key} type="button" className={mode === m.key ? 'on' : ''} onClick={() => chooseMode(m.key)}>
              <span className="mode-icon" aria-hidden="true">{m.icon}</span>
              <span className="mode-text"><strong>{m.label}</strong><small>{m.desc}</small></span>
            </button>
          ))}
        </div>
      </div>
      {newPoint && <AddHouseSheet tour={tour} point={newPoint} onAdd={(house) => update({ houses: [...tourRef.current.houses, house] })} onClose={() => setNewPoint(null)} />}
    </div>,
    document.body,
  )
}
