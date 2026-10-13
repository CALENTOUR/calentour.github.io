import { useEffect, useRef, useState } from 'react'
import { bounds, lineLength, pointAt, unflatten } from '../../lib/geo'
import { tourStats } from '../../lib/stats'
import { IconGps } from '../ui/Icons'
import { dwellingKey } from '../../services/state'
import { drawLitHouses, litHouses } from './houseBuildings'
import { addStatusIcons } from './icons'
import { circlePolygon, pieceLabels } from '../../lib/places'
import { fitPoints, setGeoJSON, toggle3D, useMapLibre } from './useMapLibre'

// État affiché d'un immeuble : le plus urgent de ses logements.
export function buildingStatus(house, h) {
  const list = house.units.map((u) => h[dwellingKey(house.id, u.id)]?.s ?? 'todo')
  for (const s of ['todo', 'again', 'given', 'refused']) if (list.includes(s)) return s
  return 'empty'
}

const inFocus = (t, pieceId, focusPieceId, focusTourId) => ((!focusPieceId || pieceId === focusPieceId) && (!focusTourId || t.id === focusTourId) ? 1 : 0)

export function piecesGeoJSON(tours, focusPieceId, focusTourId, statesById = null) {
  const names = Object.assign({}, ...tours.map((t) => pieceLabels(t)))
  return {
    type: 'FeatureCollection',
    features: tours.flatMap((t) => {
      const progress = statesById ? tourStats(t, statesById[t.id]).progress : 0
      return (t.pieces ?? []).flatMap((p) => p.lines.map((l, i) => ({
      type: 'Feature',
      id: undefined,
      properties: { tourId: t.id, pieceId: p.id, lineIndex: i, color: t.color, progress, focus: inFocus(t, p.id, focusPieceId, focusTourId), label: names[p.id]?.street ?? p.name },
      geometry: { type: 'LineString', coordinates: unflatten(l.c) },
    })))
    }),
  }
}

export function housesGeoJSON(tours, statesById, focusPieceId, focusTourId) {
  return {
    type: 'FeatureCollection',
    features: tours.flatMap((t) => {
      const h = statesById[t.id]?.h ?? {}
      return (t.houses ?? []).map((house) => {
        const isBuilding = Boolean(house.units?.length)
        const status = isBuilding ? buildingStatus(house, h) : h[dwellingKey(house.id)]?.s ?? 'todo'
        return {
          type: 'Feature',
          properties: {
            tourId: t.id, houseId: house.id, status, label: house.number || house.label,
            icon: `${isBuilding ? 'building' : 'house'}-${status}`,
            focus: inFocus(t, house.pieceId, focusPieceId, focusTourId),
            // Dessinées par-dessus : les maisons du morceau choisi, puis celles à faire.
            order: inFocus(t, house.pieceId, focusPieceId, focusTourId) * 10 + (status === 'todo' ? 2 : status === 'again' ? 1 : 0),
            units: isBuilding ? house.units.length : 0,
          },
          geometry: { type: 'Point', coordinates: [house.lng, house.lat] },
        }
      })
    }),
  }
}

export const tourPoints = (tours, pieceId) => tours.flatMap((t) => (t.pieces ?? [])
  .filter((p) => !pieceId || p.id === pieceId)
  .flatMap((p) => p.lines.flatMap((l) => unflatten(l.c))))

export function tourBounds(tours, pieceId) {
  return bounds(tourPoints(tours, pieceId))
}

// Secteurs entourés en rouge : un cercle et son nom par endroit de la tournée.
function areasGeoJSON(areas) {
  return {
    type: 'FeatureCollection',
    features: areas.flatMap((a) => {
      const top = [a.center[0], a.center[1] + a.radius / 110540]
      return [
        { type: 'Feature', properties: { areaId: a.id, active: a.active ? 1 : 0 }, geometry: circlePolygon(a.center, a.radius) },
        { type: 'Feature', properties: { areaId: a.id, label: a.name, active: a.active ? 1 : 0 }, geometry: { type: 'Point', coordinates: top } },
      ]
    }),
  }
}

