import { useMemo, useState } from 'react'
import Modal from './ui/Modal'
import { PAYMENT_FIELDS, STATUS_LIST } from '../config/constants'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { formatDate, formatEuro } from '../lib/format'
import { clearVisit, saveVisit, visitTotal } from '../services/visits'
import { StatusDot } from './ui/StatusBadge'
import { useToast } from './ui/Toast'

// Fiche de passage : statut + don pour une adresse, sur la campagne active.
export default function VisitSheet({ address, onClose, onEditAddress }) {
  const { user, isAdmin } = useAuth()
  const { activeCampaign, activeVisits, sectorsById, communesById, usersById } = useData()
  const toast = useToast()
  const existing = activeVisits[address.id]
  const sector = sectorsById[address.sectorId]

  const [form, setForm] = useState(() => ({
    status: existing?.status ?? 'done',
    calendars: existing?.calendars || 1,
    cash: existing?.cash || '',
    cheque: existing?.cheque || '',
    card: existing?.card || '',
    transfer: existing?.transfer || '',
    comment: existing?.comment ?? '',
  }))
  const total = useMemo(() => visitTotal(form), [form])
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  if (!activeCampaign) {
    return (
      <Modal title={address.label} onClose={onClose}>
        <p className="muted">Aucune campagne active. Un administrateur doit en activer une dans « Campagnes ».</p>
      </Modal>
    )
  }

  const onSave = (e) => {
    e.preventDefault()
    // Pas de await : hors ligne, l'écriture part dans la file locale.
    saveVisit({
      year: activeCampaign.year,
      sectorId: address.sectorId,
      previousSectorId: existing?.sectorId,
      addressId: address.id,
      userId: user.uid,
      data: form,
    }).catch((err) => toast(`Enregistrement refusé : ${err.message}`))
    toast(navigator.onLine ? 'Passage enregistré' : 'Enregistré sur l’appareil, envoi au retour du réseau')
    onClose()
  }

  const onReset = () => {
    clearVisit({ year: activeCampaign.year, sectorId: existing.sectorId, addressId: address.id })
      .catch((err) => toast(`Erreur : ${err.message}`))
    toast('Adresse remise « À faire »')
    onClose()
  }

  const subtitle = [sector?.name, communesById[sector?.communeId]?.name].filter(Boolean).join(' · ')

  return (
    <Modal title={address.label} subtitle={subtitle} onClose={onClose}>
      <form className="stack" onSubmit={onSave}>
        {address.comment && <div className="card small">📝 {address.comment}</div>}
        {existing && (
          <div className="muted small">
            Dernier passage : {formatDate(existing.date)} par {usersById[existing.userId]?.name ?? 'un membre'}
          </div>
        )}

        <div className="status-picker">
          {STATUS_LIST.filter((s) => s.key !== 'todo').map((s) => (
            <button
              type="button"
              key={s.key}
              className={form.status === s.key ? 'selected' : ''}
              onClick={() => setForm((f) => ({ ...f, status: s.key }))}
            >
              <StatusDot status={s.key} /> {s.label}
            </button>
          ))}
        </div>

        {form.status === 'done' && (
          <>
            <label>
              Nombre de calendriers
              <input type="number" inputMode="numeric" min="0" step="1" value={form.calendars} onChange={set('calendars')} />
            </label>
            <div className="field-row">
              {PAYMENT_FIELDS.map((p) => (
                <label key={p.key}>
                  {p.label} (€)
                  <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={form[p.key]} onChange={set(p.key)} />
                </label>
              ))}
            </div>
            <div className="total-line">
              <span>Total</span>
              <strong>{formatEuro(total)}</strong>
            </div>
          </>
        )}

        <label>
          Commentaire
          <textarea value={form.comment} onChange={set('comment')} placeholder="Ex. repasser après 18h, chien, digicode…" />
        </label>

        <div className="row">
          <button type="submit" className="btn-primary" style={{ flex: 1 }}>Enregistrer</button>
          {existing && <button type="button" className="btn-ghost" onClick={onReset}>Remettre à faire</button>}
        </div>
        {isAdmin && onEditAddress && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => onEditAddress(address)}>
            ✏️ Modifier l’adresse
          </button>
        )}
      </form>
    </Modal>
  )
}
