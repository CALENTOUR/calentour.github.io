import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import { reportRef, reportsCol } from './paths'

// Signalement d'un binôme (« maison en trop », « rue mal tracée », « l'appli bloque »…),
// lu par les administrateurs sur leur tableau de bord.
// Pas d'attente du serveur : hors ligne, l'envoi part dans la file locale.
export function sendReport({ user, tour, year, text, page }) {
  const t = text.trim().slice(0, 1000)
  return setDoc(doc(reportsCol()), {
    text: t,
    at: new Date().toISOString(),
    by: user.uid,
    byName: user.name ?? '',
    tourId: tour?.id ?? null,
    tourName: tour ? `${tour.number}. ${tour.name}` : '',
    year: year ?? null,
    page: page ?? '',
    done: false,
  })
}

export const setReportDone = (id, done) => updateDoc(reportRef(id), { done })
export const deleteReport = (id) => deleteDoc(reportRef(id))
