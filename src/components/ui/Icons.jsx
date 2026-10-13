// Petites icônes au trait, qui prennent la couleur du texte.
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

// Ma tournée : un trajet en pointillés jusqu'à un repère de maison.
export function IconTour(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20c3-1 4-3 6-5" strokeDasharray="0.5 3.2" />
      <path d="M16 21s-6-5.3-6-9.5a6 6 0 0 1 12 0c0 4.2-6 9.5-6 9.5z" />
      <path d="M13.6 12.6v-2l2.4-1.9 2.4 1.9v2z" />
    </svg>
  )
}

// Tableau de bord : un compteur et ses barres.
export function IconDashboard(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 16v-3M12 16V8M16 16v-5" />
    </svg>
  )
}

// Position GPS : une cible.
export function IconGps(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  )
}
