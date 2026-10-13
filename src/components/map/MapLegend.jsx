import { useState } from 'react'
import { STATUS_LIST } from '../../config/constants'
import { LIT_COLORS, OTHER_BUILDING } from './houseBuildings'

const KEY = 'calentour-legend-seen'
const seen = () => {
  try { return localStorage.getItem(KEY) === '1' } catch { return true }
}

// Code couleur des maisons, ouvert d'office la première fois puis à la demande.
export default function MapLegend() {
  const [open, setOpen] = useState(() => !seen())
  const toggle = () => {
    setOpen((v) => !v)
    try { localStorage.setItem(KEY, '1') } catch { /* stockage indisponible */ }
  }
  return (
    <div className="map-legend-wrap">
      {open && (
        <div className="house-legend" role="dialog" aria-label="Couleurs des maisons">
          <div className="house-legend-head">
            <strong>Que veulent dire les couleurs ?</strong>
            <button type="button" className="legend-close" onClick={toggle} aria-label="Fermer">✕</button>
          </div>
          <ul>
            {STATUS_LIST.map((s) => (
              <li key={s.key}><i style={{ background: LIT_COLORS[s.key] }} />{s.label}</li>
            ))}
            <li className="house-legend-other"><i className="legend-pale" />Couleur pâle : maison d’une autre rue de ta tournée</li>
            <li className="house-legend-other"><i style={{ background: OTHER_BUILDING }} />Maison grise claire : pas dans ta tournée</li>
          </ul>
        </div>
      )}
      {!open && <button type="button" className={`legend-btn${open ? ' on' : ''}`} onClick={toggle} aria-expanded={open} aria-label="Couleurs des maisons" title="Couleurs des maisons">
        {open ? '✕' : <span className="legend-dots">{['todo', 'given', 'again', 'refused'].map((k) => <i key={k} style={{ background: LIT_COLORS[k] }} />)}</span>}
      </button>}
    </div>
  )
}
