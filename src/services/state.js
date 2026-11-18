import { addDoc, deleteField, setDoc } from 'firebase/firestore'
import { passagesCol, stateRef } from './paths'

// Clé d'une habitation : la maison, ou le logement d'un immeuble.
export const dwellingKey = (houseId, unitId) => (unitId ? `${houseId}__${unitId}` : houseId)

// Enregistre le résultat d'un passage. Les écritures ne sont pas attendues :
// hors ligne, Firestore les garde et les envoie au retour du réseau.
export function recordPassage({ year, tourId, key, status, amount = 0, mode = null, user }) {
  const at = new Date().toISOString()
  const entry = status === 'todo'
    ? deleteField()
    : { s: status, amount: status === 'given' ? amount : 0, mode: status === 'given' ? mode : null, at, by: user.uid }
  const done = Promise.all([
    setDoc(stateRef(year, tourId), { h: { [key]: entry } }, { merge: true }),
    addDoc(passagesCol(year), {
      tourId, key, s: status, amount: status === 'given' ? amount : 0, mode: status === 'given' ? mode : null,
      at, by: user.uid, byName: user.name ?? '',
    }),
  ])
  done.catch((err) => console.error('Enregistrement du passage', err))
  return done
}

// Maison passée en immeuble (ou l'inverse) : son passage suit le premier logement,
// sinon il resterait accroché à une habitation qui n'existe plus.
export function carryPassage({ year, tourId, state, before, after }) {
  const h = state?.h ?? {}
  const wasBuilding = Boolean(before.units?.length)
  const isBuilding = Boolean(after.units?.length)
  if (wasBuilding === isBuilding) return null
  const from = wasBuilding ? dwellingKey(before.id, before.units[0].id) : dwellingKey(before.id)
  const to = isBuilding ? dwellingKey(after.id, after.units[0].id) : dwellingKey(after.id)
  if (!h[from] || h[to]) return null
  const done = setDoc(stateRef(year, tourId), { h: { [to]: h[from], [from]: deleteField() } }, { merge: true })
  done.catch((err) => console.error('Passage du logement', err))
  return done
}

// Admin : rattache un don resté sur une habitation disparue à l'habitation qui existe
// aujourd'hui (la maison, ou le premier logement de l'immeuble). Noté dans l'historique.
export function moveEntry({ year, tourId, from, to, entry, user }) {
  const at = new Date().toISOString()
  return Promise.all([
    setDoc(stateRef(year, tourId), { h: { [to]: entry, [from]: deleteField() } }, { merge: true }),
    addDoc(passagesCol(year), { tourId, key: to, s: entry.s, amount: entry.amount ?? 0, mode: entry.mode ?? null, at, by: user.uid, byName: `${user.name ?? 'Admin'} (rattachement)`, movedFrom: from }),
    addDoc(passagesCol(year), { tourId, key: from, s: 'todo', amount: 0, mode: null, at, by: user.uid, byName: `${user.name ?? 'Admin'} (rattachement)` }),
  ])
}
