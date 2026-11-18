import { useState } from 'react'
import Sheet from './ui/Sheet'

// Nouveautés montrées une fois après chaque mise à jour. Pour une nouvelle
// mise à jour : changer `id` et remplacer les listes (le message réapparaît
// alors une fois chez chacun).
export const NEWS = {
  id: '2026-11-18',
  title: 'Quoi de neuf ?',
  member: [
    ['✏️', 'Corriger un don', 'Dans Mon bilan, « Mes derniers dons » : touche un don pour changer son montant ou l’annuler. Un don grisé est à voir avec un admin.'],
    ['🏢', 'Immeubles', 'Passer une maison en immeuble (ou l’inverse) garde maintenant son don.'],
    ['📊', 'Mon bilan', 'Le graphique « Dons par jour » est retiré.'],
  ],
  admin: [
    ['🕓', 'Historique des dons', 'Dans la fiche d’une tournée : qui a saisi quoi et quand, et remise en état d’une tournée (à une heure donnée, ou en annulant les annulations).'],
    ['💶', 'Bilan juste', 'Un don resté sur un logement qui n’existe plus compte dans le total, et peut être annulé depuis l’historique.'],
    ['📊', 'Mon bilan des binômes', 'Le graphique « Dons par jour » est retiré de leur vue.'],
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
