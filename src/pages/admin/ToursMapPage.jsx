import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import TourMap, { tourBounds } from '../../components/map/TourMap'
import TourForm from '../../components/TourForm'
import Sheet from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { TOUR_COLORS } from '../../config/constants'
import { useData } from '../../context/DataContext'
import { formatEuro, formatPercent } from '../../lib/format'
import { globalStats, tourStats } from '../../lib/stats'
import { findHouses } from '../../lib/tourBuilder'
import { createTour, loadInitialTours, removeTour, saveTour } from '../../services/tours'
import TourMapEditor from './TourMapEditor'

// Carte de toutes les tournées, en plein écran : on en touche une pour la modifier,
// on en crée une nouvelle directement.
export default function ToursMapPage() {
  const { tours, toursById, statesById, users, settings } = useData()
  const toast = useToast()
  const [selectedId, setSelectedId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [showHouses, setShowHouses] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const global = useMemo(() => (showProgress ? globalStats(tours, statesById) : null), [showProgress, tours, statesById])

  // Les tournées de l'amicale sont chargées d'office la première fois.
  const loading = useRef(false)
  useEffect(() => {
    if (loading.current || !settings || settings.toursLoaded || tours.length) return
    loading.current = true
    loadInitialTours(tours)
      .then((n) => toast(`${n} tournées chargées. Recherche des maisons en cours…`))
      .catch((err) => toast(`Chargement des tournées impossible : ${err.message}`))
  }, [settings, tours, toast])

  // Les tournées qui ont des rues mais pas encore de maisons sont complétées toutes seules.
  const [searching, setSearching] = useState(null)
  const searched = useRef(new Set())
  useEffect(() => {
    // Pendant l'édition d'une tournée, c'est l'éditeur qui cherche ses maisons.
    if (searching || editId) return
    const next = tours.find((t) => t.pieces.length && !t.houses.length && !searched.current.has(t.id))
    if (!next) return
    searched.current.add(next.id)
    const left = tours.filter((t) => t.pieces.length && !t.houses.length).length
    setSearching({ number: next.number, left })
    findHouses(next)
      .then((res) => saveTour(next.id, { pieces: res.pieces, houses: res.houses }))
      .catch((err) => toast(`Tournée ${next.number} : maisons introuvables (${err.message})`))
      .finally(() => setSearching(null))
  }, [tours, searching, editId, toast])
  const [creating, setCreating] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [map, setMap] = useState(null)
  const selected = toursById[selectedId] ?? null
  const editing = toursById[editId] ?? null
  const stats = useMemo(() => (selected ? tourStats(selected, statesById[selected.id]) : null), [selected, statesById])
  const account = selected ? users.find((u) => u.tourId === selected.id && u.active) : null

  const select = (id) => {
    setSelectedId(id)
    setListOpen(false)
    const b = id && tourBounds([toursById[id]])
    if (b && map) map.fitBounds(b, { padding: { top: 90, bottom: 200, left: 40, right: 60 }, maxZoom: 17, duration: 700, pitch: map.getPitch() })
  }

  // Toucher un trait de rue sélectionne sa tournée ; toucher ailleurs désélectionne.
  const onMapClick = (e, m) => {
    const box = [[e.point.x - 16, e.point.y - 16], [e.point.x + 16, e.point.y + 16]]
    const hit = m.queryRenderedFeatures(box, { layers: ['pieces'] })[0]
    setSelectedId(hit?.properties.tourId ?? null)
  }

  const nextNumber = Math.max(0, ...tours.map((t) => t.number)) + 1
  const create = async (values) => {
    const id = await createTour(values)
    setCreating(false)
    setSelectedId(id)
    setEditId(id)
    toast(`Tournée ${values.number} créée : touche ses rues sur la carte`)
  }

  const remove = async () => {
    if (!window.confirm(`Supprimer définitivement la tournée ${selected.number} (${selected.name}) ? Ses rues, ses maisons et ses dons seront supprimés, ses accès désactivés.`)) return
    await removeTour(selected, users)
    toast(`Tournée ${selected.number} supprimée`)
    setSelectedId(null)
  }

  return (
    <div className="fullmap">
      <TourMap
        tours={tours} statesById={statesById} focusTourId={selectedId}
        showHouses={showHouses} showProgress={showProgress} showLabels
        fitPadding={{ top: 80, bottom: 60, left: 30, right: 60 }}
        onMapClick={onMapClick}
        onHouseClick={(p) => setSelectedId(p.tourId)}
        onReady={setMap}
        className="fullmap-map"
      />

      <div className="tours-map-top">
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>＋ Nouvelle tournée</button>
        <button type="button" onClick={() => setListOpen(true)}>☰ {tours.length} tournée{tours.length > 1 ? 's' : ''}</button>
        <button type="button" className={`layer-btn${showHouses ? ' on' : ''}`} aria-pressed={showHouses} onClick={() => setShowHouses((v) => !v)}>
          <span className="check">{showHouses ? '✓' : ''}</span>Maisons
        </button>
        <button type="button" className={`layer-btn${showProgress ? ' on' : ''}`} aria-pressed={showProgress} onClick={() => setShowProgress((v) => !v)}>
          <span className="check">{showProgress ? '✓' : ''}</span>Avancement
        </button>
      </div>

      {searching && <div className="map-note">Recherche des maisons · tournée {searching.number} ({searching.left} restante{searching.left > 1 ? 's' : ''})</div>}

      {global && !selected && (
        <div className="map-panel progress-legend">
          <div className="map-panel-info">
            <span className="kicker">Avancement global</span>
            <strong className="big-num">{formatPercent(global.progress)}</strong>
            <div className="small muted">{global.done} maisons faites sur {global.total} · {formatEuro(global.amount)}</div>
          </div>
          <div className="legend-scale"><i /><span>0 %</span><span>50 %</span><span>100 %</span></div>
        </div>
      )}

      {selected && (
        <div className="map-panel">
          <div className="map-panel-info">
            <strong className="ellipsis"><span className="swatch" style={{ background: selected.color }} />{selected.number}. {selected.name}</strong>
            <div className="map-panel-bar"><i style={{ width: `${Math.round(stats.progress * 100)}%` }} /></div>
            <div className="small muted ellipsis">
              {selected.pieces.length} rue{selected.pieces.length > 1 ? 's' : ''} · {stats.total} maisons · {formatPercent(stats.progress)} · {formatEuro(stats.amount)}
              {account ? ` · 🔑 ${account.login}` : ''}
            </div>
          </div>
          <div className="stack-sm">
            <button type="button" className="btn-primary btn-sm" onClick={() => setEditId(selected.id)}>✏️ Rues</button>
            <div className="row">
              <Link to={`/admin/tournees/${selected.id}`} className="btn btn-sm" aria-label="Fiche de la tournée">⚙️</Link>
              <button type="button" className="btn-sm danger" onClick={remove} aria-label="Supprimer la tournée">🗑️</button>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <Sheet title="Nouvelle tournée" subtitle="Ensuite, touche ses rues sur la carte." onClose={() => setCreating(false)}>
          <TourForm
            initial={{ number: nextNumber, members: [], color: TOUR_COLORS[(nextNumber - 1) % TOUR_COLORS.length] }}
            tours={tours}
            submitLabel="Créer et tracer ses rues"
            onSubmit={create}
          />
        </Sheet>
      )}

      {listOpen && (
        <Sheet title="Tournées" onClose={() => setListOpen(false)}>
          <ul className="tour-pick-list">
            {tours.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => select(t.id)}>
                  <span className="swatch" style={{ background: t.color }} />
                  <span className="spacer"><strong>{t.number}. {t.name}</strong></span>
                  <span className="small muted">{t.houses.length} maisons</span>
                </button>
              </li>
            ))}
            {!tours.length && <li className="muted small">Aucune tournée. Crée la première avec « Nouvelle tournée ».</li>}
          </ul>
        </Sheet>
      )}

      {editing && <TourMapEditor tour={editing} onClose={() => setEditId(null)} />}
    </div>
  )
}
