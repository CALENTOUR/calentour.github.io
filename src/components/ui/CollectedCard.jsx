import { formatEuro } from '../../lib/format'

// Total collecté, avec son détail juste en dessous : espèces, chèques, don moyen.
export default function CollectedCard({ stats }) {
  const parts = [
    { key: 'cash', label: 'Espèces', value: formatEuro(stats.byMode.cash ?? 0), share: stats.amount ? (stats.byMode.cash ?? 0) / stats.amount : 0 },
    { key: 'cheque', label: 'Chèques', value: formatEuro(stats.byMode.cheque ?? 0), sub: `${stats.chequeCount} chèque${stats.chequeCount > 1 ? 's' : ''}`, share: stats.amount ? (stats.byMode.cheque ?? 0) / stats.amount : 0 },
    { key: 'avg', label: 'Don moyen', value: formatEuro(stats.average), sub: `${stats.counts.given} don${stats.counts.given > 1 ? 's' : ''}` },
  ]
  return (
    <section className="collected">
      <div className="collected-main">
        <span className="collected-label">Total collecté</span>
        <strong className="collected-value">{formatEuro(stats.amount)}</strong>
      </div>
      {stats.amount > 0 && (
        <div className="collected-split" aria-hidden="true">
          <i className="split-cash" style={{ width: `${parts[0].share * 100}%` }} />
          <i className="split-cheque" style={{ width: `${parts[1].share * 100}%` }} />
        </div>
      )}
      <div className="collected-parts">
        {parts.map((p) => (
          <div key={p.key} className={`collected-part part-${p.key}`}>
            <span className="collected-part-label">{p.label}</span>
            <strong>{p.value}</strong>
            {p.sub && <span className="small muted">{p.sub}</span>}
          </div>
        ))}
      </div>
    </section>
  )
}
