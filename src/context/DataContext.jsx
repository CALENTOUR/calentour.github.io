import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { COL } from '../services/paths'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export function useCollection(path, enabled, mapDoc = (d) => ({ id: d.id, ...d.data() })) {
  const [state, setState] = useState({ items: [], loading: true, pending: false })
  useEffect(() => {
    if (!enabled || !path) {
      setState({ items: [], loading: !enabled, pending: false })
      return undefined
    }
    setState((s) => ({ ...s, loading: true }))
    return onSnapshot(
      collection(db, ...path.split('/')),
      { includeMetadataChanges: true },
      (snap) => setState({
        items: snap.docs.map(mapDoc),
        loading: false,
        pending: snap.metadata.hasPendingWrites,
      }),
      (error) => {
        console.error(`Lecture ${path} impossible`, error)
        setState({ items: [], loading: false, pending: false })
      },
    )
    // mapDoc est stable par appelant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled])
  return state
}

// Transforme les documents "un par secteur" en une liste plate indexée par adresse.
export function flattenVisits(sectorVisitDocs) {
  const byAddress = {}
  for (const d of sectorVisitDocs) {
    for (const [addressId, visit] of Object.entries(d.visits ?? {})) {
      byAddress[addressId] = { ...visit, addressId, sectorId: d.id }
    }
  }
  return byAddress
}

export function useCampaignVisits(year) {
  const { status } = useAuth()
  const { items, loading, pending } = useCollection(
    year ? `${COL.campaigns}/${year}/${COL.sectorVisits}` : null,
    status === 'ready' && Boolean(year),
  )
  const visitsByAddress = useMemo(() => flattenVisits(items), [items])
  return { visitsByAddress, loading, pending }
}

export function DataProvider({ children }) {
  const { status } = useAuth()
  const enabled = status === 'ready'

  const users = useCollection(COL.users, enabled)
  const communes = useCollection(COL.communes, enabled)
  const sectors = useCollection(COL.sectors, enabled)
  const sectorAddresses = useCollection(COL.sectorAddresses, enabled)
  const campaigns = useCollection(COL.campaigns, enabled)

  const sortedCampaigns = useMemo(
    () => [...campaigns.items].sort((a, b) => b.year - a.year),
    [campaigns.items],
  )
  const activeCampaign = sortedCampaigns.find((c) => c.active) ?? null
  const activeVisits = useCampaignVisits(activeCampaign?.year)

  const value = useMemo(() => {
    const addresses = []
    for (const d of sectorAddresses.items) {
      for (const [id, a] of Object.entries(d.addresses ?? {})) {
        addresses.push({ id, sectorId: d.id, ...a })
      }
    }
    addresses.sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true }))

    const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]))
    const sortedSectors = [...sectors.items].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }))
    const sortedCommunes = [...communes.items].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    const sortedUsers = [...users.items].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fr'))

    return {
      loading: users.loading || communes.loading || sectors.loading || sectorAddresses.loading || campaigns.loading,
      pendingWrites: activeVisits.pending || sectorAddresses.pending || sectors.pending,
      users: sortedUsers,
      usersById: byId(users.items),
      communes: sortedCommunes,
      communesById: byId(communes.items),
      sectors: sortedSectors,
      sectorsById: byId(sectors.items),
      addresses,
      addressesById: byId(addresses),
      campaigns: sortedCampaigns,
      activeCampaign,
      activeVisits: activeVisits.visitsByAddress,
    }
  }, [users, communes, sectors, sectorAddresses, campaigns, sortedCampaigns, activeCampaign, activeVisits])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
