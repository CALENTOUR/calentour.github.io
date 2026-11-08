import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { formatDate } from '../lib/format'
import { deleteReport, setReportDone } from '../services/reports'
import { useToast } from './ui/Toast'

// Signalements envoyés par les binômes, sur le tableau de bord des administrateurs.
export default function ReportsCard() {
  const { reports } = useData()
  const [showDone, setShowDone] = useState(false)
  const toast = useToast()
  const open = reports.filter((r) => !r.done)
  const done = reports.filter((r) => r.done)
  if (!reports.length) return null
  const fail = (err) => toast(`Erreur : ${err.message}`)
  const list = showDone ? [...open, ...done] : open

  return (
    <section className="card stack reports-card">
      <div className="row wrap">
        <h2 className="spacer">Signalements des binômes {open.length ? <span className="tab-count">{open.length}</span> : null}</h2>
        {done.length > 0 && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Masquer les traités' : `Voir les traités (${done.length})`}
          </button>
        )}
      </div>
      {!open.length && !showDone && <p className="muted small">Aucun signalement en attente.</p>}
      <ul className="reports">
        {list.map((r) => (
          <li key={r.id} className={r.done ? 'report-done' : ''}>
            <div className="report-meta small">
              {r.tourName
                ? (r.tourId ? <Link to={`/admin/tournees/${r.tourId}`}><strong>{r.tourName}</strong></Link> : <strong>{r.tourName}</strong>)
                : <strong>{r.byName || 'Binôme'}</strong>}
              {r.tourName && r.byName && !r.tourName.includes(r.byName) && <span>{r.byName}</span>}
              <span className="muted">{formatDate(r.at)}</span>
            </div>
            <p className="report-text">{r.text}</p>
            <div className="row">
              {r.done ? (
                <>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setReportDone(r.id, false).catch(fail)}>Remettre en attente</button>
                  <button type="button" className="btn-ghost btn-sm danger" onClick={() => window.confirm('Supprimer ce signalement ?') && deleteReport(r.id).catch(fail)}>Supprimer</button>
                </>
              ) : (
                <button type="button" className="btn-sm" onClick={() => setReportDone(r.id, true).catch(fail)}>✓ Traité</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
