export default function ProgressBar({ value, color }) {
  const pct = Math.max(0, Math.min(100, Math.round((value || 0) * 100)))
  return (
    <div className="progress" title={`${pct} %`}>
      <div style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
