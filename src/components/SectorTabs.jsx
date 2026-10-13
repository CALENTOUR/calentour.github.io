// Onglets des secteurs d'une tournée (un par endroit, nommé d'après ses villages) :
// toucher un onglet cadre la carte sur ce bout de la tournée.
export default function SectorTabs({ areas, active, onChoose, className = '' }) {
  if (areas.length < 2) return null
  return (
    <div className={`village-chips sector-tabs ${className}`} role="tablist" aria-label="Secteurs de la tournée">
      <button type="button" role="tab" aria-selected={!active} className={!active ? 'on' : ''} onClick={() => onChoose(null)}>Toute la tournée</button>
      {areas.map((a) => (
        <button key={a.id} type="button" role="tab" aria-selected={active === a.id} className={active === a.id ? 'on' : ''} onClick={() => onChoose(a)}>
          📍 {a.name} <span className="chip-pct">{a.pieceIds.length} rue{a.pieceIds.length > 1 ? 's' : ''}</span>
        </button>
      ))}
    </div>
  )
}
