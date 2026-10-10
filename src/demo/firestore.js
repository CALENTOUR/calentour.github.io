// Remplace 'firebase/firestore' dans la version de démonstration (voir vite.config.js).
import { DELETE, TIMESTAMP, listCollection, readDoc, ready, subscribe, write } from './store'
import { newId } from '../lib/format'

export const initializeFirestore = () => ({ demo: true })
export const getFirestore = initializeFirestore
export const persistentLocalCache = () => ({})
export const persistentMultipleTabManager = () => ({})
export const deleteField = () => DELETE
export const serverTimestamp = () => TIMESTAMP

const isRef = (x) => x && (x.type === 'collection' || x.type === 'doc')

export function collection(parent, ...segments) {
  const base = isRef(parent) ? [parent.path] : []
  return { type: 'collection', path: [...base, ...segments].join('/') }
}

export function doc(parent, ...segments) {
  const base = isRef(parent) ? [parent.path] : []
  const parts = [...base, ...segments]
  if (parent?.type === 'collection' && !segments.length) parts.push(newId())
  const path = parts.join('/')
  return { type: 'doc', path, id: path.split('/').pop() }
}

function docSnapshot(ref) {
  const data = readDoc(ref.path)
  return { id: ref.id, ref, exists: () => data != null, data: () => (data ? structuredClone(data) : undefined) }
}

function collectionSnapshot(ref) {
  const docs = listCollection(ref.path).map(({ id, data }) => ({
    id,
    data: () => structuredClone(data),
    exists: () => true,
  }))
  return { docs, size: docs.length, empty: !docs.length, metadata: { hasPendingWrites: false, fromCache: true } }
}

export async function getDoc(ref) {
  await ready
  return docSnapshot(ref)
}

export async function getDocs(ref) {
  await ready
  return collectionSnapshot(ref)
}

export function onSnapshot(ref, ...args) {
  const [next, onError] = typeof args[0] === 'function' ? args : args.slice(1)
  let active = true
  const emit = () => {
    if (!active) return
    try {
      next(ref.type === 'doc' ? docSnapshot(ref) : collectionSnapshot(ref))
    } catch (err) {
      onError?.(err)
    }
  }
  let unsubscribe = () => {}
  ready.then(() => {
    if (!active) return
    emit()
    unsubscribe = subscribe(emit)
  })
  return () => {
    active = false
    unsubscribe()
  }
}

export async function setDoc(ref, data, options = {}) {
  await ready
  write([{ type: 'set', path: ref.path, data, merge: Boolean(options.merge) }])
}

export async function updateDoc(ref, data) {
  await ready
  write([{ type: 'update', path: ref.path, data }])
}

export async function deleteDoc(ref) {
  await ready
  write([{ type: 'delete', path: ref.path }])
}

export async function addDoc(collectionRef, data) {
  const ref = doc(collectionRef)
  await setDoc(ref, data)
  return ref
}

export function writeBatch() {
  const ops = []
  const batch = {
    set: (ref, data, options = {}) => { ops.push({ type: 'set', path: ref.path, data, merge: Boolean(options.merge) }); return batch },
    update: (ref, data) => { ops.push({ type: 'update', path: ref.path, data }); return batch },
    delete: (ref) => { ops.push({ type: 'delete', path: ref.path }); return batch },
    commit: async () => { await ready; write(ops) },
  }
  return batch
}
