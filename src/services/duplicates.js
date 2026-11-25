import { deleteField, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { mainKey } from '../lib/duplicates'
import { locateOnPieces } from '../lib/tourBuilder'
import { passagesCol, stateRef, tourRef } from './paths'

// Fusionne une maison en double dans la maison d'origine, en une seule écriture (tout ou rien) :
// - la maison d'origine reste (adresse officielle, historique), à la position choisie, dans la tournée choisie ;
// - elle prend le passage choisi (celui de la copie ou le sien) ;
// - la copie disparaît, son commentaire passe sur la maison gardée s'il n'y en a pas déjà un ;
// - chaque passage déplacé est noté dans l'historique (« fusion »).
export async function mergeDuplicate({ year, pair, choice, user }) {
  const { copy, orig } = pair
  const target = choice.tourId === copy.tour.id ? copy.tour : orig.tour
  const moved = choice.position === 'copy' || target.id !== orig.tour.id
  const pos = choice.position === 'copy' ? { lng: copy.house.lng, lat: copy.house.lat } : { lng: orig.house.lng, lat: orig.house.lat }
  const loc = moved ? locateOnPieces(pos.lng, pos.lat, target.pieces ?? []) : null
  const kept = {
    ...orig.house,
    ...pos,
    ...(loc ? { pieceId: loc.pieceId, along: loc.along } : {}),
  }
  const entry = choice.entry === 'copy' ? copy.entry : choice.entry === 'orig' ? orig.entry : null

  // Maisons de chaque tournée touchée.
  const houses = new Map()
  const list = (t) => houses.get(t.id) ?? (t.houses ?? [])
  houses.set(copy.tour.id, list(copy.tour).filter((h) => h.id !== copy.house.id))
  if (target.id === orig.tour.id) houses.set(orig.tour.id, list(orig.tour).map((h) => (h.id === orig.house.id ? kept : h)))
  else {
    houses.set(orig.tour.id, list(orig.tour).filter((h) => h.id !== orig.house.id))
    houses.set(target.id, [...list(target), kept])
  }

  const batch = writeBatch(db)
  for (const [tourId, hs] of houses) {
    const data = { houses: hs, updatedAt: serverTimestamp() }
    // Retirée de sa tournée d'origine : la vérification d'adresses ne doit pas la remettre.
    if (tourId === orig.tour.id && target.id !== orig.tour.id) {
      const ids = [orig.house.banId, orig.house.bdnb].filter(Boolean)
      if (ids.length) data.skipBan = [...new Set([...(orig.tour.skipBan ?? []), ...ids])]
    }
    const note = copy.tour.notes?.[copy.house.id]
    if (tourId === target.id && note && !target.notes?.[orig.house.id] && !orig.tour.notes?.[orig.house.id]) data.notes = { [orig.house.id]: note }
    batch.set(tourRef(tourId), data, { merge: true })
  }

  // Passages : on enlève ceux qui n'ont plus de maison, on pose celui qui est gardé.
  const at = new Date().toISOString()
  const byName = `${user?.name ?? 'Admin'} (fusion)`
  const states = new Map()
  const log = (tourId, key, e, movedFrom) => batch.set(doc(passagesCol(year)), {
    tourId, key, s: e?.s ?? 'todo', amount: e?.amount ?? 0, mode: e?.mode ?? null, at, by: user?.uid ?? null, byName, ...(movedFrom ? { movedFrom } : {}),
  })
  const put = (tourId, key, value) => states.set(tourId, { ...(states.get(tourId) ?? {}), [key]: value })
  const copyKey = mainKey(copy.house)
  const origKey = mainKey(orig.house)
  if (copy.entry) { put(copy.tour.id, copyKey, deleteField()); log(copy.tour.id, copyKey, null) }
  if (target.id !== orig.tour.id && orig.entry) { put(orig.tour.id, origKey, deleteField()); log(orig.tour.id, origKey, null) }
  const before = target.id === orig.tour.id ? orig.entry : null
  const same = (a, b) => (a?.s ?? null) === (b?.s ?? null) && (a?.amount ?? 0) === (b?.amount ?? 0) && (a?.mode ?? null) === (b?.mode ?? null)
  if (!same(before, entry)) {
    put(target.id, origKey, entry ?? deleteField())
    log(target.id, origKey, entry, choice.entry === 'copy' ? copyKey : choice.entry === 'orig' && target.id !== orig.tour.id ? origKey : null)
  }
  for (const [tourId, h] of states) batch.set(stateRef(year, tourId), { h }, { merge: true })

  await batch.commit()
  return { kept, entry, target }
}

// Deux foyers à la même adresse : la maison ajoutée n'est pas un doublon et n'est plus signalée.
export function markNotDuplicate(pair) {
  const { copy } = pair
  const batch = writeBatch(db)
  batch.set(tourRef(copy.tour.id), { houses: copy.tour.houses.map((h) => (h.id === copy.house.id ? { ...h, dupOk: true } : h)), updatedAt: serverTimestamp() }, { merge: true })
  return batch.commit()
}
