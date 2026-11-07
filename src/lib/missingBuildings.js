// Maisons sans bâtiment : dernière recherche à l'IGN, partagée entre la pastille du menu,
// l'onglet des réglages et le placement guidé. Gardée sur l'appareil une journée : la
// recherche télécharge les bâtiments de toute la zone (une vingtaine de Mo), ce qui
// ralentissait les cartes ouvertes en même temps (même serveur que la photo satellite).
import { useEffect, useState } from 'react'
import { scanMissing } from './ignBuildings'
import { loadLocal, saveLocal } from './localStore'

const SAVED = 'missing-scan'
const KEEP = 24 * 3600 * 1000

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
      scan = { at: Date.now(), checked: res.checked, failed: res.failed, ids: res.missing.map(({ tour, house }) => [tour.id, house.id, house.lng, house.lat]) }
      if (!res.failed) saveLocal(SAVED, scan)
    })
    .finally(() => {
      progress = null
      running = null
      emit()
    })
  return running
}

// Dernière recherche gardée sur l'appareil (moins d'un jour), sans rien télécharger.
// Renvoie vrai si une recherche est connue.
let peek = null
export function loadSavedMissing() {
  if (scan) return Promise.resolve(true)
  if (!peek) {
    peek = loadLocal(SAVED).then((saved) => {
      if (!scan && saved?.at && Date.now() - saved.at < KEEP && Array.isArray(saved.ids)) {
        scan = saved
        emit()
      }
      return Boolean(scan)
    })
  }
  return peek
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
