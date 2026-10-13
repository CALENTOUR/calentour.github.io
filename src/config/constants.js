export const APP_NAME = 'CalenTour'
export const APP_SLOGAN = 'Le suivi intelligent des tournées de calendriers.'

export const ROLES = { ADMIN: 'admin', MEMBER: 'member' }

// Statuts d'une maison (ou d'un logement) pour une campagne.
// "todo" est l'état de départ, les quatre autres sont les résultats d'un passage.
export const STATUSES = {
  todo: { key: 'todo', label: 'À faire', short: 'À faire', icon: '🏠', color: '#ffffff', stroke: '#2f5f8f' },
  given: { key: 'given', label: 'A donné', short: 'Don', icon: '💶', color: '#4f8a4c', stroke: '#2f5a2e' },
  again: { key: 'again', label: 'À repasser', short: 'Repasser', icon: '🔁', color: '#d39b2a', stroke: '#8a5f12', hint: 'Absent ou « repassez »' },
  refused: { key: 'refused', label: 'Refus', short: 'Refus', icon: '✋', color: '#b8432f', stroke: '#7a2a1d' },
  empty: { key: 'empty', label: 'Habitation vide', short: 'Vide', icon: '🚫', color: '#a8a294', stroke: '#5e5a50' },
}
export const STATUS_LIST = Object.values(STATUSES)
export const RESULT_STATUSES = STATUS_LIST.filter((s) => s.key !== 'todo')
// Une maison est "faite" quand il n'y a plus besoin d'y retourner.
export const DONE_STATUSES = ['given', 'refused', 'empty']

export const PAYMENT_MODES = [
  { key: 'cash', label: 'Espèces', icon: '💶' },
  { key: 'cheque', label: 'Chèque', icon: '🧾' },
]
export const QUICK_AMOUNTS = [5, 10, 15, 20, 30]

export const TOUR_COLORS = [
  '#e11d48', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777',
  '#4f46e5', '#059669', '#dc2626', '#7c3aed', '#0284c7', '#65a30d', '#c026d3', '#d97706',
]

// Fond de carte vectoriel OpenStreetMap gratuit, sans clé ni quota (https://openfreemap.org).
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export const DEFAULT_MAP_VIEW = {
  center: [
    Number(import.meta.env.VITE_MAP_CENTER_LNG || 6.23),
    Number(import.meta.env.VITE_MAP_CENTER_LAT || 48.225),
  ],
  zoom: Number(import.meta.env.VITE_MAP_ZOOM || 12.5),
}

// Les identifiants de connexion sont convertis en adresse email technique pour Firebase.
export const LOGIN_DOMAIN = 'calentour.app'
