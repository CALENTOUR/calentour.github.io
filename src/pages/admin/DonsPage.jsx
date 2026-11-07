import { useMemo, useState } from 'react'
import HouseSheet from '../../components/HouseSheet'
import { useToast } from '../../components/ui/Toast'
import { PAYMENT_MODES, STATUS_LIST, STATUSES } from '../../config/constants'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { exportCompta } from '../../lib/exports'
import { formatDate, formatEuro } from '../../lib/format'
import { dwellings, globalStats } from '../../lib/stats'
import { useIsPhone } from '../../hooks/useIsPhone'

// Tous les passages de la campagne, filtrables, corrigeables, exportables.
export default function DonsPage() {
  const { tours, toursById, statesById, year, settings } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const [filters, setFilters] = useState({ tour: '', status: 'given', mode: '', q: '' })
  const [open, setOpen] = useState(null)
  const [exporting, setExporting] = useState(false)
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const phone = useIsPhone()

  const rows = useMemo(() => {
    const out = []
    for (const t of tours) {
      if (filters.tour && t.id !== filters.tour) continue
      const h = statesById[t.id]?.h ?? {}
      for (const d of dwellings(t)) {
        const e = h[d.key]
        const status = e?.s ?? 'todo'
        if (filters.status && status !== filters.status) continue
        if (filters.mode && e?.mode !== filters.mode) continue
        const label = `${d.house.label}${d.unit ? ` · ${d.unit.label}` : ''}`
        if (filters.q && !label.toLowerCase().includes(filters.q.toLowerCase())) continue
        out.push({ key: `${t.id}/${d.key}`, tour: t, house: d.house, label, entry: e, status })
      }
    }
    return out.sort((a, b) => (b.entry?.at ?? '').localeCompare(a.entry?.at ?? ''))
  }, [tours, statesById, filters])

  const total = rows.reduce((n, r) => n + (r.status === 'given' ? Number(r.entry.amount) || 0 : 0), 0)

  const doExport = async () => {
    setExporting(true)
    try {
      await exportCompta({ year, amicale: settings?.amicale, tours, statesById, stats: globalStats(tours, statesById) })
    } catch (err) {
      toast(`Export impossible : ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const openTour = open ? toursById[open.tourId] : null
  const openHouse = openTour?.houses.find((h) => h.id === open.houseId)

  return (
    <div className="page stack-lg">
      <div className="row wrap">
        <h1 className="spacer">{phone ? 'Dons' : 'Dons et passages'}</h1>
        <button type="button" className="btn-primary" disabled={exporting} onClick={doExport}>{exporting ? 'Export…' : phone ? 'Export compta' : '📊 Export compta (Excel)'}</button>
      </div>
      {phone && (
        <div className="phone-chips-row" role="group" aria-label="Statut">
          {[['given', 'Dons'], ['again', 'À repasser'], ['refused', 'Refus'], ['empty', 'Vides'], ['', 'Tous']].map(([k, label]) => (
            <button key={k || 'all'} type="button" className={filters.status === k ? 'on' : ''} aria-pressed={filters.status === k} onClick={() => setFilters((f) => ({ ...f, status: k }))}>{label}</button>
          ))}
        </div>
      )}
      <div className="card filters">
        <select value={filters.tour} onChange={set('tour')} aria-label="Tournée">
          <option value="">Toutes les tournées</option>
          {tours.map((t) => <option key={t.id} value={t.id}>{t.number}. {t.name}</option>)}
        </select>
        <select className="hide-phone" value={filters.status} onChange={set('status')} aria-label="Statut">
          <option value="">Tous les statuts</option>
          {STATUS_LIST.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={filters.mode} onChange={set('mode')} aria-label="Mode de paiement">
          <option value="">Tous les modes</option>
          {PAYMENT_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <input value={filters.q} onChange={set('q')} placeholder="Rechercher une adresse" aria-label="Rechercher" />
      </div>
      <div className="row small muted">
        <span className="spacer">{rows.length} ligne{rows.length > 1 ? 's' : ''}</span>
        {filters.status === 'given' && <strong>Total : {formatEuro(total)}</strong>}
      </div>
      {phone ? (
        <ul className="phone-dons">
          {rows.slice(0, 300).map((r) => (
            <li key={r.key}>
              <button type="button" onClick={() => setOpen({ tourId: r.tour.id, houseId: r.house.id })}>
                <span className="tour-num" style={{ '--tour': r.tour.color }}>{r.tour.number}</span>
                <span className="phone-don-text"><strong>{r.label}</strong><span>{formatDate(r.entry?.at)}</span></span>
                <span className="phone-don-amount">
                  {r.status === 'given' ? <strong>{formatEuro(r.entry.amount)}</strong> : <strong style={{ color: STATUSES[r.status].stroke }}>{STATUSES[r.status].short}</strong>}
                  <span>{PAYMENT_MODES.find((m) => m.key === r.entry?.mode)?.label ?? ''}</span>
                </span>
              </button>
            </li>
          ))}
          {!rows.length && <li className="muted small">Aucun passage.</li>}
          {rows.length > 300 && <li className="small muted">Les 300 premières lignes sont affichées. Affine les filtres ou exporte.</li>}
        </ul>
      ) : (
      <div className="card table-scroll">
        <table className="table">
          <thead><tr><th>Date</th><th>Tournée</th><th>Adresse</th><th>Statut</th><th>Mode</th><th className="num">Montant</th></tr></thead>
          <tbody>
            {rows.slice(0, 500).map((r) => (
              <tr key={r.key} className="clickable" onClick={() => setOpen({ tourId: r.tour.id, houseId: r.house.id })}>
                <td>{formatDate(r.entry?.at)}</td>
                <td><span className="swatch" style={{ background: r.tour.color }} />{r.tour.number}</td>
                <td>{r.label}</td>
                <td><span className="dot" style={{ background: STATUSES[r.status].color, borderColor: STATUSES[r.status].stroke }} /> {STATUSES[r.status].label}</td>
                <td>{PAYMENT_MODES.find((m) => m.key === r.entry?.mode)?.label ?? ''}</td>
                <td className="num">{r.status === 'given' ? formatEuro(r.entry.amount) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 500 && <p className="small muted">Les 500 premières lignes sont affichées. Affine les filtres ou exporte.</p>}
      </div>
      )}
      {openHouse && (
        <HouseSheet tour={openTour} house={openHouse} state={statesById[openTour.id]} year={year} user={profile} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}
