import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { STATUS_LIST } from '../config/constants'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { findSectorForPoint, polygonBounds } from '../lib/geo'
import { computeStats } from '../lib/stats'
import { reverseGeocode } from '../lib/osm'
import { toggle3D, useMapLibre } from '../components/map/useMapLibre'
import { addressesToGeoJSON, sectorsToGeoJSON, upsertAddressLayer, upsertSectorLayers } from '../components/map/layers'
import VisitSheet from '../components/VisitSheet'
import AddressForm from '../components/AddressForm'
import { StatusDot } from '../components/ui/StatusBadge'

export default function MapPage() {
  const containerRef = useRef(null)
  const { user, isAdmin } = useAuth()
  const data = useData()
  const { sectors, addresses, addressesById, activeVisits, activeCampaign } = data
  const [params, setParams] = useSearchParams()

  const [onlyMine, setOnlyMine] = useState(!isAdmin)
  const [is3D, setIs3D] = useState(true)
  const [addMode, setAddMode] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null) // { address } ou { initial }

  const mySectorIds = useMemo(
    () => new Set(sectors.filter((s) => s.memberIds?.includes(user.uid)).map((s) => s.id)),
    [sectors, user.uid],
  )
  const hasAssignment = mySectorIds.size > 0
  const visibleSectors = onlyMine && hasAssignment ? sectors.filter((s) => mySectorIds.has(s.id)) : sectors
  const visibleAddresses = useMemo(
    () => (onlyMine && hasAssignment ? addresses.filter((a) => mySectorIds.has(a.sectorId)) : addresses),
    [onlyMine, hasAssignment, addresses, mySectorIds],
  )

  const stats = useMemo(() => computeStats({ ...data, visitsByAddress: activeVisits }), [data, activeVisits])
  const progressBySector = useMemo(
    () => Object.fromEntries(stats.bySector.map((s) => [s.id, s.progress])),
    [stats],
  )
  const legendCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_LIST.map((s) => [s.key, 0]))
    for (const a of visibleAddresses) counts[activeVisits[a.id]?.status ?? 'todo'] += 1
    return counts
  }, [visibleAddresses, activeVisits])

  const initialBounds = useMemo(() => {
    const pts = sectors.flatMap((s) => s.polygon ?? [])
    return pts.length >= 3 ? polygonBounds(pts) : null
  }, [sectors])
  const map = useMapLibre(containerRef, { rememberView: true, initialBounds })

  // Secteurs + pourcentage d'avancement
  useEffect(() => {
    if (map) upsertSectorLayers(map, sectorsToGeoJSON(visibleSectors, progressBySector))
  }, [map, visibleSectors, progressBySector])

  // Adresses colorées par statut
  useEffect(() => {
    if (map) upsertAddressLayer(map, addressesToGeoJSON(visibleAddresses, activeVisits))
  }, [map, visibleAddresses, activeVisits])

  // Clics sur la carte
  const addModeRef = useRef(addMode)
  addModeRef.current = addMode
  useEffect(() => {
    if (!map) return undefined
    const onClick = async (e) => {
      if (addModeRef.current) {
        const { lng, lat } = e.lngLat
        setAddMode(false)
        const sector = findSectorForPoint(lng, lat, sectors)
        const label = navigator.onLine ? await reverseGeocode(lng, lat) : ''
        setEditing({ initial: { lng, lat, label, sectorId: sector?.id ?? '' } })
        return
      }
      const hit = map.queryRenderedFeatures(
        [[e.point.x - 10, e.point.y - 10], [e.point.x + 10, e.point.y + 10]],
        { layers: ['addresses'] },
      )[0]
      if (hit) setSelectedId(hit.properties.id)
    }
    const setPointer = () => { map.getCanvas().style.cursor = 'pointer' }
    const resetPointer = () => { map.getCanvas().style.cursor = '' }
    map.on('click', onClick)
    map.on('mouseenter', 'addresses', setPointer)
    map.on('mouseleave', 'addresses', resetPointer)
    return () => {
      map.off('click', onClick)
      map.off('mouseenter', 'addresses', setPointer)
      map.off('mouseleave', 'addresses', resetPointer)
    }
  }, [map, sectors])

  // Ouverture depuis la liste : /carte?adresse=<id>
  const focusId = params.get('adresse')
  useEffect(() => {
    if (!map || !focusId) return
    const a = addressesById[focusId]
    if (!a) return
    map.flyTo({ center: [a.lng, a.lat], zoom: 18, pitch: 55 })
    setSelectedId(a.id)
    setParams({}, { replace: true })
  }, [map, focusId, addressesById, setParams])

  // Ouverture depuis la page Secteurs : /carte?secteur=<id>
  const focusSector = params.get('secteur')
  useEffect(() => {
    if (!map || !focusSector) return
    const s = sectors.find((x) => x.id === focusSector)
    if (s?.polygon?.length >= 3) map.fitBounds(polygonBounds(s.polygon), { padding: 60, pitch: 50 })
    setParams({}, { replace: true })
  }, [map, focusSector, sectors, setParams])

  const selected = selectedId ? addressesById[selectedId] : null

  return (
    <div className="map-page">
      <div ref={containerRef} className="map-container" />

      <div className="map-overlay map-top">
        <div className="map-chip">
          {activeCampaign ? `📅 ${activeCampaign.year}` : '⚠️ Aucune campagne active'}
          {' · '}
          {Math.round(stats.global.progress * 100)} % traité
        </div>
        {hasAssignment && (
          <button className="map-chip btn-sm" onClick={() => setOnlyMine((v) => !v)}>
            {onlyMine ? '👤 Mes secteurs' : '👥 Tous les secteurs'}
          </button>
        )}
      </div>

      {addMode && <div className="map-overlay map-banner">Touchez la carte à l’emplacement de la maison</div>}

      <div className="map-overlay map-bottom">
        <div className="map-chip map-legend">
          {STATUS_LIST.map((s) => (
            <div className="row" key={s.key}>
              <StatusDot status={s.key} />
              <span>{s.label}</span>
              <span className="muted">{legendCounts[s.key]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="map-fab">
        <button onClick={() => map && setIs3D(toggle3D(map))} title="Basculer 2D / 3D">{is3D ? '2D' : '3D'}</button>
        {isAdmin && (
          <button
            className={addMode ? 'btn-blue' : 'btn-primary'}
            onClick={() => setAddMode((v) => !v)}
            title="Ajouter une adresse"
          >
            {addMode ? '✕' : '＋'}
          </button>
        )}
      </div>

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
        <AddressForm
          key={editing.address?.id ?? 'new'}
          address={editing.address}
          initial={editing.initial}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
