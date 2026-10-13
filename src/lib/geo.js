// Outils géographiques. Les tracés sont des listes de points [lng, lat].
const R = 6371000
const rad = (d) => (d * Math.PI) / 180

export function distance([lng1, lat1], [lng2, lat2]) {
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function lineLength(line) {
  let total = 0
  for (let i = 1; i < line.length; i++) total += distance(line[i - 1], line[i])
  return total
}

// Projection locale en mètres autour d'une latitude (précis à l'échelle d'une commune).
function projector(lat0) {
  const kx = 111320 * Math.cos(rad(lat0))
  const ky = 110540
  return {
    to: ([lng, lat]) => [lng * kx, lat * ky],
    from: ([x, y]) => [x / kx, y / ky],
  }
}

// Point le plus proche d'un tracé : distance en mètres et position le long du tracé.
export function projectOnLine(point, line) {
  const p = projector(point[1])
  const [px, py] = p.to(point)
  let best = { dist: Infinity, along: 0 }
  let walked = 0
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = p.to(line[i - 1])
    const [bx, by] = p.to(line[i])
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
    const cx = ax + t * dx
    const cy = ay + t * dy
    const dist = Math.hypot(px - cx, py - cy)
    const segLen = Math.sqrt(len2)
    if (dist < best.dist) best = { dist, along: walked + t * segLen, side: Math.sign(dx * (py - ay) - dy * (px - ax)) }
    walked += segLen
  }
  return best
}

// Points régulièrement espacés le long d'un tracé (tous les `step` mètres).
export function samplePoints(line, step) {
  if (line.length < 2) return line.slice()
  const p = projector(line[0][1])
  const pts = line.map(p.to)
  const out = [line[0]]
  let carry = 0
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]
    const [bx, by] = pts[i]
    const seg = Math.hypot(bx - ax, by - ay)
    let d = step - carry
    while (d <= seg) {
      out.push(p.from([ax + ((bx - ax) * d) / seg, ay + ((by - ay) * d) / seg]))
      d += step
    }
    carry = seg - (d - step)
  }
  out.push(line[line.length - 1])
  return out
}

// Points de part et d'autre du tracé, pour simuler des maisons (démo).
export function offsetPoint(line, along, offset) {
  const p = projector(line[0][1])
  const pts = line.map(p.to)
  let walked = 0
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]
    const [bx, by] = pts[i]
    const seg = Math.hypot(bx - ax, by - ay)
    if (walked + seg >= along || i === pts.length - 1) {
      const t = seg ? Math.min(1, (along - walked) / seg) : 0
      const nx = -(by - ay) / (seg || 1)
      const ny = (bx - ax) / (seg || 1)
      return p.from([ax + t * (bx - ax) + nx * offset, ay + t * (by - ay) + ny * offset])
    }
    walked += seg
  }
  return line[line.length - 1]
}

export function bounds(points) {
  if (!points.length) return null
  let w = Infinity
  let s = Infinity
  let e = -Infinity
  let n = -Infinity
  for (const [lng, lat] of points) {
    if (lng < w) w = lng
    if (lng > e) e = lng
    if (lat < s) s = lat
    if (lat > n) n = lat
  }
  return [[w, s], [e, n]]
}

// Firestore n'accepte pas les tableaux de tableaux : on stocke les tracés à plat.
export const flatten = (line) => line.flatMap(([lng, lat]) => [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6])
export function unflatten(flat = []) {
  const out = []
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]])
  return out
}
