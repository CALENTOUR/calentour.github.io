import { useMemo, useState } from 'react'
import { PAYMENT_FIELDS } from '../config/constants'
import { useData, useCampaignVisits } from '../context/DataContext'
import { computeStats } from '../lib/stats'
import { formatDelta, formatEuro, formatInt, formatPercent } from '../lib/format'
import { exportExcel, exportPdf } from '../lib/exports'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import { useToast } from '../components/ui/Toast'

function CompareBars({ rows, previousRows, valueKey = 'total', format = formatEuro }) {
  const prevById = Object.fromEntries((previousRows ?? []).map((r) => [r.id, r]))
  const max = Math.max(1, ...rows.map((r) => r[valueKey]), ...(previousRows ?? []).map((r) => r[valueKey]))
  return (
    <div className="bar-chart">
      {rows.map((r) => {
        const prev = prevById[r.id]
        return (
          <div key={r.id} className="bar-row">
            <span className="bar-name" title={r.name}>{r.name}</span>
            <div className="bar-track">
              <div className="bar" style={{ width: `${(r[valueKey] / max) * 100}%`, background: r.color ?? 'var(--accent-2)' }} />
              {prev && <div className="bar prev" style={{ width: `${(prev[valueKey] / max) * 100}%` }} />}
            </div>
            <span className="small" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {format(r[valueKey])}
              {previousRows && <span className="muted"> ({formatDelta(r[valueKey], prev?.[valueKey] ?? 0)})</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function BucketTable({ rows, previousRows }) {
  const prevById = Object.fromEntries((previousRows ?? []).map((r) => [r.id, r]))
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nom</th><th className="num">Adresses</th><th>Avancement</th><th className="num">Dons</th>
            <th className="num">Absents</th><th className="num">Refus</th><th className="num">Calendriers</th>
            <th className="num">Total</th>{previousRows && <th className="num">N-1</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td className="num">{formatInt(r.addresses)}</td>
              <td style={{ minWidth: 120 }}><ProgressBar value={r.progress} color={r.color} /> <span className="small muted">{formatPercent(r.progress)}</span></td>
              <td className="num">{formatInt(r.counts.done)}</td>
              <td className="num">{formatInt(r.counts.absent)}</td>
              <td className="num">{formatInt(r.counts.refused)}</td>
              <td className="num">{formatInt(r.calendars)}</td>
              <td className="num"><strong>{formatEuro(r.total)}</strong></td>
              {previousRows && <td className="num muted">{formatEuro(prevById[r.id]?.total ?? 0)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function StatsPage() {
  const data = useData()
  const { campaigns, activeCampaign } = data
  const toast = useToast()
  const [year, setYear] = useState(() => activeCampaign?.year ?? campaigns[0]?.year)
  const [tab, setTab] = useState('sectors')
  const [exporting, setExporting] = useState(false)

  const previousYear = campaigns.find((c) => c.year < year)?.year
  const current = useCampaignVisits(year)
  const previous = useCampaignVisits(previousYear)

  const stats = useMemo(() => computeStats({ ...data, visitsByAddress: current.visitsByAddress }), [data, current.visitsByAddress])
  const prevStats = useMemo(
    () => (previousYear ? computeStats({ ...data, visitsByAddress: previous.visitsByAddress }) : null),
    [data, previous.visitsByAddress, previousYear],
  )

  if (!campaigns.length) {
    return <div className="page"><h1>Statistiques</h1><div className="card empty">Aucune campagne. Créez-en une dans « Campagnes ».</div></div>
  }

  const g = stats.global
  const p = prevStats?.global
  const prevLabel = previousYear ? String(previousYear) : ''

  const doExport = async (kind) => {
    setExporting(true)
    try {
      const args = { year, stats, previousStats: prevStats, previousYear, ...data, visitsByAddress: current.visitsByAddress }
      if (kind === 'xlsx') await exportExcel(args)
      else await exportPdf(args)
    } catch (err) {
      toast(`Export impossible : ${err.message}`)
    }
    setExporting(false)
  }

  return (
    <div className="page stack">
      <div className="page-header">
        <h1>Statistiques</h1>
        <div className="row">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 'auto' }}>
            {campaigns.map((c) => <option key={c.year} value={c.year}>Campagne {c.year}{c.active ? ' (active)' : ''}</option>)}
          </select>
          <button disabled={exporting} onClick={() => doExport('xlsx')}>📗 Excel</button>
          <button disabled={exporting} onClick={() => doExport('pdf')}>📕 PDF</button>
        </div>
      </div>

      <div className="grid-cards">
        <StatCard label="Dons totaux" value={formatEuro(g.total)} current={g.total} previous={p?.total} previousLabel={prevLabel} />
        <StatCard label="Calendriers" value={formatInt(g.calendars)} current={g.calendars} previous={p?.calendars} previousLabel={prevLabel} />
        <StatCard label="Dons réalisés" value={formatInt(g.counts.done)} current={g.counts.done} previous={p?.counts.done} previousLabel={prevLabel} />
        <StatCard label="Don moyen" value={formatEuro(g.average)} current={g.average} previous={p?.average} previousLabel={prevLabel} />
        <StatCard label="Refus" value={formatInt(g.counts.refused)} current={g.counts.refused} previous={p?.counts.refused} previousLabel={prevLabel} />
        <StatCard label="Repasses" value={formatInt(g.counts.absent)} current={g.counts.absent} previous={p?.counts.absent} previousLabel={prevLabel} />
        <StatCard label="Avancement" value={formatPercent(g.progress)} />
        <StatCard label="Reste à faire" value={formatInt(g.counts.todo)} />
      </div>

      <div className="card">
        <h2>Moyens de paiement</h2>
        <CompareBars
          rows={PAYMENT_FIELDS.map((f) => ({ id: f.key, name: f.label, total: g[f.key] }))}
          previousRows={p ? PAYMENT_FIELDS.map((f) => ({ id: f.key, name: f.label, total: p[f.key] })) : null}
        />
      </div>

      <div className="tabs">
        {[['sectors', 'Par secteur'], ['communes', 'Par commune'], ['members', 'Classement des membres']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'sectors' && (
        <>
          <div className="card">
            <h2>Dons par secteur {previousYear && <span className="muted small">(barre fine : {previousYear})</span>}</h2>
            <CompareBars rows={stats.bySector} previousRows={prevStats?.bySector} />
          </div>
          <BucketTable rows={stats.bySector} previousRows={prevStats?.bySector} />
        </>
      )}
      {tab === 'communes' && (
        <>
          <div className="card">
            <h2>Dons par commune {previousYear && <span className="muted small">(barre fine : {previousYear})</span>}</h2>
            <CompareBars rows={stats.byCommune} previousRows={prevStats?.byCommune} />
          </div>
          <BucketTable rows={stats.byCommune} previousRows={prevStats?.byCommune} />
        </>
      )}
      {tab === 'members' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Membre</th><th className="num">Dons</th><th className="num">Absents</th><th className="num">Refus</th><th className="num">Calendriers</th><th className="num">Don moyen</th><th className="num">Total</th></tr>
            </thead>
            <tbody>
              {stats.byMember.map((m, i) => (
                <tr key={m.id}>
                  <td>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
                  <td>{m.name}</td>
                  <td className="num">{formatInt(m.counts.done)}</td>
                  <td className="num">{formatInt(m.counts.absent)}</td>
                  <td className="num">{formatInt(m.counts.refused)}</td>
                  <td className="num">{formatInt(m.calendars)}</td>
                  <td className="num">{formatEuro(m.average)}</td>
                  <td className="num"><strong>{formatEuro(m.total)}</strong></td>
                </tr>
              ))}
              {!stats.byMember.length && <tr><td colSpan="8" className="muted">Aucun passage enregistré.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
