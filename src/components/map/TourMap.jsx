import { useEffect, useRef } from 'react'
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

export function piecesGeoJSON(tours, focusPieceId) {
  return {
    type: 'FeatureCollection',
    features: tours.flatMap((t) => (t.pieces ?? []).flatMap((p) => p.lines.map((l, i) => ({
      type: 'Feature',
      id: undefined,
      properties: { tourId: t.id, pieceId: p.id, lineIndex: i, color: t.color, focus: !focusPieceId || p.id === focusPieceId ? 1 : 0, label: p.name },
      geometry: { type: 'LineString', coordinates: unflatten(l.c) },
    })))),
  }
}

export function housesGeoJSON(tours, statesById, focusPieceId) {
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
            focus: !focusPieceId || house.pieceId === focusPieceId ? 1 : 0,
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
      'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.35, 15, 0.6, 18, 1.05],
      'icon-allow-overlap': true,
      'icon-anchor': 'bottom',
      'icon-pitch-alignment': 'viewport',
      'symbol-sort-key': ['get', 'focus'],
      'text-field': ['step', ['zoom'], '', 16.5, ['to-string', ['get', 'label']]],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-offset': [0, 0.3],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: {
      'icon-opacity': ['case', ['==', ['get', 'focus'], 1], 1, 0.35],
      'text-color': '#0f172a',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.6,
    },
  })
}

// Carte d'une ou plusieurs tournées : rues tracées et maisons colorées par statut.
export default function TourMap({ tours, statesById, focusPieceId = null, onHouseClick, onMapClick, onReady, flat = false, className = '' }) {
  const containerRef = useRef(null)
  const initial = tourBounds(tours, focusPieceId)
  const map = useMapLibre(containerRef, { initialBounds: initial, flat })
  const handlers = useRef({})
  handlers.current = { onHouseClick, onMapClick }

  useEffect(() => {
    if (!map) return
    setGeoJSON(map, 'pieces', piecesGeoJSON(tours, focusPieceId))
    setGeoJSON(map, 'houses', housesGeoJSON(tours, statesById, focusPieceId))
    ensureLayers(map)
  }, [map, tours, statesById, focusPieceId])

  // Recentrage quand on change de morceau.
  const lastFocus = useRef(focusPieceId)
  useEffect(() => {
    if (!map || lastFocus.current === focusPieceId) return
    lastFocus.current = focusPieceId
    const b = tourBounds(tours, focusPieceId)
    if (b) map.fitBounds(b, { padding: 50, maxZoom: 18, duration: 700, pitch: map.getPitch() })
  }, [map, focusPieceId, tours])

  useEffect(() => {
    if (!map) return undefined
    const onClick = (e) => {
      const hit = map.queryRenderedFeatures([[e.point.x - 14, e.point.y - 20], [e.point.x + 14, e.point.y + 8]], { layers: ['houses'] })[0]
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

  return (
    <div className={`map-wrap ${className}`}>
      <div ref={containerRef} className="map-container" />
      {map && (
        <button type="button" className="map-3d-btn" onClick={() => toggle3D(map)} aria-label="Basculer 2D / 3D">2D / 3D</button>
      )}
    </div>
  )
}
