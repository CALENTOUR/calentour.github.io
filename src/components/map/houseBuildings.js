// Maisons « allumées » : au lieu d'une pastille, le bâtiment de chaque maison
// (tiré du fond de carte OpenStreetMap) prend la couleur de son statut. Chaque
// bâtiment est un peu rétréci pour que deux maisons mitoyennes restent distinctes.
// Les maisons dont le bâtiment est introuvable gardent leur pastille.
import { setGeoJSON } from './useMapLibre'

export const LIT_COLORS = { todo: '#3f77ad', given: '#4f8a4c', again: '#d39b2a', refused: '#b8432f', empty: '#5e5a50' }
// Bâtiments sans adresse de la tournée (granges, garages, maisons d'autres rues).
export const OTHER_BUILDING = '#ebe6dc'
const SHRINK = 0.82 // part de la taille d'origine
const MAX_DISTANCE = 25 // mètres entre l'adresse et le bâtiment le plus proche
const CELL = 0.0004 // ~30 à 45 m : maille de l'index des bâtiments

// Couche des bâtiments du fond de carte : sa source, et sa couche dans les tuiles.
export function buildingSource(map) {
  const layer = (map.getStyle()?.layers ?? []).find((l) => l['source-layer'] === 'building' && l.source)
  if (!layer) return null
  const type = map.getSource(layer.source)?.type
  return { id: layer.source, query: type === 'vector' ? { sourceLayer: 'building' } : {}, layerId: layer.id }
}

function ringBox(ring) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const [x, y] of ring) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y) }
  return { w, s, e, n }
}

function inside([x, y], ring) {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

// Distance approximative (mètres) d'un point au bord d'un contour.
function distToRing([x, y], ring) {
  const kx = 111320 * Math.cos((y * Math.PI) / 180)
  const ky = 110540
  let best = Infinity
  for (let i = 1; i < ring.length; i++) {
    const ax = (ring[i - 1][0] - x) * kx, ay = (ring[i - 1][1] - y) * ky
    const bx = (ring[i][0] - x) * kx, by = (ring[i][1] - y) * ky
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
  }
  return best
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
      const b = { ring, box, height: f.properties?.render_height ?? f.properties?.height ?? 6 }
      for (let cx = Math.floor(box.w / CELL); cx <= Math.floor(box.e / CELL); cx++) {
        for (let cy = Math.floor(box.s / CELL); cy <= Math.floor(box.n / CELL); cy++) {
          const k = `${cx}:${cy}`
          if (!cells.has(k)) cells.set(k, [])
          cells.get(k).push(b)
        }
      }
    }
  }
  return cells
}

function findBuilding(cells, point) {
  const cx = Math.floor(point[0] / CELL)
  const cy = Math.floor(point[1] / CELL)
  let best = null
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (const b of cells.get(`${cx + i}:${cy + j}`) ?? []) {
        if (point[0] >= b.box.w && point[0] <= b.box.e && point[1] >= b.box.s && point[1] <= b.box.n && inside(point, b.ring)) return b
        const d = distToRing(point, b.ring)
        if (d <= MAX_DISTANCE && (!best || d < best.d)) best = { b, d }
      }
    }
  }
  return best?.b ?? null
}

const PALE = { todo: '#c9d8e6', given: '#cddbc9', again: '#ecdcb6', refused: '#e5c4bc', empty: '#bdb9b0' }

// Bâtiments colorés des maisons (`houses` : entités de la couche des pastilles).
// Renvoie les maisons allumées (leurs pastilles peuvent être cachées) et une
// signature pour ne redessiner que si quelque chose a changé.
export function litHouses(map, houses) {
  const src = buildingSource(map)
  const lit = new Set()
  const features = []
  if (!src || map.getZoom() < 14.5) return { lit, features, sig: '' }
  const cells = buildingIndex(map, src)
  const taken = new Map()
  for (const h of houses) {
    const b = findBuilding(cells, h.geometry.coordinates)
    if (!b) continue
    lit.add(h.properties.houseId)
    // Un bâtiment partagé par plusieurs adresses : la plus urgente donne la couleur.
    const prev = taken.get(b)
    if (prev && prev.properties.order >= h.properties.order) continue
    const { status, focus } = h.properties
    const f = {
      type: 'Feature',
      properties: { ...h.properties, height: b.height, color: (focus ? LIT_COLORS : PALE)[status] ?? LIT_COLORS.todo },
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
  })
  // Les autres bâtiments passent en retrait, plus clairs.
  const src = buildingSource(map)
  if (src && map.getLayer(src.layerId)?.type === 'fill-extrusion') {
    map.setPaintProperty(src.layerId, 'fill-extrusion-color', OTHER_BUILDING)
    map.setPaintProperty(src.layerId, 'fill-extrusion-opacity', 0.5)
  }
}
