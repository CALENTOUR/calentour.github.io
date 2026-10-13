import { STATUS_LIST } from '../../config/constants'

// Pictogrammes dessinés à la volée : une maisonnette (maison) ou un immeuble,
// coloré selon le statut. Évite tout fichier d'image à télécharger.
const SIZE = 44

function draw(kind, fill, stroke) {
  const c = document.createElement('canvas')
  c.width = SIZE
  c.height = SIZE
  const g = c.getContext('2d')
  g.lineJoin = 'round'
  g.lineWidth = 3.5
  g.fillStyle = fill
  g.strokeStyle = stroke
  g.beginPath()
  if (kind === 'house') {
    g.moveTo(22, 4)
    g.lineTo(40, 19)
    g.lineTo(35, 19)
    g.lineTo(35, 39)
    g.lineTo(9, 39)
    g.lineTo(9, 19)
    g.lineTo(4, 19)
    g.closePath()
  } else {
    g.roundRect(8, 3, 28, 37, 4)
  }
  g.fill()
  g.stroke()
  g.fillStyle = stroke
  if (kind === 'house') {
    g.fillRect(18.5, 27, 7, 12)
  } else {
    for (let y = 9; y < 32; y += 8) for (const x of [13, 25]) g.fillRect(x, y, 6, 5)
  }
  return g.getImageData(0, 0, SIZE, SIZE)
}

export function addStatusIcons(map) {
  for (const s of STATUS_LIST) {
    for (const kind of ['house', 'building']) {
      const id = `${kind}-${s.key}`
      if (!map.hasImage(id)) map.addImage(id, draw(kind, s.color, s.stroke), { pixelRatio: 2 })
    }
  }
}
