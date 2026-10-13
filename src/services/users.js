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

// Compte créé par l'administrateur (binôme ou autre administrateur).
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
