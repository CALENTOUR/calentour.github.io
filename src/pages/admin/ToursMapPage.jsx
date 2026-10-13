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
import { Access, Identity } from './TourEditPage'
import TourMapEditor from './TourMapEditor'

// Onglet Tournées : la carte de toutes les tournées, avec ses calques. Le bandeau
// de côté choisit les tournées affichées ; toucher une tournée donne tous ses
// boutons (rues, équipe et accès, suppression). Le mode plein écran masque le
// reste de l'application.
export default function ToursMapPage() {
  const { tours, toursById, statesById, users, settings } = useData()
  const toast = useToast()
  const [selectedId, setSelectedId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [teamId, setTeamId] = useState(null)
  // Tournées masquées (toutes visibles au départ, les nouvelles aussi).
  const [hidden, setHidden] = useState(() => new Set())
  const [panelOpen, setPanelOpen] = useState(() => window.matchMedia?.('(min-width: 900px)').matches ?? false)
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
  const [map, setMap] = useState(null)
  const editing = toursById[editId] ?? null
  const team = toursById[teamId] ?? null

  // Plein écran : la carte prend tout l'écran (barre, menu et onglets masqués),
  // et l'écran entier du navigateur quand il le permet.
  const [full, setFull] = useState(false)
  useEffect(() => {
    document.body.classList.toggle('immersive', full)
    return () => document.body.classList.remove('immersive')
  }, [full])
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setFull(false) }
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    }
  }, [])
  const toggleFull = () => {
    if (full) {
      setFull(false)
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    } else {
      setFull(true)
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }
  const shown = useMemo(() => tours.filter((t) => !hidden.has(t.id)), [tours, hidden])
  const selected = (!hidden.has(selectedId) && toursById[selectedId]) || null
  const stats = useMemo(() => (selected ? tourStats(selected, statesById[selected.id]) : null), [selected, statesById])
  const perTour = useMemo(() => Object.fromEntries(tours.map((t) => [t.id, tourStats(t, statesById[t.id])])), [tours, statesById])
  const account = selected ? users.find((u) => u.tourId === selected.id && u.active) : null

  const fitTo = (list) => {
    const b = list.length && tourBounds(list)
    if (b && map) map.fitBounds(b, { padding: { top: 90, bottom: 200, left: 40, right: 60 }, maxZoom: 17, duration: 700, pitch: map.getPitch() })
  }
  const toggle = (id) => setHidden((h) => {
    const next = new Set(h)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const only = (id) => {
    setHidden(new Set(tours.filter((t) => t.id !== id).map((t) => t.id)))
    setSelectedId(id)
    fitTo([toursById[id]])
    if (!window.matchMedia?.('(min-width: 900px)').matches) setPanelOpen(false)
  }
  const showAll = () => { setHidden(new Set()); fitTo(tours) }

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
    setHidden((h) => { const next = new Set(h); next.delete(id); return next })
    setSelectedId(id)
    setEditId(id)
    toast(`Tournée ${values.number} créée : ajoute ses rues`)
  }

  const remove = async () => {
    if (!window.confirm(`Supprimer définitivement la tournée ${selected.number} (${selected.name}) ? Ses rues, ses maisons et ses dons seront supprimés, ses accès désactivés.`)) return
    await removeTour(selected, users)
    toast(`Tournée ${selected.number} supprimée`)
    setSelectedId(null)
  }

  return (
    <div className={`fullmap tours-map${panelOpen ? ' panel-open' : ''}${full ? ' is-full' : ''}`}>
      <TourMap
        tours={shown} statesById={statesById} focusTourId={selected?.id ?? null}
        showHouses={showHouses} showProgress={showProgress} showLabels
        fitPadding={{ top: 80, bottom: 60, left: 30, right: 60 }}
        onMapClick={onMapClick}
        onHouseClick={(p) => setSelectedId(p.tourId)}
        onReady={setMap}
        className="fullmap-map"
      />

      <aside className="tours-panel" aria-label="Tournées affichées">
        <div className="tours-panel-head">
          <strong className="spacer">Tournées affichées <span className="muted small">{shown.length}/{tours.length}</span></strong>
          <button type="button" className="btn-round btn-ghost tours-panel-close" onClick={() => setPanelOpen(false)} aria-label="Fermer le bandeau">✕</button>
        </div>
        <div className="row tours-panel-all">
          <button type="button" className="btn-sm spacer" onClick={showAll}>Toutes</button>
          <button type="button" className="btn-sm spacer" onClick={() => { setHidden(new Set(tours.map((t) => t.id))); setSelectedId(null) }}>Aucune</button>
        </div>
        <ul className="tours-panel-list">
          {tours.map((t) => {
            const on = !hidden.has(t.id)
            return (
              <li key={t.id} className={`${on ? 'on' : ''}${selected?.id === t.id ? ' sel' : ''}`} style={{ '--tour': t.color }}>
                <label className="tour-check">
                  <input type="checkbox" checked={on} onChange={() => toggle(t.id)} />
                  <span className="tour-check-box" aria-hidden="true">{on ? '✓' : ''}</span>
                </label>
                <button type="button" className="tour-row" onClick={() => only(t.id)} title="Afficher seulement cette tournée">
                  <strong className="ellipsis">{t.number}. {t.name}</strong>
                  <span className="small muted">{formatPercent(perTour[t.id].progress)} · {t.houses.length} maisons</span>
                </button>
              </li>
            )
          })}
          {!tours.length && <li className="muted small">Aucune tournée pour l’instant.</li>}
        </ul>
      </aside>

      <div className="tours-map-top">
        <button type="button" className={`full-btn${full ? ' on' : ''}`} onClick={toggleFull} aria-pressed={full} aria-label={full ? 'Quitter le plein écran' : 'Plein écran'} title={full ? 'Quitter le plein écran' : 'Plein écran'}>
          <span aria-hidden="true">{full ? '✕' : '⛶'}</span><span className="hide-mobile">{full ? 'Quitter le plein écran' : 'Plein écran'}</span>
        </button>
        <button type="button" className={`layer-btn tours-panel-btn${panelOpen ? ' on' : ''}`} onClick={() => setPanelOpen((v) => !v)}>☰ Tournées <span className="chip-pct">{shown.length}/{tours.length}</span></button>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>＋ <span className="hide-mobile">Nouvelle </span>tournée</button>
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
        <div className="map-panel tour-panel">
          <div className="map-panel-info">
            <strong className="ellipsis"><span className="swatch" style={{ background: selected.color }} />{selected.number}. {selected.name}</strong>
            <div className="map-panel-bar"><i style={{ width: `${Math.round(stats.progress * 100)}%` }} /></div>
            <div className="small muted ellipsis">
              {selected.pieces.length} rue{selected.pieces.length > 1 ? 's' : ''} · {stats.total} maisons · {formatPercent(stats.progress)} · {formatEuro(stats.amount)}
              {account ? ` · 🔑 ${account.login}` : ''}
            </div>
          </div>
          <div className="tour-actions">
            <button type="button" className="btn-primary" onClick={() => setEditId(selected.id)}>✏️ Modifier les rues</button>
            <button type="button" onClick={() => setTeamId(selected.id)}>👥 Équipe et accès</button>
            <Link to={`/admin/tournees/${selected.id}`} className="btn" title="Ordre des rues, logements, fiche complète">📋 Fiche</Link>
            <button type="button" className="danger" onClick={remove} aria-label="Supprimer la tournée">🗑️ Supprimer</button>
          </div>
        </div>
      )}

      {creating && (
        <Sheet title="Nouvelle tournée" subtitle="Ensuite, ajoute ses rues sur la carte." onClose={() => setCreating(false)}>
          <TourForm
            initial={{ number: nextNumber, members: [], color: TOUR_COLORS[(nextNumber - 1) % TOUR_COLORS.length] }}
            tours={tours}
            submitLabel="Créer et ajouter ses rues"
            onSubmit={create}
          />
        </Sheet>
      )}

      {team && (
        <Sheet title={`Tournée ${team.number}`} subtitle="Équipe et accès du binôme" onClose={() => setTeamId(null)}>
          <div className="stack">
            <Identity key={`${team.id}-${team.number}-${team.name}-${team.color}`} tour={team} />
            <Access tour={team} />
          </div>
        </Sheet>
      )}

      {editing && <TourMapEditor tour={editing} onClose={() => setEditId(null)} />}
    </div>
  )
}
