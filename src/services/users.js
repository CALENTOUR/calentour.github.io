import { serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { EmailAuthProvider, createUserWithEmailAndPassword, reauthenticateWithCredential, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth'
import { auth, db, secondaryAuth } from '../lib/firebase'
import { LOGIN_DOMAIN } from '../config/constants'
import { settingsRef, userRef } from './paths'

export const normalizeLogin = (login) => login.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9._@-]/g, '')
export const loginToEmail = (login) => {
  const clean = normalizeLogin(login)
  return clean.includes('@') ? clean : `${clean}@${LOGIN_DOMAIN}`
}

export function login(identifier, password) {
  return signInWithEmailAndPassword(auth, loginToEmail(identifier), password)
}

// Changement de son propre mot de passe (l'ancien est redemandé par sécurité).
export async function changeMyPassword(current, next) {
  const user = auth.currentUser
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current))
  await updatePassword(user, next)
}

export function logout() {
  return signOut(auth)
}

// Mot de passe facile à dicter : 3 syllabes + 2 chiffres (ex. "bafilo42").
export function generatePassword() {
  const c = 'bcdfghjklmnprstvz'
  const v = 'aeiou'
  const r = (s) => s[Math.floor(Math.random() * s.length)]
  return `${r(c)}${r(v)}${r(c)}${r(v)}${r(c)}${r(v)}${Math.floor(10 + Math.random() * 90)}`
}

// Mots simples à dicter pour les accès des binômes (6 lettres minimum, sans accent).
const SIMPLE_WORDS = [
  'camion', 'flocon', 'cerise', 'tomate', 'banane', 'carotte', 'citron', 'orange', 'girafe', 'renard',
  'castor', 'cheval', 'mouton', 'poulet', 'canard', 'tortue', 'abeille', 'soleil', 'jardin', 'ballon',
  'bateau', 'violon', 'crayon', 'cahier', 'chemin', 'sirene', 'echelle', 'casque', 'bougie', 'etoile',
  'lavande', 'myrtille', 'noisette', 'pigeon', 'papillon', 'raisin', 'pompon', 'marron', 'grenier', 'lanterne',
]
export function simpleWord(used = new Set()) {
  const free = SIMPLE_WORDS.filter((w) => !used.has(w))
  const pool = free.length ? free : SIMPLE_WORDS
  return pool[Math.floor(Math.random() * pool.length)]
}

// Identifiant d'une tournée d'après ses membres : « Noémie / Mathieu » → noemie.mathieu,
// « Nathalie / Maxime L » → nathalie.maximel, « Arnaud / J-C » → arnaud.jc.
export function tourLogin(tour) {
  const names = (tour.members?.length ? tour.members : String(tour.name ?? '').split('/'))
    .map((n) => normalizeLogin(n).replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
  return names.join('.') || `tournee${tour.number}`
}

// Accès de toutes les tournées qui n'en ont pas encore. Les accès existants ne sont
// jamais touchés. `onProgress(faites, total)`. Renvoie les accès créés et les échecs.
export async function createMissingAccesses(tours, users, onProgress) {
  const withAccess = new Set(users.filter((u) => u.active && u.role !== 'admin' && u.tourId).map((u) => u.tourId))
  const todo = tours.filter((t) => !withAccess.has(t.id))
  const taken = new Set(users.map((u) => u.login))
  const words = new Set(users.map((u) => u.password).filter(Boolean))
  const created = []
  const failed = []
  let done = 0
  for (const tour of todo) {
    const base = tourLogin(tour)
    let login = base
    for (let i = 2; taken.has(login); i++) login = `${base}${i}`
    const password = simpleWord(words)
    try {
      await createAccount({ login, password, name: tour.name, role: 'member', tourId: tour.id })
      taken.add(login)
      words.add(password)
      created.push({ tour, login, password })
    } catch (err) {
      failed.push({ tour, login, error: authErrorMessage(err) })
    }
    onProgress?.(++done, todo.length)
  }
  return { created, failed }
}

// Texte à coller dans un message au binôme.
export function accessText({ login: identifier, password }) {
  const url = window.location.href.split('#')[0]
  return [`Identifiant : ${identifier}`, password ? `Mot de passe : ${password}` : null, `Adresse : ${url}`].filter(Boolean).join('\n')
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Anciens navigateurs, ou page sans permission : copie à l'ancienne.
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

// Compte créé par l'administrateur (binôme ou autre administrateur). Le mot de passe d'un
// binôme est gardé dans sa fiche (lisible par les admins et lui seul) pour pouvoir le
// recopier plus tard.
export async function createAccount({ login: identifier, password, name, role, tourId = null }) {
  const sec = secondaryAuth()
  const cred = await createUserWithEmailAndPassword(sec, loginToEmail(identifier), password)
  await signOut(sec).catch(() => {})
  await setDoc(userRef(cred.user.uid), {
    login: normalizeLogin(identifier),
    name,
    role,
    tourId,
    active: true,
    ...(role !== 'admin' ? { password } : {}),
    createdAt: serverTimestamp(),
  })
  return cred.user.uid
}

export function updateUser(uid, data) {
  return updateDoc(userRef(uid), data)
}

// Premier lancement : création de l'amicale et du premier administrateur.
export async function setupAmicale({ amicale, login: identifier, password, name }) {
  const cred = await createUserWithEmailAndPassword(auth, loginToEmail(identifier), password)
  const batch = writeBatch(db)
  batch.set(settingsRef(), { amicale, year: new Date().getFullYear(), rankingForMembers: false, createdAt: serverTimestamp() })
  batch.set(userRef(cred.user.uid), { login: normalizeLogin(identifier), name, role: 'admin', tourId: null, active: true, createdAt: serverTimestamp() })
  await batch.commit()
}

export function authErrorMessage(error) {
  const code = error?.code ?? error?.message
  const messages = {
    'auth/invalid-credential': 'Identifiant ou mot de passe incorrect.',
    'auth/wrong-password': 'Mot de passe actuel incorrect.',
    'auth/invalid-email': 'Identifiant invalide (lettres, chiffres, points et tirets uniquement).',
    'auth/user-disabled': 'Ce compte est désactivé.',
    'auth/email-already-in-use': 'Cet identifiant est déjà pris.',
    'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).',
    'auth/too-many-requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
    'auth/network-request-failed': 'Pas de réseau. La première connexion nécessite internet.',
    'permission-denied': 'Action non autorisée.',
  }
  return messages[code] ?? `Erreur : ${error?.message ?? 'inconnue'}`
}
