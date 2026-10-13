import { deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { newId } from '../lib/format'
import { flatten } from '../lib/geo'
import { TOUR_COLORS } from '../config/constants'
import { tourRef, toursCol } from './paths'

export function saveTour(id, data) {
  return setDoc(tourRef(id), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}

export function deleteTour(id) {
  return deleteDoc(tourRef(id))
}

export function newTourDoc({ number, name, members = [], color }) {
  return {
    number,
    name,
    members,
    color: color ?? TOUR_COLORS[(number - 1 + TOUR_COLORS.length) % TOUR_COLORS.length],
    pieces: [],
    houses: [],
  }
}

export const newPiece = (name, lines) => ({ id: newId().slice(0, 10), name, lines: lines.map((l) => ({ c: flatten(l) })) })

// Création des tournées à partir de la carte importée (une écriture par tournée).
export async function importTours(parsed, existing = []) {
  const batch = writeBatch(db)
  const byNumber = new Map(existing.map((t) => [t.number, t]))
  for (const t of parsed) {
    const pieces = t.pieces.map((p, i) => newPiece(`Morceau ${i + 1}`, [p.line]))
    const current = byNumber.get(t.number)
    const ref = current ? tourRef(current.id) : doc(toursCol())
    batch.set(ref, {
      ...newTourDoc(t),
      ...(t.color ? { color: t.color } : {}),
      pieces,
      houses: [],
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
}
