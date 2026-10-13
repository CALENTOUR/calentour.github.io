import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TourMap from '../../components/map/TourMap'
import HouseSheet from '../../components/HouseSheet'
import Confetti from '../../components/ui/Confetti'
import { useToast } from '../../components/ui/Toast'
import { STATUSES } from '../../config/constants'
import { useTourContext } from '../../hooks/useTourContext'
import { formatEuro, formatPercent } from '../../lib/format'
import { sortHouses, tourStats } from '../../lib/stats'
import { dwellingKey } from '../../services/state'
import { buildingStatus } from '../../components/map/TourMap'
import { NoTour } from './MyTourPage'

// Vue d'un morceau de tournée : sous-onglets des rues, carte 3D, liste des maisons.
export default function PiecePage() {
  const { pieceId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { tour, state, year, user, base } = useTourContext()
  const [openHouseId, setOpenHouseId] = useState(null)
  const [party, setParty] = useState(0)
  const focus = pieceId === 'tout' ? null : pieceId
  const h = state?.h ?? {}

  const houses = useMemo(
    () => (tour ? sortHouses(tour.houses.filter((x) => !focus || x.pieceId === focus), tour.pieces) : []),
    [tour, focus],
  )
  const tours = useMemo(() => (tour ? [tour] : []), [tour])
  const statesById = useMemo(() => (tour ? { [tour.id]: state } : {}), [tour, state])

  if (!tour) return <NoTour />
  const stats = tourStats(tour, state)
  const ps = focus ? stats.byPiece[focus] : stats
  const statusOf = (house) => (house.units?.length ? buildingStatus(house, h) : h[dwellingKey(house.id)]?.s ?? 'todo')
  const next = houses.find((x) => statusOf(x) === 'todo') ?? houses.find((x) => statusOf(x) === 'again')
  const openHouse = tour.houses.find((x) => x.id === openHouseId)

  const onSaved = (status, amount) => {
    if (status === 'given') {
      setParty(Date.now())
      toast(`Merci ! ${formatEuro(amount)} enregistrés 🎉`)
    } else if (status !== 'todo') {
      toast(navigator.onLine ? `${STATUSES[status].label} enregistré` : 'Enregistré sur le téléphone, envoi au retour du réseau')
    }
  }

  return (
    <div className="piece-page">
      <div className="subtabs" role="tablist">
        <button type="button" className={!focus ? 'on' : ''} onClick={() => navigate(`${base}/tout`)}>Tout</button>
        {tour.pieces.map((p) => (
          <button key={p.id} type="button" className={focus === p.id ? 'on' : ''} onClick={() => navigate(`${base}/${p.id}`)}>
            {p.name}
            {stats.byPiece[p.id]?.progress >= 1 && ' ✓'}
          </button>
        ))}
      </div>

      <TourMap tours={tours} statesById={statesById} focusPieceId={focus} onHouseClick={(p) => setOpenHouseId(p.houseId)} className="piece-map" />

      <div className="piece-panel">
        <div className="row">
          <div className="spacer">
            <strong>{focus ? tour.pieces.find((p) => p.id === focus)?.name : 'Toute la tournée'}</strong>
            <div className="small muted">{ps.done}/{ps.total} faites · {formatPercent(ps.progress)} · {formatEuro(ps.amount)}</div>
          </div>
          {next && <button type="button" className="btn-primary btn-sm" onClick={() => setOpenHouseId(next.id)}>Suivante ▶</button>}
        </div>
        <ul className="house-list">
          {houses.map((x) => {
            const st = STATUSES[statusOf(x)]
            const entry = x.units?.length ? null : h[dwellingKey(x.id)]
            return (
              <li key={x.id}>
                <button type="button" className="house-row" onClick={() => setOpenHouseId(x.id)}>
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
        <Link to={base} className="btn btn-ghost">← Ma tournée</Link>
      </div>

      {openHouse && (
        <HouseSheet tour={tour} house={openHouse} state={state} year={year} user={user} onClose={() => setOpenHouseId(null)} onSaved={onSaved} />
      )}
      <Confetti trigger={party} />
    </div>
  )
}

