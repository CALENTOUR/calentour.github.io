import { bounds, distance, unflatten } from './geo'

// Nom affiché des rues d'une tournée. Quand une tournée passe par plusieurs
// villages, le village précède la rue : « DOMPAIRE : Rue de la Gare ».

const mostCommon = (values) => {
  const count = new Map()
  for (const v of values) if (v) count.set(v, (count.get(v) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

export function pieceLabels(tour) {
  const raw = {}
  for (const p of tour?.pieces ?? []) {
    // Les rues nommées d'après la Base Adresse s'appellent « Rue · Village ».
    const [street, suffix] = p.name.split(' · ')
    const village = mostCommon((tour.houses ?? []).filter((h) => h.pieceId === p.id).map((h) => h.city)) || suffix || ''
    raw[p.id] = { street: suffix ? street : p.name, village }
  }
  const several = new Set(Object.values(raw).map((x) => x.village).filter(Boolean)).size > 1
  const out = {}
  for (const [id, x] of Object.entries(raw)) {
    const village = several ? x.village.toUpperCase() : ''
    // `place` : le village même quand la tournée n'en traverse qu'un.
    out[id] = { ...x, village, place: x.village, full: village ? `${village} : ${x.street}` : x.street }
  }
  return out
}

// Villages traversés par les tournées (d'après les adresses des maisons), classés
// par nombre de maisons. Leur emprise ne garde que le cœur du village : quelques
// adresses rattachées à la commune mais loin de son bourg (écart, adresse mal
// placée, rue en limite de commune) ne doivent pas tirer le zoom ailleurs.
export function villagesOf(tours) {
  const byName = new Map()
  for (const t of tours) {
    for (const h of t.houses ?? []) {
      if (!h.city || !Number.isFinite(h.lng) || !Number.isFinite(h.lat)) continue
      byName.set(h.city, [...(byName.get(h.city) ?? []), [h.lng, h.lat]])
    }
  }
  return [...byName.entries()]
    .map(([name, pts]) => {
      const core = villageCore(pts)
      return { name, count: pts.length, points: core, bounds: bounds(core), outline: hullPolygon(core, 70) }
    })
    .sort((a, b) => b.count - a.count)
}

// Groupes de maisons à moins de `gap` mètres de proche en proche. On garde le plus
// gros (le bourg), et les autres seulement s'ils sont gros et tout près (village en
// deux parties) : un écart ou une rue loin du bourg ne compte pas.
function villageCore(pts, gap = 250) {
  const cell = gap / 111000
  const grid = new Map()
  pts.forEach((q, i) => {
    const k = `${Math.floor(q[0] / cell)}:${Math.floor(q[1] / cell)}`
    grid.set(k, [...(grid.get(k) ?? []), i])
  })
  const parent = pts.map((_, i) => i)
  const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])))
  pts.forEach((q, i) => {
    const cx = Math.floor(q[0] / cell), cy = Math.floor(q[1] / cell)
    for (let a = -2; a <= 2; a++) {
      for (let b = -1; b <= 1; b++) {
        for (const j of grid.get(`${cx + a}:${cy + b}`) ?? []) {
          if (j > i && root(i) !== root(j) && distance(q, pts[j]) <= gap) parent[root(j)] = root(i)
        }
      }
    }
  })
  const groups = new Map()
  pts.forEach((q, i) => groups.set(root(i), [...(groups.get(root(i)) ?? []), q]))
  const sorted = [...groups.values()].sort((a, b) => b.length - a.length)
  const mid = (g) => [g.reduce((t, q) => t + q[0], 0) / g.length, g.reduce((t, q) => t + q[1], 0) / g.length]
  const heart = mid(sorted[0])
  return sorted.filter((g, i) => i === 0 || (g.length * 3 >= sorted[0].length && distance(mid(g), heart) <= 1000)).flat()
}

// Contour arrondi autour de points : enveloppe convexe élargie de `margin` mètres.
export function hullPolygon(pts, margin = 60) {
  if (!pts.length) return null
  const lat = pts[0][1]
  const kx = 111320 * Math.cos((lat * Math.PI) / 180)
  const ky = 110540
  const ring = []
  for (const [x, y] of pts) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 2 * Math.PI
      ring.push([x + (Math.cos(a) * margin) / kx, y + (Math.sin(a) * margin) / ky])
    }
  }
  // Enveloppe convexe (chaîne monotone).
  ring.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list) => {
    const out = []
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop()
      out.push(q)
    }
    out.pop()
    return out
  }
  const hull = [...half(ring), ...half([...ring].reverse())]
  return { type: 'Polygon', coordinates: [[...hull, hull[0]]] }
}

// Secteurs d'une tournée : ses rues regroupées par endroit (rues à moins de
// `gap` mètres l'une de l'autre). Chacun porte le nom du ou des villages qu'il
// traverse, son emprise et un cercle qui l'entoure sur la carte.
export function tourAreas(tour, gap = 350) {
  const labels = pieceLabels(tour)
  const pieces = (tour?.pieces ?? []).map((p) => ({ p, pts: p.lines.flatMap((l) => unflatten(l.c)) })).filter((x) => x.pts.length)
  // Points espacés d'au plus ~50 m pour comparer les rues sans tout comparer à tout.
  const sparse = pieces.map((x) => x.pts.filter((_, i) => i % Math.max(1, Math.floor(x.pts.length / 40)) === 0).concat([x.pts[x.pts.length - 1]]))
  const parent = pieces.map((_, i) => i)
  const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])))
  const near = (a, b) => a.some((u) => b.some((v) => distance(u, v) <= gap))
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) if (root(i) !== root(j) && near(sparse[i], sparse[j])) parent[root(j)] = root(i)
  }
  const groups = new Map()
  pieces.forEach((x, i) => groups.set(root(i), [...(groups.get(root(i)) ?? []), x]))
  const areas = [...groups.values()].map((list) => {
    const pts = list.flatMap((x) => x.pts)
    const b = bounds(pts)
    const center = [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]
    const radius = Math.max(60, ...pts.map((q) => distance(center, q))) + 60
    // Nom : les villages traversés, du plus présent au moins présent.
    const count = new Map()
    for (const x of list) {
      const v = labels[x.p.id]?.place
      if (v) count.set(v, (count.get(v) ?? 0) + x.pts.length)
    }
    const names = [...count.entries()].sort((a, c) => c[1] - a[1]).map(([v]) => v)
    return { name: names.slice(0, 2).join(' · ') || 'Secteur', pieceIds: list.map((x) => x.p.id), bounds: b, center, radius, order: tour.pieces.findIndex((p) => p.id === list[0].p.id) }
  })
  areas.sort((a, c) => a.order - c.order)
  // Deux secteurs au même nom : on les numérote.
  const seen = new Map()
  for (const a of areas) seen.set(a.name, (seen.get(a.name) ?? 0) + 1)
  const n = new Map()
  return areas.map((a, i) => {
    const k = (n.get(a.name) ?? 0) + 1
    n.set(a.name, k)
    return { ...a, id: `a${i}`, name: seen.get(a.name) > 1 ? `${a.name} ${k}` : a.name }
  })
}

// Cercle (polygone) de `radius` mètres autour d'un point, pour entourer un secteur.
export function circlePolygon([lng, lat], radius, steps = 48) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180)
  const ky = 110540
  const ring = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI
    return [lng + (Math.cos(a) * radius) / kx, lat + (Math.sin(a) * radius) / ky]
  })
  return { type: 'Polygon', coordinates: [ring] }
}
