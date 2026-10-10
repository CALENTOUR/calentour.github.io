import { useState } from 'react'
import Modal from './ui/Modal'
import { useData } from '../context/DataContext'
import { addAddress, deleteAddress, updateAddress } from '../services/addresses'
import { useToast } from './ui/Toast'

// Création / modification d'une adresse (administrateurs).
// Aucune donnée personnelle : adresse, position GPS et commentaire uniquement.
export default function AddressForm({ address, initial, onClose }) {
  const { sectors } = useData()
  const toast = useToast()
  const isNew = !address
  const [form, setForm] = useState(() => ({
    label: address?.label ?? initial?.label ?? '',
    lat: address?.lat ?? initial?.lat ?? '',
    lng: address?.lng ?? initial?.lng ?? '',
    comment: address?.comment ?? '',
    sectorId: address?.sectorId ?? initial?.sectorId ?? '',
  }))
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = (e) => {
    e.preventDefault()
    if (!form.sectorId) return toast('Choisissez un secteur')
    const op = isNew
      ? addAddress(form.sectorId, form)
      : updateAddress(address, form, form.sectorId)
    op.catch((err) => toast(`Erreur : ${err.message}`))
    toast(isNew ? 'Adresse ajoutée' : 'Adresse modifiée')
    onClose()
  }

  const onDelete = () => {
    if (!confirm(`Supprimer « ${address.label} » ?`)) return
    deleteAddress(address).catch((err) => toast(`Erreur : ${err.message}`))
    toast('Adresse supprimée')
    onClose()
  }

  return (
    <Modal title={isNew ? 'Nouvelle adresse' : 'Modifier l’adresse'} onClose={onClose}>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          Adresse
          <input required value={form.label} onChange={set('label')} placeholder="12 rue des Pompiers, 75000 Ville" />
        </label>
        <label>
          Secteur
          <select required value={form.sectorId} onChange={set('sectorId')}>
            <option value="">Choisir…</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <div className="field-row">
          <label>
            Latitude
            <input required type="number" step="any" value={form.lat} onChange={set('lat')} />
          </label>
          <label>
            Longitude
            <input required type="number" step="any" value={form.lng} onChange={set('lng')} />
          </label>
        </div>
        <label>
          Commentaire permanent
          <textarea value={form.comment} onChange={set('comment')} placeholder="Ex. boîte aux lettres à l’arrière" />
        </label>
        <div className="row">
          <button type="submit" className="btn-primary" style={{ flex: 1 }}>{isNew ? 'Ajouter' : 'Enregistrer'}</button>
          {!isNew && <button type="button" className="btn-danger" onClick={onDelete}>Supprimer</button>}
        </div>
      </form>
    </Modal>
  )
}
