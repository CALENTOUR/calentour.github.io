import { Link } from 'react-router-dom'
import NoTour from '../../components/NoTour'
import StreetArt from '../../components/ui/StreetArt'
import { useTourContext } from '../../hooks/useTourContext'
import { formatEuro } from '../../lib/format'
import { tourStats } from '../../lib/stats'

// « Ma tournée » : un bouton par rue avec le nombre de maisons restantes ;
// toucher une rue ouvre sa carte en plein écran.
export default function MyTourPage() {
  const { tour, state, base } = useTourContext()
  if (!tour) return <NoTour />
  const s = tourStats(tour, state)

  return (
    <div className="page stack">
      <div className="tour-head" style={{ '--tour': tour.color }}>
        <div className="tour-head-row">
          <div className="spacer">
            <span className="kicker">Tournée n°{tour.number}</span>
            <h1>{tour.name}</h1>
          </div>
          <div className="tour-head-left">
            <strong>{s.counts.todo}</strong>
            <span>maison{s.counts.todo > 1 ? 's' : ''} à faire</span>
          </div>
        </div>
        <StreetArt />
      </div>

      <div className="sector-list">
        {tour.pieces.map((p) => {
          const ps = s.byPiece[p.id]
          const done = ps.total > 0 && !ps.counts.todo && !ps.counts.again
          return (
            <Link key={p.id} to={`${base}/${p.id}`} className={`sector-card${done ? ' sector-done' : ''}`} style={{ '--tour': tour.color }}>
              <div className="sector-count">
                {done ? <span className="sector-trophy">🏆</span> : <><strong>{ps.counts.todo}</strong><span>à faire</span></>}
              </div>
              <div className="spacer">
                <strong className="sector-name">{p.name}</strong>
                <div className="sector-bar"><i style={{ width: `${Math.round(ps.progress * 100)}%` }} /></div>
                <div className="small muted">
                  {ps.done}/{ps.total} faites{ps.counts.again ? ` · ${ps.counts.again} à repasser` : ''}{ps.amount ? ` · ${formatEuro(ps.amount)}` : ''}
                </div>
              </div>
              <span className="sector-go">🗺️</span>
            </Link>
          )
        })}
        {tour.pieces.length > 1 && (
          <Link to={`${base}/tout`} className="sector-card sector-all">
            <div className="sector-count"><strong>{s.counts.todo}</strong><span>à faire</span></div>
            <strong className="spacer sector-name">Toute ma tournée</strong>
            <span className="sector-go">🗺️</span>
          </Link>
        )}
        {!tour.pieces.length && <p className="muted">Aucune rue pour l’instant. Un administrateur doit tracer la tournée.</p>}
      </div>
    </div>
  )
}