function ensureAreaLayers(map) {
  if (map.getLayer('areas-fill')) return
  const before = map.getLayer('pieces-casing') ? 'pieces-casing' : undefined
  map.addLayer({ id: 'areas-fill', type: 'fill', source: 'areas', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#c0392b', 'fill-opacity': ['case', ['==', ['get', 'active'], 1], 0, 0.08] } }, before)
  map.addLayer({
    id: 'areas-line', type: 'line', source: 'areas', filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'line-color': '#c0392b', 'line-width': 3, 'line-dasharray': [2, 1.2], 'line-opacity': ['case', ['==', ['get', 'active'], 1], 0.3, 0.95] },
  }, before)
  map.addLayer({
    id: 'areas-label', type: 'symbol', source: 'areas', filter: ['==', ['geometry-type'], 'Point'],
    layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 14, 'text-anchor': 'bottom', 'text-offset': [0, -0.3], 'text-allow-overlap': true, 'text-max-width': 30 },
    paint: { 'text-color': '#ffffff', 'text-halo-color': '#c0392b', 'text-halo-width': 3 },
  })
}

function ensureLayers(map) {
  if (map.getLayer('pieces-casing')) return
  addStatusIcons(map)
  map.addLayer({
    id: 'pieces-casing', type: 'line', source: 'pieces',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4, 17, 14], 'line-opacity': ['case', ['==', ['get', 'focus'], 1], 0.9, 0.3] },
  })
  map.addLayer({
    id: 'pieces', type: 'line', source: 'pieces',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 14, 5, 17, 9], 'line-opacity': ['case', ['==', ['get', 'focus'], 1], 0.95, 0.25] },
  })
  map.addLayer({
    id: 'houses', type: 'symbol', source: 'houses',
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.3, 15, 0.6, 17, 0.9, 19, 1.15],
      'icon-allow-overlap': true,
      'icon-anchor': 'bottom',
      'icon-pitch-alignment': 'viewport',
      'symbol-sort-key': ['get', 'order'],
      'text-field': ['step', ['zoom'], '', 16, ['to-string', ['get', 'label']]],
      'text-font': ['Noto Sans Bold'],
      'text-size': 13,
      'text-offset': [0, 0.15],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: {
      'icon-opacity': ['case', ['==', ['get', 'focus'], 1], 1, 0.3],
      'text-color': '#1f2a24',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.6,
    },
  })
}

// Étiquette de chaque tournée (numéro, et avancement si demandé), au milieu de sa plus longue rue.
function labelsGeoJSON(tours, statesById, withProgress) {
  return {
    type: 'FeatureCollection',
    features: tours.flatMap((t) => {
      const lines = (t.pieces ?? []).flatMap((p) => p.lines.map((l) => unflatten(l.c))).filter((l) => l.length > 1)
      if (!lines.length) return []
      const longest = lines.reduce((a, b) => (lineLength(b) > lineLength(a) ? b : a))
      const pct = Math.round(tourStats(t, statesById[t.id]).progress * 100)
      return [{
        type: 'Feature',
        properties: { tourId: t.id, text: withProgress ? `${t.number} · ${pct} %` : String(t.number), color: t.color, progress: pct / 100 },
        geometry: { type: 'Point', coordinates: pointAt(longest, lineLength(longest) / 2) },
      }]
    }),
  }
}

// Couleur d'avancement : terre cuite (rien de fait), ocre, puis vert (tout est fait).
const PROGRESS_COLOR = ['interpolate', ['linear'], ['get', 'progress'], 0, '#c0492f', 0.5, '#d39b2a', 1, '#4f8a4c']

function ensureLabelLayer(map) {
  if (map.getLayer('tour-labels')) return
  map.addLayer({
    id: 'tour-labels', type: 'symbol', source: 'tour-labels',
    layout: { 'text-field': ['get', 'text'], 'text-font': ['Noto Sans Bold'], 'text-size': 14, 'text-allow-overlap': false, 'text-padding': 2 },
    paint: { 'text-color': '#1f2a24', 'text-halo-color': '#fbf9f4', 'text-halo-width': 2.5 },
  })
}

