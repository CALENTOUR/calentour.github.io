// Maisons sans bâtiment : dernière recherche à l'IGN, partagée entre la pastille du menu,
// l'onglet des réglages et le placement guidé. Gardée en mémoire le temps de la visite.
import { useEffect, useState } from 'react'
import { scanMissing } from './ignBuildings'

let scan = null // { ids: [[tourId, houseId, lng, lat]], checked, failed }
let progress = null // { done, total } pendant une recherche
let running = null
const listeners = new Set()
const emit = () => listeners.forEach((cb) => cb())

export function runMissingScan(tours) {
  if (running) return running
  progress = { done: 0, total: 0 }
  emit()
  running = scanMissing(tours ?? [], (done, total) => { progress = { done, total }; emit() })
    .then((res) => {
      scan = { ...res, ids: res.missing.map(({ tour, house }) => [tour.id, house.id, house.lng, house.lat]) }
    })
    .finally(() => {
      progress = null
      running = null
      emit()
    })
  return running
}

// Maisons encore à traiter, d'après les tournées à jour : celles déplacées, gardées
// ou retirées depuis la recherche disparaissent.
export function missingRows(toursById) {
  return (scan?.ids ?? []).map(([tourId, houseId, lng, lat]) => {
    const tour = toursById[tourId]
    const house = tour?.houses?.find((h) => h.id === houseId)
    return house && !house.noBuilding && house.lng === lng && house.lat === lat ? { tour, house } : null
  }).filter(Boolean).sort((a, b) => a.tour.number - b.tour.number || String(a.house.label).localeCompare(String(b.house.label), 'fr', { numeric: true }))
}

export function useMissingBuildings(toursById) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const cb = () => setTick((n) => n + 1)
    listeners.add(cb)
    return () => listeners.delete(cb)
  }, [])
  return { scan, progress, rows: scan ? missingRows(toursById ?? {}) : [] }
}
