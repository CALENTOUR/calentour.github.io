import StatTile from '../../components/ui/StatTile'
import StatusBar from '../../components/ui/StatusBar'
import { STATUS_LIST } from '../../config/constants'
import { useData } from '../../context/DataContext'
import { useTourContext } from '../../hooks/useTourContext'
import { formatEuro, formatPercent } from '../../lib/format'
import { globalStats, tourStats } from '../../lib/stats'
import { NoTour } from './MyTourPage'

// Statistiques du binôme, mises à jour à chaque saisie.
export default function MyStatsPage() {
  const { tour, state, settings } = useTourContext()
  const { tours, statesById } = useData()
  if (!tour) return <NoTour />
  const s = tourStats(tour, state)
  const ranking = settings?.rankingForMembers ? globalStats(tours, statesById).perTour : null
  const rank = ranking ? ranking.findIndex((r) => r.tour.id === tour.id) + 1 : 0

  return (
    <div className="page stack-lg">
      <h1>Mes stats <span className="live">● en direct</span></h1>
      <div className="tiles">
        <StatTile icon="💰" label="Collecté" value={formatEuro(s.amount)} tone="brand" />
        <StatTile icon="💶" label="Espèces" value={formatEuro(s.byMode.cash)} />
        <StatTile icon="🧾" label="Chèques" value={formatEuro(s.byMode.cheque)} sub={`${s.chequeCount} chèque${s.chequeCount > 1 ? 's' : ''}`} />
        <StatTile icon="⭐" label="Don moyen" value={formatEuro(s.average)} />
        <StatTile icon="✅" label="Maisons faites" value={formatPercent(s.progress)} sub={`${s.done} sur ${s.total}`} />
        <StatTile icon="🤝" label="Ont donné" value={formatPercent(s.giveRate)} sub="des maisons visitées" tone="green" />
        <StatTile icon="🔁" label="À repasser" value={s.counts.again} tone="orange" />
        <StatTile icon="📍" label="Par maison visitée" value={formatEuro(s.perVisit)} />
      </div>

      <section className="card stack">
        <h2>Répartition</h2>
        <StatusBar counts={s.counts} total={s.total} height={16} />
        <div className="legend">
          {STATUS_LIST.map((st) => (
            <span key={st.key}><i style={{ background: st.color, borderColor: st.stroke }} />{st.label} : <strong>{s.counts[st.key] ?? 0}</strong></span>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2>Par rue</h2>
        <table className="table">
          <thead><tr><th>Rue</th><th>Faites</th><th>Dons</th><th className="num">Collecté</th></tr></thead>
          <tbody>
            {tour.pieces.map((p) => {
              const ps = s.byPiece[p.id]
              return (
                <tr key={p.id}><td>{p.name}</td><td>{formatPercent(ps.progress)}</td><td>{ps.counts.given}</td><td className="num">{formatEuro(ps.amount)}</td></tr>
              )
            })}
          </tbody>
        </table>
      </section>

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
