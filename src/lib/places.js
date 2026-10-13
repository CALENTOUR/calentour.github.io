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
    out[id] = { ...x, village, full: village ? `${village} : ${x.street}` : x.street }
  }
  return out
}
