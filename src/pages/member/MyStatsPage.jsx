import NoTour from '../../components/NoTour'
import PrepareOffline from '../../components/PrepareOffline'
import CollectedCard from '../../components/ui/CollectedCard'
import ProgressRing from '../../components/ui/ProgressRing'
import StatTile from '../../components/ui/StatTile'
import { DayColumns, StatusDonut, StreetBars } from '../../components/ui/StatsCharts'
import { useData } from '../../context/DataContext'
import { useTourContext } from '../../hooks/useTourContext'
import { formatEuro, formatPercent } from '../../lib/format'
import { pieceLabels } from '../../lib/places'
import { globalStats, tourStats } from '../../lib/stats'

function cheer(progress) {
  if (progress >= 1) return 'Tournée terminée, bravo ! 🏆'
  if (progress >= 0.75) return 'Dernière ligne droite 💪'
  if (progress >= 0.5) return 'Plus de la moitié, continue ! 🔥'
  if (progress > 0) return 'C’est parti, bonne tournée ! 🚒'
  return 'Prêt pour la tournée ? 🚒'
}

// Statistiques du binôme, mises à jour à chaque saisie.
export default function MyStatsPage() {
  const { tour, state, settings } = useTourContext()
  const { tours, statesById } = useData()
  if (!tour) return <NoTour />
  const s = tourStats(tour, state)
  const labels = pieceLabels(tour)
  const ranking = settings?.rankingForMembers ? globalStats(tours, statesById).perTour : null
  const perDay = Object.values(Object.values(state?.h ?? {}).reduce((acc, e) => {
    if (e?.s !== 'given' || !e.at) return acc
    const day = e.at.slice(0, 10)
    acc[day] = { day, amount: (acc[day]?.amount ?? 0) + (Number(e.amount) || 0) }
    return acc
  }, {})).sort((a, b) => a.day.localeCompare(b.day))
  const rank = ranking ? ranking.findIndex((r) => r.tour.id === tour.id) + 1 : 0

  return (
    <div className="page stack-lg">
      <section className="hero" style={{ '--tour': tour.color }}>
        <div className="hero-text">
          <div className="hero-kicker">Tournée n°{tour.number} <span className="live live-light">● en direct</span></div>
          <h1>{tour.name}</h1>
          <p>{cheer(s.progress)}</p>
        </div>
        <ProgressRing value={s.progress} color="var(--green)" size={128}>
          <strong>{formatPercent(s.progress)}</strong>
          <span>{s.done}/{s.total} faites</span>
        </ProgressRing>
      </section>
      <CollectedCard stats={s} />
      <div className="tiles">
        <StatTile icon="🤝" label="Ont donné" value={formatPercent(s.giveRate)} sub="des maisons visitées" tone="green" />
        <StatTile icon="🔁" label="À repasser" value={s.counts.again} tone="orange" />
        <StatTile icon="📍" label="Par maison visitée" value={formatEuro(s.perVisit)} />
      </div>

      <section className="card stack">
        <h2>Où en sont les maisons</h2>
        <StatusDonut counts={s.counts} total={s.total} />
      </section>

      {perDay.length > 0 && (
        <section className="card stack">
          <h2>Dons par jour</h2>
          <DayColumns days={perDay} />
        </section>
      )}

      <section className="card stack">
        <h2>Rue par rue</h2>
        <StreetBars rows={tour.pieces.map((p) => ({ id: p.id, label: labels[p.id].full, stats: s.byPiece[p.id] }))} />
      </section>

      <PrepareOffline tour={tour} />

      {ranking && (
        <section className="card stack">
          <h2>Classement {rank ? <span className="badge">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}e`}</span> : null}</h2>
          <ol className="ranking">
            {ranking.map((r, i) => (
              <li key={r.tour.id} className={r.tour.id === tour.id ? 'me' : ''}>
                <span className="rank-pos">{i + 1}</span>
                <span className="spacer">{r.tour.name}</span>
                <strong>{formatEuro(r.stats.amount)}</strong>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
