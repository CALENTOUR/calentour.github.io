import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SECTOR_COLORS } from '../config/constants'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { computeStats } from '../lib/stats'
import { formatEuro, formatInt, formatPercent } from '../lib/format'
import { fetchOsmAddresses } from '../lib/osm'
import { createSector, deleteSector, updateSector } from '../services/sectors'
import { addAddresses } from '../services/addresses'
import SectorEditor from '../components/map/SectorEditor'
import Modal from '../components/ui/Modal'
import ProgressBar from '../components/ui/ProgressBar'
import { useToast } from '../components/ui/Toast'

function SectorForm({ sector, onClose }) {
  const { sectors, communes, users } = useData()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => ({
    name: sector?.name ?? '',
    color: sector?.color ?? SECTOR_COLORS[sectors.length % SECTOR_COLORS.length],
    communeId: sector?.communeId ?? communes[0]?.id ?? '',
    memberIds: sector?.memberIds ?? [],
    polygon: sector?.polygon ?? [],
  }))
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const toggleMember = (uid) => setForm((f) => ({
    ...f,
    memberIds: f.memberIds.includes(uid) ? f.memberIds.filter((m) => m !== uid) : [...f.memberIds, uid],
  }))
  const others = useMemo(() => sectors.filter((s) => s.id !== sector?.id), [sectors, sector])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (form.polygon.length < 3) return toast('Dessinez le secteur sur la carte (3 points minimum)')
    if (!form.communeId) return toast('Créez d’abord une commune dans Administration')
    setSaving(true)
    try {
      if (sector) await updateSector(sector.id, form)
      else await createSector(form)
      toast(sector ? 'Secteur modifié' : 'Secteur créé')
      onClose()
    } catch (err) {
      toast(`Erreur : ${err.message}`)
      setSaving(false)
    }
  }

  return (
    <Modal title={sector ? `Modifier ${sector.name}` : 'Nouveau secteur'} onClose={onClose} width="900px">
      <form className="stack" onSubmit={onSubmit}>
        <div className="field-row">
          <label>
            Nom
            <input required value={form.name} onChange={set('name')} placeholder="Secteur Nord" />
          </label>
          <label>
            Commune
            <select required value={form.communeId} onChange={set('communeId')}>
              <option value="">Choisir…</option>
              {communes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            Couleur
            <input type="color" value={form.color} onChange={set('color')} />
          </label>
        </div>

        <SectorEditor
          value={form.polygon}
          color={form.color}
          otherSectors={others}
          onChange={(polygon) => setForm((f) => ({ ...f, polygon }))}
        />

        <div>
          <div className="muted small" style={{ marginBottom: '.4rem' }}>Membres affectés</div>
          <div className="row">
            {users.filter((u) => u.active).map((u) => (
              <label key={u.id} className="badge" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                <input type="checkbox" checked={form.memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} />
                {u.name}
              </label>
            ))}
          </div>
        </div>

        <div className="row">
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
        </div>
      </form>
    </Modal>
  )
}

