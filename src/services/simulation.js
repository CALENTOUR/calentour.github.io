import { deleteDoc, setDoc } from 'firebase/firestore'
import { dwellings } from '../lib/stats'
import { stateRef } from './paths'

// TEMPORAIRE : simulation d'avancement pour tester l'affichage. À supprimer.
const pick = (r) => (r < 0.6 ? 'given' : r < 0.75 ? 'again' : r < 0.9 ? 'refused' : 'empty')

export function simulateProgress(year, tours) {
  const at = new Date().toISOString()
  return Promise.all(tours.map((t) => {
    const p = Math.random() * 0.9
    const h = {}
    for (const { key } of dwellings(t)) {
      if (Math.random() >= p) continue
      const s = pick(Math.random())
      h[key] = { s, amount: s === 'given' ? 5 + Math.round(Math.random() * 15) : 0, mode: s === 'given' ? (Math.random() < 0.8 ? 'cash' : 'cheque') : null, at, by: 'simulation' }
    }
    return setDoc(stateRef(year, t.id), { h })
  }))
}

export const resetProgress = (year, tours) => Promise.all(tours.map((t) => deleteDoc(stateRef(year, t.id))))
