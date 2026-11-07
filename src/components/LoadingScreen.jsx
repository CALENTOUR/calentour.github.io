import { useEffect, useState } from 'react'
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore'
import { db } from '../lib/firebase'
import Logo from './ui/Logo'

const SLOW = 12000 // ms avant de proposer de l'aide

// Efface le cache local de la base (pas la connexion au compte), le cache hors ligne
// de l'appli et son service worker, puis recharge. Sert quand le stockage du téléphone
// est bloqué et que l'appli reste sur « Chargement… ».
async function repair() {
  try { await terminate(db) } catch { /* déjà arrêtée */ }
  try { await clearIndexedDbPersistence(db) } catch { /* rien à effacer */ }
  try {
    const dbs = (await indexedDB.databases?.()) ?? []
    await Promise.all(dbs.filter((d) => d.name?.startsWith('firestore/')).map((d) => new Promise((ok) => {
      const req = indexedDB.deleteDatabase(d.name)
      req.onsuccess = ok; req.onerror = ok; req.onblocked = ok
    })))
  } catch { /* navigateur sans liste des bases */ }
  try { await Promise.all((await caches.keys()).map((k) => caches.delete(k))) } catch { /* pas de cache */ }
  try { await Promise.all((await navigator.serviceWorker?.getRegistrations?.() ?? []).map((r) => r.unregister())) } catch { /* pas de service worker */ }
  window.location.reload()
}

// Écran d'attente. Au bout de quelques secondes, il dit ce qui bloque et propose de
// recharger, puis de réparer l'appli.
export default function LoadingScreen({ label = 'Chargement…', waiting = [] }) {
  const [slow, setSlow] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW)
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => { clearTimeout(t); window.removeEventListener('online', on); window.removeEventListener('offline', on) }
  }, [])
  const fix = () => {
    if (!window.confirm('Réparer l’appli ? Tu restes connecté. Les passages saisis sans réseau et pas encore envoyés seront perdus.')) return
    setBusy(true)
    repair()
  }
  return (
    <div className="login-screen">
      <div className="login-card stack">
        <Logo size={72} className="logo-big pulse" />
        <p className="muted">{label}</p>
        {slow && (
          <div className="stack loading-help">
            <strong>Ça prend plus de temps que prévu.</strong>
            <p className="small">{online ? 'Le téléphone est connecté à internet.' : 'Pas de réseau : la première ouverture a besoin d’internet.'}</p>
            {waiting.length > 0 && <p className="small muted">En attente : {waiting.join(', ')}.</p>}
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>Réessayer</button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={fix}>{busy ? 'Réparation…' : 'Toujours bloqué ? Réparer l’appli'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