function OsmImport({ sector, onClose }) {
  const { addresses } = useData()
  const toast = useToast()
  const [state, setState] = useState({ step: 'idle', found: [], error: '' })
  const existing = useMemo(
    () => new Set(addresses.filter((a) => a.sectorId === sector.id).map((a) => a.label.toLowerCase())),
    [addresses, sector.id],
  )
  const fresh = state.found.filter((a) => !existing.has(a.label.toLowerCase()))

  const search = async () => {
    setState({ step: 'loading', found: [], error: '' })
    try {
      setState({ step: 'done', found: await fetchOsmAddresses(sector.polygon), error: '' })
    } catch (err) {
      setState({ step: 'idle', found: [], error: err.message })
    }
  }

  const importAll = async () => {
    setState((s) => ({ ...s, step: 'saving' }))
    try {
      await addAddresses(sector.id, fresh)
      toast(`${fresh.length} adresses importées`)
      onClose()
    } catch (err) {
      setState((s) => ({ ...s, step: 'done', error: err.message }))
    }
  }

  return (
    <Modal title={`Importer les adresses : ${sector.name}`} onClose={onClose}>
      <div className="stack">
        <p className="muted small">
          Récupère depuis OpenStreetMap toutes les adresses numérotées situées dans le secteur.
          Vérifiez ensuite sur la carte : certaines maisons peuvent manquer dans OSM, ajoutez-les avec le bouton ＋ de la carte.
        </p>
        {state.error && <p className="error">{state.error}</p>}
        {state.step === 'idle' && <button className="btn-blue" onClick={search}>Rechercher dans OpenStreetMap</button>}
        {state.step === 'loading' && <p>Recherche en cours…</p>}
        {(state.step === 'done' || state.step === 'saving') && (
          <>
            <p>
              <strong>{state.found.length}</strong> adresses trouvées, dont <strong>{fresh.length}</strong> nouvelles.
            </p>
            <div className="list" style={{ maxHeight: 240, overflow: 'auto' }}>
              {fresh.slice(0, 200).map((a) => <div key={a.label} className="small muted">{a.label}</div>)}
              {fresh.length > 200 && <div className="small muted">… et {fresh.length - 200} autres</div>}
            </div>
            <button className="btn-primary" disabled={!fresh.length || state.step === 'saving'} onClick={importAll}>
              {state.step === 'saving' ? 'Import…' : `Importer ${fresh.length} adresses`}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

export default function SectorsPage() {
  const { isAdmin, user } = useAuth()
  const data = useData()
  const { sectors, communesById, usersById, activeVisits } = data
  const navigate = useNavigate()
  const toast = useToast()
  const [editing, setEditing] = useState(null) // 'new' | sector
  const [importing, setImporting] = useState(null)

  const stats = useMemo(() => computeStats({ ...data, visitsByAddress: activeVisits }), [data, activeVisits])
  const statsById = Object.fromEntries(stats.bySector.map((s) => [s.id, s]))

  const onDelete = (s) => {
    const count = statsById[s.id]?.addresses ?? 0
    if (!confirm(`Supprimer le secteur « ${s.name} » et ses ${count} adresses ? Cette action est définitive.`)) return
    deleteSector(s.id).then(() => toast('Secteur supprimé')).catch((err) => toast(`Erreur : ${err.message}`))
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Secteurs</h1>
        {isAdmin && <button className="btn-primary" onClick={() => setEditing('new')}>＋ Nouveau secteur</button>}
      </div>

      {!sectors.length && (
        <div className="card empty">
          Aucun secteur. {isAdmin ? 'Créez une commune dans Administration, puis dessinez votre premier secteur.' : 'Un administrateur doit les créer.'}
        </div>
      )}

      <div className="grid-2">
        {sectors.map((s) => {
          const st = statsById[s.id]
          const mine = s.memberIds?.includes(user.uid)
          return (
            <div key={s.id} className="card stack" style={{ gap: '.6rem' }}>
              <div className="row-between">
                <div className="row">
                  <span className="swatch" style={{ background: s.color }} />
                  <h2 style={{ margin: 0 }}>{s.name}</h2>
                  {mine && <span className="badge">Mon secteur</span>}
                </div>
                <span className="muted small">{communesById[s.communeId]?.name}</span>
              </div>
              <ProgressBar value={st?.progress} color={s.color} />
              <div className="row small">
                <span>{formatPercent(st?.progress)} traité</span>
                <span className="muted">· {formatInt(st?.addresses)} adresses</span>
                <span className="muted">· {formatInt(st?.counts.done)} dons</span>
                <span className="muted">· {formatEuro(st?.total)}</span>
              </div>
              <div className="small muted">
                👥 {(s.memberIds ?? []).map((id) => usersById[id]?.name).filter(Boolean).join(', ') || 'Aucun membre affecté'}
              </div>
              <div className="row">
                <button className="btn-sm" onClick={() => navigate(`/carte?secteur=${s.id}`)}>🗺️ Voir</button>
                {isAdmin && (
                  <>
                    <button className="btn-sm" onClick={() => setEditing(s)}>✏️ Modifier</button>
                    <button className="btn-sm" onClick={() => setImporting(s)}>⬇️ Importer OSM</button>
                    <button className="btn-sm btn-danger" onClick={() => onDelete(s)}>Supprimer</button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {editing && <SectorForm sector={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {importing && <OsmImport sector={importing} onClose={() => setImporting(null)} />}
    </div>
  )
}
