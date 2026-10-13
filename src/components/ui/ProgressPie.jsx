import { useState } from 'react'
import { STATUS_LIST } from '../../config/constants'
import { formatPercent } from '../../lib/format'

// « À faire » est blanc sur la carte ; sur le camembert il lui faut une teinte visible.
const PIE_COLOR = { todo: '#dfe5ec' }

// Camembert de l'avancement : part de chaque statut, pourcentage de maisons faites au centre.
export default function ProgressPie({ counts, total, progress, size = 180 }) {
  const [hover, setHover] = useState(null)
  const r = size / 2 - 14
  const c = 2 * Math.PI * r
  const items = STATUS_LIST.map((s) => ({ ...s, n: counts?.[s.key] ?? 0 }))
  let offset = 0
  const shown = hover ? items.find((x) => x.key === hover) : null

  return (
    <div className="pie">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Avancement : ${formatPercent(progress)} des maisons faites`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-2)" strokeWidth="26" />
        {total > 0 && items.filter((x) => x.n).map((x) => {
          const len = (x.n / total) * c
          const seg = (
            <circle
              key={x.key} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={PIE_COLOR[x.key] ?? x.color} strokeWidth={hover === x.key ? 30 : 26}
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              onMouseEnter={() => setHover(x.key)} onMouseLeave={() => setHover(null)}
              onClick={() => setHover((h) => (h === x.key ? null : x.key))}
            >
              <title>{`${x.label} : ${x.n} (${formatPercent(x.n / total)})`}</title>
            </circle>
          )
          offset += len
          return seg
        })}
        <text x="50%" y="48%" textAnchor="middle" className="pie-num">{shown ? shown.n : formatPercent(progress)}</text>
        <text x="50%" y="62%" textAnchor="middle" className="pie-sub">{shown ? shown.label : 'faites'}</text>
      </svg>
      <ul className="pie-legend">
        {items.map((x) => (
          <li key={x.key} className={hover === x.key ? 'on' : ''} onMouseEnter={() => setHover(x.key)} onMouseLeave={() => setHover(null)}>
            <i style={{ background: PIE_COLOR[x.key] ?? x.color, borderColor: x.stroke }} />
            <span className="spacer">{x.label}</span>
            <strong>{x.n}</strong>
            <span className="small muted">{total ? formatPercent(x.n / total) : '0 %'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
