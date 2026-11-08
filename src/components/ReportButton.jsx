import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import Sheet from './ui/Sheet'
import { useToast } from './ui/Toast'
import { sendReport } from '../services/reports'

// Bouton rouge « Signaler une erreur » du binôme : un texte libre envoyé aux administrateurs.
export default function ReportButton({ tour, user, year }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const { pathname } = useLocation()
  const toast = useToast()
  const close = () => { setOpen(false); setText('') }
  const send = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    sendReport({ user, tour, year, text, page: pathname }).catch((err) => toast(err.code === 'permission-denied'
      ? 'Signalement refusé : préviens un admin (règles à mettre à jour).'
      : `Signalement non envoyé : ${err.message}`))
    toast(navigator.onLine === false ? 'Signalement enregistré, il partira dès le retour du réseau' : 'Signalement envoyé aux admins, merci !')
    close()
  }
  return (
    <>
      <button type="button" className="btn-report" onClick={() => setOpen(true)}>⚠️ Signaler une erreur</button>
      {open && (
        <Sheet title="Signaler une erreur" subtitle="Ton message part aux administrateurs de l’amicale." onClose={close}>
          <form className="stack" onSubmit={send}>
            <textarea
              autoFocus
              rows={5}
              maxLength={1000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ex. la maison au 12 rue des Lilas n’existe pas, il manque l’impasse derrière l’église, l’appli bloque quand je valide un don…"
              aria-label="Description de l’erreur"
            />
            <div className="row">
              <button type="button" className="btn-ghost" onClick={close}>Annuler</button>
              <button type="submit" className="btn-danger spacer" disabled={!text.trim()}>Envoyer le signalement</button>
            </div>
          </form>
        </Sheet>
      )}
    </>
  )
}
