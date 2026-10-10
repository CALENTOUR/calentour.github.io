import { STATUS_LIST } from '../../config/constants'
import { polygonCentroid, polygonToGeoJSON } from '../../lib/geo'
import { setGeoJSON } from './useMapLibre'

const LABEL_FONT = ['Noto Sans Bold']

export function statusColorExpression(prop = 'color') {
  return ['match', ['get', 'status'], ...STATUS_LIST.flatMap((s) => [s.key, s[prop]]), '#f8fafc']
}

export function sectorsToGeoJSON(sectors, progressBySector = {}) {
  return {
    polygons: {
      type: 'FeatureCollection',
      features: sectors
        .filter((s) => s.polygon?.length >= 3)
        .map((s) => ({
          type: 'Feature',
          id: s.id,
          properties: { id: s.id, name: s.name, color: s.color },
          geometry: polygonToGeoJSON(s.polygon),
        })),
    },
    labels: {
      type: 'FeatureCollection',
      features: sectors
        .filter((s) => s.polygon?.length >= 3)
        .map((s) => {
          const c = polygonCentroid(s.polygon)
          const pct = progressBySector[s.id]
          return {
            type: 'Feature',
            properties: {
              label: pct == null ? s.name : `${s.name}\n${Math.round(pct * 100)} %`,
              color: s.color,
            },
            geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
          }
        }),
    },
  }
}

export function addressesToGeoJSON(addresses, visitsByAddress) {
  return {
    type: 'FeatureCollection',
    features: addresses.map((a) => ({
      type: 'Feature',
      properties: { id: a.id, status: visitsByAddress[a.id]?.status ?? 'todo', label: a.label },
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
    })),
  }
}

export function upsertSectorLayers(map, { polygons, labels }) {
  setGeoJSON(map, 'sectors', polygons)
  setGeoJSON(map, 'sector-labels', labels)
  if (!map.getLayer('sectors-fill')) {
    map.addLayer({
      id: 'sectors-fill',
      type: 'fill',
      source: 'sectors',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 },
    })
    map.addLayer({
      id: 'sectors-line',
      type: 'line',
      source: 'sectors',
      paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.9 },
    })
    map.addLayer({
      id: 'sector-labels',
      type: 'symbol',
      source: 'sector-labels',
      maxzoom: 17,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': LABEL_FONT,
        'text-size': 15,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': ['get', 'color'],
        'text-halo-width': 2.5,
      },
    })
  }
}

export function upsertAddressLayer(map, data) {
  setGeoJSON(map, 'addresses', data)
  if (!map.getLayer('addresses')) {
    map.addLayer({
      id: 'addresses',
      type: 'circle',
      source: 'addresses',
      paint: {
        'circle-color': statusColorExpression('color'),
        'circle-stroke-color': statusColorExpression('stroke'),
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 18, 2.5],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 15, 6, 18, 11],
        'circle-pitch-alignment': 'viewport',
      },
    })
    map.addLayer({
      id: 'address-labels',
      type: 'symbol',
      source: 'addresses',
      minzoom: 17.5,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 1.3],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: { 'text-color': '#f1f5f9', 'text-halo-color': '#0f172a', 'text-halo-width': 1.5 },
    })
  }
}
