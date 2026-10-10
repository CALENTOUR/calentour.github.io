import { useEffect, useRef, useState } from 'react'
import { polygonBounds, polygonToGeoJSON } from '../../lib/geo'
import { sectorsToGeoJSON, upsertSectorLayers } from './layers'
import { setGeoJSON, useMapLibre } from './useMapLibre'

// Dessin d'un secteur : chaque appui ajoute un sommet, les sommets se déplacent
// au doigt ou à la souris.
export default function SectorEditor({ value, onChange, color, otherSectors }) {
  const containerRef = useRef(null)
  const initialBounds = value?.length >= 3
    ? polygonBounds(value)
    : otherSectors.length ? polygonBounds(otherSectors.flatMap((s) => s.polygon ?? [])) : null
  const map = useMapLibre(containerRef, { initialBounds, flat: true })
  const pointsRef = useRef(value ?? [])
  const [points, setPoints] = useState(value ?? [])

  const update = (next) => {
    pointsRef.current = next
    setPoints(next)
    onChange(next)
  }

  // Autres secteurs en arrière-plan
  useEffect(() => {
    if (map) upsertSectorLayers(map, sectorsToGeoJSON(otherSectors))
  }, [map, otherSectors])

  // Tracé en cours
  useEffect(() => {
    if (!map) return
    const features = []
    if (points.length >= 3) features.push({ type: 'Feature', properties: {}, geometry: polygonToGeoJSON(points) })
    else if (points.length === 2) {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) } })
    }
    points.forEach((p, i) => features.push({ type: 'Feature', properties: { index: i }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } }))
    setGeoJSON(map, 'draft', { type: 'FeatureCollection', features })
    if (!map.getLayer('draft-fill')) {
      map.addLayer({ id: 'draft-fill', type: 'fill', source: 'draft', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': color, 'fill-opacity': 0.25 } })
      map.addLayer({ id: 'draft-line', type: 'line', source: 'draft', filter: ['!=', '$type', 'Point'], paint: { 'line-color': color, 'line-width': 3 } })
      map.addLayer({ id: 'draft-vertices', type: 'circle', source: 'draft', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 8, 'circle-color': '#ffffff', 'circle-stroke-color': color, 'circle-stroke-width': 3 } })
    } else {
      map.setPaintProperty('draft-fill', 'fill-color', color)
      map.setPaintProperty('draft-line', 'line-color', color)
      map.setPaintProperty('draft-vertices', 'circle-stroke-color', color)
    }
  }, [map, points, color])

  // Ajout et déplacement des sommets
  useEffect(() => {
    if (!map) return undefined
    let dragIndex = null
    let moved = false

    const vertexAt = (point) => map.queryRenderedFeatures(
      [[point.x - 12, point.y - 12], [point.x + 12, point.y + 12]],
      { layers: ['draft-vertices'] },
    )[0]

    const onDown = (e) => {
      const hit = vertexAt(e.point)
      if (!hit) return
      e.preventDefault()
      dragIndex = hit.properties.index
      moved = false
      map.dragPan.disable()
    }
    const onMove = (e) => {
      if (dragIndex == null) return
      moved = true
      const next = [...pointsRef.current]
      next[dragIndex] = { lng: e.lngLat.lng, lat: e.lngLat.lat }
      update(next)
    }
    const onUp = () => {
      if (dragIndex == null) return
      dragIndex = null
      map.dragPan.enable()
    }
    const onClick = (e) => {
      if (moved) { moved = false; return }
      if (vertexAt(e.point)) return
      update([...pointsRef.current, { lng: e.lngLat.lng, lat: e.lngLat.lat }])
    }

    map.on('mousedown', onDown)
    map.on('touchstart', onDown)
    map.on('mousemove', onMove)
    map.on('touchmove', onMove)
    map.on('mouseup', onUp)
    map.on('touchend', onUp)
    map.on('click', onClick)
    return () => {
      map.off('mousedown', onDown)
      map.off('touchstart', onDown)
      map.off('mousemove', onMove)
      map.off('touchmove', onMove)
      map.off('mouseup', onUp)
      map.off('touchend', onUp)
      map.off('click', onClick)
    }
    // update ne dépend que de refs et de onChange, stable pendant l'édition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  return (
    <div className="stack">
      <div className="editor-map">
        <div ref={containerRef} className="map-container" />
      </div>
      <div className="row">
        <span className="muted small spacer">
          {points.length < 3
            ? `Touchez la carte pour placer les sommets du secteur (${points.length}/3 minimum).`
            : `${points.length} sommets. Faites glisser un sommet pour l’ajuster.`}
        </span>
        <button type="button" className="btn-sm" disabled={!points.length} onClick={() => update(points.slice(0, -1))}>↶ Dernier point</button>
        <button type="button" className="btn-sm btn-danger" disabled={!points.length} onClick={() => update([])}>Effacer</button>
      </div>
    </div>
  )
}
