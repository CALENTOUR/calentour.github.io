import { useState } from 'react'
import Sheet from './ui/Sheet'
import { PAYMENT_MODES, QUICK_AMOUNTS, RESULT_STATUSES, STATUSES } from '../config/constants'
import { formatDate, formatEuro, toNumber } from '../lib/format'
import { dwellingKey, recordPassage } from '../services/state'

function navigationUrl(house) {
  return `https://www.google.com/maps/dir/?api=1&destination=${house.lat},${house.lng}&travelmode=walking`
}

// Saisie d'un passage : 4 gros boutons, puis montant et mode si don.
function DwellingForm({ entry, onSave, onReset }) {
  const [step, setStep] = useState('status')
  const [amount, setAmount] = useState(entry?.s === 'given' ? String(entry.amount) : '')
  const [mode, setMode] = useState(entry?.mode ?? 'cash')
  const value = toNumber(amount)

  if (step === 'amount') {
    return (
      <div className="stack">
        <label className="amount-input">
          <input
            inputMode="decimal" autoFocus placeholder="0" value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
            aria-label="Montant du don en euros"
          />
          <span>€</span>
        </label>
        <div className="chips">
          {QUICK_AMOUNTS.map((a) => (
            <button key={a} type="button" className={`chip ${value === a ? 'chip-on' : ''}`} onClick={() => setAmount(String(a))}>{a} €</button>
          ))}
        </div>
        <div className="segmented">
          {PAYMENT_MODES.map((m) => (
            <button key={m.key} type="button" className={mode === m.key ? 'on' : ''} onClick={() => setMode(m.key)}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>
        <div className="row">
          <button type="button" className="btn-ghost" onClick={() => setStep('status')}>← Retour</button>
          <button type="button" className="btn-primary btn-big spacer" disabled={!value} onClick={() => onSave('given', value, mode)}>
            Valider {value ? formatEuro(value) : ''}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="status-grid">
        {RESULT_STATUSES.map((s) => (
          <button
            key={s.key} type="button"
            className={`status-btn ${entry?.s === s.key ? 'current' : ''}`}
            style={{ '--c': s.color, '--cs': s.stroke }}
            onClick={() => (s.key === 'given' ? setStep('amount') : onSave(s.key))}
          >
            <span className="status-btn-icon">{s.icon}</span>
            <span className="status-btn-label">{s.label}</span>
            {s.hint && <span className="status-btn-hint">{s.hint}</span>}
          </button>
        ))}
      </div>
      {entry && (
        <div className="row small muted">
          <span className="spacer">
            Dernier passage : {STATUSES[entry.s]?.label}{entry.s === 'given' ? ` ${formatEuro(entry.amount)}` : ''}, le {formatDate(entry.at)}
          </span>
          <button type="button" className="btn-ghost btn-sm" onClick={onReset}>Remettre à faire</button>
        </div>
      )}
    </div>
  )
}

export default function HouseSheet({ tour, house, state, year, user, onClose, onSaved }) {
  const h = state?.h ?? {}
  const [unitId, setUnitId] = useState(house.units?.length ? null : undefined)
  const isBuilding = Boolean(house.units?.length)
  const unit = isBuilding && unitId ? house.units.find((u) => u.id === unitId) : null
  const key = dwellingKey(house.id, unit?.id)

  const save = (status, amount, mode) => {
    // Pas d'attente : hors ligne, l'écriture part dans la file locale.
    recordPassage({ year, tourId: tour.id, key, status, amount, mode, user })
    onSaved?.(status, amount)
    if (isBuilding) setUnitId(null)
    else onClose()
  }

  const title = isBuilding && unit ? `${house.label} · ${unit.label}` : house.label

  return (
    <Sheet
      title={title || 'Maison'}
      subtitle={isBuilding ? `Immeuble · ${house.units.length} logements` : house.city}
      onClose={onClose}
      compact
      actions={<a className="btn btn-sm btn-ghost sheet-route" href={navigationUrl(house)} target="_blank" rel="noreferrer" title="Itinéraire">🧭<span className="hide-mobile"> Itinéraire</span></a>}
    >
      {isBuilding && !unit ? (
        <div className="stack">
          <div className="unit-grid">
            {house.units.map((u) => {
              const s = STATUSES[h[dwellingKey(house.id, u.id)]?.s ?? 'todo']
              return (
                <button key={u.id} type="button" className="unit-btn" style={{ '--c': s.color, '--cs': s.stroke }} onClick={() => setUnitId(u.id)}>
                  <strong>{u.label}</strong>
                  <span className="small">{s.short}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          <DwellingForm key={key} entry={h[key]} onSave={save} onReset={() => save('todo')} />
          {isBuilding && <button type="button" className="btn-ghost btn-sm" onClick={() => setUnitId(null)}>← Tous les logements</button>}
        </>
      )}
    </Sheet>
  )
}
