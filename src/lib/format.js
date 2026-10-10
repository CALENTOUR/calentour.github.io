const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const integer = new Intl.NumberFormat('fr-FR')
const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

export const formatEuro = (value) => euro.format(Number(value) || 0)
export const formatInt = (value) => integer.format(Number(value) || 0)
export const formatPercent = (value) => `${Math.round((Number(value) || 0) * 100)} %`

export function formatDate(value) {
  if (!value) return ''
  const d = value?.toDate ? value.toDate() : new Date(value)
  return Number.isNaN(d.getTime()) ? '' : dateTime.format(d)
}

// Variation N / N-1 lisible : "+12 %", "-5 %", "nouveau".
export function formatDelta(current, previous) {
  if (!previous) return current ? 'nouveau' : '='
  const delta = (current - previous) / previous
  const sign = delta > 0 ? '+' : ''
  return `${sign}${Math.round(delta * 100)} %`
}

export function toNumber(value) {
  if (value === '' || value == null) return 0
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0
}

export function newId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20)
}