// Carte d'une ou plusieurs tournées : rues tracées et maisons colorées par statut.
export default function TourMap({ tours, statesById, focusPieceId = null, focusTourId = null, onHouseClick, onMapClick, onReady, flat = false, fitPadding = 50, expandable = false, showMe = false, showHouses = true, showProgress = false, showLabels = false, streetLabels = false, autoFit = true, areas = null, className = '' }) {
  const containerRef = useRef(null)
  const initial = tourPoints(tours, focusPieceId)
  const map = useMapLibre(containerRef, { initialPoints: initial, flat, fitPadding, geolocate: !showMe })
  const [full, setFull] = useState(false)
  const handlers = useRef({})
  handlers.current = { onHouseClick, onMapClick }
  const housesRef = useRef(null)

  useEffect(() => {
    if (!map) return
    setGeoJSON(map, 'pieces', piecesGeoJSON(tours, focusPieceId, focusTourId, showProgress ? statesById : null))
    housesRef.current = housesGeoJSON(tours, statesById, focusPieceId, focusTourId)
    setGeoJSON(map, 'houses', housesRef.current)
    ensureLayers(map)
    map.setLayoutProperty('houses', 'visibility', showHouses ? 'visible' : 'none')
    if (streetLabels && !map.getLayer('street-labels')) {
      // Nom de chaque rue écrit le long de son tracé.
      map.addLayer({
        id: 'street-labels', type: 'symbol', source: 'pieces', filter: ['==', ['get', 'focus'], 1],
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 13, 11, 17, 15], 'text-max-angle': 40, 'symbol-spacing': 320, 'text-padding': 4 },
        paint: { 'text-color': '#1f2a24', 'text-halo-color': '#ffffff', 'text-halo-width': 2.4 },
      })
    }
    map.setPaintProperty('pieces', 'line-color', showProgress ? PROGRESS_COLOR : ['get', 'color'])
    if (showLabels || showProgress) {
      setGeoJSON(map, 'tour-labels', labelsGeoJSON(tours, statesById, showProgress))
      ensureLabelLayer(map)
    } else if (map.getLayer('tour-labels')) {
      setGeoJSON(map, 'tour-labels', { type: 'FeatureCollection', features: [] })
    }
  }, [map, tours, statesById, focusPieceId, focusTourId, showHouses, showProgress, showLabels, streetLabels])

  useEffect(() => {
    if (!map || (!areas && !map.getSource('areas'))) return
    setGeoJSON(map, 'areas', areasGeoJSON(areas ?? []))
    ensureAreaLayers(map)
  }, [map, areas])

  // Maisons allumées : le bâtiment de chaque maison prend la couleur de son statut
  // (recalculé quand la carte a fini de charger ce qu'elle montre).
  const litSig = useRef({ sig: null, lit: null })
  useEffect(() => {
    if (!map) return undefined
    const run = () => {
      if (!map.getLayer('houses')) return
      const on = showHouses
      const { lit, features, sig } = on ? litHouses(map, housesRef.current?.features ?? []) : { lit: new Set(), features: [], sig: '' }
      if (sig !== litSig.current.sig) {
        litSig.current.sig = sig
        drawLitHouses(map, features)
      }
      map.setLayoutProperty('lit-houses', 'visibility', on ? 'visible' : 'none')
      const key = [...lit].sort().join(',')
      if (key !== litSig.current.lit) {
        litSig.current.lit = key
        map.setPaintProperty('houses', 'icon-opacity', ['case', ['in', ['get', 'houseId'], ['literal', [...lit]]], 0, ['==', ['get', 'focus'], 1], 1, 0.3])
      }
    }
    let timer = 0
    const later = () => { clearTimeout(timer); timer = setTimeout(run, 120) }
    run()
    map.on('idle', later)
    return () => {
      clearTimeout(timer)
      map.off('idle', later)
    }
  }, [map, tours, statesById, focusPieceId, focusTourId, showHouses])

  // Recentrage quand on change de morceau.
  const lastFocus = useRef(focusPieceId)
  useEffect(() => {
    if (!map || lastFocus.current === focusPieceId) return
    lastFocus.current = focusPieceId
    if (!autoFit) return
    fitPoints(map, tourPoints(tours, focusPieceId), { padding: fitPadding, maxZoom: 18 })
    // fitPadding est fixe pour une carte donnée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focusPieceId, tours])

  useEffect(() => {
    if (!map) return undefined
    const onClick = (e) => {
      // Zone de toucher large ; on garde la maison la plus proche du doigt.
      const hits = map.queryRenderedFeatures([[e.point.x - 24, e.point.y - 34], [e.point.x + 24, e.point.y + 14]], { layers: ['houses'] })
      const near = (f) => {
        const p = map.project(f.geometry.coordinates)
        return Math.hypot(p.x - e.point.x, p.y - 12 - e.point.y) - f.properties.focus * 30
      }
      // Un bâtiment allumé sous le doigt passe avant la pastille la plus proche.
      const litHit = map.getLayer('lit-houses') ? map.queryRenderedFeatures(e.point, { layers: ['lit-houses'] })[0] : null
      const hit = litHit ?? hits.sort((a, b) => near(a) - near(b))[0]
      if (hit && handlers.current.onHouseClick) handlers.current.onHouseClick(hit.properties)
      else handlers.current.onMapClick?.(e, map)
    }
    const pointer = (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: map.getLayer('lit-houses') ? ['houses', 'lit-houses'] : ['houses'] }).length
      map.getCanvas().style.cursor = hit ? 'pointer' : ''
    }
    map.on('click', onClick)
    map.on('mousemove', pointer)
    onReady?.(map)
    return () => {
      map.off('click', onClick)
      map.off('mousemove', pointer)
    }
    // onReady n'est appelé qu'une fois, à la création de la carte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // Position GPS du téléphone : point bleu suivi en continu, bouton pour s'y recentrer.
  const [me, setMe] = useState(null)
  useEffect(() => {
    if (!showMe || !navigator.geolocation) return undefined
    const id = navigator.geolocation.watchPosition(
      (pos) => setMe({ lng: pos.coords.longitude, lat: pos.coords.latitude, accuracy: pos.coords.accuracy }),
      () => setMe(null),
      { enableHighAccuracy: true, maximumAge: 5000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [showMe])
  useEffect(() => {
    if (!map || !showMe) return
    setGeoJSON(map, 'me', {
      type: 'FeatureCollection',
      features: me ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [me.lng, me.lat] } }] : [],
    })
    if (!map.getLayer('me-halo')) {
      map.addLayer({ id: 'me-halo', type: 'circle', source: 'me', paint: { 'circle-radius': 22, 'circle-color': '#2f5f8f', 'circle-opacity': 0.18, 'circle-pitch-alignment': 'map' } })
      map.addLayer({ id: 'me-dot', type: 'circle', source: 'me', paint: { 'circle-radius': 8, 'circle-color': '#2f5f8f', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } })
    }
  }, [map, me, showMe])
  const goToMe = () => {
    if (!me) return window.alert('Position GPS pas encore trouvée. Vérifie que la localisation est autorisée pour ce site.')
    map.flyTo({ center: [me.lng, me.lat], zoom: Math.max(map.getZoom(), 17.5), duration: 800 })
  }

  // Plein écran : la carte recouvre toute la page, Échap pour revenir.
  useEffect(() => {
    if (!map) return undefined
    map.resize()
    if (!full) return undefined
    const onKey = (e) => e.key === 'Escape' && setFull(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [map, full])

  // Vue 2D ou 3D en cours, pour le bouton.
  const [is3D, setIs3D] = useState(false)
  useEffect(() => {
    if (!map) return undefined
    const sync = () => setIs3D(map.getPitch() > 5)
    sync()
    map.on('pitchend', sync)
    return () => map.off('pitchend', sync)
  }, [map])

  return (
    <div className={`map-wrap ${className}${full ? ' map-wrap-full' : ''}`}>
      <div ref={containerRef} className="map-container" />
      {map && (
        <div className="map-btns">
          <div className="dim-toggle" role="group" aria-label="Vue 2D ou 3D">
            <button type="button" className={is3D ? '' : 'on'} aria-pressed={!is3D} onClick={() => is3D && toggle3D(map)}>2D</button>
            <button type="button" className={is3D ? 'on' : ''} aria-pressed={is3D} onClick={() => !is3D && toggle3D(map)}>3D</button>
          </div>
          {showMe && <button type="button" className={me ? 'me-on' : ''} onClick={goToMe} aria-label="Afficher ma position"><IconGps width={18} height={18} />Ma position</button>}
          {expandable && (
            <button type="button" onClick={() => setFull((f) => !f)} aria-label={full ? 'Quitter le plein écran' : 'Plein écran'}>{full ? '✕ Réduire' : '⛶ Plein écran'}</button>
          )}
        </div>
      )}
    </div>
  )
}
