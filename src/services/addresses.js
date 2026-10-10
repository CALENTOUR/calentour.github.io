import { deleteField, doc, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { newId } from '../lib/format'
import { COL } from './paths'

// Pas de nom d'habitant : uniquement l'adresse, la position et un commentaire libre.
function cleanAddress({ label, lat, lng, comment = '' }) {
  return {
    label: label.trim(),
    lat: Number(lat),
    lng: Number(lng),
    comment: comment.trim(),
  }
}

export async function addAddress(sectorId, address) {
  const id = newId()
  await setDoc(
    doc(db, COL.sectorAddresses, sectorId),
    { addresses: { [id]: cleanAddress(address) } },
    { merge: true },
  )
  return id
}

// Ajout en masse (import OpenStreetMap). Firestore limite un document à 1 Mo,
// soit environ 5 000 adresses par secteur.
export function addAddresses(sectorId, addresses) {
  const map = {}
  for (const a of addresses) map[newId()] = cleanAddress(a)
  return setDoc(doc(db, COL.sectorAddresses, sectorId), { addresses: map }, { merge: true })
}

export async function updateAddress(address, data, newSectorId = address.sectorId) {
  const merged = cleanAddress({ ...address, ...data })
  if (newSectorId === address.sectorId) {
    return setDoc(
      doc(db, COL.sectorAddresses, address.sectorId),
      { addresses: { [address.id]: merged } },
      { merge: true },
    )
  }
  const batch = writeBatch(db)
  batch.set(doc(db, COL.sectorAddresses, address.sectorId), { addresses: { [address.id]: deleteField() } }, { merge: true })
  batch.set(doc(db, COL.sectorAddresses, newSectorId), { addresses: { [address.id]: merged } }, { merge: true })
  return batch.commit()
}

export function deleteAddress(address) {
  return setDoc(
    doc(db, COL.sectorAddresses, address.sectorId),
    { addresses: { [address.id]: deleteField() } },
    { merge: true },
  )
}
