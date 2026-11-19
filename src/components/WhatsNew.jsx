import { useState } from 'react'
import Sheet from './ui/Sheet'

// Nouveautés montrées une fois après chaque mise à jour. Pour une nouvelle
// mise à jour : changer `id` et remplacer les listes (le message réapparaît
// alors une fois chez chacun).
export const NEWS = {
  id: '2026-11-19',
  title: 'Quoi de neuf ?',
  member: [
    ['🔢', 'Numéros de maison', 'Plus gros sur la carte et écrits au milieu de chaque maison (sur le toit en 3D). Deux numéros trop serrés : zoome pour voir les deux.'],
  ],
  admin: [
    ['🔢', 'Numéros de maison', 'Plus gros sur la carte et écrits au milieu de chaque maison (sur le toit en 3D). Deux numéros trop serrés : zoome pour voir les deux.'],
  ],
}

const KEY = 'calentour-news-seen'
const seen = () => { try { return localStorage.getItem(KEY) } catch { return NEWS.id } }
const markSeen = () => { try { localStorage.setItem(KEY, NEWS.id) } catch { /* navigation privée */ } }

export default function WhatsNew({ isAdmin }) {
  const [open, setOpen] = useState(() => seen() !== NEWS.id)
  if (!open) return null
  const close = () => { markSeen(); setOpen(false) }
  const items = isAdmin ? NEWS.admin : NEWS.member
  return (
    <Sheet title={NEWS.title} subtitle="Mise à jour de CalenTour" onClose={close}>
      <ul className="news-list">
        {items.map(([icon, title, text]) => (
          <li key={title}>
            <span className="news-icon" aria-hidden="true">{icon}</span>
            <span><strong>{title}</strong><span className="small muted">{text}</span></span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-primary btn-big" onClick={close}>C’est compris</button>
    </Sheet>
  )
}
