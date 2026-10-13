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
