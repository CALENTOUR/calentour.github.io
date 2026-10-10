// Remplace 'firebase/auth' dans la version de démonstration.
import { DEMO_ACCOUNTS } from './demoInfo'
import { DEMO_UIDS } from './seed'

const SESSION_KEY = 'calentour-demo-session'
const listeners = new Set()
const auth = { currentUser: null }

const makeUser = (uid, email) => ({ uid, email, displayName: '', delete: async () => {} })

try {
  const saved = JSON.parse(localStorage.getItem(SESSION_KEY))
  if (saved) auth.currentUser = makeUser(saved.uid, saved.email)
} catch {
  // ignore
}

function setUser(user) {
  auth.currentUser = user
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify({ uid: user.uid, email: user.email }))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
  listeners.forEach((cb) => cb(user))
}

const authError = (code) => Object.assign(new Error(code), { code })

export const getAuth = () => auth
export const browserLocalPersistence = {}
export const setPersistence = async () => {}

export function onAuthStateChanged(_auth, cb) {
  listeners.add(cb)
  queueMicrotask(() => cb(auth.currentUser))
  return () => listeners.delete(cb)
}

export async function signInWithEmailAndPassword(_auth, email, password) {
  const index = DEMO_ACCOUNTS.findIndex((a) => a.email === email && a.password === password)
  if (index < 0) throw authError('auth/invalid-credential')
  const user = makeUser(DEMO_UIDS[index], email)
  setUser(user)
  return { user }
}

export async function signOut() {
  setUser(null)
}

export async function createUserWithEmailAndPassword() {
  throw authError('demo/register')
}

export async function sendPasswordResetEmail() {}
export async function updateProfile() {}
