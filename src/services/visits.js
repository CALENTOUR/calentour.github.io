import { deleteField, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { toNumber } from '../lib/format'
import { COL } from './paths'

export function visitTotal(v) {
  return Math.round((toNumber(v.cash) + toNumber(v.cheque) + toNumber(v.card) + toNumber(v.transfer)) * 100) / 100
}

const visitsDoc = (year, sectorId) => doc(db, COL.campaigns, String(year), COL.sectorVisits, sectorId)

// Enregistre l'état d'une adresse pour une campagne.
// previousSectorId : secteur où la visite était rangée si l'adresse a changé de
// secteur depuis, pour ne pas la compter deux fois.
//
// Hors ligne, l'écriture est gardée dans le cache local et la promesse ne se
// résout qu'au retour du réseau : l'interface ne doit donc pas l'attendre.
export function saveVisit({ year, sectorId, previousSectorId, addressId, userId, data }) {
  const isDonation = data.status === 'done'
  const visit = {
    status: data.status,
    calendars: isDonation ? Math.round(toNumber(data.calendars)) : 0,
    cash: isDonation ? toNumber(data.cash) : 0,
    cheque: isDonation ? toNumber(data.cheque) : 0,
    card: isDonation ? toNumber(data.card) : 0,
    transfer: isDonation ? toNumber(data.transfer) : 0,
    comment: (data.comment ?? '').trim(),
    userId,
    date: new Date().toISOString(),
  }
  visit.total = visitTotal(visit)

  const batch = writeBatch(db)
  batch.set(visitsDoc(year, sectorId), { visits: { [addressId]: visit }, updatedAt: serverTimestamp() }, { merge: true })
  if (previousSectorId && previousSectorId !== sectorId) {
    batch.set(visitsDoc(year, previousSectorId), { visits: { [addressId]: deleteField() } }, { merge: true })
  }
  return batch.commit()
}

// Remet l'adresse "À faire".
export function clearVisit({ year, sectorId, addressId }) {
  const batch = writeBatch(db)
  batch.set(visitsDoc(year, sectorId), { visits: { [addressId]: deleteField() }, updatedAt: serverTimestamp() }, { merge: true })
  return batch.commit()
}
