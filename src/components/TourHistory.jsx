import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { STATUSES } from '../config/constants'
import { formatDate, formatEuro } from '../lib/format'
import { diffStates, loadPassages, restoreState, stateAt, undoCancels } from '../services/history'
import { dwellings } from '../lib/stats'
import { dwellingKey, moveEntry, recordPassage } from '../services/state'
import { useToast } from './ui/Toast'

const pad = (n) => String(n).padStart(2, '0')
const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const totals = (h) => Object.values(h ?? {}).reduce((t, e) => (e?.s === 'given' ? { n: t.n + 1, a: t.a + (Number(e.amount) || 0) } : t), { n: 0, a: 0 })
const describe = (e) => (!e ? 'À faire' : e.s === 'given' ? `Don ${formatEuro(e.amount)}` : STATUSES[e.s]?.label ?? e.s)

// Historique des saisies d'une tournée, et retour à l'état d'une heure donnée
// (après une erreur de manipulation, des dons annulés par mégarde…).
export default function TourHistory({ tour }) {
  const { statesById, year } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const [passages, setPassages] = useState(null)
  const [error, setError] = useState('')
  const [when, setWhen] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return localInput(d) })
  const [all, setAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState('undo')
  const current = statesById[tour.id]?.h ?? {}

  const label = useMemo(() => {
    const byId = new Map(tour.houses.map((x) => [x.id, x]))
    return (key) => {
      const [houseId, unitId] = key.split('__')
      const house = byId.get(houseId)
      if (!house) return 'Maison retirée de la tournée'
      const unit = unitId ? house.units?.find((u) => u.id === unitId) : null
      return unitId ? `${house.label} · ${unit?.label ?? 'logement disparu'}` : `${house.label}${house.units?.length ? ' (avant immeuble)' : ''}`
    }
  }, [tour.houses])

  // Dons restés sur une habitation qui n'existe plus (immeuble remis en maison, maison retirée) :
  // le binôme ne peut plus les ouvrir, l'admin peut les annuler ici.
  const known = new Set(dwellings(tour).map((d) => d.key))
  const lost = Object.entries(current).filter(([k, e]) => e?.s === 'given' && !known.has(k))
  const cancelLost = (key, e) => {
    if (!window.confirm(`Annuler le don de ${formatEuro(e.amount)} (${label(key)}) ?`)) return
    recordPassage({ year, tourId: tour.id, key, status: 'todo', user: profile })
    toast('Don annulé')
  }
  // Habitation qui existe aujourd'hui à la place (la maison, ou le 1er logement de l'immeuble).
  const homeOf = (key) => {
    const house = tour.houses.find((x) => x.id === key.split('__')[0])
    if (!house) return null
    return house.units?.length ? dwellingKey(house.id, house.units[0].id) : dwellingKey(house.id)
  }
  const attachLost = (key, e) => {
    const to = homeOf(key)
    const there = current[to]
    const msg = there
      ? `Rattacher ce don de ${formatEuro(e.amount)} à « ${label(to)} » ? Il remplace « ${describe(there)} » déjà saisi.`
      : `Rattacher ce don de ${formatEuro(e.amount)} à « ${label(to)} » ? Il comptera de nouveau dans le bilan.`
    if (!window.confirm(msg)) return
    moveEntry({ year, tourId: tour.id, from: key, to, entry: e, user: profile })
      .then(() => toast('Don rattaché'))
      .catch((err) => toast(`Échec : ${err.message}`))
  }
  const lostBlock = lost.length > 0 && (
    <div className="history-restore stack">
      <strong className="small">Dons sur une habitation qui n’existe plus ({lost.length})</strong>
      <p className="small muted">Ils ne comptent pas dans le bilan et le binôme ne peut plus les ouvrir. Rattache-les à la maison s’ils sont réels, sinon annule-les.</p>
      <ul className="history-list small">
        {lost.map(([k, e]) => (
          <li key={k}>
            <span className="muted history-at">{formatDate(e.at)}</span>
            <span className="spacer">{label(k)}</span>
            <strong>{formatEuro(e.amount)}</strong>
            {homeOf(k) && <button type="button" className="btn-sm" onClick={() => attachLost(k, e)}>Rattacher{current[homeOf(k)] ? ` (remplace ${describe(current[homeOf(k)])})` : ''}</button>}
            <button type="button" className="btn-sm btn-ghost danger" onClick={() => cancelLost(k, e)}>Annuler ce don</button>
          </li>
        ))}
      </ul>
    </div>
  )

  const open = () => {
    setError('')
    loadPassages(year, tour.id).then(setPassages).catch((err) => setError(`Historique illisible : ${err.message}`))
  }
  if (!passages) {
    return (
      <div className="card stack">
        <h2>Historique des dons</h2>
        <p className="small muted">Chaque saisie du binôme est gardée, même annulée. On peut remettre la tournée dans l’état où elle était à une heure donnée.</p>
        {lostBlock}
        <button type="button" className="btn" onClick={open}>🕓 Ouvrir l’historique</button>
        {error && <p className="error small">{error}</p>}
      </div>
    )
  }

  const untilIso = new Date(when).toISOString().replace(/\.\d{3}Z$/, '.999Z')
  const target = mode === 'undo' ? undoCancels(current, passages, new Date(when).toISOString()) : stateAt(current, passages, untilIso)
  const changes = diffStates(current, target)
  const now = totals(current)
  const then = totals(target)
  const shown = [...passages].reverse().slice(0, all ? undefined : 40)

  const restore = async () => {
    if (!window.confirm(`Tournée ${tour.number} : ${mode === 'undo' ? `annuler les annulations depuis le ${formatDate(when)}` : `revenir à l’état du ${formatDate(untilIso)}`} ?\n${changes.length} habitation(s) changent. Total : ${formatEuro(now.a)} → ${formatEuro(then.a)}.`)) return
    setBusy(true)
    try {
      await restoreState({ year, tourId: tour.id, changes, user: profile })
      toast(`Tournée ${tour.number} remise en état`)
      setPassages(await loadPassages(year, tour.id))
    } catch (err) {
      toast(`Échec : ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card stack">
      <h2>Historique des dons</h2>
      {lostBlock}
      <div className="history-restore stack">
        <div className="segmented" role="group" aria-label="Type de remise en état">
          <button type="button" className={mode === 'undo' ? 'on' : ''} onClick={() => setMode('undo')}>Annuler les annulations</button>
          <button type="button" className={mode === 'state' ? 'on' : ''} onClick={() => setMode('state')}>Revenir à une heure</button>
        </div>
        <label className="stack">
          <strong className="small">{mode === 'undo' ? 'Annulations faites depuis le' : 'Revenir à l’état du'}</strong>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <p className="small muted">{mode === 'undo'
          ? 'Chaque maison remise « à faire » depuis cette heure retrouve sa dernière saisie. Les dons saisis depuis sont gardés.'
          : 'Les maisons touchées après cette heure reprennent leur état de cette heure-là (les saisies faites depuis sont perdues).'}</p>
        <div className="small">
          Après remise en état : <strong>{then.n} dons · {formatEuro(then.a)}</strong>. Maintenant : {now.n} dons · {formatEuro(now.a)}.
        </div>
        {changes.length > 0 ? (
          <>
            <ul className="history-list small">
              {changes.map((c) => (
                <li key={c.key}><span className="spacer">{label(c.key)}</span><span className="muted">{describe(c.from)} → </span><strong>{describe(c.to)}</strong></li>
              ))}
            </ul>
            <button type="button" className="btn-primary" disabled={busy} onClick={restore}>
              {busy ? 'Restauration…' : `Remettre la tournée dans cet état (${changes.length} changement${changes.length > 1 ? 's' : ''})`}
            </button>
          </>
        ) : <p className="small muted">La tournée est déjà dans cet état.</p>}
      </div>
      <h3 className="small">Dernières saisies</h3>
      <ul className="history-list small">
        {shown.map((p) => (
          <li key={p.id}>
            <span className="muted history-at">{formatDate(p.at)}</span>
            <span className="spacer">{label(p.key)}</span>
            <strong>{p.s === 'todo' ? 'Annulé' : describe(p)}</strong>
            <span className="muted history-by">{p.byName}</span>
          </li>
        ))}
      </ul>
      {passages.length > 40 && <button type="button" className="btn-ghost btn-sm" onClick={() => setAll((v) => !v)}>{all ? 'Voir moins' : `Tout voir (${passages.length})`}</button>}
    </div>
  )
}
