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
