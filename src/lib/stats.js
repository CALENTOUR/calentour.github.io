import { HANDLED_STATUSES, STATUS_LIST } from '../config/constants'

function emptyBucket(extra = {}) {
  const counts = Object.fromEntries(STATUS_LIST.map((s) => [s.key, 0]))
  return {
    ...extra,
    addresses: 0,
    counts,
    total: 0,
    calendars: 0,
    cash: 0,
    cheque: 0,
    card: 0,
    transfer: 0,
    progress: 0,
  }
}

function addVisit(bucket, visit) {
  bucket.counts[visit.status] = (bucket.counts[visit.status] ?? 0) + 1
  bucket.total += visit.total ?? 0
  bucket.calendars += visit.calendars ?? 0
  bucket.cash += visit.cash ?? 0
  bucket.cheque += visit.cheque ?? 0
  bucket.card += visit.card ?? 0
  bucket.transfer += visit.transfer ?? 0
}

function finalize(bucket) {
  const handled = HANDLED_STATUSES.reduce((s, k) => s + (bucket.counts[k] ?? 0), 0)
  const visited = STATUS_LIST.filter((s) => s.key !== 'todo').reduce((s, st) => s + (bucket.counts[st.key] ?? 0), 0)
  bucket.counts.todo = Math.max(0, bucket.addresses - visited)
  bucket.progress = bucket.addresses ? handled / bucket.addresses : 0
  bucket.average = bucket.counts.done ? bucket.total / bucket.counts.done : 0
  return bucket
}

// Agrège les visites d'une campagne : global, par secteur, par commune, par membre.
export function computeStats({ addresses, visitsByAddress, sectors, communes, users }) {
  const global = emptyBucket()
  const bySector = Object.fromEntries(sectors.map((s) => [s.id, emptyBucket({ id: s.id, name: s.name, color: s.color, communeId: s.communeId })]))
  const byCommune = Object.fromEntries(communes.map((c) => [c.id, emptyBucket({ id: c.id, name: c.name })]))
  const byMember = {}
  const sectorCommune = Object.fromEntries(sectors.map((s) => [s.id, s.communeId]))
  const userName = Object.fromEntries(users.map((u) => [u.id, u.name || u.email]))

  const sectorBucket = (id) => (bySector[id] ??= emptyBucket({ id, name: 'Secteur supprimé', color: '#64748b' }))
  const communeBucket = (id) => (id ? (byCommune[id] ??= emptyBucket({ id, name: 'Commune supprimée' })) : null)

  for (const a of addresses) {
    global.addresses += 1
    sectorBucket(a.sectorId).addresses += 1
    const cb = communeBucket(sectorCommune[a.sectorId])
    if (cb) cb.addresses += 1
  }

  for (const visit of Object.values(visitsByAddress)) {
    if (!visit?.status || visit.status === 'todo') continue
    addVisit(global, visit)
    addVisit(sectorBucket(visit.sectorId), visit)
    const cb = communeBucket(sectorCommune[visit.sectorId])
    if (cb) addVisit(cb, visit)
    const m = (byMember[visit.userId] ??= emptyBucket({ id: visit.userId, name: userName[visit.userId] ?? 'Ancien membre' }))
    addVisit(m, visit)
    m.addresses += 1
  }

  finalize(global)
  Object.values(bySector).forEach(finalize)
  Object.values(byCommune).forEach(finalize)
  Object.values(byMember).forEach((m) => {
    m.average = m.counts.done ? m.total / m.counts.done : 0
  })

  return {
    global,
    bySector: Object.values(bySector).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })),
    byCommune: Object.values(byCommune).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    byMember: Object.values(byMember).sort((a, b) => b.total - a.total),
  }
}

export function statusOf(visitsByAddress, addressId) {
  return visitsByAddress[addressId]?.status ?? 'todo'
}
