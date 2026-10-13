import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { useToast } from '../../components/ui/Toast'
import StatusBar from '../../components/ui/StatusBar'
import { formatPercent } from '../../lib/format'
import { parseKml } from '../../lib/kml'
import { tourStats } from '../../lib/stats'
import { findHouses } from '../../lib/tourBuilder'
import { importTours, newTourDoc, saveTour } from '../../services/tours'
import { doc } from 'firebase/firestore'
import { toursCol } from '../../services/paths'

function ImportKml({ tours }) {
  const toast = useToast()
  const input = useRef(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = parseKml(await file.text())
      if (!parsed.length) throw new Error('Aucun trait de rue trouvé dans ce fichier.')
      setPreview(parsed)
    } catch (err) {
      toast(err.message)
    }
  }

  const confirm = async () => {
    setBusy(true)
    try {
      await importTours(preview, tours)
      toast(`${preview.length} tournées créées. Étape suivante : chercher les maisons.`)
      setPreview(null)
    } catch (err) {
      toast(`Import impossible : ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card stack">
      <div className="row">
        <div className="spacer">
          <h2>1. Importer votre carte Google</h2>
          <p className="small muted">Dans Google My Maps : menu ⋮ › Télécharger le fichier KML › cocher « Exporter au format .KML ». Chaque trait devient une rue, chaque nom (ex. « 6 Aude / Logan ») un binôme.</p>
        </div>
        <input ref={input} type="file" accept=".kml,application/vnd.google-earth.kml+xml" hidden onChange={onFile} />
        <button type="button" className="btn-primary" onClick={() => input.current.click()}>📂 Choisir le fichier KML</button>
      </div>
      {preview && (
        <div className="stack">
          <p><strong>{preview.length} tournées</strong> et <strong>{preview.reduce((n, t) => n + t.pieces.length, 0)} rues</strong> trouvées.
            {tours.length ? ' Les tournées qui ont le même numéro seront remplacées.' : ''}</p>
          <div className="chips">
            {preview.map((t) => <span key={t.number} className="chip" style={{ borderColor: t.color ?? undefined }}>{t.number}. {t.name} ({t.pieces.length})</span>)}
          </div>
          <div className="row">
            <button type="button" className="btn-ghost" onClick={() => setPreview(null)}>Annuler</button>
            <button type="button" className="btn-primary" disabled={busy} onClick={confirm}>{busy ? 'Création…' : `Créer les ${preview.length} tournées`}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function FindAllHouses({ tours }) {
  const toast = useToast()
  const [progress, setProgress] = useState(null)
  const todo = tours.filter((t) => t.pieces.length && !t.houses.length)

  const run = async () => {
    let total = 0
    for (let i = 0; i < todo.length; i++) {
      const t = todo[i]
      setProgress({ index: i + 1, count: todo.length, name: t.name, pct: 0 })
      try {
        const res = await findHouses(t, (d, n) => setProgress((p) => ({ ...p, pct: d / n })))
        await saveTour(t.id, { pieces: res.pieces, houses: res.houses })
        total += res.addedCount
      } catch (err) {
        toast(`Tournée ${t.number} : ${err.message}`)
      }
    }
    setProgress(null)
    toast(`${total} maisons ajoutées.`)
  }

  if (!tours.length) return null
  return (
    <div className="card stack">
      <div className="row">
        <div className="spacer">
          <h2>2. Placer les maisons</h2>
          <p className="small muted">Les maisons sont prises dans la Base Adresse Nationale (adresses officielles), le long de chaque rue tracée. Tu pourras corriger chaque tournée ensuite.</p>
        </div>
        <button type="button" className="btn-primary" disabled={!todo.length || Boolean(progress)} onClick={run}>
          {progress ? `Tournée ${progress.index}/${progress.count} · ${Math.round(progress.pct * 100)} %` : todo.length ? `🏠 Chercher les maisons (${todo.length} tournées)` : '✓ Toutes les tournées ont leurs maisons'}
        </button>
      </div>
    </div>
  )
}

export default function ToursPage() {
  const { tours, statesById, users } = useData()
  const toast = useToast()

  const addTour = async () => {
    const number = Math.max(0, ...tours.map((t) => t.number)) + 1
    const ref = doc(toursCol())
    await saveTour(ref.id, newTourDoc({ number, name: `Tournée ${number}` }))
    toast(`Tournée ${number} créée`)
  }

  return (
    <div className="page stack-lg">
      <div className="row">
        <h1 className="spacer">Tournées</h1>
        <button type="button" onClick={addTour}>＋ Nouvelle tournée</button>
      </div>
      <ImportKml tours={tours} />
      <FindAllHouses tours={tours} />
      <div className="tour-grid">
        {tours.map((t) => {
          const s = tourStats(t, statesById[t.id])
          const account = users.find((u) => u.tourId === t.id && u.active)
          return (
            <Link key={t.id} to={`/admin/tournees/${t.id}`} className="tour-card" style={{ '--tour': t.color }}>
              <div className="tour-card-num">{t.number}</div>
              <div className="spacer">
                <strong>{t.name}</strong>
                <div className="small muted">{t.pieces.length} rues · {s.total} habitations · {formatPercent(s.progress)}</div>
                <StatusBar counts={s.counts} total={s.total} height={6} />
                <div className="small">{account ? `🔑 ${account.login}` : <span className="warn">Pas encore d’accès</span>}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
