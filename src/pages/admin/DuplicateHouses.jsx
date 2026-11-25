import { useMemo, useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { MAP_COLORS, STATUSES } from '../../config/constants'
import { defaultChoice, findDuplicates } from '../../lib/duplicates'
import { formatDate, formatEuro } from '../../lib/format'
import { markNotDuplicate, mergeDuplicate } from '../../services/duplicates'

const statusText = (e) => (e ? `${STATUSES[e.s]?.label ?? e.s}${e.s === 'given' ? ` ${formatEuro(e.amount)}` : ''}` : 'À faire')

function Status({ entry }) {
  const key = entry?.s ?? 'todo'
  return <span className="dup-status" style={{ '--c': MAP_COLORS[key] }}>{statusText(entry)}</span>
}

function Radio({ name, value, current, onChange, children }) {
  return (
    <label className={`dup-option${current === value ? ' on' : ''}`}>
      <input type="radio" name={name} checked={current === value} onChange={() => onChange(value)} />
      <span>{children}</span>
    </label>
  )
}

function PairCard({ pair, year, user }) {
  const toast = useToast()
  const [choice, setChoice] = useState(() => defaultChoice(pair))
  const [busy, setBusy] = useState(false)
  const { copy, orig } = pair
  const set = (k) => (v) => setChoice((c) => ({ ...c, [k]: v }))
  const cross = copy.tour.id !== orig.tour.id
  const differ = (copy.entry || orig.entry) && statusText(copy.entry) !== statusText(orig.entry)
  const tourName = (t) => `n°${t.number} ${t.name ?? ''}`

  const merge = async () => {
    if (choice.entry === 'both') {
      setBusy(true)
      try { await markNotDuplicate(pair); toast(`« ${copy.house.label} » gardée comme deuxième foyer`) } catch (err) { toast(`Erreur : ${err.message}`); setBusy(false) }
      return
    }
    setBusy(true)
    try {
      await mergeDuplicate({ year, pair, choice: { ...choice, entry: choice.entry ?? 'orig' }, user })
      toast(`${orig.house.label} : maisons fusionnées`)
    } catch (err) {
      toast(`Fusion impossible : ${err.message}`)
      setBusy(false)
    }
  }

  return (
    <li className="card stack dup-card">
      <div className="row wrap">
        <span className="tour-dot" style={{ background: orig.tour.color }}>{orig.tour.number}</span>
        <strong className="spacer">{orig.house.label} <span className="small muted">{orig.house.city ?? ''}</span></strong>
        <span className="small muted">à {pair.dist} m l’une de l’autre</span>
      </div>
      <div className="dup-cols">
        <div>
          <span className="small muted">Maison d’origine{cross ? ` · tournée ${tourName(orig.tour)}` : ''}</span>
          <Status entry={orig.entry} />
          {orig.entry?.at && <span className="small muted">le {formatDate(orig.entry.at)}</span>}
        </div>
        <div>
          <span className="small muted">Ajoutée par le binôme{cross ? ` · tournée ${tourName(copy.tour)}` : ''}</span>
          <Status entry={copy.entry} />
          {copy.entry?.at && <span className="small muted">le {formatDate(copy.entry.at)}</span>}
        </div>
      </div>

      <fieldset className="dup-choice">
        <legend className="small">Position gardée</legend>
        <Radio name={`pos-${pair.id}`} value="copy" current={choice.position} onChange={set('position')}>Celle posée par le binôme (il était sur place)</Radio>
        <Radio name={`pos-${pair.id}`} value="orig" current={choice.position} onChange={set('position')}>Celle d’origine</Radio>
      </fieldset>

      {choice.bothGiven ? (
        <fieldset className="dup-choice">
          <legend className="small">Deux dons à la même adresse</legend>
          <Radio name={`e-${pair.id}`} value="orig" current={choice.entry} onChange={set('entry')}>Le même don saisi deux fois : garder {formatEuro(orig.entry.amount)} (origine)</Radio>
          <Radio name={`e-${pair.id}`} value="copy" current={choice.entry} onChange={set('entry')}>Le même don saisi deux fois : garder {formatEuro(copy.entry.amount)} (binôme)</Radio>
          <Radio name={`e-${pair.id}`} value="both" current={choice.entry} onChange={set('entry')}>Deux foyers : ce n’est pas un doublon, garder les deux</Radio>
        </fieldset>
      ) : differ ? (
        <fieldset className="dup-choice">
          <legend className="small">Passage gardé</legend>
          <Radio name={`e-${pair.id}`} value="orig" current={choice.entry} onChange={set('entry')}>{statusText(orig.entry)} (origine)</Radio>
          <Radio name={`e-${pair.id}`} value="copy" current={choice.entry} onChange={set('entry')}>{statusText(copy.entry)} (binôme)</Radio>
        </fieldset>
      ) : null}

      {cross && choice.entry !== 'both' && (
        <fieldset className="dup-choice">
          <legend className="small">Tournée qui garde la maison</legend>
          <Radio name={`t-${pair.id}`} value={orig.tour.id} current={choice.tourId} onChange={set('tourId')}>{tourName(orig.tour)}</Radio>
          <Radio name={`t-${pair.id}`} value={copy.tour.id} current={choice.tourId} onChange={set('tourId')}>{tourName(copy.tour)}</Radio>
        </fieldset>
      )}

      <div className="row wrap">
        <button type="button" className="btn-primary" disabled={busy || (choice.bothGiven && !choice.entry)} onClick={merge}>
          {busy ? 'Enregistrement…' : choice.entry === 'both' ? 'Garder les deux maisons' : 'Fusionner'}
        </button>
        {!choice.bothGiven && (
          <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => { setChoice((c) => ({ ...c, entry: 'both' })); }}>
            Ce n’est pas un doublon
          </button>
        )}
        {choice.entry === 'both' && !choice.bothGiven && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setChoice(defaultChoice(pair))}>← Revenir à la fusion</button>
        )}
      </div>
    </li>
  )
}

// Réglages > Maisons à vérifier > Doublons.
export default function DuplicateHouses() {
  const { tours, statesById, year } = useData()
  const { profile } = useAuth()
  const pairs = useMemo(() => findDuplicates(tours, statesById), [tours, statesById])
  return (
    <div className="stack-lg">
      <div className="card stack">
        <h2>Maisons en double</h2>
        <p className="small muted">
          Maisons ajoutées par un binôme (« Maison non répertoriée ») alors que la même adresse existait déjà tout près.
          Les deux comptent séparément : l’une peut rester « à faire » ou « à repasser » alors que l’autre a donné.
          Fusionner garde la maison d’origine (adresse officielle), à la position choisie, avec le passage le plus avancé.
          Chaque fusion est notée dans l’historique de la tournée.
        </p>
      </div>
      {pairs.length ? (
        <ul className="plain-list stack">
          {pairs.map((p) => <PairCard key={`${p.id}-${p.orig.house.id}-${p.copy.entry?.at ?? ''}-${p.orig.entry?.at ?? ''}`} pair={p} year={year} user={profile} />)}
        </ul>
      ) : (
        <div className="card"><h2>✅ Aucune maison en double</h2></div>
      )}
    </div>
  )
}

export const useDuplicateCount = () => {
  const { tours, statesById } = useData()
  return useMemo(() => findDuplicates(tours, statesById).length, [tours, statesById])
}
