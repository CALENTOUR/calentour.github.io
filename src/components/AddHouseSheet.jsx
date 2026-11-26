import { useEffect, useState } from 'react'
import Sheet from './ui/Sheet'
import { findSameAddress, nearestAddress, splitLabel } from '../lib/addresses'
import { newId } from '../lib/format'
import { locateOnPieces } from '../lib/tourBuilder'

// Ajout d'une maison qui manque sur la carte, à l'endroit touché.
// L'adresse est proposée d'après la Base Adresse Nationale et reste modifiable.
// Si la même adresse est déjà sur la carte tout près, on propose de l'ouvrir plutôt
// que de créer un doublon (qui séparerait les passages en deux maisons).
export default function AddHouseSheet({ tour, point, onAdd, onOpen, onClose }) {
  const [label, setLabel] = useState('')
  const [ban, setBan] = useState({ street: '', city: '' })
  const [guessing, setGuessing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [same, setSame] = useState(null)

  useEffect(() => {
    let alive = true
    nearestAddress(point.lng, point.lat)
      .then((a) => { if (!alive) return; setBan(a); setLabel((cur) => cur || a.label) })
      .catch(() => {})
      .finally(() => alive && setGuessing(false))
    return () => { alive = false }
  }, [point])

  const add = async (text) => {
    const { number, street } = splitLabel(text)
    const loc = locateOnPieces(point.lng, point.lat, tour.pieces)
    const house = {
      id: newId().slice(0, 12), label: text, number, street: street || ban.street, city: ban.city,
      lng: point.lng, lat: point.lat, pieceId: loc?.pieceId ?? null, along: loc?.along ?? 0, added: true,
    }
    setBusy(true)
    try {
      await onAdd(house)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    const text = label.trim()
    if (!text) return
    const { number, street } = splitLabel(text)
    const found = findSameAddress(tour.houses, { number, street: street || ban.street, lng: point.lng, lat: point.lat })
    if (found) setSame(found)
    else add(text)
  }

  if (same) {
    return (
      <Sheet title="Cette maison existe déjà" subtitle={`${same.house.label} est sur la carte, à ${same.dist} m de l’endroit touché.`} onClose={onClose}>
        <div className="stack">
          <p className="small">Ouvre-la pour noter le passage : une deuxième maison à la même adresse séparerait les dons et resterait « à faire ».</p>
          {onOpen && <button type="button" className="btn-primary btn-big" onClick={() => { onClose(); onOpen(same.house) }}>Ouvrir {same.house.label}</button>}
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => add(label.trim())}>C’est une autre maison, l’ajouter quand même</button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setSame(null)}>← Modifier l’adresse</button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title="Maison non répertoriée" subtitle="Elle sera ajoutée à l’endroit touché, sur la rue la plus proche." onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label>Adresse
          <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder={guessing ? 'Recherche de l’adresse…' : 'ex. 12 rue de la Gare'} />
        </label>
        <button type="submit" className="btn-primary btn-big" disabled={busy || !label.trim()}>{busy ? 'Ajout…' : '🏠 Ajouter la maison'}</button>
      </form>
    </Sheet>
  )
}
