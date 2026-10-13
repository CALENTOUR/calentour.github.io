import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TourMap, { buildingStatus, tourBounds } from '../../components/map/TourMap'
import HouseSheet from '../../components/HouseSheet'
import NoTour from '../../components/NoTour'
import Sheet from '../../components/ui/Sheet'
import Confetti from '../../components/ui/Confetti'
import { useToast } from '../../components/ui/Toast'
import { STATUSES } from '../../config/constants'
import { useTourContext } from '../../hooks/useTourContext'
import { formatEuro, formatPercent } from '../../lib/format'
import { sortHouses, tourStats } from '../../lib/stats'
import { dwellingKey } from '../../services/state'

// Place laissée autour des rues quand la carte se cadre : sous les onglets des rues
// en haut, au-dessus du panneau du bas.
const FIT_PADDING = { top: 90, bottom: 170, left: 40, right: 60 }

// « Ma tournée » : carte 3D plein écran, un onglet par morceau de tournée,
// panneau du bas avec la maison suivante et la liste.
export default function PiecePage() {
  const { pieceId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { tour, state, year, user, base } = useTourContext()
  const [openHouseId, setOpenHouseId] = useState(null)
  const [listOpen, setListOpen] = useState(false)
  const [party, setParty] = useState(0)
  const mapRef = useRef(null)
  const focus = !pieceId || pieceId === 'tout' ? null : pieceId
  const h = state?.h ?? {}

  const houses = useMemo(
    () => (tour ? sortHouses(tour.houses.filter((x) => !focus || x.pieceId === focus), tour.pieces) : []),
    [tour, focus],
  )
  const tours = useMemo(() => (tour ? [tour] : []), [tour])
  const statesById = useMemo(() => (tour ? { [tour.id]: state } : {}), [tour, state])

  if (!tour) return <NoTour />
  const stats = tourStats(tour, state)
  const ps = (focus ? stats.byPiece[focus] : stats) ?? stats
  const statusOf = (house) => (house.units?.length ? buildingStatus(house, h) : h[dwellingKey(house.id)]?.s ?? 'todo')
  const next = houses.find((x) => statusOf(x) === 'todo') ?? houses.find((x) => statusOf(x) === 'again')
  const openHouse = tour.houses.find((x) => x.id === openHouseId)
  const title = focus ? tour.pieces.find((p) => p.id === focus)?.name : 'Toute ma tournée'

  const fit = (id) => {
    const b = tourBounds(tours, id)
    if (b && mapRef.current) mapRef.current.fitBounds(b, { padding: FIT_PADDING, maxZoom: 18, duration: 700, pitch: mapRef.current.getPitch() })
  }
  const choosePiece = (id) => {
    if (id === focus) fit(id)
    else navigate(`${base}/${id ?? 'tout'}`)
  }
  const goTo = (house) => {
    setListOpen(false)
    const map = mapRef.current
    if (map) map.flyTo({ center: [house.lng, house.lat], zoom: Math.max(map.getZoom(), 17.5), offset: [0, -80], duration: 800 })
    setOpenHouseId(house.id)
  }

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
      <TourMap
        tours={tours}
        statesById={statesById}
        focusPieceId={focus}
        fitPadding={FIT_PADDING}
        showMe
        onHouseClick={(p) => { const house = tour.houses.find((x) => x.id === p.houseId); if (house) goTo(house) }}
        onReady={(m) => { mapRef.current = m }}
        className="fullmap-map"
      />

      <div className="map-chips" role="tablist">
        <button type="button" className="chip-back" onClick={() => navigate(base)} aria-label="Retour à la liste des rues">←</button>
        <button type="button" className={!focus ? 'on' : ''} onClick={() => choosePiece(null)}>Tout<span className="chip-pct">{stats.counts.todo || '✓'}</span></button>
        {tour.pieces.map((p) => {
          const pp = stats.byPiece[p.id]
          const doneAll = pp?.progress >= 1
          return (
            <button key={p.id} type="button" className={`${focus === p.id ? 'on' : ''}${doneAll ? ' done' : ''}`} onClick={() => choosePiece(p.id)}>
              {p.name}
              <span className="chip-pct" title="Maisons restantes">{doneAll || !pp?.counts.todo ? '✓' : pp.counts.todo}</span>
            </button>
          )
        })}
      </div>

      <div className="map-panel">
        <div className="map-panel-info">
          <strong className="ellipsis">{title}</strong>
          <div className="map-panel-bar"><i style={{ width: `${Math.round(ps.progress * 100)}%` }} /></div>
          <div className="small muted">{ps.done}/{ps.total} faites · {formatEuro(ps.amount)}</div>
        </div>
        <button type="button" className="btn-round map-panel-list" onClick={() => setListOpen(true)} aria-label="Liste des maisons">☰</button>
        {next
          ? <button type="button" className="btn-primary map-panel-next" onClick={() => goTo(next)}>Suivante ▶</button>
          : <span className="map-panel-done">{houses.length ? '🏆 Fini' : ''}</span>}
      </div>

      {listOpen && (
        <Sheet title={title} subtitle={`${ps.done}/${ps.total} faites · ${formatPercent(ps.progress)} · ${formatEuro(ps.amount)}`} onClose={() => setListOpen(false)}>
          <ul className="house-list">
            {houses.map((x) => {
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
            {!houses.length && <li className="muted small">Aucune maison sur ce morceau. Un administrateur peut les ajouter.</li>}
          </ul>
        </Sheet>
      )}

      {openHouse && (
        <HouseSheet tour={tour} house={openHouse} state={state} year={year} user={user} onClose={() => setOpenHouseId(null)} onSaved={onSaved} />
      )}
      <Confetti trigger={party} />
    </div>
  )
}
