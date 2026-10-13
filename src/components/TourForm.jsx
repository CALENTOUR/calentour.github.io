import { useState } from 'react'
import { TOUR_COLORS } from '../config/constants'

// Formulaire d'une tournée : numéro, pompiers (autant que nécessaire), couleur.
export default function TourForm({ initial, tours, submitLabel = 'Enregistrer', onSubmit }) {
  const [number, setNumber] = useState(initial.number)
  const [members, setMembers] = useState(initial.members?.length ? initial.members : ['', ''])
  const [color, setColor] = useState(initial.color)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const setMember = (i, v) => setMembers((list) => list.map((m, j) => (j === i ? v : m)))
  const removeMember = (i) => setMembers((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : ['']))

  const submit = async (e) => {
    e.preventDefault()
    const n = Number.parseInt(number, 10)
    if (!n || n < 1) return setError('Indique un numéro de tournée.')
    const twin = tours.find((t) => t.number === n && t.id !== initial.id)
    if (twin) return setError(`Le numéro ${n} est déjà pris par « ${twin.name} ».`)
    const names = members.map((m) => m.trim()).filter(Boolean)
    setError('')
    setBusy(true)
    try {
      await onSubmit({ number: n, members: names, name: names.join(' / ') || `Tournée ${n}`, color })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>N° de tournée<input type="number" min="1" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} /></label>
      <div className="stack-sm">
        <span className="label">Pompiers de la tournée</span>
        {members.map((m, i) => (
          <div key={i} className="row">
            <input className="spacer" value={m} onChange={(e) => setMember(i, e.target.value)} placeholder={`Prénom ${i + 1}`} aria-label={`Pompier ${i + 1}`} />
            <button type="button" className="btn-round btn-ghost" onClick={() => removeMember(i)} aria-label={`Retirer le pompier ${i + 1}`}>✕</button>
          </div>
        ))}
        <button type="button" className="btn-sm btn-ghost align-start" onClick={() => setMembers((list) => [...list, ''])}>＋ Ajouter un pompier</button>
      </div>
      <div className="chips">
        {TOUR_COLORS.map((c) => (
          <button key={c} type="button" className={`color-dot ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Couleur ${c}`} />
        ))}
      </div>
      {error && <div className="error small">{error}</div>}
      <button type="submit" className="btn-primary" disabled={busy}>{submitLabel}</button>
    </form>
  )
}
