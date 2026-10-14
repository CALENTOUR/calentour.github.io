// Vérification des maisons avec la BDNB (base nationale des bâtiments du CSTB, celle
// de Go Rénove). Elle relie chaque adresse de la Base Adresse Nationale au bâtiment
// qu'elle dessert, avec son nombre de logements (fichiers fonciers).
// Comparaison faite en octobre 2026 sur les 25 tournées (BAN, BD TOPO IGN, BDNB,
// OpenStreetMap) : la BAN donne la bonne liste d'adresses mais place souvent le
// point au bord de la route, ou plusieurs adresses au même endroit ; la BDNB dit où
// est vraiment la maison et si elle est habitée. On corrige donc :
// - la position des maisons dont le bâtiment est à plus de 25 m du point ;
// - les doublons (même numéro, même bâtiment, sous plusieurs noms de rue) ;
// - les adresses de simples dépendances (garage, hangar, abri) ;
// - les maisons comptées dans plusieurs tournées (gardées dans la plus proche) ;
// - les maisons habitées au bord d'une rue tracée mais sans adresse dans la tournée.
import { projectOnLine, samplePoints, unflatten } from './geo'
import { locateOnPieces } from './tourBuilder'
import { newId } from './format'

const API = 'https://api.bdnb.io/v1/bdnb/donnees/batiment_groupe_complet'
const FIELDS = 'batiment_groupe_id,geom_groupe,nb_log,usage_principal_bdnb_open,l_cle_interop_adr,l_libelle_adr,s_geom_groupe'
const MOVE = 25 // m : au-delà, le point BAN n'est pas sur la maison
const NEAR_LINE = 30 // m : une maison habitée à moins de 30 m d'une rue tracée est sur la tournée
const COVERED = 10 // m : une maison de la tournée à moins de 10 m d'un bâtiment le couvre déjà
const TIE = 8 // m : écart en dessous duquel deux tournées sont aussi proches d'une maison

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Lambert 93 (EPSG:2154) vers longitude / latitude.
export function fromLambert93([x, y]) {
  const n = 0.725607765053267
  const C = 11754255.426096
  const e = 0.0818191910428158
  const dx = x - 700000
  const dy = y - 12655612.049876
  const R = Math.hypot(dx, dy)
  const lng = 3 + (Math.atan(dx / -dy) / n) * (180 / Math.PI)
  const iso = -Math.log(R / C) / n
  let lat = 2 * Math.atan(Math.exp(iso)) - Math.PI / 2
  for (let i = 0; i < 8; i++) {
    const s = e * Math.sin(lat)
    lat = 2 * Math.atan(((1 + s) / (1 - s)) ** (e / 2) * Math.exp(iso)) - Math.PI / 2
  }
  return [lng, (lat * 180) / Math.PI]
}

async function get(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url)
      if (res.status === 429) { await wait(5000 * (attempt + 1)); continue }
      if (!res.ok) throw new Error(`BDNB ${res.status}`)
      return await res.json()
    } catch (err) {
      if (attempt === 4) throw err
      await wait(1500 * (attempt + 1))
    }
  }
  return []
}

// Bâtiments d'une liste de communes (codes INSEE). L'API publique rend 10 lignes par appel
// et 120 appels par minute : on avance par pages de 10, une toutes les 550 ms.
export async function fetchBuildings(codes, onProgress) {
  const out = []
  for (const code of codes) {
    for (let offset = 0; ; offset += 10) {
      const rows = await get(`${API}?code_commune_insee=eq.${code}&select=${FIELDS}&limit=10&offset=${offset}`)
      out.push(...rows)
      onProgress?.(out.length)
      await wait(550)
      if (rows.length < 10) break
    }
  }
  return out.map(toBuilding).filter(Boolean)
}

export function toBuilding(row) {
  const g = row.geom_groupe
  const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []
  const rings = polys.map((p) => p[0].map(fromLambert93)).filter((r) => r.length > 2)
  if (!rings.length) return null
  const logements = Number(row.nb_log) || 0
  const usage = row.usage_principal_bdnb_open ?? ''
  return {
    id: row.batiment_groupe_id,
    rings,
    logements,
    usage,
    area: Number(row.s_geom_groupe) || 0,
    addresses: row.l_cle_interop_adr ?? [],
    labels: row.l_libelle_adr ?? [],
    habited: logements > 0 || usage.startsWith('Résidentiel'),
    // Garage, hangar, abri : dépendance sans logement, ou petit bâtiment sans usage connu.
    annex: logements === 0 && (usage === 'Dépendance' || (!usage && (Number(row.s_geom_groupe) || 0) < 60)),
  }
}

