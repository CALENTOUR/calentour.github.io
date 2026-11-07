// Maisons hors tournée : bâtiments habités des communes des tournées qu'aucune tournée n'a.
// Le résultat de l'analyse (les bâtiments restants) est enregistré dans la base
// (analyses/uncovered) : tous les admins le retrouvent, sur tout appareil, sans refaire
// l'analyse. Elle ne se refait que sur « Relancer ». La liste est recalculée sur les
// tournées à jour : une maison ajoutée ou écartée disparaît tout de suite.
import { useEffect, useState } from 'react'
import { getDoc, setDoc } from 'firebase/firestore'
import { buildingsOf, communesOf, uncoveredBuildings } from './addressCheck'
import { analysisRef } from '../services/paths'

const MAX_SAVED = 900_000 // octets : sous la limite d'un document Firestore (1 Mo)

// Garde seulement les bâtiments encore hors tournée, pour un document léger.
async function saveAnalysis(tours, all, user) {
  const left = uncoveredBuildings(tours, all).map((r) => r.b)
  const data = JSON.stringify(left)
  const at = Date.now()
  const saved = Object.assign(left, { at, byName: user?.name ?? '' })
  if (data.length < MAX_SAVED) {
    await setDoc(analysisRef('uncovered'), { at, by: user?.uid ?? null, byName: user?.name ?? '', count: left.length, data })
      .catch((err) => console.warn('Analyse non enregistrée', err))
  }
  return saved
}

let buildings = null
let progress = null // { done, total } pendant le téléchargement
let error = null
let running = null
const listeners = new Set()
const emit = () => listeners.forEach((cb) => cb())

export function runUncoveredScan(tours, { force = false, user = null } = {}) {
  if (running) return running
  const codes = communesOf(tours ?? [])
  progress = { done: 0, total: codes.length }
  error = null
  emit()
  running = buildingsOf(codes, (done, total) => { progress = { done, total }; emit() }, { force })
    .then((res) => saveAnalysis(tours ?? [], res, user))
    .then((res) => { buildings = res })
    .catch((err) => { error = err.message })
    .finally(() => {
      progress = null
      running = null
      emit()
    })
  return running
}

// Reprend la dernière analyse enregistrée dans la base (sans rien télécharger), pour la
// pastille du menu dès l'ouverture et pour l'onglet. Renvoie vrai si elle existe.
let loading = null
export function loadSavedUncovered() {
  if (buildings) return Promise.resolve(true)
  if (!loading) {
    loading = getDoc(analysisRef('uncovered'))
      .then((snap) => {
        const d = snap.exists() ? snap.data() : null
        if (!d?.data || buildings) return Boolean(buildings)
        buildings = Object.assign(JSON.parse(d.data), { at: d.at, byName: d.byName ?? '' })
        emit()
        return true
      })
      .catch(() => {
        loading = null
        return false
      })
  }
  return loading
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
