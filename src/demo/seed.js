// Jeu de données fictif de la démo : une amicale autour d'Épinal (Vosges).
// Les adresses réelles sont récupérées dans OpenStreetMap au premier lancement,
// les passages et les dons sont inventés.
import { fetchOsmAddresses } from '../lib/osm'
import { pointInPolygon } from '../lib/geo'

export const DEMO_UIDS = ['demo-admin', 'demo-membre']

const MEMBERS = [
  { id: 'demo-admin', name: 'Admin Démo', role: 'admin' },
  { id: 'demo-membre', name: 'Membre Démo', role: 'member' },
  { id: 'demo-m3', name: 'Lucas M.', role: 'member' },
  { id: 'demo-m4', name: 'Emma R.', role: 'member' },
  { id: 'demo-m5', name: 'Hugo B.', role: 'member' },
  { id: 'demo-m6', name: 'Léa P.', role: 'member' },
  { id: 'demo-m7', name: 'Nathan G.', role: 'member' },
  { id: 'demo-m8', name: 'Chloé D.', role: 'member' },
]

const rect = (west, south, east, north) => [
  { lng: west, lat: south },
  { lng: east, lat: south },
  { lng: east, lat: north },
  { lng: west, lat: north },
]

const SECTORS = [
  { id: 's-centre', name: 'Centre', color: '#3b82f6', communeId: 'c-epinal', polygon: rect(6.4440, 48.1700, 6.4560, 48.1780), memberIds: ['demo-membre', 'demo-m3'] },
  { id: 's-nord', name: 'Nord', color: '#a855f7', communeId: 'c-epinal', polygon: rect(6.4440, 48.1780, 6.4560, 48.1860), memberIds: ['demo-m4', 'demo-m5'] },
  { id: 's-est', name: 'Est', color: '#14b8a6', communeId: 'c-epinal', polygon: rect(6.4560, 48.1700, 6.4680, 48.1780), memberIds: ['demo-m6'] },
  { id: 's-sud', name: 'Sud', color: '#eab308', communeId: 'c-epinal', polygon: rect(6.4440, 48.1620, 6.4560, 48.1700), memberIds: ['demo-m7', 'demo-membre'] },
  { id: 's-golbey', name: 'Golbey Village', color: '#ec4899', communeId: 'c-golbey', polygon: rect(6.4300, 48.1900, 6.4440, 48.1990), memberIds: ['demo-m8', 'demo-m3'] },
]

const MAX_PER_SECTOR = 450
const CURRENT = new Date().getFullYear()
const PREV = CURRENT - 1

// Générateur pseudo-aléatoire reproductible.
function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function fakeAddresses(sector, random) {
  const [a, , c] = sector.polygon
  return Array.from({ length: 120 }, (_, i) => ({
    label: `${i + 1} rue de la Démo (${sector.name})`,
    lng: a.lng + (c.lng - a.lng) * (0.05 + random() * 0.9),
    lat: a.lat + (c.lat - a.lat) * (0.05 + random() * 0.9),
  }))
}

function makeVisit(random, memberIds, daysAgo, year) {
  const r = random()
  const status = r < 0.62 ? 'done' : r < 0.8 ? 'absent' : r < 0.92 ? 'refused' : 'vacant'
  const visit = { status, calendars: 0, cash: 0, cheque: 0, card: 0, transfer: 0, total: 0, comment: '' }
  if (status === 'done') {
    visit.calendars = random() < 0.85 ? 1 : 2
    const amount = [5, 10, 10, 10, 15, 15, 20, 20, 30, 50][Math.floor(random() * 10)] * visit.calendars
    const m = random()
    if (m < 0.62) visit.cash = amount
    else if (m < 0.85) visit.cheque = amount
    else if (m < 0.96) visit.card = amount
    else visit.transfer = amount
    visit.total = amount
  }
  if (status === 'absent' && random() < 0.3) visit.comment = 'Repasser en fin de journée'
  visit.userId = memberIds[Math.floor(random() * memberIds.length)] ?? 'demo-admin'
  // Campagne passée : novembre-décembre. Campagne en cours : les derniers jours.
  const date = year < new Date().getFullYear() ? new Date(year, 10, 15) : new Date()
  date.setDate(date.getDate() + (year < new Date().getFullYear() ? 1 : -1) * Math.floor(daysAgo * random()))
  date.setHours(10 + Math.floor(random() * 8), Math.floor(random() * 60))
  visit.date = date.toISOString()
  return visit
}

export async function seedDemo() {
  const random = rng(88)
  const docs = {}

  for (const m of MEMBERS) {
    docs[`users/${m.id}`] = { name: m.name, email: `${m.id}@demo.calentour.fr`, role: m.role, active: true }
  }
  docs['users/demo-admin'].email = 'admin@demo.calentour.fr'
  docs['users/demo-membre'].email = 'membre@demo.calentour.fr'
  docs['communes/c-epinal'] = { name: 'Épinal' }
  docs['communes/c-golbey'] = { name: 'Golbey' }
  docs[`campaigns/${PREV}`] = { year: PREV, active: false }
  docs[`campaigns/${CURRENT}`] = { year: CURRENT, active: true }

  // Adresses réelles OpenStreetMap, avec repli sur des adresses fictives si OSM ne répond pas.
  let osm = []
  try {
    const all = rect(6.4300, 48.1620, 6.4680, 48.1990)
    osm = await fetchOsmAddresses(all)
  } catch (err) {
    console.warn('Démo : OpenStreetMap indisponible, adresses fictives', err)
  }

  for (const s of SECTORS) {
    const { id, ...sector } = s
    docs[`sectors/${id}`] = sector
    let list = osm.filter((a) => pointInPolygon(a.lng, a.lat, s.polygon))
    if (!list.length) list = fakeAddresses(s, random)
    list = list.slice(0, MAX_PER_SECTOR)

    const addresses = {}
    const visitsPrev = {}
    const visitsCurrent = {}
    list.forEach((a, i) => {
      const addressId = `${id}-${i}`
      addresses[addressId] = { label: a.label, lat: a.lat, lng: a.lng, comment: '' }
      if (random() < 0.9) visitsPrev[addressId] = makeVisit(random, s.memberIds, 45, PREV)
      // Campagne en cours : avancement différent selon le secteur.
      const progress = { 's-centre': 0.7, 's-nord': 0.45, 's-est': 0.2, 's-sud': 0.55, 's-golbey': 0.35 }[id]
      if (random() < progress) visitsCurrent[addressId] = makeVisit(random, s.memberIds, 20, CURRENT)
    })
    docs[`sectorAddresses/${id}`] = { addresses }
    docs[`campaigns/${PREV}/sectorVisits/${id}`] = { visits: visitsPrev }
    docs[`campaigns/${CURRENT}/sectorVisits/${id}`] = { visits: visitsCurrent }
  }

  return docs
}
