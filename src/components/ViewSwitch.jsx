import { useNavigate } from 'react-router-dom'

const KEY = 'calentour.view'

// Vue préférée du binôme pour « Ma tournée » : liste des rues ou carte.
export function preferredView() {
  try { return localStorage.getItem(KEY) === 'carte' ? 'carte' : 'rues' } catch { return 'rues' }
}

// Bascule en haut de « Ma tournée » : rue par rue, ou carte de toute la tournée
// (pratique quand on ne connaît pas le nom des rues).
export default function ViewSwitch({ base, view, className = '' }) {
  const navigate = useNavigate()
  const go = (v) => {
    try { localStorage.setItem(KEY, v) } catch { /* navigation privée */ }
    if (v !== view) navigate(v === 'carte' ? `${base}/tout` : base, { state: { chosen: true } })
  }
  return (
    <div className={`view-switch ${className}`} role="tablist">
      <button type="button" role="tab" aria-selected={view === 'rues'} className={view === 'rues' ? 'on' : ''} onClick={() => go('rues')}>
        <span aria-hidden="true">🏘️</span>Rue par rue
      </button>
      <button type="button" role="tab" aria-selected={view === 'carte'} className={view === 'carte' ? 'on' : ''} onClick={() => go('carte')}>
        <span aria-hidden="true">🗺️</span>Vue carte
      </button>
    </div>
  )
}
