import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import TourMap, { tourPoints } from '../../components/map/TourMap'
import { fitPoints } from '../../components/map/useMapLibre'
import TourForm from '../../components/TourForm'
import ProgressRing from '../../components/ui/ProgressRing'
import Sheet from '../../components/ui/Sheet'
import { IconCheck, IconExpand, IconEye, IconEyeOff, IconLayers, IconList, IconPencil, IconPlus, IconSearch, IconShrink } from '../../components/ui/Icons'
import { useToast } from '../../components/ui/Toast'
import { TOUR_COLORS } from '../../config/constants'
import { useData } from '../../context/DataContext'
import { formatEuro, formatPercent } from '../../lib/format'
import { globalStats, tourStats } from '../../lib/stats'
import { tourAreas, villagesOf } from '../../lib/places'
import { findHouses } from '../../lib/tourBuilder'
import { createTour, loadInitialTours, nameInitialTours, saveTour } from '../../services/tours'
import TourMapEditor from './TourMapEditor'

// Onglet Tournées : la carte de toutes les tournées, avec ses calques. Le bandeau
// de côté choisit les tournées affichées. Toucher une tournée affiche son
// avancement, ses villages en haut (un toucher zoome sur le village) et un gros
// bouton vers sa fiche, où se trouvent tous ses réglages. Le mode plein écran
// masque le reste de l'application.
export default function ToursMapPage() {
  const { tours, toursById, statesById, settings } = useData()
  const toast = useToast()
  const [selectedId, setSelectedId] = useState(null)
  const [placeSel, setPlaceSel] = useState(null)
  // Village choisi dans le bandeau du haut : gros zoom et contour bleu.
  const [villageSel, setVillageSel] = useState(null)
  const [editId, setEditId] = useState(null)
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

  // Tournées chargées avant que les noms des équipes soient connus : on les nomme une fois.
  const naming = useRef(false)
  useEffect(() => {
    if (naming.current || !settings?.toursLoaded || settings.toursNamed || !tours.length) return
    naming.current = true
    nameInitialTours(tours)
      .then((n) => n && toast(`${n} tournées ont reçu le nom de leur équipe`))
      .catch((err) => toast(`Noms des équipes non enregistrés : ${err.message}`))
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
  const villages = useMemo(() => villagesOf(shown), [shown])
  const village = (!selected && villages.find((v) => v.name === villageSel)) || null
  // Secteurs de la tournée choisie : ses rues regroupées par endroit, chacun nommé
  // d'après son ou ses villages.
  const areasById = useMemo(() => Object.fromEntries(tours.map((t) => [t.id, tourAreas(t)])), [tours])
  const tourPlaces = useMemo(() => (selected ? (areasById[selected.id] ?? []).map((a, i) => ({ ...a, num: i + 1, pieceIds: new Set(a.pieceIds) })) : []), [selected, areasById])
  const place = tourPlaces.find((x) => x.id === placeSel) ?? null
  const mapAreas = useMemo(() => (tourPlaces.length > 1 ? tourPlaces.map((a) => ({ ...a, name: `${a.num} · ${a.name}`, active: a.id === placeSel })) : null), [tourPlaces, placeSel])
  // Chiffres de la tournée choisie, ou de son secteur choisi.
  const shownStats = useMemo(() => {
    if (!stats) return null
    if (!place) return { done: stats.done, total: stats.total, amount: stats.amount, progress: stats.progress, counts: stats.counts }
    const r = { done: 0, total: 0, amount: 0, counts: { todo: 0, given: 0, again: 0, refused: 0, empty: 0 } }
    for (const id of place.pieceIds) {
      const x = stats.byPiece[id]
      if (!x) continue
      r.done += x.done; r.total += x.total; r.amount += x.amount
      for (const k of Object.keys(r.counts)) r.counts[k] += x.counts[k] ?? 0
    }
    return { ...r, progress: r.total ? r.done / r.total : 0 }
  }, [stats, place])

  // Liste des tournées : recherche par binôme, numéro ou village, et filtres.
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const LATE = 0.3
  const doneCount = tours.filter((t) => perTour[t.id].total && perTour[t.id].progress >= 1).length
  const listed = tours.filter((t) => {
    const st = perTour[t.id]
    if (filter === 'late' && !(st.progress < LATE)) return false
    if (filter === 'done' && !(st.total && st.progress >= 1)) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return `${t.number} ${t.name} ${(areasById[t.id] ?? []).map((a) => a.name).join(' ')}`.toLowerCase().includes(q)
  })
  const [layersOpen, setLayersOpen] = useState(false)

  // Marges du cadrage : la place laissée libre par les bandeaux et la fiche de la
  // tournée (en bas sur téléphone, à droite sur ordinateur).
  const padding = () => {
    const c = map.getContainer().getBoundingClientRect()
    const top = document.querySelector('.tours-map-top')?.getBoundingClientRect()
    const card = document.querySelector('.tours-map .map-panel')?.getBoundingClientRect()
    const side = card && card.left > c.left + c.width * 0.4 && card.bottom < c.top + c.height * 0.6
    return {
      top: top ? Math.max(30, top.bottom - c.top + 24) : 60,
      bottom: card && !side ? Math.max(40, c.bottom - card.top + 24) : 50,
      left: 30,
      right: card && side ? Math.max(70, c.right - card.left + 24) : 70,
    }
  }
  // Après un changement d'affichage, on attend que le panneau soit en place pour le mesurer.
  const fitLater = (points, maxZoom) => setTimeout(() => { if (map) fitPoints(map, points, { padding: padding(), maxZoom }) }, 60)
  const fitTo = (list) => list.length && fitLater(tourPoints(list), 17.5)
  // Choix d'une tournée : on oublie le secteur choisi dans la précédente.
  const pick = (id) => {
    setSelectedId(id)
    setPlaceSel(null)
    setVillageSel(null)
  }
  const chooseVillage = (v) => {
    if (villageSel === v.name) {
      setVillageSel(null)
      fitTo(shown)
      return
    }
    setVillageSel(v.name)
    fitLater(v.outline?.coordinates[0] ?? v.points, 18)
  }
  const choosePlace = (p) => {
    if (!p) {
      setPlaceSel(null)
      fitTo([selected])
      return
    }
    setPlaceSel(p.id)
    fitLater(selected.pieces.filter((x) => p.pieceIds.has(x.id)).flatMap((x) => tourPoints([{ pieces: [x] }])), 18.5)
  }
  const toggle = (id) => setHidden((h) => {
    const next = new Set(h)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  // Toucher une carte de la liste : la tournée passe au premier plan et la carte s'y cadre.
  const focus = (id) => {
    setHidden((h) => { if (!h.has(id)) return h; const next = new Set(h); next.delete(id); return next })
    if (id === selectedId) { choosePlace(null); return }
    pick(id)
    fitTo([toursById[id]])
    if (!window.matchMedia?.('(min-width: 900px)').matches) setPanelOpen(false)
  }
  const choosePlaceOf = (id, p) => {
    if (id !== selectedId) { setSelectedId(id); setHidden((h) => { const next = new Set(h); next.delete(id); return next }) }
    setPlaceSel(p.id)
    fitLater(toursById[id].pieces.filter((x) => p.pieceIds.includes(x.id)).flatMap((x) => tourPoints([{ pieces: [x] }])), 18.5)
    if (!window.matchMedia?.('(min-width: 900px)').matches) setPanelOpen(false)
  }
  const ringColor = (st) => (st.progress >= 0.5 ? 'var(--green)' : st.progress >= LATE ? 'var(--orange)' : 'var(--brand)')

  // Toucher un trait de rue sélectionne sa tournée ; toucher ailleurs désélectionne.
  const onMapClick = (e, m) => {
    const box = [[e.point.x - 16, e.point.y - 16], [e.point.x + 16, e.point.y + 16]]
    const hit = m.queryRenderedFeatures(box, { layers: ['pieces'] })[0]
    const id = hit?.properties.tourId ?? null
    // Toucher dans un cercle rouge zoome sur ce secteur de la tournée choisie.
    const area = !hit && m.getLayer('areas-fill') ? m.queryRenderedFeatures(e.point, { layers: ['areas-fill'] })[0] : null
    if (area) return choosePlace(tourPlaces.find((a) => a.id === area.properties.areaId))
    if (id !== selectedId) pick(id)
  }

  const nextNumber = Math.max(0, ...tours.map((t) => t.number)) + 1
  const create = async (values) => {
    const id = await createTour(values)
    setCreating(false)
    setHidden((h) => { const next = new Set(h); next.delete(id); return next })
    pick(id)
    setEditId(id)
    toast(`Tournée ${values.number} créée : ajoute ses rues`)
  }


  return (
    <div className={`fullmap tours-map${panelOpen ? ' panel-open' : ''}${full ? ' is-full' : ''}${selected ? ' has-float' : ''}`}>
      <TourMap
        satelliteSwitch
        tours={shown} statesById={statesById} focusTourId={selected?.id ?? null} autoFit={false}
        showHouses={showHouses} showProgress={showProgress} showLabels areas={mapAreas} outline={village?.outline ?? null}
        fitPadding={{ top: 80, bottom: 60, left: 30, right: 60 }}
        onMapClick={onMapClick}
        onHouseClick={(p) => { if (p.tourId !== selectedId) pick(p.tourId) }}
        onReady={setMap}
        className="fullmap-map"
      />

      <aside className="tours-panel" aria-label="Liste des tournées">
        <div className="tours-panel-head">
          <strong className="spacer tours-count">{tours.length} tournées <span className="small muted">{doneCount} terminée{doneCount > 1 ? 's' : ''}</span></strong>
          <button type="button" className="btn-round btn-ghost tours-panel-close" onClick={() => setPanelOpen(false)} aria-label="Fermer la liste">✕</button>
        </div>
        <label className="tours-search">
          <IconSearch width={16} height={16} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un binôme, un village" aria-label="Chercher une tournée" />
        </label>
        <div className="tours-filters" role="group" aria-label="Filtrer les tournées">
          {[['all', 'Toutes'], ['late', 'À relancer'], ['done', 'Terminées']].map(([k, label]) => (
            <button key={k} type="button" className={filter === k ? 'on' : ''} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
        <ul className="tour-cards">
          {listed.map((t) => {
            const st = perTour[t.id]
            const areas = areasById[t.id] ?? []
            const isSel = selected?.id === t.id
            const off = hidden.has(t.id)
            const finished = st.total && st.progress >= 1
            return (
              <li key={t.id} className={`tour-card${isSel ? ' sel' : ''}${off ? ' off' : ''}`} style={{ '--tour': t.color }}>
                <div className="tour-card-row">
                  <button type="button" className="tour-card-main" onClick={() => focus(t.id)} aria-pressed={isSel}>
                    <span className="tour-num">{t.number}</span>
                    <span className="tour-card-text">
                      <strong className="tour-name-wrap">{t.name}</strong>
                      <span className="small muted ellipsis">{areas.length > 1 ? `${areas.length} secteurs` : areas[0]?.name ?? 'Pas de rue'} · {t.houses.length} maisons</span>
                    </span>
                    {finished
                      ? <span className="tour-ring-done" aria-label="Terminée"><IconCheck width={20} height={20} /></span>
                      : <span className="tour-ring" title={`${st.done} maisons faites sur ${st.total} (${Math.round(st.progress * 100)} %)`}><ProgressRing value={st.progress} size={52} stroke={5} color={ringColor(st)}><strong className="tour-ring-pct"><span className="tour-ring-done-n" style={{ color: ringColor(st) }}>{st.done}</span>/{st.total}</strong></ProgressRing></span>}
                  </button>
                  <button type="button" className="tour-eye" onClick={() => toggle(t.id)} aria-pressed={!off} aria-label={off ? 'Afficher sur la carte' : 'Masquer de la carte'} title={off ? 'Afficher sur la carte' : 'Masquer de la carte'}>
                    {off ? <IconEyeOff width={18} height={18} /> : <IconEye width={18} height={18} />}
                  </button>
                </div>
                {isSel && areas.length > 1 && (
                  <div className="tour-card-sectors">
                    {areas.map((a, i) => (
                      <button key={a.id} type="button" className={placeSel === a.id ? 'on' : ''} onClick={() => choosePlaceOf(t.id, a)}>{i + 1} {a.name}</button>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
          {!listed.length && <li className="muted small tour-cards-empty">{tours.length ? 'Aucune tournée ne correspond.' : 'Aucune tournée pour l’instant.'}</li>}
        </ul>
      </aside>

      <div className="tours-map-top">
        {selected && tourPlaces.length > 1 ? (
          <div className="village-chips tour-places" aria-label={`Secteurs de la tournée ${selected.number}`}>
            <span className="tour-places-label">Secteurs</span>
            <button type="button" className={!place ? 'on' : ''} onClick={() => choosePlace(null)}>Toute la tournée</button>
            {tourPlaces.map((p) => (
              <button key={p.id} type="button" className={place?.id === p.id ? 'on' : ''} onClick={() => choosePlace(p)}>{p.num} · {p.name}</button>
            ))}
          </div>
        ) : !selected && villages.length > 1 && (
          <div className="village-chips" aria-label="Aller à un village">
            {villages.map((v) => (
              <button key={v.name} type="button" className={village?.name === v.name ? 'on' : ''} aria-pressed={village?.name === v.name} onClick={() => chooseVillage(v)}>{v.name}</button>
            ))}
          </div>
        )}
      </div>

      <div className="tours-map-tools">
        <button type="button" className={`map-tool${full ? ' on' : ''}`} onClick={toggleFull} aria-pressed={full} aria-label={full ? 'Quitter le plein écran' : 'Plein écran'} title={full ? 'Quitter le plein écran' : 'Plein écran'}>
          {full ? <IconShrink width={20} height={20} /> : <IconExpand width={20} height={20} />}
        </button>
        <button type="button" className={`map-tool tours-panel-btn${panelOpen ? ' on' : ''}`} onClick={() => setPanelOpen((v) => !v)} aria-pressed={panelOpen} aria-label="Liste des tournées" title="Liste des tournées">
          <IconList width={20} height={20} />
        </button>
        <div className="map-tool-wrap">
          <button type="button" className={`map-tool${layersOpen || showHouses || showProgress ? ' on' : ''}`} onClick={() => setLayersOpen((v) => !v)} aria-expanded={layersOpen} aria-label="Calques" title="Calques">
            <IconLayers width={20} height={20} />
          </button>
          {layersOpen && (
            <div className="layers-pop">
              <label className="check-line"><input type="checkbox" checked={showHouses} onChange={(e) => setShowHouses(e.target.checked)} />Maisons</label>
              <label className="check-line"><input type="checkbox" checked={showProgress} onChange={(e) => setShowProgress(e.target.checked)} />Avancement</label>
            </div>
          )}
        </div>
        <button type="button" className="map-tool map-tool-add" onClick={() => setCreating(true)} aria-label="Nouvelle tournée" title="Nouvelle tournée">
          <IconPlus width={20} height={20} />
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
        <div className="map-panel tour-float" style={{ '--tour': selected.color }}>
          <button type="button" className="btn-round btn-ghost tour-float-close" onClick={() => pick(null)} aria-label="Fermer la fiche">✕</button>
          <div className="tour-float-head">
            <ProgressRing value={shownStats.progress} size={64} stroke={8} color="var(--green)"><strong>{Math.round(shownStats.progress * 100)}%</strong></ProgressRing>
            <div className="tour-float-title">
              <span className="kicker">Tournée {selected.number}{place ? ` · secteur ${place.num}` : ''}</span>
              <strong className="tour-name-wrap">{selected.name}</strong>
              <span className="small muted">{shownStats.done} / {shownStats.total} maisons · {formatEuro(shownStats.amount)}</span>
            </div>
          </div>
          <div className="tour-float-stats">
            <div className="tf-given"><strong>{shownStats.counts.given}</strong><span>Dons</span></div>
            <div className="tf-again"><strong>{shownStats.counts.again}</strong><span>À repasser</span></div>
            <div className="tf-todo"><strong>{shownStats.counts.todo}</strong><span>À faire</span></div>
          </div>
          <Link to={`/admin/tournees/${selected.id}`} className="btn btn-primary btn-big tour-float-edit"><IconPencil width={18} height={18} />Modifier la tournée</Link>
        </div>
      )}

      {selected && tourPlaces.length > 1 && (
        <div className="map-legend hide-mobile" aria-hidden="true">
          <span><i className="lg-sector" />Secteur de la tournée</span>
          <span><i className="lg-other" />Autres tournées</span>
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


      {editing && <TourMapEditor tour={editing} onClose={() => setEditId(null)} />}
    </div>
  )
}
