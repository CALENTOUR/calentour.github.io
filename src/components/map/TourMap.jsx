import { useEffect, useRef, useState } from 'react'
import { bounds, unflatten } from '../../lib/geo'
import { dwellingKey } from '../../services/state'
import { addStatusIcons } from './icons'
import { setGeoJSON, toggle3D, useMapLibre } from './useMapLibre'

// État affiché d'un immeuble : le plus urgent de ses logements.
export function buildingStatus(house, h) {
  const list = house.units.map((u) => h[dwellingKey(house.id, u.id)]?.s ?? 'todo')
  for (const s of ['todo', 'again', 'given', 'refused']) if (list.includes(s)) return s
  return 'empty'
}

const inFocus = (t, pieceId, focusPieceId, focusTourId) => ((!focusPieceId || pieceId === focusPieceId) && (!focusTourId || t.id === focusTourId) ? 1 : 0)

export function piecesGeoJSON(tours, focusPieceId, focusTourId) {
  return {
    type: 'FeatureCollection',
    features: tours.flatMap((t) => (t.pieces ?? []).flatMap((p) => p.lines.map((l, i) => ({
      type: 'Feature',
      id: undefined,
      properties: { tourId: t.id, pieceId: p.id, lineIndex: i, color: t.color, focus: inFocus(t, p.id, focusPieceId, focusTourId), label: p.name },
      geometry: { type: 'LineString', coordinates: unflatten(l.c) },
    })))),
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

export function tourBounds(tours, pieceId) {
  const pts = tours.flatMap((t) => (t.pieces ?? [])
    .filter((p) => !pieceId || p.id === pieceId)
    .flatMap((p) => p.lines.flatMap((l) => unflatten(l.c))))
  return bounds(pts)
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
    paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 17, 9], 'line-opacity': ['case', ['==', ['get', 'focus'], 1], 0.95, 0.25] },
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
      'text-color': '#0f172a',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.6,
    },
  })
}

// Carte d'une ou plusieurs tournées : rues tracées et maisons colorées par statut.
export default function TourMap({ tours, statesById, focusPieceId = null, focusTourId = null, onHouseClick, onMapClick, onReady, flat = false, fitPadding = 50, expandable = false, className = '' }) {
  const containerRef = useRef(null)
  const initial = tourBounds(tours, focusPieceId)
  const map = useMapLibre(containerRef, { initialBounds: initial, flat, fitPadding })
  const [full, setFull] = useState(false)
  const handlers = useRef({})
  handlers.current = { onHouseClick, onMapClick }

  useEffect(() => {
    if (!map) return
    setGeoJSON(map, 'pieces', piecesGeoJSON(tours, focusPieceId, focusTourId))
    setGeoJSON(map, 'houses', housesGeoJSON(tours, statesById, focusPieceId, focusTourId))
    ensureLayers(map)
  }, [map, tours, statesById, focusPieceId, focusTourId])

  // Recentrage quand on change de morceau.
  const lastFocus = useRef(focusPieceId)
  useEffect(() => {
    if (!map || lastFocus.current === focusPieceId) return
    lastFocus.current = focusPieceId
    const b = tourBounds(tours, focusPieceId)
    if (b) map.fitBounds(b, { padding: fitPadding, maxZoom: 18, duration: 700, pitch: map.getPitch() })
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
      const hit = hits.sort((a, b) => near(a) - near(b))[0]
      if (hit && handlers.current.onHouseClick) handlers.current.onHouseClick(hit.properties)
      else handlers.current.onMapClick?.(e, map)
    }
    const pointer = (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: ['houses'] }).length
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

  // Plein écran : la carte recouvre toute la page, Échap pour revenir.
  useEffect(() => {
    if (!map) return undefined
    map.resize()
    if (!full) return undefined
    const onKey = (e) => e.key === 'Escape' && setFull(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [map, full])

  return (
    <div className={`map-wrap ${className}${full ? ' map-wrap-full' : ''}`}>
      <div ref={containerRef} className="map-container" />
      {map && (
        <div className="map-btns">
          <button type="button" onClick={() => toggle3D(map)} aria-label="Basculer 2D / 3D">2D / 3D</button>
          {expandable && (
            <button type="button" onClick={() => setFull((f) => !f)} aria-label={full ? 'Quitter le plein écran' : 'Plein écran'}>{full ? '✕ Réduire' : '⛶ Plein écran'}</button>
          )}
        </div>
      )}
    </div>
  )
}
