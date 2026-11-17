import { useState } from 'react'
import Sheet from './ui/Sheet'

// Nouveautés montrées une fois après chaque mise à jour. Pour une nouvelle
// mise à jour : changer `id` et remplacer les listes (le message réapparaît
// alors une fois chez chacun).
export const NEWS = {
  id: '2026-11-17',
  title: 'Quoi de neuf ?',
  member: [
    ['📍', 'Me localiser', 'Nouveau bouton au-dessus de tes rues : il ouvre la rue où tu es, centrée sur toi.'],
    ['🏘️', '5 et 5 bis dans le même bâtiment', 'Le bâtiment est coupé en deux : chaque adresse a sa couleur et sa propre fiche.'],
    ['✏️', 'Corriger un don', 'Dans la fiche de la maison : « Modifier le montant » ou « Annuler le don ». Et dans Mon bilan, la liste de tes derniers dons.'],
    ['🏢', 'Immeubles', 'Les logements faits sur le total (« 2/4 ») sont écrits en gros sur le bâtiment.'],
    ['🔍', 'Carte plus calme', 'Toucher une autre rue ne dézoome plus la carte, et l’appli ne zoome plus toute seule sur iPhone.'],
    ['🚫', 'Maisons vides', 'Elles comptent comme faites, mais ne font plus baisser le pourcentage de dons.'],
  ],
  admin: [
    ['🗺️', 'Bandeau des tournées', 'Sur téléphone, il monte en touchant son titre ou en le glissant vers le haut.'],
    ['🏘️', '5 et 5 bis dans le même bâtiment', 'Le bâtiment est coupé en parts, une couleur par adresse.'],
    ['✏️', 'Corriger un don', 'Les binômes peuvent modifier ou annuler un don depuis la fiche ou Mon bilan.'],
    ['🚫', 'Maisons vides', 'Hors des taux (dons, refus, € par maison visitée), toujours comptées dans l’avancement.'],
    ['📍', 'Côté binômes', 'Bouton « Me localiser » et logements « 2/4 » en gros sur les immeubles.'],
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
