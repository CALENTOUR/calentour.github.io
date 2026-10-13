// Récupération des maisons le long des rues d'une tournée, depuis la
// Base Adresse Nationale (adresses officielles et gratuites, service de l'IGN).
import { projectOnLine, samplePoints } from './geo'

const ENDPOINTS = [
  (lng, lat) => `https://data.geopf.fr/geocodage/reverse?lon=${lng}&lat=${lat}&index=address&limit=20`,
  (lng, lat) => `https://api-adresse.data.gouv.fr/reverse/?lon=${lng}&lat=${lat}&limit=20`,
]
const STEP = 35 // mètres entre deux interrogations le long de la rue
const MAX_DIST = 40 // une maison à plus de 40 m du trait n'est pas sur ce morceau

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function reverse(lng, lat) {
  let lastError
  for (const make of ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(make(lng.toFixed(6), lat.toFixed(6)))
        if (res.status === 429) { await wait(1000 * (attempt + 1)); continue }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()).features ?? []
      } catch (err) {
        lastError = err
        await wait(300)
      }
    }
  }
  throw lastError ?? new Error('Service d’adresses indisponible')
}

async function pool(items, size, fn, onProgress) {
  let index = 0
  let done = 0
  const results = new Array(items.length)
  await Promise.all(Array.from({ length: size }, async () => {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
      onProgress?.(++done, items.length)
    }
  }))
  return results
}

const mostCommon = (values) => {
  const counts = new Map()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

// pieces : [{ id, line }]. Renvoie { houses: [...], pieceNames: { pieceId: nom } }.
export async function fetchHousesAlongPieces(pieces, onProgress) {
  const queries = pieces.flatMap((p) => samplePoints(p.line, STEP))
  const answers = await pool(queries, 6, ([lng, lat]) => reverse(lng, lat), onProgress)

  const byId = new Map()
  for (const f of answers.flat()) {
    const props = f.properties ?? {}
    if (props.type && props.type !== 'housenumber') continue
    const id = props.id ?? `${props.label}`
    if (byId.has(id)) continue
    const [lng, lat] = f.geometry.coordinates
    let best = null
    for (const p of pieces) {
      const proj = projectOnLine([lng, lat], p.line)
      if (proj.dist <= MAX_DIST && (!best || proj.dist < best.dist)) best = { ...proj, pieceId: p.id }
    }
    if (!best) continue
    byId.set(id, {
      banId: id,
      number: props.housenumber ?? '',
      street: props.street ?? props.name?.replace(/^\S+\s+/, '') ?? '',
      city: props.city ?? '',
      label: props.name ?? props.label ?? '',
      lng,
      lat,
      pieceId: best.pieceId,
      along: Math.round(best.along),
    })
  }

  const houses = [...byId.values()]
  const pieceNames = {}
  for (const p of pieces) {
    const own = houses.filter((h) => h.pieceId === p.id)
    const street = mostCommon(own.map((h) => h.street))
    const city = mostCommon(own.map((h) => h.city))
    if (street) pieceNames[p.id] = city ? `${street} · ${city}` : street
  }
  return { houses, pieceNames }
}
