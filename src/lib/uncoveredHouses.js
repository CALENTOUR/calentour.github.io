// Maisons hors tournée : bâtiments habités des communes des tournées, téléchargés une fois
// par visite. La liste est recalculée sur les tournées à jour : une maison ajoutée ou
// écartée disparaît tout de suite.
import { useEffect, useState } from 'react'
import { buildingsOf, communesOf, uncoveredBuildings } from './addressCheck'

let buildings = null
let progress = null // { done, total } pendant le téléchargement
let error = null
let running = null
const listeners = new Set()
const emit = () => listeners.forEach((cb) => cb())

export function runUncoveredScan(tours) {
  if (running) return running
  const codes = communesOf(tours ?? [])
  progress = { done: 0, total: codes.length }
  error = null
  emit()
  running = buildingsOf(codes, (done, total) => { progress = { done, total }; emit() })
    .then((res) => { buildings = res })
    .catch((err) => { error = err.message })
    .finally(() => {
      progress = null
      running = null
      emit()
    })
  return running
}

// Calcul gardé tant que ni les tournées ni les bâtiments ne changent (menu, onglet et liste
// le demandent en même temps).
let last = { tours: null, buildings: null, rows: [] }
function rowsFor(tours) {
  if (!buildings) return []
  if (last.tours !== tours || last.buildings !== buildings) last = { tours, buildings, rows: uncoveredBuildings(tours ?? [], buildings) }
  return last.rows
}

export function useUncoveredHouses(tours) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const cb = () => setTick((n) => n + 1)
    listeners.add(cb)
    return () => listeners.delete(cb)
  }, [])
  return { buildings, progress, error, rows: rowsFor(tours) }
}
