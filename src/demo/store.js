// Mini base de données locale pour la version de démonstration (aucun serveur).
// Imite le strict nécessaire de Firestore : documents rangés par chemin,
// écritures fusionnées, écouteurs temps réel. Persistée dans localStorage.
import { seedDemo } from './seed'
import { DEMO_STORAGE_KEY } from './reset'

const STORAGE_KEY = DEMO_STORAGE_KEY
export const DELETE = { __op: 'delete' }
export const TIMESTAMP = { __op: 'timestamp' }

let docs = {}
const listeners = new Set()

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? null
  } catch {
    return null
  }
}

let saveTimer = null
function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
    } catch {
      // quota dépassé ou navigation privée : la démo reste en mémoire
    }
  }, 300)
}

function notify() {
  persist()
  for (const l of listeners) l()
}

function resolveValue(value, existing, merge) {
  if (value === TIMESTAMP) return new Date().toISOString()
  if (value && typeof value === 'object' && !Array.isArray(value) && value !== DELETE) {
    const base = merge && existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {}
    for (const [k, v] of Object.entries(value)) {
      if (v === DELETE) delete base[k]
      else base[k] = resolveValue(v, base[k], merge)
    }
    return base
  }
  return value
}

export function readDoc(path) {
  return docs[path] ?? null
}

export function listCollection(path) {
  const depth = path.split('/').length + 1
  return Object.entries(docs)
    .filter(([p]) => p.startsWith(`${path}/`) && p.split('/').length === depth)
    .map(([p, data]) => ({ id: p.split('/').pop(), data }))
}

export function applyWrite({ type, path, data, merge }) {
  if (type === 'delete') delete docs[path]
  else if (type === 'set') docs[path] = resolveValue(data, docs[path], merge)
  else if (type === 'update') {
    if (!docs[path]) throw new Error(`Document introuvable : ${path}`)
    const next = { ...docs[path] }
    for (const [k, v] of Object.entries(data)) {
      if (v === DELETE) delete next[k]
      else next[k] = resolveValue(v, undefined, false)
    }
    docs[path] = next
  }
}

export function write(ops) {
  ops.forEach(applyWrite)
  notify()
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Données de départ : chargées depuis localStorage, sinon générées.
export const ready = (async () => {
  const saved = load()
  if (saved && Object.keys(saved).length) {
    docs = saved
    return
  }
  docs = await seedDemo()
  notify()
})()
