import { useEffect, useRef, useState } from 'react'
import Sheet from './ui/Sheet'
import { MAP_COLORS, PAYMENT_MODES, QUICK_AMOUNTS, RESULT_STATUSES, STATUSES } from '../config/constants'
import { formatDate, formatEuro, toNumber } from '../lib/format'
import { carryPassage, dwellingKey, recordPassage } from '../services/state'
import { saveHouseNote, saveTour } from '../services/tours'
import { withUnits } from '../lib/logements'
import { cleanNumber, findSameAddress, splitLabel } from '../lib/addresses'
import { agoText, findRecentDon } from '../lib/recentDon'

function navigationUrl(house) {
  return `https://www.google.com/maps/dir/?api=1&destination=${house.lat},${house.lng}&travelmode=walking`
}

// Saisie d'un passage : 4 gros boutons, puis montant et mode si don.
function DwellingForm({ entry, title, onSave, onReset, onDrop, checkRecent }) {
  const [step, setStep] = useState('status')
  // Don qui ressemble à celui qu'on vient de noter à côté : on demande avant d'enregistrer.
  const [twin, setTwin] = useState(null)
  const validate = () => {
    const recent = checkRecent?.(value)
    if (recent) setTwin(recent)
    else onSave('given', value, mode)
  }
  const [amount, setAmount] = useState(entry?.s === 'given' ? String(entry.amount) : '')
  const [mode, setMode] = useState(entry?.mode ?? 'cash')
  const value = toNumber(amount)
  const [confirmCancel, setConfirmCancel] = useState(false)
  // Statut choisi sur une maison qui a déjà donné : il remplacerait le don, on demande d'abord.
  const [replacing, setReplacing] = useState(null)
  const given = entry?.s === 'given'
  const pick = (key) => {
    if (key === 'given') setStep('amount')
    else if (given) setReplacing(key)
    else onSave(key)
  }

  if (step === 'amount' && twin) {
    const where = twin.unit ? `${twin.house.label} · ${twin.unit.label}` : twin.house.label
    return (
      <div className="stack">
        <div className="don-box don-replace don-twin">
          <span>
            ⚠️ Tu viens d’enregistrer <strong>{formatEuro(twin.entry.amount)}</strong> au <strong>{where}</strong> {agoText(twin.ago)}
            {twin.sameBuilding ? ', dans le même bâtiment.' : '.'}
          </span>
          <span>C’est le même don, ou un deuxième don ici, au <strong>{title}</strong> ?</span>
        </div>
        <button type="button" className="btn-primary btn-big" onClick={onDrop}>C’est le même don, ne rien ajouter</button>
        <button type="button" className="btn-ghost" onClick={() => onSave('given', value, mode)}>Oui, un autre don de {formatEuro(value)} ici</button>
      </div>
    )
  }

  if (step === 'amount') {
    return (
      <div className="stack">
        <div className="small muted">Don pour <strong>{title}</strong></div>
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
          <button type="button" className="btn-primary btn-big spacer" disabled={!value} onClick={validate}>
            Valider {value ? formatEuro(value) : ''}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      {given && (
        <div className="don-box">
          <span className="spacer">
            💶 Don de <strong>{formatEuro(entry.amount)}</strong>{entry.mode === 'cheque' ? ' par chèque' : ' en espèces'}
            <small className="muted"> · le {formatDate(entry.at)}</small>
          </span>
          {confirmCancel ? (
            <div className="row don-actions">
              <button type="button" className="btn-sm btn-ghost" onClick={() => setConfirmCancel(false)}>Garder</button>
              <button type="button" className="btn-sm btn-danger" onClick={onReset}>Oui, annuler le don</button>
            </div>
          ) : (
            <div className="row don-actions">
              <button type="button" className="btn-sm" onClick={() => setStep('amount')}>✏️ Modifier le montant</button>
              <button type="button" className="btn-sm btn-ghost danger" onClick={() => setConfirmCancel(true)}>Annuler le don</button>
            </div>
          )}
        </div>
      )}
      {replacing && (
        <div className="don-box don-replace">
          <span className="spacer">
            Le don de <strong>{formatEuro(entry.amount)}</strong> sera supprimé et remplacé par « {STATUSES[replacing].label} ».
          </span>
          <div className="row don-actions">
            <button type="button" className="btn-sm btn-ghost" onClick={() => setReplacing(null)}>Garder le don</button>
            <button type="button" className="btn-sm btn-danger" onClick={() => onSave(replacing)}>Oui, remplacer</button>
          </div>
        </div>
      )}
      <div className="status-grid">
        {RESULT_STATUSES.map((s) => (
          <button
            key={s.key} type="button"
            className={`status-btn ${entry?.s === s.key ? 'current' : ''}`}
            style={{ '--c': s.color, '--cs': s.stroke }}
            onClick={() => pick(s.key)}
          >
            <span className="status-btn-icon">{s.icon}</span>
            <span className="status-btn-label">{s.label}</span>
            {s.hint && <span className="status-btn-hint">{s.hint}</span>}
          </button>
        ))}
      </div>
      {entry && !given && (
        <div className="row small muted">
          <span className="spacer">
            Dernier passage : {STATUSES[entry.s]?.label}{entry.s === 'given' ? ` ${formatEuro(entry.amount)}` : ''}, le {formatDate(entry.at)}
          </span>
          <button type="button" className="btn-ghost btn-sm" onClick={onReset}>Annuler ce passage</button>
        </div>
      )}
    </div>
  )
}

// Commentaire de la maison, visible par le binôme et les admins, gardé d'une année sur l'autre.
function HouseNote({ tour, house, user }) {
  const note = tour.notes?.[house.id]
  const [text, setText] = useState(null)
  const [error, setError] = useState('')
  const save = (value) => {
    setError('')
    // Pas d'attente : hors ligne, l'écriture part dans la file locale.
    saveHouseNote(tour.id, house.id, value, user).catch((err) => setError(err.code === 'permission-denied' ? 'Commentaire refusé : demande à un admin de mettre à jour les règles.' : `Erreur : ${err.message}`))
    setText(null)
  }
  if (text != null) {
    return (
      <form className="note-edit stack" onSubmit={(e) => { e.preventDefault(); save(text) }}>
        <textarea autoFocus rows={2} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. chien dans la cour, sonner à l’arrière, repasser le soir…" aria-label="Commentaire sur la maison" />
        <div className="row">
          <button type="button" className="btn-ghost btn-sm" onClick={() => setText(null)}>Annuler</button>
          {note && <button type="button" className="btn-ghost btn-sm danger" onClick={() => save('')}>Effacer</button>}
          <button type="submit" className="btn-primary btn-sm spacer" disabled={!text.trim() && !note}>Enregistrer</button>
        </div>
      </form>
    )
  }
  return (
    <>
      {note ? (
        <button type="button" className="note-box" onClick={() => setText(note.t)} title="Modifier le commentaire">
          <span aria-hidden="true">💬</span>
          <span className="spacer">{note.t}{note.byName ? <small className="note-by">{note.byName}</small> : null}</span>
          <span className="note-edit-hint">Modifier</span>
        </button>
      ) : (
        <button type="button" className="btn-note" onClick={() => setText('')}>＋ Ajouter un commentaire</button>
      )}
      {error && <p className="error small">{error}</p>}
    </>
  )
}

// Correction de l'adresse d'une maison (numéro, bis, rue) par le binôme ou un admin.
// La maison garde sa place et ses passages : seul le libellé change. Si l'adresse
// corrigée est déjà sur la carte tout près, on prévient avant d'enregistrer, pour ne
// pas créer deux maisons à la même adresse.
function AddressFix({ tour, house, user, onDone, onOpen }) {
  const start = house.number ? { number: house.number, street: house.street || splitLabel(house.label).street } : splitLabel(house.label)
  const [number, setNumber] = useState(start.number ?? '')
  const [street, setStreet] = useState(start.street ?? '')
  const [same, setSame] = useState(null)
  const [error, setError] = useState('')
  const num = number.trim().replace(/\s+/g, ' ').toLowerCase()
  const st = street.trim().replace(/\s+/g, ' ')
  const label = [num, st].filter(Boolean).join(' ')
  const changed = cleanNumber(num) !== cleanNumber(house.number) || st !== (start.street ?? '').trim()

  const write = () => {
    const next = {
      ...house, number: cleanNumber(num), street: st, label,
      addrFix: { from: house.addrFix?.from ?? house.label ?? '', by: user?.name ?? '', at: new Date().toISOString() },
    }
    // Pas d'attente : hors ligne, l'écriture part dans la file locale.
    saveTour(tour.id, { houses: tour.houses.map((x) => (x.id === house.id ? next : x)) })
      .catch((err) => setError(err.code === 'permission-denied' ? 'Correction refusée : demande à un admin.' : `Erreur : ${err.message}`))
    onDone(label)
  }
  const submit = (e) => {
    e.preventDefault()
    if (!st || !changed) return
    const others = tour.houses.filter((x) => x.id !== house.id)
    const found = findSameAddress(others, { number: num, street: st, lng: house.lng, lat: house.lat })
    if (found) setSame(found)
    else write()
  }

  if (same) {
    return (
      <div className="don-box don-replace stack">
        <span>
          <strong>{same.house.label}</strong> est déjà sur la carte, à {same.dist} m. Deux maisons à la même adresse sépareraient les dons.
        </span>
        <div className="row don-actions">
          {onOpen && <button type="button" className="btn-sm btn-primary" onClick={() => onOpen(same.house)}>Ouvrir {same.house.label}</button>}
          <button type="button" className="btn-sm btn-ghost" onClick={() => setSame(null)}>← Modifier</button>
          <button type="button" className="btn-sm btn-ghost" onClick={write}>C’est une autre maison, enregistrer</button>
        </div>
      </div>
    )
  }
  return (
    <form className="address-fix stack" onSubmit={submit}>
      <strong className="small">Corriger l’adresse</strong>
      <div className="address-fix-fields">
        <label>N°
          <input value={number} maxLength={10} autoComplete="off" placeholder="12 bis" onChange={(e) => setNumber(e.target.value)} />
        </label>
        <label>Rue
          <input value={street} maxLength={80} autoComplete="off" placeholder="rue de la Gare" onChange={(e) => setStreet(e.target.value)} />
        </label>
      </div>
      {house.addrFix?.from && house.addrFix.from !== label && <span className="small muted">Adresse d’origine : {house.addrFix.from}</span>}
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <button type="button" className="btn-ghost btn-sm" onClick={() => onDone(null)}>Annuler</button>
        <button type="submit" className="btn-primary btn-sm spacer" disabled={!st || !changed}>Enregistrer {label}</button>
      </div>
    </form>
  )
}

export default function HouseSheet({ tour, house, state, year, user, onClose, onSaved, onOpen, initialUnitId = null }) {
  const h = state?.h ?? {}
  const [unitId, setUnitId] = useState(house.units?.length ? initialUnitId : undefined)
  const isBuilding = Boolean(house.units?.length)
  const unit = isBuilding && unitId ? house.units.find((u) => u.id === unitId) : null
  const key = dwellingKey(house.id, unit?.id)

  // Un seul enregistrement par saisie : les touchers en plus pendant la confirmation sont ignorés.
  const [saved, setSaved] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const busy = useRef(0)
  const finish = () => {
    busy.current = 0
    setSaved(null)
    if (isBuilding) setUnitId(null)
    else onClose()
  }
  const save = (status, amount, mode) => {
    if (busy.current) return
    busy.current = Date.now()
    // Pas d'attente : hors ligne, l'écriture part dans la file locale.
    recordPassage({ year, tourId: tour.id, key, status, amount, mode, user })
    onSaved?.(status, amount)
    if (status !== 'given') return finish()
    // Le don reste affiché, en vert, un court instant : on voit qu'il est bien noté.
    setSaved({ amount, offline: typeof navigator !== 'undefined' && !navigator.onLine })
    timer.current = setTimeout(finish, 1300)
  }
  const checkRecent = (amount) => findRecentDon({ tour, h, key, house, user, amount })

  const title = isBuilding && unit ? `${house.label} · ${unit.label}` : house.label
  // Le binôme peut signaler un immeuble et son nombre de logements.
  const [askUnits, setAskUnits] = useState(false)
  const [unitsN, setUnitsN] = useState(String(house.units?.length || 2))
  const saveUnits = (n) => {
    const next = withUnits(house, n)
    saveTour(tour.id, { houses: tour.houses.map((x) => (x.id === house.id ? next : x)) }).catch(() => {})
    carryPassage({ year, tourId: tour.id, state, before: house, after: next })
    setAskUnits(false)
    onClose()
  }
  // Le binôme peut renommer chaque logement (« Appt 1 » devient « RDC gauche », « Dupont »…).
  const [naming, setNaming] = useState(null)
  const startNaming = () => setNaming(Object.fromEntries(house.units.map((u) => [u.id, u.label])))
  const saveNames = () => {
    const units = house.units.map((u, i) => ({ ...u, label: naming[u.id]?.trim() || `Appt ${i + 1}` }))
    saveTour(tour.id, { houses: tour.houses.map((x) => (x.id === house.id ? { ...x, units } : x)) }).catch(() => {})
    setNaming(null)
  }

  const [fixing, setFixing] = useState(false)

  return (
    <Sheet
      title={title || 'Maison'}
      subtitle={isBuilding ? `Immeuble · ${house.units.length} logements` : house.city}
      onClose={onClose}
      compact
      actions={<a className="btn btn-sm btn-ghost sheet-route" href={navigationUrl(house)} target="_blank" rel="noreferrer" title="Itinéraire">🧭<span className="hide-mobile"> Itinéraire</span></a>}
    >
      {isBuilding && !unit && naming ? (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); saveNames() }}>
          <strong className="small">Nom de chaque logement</strong>
          <div className="unit-names">
            {house.units.map((u, i) => (
              <input
                key={u.id} value={naming[u.id] ?? ''} maxLength={30} placeholder={`Appt ${i + 1}`}
                onChange={(e) => setNaming((n) => ({ ...n, [u.id]: e.target.value }))}
                aria-label={`Nom du logement ${i + 1}`}
              />
            ))}
          </div>
          <div className="row">
            <button type="button" className="btn-ghost" onClick={() => setNaming(null)}>Annuler</button>
            <button type="submit" className="btn-primary spacer">Enregistrer les noms</button>
          </div>
        </form>
      ) : isBuilding && !unit ? (
        <div className="stack">
          <div className="unit-grid">
            {house.units.map((u) => {
              const key = h[dwellingKey(house.id, u.id)]?.s ?? 'todo'
              const s = STATUSES[key]
              // Rempli de la couleur de son état, la même que sur la carte.
              return (
                <button key={u.id} type="button" className="unit-btn" style={{ '--c': MAP_COLORS[key] ?? s.color, '--cs': s.stroke }} onClick={() => setUnitId(u.id)}>
                  <strong>{u.label}</strong>
                  <span className="small">{s.short}</span>
                </button>
              )
            })}
          </div>
          <button type="button" className="btn-ghost btn-sm" onClick={startNaming}>✏️ Renommer les logements</button>
        </div>
      ) : (
        <>
          {saved ? (
            <button type="button" className="don-saved" onClick={() => { if (Date.now() - busy.current < 700) return; clearTimeout(timer.current); finish() }}>
              <span className="don-saved-check">✓</span>
              <strong>{formatEuro(saved.amount)} enregistrés</strong>
              <span className="small">{title}</span>
              {saved.offline && <span className="small">Sur le téléphone, envoi au retour du réseau</span>}
            </button>
          ) : (
            <DwellingForm key={key} entry={h[key]} title={title} onSave={save} onReset={() => save('todo')} onDrop={finish} checkRecent={checkRecent} />
          )}
          {isBuilding && <button type="button" className="btn-ghost btn-sm" onClick={() => setUnitId(null)}>← Tous les logements</button>}
        </>
      )}
      {!unit && !naming && !askUnits && !fixing && <HouseNote key={house.id} tour={tour} house={house} user={user} />}
      {!unit && !naming && !fixing && (askUnits ? (
        <div className="units-ask stack">
          <strong className="small">Combien de logements dans ce bâtiment ?</strong>
          <div className="units-quick">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={Number(unitsN) === n ? 'on' : ''} onClick={() => saveUnits(n)}>{n}</button>
            ))}
          </div>
          <div className="row units-step">
            <button type="button" className="btn-sm" onClick={() => setUnitsN(String(Math.max(1, (Number(unitsN) || 1) - 1)))} aria-label="Un de moins">−</button>
            <strong>{unitsN}</strong>
            <button type="button" className="btn-sm" onClick={() => setUnitsN(String(Math.min(200, (Number(unitsN) || 1) + 1)))} aria-label="Un de plus">+</button>
            <button type="button" className="btn-sm btn-primary spacer" onClick={() => saveUnits(Number(unitsN))}>Valider {unitsN} logement{Number(unitsN) > 1 ? 's' : ''}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-units" onClick={() => setAskUnits(true)}>🏢 {isBuilding ? 'Corriger le nombre de logements' : 'Plusieurs logements ici ?'}</button>
      ))}
      {!unit && !naming && !askUnits && (fixing ? (
        <AddressFix
          tour={tour} house={house} user={user}
          onOpen={onOpen && ((h) => { setFixing(false); onOpen(h) })}
          onDone={() => setFixing(false)}
        />
      ) : (
        <button type="button" className="btn-address" onClick={() => setFixing(true)}>✏️ Adresse fausse ? La corriger</button>
      ))}
    </Sheet>
  )
}
