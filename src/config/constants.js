export const APP_NAME = 'CalenTour'
export const APP_SLOGAN = 'Le suivi intelligent des tournées de calendriers.'

export const ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
}

export const ROLE_LABELS = {
  admin: 'Administrateur',
  member: 'Membre',
}

// Statuts d'une adresse pour une campagne. L'ordre sert aux légendes et aux filtres.
export const STATUSES = {
  todo: { key: 'todo', label: 'À faire', emoji: '⚪', color: '#f8fafc', stroke: '#64748b' },
  done: { key: 'done', label: 'Don réalisé', emoji: '🟢', color: '#22c55e', stroke: '#14532d' },
  absent: { key: 'absent', label: 'Absent / Repasse', emoji: '🟠', color: '#f97316', stroke: '#7c2d12' },
  refused: { key: 'refused', label: 'Refus', emoji: '🔴', color: '#ef4444', stroke: '#7f1d1d' },
  vacant: { key: 'vacant', label: 'Vacant / Ruine / Tertiaire', emoji: '⚫', color: '#0b0b0b', stroke: '#94a3b8' },
}

export const STATUS_LIST = Object.values(STATUSES)

// Statuts considérés comme "traités" pour le pourcentage d'avancement.
export const HANDLED_STATUSES = ['done', 'refused', 'vacant']

export const PAYMENT_FIELDS = [
  { key: 'cash', label: 'Espèces' },
  { key: 'cheque', label: 'Chèque' },
  { key: 'card', label: 'CB' },
  { key: 'transfer', label: 'Virement' },
]

export const SECTOR_COLORS = [
  '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308',
  '#06b6d4', '#8b5cf6', '#f43f5e', '#84cc16', '#0ea5e9',
]

// Fond de carte vectoriel OpenStreetMap gratuit, sans clé ni quota (https://openfreemap.org).
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export const DEFAULT_MAP_VIEW = {
  center: [
    Number(import.meta.env.VITE_MAP_CENTER_LNG ?? 2.35),
    Number(import.meta.env.VITE_MAP_CENTER_LAT ?? 48.85),
  ],
  zoom: Number(import.meta.env.VITE_MAP_ZOOM ?? 13),
}
