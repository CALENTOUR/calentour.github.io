import { useState } from 'react'
import Sheet from './ui/Sheet'

// Nouveautés montrées une fois après chaque mise à jour. Pour une nouvelle
// mise à jour : changer `id` et remplacer les listes (le message réapparaît
// alors une fois chez chacun).
export const NEWS = {
  id: '2026-11-25',
  title: 'Quoi de neuf ?',
  member: [
    ['🛟', 'Un don ne s’efface plus par erreur', 'Sur une maison qui a déjà donné, choisir « À repasser », « Refus » ou « Vide » demande maintenant de confirmer avant de supprimer le don.'],
    ['🏠', 'Pas de maison en double', 'Si tu ajoutes une maison déjà sur la carte à la même adresse, CalenTour te propose de l’ouvrir au lieu d’en créer une deuxième.'],
  ],
  admin: [
    ['🛟', 'Un don ne s’efface plus par erreur', 'Changer le statut d’une maison qui a donné demande confirmation, chez les binômes comme chez les admins.'],
    ['🏠', 'Pas de maison en double', 'L’ajout d’une maison déjà présente au même numéro, tout près, est signalé. Les maisons ajoutées gardent aussi leur rue et leur commune.'],
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
