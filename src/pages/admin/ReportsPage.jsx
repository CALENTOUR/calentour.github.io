import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../../components/ui/Toast'
import { useData } from '../../context/DataContext'
import { formatDate } from '../../lib/format'
import { deleteReport, setReportDone } from '../../services/reports'

// Onglet « Signalements » : les erreurs envoyées par les binômes (bouton rouge de leur tournée).
export default function ReportsPage() {
  const { reports } = useData()
  const [tab, setTab] = useState('open')
  const toast = useToast()
  const open = reports.filter((r) => !r.done)
  const done = reports.filter((r) => r.done)
  const list = tab === 'open' ? open : done
  const fail = (err) => toast(`Erreur : ${err.message}`)

  return (
    <div className="page stack-lg">
      <div className="stack-sm">
        <h1>Signalements</h1>
        <p className="muted small">Envoyés par les binômes avec le bouton rouge « Signaler une erreur » de leur tournée.</p>
      </div>
      <div className="segmented settings-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>
          En attente{open.length ? <span className="tab-count">{open.length}</span> : null}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>
          Traités{done.length ? <span className="tab-count tab-count-muted">{done.length}</span> : null}
        </button>
      </div>
      {!list.length ? (
        <div className="card empty">
          <div className="empty-icon">{tab === 'open' ? '👍' : '🗂️'}</div>
          <p className="muted">{tab === 'open' ? 'Aucun signalement en attente.' : 'Aucun signalement traité pour l’instant.'}</p>
        </div>
      ) : (
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
      )}
    </div>
  )
}
