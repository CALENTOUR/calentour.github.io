import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { onSnapshot } from 'firebase/firestore'
import { auth } from '../lib/firebase'
import { userRef } from '../services/paths'
import { ROLES } from '../config/constants'

const AuthContext = createContext(null)

// status : 'loading' | 'signedOut' | 'noProfile' | 'inactive' | 'ready'
export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined)
  const [profile, setProfile] = useState(undefined)

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setFirebaseUser(user)
    if (!user) setProfile(null)
  }), [])

  useEffect(() => {
    if (!firebaseUser) return undefined
    setProfile(undefined)
    return onSnapshot(
      userRef(firebaseUser.uid),
      (snap) => setProfile(snap.exists() ? { id: snap.id, uid: snap.id, ...snap.data() } : null),
      () => setProfile(null),
    )
  }, [firebaseUser])

  const value = useMemo(() => {
    let status = 'ready'
    if (firebaseUser === undefined || (firebaseUser && profile === undefined)) status = 'loading'
    else if (!firebaseUser) status = 'signedOut'
    else if (!profile) status = 'noProfile'
    else if (!profile.active) status = 'inactive'
    return {
      status,
      user: firebaseUser ?? null,
      profile: profile ?? null,
      isAdmin: profile?.role === ROLES.ADMIN && profile?.active === true,
    }
  }, [firebaseUser, profile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
