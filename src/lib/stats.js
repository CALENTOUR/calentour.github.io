import { DONE_STATUSES, PAYMENT_MODES } from '../config/constants'
import { dwellingKey } from '../services/state'

// Liste des habitations d'une tournée : une par maison, ou une par logement d'immeuble.
export function dwellings(tour) {
  const out = []
  for (const h of tour?.houses ?? []) {
    if (h.units?.length) for (const u of h.units) out.push({ key: dwellingKey(h.id, u.id), house: h, unit: u })
    else out.push({ key: dwellingKey(h.id), house: h, unit: null })
  }
  return out
}

export function emptyStats() {
  return {
    total: 0, visited: 0, done: 0,
    counts: { todo: 0, given: 0, again: 0, refused: 0, empty: 0 },
    amount: 0, byMode: Object.fromEntries(PAYMENT_MODES.map((m) => [m.key, 0])),
    chequeCount: 0,
  }
}

function finish(s) {
  const ratio = (a, b) => (b ? a / b : 0)
  return {
    ...s,
    progress: ratio(s.done, s.total),
    giveRate: ratio(s.counts.given, s.visited),
    refuseRate: ratio(s.counts.refused + s.counts.empty, s.visited),
    againRate: ratio(s.counts.again, s.visited),
    average: ratio(s.amount, s.counts.given),
    perVisit: ratio(s.amount, s.visited),
  }
}

function add(s, entry) {
  s.total++
  const status = entry?.s ?? 'todo'
  s.counts[status] = (s.counts[status] ?? 0) + 1
  if (status !== 'todo') s.visited++
  if (DONE_STATUSES.includes(status)) s.done++
  if (status === 'given') {
    const amount = Number(entry.amount) || 0
    s.amount += amount
    if (entry.mode) s.byMode[entry.mode] = (s.byMode[entry.mode] ?? 0) + amount
    if (entry.mode === 'cheque') s.chequeCount++
  }
}

// Statistiques d'une tournée (et de chacun de ses morceaux).
export function tourStats(tour, state) {
  const h = state?.h ?? {}
  const all = emptyStats()
  const byPiece = Object.fromEntries((tour?.pieces ?? []).map((p) => [p.id, emptyStats()]))
  for (const d of dwellings(tour)) {
    add(all, h[d.key])
    if (byPiece[d.house.pieceId]) add(byPiece[d.house.pieceId], h[d.key])
  }
  return {
    ...finish(all),
    byPiece: Object.fromEntries(Object.entries(byPiece).map(([k, v]) => [k, finish(v)])),
  }
}

// Statistiques globales et par tournée, plus les dons par jour.
export function globalStats(tours, statesById) {
  const all = emptyStats()
  const perTour = []
  const perDay = new Map()
  for (const t of tours) {
    const st = tourStats(t, statesById[t.id])
    perTour.push({ tour: t, stats: st })
    for (const k of ['total', 'visited', 'done', 'amount', 'chequeCount']) all[k] += st[k]
    for (const k of Object.keys(all.counts)) all.counts[k] += st.counts[k] ?? 0
    for (const k of Object.keys(all.byMode)) all.byMode[k] += st.byMode[k] ?? 0
    for (const e of Object.values(statesById[t.id]?.h ?? {})) {
      if (e?.s !== 'given' || !e.at) continue
      const day = e.at.slice(0, 10)
      const d = perDay.get(day) ?? { day, amount: 0, count: 0 }
      d.amount += Number(e.amount) || 0
      d.count++
      perDay.set(day, d)
    }
  }
  return {
    ...finish(all),
    perTour: perTour.sort((a, b) => b.stats.amount - a.stats.amount),
    perDay: [...perDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
  }
}

// Ordre de visite : par morceau, puis le long de la rue.
export function sortHouses(houses, pieces) {
  const order = new Map((pieces ?? []).map((p, i) => [p.id, i]))
  return [...houses].sort((a, b) => (order.get(a.pieceId) ?? 99) - (order.get(b.pieceId) ?? 99) || (a.along ?? 0) - (b.along ?? 0))
}
