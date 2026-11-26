import { useState } from 'react'
import Sheet from './ui/Sheet'

// Nouveautés montrées une fois après chaque mise à jour. Pour une nouvelle
// mise à jour : changer `id` et remplacer les listes (le message réapparaît
// alors une fois chez chacun).
export const NEWS = {
  id: '2026-11-26',
  title: 'Quoi de neuf ?',
  member: [
    ['✏️', 'Corriger une adresse', 'Une maison porte un mauvais numéro ou un mauvais nom de rue ? Ouvre-la et touche « Adresse fausse ? La corriger ». Elle garde sa place et ses passages.'],
  ],
  admin: [
    ['✏️', 'Adresses corrigées par les binômes', 'Les binômes peuvent corriger le numéro (bis compris) et la rue d’une maison depuis sa fiche. L’adresse d’origine reste notée sur la maison. Si l’adresse existe déjà tout près, l’appli prévient avant d’enregistrer.'],
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
