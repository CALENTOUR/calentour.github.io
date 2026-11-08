import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { useAuth } from './AuthContext'
import { reportsCol, settingsRef, stateRef, statesCol, tourRef, toursCol, usersCol } from '../services/paths'

const DataContext = createContext(null)

const docsToList = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))
const docsToMap = (snap) => Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))

// Abonnements temps réel. Un membre ne lit que sa tournée (2 documents),
// sauf si le classement lui est ouvert. L'administrateur lit tout.
export function DataProvider({ children }) {
  const { status, profile, isAdmin } = useAuth()
  const [settings, setSettings] = useState(undefined)
  const [tours, setTours] = useState(null)
  const [states, setStates] = useState(null)
  const [users, setUsers] = useState([])
  const [reports, setReports] = useState([])

  useEffect(() => onSnapshot(
    settingsRef(),
    // Absent du cache du téléphone (hors ligne) ne veut pas dire absent de la base : on
    // attend la réponse du serveur avant de proposer de créer l'amicale.
    (snap) => { if (snap.exists() || !snap.metadata?.fromCache) setSettings(snap.exists() ? snap.data() : null) },
    () => setSettings(null),
  ), [])

  const ready = status === 'ready' && Boolean(settings)
  const year = settings?.year
  const wantsAll = isAdmin || Boolean(settings?.rankingForMembers)
  const myTourId = profile?.tourId ?? null

  useEffect(() => {
    if (!ready) return undefined
    setTours(null)
    setStates(null)
    const subs = []
    if (wantsAll) {
      subs.push(onSnapshot(toursCol(), (s) => setTours(docsToList(s)), () => setTours([])))
      subs.push(onSnapshot(statesCol(year), (s) => setStates(docsToMap(s)), () => setStates({})))
    } else if (myTourId) {
      subs.push(onSnapshot(tourRef(myTourId), (s) => setTours(s.exists() ? [{ id: s.id, ...s.data() }] : []), () => setTours([])))
      subs.push(onSnapshot(stateRef(year, myTourId), (s) => setStates(s.exists() ? { [s.id]: s.data() } : {}), () => setStates({})))
    } else {
      setTours([])
      setStates({})
    }
    return () => subs.forEach((u) => u())
  }, [ready, wantsAll, myTourId, year])

  useEffect(() => {
    if (!ready || !isAdmin) return undefined
    return onSnapshot(usersCol(), (s) => setUsers(docsToList(s)), () => setUsers([]))
  }, [ready, isAdmin])

  // Signalements des binômes, lus par les administrateurs seulement (les plus récents d'abord).
  useEffect(() => {
    if (!ready || !isAdmin) return undefined
    return onSnapshot(reportsCol(), (s) => setReports(docsToList(s).sort((a, b) => String(b.at).localeCompare(String(a.at)))), () => setReports([]))
  }, [ready, isAdmin])

  const value = useMemo(() => {
    const sortedTours = (tours ?? []).slice().sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    return {
      settings,
      year,
      loading: settings === undefined || (ready && (tours === null || states === null)),
      tours: sortedTours,
      toursById: Object.fromEntries(sortedTours.map((t) => [t.id, t])),
      statesById: states ?? {},
      myTour: sortedTours.find((t) => t.id === myTourId) ?? null,
      users,
      reports,
    }
  }, [settings, year, ready, tours, states, myTourId, users, reports])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