// --- Géométrie en mètres, à l'échelle d'un village.
const KY = 110540
const kx = (lat) => 111320 * Math.cos((lat * Math.PI) / 180)

function inside([x, y], ring) {
  let ok = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok
  }
  return ok
}

// Distance en mètres d'un point au bâtiment (0 s'il est dedans).
export function distanceToBuilding(pt, b) {
  if (b.rings.some((r) => inside(pt, r))) return 0
  let best = Infinity
  for (const r of b.rings) best = Math.min(best, projectOnLine(pt, r).dist)
  return best
}

// Point au cœur du bâtiment : centre de son plus grand contour, ramené dedans au besoin.
export function buildingPoint(b) {
  const ring = b.rings.reduce((a, r) => (r.length > a.length ? r : a), b.rings[0])
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
    area += f
    cx += (ring[j][0] + ring[i][0]) * f
    cy += (ring[j][1] + ring[i][1]) * f
  }
  const c = area ? [cx / (3 * area), cy / (3 * area)] : ring[0]
  if (inside(c, ring)) return c
  return ring.reduce((a, q) => [a[0] + q[0] / ring.length, a[1] + q[1] / ring.length], [0, 0])
}

// Index des bâtiments par carreau de ~100 m, pour ne comparer que les voisins.
function grid(buildings) {
  const cell = 0.001
  const map = new Map()
  for (const b of buildings) {
    const xs = b.rings.flat().map((q) => q[0])
    const ys = b.rings.flat().map((q) => q[1])
    for (let x = Math.floor(Math.min(...xs) / cell); x <= Math.floor(Math.max(...xs) / cell); x++) {
      for (let y = Math.floor(Math.min(...ys) / cell); y <= Math.floor(Math.max(...ys) / cell); y++) {
        const k = `${x}:${y}`
        if (!map.has(k)) map.set(k, [])
        map.get(k).push(b)
      }
    }
  }
  return ([lng, lat], radius) => {
    const rx = Math.ceil(radius / kx(lat) / cell)
    const ry = Math.ceil(radius / KY / cell)
    const cx = Math.floor(lng / cell)
    const cy = Math.floor(lat / cell)
    const found = new Set()
    for (let x = cx - rx; x <= cx + rx; x++) for (let y = cy - ry; y <= cy + ry; y++) for (const b of map.get(`${x}:${y}`) ?? []) found.add(b)
    return [...found]
  }
}

const tourLines = (tour) => (tour.pieces ?? []).flatMap((p) => p.lines.map((l) => unflatten(l.c))).filter((l) => l.length > 1)
const lineDistance = (pt, lines) => Math.min(Infinity, ...lines.map((l) => projectOnLine(pt, l).dist))

