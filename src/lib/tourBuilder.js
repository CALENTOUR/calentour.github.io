// Construction d'une tournée : rattachement des maisons aux rues, noms des rues.
import { fetchHousesAlongPieces } from './addresses'
import { newId } from './format'
import { projectOnLine, unflatten } from './geo'

const isDefaultName = (name) => /^(Morceau|Rue tracée) \d+$/.test(name ?? '')

// Rue la plus proche d'un point, et position le long de cette rue (pour l'ordre de visite).
export function locateOnPieces(lng, lat, pieces) {
  let best = null
  for (const p of pieces) {
    p.lines.forEach((l, i) => {
      const proj = projectOnLine([lng, lat], unflatten(l.c))
      if (!best || proj.dist < best.dist) best = { pieceId: p.id, dist: proj.dist, along: Math.round(i * 100000 + proj.along) }
    })
  }
  return best
}

// Les morceaux qui portent le même nom de rue deviennent un seul sous-onglet.
export function mergeSameName(pieces, houses) {
  const byName = new Map()
  const remap = {}
  const out = []
  for (const p of pieces) {
    const key = p.name.trim().toLowerCase()
    const first = byName.get(key)
    if (first && !isDefaultName(p.name)) {
      first.lines = [...first.lines, ...p.lines]
      remap[p.id] = first.id
    } else {
      const copy = { ...p, lines: [...p.lines] }
      byName.set(key, copy)
      out.push(copy)
    }
  }
  const relocated = houses.map((h) => {
    const pieceId = remap[h.pieceId] ?? h.pieceId
    const loc = locateOnPieces(h.lng, h.lat, out.filter((p) => p.id === pieceId))
    return { ...h, pieceId, along: loc?.along ?? h.along ?? 0 }
  })
  return { pieces: out, houses: relocated }
}

// Cherche les maisons le long de traits de rue ([{ id: pieceId, line }]).
export async function searchHouses(lines, onProgress) {
  const { houses, pieceNames } = await fetchHousesAlongPieces(lines, onProgress)
  return { found: houses, pieceNames }
}

// Ajoute à une tournée les maisons trouvées qu'elle n'a pas encore, et nomme ses rues.
export function addFoundHouses(tour, found, pieceNames) {
  // Les adresses retirées par la vérification (doublon, dépendance, autre tournée) ne reviennent pas.
  const known = new Set([...(tour.houses ?? []).map((h) => h.banId).filter(Boolean), ...(tour.skipBan ?? [])])
  const ids = new Set(tour.pieces.map((p) => p.id))
  const added = found
    .filter((h) => !known.has(h.banId) && ids.has(h.pieceId))
    .map((h) => ({ id: newId().slice(0, 12), ...h }))
  const pieces = tour.pieces.map((p) => (isDefaultName(p.name) && pieceNames[p.id] ? { ...p, name: pieceNames[p.id] } : p))
  const merged = mergeSameName(pieces, [...(tour.houses ?? []), ...added])
  return { ...merged, addedCount: added.length }
}

// Cherche les maisons le long de toutes les rues d'une tournée.
export async function findHouses(tour, onProgress) {
  const lines = tour.pieces.flatMap((p) => p.lines.map((l) => ({ id: p.id, line: unflatten(l.c) })))
  const { found, pieceNames } = await searchHouses(lines, onProgress)
  return addFoundHouses(tour, found, pieceNames)
}
