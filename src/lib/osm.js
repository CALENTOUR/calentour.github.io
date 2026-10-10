import { pointInPolygon, polygonBounds } from './geo'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'

// Récupère dans OpenStreetMap toutes les adresses (numéro + rue) situées dans le
// polygone d'un secteur. Les bâtiments sans numéro ne sont pas importés.
export async function fetchOsmAddresses(polygon) {
  const [[minLng, minLat], [maxLng, maxLat]] = polygonBounds(polygon)
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`
  const query = `[out:json][timeout:60];
(
  node["addr:housenumber"](${bbox});
  way["addr:housenumber"](${bbox});
);
out center tags;`
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
  })
  if (!res.ok) throw new Error(`OpenStreetMap indisponible (${res.status}). Réessayez plus tard.`)
  const json = await res.json()

  const seen = new Set()
  const results = []
  for (const el of json.elements ?? []) {
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    const t = el.tags ?? {}
    const street = t['addr:street'] ?? t['addr:place']
    if (lat == null || lng == null || !street) continue
    if (!pointInPolygon(lng, lat, polygon)) continue
    const city = t['addr:city'] ? ` ${t['addr:postcode'] ?? ''} ${t['addr:city']}`.replace(/\s+/g, ' ') : ''
    const label = `${t['addr:housenumber']} ${street}${city ? `,${city}` : ''}`
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push({ label, lat, lng })
  }
  return results.sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true }))
}

// Adresse lisible du point touché sur la carte (aide à la saisie manuelle).
export async function reverseGeocode(lng, lat) {
  try {
    const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=fr`
    const res = await fetch(url)
    if (!res.ok) return ''
    const json = await res.json()
    const a = json.address ?? {}
    const street = [a.house_number, a.road ?? a.pedestrian ?? a.hamlet].filter(Boolean).join(' ')
    const city = [a.postcode, a.village ?? a.town ?? a.city].filter(Boolean).join(' ')
    return [street, city].filter(Boolean).join(', ')
  } catch {
    return ''
  }
}
