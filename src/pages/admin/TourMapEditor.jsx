import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import Confetti from '../../components/ui/Confetti'
import TourMap, { showNeighbourTours, tourPoints } from '../../components/map/TourMap'
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
import { onIgnLoaded } from '../../lib/ignBuildings'
import { withUnits } from '../../lib/logements'
import { saveTour, withoutHouse } from '../../services/tours'

// Une colonne d'outils à gauche de la carte : les rues, puis les maisons en dessous. Retoucher l'outil choisi le désélectionne : la main revient, pour se déplacer.
const svg = (d) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
const ICONS = {
  hand: svg(<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7s-5-1.5-6.5-4L3 12.5a1.5 1.5 0 0 1 2.5-1.5L8 14" />),
  street: svg(<><path d="M5 21 9 3M19 21 15 3M12 7v2M12 13v2" /><path d="M19 3v6M16 6h6" /></>),
  draw: svg(<><path d="M4 20c4-1 5-6 9-8s6-1 7-6" /><circle cx="4" cy="20" r="1.5" /><circle cx="20" cy="6" r="1.5" /></>),
  eraser: svg(<><path d="m7 21-4-4 10-10 7 7-7 7H7Z" /><path d="M14 21h7M9 11l7 7" /></>),
  transfer: svg(<><path d="M4 17h11M4 17l3-3M4 17l3 3" /><path d="M20 7H9M20 7l-3-3M20 7l-3 3" /></>),
  add: svg(<><path d="M3 11 11 4l8 7M5 10v10h12V10" /><path d="M20 15v6M17 18h6" /></>),
  move: svg(<><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Z" /><circle cx="12" cy="10" r="2.5" /></>),
}
const TABS = [
  { key: 'trace', label: 'Rues' },
  { key: 'houses', label: 'Maisons' },
]
const MODES = {
  trace: [
    { key: 'street', label: 'Ajouter une rue', help: 'Touche une rue : elle s’allume en orange, puis choisis « Toute la rue » ou « Ce tronçon ». Pour allonger ou raccourcir, fais glisser un rond blanc, ou touche-le puis touche l’endroit voulu.' },
    { key: 'draw', label: 'Tracer un bout', help: 'Touche le point de départ, puis le point d’arrivée : le tracé suit la route tout seul.' },
    { key: 'eraser', label: 'Gomme' },
    { key: 'transfer', label: 'Déplacer un tronçon' },
  ],
  houses: [
    { key: 'add', label: 'Ajouter', help: 'Touche l’endroit de la maison non répertoriée.' },
    { key: 'move', label: 'Déplacer', help: 'Touche la maison à déplacer, puis son endroit exact sur le plan.' },
  ],
}
const HAND_HELP = {
  trace: 'Outils des rues et des maisons à gauche. Sans outil, la carte se déplace librement et toucher une maison ouvre son menu.',
  houses: 'Touche une maison pour la supprimer ou l’attribuer à une autre tournée. Une maison pâle appartient à une autre tournée : touche-la pour la prendre.',
}
const ERASERS = [
  { key: 'brush', label: 'Effacer un bout', help: 'Appuie sur une rue et glisse le doigt (ou la souris) le long du bout à effacer.' },
  { key: 'delete', label: 'Supprimer une rue', help: 'Touche une rue pour la supprimer en entier, ou une maison pour la retirer.' },
]
// Déplacer un tronçon vers une autre tournée : on le choisit comme avec la gomme.
const TRANSFERS = [
  { key: 'brush', label: 'Choisir un bout', help: 'Appuie sur une rue et glisse le doigt (ou la souris) le long du bout à déplacer. Il s’allume en orange, puis choisis la tournée.' },
  { key: 'street', label: 'Toute une rue', help: 'Touche une rue pour la déplacer en entier, puis choisis la tournée.' },
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

// Coupe un trait sous la gomme : `taken` ce qui passe dessous, `kept` le reste.
// Renvoie null si la gomme n'y touche pas.
export function splitByBrush(line, brush, radius) {
  const dense = samplePoints(unflatten(line.c), 2)
  const near = (p) => (brush.length > 1 ? projectOnLine(p, brush).dist : distance(p, brush[0])) <= radius
  if (!dense.some(near)) return null
  const runs = []
  let run = null
  for (const p of dense) {
    const inside = near(p)
    if (run && run.inside !== inside) {
      // Le point de bascule est partagé : les deux parties se touchent.
      runs.push(run)
      run = { inside, pts: [run.pts.at(-1), p] }
    } else if (run) run.pts.push(p)
    else run = { inside, pts: [p] }
  }
  runs.push(run)
  const ref = line.r ?? line.c
  const keep = (inside) => runs.filter((r) => r.inside === inside && r.pts.length > 1 && lineLength(r.pts) > 5).map((r) => ({ c: flatten(r.pts), r: ref }))
  return { kept: keep(false), taken: keep(true) }
}

// Les maisons d'une rue suivent le tronçon déplacé quand il est plus près d'elles que ce qui reste de la rue.
function housesTaken(houses, moved) {
  return houses.filter((h) => {
    const m = moved.find((x) => x.pieceId === h.pieceId)
    if (!m) return false
    const d = (lines) => Math.min(Infinity, ...lines.map((l) => projectOnLine([h.lng, h.lat], unflatten(l.c)).dist))
    return d(m.taken) <= d(m.kept)
  })
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
  if (map.getLayer('preview')) return
  setGeoJSON(map, 'preview', EMPTY)
  setGeoJSON(map, 'draft', EMPTY)
  setGeoJSON(map, 'handles', EMPTY)
  setGeoJSON(map, 'adjust', EMPTY)
  setGeoJSON(map, 'eraser', EMPTY)
  setGeoJSON(map, 'guide', EMPTY)
  setGeoJSON(map, 'transfer', EMPTY)
  map.addLayer({ id: 'preview-casing', type: 'line', source: 'preview', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 14 } })
  map.addLayer({ id: 'preview', type: 'line', source: 'preview', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f97316', 'line-width': 8 } })
  map.addLayer({ id: 'adjust', type: 'line', source: 'adjust', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#f97316', 'line-width': 8, 'line-opacity': 0.9 } })
  map.addLayer({ id: 'transfer-casing', type: 'line', source: 'transfer', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 14 } })
  map.addLayer({ id: 'transfer', type: 'line', source: 'transfer', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f97316', 'line-width': 8 } })
  map.addLayer({ id: 'eraser', type: 'line', source: 'eraser', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#c0492f', 'line-width': 40, 'line-opacity': 0.3 } })
  map.addLayer({ id: 'handles', type: 'circle', source: 'handles', minzoom: 14.5, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 8, 17, 13], 'circle-color': ['case', ['==', ['get', 'picked'], 1], '#f97316', '#ffffff'], 'circle-stroke-color': '#1f2a24', 'circle-stroke-width': 3 } })
  map.addLayer({ id: 'guide-link', type: 'line', source: 'guide', filter: ['==', ['get', 'kind'], 'link'], paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-dasharray': [1.5, 1.5] } })
  map.addLayer({ id: 'guide', type: 'circle', source: 'guide', filter: ['==', ['get', 'kind'], 'now'], paint: { 'circle-radius': 30, 'circle-color': 'rgba(192,73,47,0.18)', 'circle-stroke-color': '#e0412a', 'circle-stroke-width': 4 } })
  map.addLayer({ id: 'guide-new', type: 'circle', source: 'guide', filter: ['==', ['get', 'kind'], 'new'], paint: { 'circle-radius': 14, 'circle-color': '#22c55e', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 4 } })
  map.addLayer({ id: 'draft-points', type: 'circle', source: 'draft', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 7, 'circle-color': '#0f172a', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } })
}

// Éditeur plein écran des rues d'une tournée : ajout d'une rue au toucher avec aperçu,
// tracé qui suit la route, maisons, gomme, et retour arrière.
export default function TourMapEditor({ tour, onClose, initialHouseId = null, initialMove = false, initialGuideIds = null }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [party, setParty] = useState(0)
  const { tours: allTours, statesById } = useData()
  const [tab, setTab] = useState(initialHouseId ? 'houses' : 'trace')
  const [mode, setMode] = useState(null)
  const [newPoint, setNewPoint] = useState(null)
  const [eraser, setEraser] = useState('brush')
  const [transferBy, setTransferBy] = useState('brush')
  // Tronçon choisi pour changer de tournée : [{ pieceId, name, taken, kept }].
  const [transfer, setTransfer] = useState(null)
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
  // Dans l'onglet maisons, les maisons des autres tournées apparaissent pâles pour pouvoir les prendre.
  const tours = useMemo(() => (tab === 'houses' ? [tour, ...others] : [tour]), [tab, tour, others])
  // Maison touchée : `tourId` dit si elle est de cette tournée ou d'une autre.
  const [houseSel, setHouseSel] = useState(() => { const h = tour.houses.find((x) => x.id === initialHouseId); return h ? { ...h, tourId: tour.id } : null })
  const [moving, setMoving] = useState(null)
  const [askGive, setAskGive] = useState(false)
  const [missing, setMissing] = useState(null)
  // Placement guidé des maisons sans bâtiment : la maison en cours et combien sont déjà placées.
  const [guide, setGuide] = useState(null)
  const [missingOpen, setMissingOpen] = useState(false)

  const tourRef = useRef(tour)
  tourRef.current = tour

  // Chaque modification garde l'état précédent pour « Annuler ». `other` : l'autre tournée
  // touchée par la même modification (tronçon déplacé), remise en état elle aussi.
  const update = (data, other = null) => {
    const t = tourRef.current
    setHistory((h) => [...h.slice(-19), { pieces: t.pieces, houses: t.houses, ...(other ? { other: { id: other.id, pieces: other.pieces, houses: other.houses } } : {}) }])
    tourRef.current = { ...t, ...data }
    return saveTour(t.id, data).catch((err) => toast(`Erreur : ${err.message}`))
  }
  const undo = () => {
    const last = history.at(-1)
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    const { other, ...mine } = last
    saveTour(tour.id, mine).catch((err) => toast(`Erreur : ${err.message}`))
    if (other) saveTour(other.id, { pieces: other.pieces, houses: other.houses }).catch((err) => toast(`Erreur : ${err.message}`))
    toast('Dernière modification annulée')
  }
  const updateRef = useRef(update)
  updateRef.current = update
  const toastRef = useRef(toast)
  toastRef.current = toast

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
    showNeighbourTours(map, others)
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

  useEffect(() => {
    if (!map) return
    ensureEditorLayers(map)
    setGeoJSON(map, 'transfer', lineFeatures(transfer ? transfer.flatMap((m) => m.taken.map((l) => unflatten(l.c))) : []))
  }, [map, transfer])

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
  const modeRef = useRef({ mode, eraser, transferBy })
  modeRef.current = { mode, eraser, transferBy }
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
      const { mode: m, eraser: er, transferBy: tb } = modeRef.current
      if (!(m === 'eraser' && er === 'brush') && !(m === 'transfer' && tb === 'brush')) return
      e.preventDefault()
      brush = [[e.lngLat.lng, e.lngLat.lat]]
      brush.transfer = m === 'transfer'
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
  setGeoJSON(map, 'guide', EMPTY)
        dragged.current = Date.now()
        // Rayon de la gomme : moitié de son épaisseur à l'écran (40 px).
        const radius = touchTolerance(map, b[0][1]) * (20 / 22)
        const t = tourRef.current
        if (b.transfer) {
          const moved = t.pieces.flatMap((p) => {
            const parts = p.lines.map((l) => splitByBrush(l, b, radius) ?? { kept: [l], taken: [] })
            const taken = parts.flatMap((x) => x.taken)
            return taken.length ? [{ pieceId: p.id, name: p.name, taken, kept: parts.flatMap((x) => x.kept) }] : []
          })
          setTransfer(moved.length ? moved : null)
          if (!moved.length) toastRef.current('Glisse le long d’une rue de la tournée.')
          return
        }
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
    } else if (houseSel) {
      setHouseSel(null)
      setAskGive(false)
    } else if (guide && moving && !guide.finished) {
      // Placement guidé : l'endroit touché est proposé, il faut le valider.
      setGuide((g) => ({ ...g, pending: point }))
    } else if (mode === 'move' && moving) {
      const loc = locateOnPieces(point[0], point[1], tour.pieces)
      update({ houses: tour.houses.map((h) => (h.id === moving ? { ...h, lng: point[0], lat: point[1], pieceId: loc?.pieceId ?? h.pieceId, along: loc?.along ?? h.along } : h)) })
      setMoving(null)
      toast('✅ Maison déplacée')
    } else if (mode === 'add') {
      if (!tour.pieces.length) return toast('Ajoute d’abord une rue dans l’onglet « Tracé des rues ».')
      setNewPoint(e.lngLat)
    } else if (mode === 'transfer' && transferBy === 'street') {
      const best = nearestLine(m, e.lngLat)
      if (!best) return toast('Touche une rue de la tournée.')
      setTransfer([{ pieceId: best.p.id, name: best.p.name, taken: best.p.lines, kept: [] }])
    } else if (mode === 'eraser' && eraser === 'delete') {
      const best = nearestLine(m, e.lngLat)
      if (!best) return toast('Touche une rue de la tournée.')
      if (!window.confirm(`Supprimer toute la rue « ${best.p.name} » et ses maisons ?`)) return
      update({ pieces: tour.pieces.filter((x) => x !== best.p), houses: tour.houses.filter((h) => h.pieceId !== best.p.id) })
    }
  }

  // Maison touchée (onglet maisons) : déplacement si l'outil est choisi, sinon son menu.
  const onHouseEdit = (props) => {
    if (props.tourId === tour.id && mode === 'move') {
      setMoving(props.houseId)
      return toast('Touche maintenant l’endroit exact de la maison')
    }
    const owner = props.tourId === tour.id ? tour : others.find((t) => t.id === props.tourId)
    const house = owner?.houses.find((h) => h.id === props.houseId)
    setHouseSel(house ? { ...house, tourId: owner.id } : null)
    setAskGive(false)
  }

  // Prend la maison d'une autre tournée.
  const takeHouse = () => {
    const other = others.find((t) => t.id === houseSel.tourId)
    const { tourId: _owner, ...house } = houseSel
    const loc = locateOnPieces(house.lng, house.lat, tour.pieces)
    if (other) saveTour(other.id, { houses: other.houses.filter((h) => h.id !== house.id) }).catch((err) => toast(`Erreur : ${err.message}`))
    update({ houses: [...tour.houses, { ...house, pieceId: loc?.pieceId ?? null, along: loc?.along ?? 0 }] })
    setHouseSel(null)
    toast(`« ${house.label} » ajoutée à la tournée`)
  }

  const setUnitsSel = (delta) => {
    const { tourId, ...house } = houseSel
    const next = withUnits(house, Math.max(1, house.units?.length || 1) + delta)
    update({ houses: tourRef.current.houses.map((h) => (h.id === next.id ? next : h)) })
    setHouseSel({ ...next, tourId })
  }

  const removeHouse = (giveTo) => {
    const { tourId: _owner, ...house } = houseSel
    if (!giveTo && !window.confirm(`Supprimer « ${house.label} » de la tournée ?`)) return
    const target = others.find((t) => t.id === giveTo)
    if (target) {
      const loc = locateOnPieces(house.lng, house.lat, target.pieces ?? [])
      saveTour(target.id, { houses: [...target.houses, { ...house, pieceId: loc?.pieceId ?? null, along: loc?.along ?? 0 }] }).catch((err) => toast(`Erreur : ${err.message}`))
    }
    update(target ? { houses: tour.houses.filter((h) => h.id !== house.id) } : withoutHouse(tour, house))
    setHouseSel(null)
    setAskGive(false)
    toast(target ? `« ${house.label} » attribuée à la tournée n°${target.number}` : `« ${house.label} » supprimée`)
  }

  // Envoie le tronçon choisi à une autre tournée, avec les maisons qui le longent.
  const moveTransfer = (targetId) => {
    const t = tourRef.current
    const target = others.find((x) => x.id === targetId)
    if (!target || !transfer) return
    const movedHouses = housesTaken(t.houses, transfer)
    const gone = new Set(movedHouses.map((h) => h.id))
    const pieces = t.pieces
      .map((p) => { const m = transfer.find((x) => x.pieceId === p.id); return m ? { ...p, lines: m.kept } : p })
      .filter((p) => p.lines.length)
    // Dans l'autre tournée, le tronçon rejoint la rue du même nom, sinon devient une rue à part.
    let targetPieces = target.pieces ?? []
    for (const m of transfer) {
      const same = targetPieces.find((p) => p.name === m.name)
      targetPieces = same
        ? targetPieces.map((p) => (p === same ? { ...p, lines: [...p.lines, ...m.taken] } : p))
        : [...targetPieces, { id: newId().slice(0, 10), name: m.name, lines: m.taken }]
    }
    const targetHouses = [...(target.houses ?? []), ...movedHouses.map((h) => {
      const loc = locateOnPieces(h.lng, h.lat, targetPieces)
      return { ...h, pieceId: loc?.pieceId ?? null, along: loc?.along ?? 0 }
    })]
    saveTour(target.id, { pieces: targetPieces, houses: targetHouses }).catch((err) => toast(`Erreur : ${err.message}`))
    update({ pieces, houses: t.houses.filter((h) => !gone.has(h.id)) }, target)
    setTransfer(null)
    const n = movedHouses.length
    toast(`Tronçon déplacé vers la tournée n°${target.number}${n ? ` avec ${n} maison${n > 1 ? 's' : ''}` : ''}`)
  }

  // Maisons sans bâtiment sur le plan, dans la zone affichée (vérifiées dans les deux onglets).
  useEffect(() => {
    if (!map) return undefined
    const run = () => setMissing(housesWithoutBuilding(map, tourRef.current.houses))
    run()
    map.on('idle', run)
    const offIgn = onIgnLoaded(run)
    return () => {
      map.off('idle', run)
      offIgn()
    }
  }, [map, tour])

  // Arrivée depuis Réglages > Maisons sans bâtiment : la carte va sur la maison, prête à la déplacer.
  const placedOnce = useRef(false)
  useEffect(() => {
    const h = initialMove && tour.houses.find((x) => x.id === initialHouseId)
    if (!map || !h || placedOnce.current) return
    placedOnce.current = true
    setHouseSel(null)
    setTab('houses')
    setMode('move')
    setMoving(h.id)
    map.jumpTo({ center: [h.lng, h.lat], zoom: 18.5 })
  }, [map, initialMove, initialHouseId, tour])

  // Placement guidé : une maison après l'autre, en photo satellite. La carte se centre
  // sur la maison, on touche son toit, on valide, et la suivante s'affiche.
  // `queue` : la liste venue des réglages ; sinon les maisons signalées dans la vue.
  const goGuide = (house, done, skipped, queue) => {
    if (tab !== 'houses') chooseTab('houses')
    setHouseSel(null)
    setMode(null)
    setMoving(house.id)
    setGuide((g) => {
      const q = queue ?? g?.queue ?? null
      return { id: house.id, label: house.label, done, skipped, queue: q, placed: g?.placed ?? [], total: q?.length ?? g?.total ?? missing?.length ?? 1, pending: null }
    })
    map.easeTo({ center: [house.lng, house.lat], zoom: Math.max(map.getZoom(), 19) })
  }
  const nextMissing = (afterId, done, skipped = guide?.skipped ?? []) => {
    const pool = guide?.queue
      ? guide.queue.map((id) => tourRef.current.houses.find((h) => h.id === id)).filter(Boolean)
      : (missing ?? [])
    const left = pool.filter((h) => h.id !== afterId && !skipped.includes(h.id) && !(guide?.placed ?? []).includes(h.id))
    if (!left.length) {
      setMoving(null)
      setParty(Date.now())
      return setGuide((g) => ({ ...g, finished: true, done, pending: null }))
    }
    goGuide(left[0], done, skipped)
  }
  const confirmPlace = () => {
    const point = guide.pending
    const loc = locateOnPieces(point[0], point[1], tour.pieces)
    update({ houses: tourRef.current.houses.map((h) => (h.id === guide.id ? { ...h, lng: point[0], lat: point[1], pieceId: loc?.pieceId ?? h.pieceId, along: loc?.along ?? h.along } : h)) })
    setParty(Date.now())
    toast(`✅ ${guide.label} placée`)
    setGuide((g) => ({ ...g, placed: [...(g.placed ?? []), g.id] }))
    nextMissing(guide.id, guide.done + 1)
  }
  const showMissing = () => {
    const h = missing?.[0]
    if (h) goGuide(h, 0, [], null)
  }
  const stopGuide = () => {
    setGuide(null)
    setMoving(null)
  }
  // Arrivée depuis Réglages > Maisons sans bâtiment : la mission démarre sur la liste reçue.
  const guidedOnce = useRef(false)
  useEffect(() => {
    if (!map || !initialGuideIds?.length || guidedOnce.current) return
    const first = tour.houses.find((h) => initialGuideIds.includes(h.id))
    if (!first) return
    guidedOnce.current = true
    const queue = initialGuideIds.filter((id) => tour.houses.some((h) => h.id === id))
    goGuide(tour.houses.find((h) => h.id === queue[0]), 0, [], queue)
  }, [map, initialGuideIds, tour]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!map) return
    ensureEditorLayers(map)
    const h = !guide?.finished && tour.houses.find((x) => x.id === (guide?.id ?? moving))
    const p = guide?.pending
    setGeoJSON(map, 'guide', {
      type: 'FeatureCollection',
      features: !h ? [] : [
        { type: 'Feature', properties: { kind: 'now' }, geometry: { type: 'Point', coordinates: [h.lng, h.lat] } },
        ...(p ? [
          { type: 'Feature', properties: { kind: 'link' }, geometry: { type: 'LineString', coordinates: [[h.lng, h.lat], p] } },
          { type: 'Feature', properties: { kind: 'new' }, geometry: { type: 'Point', coordinates: p } },
        ] : []),
      ],
    })
  }, [map, guide, moving, tour])

  const onHouseClick = (props) => {
    const house = tour.houses.find((h) => h.id === props.houseId)
    if (house && window.confirm(`Retirer « ${house.label} » ?`)) update(withoutHouse(tour, house))
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

  const reset = () => {
    setDrawStart(null)
    setPreview(null)
    setPicked(null)
    setHouseSel(null)
    setMoving(null)
    setAskGive(false)
    setGuide(null)
    setTransfer(null)
  }
  // Retoucher l'outil choisi le désélectionne.
  const chooseMode = (key) => {
    reset()
    if (key === mode || !key) return setMode(null)
    setMode(key)
    setTab(MODES.houses.some((m) => m.key === key) ? 'houses' : 'trace')
  }
  const chooseTab = (key) => {
    reset()
    setMode(null)
    setTab(key)
  }
  const activeMode = MODES[tab].find((m) => m.key === mode)
  const showHouses = housesOn || tab === 'houses' || (mode === 'eraser' && eraser === 'delete')
  const EDIT_PAD = { top: 170, bottom: 230, left: 40, right: 60 }
  const chooseArea = (a) => {
    setAreaSel(a?.id ?? null)
    const pts = a ? tour.pieces.filter((p) => a.pieceIds.includes(p.id)).flatMap((p) => tourPoints([{ pieces: [p] }])) : tourPoints(tours)
    fitPoints(map, pts, { padding: EDIT_PAD, maxZoom: 18.5 })
  }
  const help = mode === 'eraser' ? ERASERS.find((x) => x.key === eraser).help
    : mode === 'transfer' ? TRANSFERS.find((x) => x.key === transferBy).help
    : picked ? 'Touche l’endroit où la rue doit s’arrêter (sur la rue pour raccourcir, plus loin pour l’allonger).'
      : mode === 'draw' && drawStart ? 'Touche maintenant le point d’arrivée.'
        : moving ? 'Touche l’endroit exact de la maison sur le plan.'
          : activeMode?.help ?? HAND_HELP[tab]

  return createPortal(
    <div className="editor">
      <TourMap
        satelliteSwitch forceLook={guide ? 'satellite' : null} tours={tours} statesById={statesById} flat focusTourId={tab === 'houses' ? tour.id : null} autoFit={false}
        showHouses={showHouses} streetLabels areas={mapAreas}
        fitPadding={{ top: 170, bottom: 230, left: 40, right: 60 }}
        onMapClick={onMapClick}
        onHouseClick={mode === 'eraser' && eraser === 'delete' ? onHouseClick : moving || mode === 'transfer' ? undefined : (p) => { if (tab !== 'houses') chooseTab('houses'); onHouseEdit(p) }}
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

      {!guide && missing?.length > 0 && (missingOpen ? (
        <div className="missing-card" role="dialog" aria-label="Maisons sans bâtiment">
          <div className="row">
            <strong className="spacer">{missing.length} maison{missing.length > 1 ? 's n’ont' : ' n’a'} pas de bâtiment sur le plan</strong>
            <button type="button" className="btn-round btn-ghost" onClick={() => setMissingOpen(false)} aria-label="Fermer">✕</button>
          </div>
          <ol className="missing-steps">
            <li><b>1</b>La carte va sur la maison</li>
            <li><b>2</b>Touche son toit sur le plan</li>
            <li><b>3</b>C’est placé, on passe à la suivante</li>
          </ol>
          <button type="button" className="btn-danger" onClick={() => { setMissingOpen(false); showMissing() }}>C’est parti</button>
        </div>
      ) : (
        <button type="button" className="missing-pill" onClick={() => setMissingOpen(true)}>⚠️ {missing.length} maison{missing.length > 1 ? 's' : ''} sans bâtiment ›</button>
      ))}

      <div className="editor-bottom">
        {guide?.finished ? (
          <div className="editor-confirm guide-box guide-done">
            <strong className="guide-title">🏆 Mission terminée !</strong>
            <span>{guide.done ? `${guide.done} maison${guide.done > 1 ? 's' : ''} placée${guide.done > 1 ? 's' : ''} sur ${guide.total}` : 'Aucune maison placée'}{guide.skipped.length ? `, ${guide.skipped.length} laissée${guide.skipped.length > 1 ? 's' : ''} de côté` : ''}.</span>
            <div className="row">
              {guide.queue && <button type="button" className="btn-primary spacer" onClick={() => { onClose(); navigate('/admin/reglages', { state: { tab: 'missing' } }) }}>Retour à la liste</button>}
              <button type="button" className="spacer" onClick={stopGuide}>Continuer ici</button>
            </div>
          </div>
        ) : guide ? (
          <div className="editor-confirm guide-box">
            <div className="row">
              <strong className="guide-title spacer">🎯 Maison {guide.done + guide.skipped.length + 1} sur {guide.total}</strong>
              <button type="button" className="btn-sm btn-ghost" onClick={stopGuide}>Arrêter</button>
            </div>
            <div className="mission-bar"><i style={{ width: `${(100 * guide.done) / guide.total}%` }} /></div>
            <strong className="guide-house">🏠 {guide.label}</strong>
            {guide.pending ? (
              <>
                <div className="guide-step guide-step-ok"><b>2</b><span>Le point vert est le nouvel emplacement. C’est bien le toit de la maison ?</span></div>
                <div className="row">
                  <button type="button" className="btn-primary btn-big spacer" onClick={confirmPlace}>✅ Oui, valider</button>
                  <button type="button" className="spacer" onClick={() => setGuide((g) => ({ ...g, pending: null }))}>↺ Choisir ailleurs</button>
                </div>
              </>
            ) : (
              <>
                <div className="guide-step"><b>1</b><span>Sur la photo, le cercle rouge montre où l’adresse est placée. Trouve le toit de la maison, souvent tout près, et <b>touche-le</b>.</span></div>
                <div className="row">
                  <button type="button" className="btn-sm spacer" onClick={() => nextMissing(guide.id, guide.done, [...guide.skipped, guide.id])}>Je ne sais pas, passer</button>
                  <button type="button" className="btn-sm spacer" title="Elle ne sera plus signalée" onClick={() => { update({ houses: tourRef.current.houses.map((h) => (h.id === guide.id ? { ...h, noBuilding: true } : h)) }); toast('Gardée sans bâtiment'); nextMissing(guide.id, guide.done, [...guide.skipped, guide.id]) }}>Pas de bâtiment, c’est normal</button>
                </div>
              </>
            )}
          </div>
        ) : houseSel && houseSel.tourId !== tour.id ? (
          <div className="editor-confirm house-edit">
            <strong className="ellipsis">🏠 {houseSel.label}</strong>
            <span className="small">Cette maison est dans la tournée n°{others.find((t) => t.id === houseSel.tourId)?.number}. L’attribuer à cette tournée ?</span>
            <div className="row">
              <button type="button" className="btn-primary spacer" onClick={takeHouse}>➕ Attribuer à cette tournée</button>
              <button type="button" className="btn-round btn-ghost" onClick={() => setHouseSel(null)} aria-label="Fermer">✕</button>
            </div>
          </div>
        ) : houseSel ? (
          <div className="editor-confirm house-edit">
            <div className="row">
              <strong className="ellipsis spacer">🏠 {houseSel.label}{houseSel.units?.length ? ` · ${houseSel.units.length} logements` : ''}</strong>
              <button type="button" className="btn-round btn-ghost" onClick={() => { setHouseSel(null); setAskGive(false) }} aria-label="Fermer">✕</button>
            </div>
            {askGive ? (
              <div className="stack give-list">
                <strong className="small">À quelle tournée attribuer cette maison ?</strong>
                <div className="give-btns">
                  {[...others].sort((x, y) => x.number - y.number).map((t) => (
                    <button key={t.id} type="button" onClick={() => removeHouse(t.id)}><i style={{ background: t.color }} />N°{t.number} · {t.name}</button>
                  ))}
                </div>
                <button type="button" className="btn-sm btn-ghost" onClick={() => setAskGive(false)}>Annuler</button>
              </div>
            ) : (
              <>
                <div className="row units-step">
                  <span className="spacer">🏢 Logements</span>
                  <button type="button" className="btn-sm" onClick={() => setUnitsSel(-1)} aria-label="Un logement de moins">−</button>
                  <strong>{Math.max(1, houseSel.units?.length ?? 1)}</strong>
                  <button type="button" className="btn-sm" onClick={() => setUnitsSel(1)} aria-label="Un logement de plus">+</button>
                </div>
                <div className="row">
                  <button type="button" className="spacer" onClick={() => setAskGive(true)}>↪️ Attribuer à une autre tournée</button>
                  <button type="button" className="btn-danger spacer" onClick={() => removeHouse('')}>🗑️ Supprimer de la tournée</button>
                </div>
              </>
            )}
          </div>
        ) : transfer ? (
          <div className="editor-confirm house-edit">
            <div className="row">
              <strong className="ellipsis spacer">↔️ {[...new Set(transfer.map((m) => m.name))].join(', ')}</strong>
              <button type="button" className="btn-round btn-ghost" onClick={() => setTransfer(null)} aria-label="Fermer">✕</button>
            </div>
            <div className="stack give-list">
              <strong className="small">À quelle tournée déplacer ce tronçon ? {(() => { const n = housesTaken(tour.houses, transfer).length; return n ? `Ses ${n} maison${n > 1 ? 's' : ''} suivent.` : 'Aucune maison dessus.' })()}</strong>
              <div className="give-btns">
                {[...others].sort((x, y) => x.number - y.number).map((t) => (
                  <button key={t.id} type="button" onClick={() => moveTransfer(t.id)}><i style={{ background: t.color }} />N°{t.number} · {t.name}</button>
                ))}
              </div>
              <button type="button" className="btn-sm btn-ghost" onClick={() => setTransfer(null)}>Annuler</button>
            </div>
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
          <div className={`row${mode || moving || picked ? ' editor-instruction' : ''}`} key={`${mode}-${Boolean(moving)}-${Boolean(picked)}`}>
            {mode || moving || picked ? (
              <div className="spacer">
                <strong className="editor-instruction-title">{ICONS[moving ? 'move' : mode] ?? null}{moving ? 'Déplacer la maison' : activeMode?.label ?? (mode === 'eraser' ? 'Gomme' : mode === 'transfer' ? 'Déplacer un tronçon' : 'Rue')}</strong>
                <div>{help}</div>
              </div>
            ) : <div className="small editor-help spacer">{help}</div>}
            {moving && <button type="button" className="btn-sm" onClick={() => setMoving(null)}>✕</button>}
            {mode === 'draw' && drawStart && <button type="button" className="btn-sm" onClick={() => setDrawStart(null)}>✕</button>}
          </div>
        )}
        {mode === 'eraser' && (
          <div className="segmented">
            {ERASERS.map((x) => (
              <button key={x.key} type="button" className={eraser === x.key ? 'on' : ''} onClick={() => setEraser(x.key)}>{x.label}</button>
            ))}
          </div>
        )}
        {mode === 'transfer' && !transfer && (
          <div className="segmented">
            {TRANSFERS.map((x) => (
              <button key={x.key} type="button" className={transferBy === x.key ? 'on' : ''} onClick={() => setTransferBy(x.key)}>{x.label}</button>
            ))}
          </div>
        )}
      </div>

      <nav className="editor-side" aria-label="Outils">
        {TABS.map((t) => (
          <div key={t.key} className="editor-side-group">
            <strong>{t.label}</strong>
            {t.key === 'trace' && (
              <button type="button" className={mode ? '' : 'on'} onClick={() => chooseMode(null)} title="Se déplacer librement sur la carte">{ICONS.hand}<span>Naviguer</span></button>
            )}
            {MODES[t.key].map((m) => (
              <button key={m.key} type="button" className={mode === m.key ? 'on' : ''} onClick={() => chooseMode(m.key)}>{ICONS[m.key]}<span>{m.label}</span></button>
            ))}
          </div>
        ))}
      </nav>
      <Confetti trigger={party} />
      {newPoint && <AddHouseSheet tour={tour} point={newPoint} onAdd={(house) => update({ houses: [...tourRef.current.houses, house] })} onClose={() => setNewPoint(null)} />}
    </div>,
    document.body,
  )
}
