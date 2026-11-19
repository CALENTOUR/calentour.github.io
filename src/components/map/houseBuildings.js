// Maisons « allumées » : au lieu d'une pastille, le bâtiment de chaque maison
// (tiré du fond de carte OpenStreetMap) prend la couleur de son statut. Chaque
// bâtiment est un peu rétréci pour que deux maisons mitoyennes restent distinctes.
// Bâtiment absent d'OpenStreetMap : on prend celui de l'IGN (lib/ignBuildings.js).
import maplibregl from 'maplibre-gl'
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

// --- Bâtiment à plusieurs adresses (5 et 5 bis) : une part par adresse. ---
// Calculs dans un repère local en mètres, pour que les distances soient justes.
const toLocal = (lat0) => {
  const kx = Math.cos((lat0 * Math.PI) / 180)
  return { to: ([x, y]) => [x * kx, y], from: ([x, y]) => [x / kx, y] }
}
const area = (ring) => {
  let a = 0
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  return Math.abs(a) / 2
}
// Garde la partie du contour où (p - o) · d <= 0 (Sutherland-Hodgman sur un demi-plan).
function clip(ring, o, d) {
  const side = (p) => (p[0] - o[0]) * d[0] + (p[1] - o[1]) * d[1]
  const out = []
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1]
    const sa = side(a), sb = side(b)
    if (sa <= 0) out.push(a)
    if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
      const t = sa / (sa - sb)
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
    }
  }
  if (out.length < 3) return null
  out.push(out[0])
  return out
}
// Chaque adresse prend la partie du bâtiment plus proche d'elle que des autres.
function splitByAddress(ring, points) {
  const parts = []
  for (let i = 0; i < points.length; i++) {
    let part = ring
    for (let j = 0; j < points.length && part; j++) {
      if (i === j) continue
      const a = points[i], b = points[j]
      const d = [b[0] - a[0], b[1] - a[1]]
      if (!d[0] && !d[1]) return null // deux adresses au même point
      part = clip(part, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d)
    }
    parts.push(part)
  }
  return parts
}
// Secours : tranches égales le long du grand côté, dans l'ordre des adresses.
function splitInSlices(ring, points) {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1])
  const w = Math.max(...xs) - Math.min(...xs), hgt = Math.max(...ys) - Math.min(...ys)
  const axis = w >= hgt ? [1, 0] : [0, 1]
  const proj = (p) => p[0] * axis[0] + p[1] * axis[1]
  const lo = Math.min(...ring.map(proj)), hi = Math.max(...ring.map(proj))
  const n = points.length
  const order = points.map((p, i) => i).sort((i, j) => proj(points[i]) - proj(points[j]) || i - j)
  const parts = new Array(n)
  order.forEach((idx, k) => {
    let part = clip(ring, [axis[0] * (lo + ((k + 1) * (hi - lo)) / n), axis[1] * (lo + ((k + 1) * (hi - lo)) / n)], axis)
    if (part) part = clip(part, [axis[0] * (lo + (k * (hi - lo)) / n), axis[1] * (lo + (k * (hi - lo)) / n)], [-axis[0], -axis[1]])
    parts[idx] = part
  })
  return parts
}
export function splitBuilding(ring, points) {
  if (points.length < 2) return [ring]
  const lat0 = ring[0][1]
  const L = toLocal(lat0)
  const r = ring.map(L.to)
  const pts = points.map(L.to)
  const total = area(r) || 1
  // Une part vide ou minuscule (adresses toutes du même côté) : on coupe en tranches.
  const ok = (parts) => parts && parts.every((x) => x && area(x) > total * 0.12)
  let parts = splitByAddress(r, pts)
  if (!ok(parts)) parts = splitInSlices(r, pts)
  if (!ok(parts)) return null
  return parts.map((x) => x.map(L.from))
}

