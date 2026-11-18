import { addDoc, deleteField, getDocs, query, setDoc, where } from 'firebase/firestore'
import { passagesCol, stateRef } from './paths'

// Historique des saisies d'une tournée (chaque passage est gardé, même annulé), du plus ancien au plus récent.
export async function loadPassages(year, tourId) {
  const snap = await getDocs(query(passagesCol(year), where('tourId', '==', tourId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.at).localeCompare(String(b.at)))
}

const entryOf = (p) => (p && p.s !== 'todo'
  ? { s: p.s, amount: p.s === 'given' ? Number(p.amount) || 0 : 0, mode: p.s === 'given' ? p.mode ?? null : null, at: p.at, by: p.by }
  : null)

// État de la tournée à l'instant `until` (ISO) : on part de l'état actuel et on ne
// revient en arrière que sur les habitations touchées après cet instant. Une
// habitation sans saisie dans l'historique n'est donc jamais modifiée.
export function stateAt(current, passages, until) {
  const target = { ...(current ?? {}) }
  const touched = new Set(passages.filter((p) => String(p.at) > until).map((p) => p.key))
  for (const key of touched) {
    const before = passages.filter((p) => p.key === key && String(p.at) <= until).at(-1)
    const e = entryOf(before)
    if (e) target[key] = e
    else delete target[key]
  }
  return target
}

const same = (a, b) => (!a && !b) || (a && b && a.s === b.s && (Number(a.amount) || 0) === (Number(b.amount) || 0) && (a.mode ?? null) === (b.mode ?? null))

// Différences entre l'état actuel et l'état visé : [{ key, from, to }].
export function diffStates(current, target) {
  const keys = new Set([...Object.keys(current ?? {}), ...Object.keys(target ?? {})])
  return [...keys].filter((k) => !same(current?.[k], target?.[k])).map((k) => ({ key: k, from: current?.[k] ?? null, to: target?.[k] ?? null }))
}

// Remet la tournée dans l'état visé. Chaque changement est aussi noté dans l'historique.
export async function restoreState({ year, tourId, changes, user }) {
  const at = new Date().toISOString()
  const h = Object.fromEntries(changes.map((c) => [c.key, c.to ?? deleteField()]))
  await setDoc(stateRef(year, tourId), { h }, { merge: true })
  await Promise.all(changes.map((c) => addDoc(passagesCol(year), {
    tourId, key: c.key, s: c.to?.s ?? 'todo', amount: c.to?.amount ?? 0, mode: c.to?.mode ?? null,
    at, by: user.uid, byName: `${user.name ?? 'Admin'} (restauration)`, restoredFrom: c.to?.at ?? null,
  })))
}
