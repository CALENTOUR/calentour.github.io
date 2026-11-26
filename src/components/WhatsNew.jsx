import { useState } from 'react'
import Sheet from './ui/Sheet'

// Nouveautés montrées une fois après chaque mise à jour. Pour une nouvelle
// mise à jour : changer `id` et remplacer les listes (le message réapparaît
// alors une fois chez chacun).
export const NEWS = {
  id: '2026-11-26b',
  title: 'Quoi de neuf ?',
  member: [
    ['✅', 'Don bien enregistré', 'Après « Valider », la fiche affiche en vert le montant et l’adresse un instant : le don est noté, inutile de réappuyer. Si tu notes un don juste à côté d’un autre (même bâtiment, adresse bis), l’appli demande si c’est le même don. Une maison qui a déjà donné affiche son don avant tout nouveau montant.'],
    ['✏️', 'Corriger une adresse', 'Une maison porte un mauvais numéro ou un mauvais nom de rue ? Ouvre-la et touche « Adresse fausse ? La corriger ». Elle garde sa place et ses passages.'],
  ],
  admin: [
    ['✅', 'Fini les dons en double', 'Après « Valider », la fiche montre le don en vert puis se ferme. Un toucher en trop ne rouvre plus la maison voisine. Un don noté dans le même bâtiment qu’un autre (3 min), ou à côté / du même montant (1 min), demande d’abord si c’est le même. Saisir un montant sur une maison qui a déjà un don affiche une alerte avec ce don.'],
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
