// Petit stockage durable sur l'appareil (IndexedDB), pour garder des téléchargements
// longs d'une visite à l'autre. Tout échec (navigation privée, stockage plein) est
// silencieux : l'appli retélécharge simplement.
const DB = 'calentour-cache'
const STORE = 'kv'
let opening = null

function open() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }).catch((err) => {
      opening = null
      throw err
    })
  }
  return opening
}

export async function loadLocal(key) {
  try {
    const db = await open()
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function saveLocal(key, value) {
  try {
    const db = await open()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // stockage indisponible : rien de grave
  }
}
