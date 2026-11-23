import { useState } from 'react'
import { STATUSES } from '../config/constants'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { formatEuro } from '../lib/format'
import { nextUnitId } from '../lib/logements'
import { dwellingKey, moveEntry } from '../services/state'
import { saveTour } from '../services/tours'
import { useToast } from './ui/Toast'

const describe = (e) => (e?.s === 'given' ? `don de ${formatEuro(e.amount)}` : (STATUSES[e?.s]?.label ?? '').toLowerCase())

// Admin : nombre et noms des logements d'une adresse.
// Chaque ligne garde l'habitation où son passage est enregistré, pour ne rien perdre en route.
export default function UnitsEditor({ tour, house, onDone, onCancel }) {
  const toast = useToast()
  const { profile } = useAuth()
  const { statesById, year } = useData()
  const h = statesById[tour.id]?.h ?? {}
  const [rows, setRows] = useState(() => (house.units?.length
    ? house.units.map((u) => ({ id: u.id, label: u.label, key: dwellingKey(house.id, u.id) }))
    : [{ id: 'u1', label: 'Appt 1', key: dwellingKey(house.id) }]))
  const [busy, setBusy] = useState(false)

  const add = (n = 1) => setRows((list) => {
    const out = [...list]
    for (let i = 0; i < n && out.length < 200; i++) {
      let k = out.length + 1
      while (out.some((r) => r.label === `Appt ${k}`)) k++
      out.push({ id: nextUnitId(out), label: `Appt ${k}`, key: null })
    }
    return out
  })
  const removeRow = (row) => {
    const e = row.key && h[row.key]
    if (e && !window.confirm(`« ${row.label || 'Ce logement'} » a déjà un passage (${describe(e)}). Le supprimer quand même ? Il sortira du bilan et restera en gris dans l’historique de la tournée.`)) return
    setRows((list) => list.filter((r) => r !== row))
  }
  // « − » enlève le dernier logement sans passage : ceux déjà faits ne disparaissent pas par erreur.
  const removeOne = () => {
    if (rows.length < 2) return
    const free = [...rows].reverse().find((r) => !(r.key && h[r.key]))
    if (free) setRows((list) => list.filter((r) => r !== free))
    else removeRow(rows[rows.length - 1])
  }
  // Nombre tapé : appliqué en quittant la case, pour pouvoir effacer et retaper.
  const [draft, setDraft] = useState(null)
  const applyCount = () => {
    if (draft == null) return
    const n = Math.max(1, Math.min(200, Number.parseInt(draft, 10) || rows.length))
    setDraft(null)
    if (n > rows.length) return add(n - rows.length)
    let extra = rows.length - n
    const drop = new Set()
    for (const r of [...rows].reverse()) {
      if (!extra) break
      if (!(r.key && h[r.key])) { drop.add(r); extra-- }
    }
    setRows((list) => list.filter((r) => !drop.has(r)))
    if (extra) toast(`${extra} logement${extra > 1 ? 's ont' : ' a'} déjà un passage : supprime-le${extra > 1 ? 's' : ''} avec ✕ s’il le faut`)
  }

  const save = async () => {
    const building = rows.length > 1
    const units = building ? rows.map((r, i) => ({ id: r.id, label: r.label.trim() || `Appt ${i + 1}` })) : []
    const next = { ...house, units, ign: true }
    // Passages à déplacer : maison simple devenue immeuble (vers le 1er logement) ou l'inverse.
    const moves = rows
      .map((r) => [r.key, building ? dwellingKey(house.id, r.id) : dwellingKey(house.id)])
      .filter(([from, to]) => from && from !== to && h[from] && !h[to])
    setBusy(true)
    try {
      await saveTour(tour.id, { houses: tour.houses.map((x) => (x.id === house.id ? next : x)) })
      await Promise.all(moves.map(([from, to]) => moveEntry({ year, tourId: tour.id, from, to, entry: h[from], user: profile })))
      toast(building ? `${units.length} logements enregistrés` : 'Maison simple (1 logement)')
      onDone?.(next)
    } catch (err) {
      toast(`Erreur : ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="units-editor stack" onSubmit={(e) => { e.preventDefault(); save() }}>
      <div className="row units-step">
        <span className="spacer small"><strong>🏢 Nombre de logements</strong></span>
        <button type="button" className="btn-sm" onClick={removeOne} disabled={rows.length < 2} aria-label="Un logement de moins">−</button>
        <input
          type="number" inputMode="numeric" min={1} max={200} className="units-count" value={draft ?? rows.length}
          onChange={(e) => setDraft(e.target.value)} onBlur={applyCount}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCount() } }} aria-label="Nombre de logements"
        />
        <button type="button" className="btn-sm" onClick={() => add()} disabled={rows.length >= 200} aria-label="Un logement de plus">+</button>
      </div>
      {rows.length > 1 ? (
        <div className="units-rows">
          {rows.map((r, i) => {
            const e = r.key && h[r.key]
            return (
              <div key={r.id} className="units-row">
                <input
                  value={r.label} maxLength={30} placeholder={`Appt ${i + 1}`} aria-label={`Nom du logement ${i + 1}`}
                  onChange={(ev) => setRows((list) => list.map((x) => (x === r ? { ...x, label: ev.target.value } : x)))}
                />
                {e ? <span className="units-tag" style={{ '--c': STATUSES[e.s]?.color }}>{e.s === 'given' ? formatEuro(e.amount) : STATUSES[e.s]?.short}</span> : <span />}
                <button type="button" className="btn-sm btn-ghost danger" onClick={() => removeRow(r)} aria-label={`Supprimer ${r.label || `le logement ${i + 1}`}`}>✕</button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="small muted">Maison simple. Mets 2 ou plus pour un immeuble, puis nomme chaque logement.</p>
      )}
      <div className="row">
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>Annuler</button>
        <button type="submit" className="btn-primary spacer" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}
