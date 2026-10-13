import { STATUS_LIST } from '../../config/constants'

// Barre empilée : part de chaque statut.
export default function StatusBar({ counts, total, height = 10 }) {
  return (
    <div className="status-bar" style={{ height }}>
      {STATUS_LIST.filter((s) => s.key !== 'todo').map((s) => {
        const n = counts?.[s.key] ?? 0
        if (!n || !total) return null
        return <span key={s.key} style={{ width: `${(n / total) * 100}%`, background: s.color }} title={`${s.label} : ${n}`} />
      })}
    </div>
  )
}
