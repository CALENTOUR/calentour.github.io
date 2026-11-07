import { Timestamp, doc, getDocFromServer, getDocsFromServer, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { passagesCol, settingsRef, statesCol, toursCol, usersCol } from './paths'

// Sauvegarde complète de la base dans un fichier, et restauration depuis ce fichier.
// Les mots de passe ne sont pas dans la base (ils restent chez Firebase Authentication) :
// une restauration remet les fiches des comptes, pas les mots de passe.

const VERSION = 1

// Les dates Firestore deviennent { __ts: "2026-11-08T…" } dans le fichier, et redeviennent des dates à la restauration.
const pack = (v) => {
  if (v instanceof Timestamp) return { __ts: v.toDate().toISOString() }
  if (Array.isArray(v)) return v.map(pack)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pack(x)]))
  return v
}
const unpack = (v) => {
  if (Array.isArray(v)) return v.map(unpack)
  if (v && typeof v === 'object') {
    if (typeof v.__ts === 'string' && Object.keys(v).length === 1) return Timestamp.fromDate(new Date(v.__ts))
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unpack(x)]))
  }
  return v
}

const docsOf = async (col) => (await getDocsFromServer(col)).docs.map((d) => ({ id: d.id, data: pack(d.data()) }))

// Années de campagne gardées dans la sauvegarde : l'année en cours et les trois précédentes.
const yearsAround = (year) => [year - 3, year - 2, year - 1, year].filter((y) => y > 2000)

// Lit tout depuis le serveur (pas le cache du téléphone) : échoue sans réseau, plutôt que de sauvegarder des données périmées.
export async function readBackup() {
  const settingsSnap = await getDocFromServer(settingsRef())
  const settings = settingsSnap.exists() ? pack(settingsSnap.data()) : null
  const year = Number(settings?.year) || new Date().getFullYear()
  const [tours, users] = await Promise.all([docsOf(toursCol()), docsOf(usersCol())])
  const campaigns = {}
  for (const y of yearsAround(year)) {
    const [state, passages] = await Promise.all([docsOf(statesCol(y)), docsOf(passagesCol(y))])
    if (state.length || passages.length) campaigns[y] = { state, passages }
  }
  return { app: 'calentour', version: VERSION, exportedAt: new Date().toISOString(), settings, tours, users, campaigns }
}

export function backupSummary(b) {
  const years = Object.entries(b.campaigns ?? {})
  return {
    tours: b.tours?.length ?? 0,
    houses: (b.tours ?? []).reduce((n, t) => n + (t.data.houses?.length ?? 0), 0),
    users: b.users?.length ?? 0,
    passages: years.reduce((n, [, c]) => n + c.passages.length, 0),
    years: years.map(([y]) => y),
  }
}

export function parseBackup(text) {
  const b = JSON.parse(text)
  if (b?.app !== 'calentour' || !Array.isArray(b.tours) || !Array.isArray(b.users)) throw new Error('Ce fichier n’est pas une sauvegarde CalenTour.')
  return b
}

// Réécrit chaque document de la sauvegarde. Ce qui a été créé après la sauvegarde
// (nouvelle tournée, nouveau passage) n'est pas effacé.
export async function restoreBackup(b) {
  const writes = []
  if (b.settings) writes.push([doc(db, 'settings', 'app'), b.settings])
  for (const t of b.tours) writes.push([doc(db, 'tours', t.id), t.data])
  for (const u of b.users) writes.push([doc(db, 'users', u.id), u.data])
  for (const [y, c] of Object.entries(b.campaigns ?? {})) {
    for (const s of c.state) writes.push([doc(db, 'campaigns', String(y), 'state', s.id), s.data])
    for (const p of c.passages) writes.push([doc(db, 'campaigns', String(y), 'passages', p.id), p.data])
  }
  // Une maison par document reste sous la limite de Firestore ; on écrit par paquets de 200.
  for (let i = 0; i < writes.length; i += 200) {
    const batch = writeBatch(db)
    for (const [ref, data] of writes.slice(i, i + 200)) batch.set(ref, unpack(data))
    await batch.commit()
  }
  return writes.length
}
