import { useState } from 'react'
import Sheet from './ui/Sheet'

// Nouveautés montrées une fois après chaque mise à jour. Pour une nouvelle
// mise à jour : changer `id` et remplacer les listes (le message réapparaît
// alors une fois chez chacun).
export const NEWS = {
  id: '2026-11-25b',
  title: 'Quoi de neuf ?',
  member: [],
  admin: [
    ['🏠', 'Maisons en double', 'Réglages › Maisons à vérifier › Maisons en double : les maisons ajoutées par un binôme alors que l’adresse existait déjà. Une fusion garde la maison d’origine, à la position choisie, avec le passage le plus avancé.'],
  ],
}

const KEY = 'calentour-news-seen'
const seen = () => { try { return localStorage.getItem(KEY) } catch { return NEWS.id } }
const markSeen = () => { try { localStorage.setItem(KEY, NEWS.id) } catch { /* navigation privée */ } }

export default function WhatsNew({ isAdmin }) {
  const [open, setOpen] = useState(() => seen() !== NEWS.id)
  const items = isAdmin ? NEWS.admin : NEWS.member
  if (!open || !items.length) return null
  const close = () => { markSeen(); setOpen(false) }
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
