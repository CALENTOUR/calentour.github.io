import { STATUSES, STATUS_LIST } from '../../config/constants'
import { formatEuro } from '../../lib/format'

// Anneau : une part par statut (les maisons à faire en gris clair), le total au centre.
export function StatusDonut({ counts, total }) {
  const r = 70
  const c = 2 * Math.PI * r
  let offset = 0
  const parts = STATUS_LIST.map((st) => ({ st, n: counts?.[st.key] ?? 0 })).filter((p) => p.n > 0)
  return (
    <div className="donut-row">
      <svg viewBox="0 0 180 180" className="donut" role="img" aria-label="Répartition des maisons">
        <circle cx="90" cy="90" r={r} fill="none" stroke="#eee8da" strokeWidth="26" />
        {total > 0 && parts.map(({ st, n }) => {
          const len = (n / total) * c
          const el = (
            <circle key={st.key} cx="90" cy="90" r={r} fill="none" stroke={st.key === 'todo' ? '#dfe7ef' : st.color} strokeWidth="26"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 90 90)" />
          )
          offset += len
          return el
        })}
        <text x="90" y="86" textAnchor="middle" className="donut-big">{total}</text>
        <text x="90" y="108" textAnchor="middle" className="donut-small">maisons</text>
      </svg>
      <ul className="donut-legend">
        {STATUS_LIST.map((st) => (
          <li key={st.key}>
            <span className="donut-icon" style={{ background: st.key === 'todo' ? '#dfe7ef' : st.color }}>{st.icon}</span>
            <span className="spacer">{st.label}</span>
            <strong>{counts?.[st.key] ?? 0}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Une barre par rue : la part faite, colorée par statut, et l'argent récolté.
export function StreetBars({ rows }) {
  return (
    <ul className="street-bars">
      {rows.map(({ id, label, stats }) => (
        <li key={id}>
          <div className="street-bars-head">
            <span className="spacer">{label}</span>
            <strong>{formatEuro(stats.amount)}</strong>
          </div>
          <div className="street-bars-track">
            {['given', 'again', 'refused', 'empty'].map((k) => {
              const n = stats.counts[k] ?? 0
              return n && stats.total ? <span key={k} style={{ width: `${(n / stats.total) * 100}%`, background: STATUSES[k].color }} /> : null
            })}
          </div>
          <small>{stats.done}/{stats.total} faites{stats.counts.given ? ` · ${stats.counts.given} dons` : ''}</small>
        </li>
      ))}
    </ul>
  )
}

// Colonnes : l'argent récolté chaque jour de tournée.
export function DayColumns({ days }) {
  const max = Math.max(...days.map((d) => d.amount), 1)
  return (
    <div className="day-cols">
      {days.map((d) => (
        <div key={d.day} className="day-col">
          <small>{formatEuro(d.amount)}</small>
          <span className="day-col-bar" style={{ height: `${Math.max(6, (d.amount / max) * 120)}px` }} />
          <small>{new Date(`${d.day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</small>
        </div>
      ))}
    </div>
  )
}
