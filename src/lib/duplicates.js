import { distance } from './geo'
import { dwellingKey } from '../services/state'

// Maisons en double : une maison ajoutée à la main par un binôme (« Maison non répertoriée »)
// alors que la même adresse était déjà dans une tournée, tout près.

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

// Du plus avancé au moins avancé : c'est le statut gardé par défaut à la fusion.
export const RANK = ['given', 'refused', 'empty', 'again']
const rank = (e) => { const i = RANK.indexOf(e?.s); return i < 0 ? RANK.length : i }

// Clé du passage d'une maison : la maison, ou le premier logement d'un immeuble.
export const mainKey = (h) => dwellingKey(h.id, h.units?.[0]?.id)

export function findDuplicates(tours, statesById = {}) {
  const all = []
  for (const t of tours ?? []) for (const h of t.houses ?? []) all.push({ tour: t, house: h })
  const pairs = []
  for (const copy of all) {
    const c = copy.house
    if (!c.added || c.dupOk) continue
    const n = norm(c.number)
    if (!n || !/^\d/.test(n)) continue
    const text = norm(`${c.label ?? ''} ${c.street ?? ''}`)
    let best = null
    for (const orig of all) {
      const o = orig.house
      if (o === c || o.added || norm(o.number) !== n) continue
      const d = distance([c.lng, c.lat], [o.lng, o.lat])
      const sameStreet = norm(o.street).length > 3 && text.includes(norm(o.street).slice(0, 8))
      if (d > (sameStreet ? 300 : 80)) continue
      if (!best || d < best.dist) best = { orig, dist: Math.round(d) }
    }
    if (!best) continue
    const entryOf = (x) => statesById[x.tour.id]?.h?.[mainKey(x.house)] ?? null
    pairs.push({ id: c.id, copy: { ...copy, entry: entryOf(copy) }, orig: { ...best.orig, entry: entryOf(best.orig) }, dist: best.dist })
  }
  return pairs.sort((a, b) => (a.orig.tour.number ?? 0) - (b.orig.tour.number ?? 0) || String(a.orig.house.label).localeCompare(String(b.orig.house.label)))
}

// Réglage proposé pour une paire : position du binôme (il était sur place), statut le plus
// avancé, et la tournée qui a ce passage. Deux dons : à décider par l'admin.
export function defaultChoice(pair) {
  const { copy, orig } = pair
  const keep = rank(copy.entry) < rank(orig.entry) ? 'copy' : 'orig'
  const bothGiven = copy.entry?.s === 'given' && orig.entry?.s === 'given'
  return {
    position: 'copy',
    entry: bothGiven ? null : keep,
    tourId: keep === 'copy' && copy.entry ? copy.tour.id : orig.tour.id,
    bothGiven,
  }
}
