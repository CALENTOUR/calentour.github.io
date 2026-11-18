import { useState } from 'react'
import HouseSheet from './HouseSheet'
import { useToast } from './ui/Toast'
import { formatDate, formatEuro } from '../lib/format'

const SHOWN = 8

// « Mes derniers dons » : chaque don se touche pour en corriger le montant ou l'annuler,
// même quand on ne retrouve plus la maison sur la carte.
export default function LastDons({ tour, state, year, user }) {
  const toast = useToast()
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState(null)
  const byId = new Map((tour.houses ?? []).map((x) => [x.id, x]))
  const dons = Object.entries(state?.h ?? {})
    .filter(([, e]) => e?.s === 'given')
    .map(([key, e]) => {
      const [houseId, unitId] = key.split('__')
      const house = byId.get(houseId)
      const unit = unitId ? house?.units?.find((u) => u.id === unitId) : null
      // Habitation qui n'existe plus sous cette forme : le don ne compte pas, seul un admin peut le rattacher ou l'annuler.
      const lost = !house || (unitId ? !unit : Boolean(house.units?.length))
      return { key, e, house, unit, lost }
    })
    .sort((a, b) => String(b.e.at ?? '').localeCompare(String(a.e.at ?? '')))
  if (!dons.length) return null
  const list = all ? dons : dons.slice(0, SHOWN)
  const current = open && dons.find((d) => d.key === open && !d.lost)

  return (
    <section className="card stack">
      <h2>Mes derniers dons</h2>
      <p className="small muted">Une erreur ? Touche le don pour changer le montant ou l’annuler.</p>
      <ul className="last-dons">
        {list.map(({ key, e, house, unit, lost }) => (
          <li key={key}>
            <button type="button" className="last-don" disabled={lost} onClick={() => setOpen(key)}>
              <span className="spacer">
                <strong>{house?.label ?? 'Maison retirée'}{unit ? ` · ${unit.label}` : ''}</strong>
                <small className="muted">{formatDate(e.at)}{e.mode === 'cheque' ? ' · chèque' : ''}{lost ? ' · ne compte pas, voir un admin' : ''}</small>
              </span>
              <strong>{formatEuro(e.amount)}</strong>
              {!lost && <span className="last-don-edit">Corriger</span>}
            </button>
          </li>
        ))}
      </ul>
      {dons.length > SHOWN && (
        <button type="button" className="btn-ghost btn-sm" onClick={() => setAll((v) => !v)}>
          {all ? 'Voir moins' : `Voir tous les dons (${dons.length})`}
        </button>
      )}
      {current && (
        <HouseSheet
          tour={tour} house={current.house} initialUnitId={current.unit?.id ?? null}
          state={state} year={year} user={user}
          onClose={() => setOpen(null)}
          onSaved={(status, amount) => {
            toast(status === 'todo' ? 'Don annulé' : status === 'given' ? `Don corrigé : ${formatEuro(amount)}` : 'Passage modifié')
            setOpen(null)
          }}
        />
      )}
    </section>
  )
}
