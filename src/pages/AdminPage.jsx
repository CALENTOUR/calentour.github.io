import { useState } from 'react'
import { ROLES, ROLE_LABELS } from '../config/constants'
import { useAuth } from '../context/AuthContext'
import { useCollection, useData } from '../context/DataContext'
import { COL } from '../services/paths'
import { cancelInvitation, inviteUser, updateUser } from '../services/users'
import { createCommune, deleteCommune, renameCommune } from '../services/communes'
import { useToast } from '../components/ui/Toast'

function Users() {
  const { user } = useAuth()
  const { users } = useData()
  const toast = useToast()
  const invitations = useCollection(COL.invitations, true)
  const [form, setForm] = useState({ name: '', email: '', role: ROLES.MEMBER })

  const onInvite = async (e) => {
    e.preventDefault()
    try {
      await inviteUser(form)
      toast(`Invitation créée pour ${form.email}`)
      setForm({ name: '', email: '', role: ROLES.MEMBER })
    } catch (err) {
      toast(`Erreur : ${err.message}`)
    }
  }
  const change = (uid, data) => updateUser(uid, data).catch((err) => toast(`Erreur : ${err.message}`))

  return (
    <div className="stack">
      <form className="card stack" onSubmit={onInvite}>
        <h2>Inviter un membre</h2>
        <p className="muted small">
          La personne crée ensuite son compte sur l’écran de connexion (« Première connexion ») avec cet email.
          Seuls les emails invités peuvent créer un compte.
        </p>
        <div className="field-row">
          <input required placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required type="email" placeholder="email@exemple.fr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button type="submit" className="btn-primary">Inviter</button>
        </div>
        {invitations.items.length > 0 && (
          <div className="list">
            {invitations.items.map((i) => (
              <div key={i.id} className="row small">
                <span>✉️ {i.name} · {i.id} · {ROLE_LABELS[i.role]}</span>
                <span className="muted">en attente</span>
                <button type="button" className="btn-sm btn-ghost" onClick={() => cancelInvitation(i.id)}>Annuler</button>
              </div>
            ))}
          </div>
        )}
      </form>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Accès</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="muted">{u.email}</td>
                <td>
                  <select value={u.role} disabled={u.id === user.uid} onChange={(e) => change(u.id, { role: e.target.value })} style={{ minWidth: 150 }}>
                    {Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td>
                  {u.id === user.uid ? <span className="muted small">Vous</span> : (
                    <button className={`btn-sm ${u.active ? 'btn-danger' : ''}`} onClick={() => change(u.id, { active: !u.active })}>
                      {u.active ? 'Désactiver' : 'Réactiver'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Communes() {
  const { communes, sectors } = useData()
  const toast = useToast()
  const [name, setName] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  const onAdd = (e) => {
    e.preventDefault()
    createCommune(name).catch((err) => toast(`Erreur : ${err.message}`))
    setName('')
  }
  const onRename = (c) => {
    const next = window.prompt('Nouveau nom', c.name)
    if (next?.trim()) renameCommune(c.id, next)
  }
  const onDelete = (c) => {
    if (sectors.some((s) => s.communeId === c.id)) return toast('Supprimez ou déplacez d’abord les secteurs de cette commune')
    if (confirmId !== c.id) return setConfirmId(c.id)
    deleteCommune(c.id)
    setConfirmId(null)
  }

  return (
    <div className="stack">
      <form className="card row" onSubmit={onAdd}>
        <input required placeholder="Nom de la commune" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <button type="submit" className="btn-primary">＋ Ajouter</button>
      </form>
      <div className="list">
        {communes.map((c) => (
          <div key={c.id} className="list-item">
            <span className="grow title">{c.name}</span>
            <span className="muted small">{sectors.filter((s) => s.communeId === c.id).length} secteur(s)</span>
            <button className="btn-sm" onClick={() => onRename(c)}>Renommer</button>
            <button className="btn-sm btn-danger" onClick={() => onDelete(c)}>{confirmId === c.id ? 'Confirmer' : 'Supprimer'}</button>
          </div>
        ))}
        {!communes.length && <div className="card empty">Ajoutez vos communes avant de dessiner les secteurs.</div>}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState('users')
  return (
    <div className="page stack">
      <div className="page-header"><h1>Administration</h1></div>
      <div className="tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Membres</button>
        <button className={tab === 'communes' ? 'active' : ''} onClick={() => setTab('communes')}>Communes</button>
      </div>
      {tab === 'users' ? <Users /> : <Communes />}
    </div>
  )
}
