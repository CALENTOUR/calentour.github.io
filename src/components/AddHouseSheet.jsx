import { useEffect, useState } from 'react'
import Sheet from './ui/Sheet'
import { nearestAddress } from '../lib/addresses'
import { newId } from '../lib/format'
import { locateOnPieces } from '../lib/tourBuilder'

// Ajout d'une maison qui manque sur la carte, à l'endroit touché.
// L'adresse est proposée d'après la Base Adresse Nationale et reste modifiable.
export default function AddHouseSheet({ tour, point, onAdd, onClose }) {
  const [label, setLabel] = useState('')
  const [guessing, setGuessing] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    nearestAddress(point.lng, point.lat)
      .then((a) => alive && setLabel((cur) => cur || a))
      .catch(() => {})
      .finally(() => alive && setGuessing(false))
    return () => { alive = false }
  }, [point])

  const submit = async (e) => {
    e.preventDefault()
    const text = label.trim()
    if (!text) return
    const loc = locateOnPieces(point.lng, point.lat, tour.pieces)
    const house = { id: newId().slice(0, 12), label: text, number: text.split(' ')[0], lng: point.lng, lat: point.lat, pieceId: loc?.pieceId ?? null, along: loc?.along ?? 0, added: true }
    setBusy(true)
    try {
      await onAdd(house)
      onClose()
    } finally {
      setBusy(false)
    }
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
