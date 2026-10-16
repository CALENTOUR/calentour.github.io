// Maisons « allumées » : au lieu d'une pastille, le bâtiment de chaque maison
// (tiré du fond de carte OpenStreetMap) prend la couleur de son statut. Chaque
// bâtiment est un peu rétréci pour que deux maisons mitoyennes restent distinctes.
// Bâtiment absent d'OpenStreetMap : on prend celui de l'IGN (lib/ignBuildings.js).
import { setGeoJSON } from './useMapLibre'
import { addToIndex, ignBuildingAt, ignSettled, loadIgnFor, nearestBuilding, ringBox } from '../../lib/ignBuildings'

// Maison touchée par le binôme : violet, une couleur qu'aucun statut n'utilise.
export const SELECTED_COLOR = '#7c3aed'
export const LIT_COLORS = { todo: '#3f77ad', given: '#4f8a4c', again: '#d39b2a', refused: '#b8432f', empty: '#5e5a50' }
// Bâtiments sans adresse de la tournée (granges, garages, maisons d'autres rues).
export const OTHER_BUILDING = '#ebe6dc'
const SHRINK = 0.82 // part de la taille d'origine

// Couche des bâtiments du fond de carte : sa source, et sa couche dans les tuiles.
export function buildingSource(map) {
  const layer = (map.getStyle()?.layers ?? []).find((l) => l['source-layer'] === 'building' && l.source)
  if (!layer) return null
  const type = map.getSource(layer.source)?.type
  return { id: layer.source, query: type === 'vector' ? { sourceLayer: 'building' } : {}, layerId: layer.id }
}

const shrink = (ring) => {
  const n = ring.length - 1 || 1
  let cx = 0, cy = 0
  for (let i = 0; i < n; i++) { cx += ring[i][0]; cy += ring[i][1] }
  cx /= n; cy /= n
  return ring.map(([x, y]) => [cx + (x - cx) * SHRINK, cy + (y - cy) * SHRINK])
}

// Contours extérieurs des bâtiments chargés, indexés par maille.
function buildingIndex(map, src) {
  const cells = new Map()
  const seen = new Set()
  for (const f of map.querySourceFeatures(src.id, src.query)) {
    const g = f.geometry
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const poly of polys) {
      const ring = poly[0]
      if (!ring || ring.length < 4) continue
      const box = ringBox(ring)
      // Le même bâtiment revient d'une tuile à l'autre : on ne le garde qu'une fois.
      const key = `${box.w.toFixed(6)},${box.s.toFixed(6)},${box.e.toFixed(6)},${box.n.toFixed(6)}`
      if (seen.has(key)) continue
      seen.add(key)
      addToIndex(cells, { ring, box, height: f.properties?.render_height ?? f.properties?.height ?? 6 })
    }
  }
  return cells
}

// Bâtiment d'une adresse : celui du fond de carte, sinon celui de l'IGN.
const findBuilding = (cells, point) => nearestBuilding(cells, point) ?? ignBuildingAt(point)

// Maisons sans bâtiment ni sur le plan ni à l'IGN, parmi celles affichées (null si on
// est trop loin, ou tant que l'IGN n'a pas répondu). « Pas de bâtiment, c'est normal » : ignorée.
export function housesWithoutBuilding(map, houses) {
  const src = buildingSource(map)
  if (!src || map.getZoom() < 15) return null
  const view = map.getBounds()
  const shown = houses.filter((h) => !h.noBuilding && view.contains([h.lng, h.lat]))
  const points = shown.map((h) => [h.lng, h.lat])
  if (!ignSettled(points)) {
    loadIgnFor(points)
    return null
  }
  const cells = buildingIndex(map, src)
  return shown.filter((h) => !findBuilding(cells, [h.lng, h.lat]))
}

// Maison absente de la carte : petit bâtiment de 10 m sur 8 dessiné à l'adresse.
function fakeBuilding([lng, lat]) {
  const dx = 5 / (111320 * Math.cos((lat * Math.PI) / 180))
  const dy = 4 / 111320
  return { height: 6, ring: [[lng - dx, lat - dy], [lng + dx, lat - dy], [lng + dx, lat + dy], [lng - dx, lat + dy], [lng - dx, lat - dy]] }
}

const PALE = { todo: '#c9d8e6', given: '#cddbc9', again: '#ecdcb6', refused: '#e5c4bc', empty: '#bdb9b0' }

// Bâtiments colorés des maisons (`houses` : entités de la couche des pastilles).
// Renvoie les maisons allumées (leurs pastilles peuvent être cachées) et une
// signature pour ne redessiner que si quelque chose a changé.
export function litHouses(map, houses, selectedId = null) {
  const src = buildingSource(map)
  const lit = new Set()
  const features = []
  if (!src || map.getZoom() < 14.5) return { lit, features, sig: '' }
  const cells = buildingIndex(map, src)
  const taken = new Map()
  for (const h of houses) {
    const b = findBuilding(cells, h.geometry.coordinates) ?? fakeBuilding(h.geometry.coordinates)
    lit.add(h.properties.houseId)
    // Un bâtiment partagé par plusieurs adresses : la plus urgente donne la couleur.
    const prev = taken.get(b)
    const selected = h.properties.houseId === selectedId
    if (prev && !selected && (prev.properties.selected || prev.properties.order >= h.properties.order)) continue
    const { status, focus } = h.properties
    const f = {
      type: 'Feature',
      properties: { ...h.properties, selected, height: b.height, color: selected ? SELECTED_COLOR : (focus ? LIT_COLORS : PALE)[status] ?? LIT_COLORS.todo },
      geometry: { type: 'Polygon', coordinates: [shrink(b.ring)] },
    }
    if (prev) features[features.indexOf(prev)] = f
    else features.push(f)
    taken.set(b, f)
  }
  const sig = features.map((f) => `${f.properties.houseId}:${f.properties.color}:${f.geometry.coordinates[0][0].join(',')}`).join('|')
  return { lit, features, sig }
}

export function drawLitHouses(map, features) {
  setGeoJSON(map, 'lit-houses', { type: 'FeatureCollection', features })
  if (map.getLayer('lit-houses')) return
  map.addLayer({
    id: 'lit-houses', type: 'fill-extrusion', source: 'lit-houses',
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['+', ['to-number', ['get', 'height'], 6], 0.6],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.95,
    },
  }, map.getLayer('houses') ? 'houses' : undefined) // sous les pastilles, pour que le nombre de logements reste visible
  // Les autres bâtiments passent en retrait, plus clairs.
  const src = buildingSource(map)
  if (src && map.getLayer(src.layerId)?.type === 'fill-extrusion') {
    map.setPaintProperty(src.layerId, 'fill-extrusion-color', OTHER_BUILDING)
    map.setPaintProperty(src.layerId, 'fill-extrusion-opacity', 0.5)
  }
}
