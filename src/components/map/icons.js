import { STATUS_LIST } from '../../config/constants'

// Pictogrammes dessinés à la volée : une épingle ronde (maison) ou carrée (immeuble),
// colorée selon le statut, avec un symbole au centre. Aucun fichier d'image à télécharger.
const W = 76
const H = 92
const SYMBOL = { given: '€', again: '↻', refused: '✕', empty: '∅' }
const TODO_INK = '#dc2626'

function houseGlyph(g, cx, cy, s) {
  g.beginPath()
  g.moveTo(cx, cy - s)
  g.lineTo(cx + s, cy - s * 0.1)
  g.lineTo(cx + s * 0.72, cy - s * 0.1)
  g.lineTo(cx + s * 0.72, cy + s * 0.85)
  g.lineTo(cx - s * 0.72, cy + s * 0.85)
  g.lineTo(cx - s * 0.72, cy - s * 0.1)
  g.lineTo(cx - s, cy - s * 0.1)
  g.closePath()
  g.fill()
}

function buildingGlyph(g, cx, cy, s, ink, bg) {
  g.fillStyle = ink
  g.beginPath()
  g.roundRect(cx - s * 0.7, cy - s, s * 1.4, s * 1.9, 3)
  g.fill()
  g.fillStyle = bg
  for (let row = 0; row < 3; row++) for (const dx of [-0.35, 0.15]) g.fillRect(cx + dx * s, cy - s * 0.72 + row * s * 0.55, s * 0.24, s * 0.3)
}

function draw(kind, status) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const todo = status.key === 'todo'
  const fill = todo ? '#ffffff' : status.color
  const ink = todo ? TODO_INK : '#ffffff'
  const cx = W / 2
  const cy = 34

  // Ombre portée et pointe de l'épingle.
  g.shadowColor = 'rgba(15, 23, 42, .35)'
  g.shadowBlur = 6
  g.shadowOffsetY = 3
  g.fillStyle = todo ? TODO_INK : status.stroke
  g.beginPath()
  if (kind === 'house') g.arc(cx, cy, 30, 0, Math.PI * 2)
  else g.roundRect(cx - 29, cy - 29, 58, 58, 12)
  g.moveTo(cx - 12, cy + 24)
  g.lineTo(cx, H - 6)
  g.lineTo(cx + 12, cy + 24)
  g.fill()
  g.shadowColor = 'transparent'

  // Tête de l'épingle : couleur du statut sur un liseré.
  g.fillStyle = fill
  g.beginPath()
  if (kind === 'house') g.arc(cx, cy, 24, 0, Math.PI * 2)
  else g.roundRect(cx - 23, cy - 23, 46, 46, 8)
  g.fill()

  g.fillStyle = ink
  if (kind === 'building') {
    buildingGlyph(g, cx, cy, 15, ink, fill)
  } else if (todo) {
    houseGlyph(g, cx, cy, 15)
  } else {
    g.font = '900 30px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(SYMBOL[status.key] ?? '', cx, cy + 2)
  }
  return g.getImageData(0, 0, W, H)
}

export function addStatusIcons(map) {
  for (const s of STATUS_LIST) {
    for (const kind of ['house', 'building']) {
      const id = `${kind}-${s.key}`
      if (!map.hasImage(id)) map.addImage(id, draw(kind, s), { pixelRatio: 2 })
    }
  }
}
