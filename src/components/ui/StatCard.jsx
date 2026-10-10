import { formatDelta } from '../../lib/format'

export default function StatCard({ label, value, current, previous, previousLabel }) {
  const hasCompare = previous != null
  const trend = hasCompare && previous ? (current > previous ? 'up' : current < previous ? 'down' : '') : ''
  return (
    <div className="card stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hasCompare && (
        <div className={`delta ${trend}`}>
          {formatDelta(current, previous)} vs {previousLabel}
        </div>
      )}
    </div>
  )
}
