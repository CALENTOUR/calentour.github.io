// Recale un tracé fait à main levée sur les routes de la carte (tuiles OpenStreetMap
// déjà chargées) : chaque point touché est ramené sur la route la plus proche, et deux
// points successifs sont reliés par le plus court chemin le long des routes.
import { distance, projectOnLine } from '../../lib/geo'

const SNAP = 45 // mètres : au-delà, le point est gardé tel quel
const IGNORED = new Set(['rail', 'transit', 'ferry', 'aerialway'])
const nodeKey = ([lng, lat]) => `${Math.round(lng * 1e5)},${Math.round(lat * 1e5)}`

function parts(feature) {
  const g = feature.geometry
  if (g.type === 'LineString') return [g.coordinates]
  if (g.type === 'MultiLineString') return g.coordinates
  return []
}

// Graphe des routes autour du tracé.
export function roadGraph(map, points, margin = 0.004) {
  const source = Object.entries(map.getStyle().sources).find(([, s]) => s.type === 'vector')?.[0]
  const nodes = new Map()
  const edges = new Map()
  const segments = []
  if (!source || !points.length) return { nodes, edges, segments }
  const w = Math.min(...points.map((p) => p[0])) - margin * 1.5
  const e = Math.max(...points.map((p) => p[0])) + margin * 1.5
  const s = Math.min(...points.map((p) => p[1])) - margin
  const n = Math.max(...points.map((p) => p[1])) + margin
  const inside = ([lng, lat]) => lng >= w && lng <= e && lat >= s && lat <= n

  const link = (a, b, ka, kb) => {
    const d = distance(a, b)
    if (!d) return
    if (!edges.has(ka)) edges.set(ka, new Map())
    if (!edges.has(kb)) edges.set(kb, new Map())
    edges.get(ka).set(kb, d)
    edges.get(kb).set(ka, d)
  }
  const seen = new Set()
  for (const f of map.querySourceFeatures(source, { sourceLayer: 'transportation' })) {
    if (IGNORED.has(f.properties?.class)) continue
    for (const line of parts(f)) {
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1]
        const b = line[i]
        if (!inside(a) && !inside(b)) continue
        const ka = nodeKey(a)
        const kb = nodeKey(b)
        if (ka === kb) continue
        const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
        if (seen.has(id)) continue
        seen.add(id)
        nodes.set(ka, a)
        nodes.set(kb, b)
        link(a, b, ka, kb)
        segments.push([ka, kb])
      }
    }
  }
  return { nodes, edges, segments }
}

// Point de route le plus proche : segment, position projetée et distance.
function snap(graph, point) {
  let best = null
  for (const [ka, kb] of graph.segments) {
    const a = graph.nodes.get(ka)
    const b = graph.nodes.get(kb)
    const proj = projectOnLine(point, [a, b])
    if (proj.dist > SNAP || (best && proj.dist >= best.dist)) continue
    const len = distance(a, b)
    const t = len ? Math.min(1, proj.along / len) : 0
    best = { ka, kb, t, len, dist: proj.dist, at: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] }
  }
  return best
}

// Plus court chemin entre deux points recalés (Dijkstra, tas binaire).
function route(graph, from, to, limit) {
  if ((from.ka === to.ka && from.kb === to.kb) || (from.ka === to.kb && from.kb === to.ka)) return [from.at, to.at]
  const START = '#start'
  const END = '#end'
  const extra = new Map([
    [START, new Map([[from.ka, from.t * from.len], [from.kb, (1 - from.t) * from.len]])],
  ])
  const toEnd = new Map([[to.ka, to.t * to.len], [to.kb, (1 - to.t) * to.len]])
  const neighbours = (k) => {
    const list = [...(extra.get(k) ?? graph.edges.get(k) ?? new Map())]
    if (toEnd.has(k)) list.push([END, toEnd.get(k)])
    return list
  }
  const dist = new Map([[START, 0]])
  const prev = new Map()
  const heap = [[0, START]]
  const push = (item) => {
    heap.push(item)
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p][0] <= heap[i][0]) break
      ;[heap[p], heap[i]] = [heap[i], heap[p]]
      i = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i], heap[m]]
        i = m
      }
    }
    return top
  }
  while (heap.length) {
    const [d, k] = pop()
    if (d > (dist.get(k) ?? Infinity)) continue
    if (k === END) break
    if (d > limit) return null
    for (const [nk, w] of neighbours(k)) {
      const nd = d + w
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd)
        prev.set(nk, k)
        push([nd, nk])
      }
    }
  }
  if (!prev.has(END)) return null
  const path = []
  for (let k = prev.get(END); k && k !== START; k = prev.get(k)) path.unshift(graph.nodes.get(k))
  return [from.at, ...path, to.at]
}

// Renvoie le tracé recalé sur les routes (ou le tracé d'origine là où il n'y a pas de route).
// Les points du début ou de la fin trop loin de toute route (on a dépassé) sont retirés.
export function snapToRoads(map, rawPoints, graph = roadGraph(map, rawPoints)) {
  if (rawPoints.length < 2 || !graph.segments.length) return rawPoints
  const all = rawPoints.map((p) => snap(graph, p))
  const first = all.findIndex(Boolean)
  const last = all.findLastIndex(Boolean)
  const trim = first >= 0 && last > first
  const points = trim ? rawPoints.slice(first, last + 1) : rawPoints
  const snapped = trim ? all.slice(first, last + 1) : all
  const out = []
  const add = (pt) => {
    const last = out[out.length - 1]
    if (!last || distance(last, pt) > 0.5) out.push(pt)
  }
  for (let i = 1; i < points.length; i++) {
    const a = snapped[i - 1]
    const b = snapped[i]
    const straight = distance(points[i - 1], points[i])
    const path = a && b ? route(graph, a, b, Math.max(3 * straight, straight + 300)) : null
    if (path) path.forEach(add)
    else {
      add(a?.at ?? points[i - 1])
      add(b?.at ?? points[i])
    }
  }
  return out.length > 1 ? out : rawPoints
}