// Bâtiments colorés des maisons (`houses` : entités de la couche des pastilles).
// Un bâtiment partagé par plusieurs adresses est coupé en parts, chacune de la
// couleur de son adresse, pour voir le statut de chacune.
// Renvoie les maisons allumées (leurs pastilles peuvent être cachées) et une
// signature pour ne redessiner que si quelque chose a changé.
export function litHouses(map, houses, selectedId = null) {
  const src = buildingSource(map)
  const lit = new Set()
  const features = []
  if (!src || map.getZoom() < 14.5) return { lit, features, sig: '' }
  const cells = buildingIndex(map, src)
  const groups = new Map()
  for (const h of houses) {
    const b = findBuilding(cells, h.geometry.coordinates) ?? fakeBuilding(h.geometry.coordinates)
    if (!groups.has(b)) groups.set(b, [])
    groups.get(b).push(h)
  }
  const feature = (h, b, ring, split, numbers) => {
    const selected = h.properties.houseId === selectedId
    const { status, focus, units, unitsDone } = h.properties
    return {
      type: 'Feature',
      properties: {
        ...h.properties, selected, split, height: b.height,
        tag: units ? `${unitsDone}/${units}` : '',
        num: numbers ?? String(h.properties.label ?? ''),
        color: selected ? SELECTED_COLOR : (focus ? LIT_COLORS : PALE)[status] ?? LIT_COLORS.todo,
      },
      geometry: { type: 'Polygon', coordinates: [shrink(ring)] },
    }
  }
  for (const [b, list] of groups) {
    const parts = list.length > 1 ? splitBuilding(b.ring, list.map((h) => h.geometry.coordinates)) : null
    if (parts) {
      list.forEach((h, i) => { lit.add(h.properties.houseId); features.push(feature(h, b, parts[i], 1)) })
      continue
    }
    // Bâtiment impossible à couper : l'adresse la plus urgente donne la couleur.
    let win = list[0]
    for (const h of list) {
      if (h.properties.houseId === selectedId) { win = h; break }
      if (h.properties.order > win.properties.order) win = h
    }
    for (const h of list) lit.add(h.properties.houseId)
    // Toutes ses adresses restent écrites dessus (« 5 · 5 bis »).
    const numbers = [...new Set(list.map((h) => String(h.properties.label ?? '')).filter(Boolean))].join(' · ')
    features.push(feature(win, b, b.ring, 0, numbers))
  }
  const sig = features.map((f) => `${f.properties.houseId}:${f.properties.color}:${f.properties.tag}:${f.geometry.coordinates[0][0].join(',')}`).join('|')
  return { lit, features, sig }
}

// Point où écrire le numéro : le centre du bâtiment, ou, s'il tombe dehors (bâtiment
// en L, en U), le point du bâtiment le plus éloigné de ses bords.
function inRing(ring, x, y) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function edgeDistance(ring, x, y, k) {
  let best = Infinity
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0] * k, ay = ring[j][1], bx = ring[i][0] * k, by = ring[i][1]
    const dx = bx - ax, dy = by - ay
    const t = dx || dy ? Math.max(0, Math.min(1, ((x * k - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0
    best = Math.min(best, Math.hypot(x * k - ax - t * dx, y - ay - t * dy))
  }
  return best
}
export function labelPoint(ring) {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
    a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f
  }
  if (a && inRing(ring, cx / (3 * a), cy / (3 * a))) return [cx / (3 * a), cy / (3 * a)]
  const k = Math.cos((ring[0][1] * Math.PI) / 180) // longitude ramenée à la même échelle que la latitude
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const [x, y] of ring) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y) }
  let best = ring[0], bestD = -1
  const N = 10
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = w + ((e - w) * i) / N, y = s + ((n - s) * j) / N
      if (!inRing(ring, x, y)) continue
      const d = edgeDistance(ring, x, y, k)
      if (d > bestD) { bestD = d; best = [x, y] }
    }
  }
  return best
}

// Numéros écrits au milieu des bâtiments allumés.
const M_PER_DEG = 111320
// Surface d'un contour, en m².
function ringArea(ring) {
  const k = Math.cos((ring[0][1] * Math.PI) / 180)
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * k * ring[i][1] - ring[i][0] * k * ring[j][1]
  return Math.abs(a / 2) * M_PER_DEG * M_PER_DEG
}
// Taille de texte (px, au zoom 16) pour que le numéro tienne dans la maison : largeur
// utile ≈ 0,8 × côté du bâtiment, un chiffre ≈ 0,62 de la taille du texte.
function fitAt16(f) {
  const ring = f.geometry.coordinates[0]
  const side = Math.sqrt(ringArea(ring)) * 0.8
  const lines = [String(f.properties.num ?? '').length, f.properties.tag ? (f.properties.tag.length + 5) * 0.5 : 0]
  const em = Math.max(1, ...lines) * 0.62
  const pxPerM16 = (512 * 2 ** 16) / (40075016.686 * Math.cos((ring[0][1] * Math.PI) / 180))
  return Math.round(((side / em) * pxPerM16) * 100) / 100
}

// Bases des numéros (point au sol, hauteur du toit), gardées pour les replacer
// quand la caméra bouge.
const numberBases = new WeakMap()

