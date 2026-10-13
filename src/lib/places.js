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

// Villages traversés par les tournées (d'après les adresses des maisons), avec leur
// emprise pour y aller d'un geste. Classés par nombre de maisons.
export function villagesOf(tours) {
  const byName = new Map()
  for (const t of tours) {
    for (const h of t.houses ?? []) {
      if (!h.city) continue
      const v = byName.get(h.city) ?? { name: h.city, count: 0, w: 180, e: -180, s: 90, n: -90 }
      v.count++
      v.w = Math.min(v.w, h.lng); v.e = Math.max(v.e, h.lng)
      v.s = Math.min(v.s, h.lat); v.n = Math.max(v.n, h.lat)
      byName.set(h.city, v)
    }
  }
  return [...byName.values()]
    .sort((a, b) => b.count - a.count)
    .map((v) => ({ name: v.name, count: v.count, bounds: [[v.w, v.s], [v.e, v.n]] }))
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
