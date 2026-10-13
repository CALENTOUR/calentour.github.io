// Données fictives de la démo : les vraies rues des tournées (tracés de la carte,
// sans les noms des pompiers), des maisons et des passages inventés.
import TOURS from '../config/tours.json'
import { flatten, lineLength, offsetPoint, projectOnLine } from '../lib/geo'

const FIRST_NAMES = ['Alex', 'Camille', 'Sam', 'Charlie', 'Jules', 'Lou', 'Max', 'Noa', 'Robin', 'Sasha', 'Eden', 'Morgan', 'Andréa', 'Lucie', 'Hugo', 'Inès', 'Léo', 'Manon', 'Tom', 'Zoé', 'Nina', 'Théo', 'Emma', 'Paul', 'Jade', 'Louis', 'Rose', 'Enzo', 'Mila', 'Yanis']
const STREETS = ['Rue de la Gare', 'Grande Rue', 'Rue de l’Église', 'Rue des Lilas', 'Rue du Moulin', 'Chemin des Vignes', 'Rue des Écoles', 'Rue du Stade', 'Rue de la Fontaine', 'Rue des Jardins', 'Route d’Épinal', 'Rue du Château', 'Rue des Prés', 'Impasse des Tilleuls', 'Rue de la Forge', 'Rue du Lavoir', 'Rue des Champs', 'Rue de la Libération', 'Rue du Général Leclerc', 'Rue des Pommiers']

export const DEMO_ADMIN_UID = 'demo-admin'
export const DEMO_MEMBER_UID = 'demo-tournee2'

// Même règle que services/state (importer ce module ici créerait une boucle).
const dwellingKey = (houseId, unitId) => (unitId ? `${houseId}__${unitId}` : houseId)

function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const pick = (random, list) => list[Math.floor(random() * list.length)]

function makeEntry(random, daysBack) {
  const r = random()
  const s = r < 0.6 ? 'given' : r < 0.78 ? 'again' : r < 0.92 ? 'refused' : 'empty'
  const at = new Date()
  at.setDate(at.getDate() - Math.floor(random() * daysBack))
  at.setHours(9 + Math.floor(random() * 9), Math.floor(random() * 60))
  const entry = { s, amount: 0, mode: null, at: at.toISOString(), by: 'demo' }
  if (s === 'given') {
    entry.amount = pick(random, [5, 10, 10, 10, 15, 15, 20, 20, 20, 30, 50])
    entry.mode = random() < 0.72 ? 'cash' : 'cheque'
  }
  return entry
}

export async function seedDemo() {
  const random = rng(88)
  const year = new Date().getFullYear()
  const docs = {
    'settings/app': { amicale: 'Amicale des sapeurs-pompiers (démo)', year, rankingForMembers: false },
    [`users/${DEMO_ADMIN_UID}`]: { login: 'admin', name: 'Admin Démo', role: 'admin', tourId: null, active: true },
    '_accounts/admin@calentour_app': { uid: DEMO_ADMIN_UID, password: 'demo1234' },
    '_accounts/tournee2@calentour_app': { uid: DEMO_MEMBER_UID, password: 'demo1234' },
  }

  let streetIndex = 0
  TOURS.forEach((t, ti) => {
    const id = `t${t.number}`
    const members = [FIRST_NAMES[(ti * 2) % FIRST_NAMES.length], FIRST_NAMES[(ti * 2 + 1) % FIRST_NAMES.length]]
    const pieces = []
    const houses = []
    t.lines.forEach((line, li) => {
      const pieceId = `${id}p${li}`
      const street = STREETS[streetIndex++ % STREETS.length]
      pieces.push({ id: pieceId, name: street, lines: [{ c: flatten(line) }] })
      const len = lineLength(line)
      let n = 1
      for (let along = 10; along < len - 5; along += 26) {
        const side = n % 2 ? 1 : -1
        const [lng, lat] = offsetPoint(line, along, side * 14)
        const house = {
          id: `${pieceId}h${n}`, number: String(n), label: `${n} ${street}`, city: '',
          lng, lat, pieceId, along: Math.round(projectOnLine([lng, lat], line).along),
        }
        if (random() < 0.035) house.units = Array.from({ length: 4 + Math.floor(random() * 6) }, (_, i) => ({ id: `u${i + 1}`, label: `Appt ${i + 1}` }))
        houses.push(house)
        n++
      }
    })
    docs[`tours/${id}`] = { number: t.number, name: members.join(' / '), members, color: t.color, pieces, houses }

    // Avancement différent d'une tournée à l'autre.
    const progress = 0.15 + random() * 0.7
    const h = {}
    for (const house of houses) {
      const keys = house.units?.length ? house.units.map((u) => dwellingKey(house.id, u.id)) : [dwellingKey(house.id)]
      for (const key of keys) if (random() < progress) h[key] = makeEntry(random, 9)
    }
    docs[`campaigns/${year}/state/${id}`] = { h }
  })

  docs[`users/${DEMO_MEMBER_UID}`] = { login: 'tournee2', name: docs['tours/t2'].name, role: 'member', tourId: 't2', active: true }
  return docs
}
