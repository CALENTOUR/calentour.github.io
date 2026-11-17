import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconGps } from './ui/Icons'
import { projectOnLine, unflatten } from '../lib/geo'

// Au-delà, on n'est pas sur la tournée : on ne choisit pas une rue au hasard.
const MAX_DIST = 300

// Rue de la tournée la plus proche d'un point, avec sa distance en mètres.
export function nearestPiece(tour, point) {
  let best = null
  for (const p of tour?.pieces ?? []) {
    for (const l of p.lines ?? []) {
      const line = unflatten(l.c)
      if (line.length < 2) continue
      const { dist } = projectOnLine(point, line)
      if (!best || dist < best.dist) best = { pieceId: p.id, dist }
    }
  }
  return best
}

// « Me localiser » : trouve la rue où l'on est et ouvre sa carte centrée sur soi.
export default function LocateButton({ tour, base }) {
  const navigate = useNavigate()
  const [state, setState] = useState({ busy: false, msg: '' })
  const locate = () => {
    if (!navigator.geolocation) return setState({ busy: false, msg: 'Ce téléphone ne donne pas sa position.' })
    setState({ busy: true, msg: '' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const me = [pos.coords.longitude, pos.coords.latitude]
        const near = nearestPiece(tour, me)
        if (!near || near.dist > MAX_DIST) {
          const km = near ? (near.dist >= 1000 ? `${(near.dist / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(near.dist)} m`) : ''
          return setState({ busy: false, msg: `Tu n’es pas sur ta tournée${km ? ` (rue la plus proche à ${km})` : ''}.` })
        }
        setState({ busy: false, msg: '' })
        navigate(`${base}/${near.pieceId}`, { state: { me } })
      },
      (err) => setState({ busy: false, msg: err.code === 1 ? 'Position refusée : autorise la localisation pour ce site dans les réglages du téléphone.' : 'Position introuvable pour l’instant, réessaie dehors.' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    )
  }
  return (
    <div className="locate">
      <button type="button" className="btn-locate" onClick={locate} disabled={state.busy}>
        <IconGps width={20} height={20} /> {state.busy ? 'Recherche de ta position…' : 'Me localiser'}
      </button>
      {state.msg && <p className="small muted locate-msg">{state.msg}</p>}
    </div>
  )
}
