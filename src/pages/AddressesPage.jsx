import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STATUS_LIST } from '../config/constants'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { formatEuro } from '../lib/format'
import VisitSheet from '../components/VisitSheet'
import AddressForm from '../components/AddressForm'
import { StatusDot } from '../components/ui/StatusBadge'

const PAGE = 200

export default function AddressesPage() {
  const { isAdmin, user } = useAuth()
  const { addresses, addressesById, sectors, sectorsById, activeVisits } = useData()
  const navigate = useNavigate()
  const mySectors = sectors.filter((s) => s.memberIds?.includes(user.uid))

  const [query, setQuery] = useState('')
  const [sectorId, setSectorId] = useState(mySectors.length === 1 ? mySectors[0].id : '')
  const [status, setStatus] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null) // { address } | { initial }
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return addresses.filter((a) =>
      (!sectorId || a.sectorId === sectorId)
      && (!status || (activeVisits[a.id]?.status ?? 'todo') === status)
      && (!q || a.label.toLowerCase().includes(q) || a.comment?.toLowerCase().includes(q)))
  }, [addresses, activeVisits, deferredQuery, sectorId, status])

  const selected = selectedId ? addressesById[selectedId] : null

  return (
    <div className="page">
      <div className="page-header">
        <h1>Adresses</h1>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setEditing({ initial: { sectorId } })}>＋ Ajouter</button>
        )}
      </div>

      <div className="card stack" style={{ marginBottom: '1rem' }}>
        <input type="search" placeholder="Rechercher une rue, un numéro…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="field-row">
          <select value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
            <option value="">Tous les secteurs</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            {STATUS_LIST.map((s) => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}
          </select>
        </div>
        <div className="muted small">{filtered.length} adresse(s)</div>
      </div>

      {!filtered.length && <div className="card empty">Aucune adresse ne correspond.</div>}

      <div className="list">
        {filtered.slice(0, limit).map((a) => {
          const v = activeVisits[a.id]
          return (
            <div key={a.id} className="row" style={{ flexWrap: 'nowrap' }}>
              <button className="list-item" onClick={() => setSelectedId(a.id)}>
                <StatusDot status={v?.status ?? 'todo'} />
                <div className="grow">
                  <div className="title">{a.label}</div>
                  <div className="muted small">
                    {sectorsById[a.sectorId]?.name}
                    {v?.status === 'done' && ` · ${formatEuro(v.total)} · ${v.calendars} cal.`}
                    {(v?.comment || a.comment) && ` · 📝 ${v?.comment || a.comment}`}
                  </div>
                </div>
              </button>
              <button className="btn-icon" title="Voir sur la carte" onClick={() => navigate(`/carte?adresse=${a.id}`)}>🗺️</button>
            </div>
          )
        })}
      </div>
      {filtered.length > limit && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button onClick={() => setLimit((l) => l + PAGE)}>Afficher plus</button>
        </div>
      )}

      {selected && (
        <VisitSheet
          key={selected.id}
          address={selected}
          onClose={() => setSelectedId(null)}
          onEditAddress={(address) => {
            setSelectedId(null)
            setEditing({ address })
          }}
        />
      )}
      {editing && (
        <AddressForm address={editing.address} initial={editing.initial} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
