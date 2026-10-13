import { useEffect } from 'react'
import { createPortal } from 'react-dom'

// Panneau qui monte du bas de l'écran (fenêtre centrée sur ordinateur), rendu
// au niveau de la page pour passer au-dessus des cartes plein écran.
export default function Sheet({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        <div className="sheet-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
          <button className="btn-round" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
