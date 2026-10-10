import { initializeApp } from 'firebase/app'
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// En mode démo (npm run dev:demo / build:demo), Firebase est remplacé par une base locale.
export const isFirebaseConfigured = import.meta.env.MODE === 'demo' || Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null

export const auth = app ? getAuth(app) : null
if (auth) setPersistence(auth, browserLocalPersistence)

// Cache local persistant (IndexedDB) : lecture hors ligne, écritures mises en file
// d'attente et envoyées automatiquement au retour du réseau. Fonctionne avec
// plusieurs onglets ouverts.
export const db = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : null
