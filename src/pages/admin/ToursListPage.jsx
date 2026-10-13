import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TourForm from '../../components/TourForm'
import Sheet from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { TOUR_COLORS } from '../../config/constants'
import { useData } from '../../context/DataContext'
import { formatEuro, formatPercent } from '../../lib/format'
import { tourStats } from '../../lib/stats'
import { createTour } from '../../services/tours'

// Gestion des tournées : une fiche par tournée ; la toucher ouvre sa page avec
// le gros bouton « Modifier la tournée ».
export default function ToursListPage() {
  const { tours, statesById, users } = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const nextNumber = Math.max(0, ...tours.map((t) => t.number)) + 1

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tours
      .filter((t) => !q || `${t.number} ${t.name} ${(t.members ?? []).join(' ')} ${t.pieces.map((p) => p.name).join(' ')}`.toLowerCase().includes(q))
      .map((t) => ({ tour: t, stats: tourStats(t, statesById[t.id]), account: users.find((u) => u.tourId === t.id && u.active) }))
  }, [tours, statesById, users, query])

  const create = async (values) => {
    const id = await createTour(values)
    setCreating(false)
    toast(`Tournée ${values.number} créée`)
    navigate(`/admin/tournees/${id}`, { state: { edit: true } })
  }

  return (
    <div className="page stack-lg">
      <div className="row wrap">
        <div className="spacer">
          <span className="kicker">{tours.length} tournée{tours.length > 1 ? 's' : ''}</span>
          <h1>Gestion des tournées</h1>
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>＋ Nouvelle tournée</button>
      </div>
      {tours.length > 6 && <input type="search" placeholder="Chercher une tournée, un pompier, une rue…" value={query} onChange={(e) => setQuery(e.target.value)} />}

      <div className="tour-grid">
        {rows.map(({ tour: t, stats: s, account }) => (
          <Link key={t.id} to={`/admin/tournees/${t.id}`} className="tour-tile" style={{ '--tour': t.color }}>
            <span className="tour-tile-num">{t.number}</span>
            <span className="spacer tour-tile-body">
              <strong className="ellipsis">{t.name}</strong>
              <span className="small muted ellipsis">{t.pieces.length} rue{t.pieces.length > 1 ? 's' : ''} · {t.houses.length} maisons{account ? ` · 🔑 ${account.login}` : ' · pas d’accès'}</span>
              <span className="sector-bar"><i style={{ width: `${Math.round(s.progress * 100)}%` }} /></span>
              <span className="small muted">{formatPercent(s.progress)} faites · {formatEuro(s.amount)}</span>
            </span>
            <span className="tour-tile-go" aria-hidden="true">›</span>
          </Link>
        ))}
        {!rows.length && <p className="muted">{tours.length ? 'Aucune tournée ne correspond.' : 'Aucune tournée. Crée la première avec « Nouvelle tournée ».'}</p>}
      </div>

      {creating && (
        <Sheet title="Nouvelle tournée" subtitle="Ensuite, ajoute ses rues sur la carte." onClose={() => setCreating(false)}>
          <TourForm
            initial={{ number: nextNumber, members: [], color: TOUR_COLORS[(nextNumber - 1) % TOUR_COLORS.length] }}
            tours={tours}
            submitLabel="Créer et ajouter ses rues"
            onSubmit={create}
          />
        </Sheet>
      )}
    </div>
  )
}
