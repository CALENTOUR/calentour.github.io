// Outils géométriques simples. Un polygone est un tableau de points { lng, lat }
// (format compatible Firestore, qui n'accepte pas les tableaux imbriqués).

export function pointInPolygon(lng, lat, polygon) {
  if (!polygon || polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng
    const yi = polygon[i].lat
    const xj = polygon[j].lng
    const yj = polygon[j].lat
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function polygonCentroid(polygon) {
  if (!polygon?.length) return null
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const f = polygon[j].lng * polygon[i].lat - polygon[i].lng * polygon[j].lat
    area += f
    cx += (polygon[j].lng + polygon[i].lng) * f
    cy += (polygon[j].lat + polygon[i].lat) * f
  }
  if (Math.abs(area) < 1e-12) {
    const n = polygon.length
    return {
      lng: polygon.reduce((s, p) => s + p.lng, 0) / n,
      lat: polygon.reduce((s, p) => s + p.lat, 0) / n,
    }
  }
  area *= 3
  return { lng: cx / area, lat: cy / area }
}

export function polygonBounds(polygon) {
  const lngs = polygon.map((p) => p.lng)
  const lats = polygon.map((p) => p.lat)
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

export function polygonToGeoJSON(polygon) {
  const ring = polygon.map((p) => [p.lng, p.lat])
  if (ring.length) ring.push(ring[0])
  return { type: 'Polygon', coordinates: [ring] }
}

export function findSectorForPoint(lng, lat, sectors) {
  return sectors.find((s) => pointInPolygon(lng, lat, s.polygon)) ?? null
}
