// Construction d'une tournée : rattachement des maisons aux rues, noms des rues.
import { fetchHousesAlongPieces } from './addresses'
import { newId } from './format'
import { projectOnLine, unflatten } from './geo'

const isDefaultName = (name) => /^Morceau \d+$/.test(name ?? '')

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

// Cherche les maisons le long des rues d'une tournée et les ajoute à celles déjà connues.
export async function findHouses(tour, onProgress) {
  const lines = tour.pieces.flatMap((p) => p.lines.map((l) => ({ id: p.id, line: unflatten(l.c) })))
  const { houses: found, pieceNames } = await fetchHousesAlongPieces(lines, onProgress)

  const known = new Set((tour.houses ?? []).map((h) => h.banId).filter(Boolean))
  const added = found
    .filter((h) => !known.has(h.banId))
    .map((h) => ({ id: newId().slice(0, 12), ...h }))

  const pieces = tour.pieces.map((p) => (isDefaultName(p.name) && pieceNames[p.id] ? { ...p, name: pieceNames[p.id] } : p))
  const merged = mergeSameName(pieces, [...(tour.houses ?? []), ...added])
  return { ...merged, addedCount: added.length }
}
