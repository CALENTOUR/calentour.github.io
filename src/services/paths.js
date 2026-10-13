import { collection, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export const settingsRef = () => doc(db, 'settings', 'app')
export const userRef = (uid) => doc(db, 'users', uid)
export const usersCol = () => collection(db, 'users')
export const tourRef = (id) => doc(db, 'tours', id)
export const toursCol = () => collection(db, 'tours')
export const stateRef = (year, tourId) => doc(db, 'campaigns', String(year), 'state', tourId)
export const statesCol = (year) => collection(db, 'campaigns', String(year), 'state')
export const passagesCol = (year) => collection(db, 'campaigns', String(year), 'passages')
