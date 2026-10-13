// Préparation hors ligne : télécharge à l'avance le fond de carte autour d'une
// tournée. Les réponses sont gardées par le service worker (cache "map-tiles"),
// la carte s'affiche ensuite sans réseau.
import { MAP_STYLE_URL } from '../config/constants'

const lon2tile = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
const lat2tile = (lat, z) => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

function tileList([[w, s], [e, n]], minZoom, maxZoom) {
  const out = []
  for (let z = minZoom; z <= maxZoom; z++) {
    for (let x = lon2tile(w, z); x <= lon2tile(e, z); x++) {
      for (let y = lat2tile(n, z); y <= lat2tile(s, z); y++) out.push({ z, x, y })
    }
  }
  return out
}

function collectFonts(style) {
  const fonts = new Set()
  for (const l of style.layers ?? []) {
    const f = l.layout?.['text-font']
    if (Array.isArray(f) && f.every((x) => typeof x === 'string')) fonts.add(f.join(','))
  }
  return [...fonts]
}

export async function prefetchMap(bbox, onProgress) {
  const margin = 0.01
  const box = [[bbox[0][0] - margin, bbox[0][1] - margin], [bbox[1][0] + margin, bbox[1][1] + margin]]
  const style = await (await fetch(MAP_STYLE_URL)).json()
  const urls = []
  for (const src of Object.values(style.sources ?? {})) {
    if (src.type !== 'vector' || !src.url) continue
    const tj = await (await fetch(src.url)).json()
    const maxZoom = Math.min(tj.maxzoom ?? 14, 14)
    for (const t of tileList(box, 10, maxZoom)) {
      urls.push(tj.tiles[0].replace('{z}', t.z).replace('{x}', t.x).replace('{y}', t.y))
    }
  }
  if (style.sprite) {
    const sprites = Array.isArray(style.sprite) ? style.sprite.map((s) => s.url) : [style.sprite]
    for (const s of sprites) urls.push(`${s}.json`, `${s}.png`, `${s}@2x.json`, `${s}@2x.png`)
  }
  if (style.glyphs) {
    for (const f of collectFonts(style)) {
      for (const range of ['0-255', '256-511', '8192-8447']) {
        urls.push(style.glyphs.replace('{fontstack}', encodeURIComponent(f)).replace('{range}', range))
      }
    }
  }

  let done = 0
  let failed = 0
  let index = 0
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (index < urls.length) {
      const url = urls[index++]
      try {
        const res = await fetch(url)
        if (!res.ok) failed++
      } catch {
        failed++
      }
      onProgress?.(++done, urls.length)
    }
  }))
  return { total: urls.length, failed }
}
