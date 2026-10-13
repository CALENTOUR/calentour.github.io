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

// Bilan : un camembert entamé.
export function IconPie(props) {
  return (
    <svg {...base} {...props}>
      <path d="M21 12a9 9 0 1 1-9-9v9z" />
      <path d="M14 3.5A9 9 0 0 1 20.5 10H14z" />
    </svg>
  )
}

// Tournées : une carte pliée.
export function IconMap(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  )
}

// Dons : un billet.
export function IconCash(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  )
}

// Réglages : trois curseurs.
export function IconSliders(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  )
}

export function IconSearch(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function IconLayers(props) {
  return (
    <svg {...base} {...props}>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  )
}

export function IconExpand(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  )
}

export function IconShrink(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    </svg>
  )
}

export function IconPlus(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconList(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  )
}

export function IconPencil(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

export function IconEye(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function IconEyeOff(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17.3 17.3 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

export function IconCheck(props) {
  return (
    <svg {...base} {...props}>
      <path d="m5 12 5 5 9-10" />
    </svg>
  )
}
