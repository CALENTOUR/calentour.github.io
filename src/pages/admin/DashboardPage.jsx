import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import StatTile from '../../components/ui/StatTile'
import StreetArt from '../../components/ui/StreetArt'
import StatusBar from '../../components/ui/StatusBar'
import { useData } from '../../context/DataContext'
import { formatEuro, formatPercent } from '../../lib/format'
import { globalStats } from '../../lib/stats'

export default function DashboardPage() {
  const { tours, statesById, settings, year } = useData()
  const g = useMemo(() => globalStats(tours, statesById), [tours, statesById])

  if (!tours.length) {
    return (
      <div className="page"><div className="card empty">
        <div className="empty-icon">🚒</div>
        <h2>Bienvenue sur CalenTour</h2>
        <p className="muted">Commence par créer les tournées dans l’onglet Carte.</p>
        <Link className="btn btn-primary" to="/admin/carte">Créer les tournées</Link>
      </div></div>
    )
  }

  return (
    <div className="page stack-lg">
      <div className="dash-head">
        <div className="spacer">
          <span className="kicker">Campagne des calendriers {year} <span className="live">● en direct</span></span>
          <h1>{settings?.amicale || 'Tableau de bord'}</h1>
          <p className="muted small">{g.done} maisons faites sur {g.total} · {tours.length} tournées</p>
        </div>
        <StreetArt className="dash-art" />
      </div>
      <div className="tiles tiles-wide">
        <StatTile icon="💰" label="Total collecté" value={formatEuro(g.amount)} tone="brand" />
        <StatTile icon="💶" label="Espèces" value={formatEuro(g.byMode.cash)} />
        <StatTile icon="🧾" label="Chèques" value={formatEuro(g.byMode.cheque)} sub={`${g.chequeCount} chèques`} />
        <StatTile icon="✅" label="Maisons faites" value={formatPercent(g.progress)} sub={`${g.done} sur ${g.total}`} />
        <StatTile icon="🤝" label="Ont donné" value={formatPercent(g.giveRate)} sub={`${g.counts.given} dons`} tone="green" />
        <StatTile icon="✋" label="Refus ou vides" value={formatPercent(g.refuseRate)} sub={`${g.counts.refused} refus · ${g.counts.empty} vides`} tone="red" />
        <StatTile icon="🔁" label="À repasser" value={formatPercent(g.againRate)} sub={`${g.counts.again} maisons`} tone="orange" />
        <StatTile icon="⭐" label="Don moyen" value={formatEuro(g.average)} sub={`${formatEuro(g.perVisit)} par maison visitée`} />
      </div>

      <section className="card stack">
        <h2>Tournées <span className="muted small">(classées par montant)</span></h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>#</th><th>Binôme</th><th>Avancement</th><th className="num">Dons</th><th className="num">À repasser</th><th className="num">Refus/vides</th><th className="num">€/visite</th><th className="num">Collecté</th></tr>
            </thead>
            <tbody>
              {g.perTour.map(({ tour, stats: s }, i) => (
                <tr key={tour.id}>
                  <td>{i === 0 && s.amount ? '🥇' : i === 1 && s.amount ? '🥈' : i === 2 && s.amount ? '🥉' : i + 1}</td>
                  <td><Link to={`/admin/tournees/${tour.id}`}><span className="swatch" style={{ background: tour.color }} />{tour.number}. {tour.name}</Link></td>
                  <td style={{ minWidth: 140 }}>
                    <div className="small">{formatPercent(s.progress)}</div>
                    <StatusBar counts={s.counts} total={s.total} height={8} />
                  </td>
                  <td className="num">{s.counts.given}</td>
                  <td className="num">{s.counts.again}</td>
                  <td className="num">{s.counts.refused + s.counts.empty}</td>
                  <td className="num">{formatEuro(s.perVisit)}</td>
                  <td className="num"><strong>{formatEuro(s.amount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}
