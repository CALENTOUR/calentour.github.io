// Lecture d'un export KML de Google My Maps : chaque trait est un morceau de
// tournée, le nom du trait est le binôme ("6 Aude / Logan" ou "Dylan / Thibaut").
const clean = (s) => (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

export function parseTourName(raw) {
  const name = clean(raw)
  const m = name.match(/^(\d+)\s*[-.:]?\s+(.*)$/)
  const label = m ? clean(m[2]) : name
  return {
    number: m ? Number(m[1]) : null,
    name: label,
    members: label.split(/\s*[/&+]\s*|\s+et\s+/i).map(clean).filter(Boolean),
  }
}

function lineColor(placemark, styles) {
  const url = placemark.getElementsByTagName('styleUrl')[0]?.textContent ?? ''
  const fromId = url.match(/line-([0-9A-Fa-f]{6})/)
  if (fromId) return `#${fromId[1].toLowerCase()}`
  const kml = styles[url.replace('#', '')] // couleur KML : aabbggrr
  return kml ? `#${kml.slice(6, 8)}${kml.slice(4, 6)}${kml.slice(2, 4)}` : null
}

export function parseKml(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  if (xml.getElementsByTagName('parsererror').length) throw new Error('Fichier KML illisible.')
  const styles = {}
  for (const s of xml.getElementsByTagName('Style')) {
    const c = s.getElementsByTagName('LineStyle')[0]?.getElementsByTagName('color')[0]?.textContent
    if (c) styles[s.getAttribute('id')] = c.trim()
  }

  const tours = new Map()
  for (const pm of xml.getElementsByTagName('Placemark')) {
    const info = parseTourName(pm.getElementsByTagName('name')[0]?.textContent)
    if (!info.name) continue
    const key = info.name.toLowerCase()
    for (const ls of pm.getElementsByTagName('LineString')) {
      const line = (ls.getElementsByTagName('coordinates')[0]?.textContent ?? '')
        .trim().split(/\s+/).map((c) => c.split(',').slice(0, 2).map(Number))
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
      if (line.length < 2) continue
      if (!tours.has(key)) tours.set(key, { ...info, color: lineColor(pm, styles), pieces: [] })
      const tour = tours.get(key)
      if (tour.number == null && info.number != null) tour.number = info.number
      tour.pieces.push({ line })
    }
  }

  // Les tournées sans numéro reçoivent les premiers numéros libres.
  const list = [...tours.values()]
  const used = new Set(list.map((t) => t.number).filter((n) => n != null))
  let next = 1
  for (const t of list) {
    if (t.number != null) continue
    while (used.has(next)) next++
    t.number = next
    used.add(next)
  }
  return list.sort((a, b) => a.number - b.number)
}
