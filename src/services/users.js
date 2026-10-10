import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth, db } from '../lib/firebase'
import { COL } from './paths'

export const normalizeEmail = (email) => email.trim().toLowerCase()

export function login(email, password) {
  return signInWithEmailAndPassword(auth, normalizeEmail(email), password)
}

export function logout() {
  return signOut(auth)
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, normalizeEmail(email))
}

// Création de compte réservée aux personnes invitées par un administrateur.
export async function register({ name, email, password }) {
  const cleanEmail = normalizeEmail(email)
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password)
  try {
    const invitation = await getDoc(doc(db, COL.invitations, cleanEmail))
    if (!invitation.exists()) throw new Error('not-invited')
    await setDoc(doc(db, COL.users, cred.user.uid), {
      name: name.trim() || invitation.data().name,
      email: cleanEmail,
      role: invitation.data().role,
      active: true,
      createdAt: serverTimestamp(),
    })
    await updateProfile(cred.user, { displayName: name.trim() })
    await deleteDoc(doc(db, COL.invitations, cleanEmail))
    return cred.user
  } catch (error) {
    // Pas d'invitation : on supprime le compte Auth tout juste créé.
    await cred.user.delete().catch(() => {})
    throw error
  }
}

export function inviteUser({ name, email, role }) {
  return setDoc(doc(db, COL.invitations, normalizeEmail(email)), {
    name: name.trim(),
    role,
    createdAt: serverTimestamp(),
  })
}

export function cancelInvitation(email) {
  return deleteDoc(doc(db, COL.invitations, email))
}

export function updateUser(uid, data) {
  return updateDoc(doc(db, COL.users, uid), data)
}

export function authErrorMessage(error) {
  const code = error?.code ?? error?.message
  const messages = {
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/invalid-email': 'Adresse email invalide.',
    'auth/user-disabled': 'Ce compte est désactivé.',
    'auth/email-already-in-use': 'Un compte existe déjà avec cet email. Utilisez "Se connecter".',
    'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).',
    'auth/too-many-requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
    'auth/network-request-failed': 'Pas de connexion réseau. La première connexion nécessite internet.',
    'not-invited': "Cet email n'a pas été invité. Demandez à un administrateur de vous ajouter.",
    'demo/register': 'La création de compte est désactivée dans la démo. Utilisez les boutons ci-dessus.',
    'permission-denied': "Cet email n'a pas été invité. Demandez à un administrateur de vous ajouter.",
  }
  return messages[code] ?? `Erreur : ${error?.message ?? 'inconnue'}`
}
