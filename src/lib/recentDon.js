import { distance } from './geo'

// Un don vient d'être noté par le même binôme sur une maison voisine (même
// bâtiment, à quelques mètres) ou du même montant : c'est souvent le même don
// saisi deux fois, parce que la carte a ouvert l'adresse d'à côté au deuxième toucher.
// Même bâtiment : 3 minutes. Maison voisine ou même montant : 1 minute (deux vrais
// dons à la suite sont espacés d'au moins deux minutes, le temps de sonner chez le voisin).
const SAME_BUILDING_MS = 3 * 60 * 1000
const RECENT_MS = 60 * 1000
const NEAR_M = 40
const dwellingKey = (houseId, unitId) => (unitId ? `${houseId}__${unitId}` : houseId)

export function findRecentDon({ tour, h, key, house, user, amount, now = Date.now() }) {
  if (!tour || !house || !user?.uid) return null
  let best = null
  for (const x of tour.houses) {
    const keys = x.units?.length ? x.units.map((u) => [dwellingKey(x.id, u.id), u]) : [[dwellingKey(x.id), null]]
    for (const [k, unit] of keys) {
      if (k === key) continue
      const e = h?.[k]
      if (e?.s !== 'given' || e.by !== user.uid) continue
      const ago = now - Date.parse(e.at)
      if (!(ago >= 0 && ago <= SAME_BUILDING_MS)) continue
      const sameBuilding = x.id === house.id || Boolean(house.bdnb && x.bdnb === house.bdnb)
      if (!sameBuilding) {
        if (ago > RECENT_MS) continue
        const near = distance([x.lng, x.lat], [house.lng, house.lat]) <= NEAR_M
        if (!near && Number(e.amount) !== Number(amount)) continue
      }
      if (!best || ago < best.ago) best = { key: k, house: x, unit, entry: e, ago, sameBuilding }
    }
  }
  return best
}

export function agoText(ms) {
  const s = Math.max(1, Math.round(ms / 1000))
  if (s < 60) return `il y a ${s} s`
  return `il y a ${Math.round(s / 60)} min`
}
