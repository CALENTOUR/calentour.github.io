import { Link } from 'react-router-dom'
import ProgressRing from '../../components/ui/ProgressRing'
import StatTile from '../../components/ui/StatTile'
import StatusBar from '../../components/ui/StatusBar'
import PrepareOffline from '../../components/PrepareOffline'
import { useTourContext } from '../../hooks/useTourContext'
import { formatEuro, formatPercent } from '../../lib/format'
import { tourStats } from '../../lib/stats'

export function NoTour() {
  return (
    <div className="page"><div className="card empty">
      <div className="empty-icon">🗺️</div>
      <h2>Pas encore de tournée</h2>
      <p className="muted">Ton compte n’est rattaché à aucune tournée. Demande à un administrateur de l’amicale.</p>
    </div></div>
  )
}

function cheer(progress) {
  if (progress >= 1) return 'Tournée terminée, bravo ! 🏆'
  if (progress >= 0.75) return 'Dernière ligne droite 💪'
  if (progress >= 0.5) return 'Plus de la moitié, continue ! 🔥'
  if (progress > 0) return 'C’est parti, bonne tournée ! 🚒'
  return 'Prêt pour la tournée ? 🚒'
}

export default function MyTourPage() {
  const { tour, state, base } = useTourContext()
  if (!tour) return <NoTour />
  const s = tourStats(tour, state)

  return (
    <div className="page stack-lg">
      <section className="hero" style={{ '--tour': tour.color }}>
        <div className="hero-text">
          <div className="hero-kicker">Tournée n°{tour.number}</div>
          <h1>{tour.name}</h1>
          <p>{cheer(s.progress)}</p>
          <div className="hero-amount">{formatEuro(s.amount)}</div>
          <div className="hero-amount-label">collectés</div>
        </div>
        <ProgressRing value={s.progress} color="#ffffff" size={128}>
          <strong>{formatPercent(s.progress)}</strong>
          <span>{s.done}/{s.total} faites</span>
        </ProgressRing>
      </section>

      <div className="tiles">
        <StatTile icon="💶" label="Dons" value={s.counts.given} tone="green" />
        <StatTile icon="🔁" label="À repasser" value={s.counts.again} tone="orange" />
        <StatTile icon="🏠" label="Restantes" value={s.counts.todo} />
        <StatTile icon="⭐" label="Don moyen" value={formatEuro(s.average)} />
      </div>

      <section className="stack">
        <h2>Mes rues</h2>
        <div className="piece-list">
          {tour.pieces.map((p) => {
            const ps = s.byPiece[p.id]
            return (
              <Link key={p.id} to={`${base}/${p.id}`} className="piece-card">
                <div className="piece-head">
                  <strong>{p.name}</strong>
                  <span className={`badge ${ps.progress >= 1 ? 'badge-done' : ''}`}>{ps.progress >= 1 ? '✓ Fini' : formatPercent(ps.progress)}</span>
                </div>
                <div className="small muted">{ps.total} habitation{ps.total > 1 ? 's' : ''} · {ps.counts.todo} à faire{ps.counts.again ? ` · ${ps.counts.again} à repasser` : ''}</div>
                <StatusBar counts={ps.counts} total={ps.total} />
              </Link>
            )
          })}
          <Link to={`${base}/tout`} className="piece-card piece-card-all">
            <strong>🗺️ Toute ma tournée sur la carte</strong>
          </Link>
        </div>
      </section>

      <PrepareOffline tour={tour} />
    </div>
  )
}
