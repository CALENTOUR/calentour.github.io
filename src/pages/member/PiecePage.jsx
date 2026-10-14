import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TourMap, { buildingStatus, tourPoints } from '../../components/map/TourMap'
import { fitPoints } from '../../components/map/useMapLibre'
import MapLegend from '../../components/map/MapLegend'
import AddHouseSheet from '../../components/AddHouseSheet'
import HouseSheet from '../../components/HouseSheet'
import NoTour from '../../components/NoTour'
import Sheet from '../../components/ui/Sheet'
import Confetti from '../../components/ui/Confetti'
import ProgressRing from '../../components/ui/ProgressRing'
import { useToast } from '../../components/ui/Toast'
import { STATUSES } from '../../config/constants'
import { useTourContext } from '../../hooks/useTourContext'
import { formatEuro, formatPercent } from '../../lib/format'
import { unflatten } from '../../lib/geo'
import { pieceLabels } from '../../lib/places'
import { sortHouses, tourStats } from '../../lib/stats'
import { dwellingKey } from '../../services/state'
import { saveTour } from '../../services/tours'

// Place laissée autour des rues quand la carte se cadre : sous les onglets des
// rues en haut, au-dessus du panneau du bas.
const FIT_PADDING = { top: 70, bottom: 50, left: 30, right: 90 }

