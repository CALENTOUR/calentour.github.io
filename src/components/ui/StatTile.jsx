export default function StatTile({ icon, label, value, sub, tone }) {
  return (
    <div className={`tile ${tone ? `tile-${tone}` : ''}`}>
      {icon && <div className="tile-icon" aria-hidden="true">{icon}</div>}
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  )
}
