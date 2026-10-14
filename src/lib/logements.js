// Nombre de logements par bâtiment, d'après la BD TOPO de l'IGN (données ouvertes, service WFS de la Géoplateforme).
import { bounds } from './geo'

const WFS = 'https://data.geopf.fr/wfs/ows'

// Logements d'un immeuble : identifiants stables u1, u2…
export const withUnits = (house, n) => {
  const count = Math.max(0, Math.min(200, n))
  const units = count > 1 ? Array.from({ length: count }, (_, i) => house.units?.[i] ?? { id: `u${i + 1}`, label: `Appt ${i + 1}` }) : []
  return { ...house, units, ign: true }
}

function inside([x, y], ring) {
  let ok = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok
  }
  return ok
}

async function buildings([[w, s], [e, n]]) {
  const params = new URLSearchParams({
    SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', TYPENAMES: 'BDTOPO_V3:batiment',
    SRSNAME: 'EPSG:4326', OUTPUTFORMAT: 'application/json', COUNT: '5000',
    BBOX: `${w},${s},${e},${n},EPSG:4326`,
  })
  const res = await fetch(`${WFS}?${params}`)
  if (!res.ok) throw new Error(`IGN ${res.status}`)
  return (await res.json()).features ?? []
}

// Renvoie, pour chaque maison posée dans un bâtiment de plusieurs logements, ce nombre.
export async function unitsFromIGN(houses) {
  const out = new Map()
  // Une requête par paquet de maisons proches, pour rester sous la limite de bâtiments par réponse.
  const sorted = [...houses].sort((a, b) => a.lng - b.lng)
  for (let i = 0; i < sorted.length; i += 60) {
    const group = sorted.slice(i, i + 60)
    const box = bounds(group.map((h) => [h.lng, h.lat]))
    const pad = 0.0004
    const feats = await buildings([[box[0][0] - pad, box[0][1] - pad], [box[1][0] + pad, box[1][1] + pad]])
    for (const h of group) {
      for (const f of feats) {
        const n = Number(f.properties?.nombre_de_logements) || 0
        const g = f.geometry
        const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []
        if (polys.some((p) => inside([h.lng, h.lat], p[0]))) {
          if (n > 1) out.set(h.id, n)
          break
        }
      }
    }
  }
  return out
}

// Comptage automatique, une fois par maison : les maisons déjà vues par l'IGN ou réglées à la main sont marquées « ign ».
let running = false
export async function autoCountUnits(tours, save) {
  if (running) return
  running = true
  try {
    for (const t of tours) {
      const todo = (t.houses ?? []).filter((h) => !h.ign && !h.units?.length)
      if (!todo.length) continue
      const found = await unitsFromIGN(todo)
      const ids = new Set(todo.map((h) => h.id))
      await save(t.id, { houses: t.houses.map((h) => (found.has(h.id) ? withUnits(h, found.get(h.id)) : ids.has(h.id) ? { ...h, ign: true } : h)) })
    }
  } catch (err) {
    console.warn('Comptage IGN', err)
  } finally {
    running = false
  }
}
