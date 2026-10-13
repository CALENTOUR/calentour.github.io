import { useNavigate } from 'react-router-dom'

// Bascule en haut de « Ma tournée » : rue par rue, ou carte de toute la tournée
// (pratique quand on ne connaît pas le nom des rues).
export default function ViewSwitch({ base }) {
  const navigate = useNavigate()
  return (
    <div className="view-switch" role="tablist">
      <button type="button" role="tab" aria-selected="true" className="on">
        <span aria-hidden="true">🏘️</span>Rue par rue
      </button>
      <button type="button" role="tab" aria-selected="false" onClick={() => navigate(`${base}/tout`)}>
        <span aria-hidden="true">🗺️</span>Vue carte
      </button>
    </div>
  )
}
