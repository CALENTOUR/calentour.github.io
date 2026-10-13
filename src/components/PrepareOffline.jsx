import { useState } from 'react'
import { prefetchMap } from '../lib/offlineMap'
import { tourBounds } from './map/TourMap'

const KEY = (id) => `calentour:offline:${id}`

export default function PrepareOffline({ tour }) {
  const [progress, setProgress] = useState(null)
  const [doneAt, setDoneAt] = useState(() => {
    try { return localStorage.getItem(KEY(tour.id)) } catch { return null }
  })
  const run = async () => {
    const b = tourBounds([tour])
    if (!b) return
    setProgress(0)
    try {
      const res = await prefetchMap(b, (d, t) => setProgress(d / t))
      const stamp = new Date().toLocaleDateString('fr-FR')
      try { localStorage.setItem(KEY(tour.id), stamp) } catch { /* stockage indisponible */ }
      setDoneAt(res.failed ? null : stamp)
      setProgress(res.failed ? 'partial' : null)
    } catch {
      setProgress('error')
    }
  }
  return (
    <div className="card offline-card">
      <div className="row">
        <div className="spacer">
          <strong>📥 Préparer le hors ligne</strong>
          <div className="small muted">
            {doneAt ? `Carte téléchargée le ${doneAt}.` : 'À faire avec du réseau (wifi), avant de partir.'}
            {progress === 'partial' && ' Une partie n’a pas pu être téléchargée, réessaie.'}
            {progress === 'error' && ' Pas de réseau, réessaie plus tard.'}
          </div>
        </div>
        <button type="button" className="btn-sm" disabled={typeof progress === 'number'} onClick={run}>
          {typeof progress === 'number' ? `${Math.round(progress * 100)} %` : doneAt ? 'Mettre à jour' : 'Télécharger'}
        </button>
      </div>
    </div>
  )
}
