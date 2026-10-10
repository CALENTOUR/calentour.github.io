import { doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { COL } from './paths'

export function createCampaign(year) {
  return setDoc(doc(db, COL.campaigns, String(year)), {
    year: Number(year),
    active: false,
    createdAt: serverTimestamp(),
  })
}

// Une seule campagne active à la fois.
export function setActiveCampaign(year, campaigns) {
  const batch = writeBatch(db)
  for (const c of campaigns) {
    batch.update(doc(db, COL.campaigns, String(c.year)), { active: c.year === Number(year) })
  }
  return batch.commit()
}