// « Ma tournée » en vue carte : carte 3D plein écran, un onglet par rue (par
// village d'abord quand la tournée en traverse plusieurs). À droite, un petit
// camembert d'avancement (le toucher ouvre la liste des maisons) et l'ajout
// d'une maison oubliée.
export default function PiecePage() {
  const { pieceId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { tour, state, year, user, base } = useTourContext()
  const [openHouseId, setOpenHouseId] = useState(null)
  const [listOpen, setListOpen] = useState(false)
  const [party, setParty] = useState(0)
  const [adding, setAdding] = useState(false)
  const [newPoint, setNewPoint] = useState(null)
  const [villageSel, setVillageSel] = useState(null)
  const mapRef = useRef(null)
  const focus = !pieceId || pieceId === 'tout' ? null : pieceId
  const h = state?.h ?? {}

  const houses = useMemo(
    () => (tour ? sortHouses(tour.houses.filter((x) => (focus ? x.pieceId === focus : true)), tour.pieces) : []),
    [tour, focus],
  )
  const tours = useMemo(() => (tour ? [tour] : []), [tour])
  const statesById = useMemo(() => (tour ? { [tour.id]: state } : {}), [tour, state])
  const labels = useMemo(() => pieceLabels(tour), [tour])
  const villageNames = useMemo(() => [...new Set((tour?.pieces ?? []).map((p) => labels[p.id]?.village).filter(Boolean))], [tour, labels])
  const multi = villageNames.length > 1
  const village = multi ? (focus ? labels[focus]?.village : villageSel) : null

  // Choix d'un village : la carte se cadre sur ses rues (après le recadrage de la carte).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !village || focus) return
    const pts = tour.pieces.filter((p) => labels[p.id]?.village === village).flatMap((p) => p.lines.flatMap((l) => unflatten(l.c)))
    fitPoints(map, pts, { padding: FIT_PADDING, maxZoom: 18 })
  }, [village, focus, tour, labels])

  if (!tour) return <NoTour />
  const stats = tourStats(tour, state)
  const inVillage = (p) => !village || labels[p.id]?.village === village
  const sumPieces = (list) => {
    const r = { done: 0, total: 0, todo: 0, amount: 0 }
    for (const p of list) {
      const x = stats.byPiece[p.id]
      if (!x) continue
      r.done += x.done; r.total += x.total; r.todo += x.counts.todo; r.amount += x.amount
    }
    return { ...r, progress: r.total ? r.done / r.total : 0 }
  }
  const listHouses = village && !focus ? houses.filter((x) => labels[x.pieceId]?.village === village) : houses
  const villageStats = (v) => sumPieces(tour.pieces.filter((p) => labels[p.id]?.village === v))
  const ps = (focus ? stats.byPiece[focus] : village ? villageStats(village) : stats) ?? stats
  const statusOf = (house) => (house.units?.length ? buildingStatus(house, h) : h[dwellingKey(house.id)]?.s ?? 'todo')
  const openHouse = tour.houses.find((x) => x.id === openHouseId)
  const title = focus ? labels[focus]?.full : village ?? 'Toute ma tournée'

  const fit = (id) => {
    fitPoints(mapRef.current, tourPoints(tours, id), { padding: FIT_PADDING, maxZoom: 18 })
  }
  const choosePiece = (id) => {
    if (id === focus) fit(id)
    else navigate(`${base}/${id ?? 'tout'}`)
  }
  const chooseVillage = (v) => {
    setVillageSel(v)
    if (focus) navigate(`${base}/tout`)
    else if (!v) fit(null)
  }
  const chipCount = (todo, total) => (total && !todo ? '✓' : todo)
  const goTo = (house) => {
    setListOpen(false)
    const map = mapRef.current
    if (map) map.flyTo({ center: [house.lng, house.lat], zoom: Math.max(map.getZoom(), 17.5), offset: [0, -80], duration: 800 })
    setOpenHouseId(house.id)
  }

  // Toucher une rue l'ouvre ; en mode ajout, toucher la carte place la nouvelle maison.
  const onMapClick = (e, m) => {
    if (adding) {
      setAdding(false)
      setNewPoint(e.lngLat)
      return
    }
    // Zone de toucher large (doigt sur téléphone) : on garde l'autre rue la plus proche.
    const box = [[e.point.x - 32, e.point.y - 32], [e.point.x + 32, e.point.y + 32]]
    const gap = (f) => Math.min(...(f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates)
      .flat().map((c) => { const p = m.project(c); return Math.hypot(p.x - e.point.x, p.y - e.point.y) }))
    const hit = m.queryRenderedFeatures(box, { layers: ['pieces'] }).filter((f) => f.properties.pieceId !== focus).sort((a, b) => gap(a) - gap(b))[0]
    if (hit && hit.properties.pieceId !== focus) choosePiece(hit.properties.pieceId)
  }
  const addHouse = (house) => saveTour(tour.id, { houses: [...tour.houses, house] })
    .then(() => toast(`${house.label} ajoutée`))
    .catch((err) => toast(`Ajout impossible : ${err.message}`))

  const onSaved = (status, amount) => {
    if (status === 'given') {
      setParty(Date.now())
      toast(`Merci ! ${formatEuro(amount)} enregistrés 🎉`)
    } else if (status !== 'todo') {
      toast(navigator.onLine ? `${STATUSES[status].label} enregistré` : 'Enregistré sur le téléphone, envoi au retour du réseau')
    }
  }

  return (
    <div className="fullmap">
      {!openHouse && !listOpen && !newPoint && <button type="button" className="map-quit" onClick={() => navigate(base)}>✕ Quitter la carte</button>}
      <TourMap
        tours={tours}
        statesById={statesById}
        focusPieceId={focus}
        fitPadding={FIT_PADDING}
        showMe
        streetLabels
        onHouseClick={adding ? undefined : (p) => { const house = tour.houses.find((x) => x.id === p.houseId); if (!house) return; if (focus && house.pieceId !== focus) choosePiece(house.pieceId); else goTo(house) }}
        onMapClick={onMapClick}
        onReady={(m) => { mapRef.current = m }}
        className="fullmap-map"
      />

      <div className="map-chips" role="tablist">
        {multi && village ? (
          <>
            <button type="button" className="chip-back" onClick={() => chooseVillage(null)} aria-label="Retour aux villages">‹</button>
            <button type="button" className={`chip-village-tab${!focus ? ' on' : ''}`} onClick={() => chooseVillage(village)}><span className="village-tag">Village</span>{village}</button>
          </>
        ) : (
          <>
            <button type="button" className="chip-back" onClick={() => navigate(base)} aria-label="Retour à Ma tournée">←</button>
            <button type="button" className={!focus && !village ? 'on' : ''} onClick={() => choosePiece(null)}>Tout<span className="chip-pct">{chipCount(stats.counts.todo, stats.total)}</span></button>
          </>
        )}
        {multi && !village
          ? villageNames.map((v) => {
            const vs = villageStats(v)
            return (
              <button key={v} type="button" className={`chip-village-tab${vs.total && !vs.todo ? ' done' : ''}`} onClick={() => chooseVillage(v)}>
                <span className="village-tag">Village</span>{v}<span className="chip-pct" title="Maisons restantes">{chipCount(vs.todo, vs.total)}</span>
              </button>
            )
          })
          : tour.pieces.filter(inVillage).map((p) => {
            const pp = stats.byPiece[p.id]
            const doneAll = pp?.progress >= 1
            return (
              <button key={p.id} type="button" className={`${focus === p.id ? 'on' : ''}${doneAll ? ' done' : ''}`} onClick={() => choosePiece(p.id)}>
                {!multi && labels[p.id].village && <span className="chip-village">{labels[p.id].village}</span>}
                {labels[p.id].street}
                <span className="chip-pct" title="Maisons restantes">{doneAll || !pp?.counts.todo ? '✓' : pp.counts.todo}</span>
              </button>
            )
          })}
      </div>

      {adding && <div className="map-note map-note-action">Touche l’endroit de la maison sur la carte <button type="button" className="btn-sm" onClick={() => setAdding(false)}>Annuler</button></div>}

      <div className="map-side">
        <MapLegend hidden={Boolean(openHouse || listOpen || newPoint)} />
        <button type="button" className="mini-pie" onClick={() => setListOpen(true)} aria-label={`${formatPercent(ps.progress)} fait, ouvrir la liste des maisons`} title="Liste des maisons">
          <ProgressRing value={ps.progress} size={58} stroke={7} color="var(--green)">
            <strong>{Math.round(ps.progress * 100)}%</strong>
          </ProgressRing>
        </button>
        <button type="button" className={`fab-add${adding ? ' on' : ''}`} onClick={() => setAdding((v) => !v)} aria-label="Ajouter une maison oubliée" title="Ajouter une maison oubliée">{adding ? '✕' : (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 11.5 11 4l8 7.5" /><path d="M5.5 9.5V20h6" /><path d="M18 14v7M14.5 17.5h7" />
          </svg>
        )}</button>
      </div>

      {listOpen && (
        <Sheet title={title} subtitle={`${ps.done}/${ps.total} faites · ${formatPercent(ps.progress)} · ${formatEuro(ps.amount)}`} onClose={() => setListOpen(false)}>
          <ul className="house-list">
            {listHouses.map((x) => {
              const st = STATUSES[statusOf(x)]
              const entry = x.units?.length ? null : h[dwellingKey(x.id)]
              return (
                <li key={x.id}>
                  <button type="button" className="house-row" onClick={() => goTo(x)}>
                    <span className="dot" style={{ background: st.color, borderColor: st.stroke }} />
                    <span className="spacer">
                      {x.label}
                      {x.units?.length ? <span className="small muted"> · 🏢 {x.units.length} logements</span> : null}
                    </span>
                    <span className="small" style={{ color: st.key === 'todo' ? 'var(--muted)' : st.stroke }}>
                      {entry?.s === 'given' ? formatEuro(entry.amount) : st.short}
                    </span>
                  </button>
                </li>
              )
            })}
            {!listHouses.length && <li className="muted small">Aucune maison sur cette rue. Ajoute-les avec le bouton « ＋🏠 Maison ».</li>}
          </ul>
        </Sheet>
      )}

      {newPoint && <AddHouseSheet tour={tour} point={newPoint} onAdd={addHouse} onClose={() => setNewPoint(null)} />}

      {openHouse && (
        <HouseSheet tour={tour} house={openHouse} state={state} year={year} user={user} onClose={() => setOpenHouseId(null)} onSaved={onSaved} />
      )}
      <Confetti trigger={party} />
    </div>
  )
}
