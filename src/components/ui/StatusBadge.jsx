import { STATUSES } from '../../config/constants'

export function StatusDot({ status }) {
  const s = STATUSES[status] ?? STATUSES.todo
  return <span className="dot" style={{ background: s.color, borderColor: s.stroke }} />
}

export default function StatusBadge({ status }) {
  const s = STATUSES[status] ?? STATUSES.todo
  return (
    <span className="badge">
      <StatusDot status={s.key} />
      {s.label}
    </span>
  )
}
