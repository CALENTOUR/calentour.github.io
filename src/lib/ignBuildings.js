// Bâtiments de l'IGN (BD TOPO, issue du cadastre, données ouvertes) : deuxième source,
// pour les maisons dont le bâtiment manque au fond de carte OpenStreetMap.
// Chargés par carreaux d'environ 1 km, gardés en mémoire le temps de la visite.

const WFS = 'https://data.geopf.fr/wfs/ows'
const TILE = 0.01 // degrés : taille d'un carreau
const CELL = 0.0004 // maille de l'index des bâtiments dans un carreau
export const MAX_DISTANCE = 25 // mètres entre l'adresse et le bâtiment le plus proche
const RETRY = 60_000 // un carreau en erreur est redemandé après une minute

const tiles = new Map() // clé -> { status: 'loading' | 'ok' | 'error', cells, at, promise }
const listeners = new Set()

export function ringBox(ring) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const [x, y] of ring) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y) }
  return { w, s, e, n }
}

export function insideRing([x, y], ring) {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

// Distance approximative (mètres) d'un point au bord d'un contour.
export function distToRing([x, y], ring) {
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

// Bâtiment contenant le point, sinon le plus proche à moins de MAX_DISTANCE.
export function nearestBuilding(cells, point) {
  const cx = Math.floor(point[0] / CELL)
  const cy = Math.floor(point[1] / CELL)
  let best = null
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (const b of cells.get(`${cx + i}:${cy + j}`) ?? []) {
        if (point[0] >= b.box.w && point[0] <= b.box.e && point[1] >= b.box.s && point[1] <= b.box.n && insideRing(point, b.ring)) return b
        const d = distToRing(point, b.ring)
        if (d <= MAX_DISTANCE && (!best || d < best.d)) best = { b, d }
      }
    }
  }
  return best?.b ?? null
}

export function addToIndex(cells, b) {
  for (let cx = Math.floor(b.box.w / CELL); cx <= Math.floor(b.box.e / CELL); cx++) {
    for (let cy = Math.floor(b.box.s / CELL); cy <= Math.floor(b.box.n / CELL); cy++) {
      const k = `${cx}:${cy}`
      if (!cells.has(k)) cells.set(k, [])
      cells.get(k).push(b)
    }
  }
}

const tileKey = (lng, lat) => `${Math.floor(lng / TILE)}:${Math.floor(lat / TILE)}`

async function fetchTile(key) {
  const [tx, ty] = key.split(':').map(Number)
  const [w, s, e, n] = [tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE]
  const params = new URLSearchParams({
    SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', TYPENAMES: 'BDTOPO_V3:batiment',
    SRSNAME: 'EPSG:4326', OUTPUTFORMAT: 'application/json', COUNT: '5000',
    // Même forme de requête que le comptage des logements (lib/logements.js).
    BBOX: `${w},${s},${e},${n},EPSG:4326`,
  })
  const res = await fetch(`${WFS}?${params}`)
  if (!res.ok) throw new Error(`IGN ${res.status}`)
  const cells = new Map()
  for (const f of (await res.json()).features ?? []) {
    const g = f.geometry
    const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []
    for (const poly of polys) {
      // Les coordonnées peuvent avoir une 3e valeur (altitude) : on ne garde que lng, lat.
      const ring = (poly[0] ?? []).map((p) => [p[0], p[1]])
      if (ring.length < 4) continue
      addToIndex(cells, { ring, box: ringBox(ring), height: Number(f.properties?.hauteur) || 6, ign: true })
    }
  }
  return cells
}

function loadTile(key) {
  const t = tiles.get(key)
  if (t && (t.status !== 'error' || Date.now() - t.at < RETRY)) return t.promise
  const entry = { status: 'loading', cells: new Map(), at: Date.now() }
  entry.promise = fetchTile(key)
    .then((cells) => Object.assign(entry, { status: 'ok', cells }))
    .catch((err) => {
      console.warn('Bâtiments IGN', err)
      Object.assign(entry, { status: 'error', at: Date.now() })
    })
    .then(() => listeners.forEach((cb) => cb()))
  tiles.set(key, entry)
  return entry.promise
}

const keysFor = (points) => [...new Set(points.map(([lng, lat]) => tileKey(lng, lat)))]

// Charge les carreaux qui couvrent ces points (au plus `max` à la fois, pour une vue trop large).
export function loadIgnFor(points, max = 16) {
  const keys = keysFor(points)
  if (keys.length > max) return Promise.resolve()
  return Promise.all(keys.map(loadTile))
}

// Carreaux d'une emprise de carte MapLibre.
export function loadIgnForBounds(bounds, max = 16) {
  const [w, s, e, n] = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
  const pts = []
  for (let x = Math.floor(w / TILE); x <= Math.floor(e / TILE); x++) {
    for (let y = Math.floor(s / TILE); y <= Math.floor(n / TILE); y++) pts.push([(x + 0.5) * TILE, (y + 0.5) * TILE])
  }
  return loadIgnFor(pts, max)
}

// Vrai quand la réponse de l'IGN est connue (ou en erreur) pour tous ces points.
export const ignSettled = (points) => keysFor(points).every((k) => ['ok', 'error'].includes(tiles.get(k)?.status))

export function ignBuildingAt(point) {
  const t = tiles.get(tileKey(point[0], point[1]))
  return t?.status === 'ok' ? nearestBuilding(t.cells, point) : null
}

export function onIgnLoaded(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// Maisons de toutes les tournées sans bâtiment à l'IGN (sans la carte) :
// pour l'onglet des réglages. Les maisons marquées « pas de bâtiment » sont ignorées.
export async function scanMissing(tours, onProgress) {
  const all = tours.flatMap((tour) => (tour.houses ?? []).filter((h) => !h.noBuilding && Number.isFinite(h.lng)).map((house) => ({ tour, house })))
  const keys = keysFor(all.map(({ house }) => [house.lng, house.lat]))
  let done = 0
  // Quatre carreaux à la fois.
  const queue = [...keys]
  const worker = async () => {
    while (queue.length) {
      await loadTile(queue.shift())
      onProgress?.(++done, keys.length)
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  const failed = keys.filter((k) => tiles.get(k)?.status !== 'ok').length
  const missing = all.filter(({ house }) => tiles.get(tileKey(house.lng, house.lat))?.status === 'ok' && !ignBuildingAt([house.lng, house.lat]))
  return { missing, failed, checked: all.length }
}