// En 3D, un numéro posé au sol tomberait au pied de la maison : on le place là où
// le centre du toit se voit à l'écran (point au sol aligné avec la caméra et le toit).
function placeNumbers(map) {
  const bases = numberBases.get(map) ?? []
  const tr = map.transform
  const flat = map.getPitch() < 3 || !tr?.getCameraLngLat || !tr?.getCameraAltitude
  let cam = null
  if (!flat) {
    try { cam = maplibregl.MercatorCoordinate.fromLngLat(tr.getCameraLngLat(), tr.getCameraAltitude()) } catch { cam = null }
  }
  const features = bases.map(({ properties, point, roof }) => {
    let coordinates = point
    if (cam) {
      const p = maplibregl.MercatorCoordinate.fromLngLat(point, roof)
      if (cam.z > p.z * 1.05) {
        const t = cam.z / (cam.z - p.z)
        const g = new maplibregl.MercatorCoordinate(cam.x + (p.x - cam.x) * t, cam.y + (p.y - cam.y) * t, 0).toLngLat()
        coordinates = [g.lng, g.lat]
      }
    }
    return { type: 'Feature', properties, geometry: { type: 'Point', coordinates } }
  })
  setGeoJSON(map, 'lit-numbers', { type: 'FeatureCollection', features })
}

function setNumberBases(map, features) {
  numberBases.set(map, features.filter((f) => f.properties.num || f.properties.tag).map((f) => ({
    properties: {
      houseId: f.properties.houseId, num: f.properties.num, tag: f.properties.tag ? `${f.properties.tag} log.` : '',
      order: f.properties.order ?? 0, focus: f.properties.focus ?? 1, fit: fitAt16(f),
    },
    point: labelPoint(f.geometry.coordinates[0]),
    roof: (Number(f.properties.height) || 6) + 0.6,
  })))
}

// Numéro en gras ; logements faits sur total (« 4/9 log. ») en dessous, plus petit et
// en gris, pour ne pas le prendre pour un numéro.
const UNITS_GREY = '#3d4642'
const UNITS_STYLE = { 'font-scale': 0.62, 'text-color': UNITS_GREY, 'text-font': ['literal', ['Noto Sans Regular']] }
const NUMBER_TEXT = ['case', ['==', ['get', 'tag'], ''], ['get', 'num'],
  ['==', ['get', 'num'], ''], ['format', ['get', 'tag'], UNITS_STYLE],
  ['format', ['get', 'num'], {}, '\n', {}, ['get', 'tag'], UNITS_STYLE]]
// Taille selon le zoom, réduite si la maison est trop petite à l'écran pour la contenir
// (jamais sous 11 px, sinon illisible).
const SIZE_BY_ZOOM = [[16, 13], [17, 16], [18, 19], [19, 21], [20, 22], [22, 22]]
export const NUMBER_SIZE = ['interpolate', ['linear'], ['zoom'],
  ...SIZE_BY_ZOOM.flatMap(([z, px]) => [z, ['max', 11, ['min', px, ['*', ['get', 'fit'], 2 ** (z - 16)]]]])]

function watchCamera(map) {
  let timer = 0, last = 0, tilted = false
  const run = () => { last = Date.now(); timer = 0; tilted = map.getPitch() >= 3; placeNumbers(map) }
  // Pendant un geste : au plus toutes les 120 ms ; à la fin : tout de suite.
  map.on('move', () => {
    if (map.getPitch() < 3 && !tilted) return
    if (timer) return
    timer = setTimeout(run, Math.max(0, 120 - (Date.now() - last)))
  })
  map.on('moveend', () => { clearTimeout(timer); run() })
}

export function drawLitHouses(map, features) {
  setGeoJSON(map, 'lit-houses', { type: 'FeatureCollection', features })
  setNumberBases(map, features)
  placeNumbers(map)
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
  // Numéro de la maison au milieu de son bâtiment ; pour un immeuble, logements faits
  // sur total (« 2/4 ») en dessous. Deux numéros qui se chevauchent : le plus urgent
  // reste, l'autre revient en zoomant.
  map.addLayer({
    id: 'lit-tags', type: 'symbol', source: 'lit-numbers', minzoom: 16,
    layout: {
      'text-field': NUMBER_TEXT, 'text-font': ['Noto Sans Bold'], 'text-size': NUMBER_SIZE,
      'text-line-height': 1.05, 'text-anchor': 'center', 'text-padding': 1,
      'text-allow-overlap': false, 'symbol-sort-key': ['-', 0, ['get', 'order']],
      'text-pitch-alignment': 'viewport', 'text-rotation-alignment': 'viewport',
    },
    paint: { 'text-color': '#1f2a24', 'text-halo-color': '#ffffff', 'text-halo-width': 2, 'text-opacity': ['case', ['>', ['get', 'focus'], 0], 1, 0.45] },
  })
  watchCamera(map)
  // Les autres bâtiments passent en retrait, plus clairs.
  const src = buildingSource(map)
  if (src && map.getLayer(src.layerId)?.type === 'fill-extrusion') {
    map.setPaintProperty(src.layerId, 'fill-extrusion-color', OTHER_BUILDING)
    map.setPaintProperty(src.layerId, 'fill-extrusion-opacity', 0.5)
  }
}
