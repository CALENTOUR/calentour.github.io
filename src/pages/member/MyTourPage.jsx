import { useState } from 'react'
import { Link } from 'react-router-dom'
import NoTour from '../../components/NoTour'
import StreetArt from '../../components/ui/StreetArt'
import ViewSwitch from '../../components/ViewSwitch'
import { useTourContext } from '../../hooks/useTourContext'
import { formatEuro } from '../../lib/format'
import { pieceLabels } from '../../lib/places'
import { tourStats } from '../../lib/stats'

// « Ma tournée » : un bouton par rue avec le nombre de maisons restantes ;
// toucher une rue ouvre sa carte en plein écran. En haut, bascule vers la carte
// de toute la tournée.
export default function MyTourPage() {
  const { tour, state, base } = useTourContext()
  const [village, setVillage] = useState(null)
  if (!tour) return <NoTour />
  const s = tourStats(tour, state)
  const labels = pieceLabels(tour)
  // Plusieurs villages : un onglet par village d'abord, puis ses rues.
  const villages = [...new Set(tour.pieces.map((p) => labels[p.id].village).filter(Boolean))]
  const todoIn = (v) => tour.pieces.filter((p) => labels[p.id].village === v).reduce((n, p) => n + s.byPiece[p.id].counts.todo, 0)
  const pieces = tour.pieces.filter((p) => !village || labels[p.id].village === village)

  return (
    <div className="page stack">
      <ViewSwitch base={base} />
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

      {villages.length > 1 && (
        <div className="village-tabs" role="tablist" aria-label="Villages">
          <button type="button" role="tab" aria-selected={!village} className={!village ? 'on' : ''} onClick={() => setVillage(null)}>
            Tous<span className="chip-pct">{s.counts.todo}</span>
          </button>
          {villages.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={village === v} className={village === v ? 'on' : ''} onClick={() => setVillage(v)}>
              {v}<span className="chip-pct">{todoIn(v) || '✓'}</span>
            </button>
          ))}
        </div>
      )}

      <div className="sector-list">
        {pieces.map((p) => {
          const ps = s.byPiece[p.id]
          const done = ps.total > 0 && !ps.counts.todo && !ps.counts.again
          return (
            <Link key={p.id} to={`${base}/${p.id}`} className={`sector-card${done ? ' sector-done' : ''}`} style={{ '--tour': tour.color }}>
              <div className="sector-count">
                {done ? <span className="sector-trophy">🏆</span> : <><strong>{ps.counts.todo}</strong><span>à faire</span></>}
              </div>
              <div className="spacer">
                {labels[p.id].village && !village && <span className="sector-village">{labels[p.id].village}</span>}
                <strong className="sector-name">{labels[p.id].street}</strong>
                <div className="sector-bar"><i style={{ width: `${Math.round(ps.progress * 100)}%` }} /></div>
                <div className="small muted">
                  {ps.done}/{ps.total} faites{ps.counts.again ? ` · ${ps.counts.again} à repasser` : ''}{ps.amount ? ` · ${formatEuro(ps.amount)}` : ''}
                </div>
              </div>
              <span className="sector-go">🗺️</span>
            </Link>
          )
        })}
        {tour.pieces.length > 1 && !village && (
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
