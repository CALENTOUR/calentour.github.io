import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData, useCampaignVisits } from '../context/DataContext'
import { computeStats } from '../lib/stats'
import { formatEuro, formatInt, formatPercent } from '../lib/format'
import { createCampaign, setActiveCampaign } from '../services/campaigns'
import { useToast } from '../components/ui/Toast'

function CampaignRow({ campaign, isAdmin, onActivate }) {
  const data = useData()
  const { visitsByAddress } = useCampaignVisits(campaign.year)
  const s = useMemo(() => computeStats({ ...data, visitsByAddress }).global, [data, visitsByAddress])
  return (
    <tr>
      <td><strong>{campaign.year}</strong></td>
      <td>{campaign.active ? <span className="badge" style={{ borderColor: 'var(--green)' }}>● Active</span> : <span className="muted">Clôturée</span>}</td>
      <td className="num">{formatEuro(s.total)}</td>
      <td className="num">{formatInt(s.calendars)}</td>
      <td className="num">{formatInt(s.counts.done)}</td>
      <td className="num">{formatInt(s.counts.refused)}</td>
      <td className="num">{formatPercent(s.progress)}</td>
      {isAdmin && (
        <td>{!campaign.active && <button className="btn-sm" onClick={() => onActivate(campaign.year)}>Activer</button>}</td>
      )}
    </tr>
  )
}

export default function CampaignsPage() {
  const { isAdmin } = useAuth()
  const { campaigns } = useData()
  const toast = useToast()
  const [year, setYear] = useState(() => (campaigns[0]?.year ?? new Date().getFullYear()) + (campaigns.length ? 1 : 0))

  const onCreate = async (e) => {
    e.preventDefault()
    if (campaigns.some((c) => c.year === Number(year))) return toast('Cette campagne existe déjà')
    try {
      await createCampaign(year)
      if (!campaigns.length) await setActiveCampaign(year, [{ year: Number(year) }])
      toast(`Campagne ${year} créée`)
    } catch (err) {
      toast(`Erreur : ${err.message}`)
    }
  }

  const onActivate = (y) => {
    setActiveCampaign(y, campaigns)
      .then(() => toast(`Campagne ${y} active : la carte affiche désormais ses statuts`))
      .catch((err) => toast(`Erreur : ${err.message}`))
  }

  return (
    <div className="page stack">
      <div className="page-header"><h1>Campagnes</h1></div>
      <p className="muted">
        Chaque année a sa propre campagne. Les adresses et secteurs sont conservés d’une année à l’autre,
        les statuts et les dons repartent de zéro. Une seule campagne est active : c’est elle qui s’affiche sur la carte.
      </p>

      {isAdmin && (
        <form className="card row" onSubmit={onCreate}>
          <label style={{ flex: '0 1 160px' }}>
            Année
            <input type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} />
          </label>
          <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-end' }}>＋ Créer la campagne</button>
        </form>
      )}

      {!campaigns.length ? (
        <div className="card empty">Aucune campagne pour l’instant.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Année</th><th>État</th><th className="num">Dons</th><th className="num">Calendriers</th>
                <th className="num">Dons réalisés</th><th className="num">Refus</th><th className="num">Avancement</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => <CampaignRow key={c.year} campaign={c} isAdmin={isAdmin} onActivate={onActivate} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
