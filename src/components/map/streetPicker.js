// Clic sur une rue de la carte : retrouve la rue entière (tous les tronçons
// portant le même nom et reliés entre eux) dans les tuiles OpenStreetMap chargées.
import { distance, projectOnLine } from '../../lib/geo'

const NEAR = 25 // mètres

function vectorSourceId(map) {
  return Object.entries(map.getStyle().sources).find(([, s]) => s.type === 'vector')?.[0]
}

function parts(feature) {
  const g = feature.geometry
  if (g.type === 'LineString') return [g.coordinates]
  if (g.type === 'MultiLineString') return g.coordinates
  return []
}

export function pickStreet(map, lngLat) {
  const source = vectorSourceId(map)
  if (!source) return null
  const click = [lngLat.lng, lngLat.lat]
  const named = map.querySourceFeatures(source, { sourceLayer: 'transportation_name' })
    .flatMap((f) => parts(f).map((line) => ({ name: f.properties.name, line })))
    .filter((p) => p.name && p.line.length > 1)

  let start = null
  for (const p of named) {
    const d = projectOnLine(click, p.line).dist
    if (d <= NEAR && (!start || d < start.d)) start = { ...p, d }
  }

  if (!start) {
    // Rue sans nom : tronçon le plus proche parmi les routes dessinées.
    const roads = map.queryRenderedFeatures().filter((f) => f.sourceLayer === 'transportation').flatMap(parts)
    let best = null
    for (const line of roads) {
      const d = projectOnLine(click, line).dist
      if (d <= NEAR && (!best || d < best.d)) best = { line, d }
    }
    return best ? { name: null, lines: [best.line] } : null
  }

  // Tronçons de même nom reliés de proche en proche au tronçon cliqué.
  const key = (l) => l.map((c) => c.join(',')).join(';')
  const candidates = new Map(named.filter((p) => p.name === start.name).map((p) => [key(p.line), p.line]))
  const picked = [start.line]
  candidates.delete(key(start.line))
  let grew = true
  while (grew) {
    grew = false
    for (const [k, line] of candidates) {
      const ends = [line[0], line[line.length - 1]]
      const touches = picked.some((pl) => ends.some((e) => pl.some((v) => distance(e, v) <= NEAR))
        || [pl[0], pl[pl.length - 1]].some((e) => line.some((v) => distance(e, v) <= NEAR)))
      if (touches) {
        picked.push(line)
        candidates.delete(k)
        grew = true
      }
    }
  }
  return { name: start.name, lines: picked }
}
