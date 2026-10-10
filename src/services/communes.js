import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { COL } from './paths'

export const createCommune = (name) => addDoc(collection(db, COL.communes), { name: name.trim() })
export const renameCommune = (id, name) => updateDoc(doc(db, COL.communes, id), { name: name.trim() })
export const deleteCommune = (id) => deleteDoc(doc(db, COL.communes, id))
