import { collection, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { COL } from './paths'

export async function createSector({ name, color, communeId, polygon, memberIds = [] }) {
  const ref = doc(collection(db, COL.sectors))
  const batch = writeBatch(db)
  batch.set(ref, { name: name.trim(), color, communeId, polygon, memberIds, updatedAt: serverTimestamp() })
  batch.set(doc(db, COL.sectorAddresses, ref.id), { addresses: {} })
  await batch.commit()
  return ref.id
}

export function updateSector(id, data) {
  return updateDoc(doc(db, COL.sectors, id), { ...data, updatedAt: serverTimestamp() })
}

// Supprime le secteur et ses adresses. Les visites des campagnes passées restent
// dans l'historique des statistiques.
export function deleteSector(id) {
  const batch = writeBatch(db)
  batch.delete(doc(db, COL.sectors, id))
  batch.delete(doc(db, COL.sectorAddresses, id))
  return batch.commit()
}

export function ensureSectorAddressesDoc(sectorId) {
  return setDoc(doc(db, COL.sectorAddresses, sectorId), { addresses: {} }, { merge: true })
}
