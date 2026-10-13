import { deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { newId } from '../lib/format'
import { flatten } from '../lib/geo'
import { TOUR_COLORS } from '../config/constants'
import INITIAL_TOURS from '../config/tours.json'
import { settingsRef, tourRef, toursCol } from './paths'
import { updateUser } from './users'

export function saveTour(id, data) {
  return setDoc(tourRef(id), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}

export function deleteTour(id) {
  return deleteDoc(tourRef(id))
}

// Suppression d'une tournée : ses accès sont désactivés.
export async function removeTour(tour, users) {
  await Promise.all(users.filter((u) => u.tourId === tour.id && u.active).map((u) => updateUser(u.id, { active: false })))
  await deleteTour(tour.id)
}

// Création d'une tournée vide ; renvoie son identifiant.
export async function createTour(values) {
  const ref = doc(toursCol())
  await setDoc(ref, { ...newTourDoc(values), updatedAt: serverTimestamp() })
  return ref.id
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

// Tournées de l'amicale, tracées une fois pour toutes à partir de la carte Google My Maps
// (src/config/tours.json). Chargées automatiquement au premier passage sur la carte admin.
export async function loadInitialTours(existing = []) {
  const parsed = INITIAL_TOURS.map((t) => ({
    number: t.number,
    name: t.name ?? `Tournée ${t.number}`,
    members: t.members ?? [],
    color: t.color,
    pieces: t.lines.map((line) => ({ line })),
  }))
  await importTours(parsed, existing)
  await setDoc(settingsRef(), { toursLoaded: true, toursNamed: true }, { merge: true })
  return parsed.length
}

// Tournées chargées avant que les noms des équipes soient connus (« Tournée N », sans
// pompier) : elles reçoivent une fois les vrais noms de src/config/tours.json.
export async function nameInitialTours(existing) {
  const official = new Map(INITIAL_TOURS.map((t) => [t.number, t]))
  const batch = writeBatch(db)
  let count = 0
  for (const t of existing) {
    const o = official.get(t.number)
    if (!o?.name || t.name !== `Tournée ${t.number}` || t.members?.length) continue
    batch.set(tourRef(t.id), { name: o.name, members: o.members, updatedAt: serverTimestamp() }, { merge: true })
    count++
  }
  batch.set(settingsRef(), { toursNamed: true }, { merge: true })
  await batch.commit()
  return count
}