// « 8 lotissement les mirabelliers, 88270, Dompaire » → numéro, rue, commune.
function parseLabel(label = '') {
  const [first = '', , city = ''] = label.split(',').map((s) => s.trim())
  const m = first.match(/^(\d+(?:\s?(?:bis|ter|quater|[a-d]))?)\s+(.+)$/i)
  const title = (s) => s.replace(/(^|[\s'-])(\p{L})/gu, (_, a, c) => a + c.toUpperCase()).replace(/\b(De|Du|Des|La|Le|Les|L'|D')\b/g, (w) => w.toLowerCase())
  return { number: m ? m[1].replace(/\s/g, '') : '', street: title(m ? m[2] : first), city }
}

// Codes INSEE des communes des tournées (début des identifiants BAN : 88151_0120_00018).
export const communesOf = (tours) => [...new Set(tours.flatMap((t) => (t.houses ?? []).map((h) => h.banId?.slice(0, 5))).filter((c) => /^\d[\dAB]\d{3}$/.test(c ?? '')))].sort()

// Une maison ne bouge plus de tournée ni ne disparaît si un passage y est déjà noté, ou si
// elle a été ajoutée à la main.
const locked = (h, state) => h.added || Boolean(state?.h?.[h.id])

// Calcul pur : renvoie les nouvelles listes de maisons (seulement les tournées changées) et le bilan.
export function checkTours(tours, buildings, statesById = {}) {
  const near = grid(buildings)
  const byAddress = new Map()
  for (const b of buildings) for (const a of b.addresses) byAddress.set(a, [...(byAddress.get(a) ?? []), b])
  const lines = new Map(tours.map((t) => [t.id, tourLines(t)]))
  const report = new Map(tours.map((t) => [t.id, { moved: 0, duplicates: 0, annexes: 0, shared: 0, added: 0 }]))
  const houses = new Map(tours.map((t) => [t.id, (t.houses ?? []).map((h) => ({ ...h }))]))
  const removed = new Map(tours.map((t) => [t.id, new Set()]))
  const details = []
  const drop = (tourId, h, why) => { removed.get(tourId).add(h.id); report.get(tourId)[why]++; details.push({ tourId, house: h, action: why }) }

  // 1. Position : la maison va sur son bâtiment quand le point BAN en est loin.
  for (const t of tours) {
    for (const h of houses.get(t.id)) {
      if (h.chk || !h.banId) continue
      const own = byAddress.get(h.banId) ?? []
      if (!own.length) continue
      const pt = [h.lng, h.lat]
      const pool = own.some((b) => b.habited) ? own.filter((b) => b.habited) : own
      const best = pool.map((b) => ({ b, d: distanceToBuilding(pt, b) })).sort((a, c) => a.d - c.d)[0]
      h.bdnb = best.b.id
      if (best.d > MOVE) {
        const [lng, lat] = buildingPoint(best.b)
        const loc = locateOnPieces(lng, lat, t.pieces ?? [])
        Object.assign(h, { lng, lat, moved: Math.round(best.d), pieceId: loc?.pieceId ?? h.pieceId, along: loc?.along ?? h.along })
        report.get(t.id).moved++
        details.push({ tourId: t.id, house: h, action: 'moved' })
      }
      // 2. Simple dépendance (garage, hangar…) : pas une maison à visiter.
      if (own.every((b) => b.annex) && !locked(h, statesById[t.id])) drop(t.id, h, 'annexes')
    }
  }

  // 3. Doublons : même numéro dans le même bâtiment (adresse donnée sous plusieurs rues).
  for (const t of tours) {
    const groups = new Map()
    for (const h of houses.get(t.id)) {
      if (!h.bdnb || removed.get(t.id).has(h.id)) continue
      const k = `${h.bdnb}|${String(h.number).toLowerCase()}`
      groups.set(k, [...(groups.get(k) ?? []), h])
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue
      const ranked = list.map((h) => ({ h, d: lineDistance([h.lng, h.lat], lines.get(t.id)) - (locked(h, statesById[t.id]) ? 1e6 : 0) })).sort((a, c) => a.d - c.d)
      for (const { h } of ranked.slice(1)) if (!locked(h, statesById[t.id])) drop(t.id, h, 'duplicates')
    }
  }

  // 4. Une adresse dans plusieurs tournées : elle reste dans celle dont la rue est la plus proche.
  const where = new Map()
  for (const t of tours) for (const h of houses.get(t.id)) if (h.banId && !removed.get(t.id).has(h.id)) where.set(h.banId, [...(where.get(h.banId) ?? []), { t, h }])
  for (const list of where.values()) {
    if (list.length < 2) continue
    // À quelques mètres près (rue tracée par deux équipes), la rue reste entière : elle va
    // à la tournée qui en a le plus de maisons.
    const sameStreet = (x) => houses.get(x.t.id).filter((o) => o.street === x.h.street && o.city === x.h.city && !removed.get(x.t.id).has(o.id)).length
    const ranked = list
      .map((x) => ({ ...x, d: lineDistance([x.h.lng, x.h.lat], lines.get(x.t.id)) - (locked(x.h, statesById[x.t.id]) ? 1e6 : 0), n: sameStreet(x) }))
      .sort((a, c) => (Math.abs(a.d - c.d) < TIE ? c.n - a.n : a.d - c.d))
    for (const x of ranked.slice(1)) if (!locked(x.h, statesById[x.t.id])) drop(x.t.id, x.h, 'shared')
  }

  // 5. Maisons habitées au bord d'une rue tracée que personne n'a : ajoutées à la tournée la plus proche.
  const taken = new Set()
  const kept = []
  for (const t of tours) {
    for (const h of houses.get(t.id)) {
      if (removed.get(t.id).has(h.id)) continue
      kept.push(h)
      if (h.banId) taken.add(h.banId)
      if (h.bdnb) taken.add(h.bdnb)
    }
    for (const id of t.skipBan ?? []) taken.add(id)
  }
  const keptNear = (pt) => kept.filter((h) => Math.abs(h.lat - pt[1]) < 0.001 && Math.abs(h.lng - pt[0]) < 0.0015)
  const candidates = new Set()
  for (const t of tours) for (const l of lines.get(t.id)) for (const q of samplePoints(l, 40)) for (const b of near(q, NEAR_LINE + 40)) candidates.add(b)
  for (const b of candidates) {
    if (b.logements < 1 || taken.has(b.id) || b.addresses.some((a) => taken.has(a))) continue
    const pt = buildingPoint(b)
    if (keptNear(pt).some((h) => distanceToBuilding([h.lng, h.lat], b) <= COVERED)) continue
    let best = null
    for (const t of tours) {
      const d = Math.min(...b.rings.map((r) => Math.min(...r.map((q) => lineDistance(q, lines.get(t.id))))))
      if (d <= NEAR_LINE && (!best || d < best.d)) best = { t, d }
    }
    if (!best) continue
    const loc = locateOnPieces(pt[0], pt[1], best.t.pieces ?? [])
    const { number, street, city } = parseLabel(b.labels[0])
    const house = { id: newId().slice(0, 12), banId: b.addresses[0] ?? null, bdnb: b.id, number, street: street || 'Maison sans adresse', city, label: number ? `${number} ${street}` : street || 'Maison sans adresse', lng: pt[0], lat: pt[1], pieceId: loc?.pieceId ?? null, along: loc?.along ?? 0, found: 'bdnb', chk: 1 }
    houses.get(best.t.id).push(house)
    kept.push(house)
    taken.add(b.id)
    report.get(best.t.id).added++
    details.push({ tourId: best.t.id, house, action: 'added' })
  }

  const changes = new Map()
  for (const t of tours) {
    const gone = removed.get(t.id)
    const next = houses.get(t.id).filter((h) => !gone.has(h.id)).map((h) => (h.chk ? h : { ...h, chk: 1 }))
    const skip = [...new Set([...(t.skipBan ?? []), ...(t.houses ?? []).filter((h) => gone.has(h.id) && h.banId).map((h) => h.banId)])]
    const before = JSON.stringify(t.houses ?? [])
    if (JSON.stringify(next) !== before || skip.length !== (t.skipBan ?? []).length) changes.set(t.id, { houses: next, skipBan: skip })
  }
  return { changes, report, details }
}

// À faire tant qu'une maison trouvée dans la Base Adresse n'a pas été vérifiée.
export const needsCheck = (tours) => tours.some((t) => (t.houses ?? []).some((h) => h.banId && !h.chk && !h.added))

// Vérification automatique côté admin. `latest()` rend les tournées à jour au moment
// d'enregistrer (le téléchargement prend quelques minutes).
// Bâtiments gardés pour la session ; après un échec (réseau, quota de l'API), on attend 30 min.
let running = false
let failedAt = 0
const cache = new Map()
export async function autoCheckAddresses(latest, statesById, save, onDone) {
  if (running || Date.now() - failedAt < 30 * 60 * 1000) return
  running = true
  try {
    const codes = communesOf(latest())
    for (const c of codes.filter((c) => !cache.has(c))) cache.set(c, await fetchBuildings([c]))
    const buildings = codes.flatMap((c) => cache.get(c))
    const tours = latest()
    if (!needsCheck(tours)) return
    const { changes, report } = checkTours(tours, buildings, statesById)
    for (const [id, data] of changes) await save(id, data)
    onDone?.(summarize(report))
  } catch (err) {
    failedAt = Date.now()
    console.warn('Vérification des adresses', err)
  } finally {
    running = false
  }
}

export function summarize(report) {
  const total = { moved: 0, duplicates: 0, annexes: 0, shared: 0, added: 0 }
  for (const r of report.values()) for (const k of Object.keys(total)) total[k] += r[k]
  return total
}
