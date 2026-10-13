// Remplace 'firebase/auth' dans la version de démonstration. Les comptes sont
// rangés dans la base locale (_accounts/{email}).
import { readDoc, ready, write } from './store'
import { DEMO_SESSION_KEY } from './reset'
import { newId } from '../lib/format'

const listeners = new Set()
const mainAuth = { currentUser: null, main: true }
const otherAuths = new Map()

const makeUser = (uid, email) => ({ uid, email, displayName: '' })

try {
  const saved = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY))
  if (saved) mainAuth.currentUser = makeUser(saved.uid, saved.email)
} catch {
  // ignore
}

function setUser(user) {
  mainAuth.currentUser = user
  try {
    if (user) localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ uid: user.uid, email: user.email }))
    else localStorage.removeItem(DEMO_SESSION_KEY)
  } catch {
    // ignore
  }
  listeners.forEach((cb) => cb(user))
}

const authError = (code) => Object.assign(new Error(code), { code })
const accountPath = (email) => `_accounts/${email.replace(/[/.]/g, '_')}`

export function getAuth(app) {
  if (!app || app.name === 'default') return mainAuth
  if (!otherAuths.has(app.name)) otherAuths.set(app.name, { currentUser: null, main: false })
  return otherAuths.get(app.name)
}
export const browserLocalPersistence = {}
export const setPersistence = async () => {}

export function onAuthStateChanged(_auth, cb) {
  listeners.add(cb)
  queueMicrotask(() => cb(mainAuth.currentUser))
  return () => listeners.delete(cb)
}

export async function signInWithEmailAndPassword(auth, email, password) {
  await ready
  const account = readDoc(accountPath(email))
  if (!account || account.password !== password) throw authError('auth/invalid-credential')
  const user = makeUser(account.uid, email)
  if (auth.main) setUser(user)
  else auth.currentUser = user
  return { user }
}

export async function createUserWithEmailAndPassword(auth, email, password) {
  await ready
  if (readDoc(accountPath(email))) throw authError('auth/email-already-in-use')
  if (!password || password.length < 6) throw authError('auth/weak-password')
  const uid = `demo-${newId().slice(0, 10)}`
  write([{ type: 'set', path: accountPath(email), data: { uid, password } }])
  const user = makeUser(uid, email)
  if (auth.main) setUser(user)
  else auth.currentUser = user
  return { user }
}

export async function signOut(auth) {
  if (auth.main) setUser(null)
  else auth.currentUser = null
}
