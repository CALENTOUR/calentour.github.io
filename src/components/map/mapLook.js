// Trois fonds pour la même carte : « Plan » (le style d'origine), « Illustré »
// (couleurs douces de carte dessinée) et « Satellite » (photos aériennes de l'IGN).
// On ne change pas de style MapLibre (cela effacerait les rues et les maisons de la
// tournée) : on recolore les couches du fond et on glisse la photo sous les noms.

const KEY = 'calentour:mapLook'
export const LOOKS = [
  { id: 'plan', label: 'Plan' },
  { id: 'illustre', label: 'Illustré' },
  { id: 'satellite', label: 'Satellite' },
]

const ORTHO = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg'

// Couleurs « carte illustrée » selon le nom de la couche du fond.
const ILLUSTRE = [
  [/^background$/, 'background-color', '#eef0d8'],
  [/wood|forest/, 'fill-color', '#9cc47a'],
  [/grass|park|meadow|farmland|landcover/, 'fill-color', '#c9dfa0'],
  [/residential|landuse/, 'fill-color', '#ece6cf'],
  [/water/, 'fill-color', '#9fcde3'],
  [/^building$/, 'fill-color', '#e2cfa8'],
  [/building/, 'fill-extrusion-color', '#e8d6b0'],
]

export const readLook = () => {
  try { return localStorage.getItem(KEY) || 'plan' } catch { return 'plan' }
}
const saveLook = (look) => {
  try { localStorage.setItem(KEY, look) } catch { /* rien */ }
}

const originals = new WeakMap()

export function applyLook(map, look, remember = true) {
  if (!map?.getStyle()) return
  if (remember) saveLook(look)
  const saved = originals.get(map) ?? new Map()
  originals.set(map, saved)
  const layers = map.getStyle().layers ?? []
  // Remise à zéro (style d'origine).
  for (const [k, v] of saved) {
    const [id, prop] = k.split('|')
    if (map.getLayer(id)) map.setPaintProperty(id, prop, v)
  }
  saved.clear()
  if (map.getLayer('look-satellite')) map.removeLayer('look-satellite')

  if (look === 'illustre') {
    for (const l of layers) {
      if (l.id.startsWith('calentour-') && l.type !== 'fill-extrusion') continue
      const rule = ILLUSTRE.find(([re, prop]) => re.test(l.id) && prop.startsWith(l.type))
      if (!rule) continue
      const [, prop, color] = rule
      saved.set(`${l.id}|${prop}`, map.getPaintProperty(l.id, prop))
      map.setPaintProperty(l.id, prop, color)
    }
  }
  if (look === 'satellite') {
    if (!map.getSource('look-ortho')) {
      map.addSource('look-ortho', { type: 'raster', tiles: [ORTHO], tileSize: 256, maxzoom: 19, attribution: '© IGN' })
    }
    // Sous les noms de rues et les couches de la tournée, au-dessus du reste du fond.
    const before = layers.find((l) => l.type === 'symbol')?.id
    map.addLayer({ id: 'look-satellite', type: 'raster', source: 'look-ortho' }, before)
    // Bâtiments gris du fond masqués : seules les maisons de la tournée restent colorées.
    for (const l of layers) {
      if (l.type === 'fill-extrusion' && !l.id.startsWith('lit-')) {
        saved.set(`${l.id}|fill-extrusion-opacity`, map.getPaintProperty(l.id, 'fill-extrusion-opacity'))
        map.setPaintProperty(l.id, 'fill-extrusion-opacity', 0)
      }
    }
  }
}
