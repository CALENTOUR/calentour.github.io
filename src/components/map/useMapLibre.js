import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { DEFAULT_MAP_VIEW, MAP_STYLE_URL } from '../../config/constants'

const VIEW_KEY = 'calentour:lastView'

// Style de secours si le fond OpenStreetMap ne charge pas (hors ligne sans cache) :
// les secteurs et les adresses restent visibles et utilisables.
const FALLBACK_STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#1e293b' } }],
}

function readLastView() {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY)) ?? null
  } catch {
    return null
  }
}

// Ajoute des bâtiments 3D extrudés à partir des tuiles OpenStreetMap
// (couche "building" du schéma OpenMapTiles), si le style n'en a pas déjà.
function ensure3DBuildings(map) {
  const layers = map.getStyle().layers ?? []
  if (layers.some((l) => l.type === 'fill-extrusion')) return
  const vectorSource = Object.entries(map.getStyle().sources).find(([, s]) => s.type === 'vector')?.[0]
  if (!vectorSource) return
  const firstSymbol = layers.find((l) => l.type === 'symbol')?.id
  map.addLayer(
    {
      id: 'calentour-buildings-3d',
      type: 'fill-extrusion',
      source: vectorSource,
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': '#cbd5e1',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.75,
      },
    },
    firstSymbol,
  )
}

// Crée une carte MapLibre 3D (OpenStreetMap via OpenFreeMap) dans le conteneur
// donné et renvoie l'instance une fois le style chargé.
export function useMapLibre(containerRef, { rememberView = false, initialPoints = null, geolocate = true, flat = false, fitPadding = 40 } = {}) {
  const [map, setMap] = useState(null)
  const optionsRef = useRef({ rememberView, initialPoints, geolocate, flat, fitPadding })

  useEffect(() => {
    const { rememberView: remember, initialPoints: points, geolocate: withGps, flat: isFlat, fitPadding: padding } = optionsRef.current
    const last = remember ? readLastView() : null
    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: last?.center ?? DEFAULT_MAP_VIEW.center,
      zoom: last?.zoom ?? DEFAULT_MAP_VIEW.zoom,
      pitch: isFlat ? 0 : last?.pitch ?? 50,
      bearing: isFlat ? 0 : last?.bearing ?? -15,
      maxPitch: 75,
      attributionControl: { compact: true },
      dragRotate: true,
      touchPitch: true,
      fadeDuration: 0,
    })

    instance.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), 'top-right')
    if (withGps) {
      instance.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showAccuracyCircle: true,
        }),
        'top-right',
      )
    }
    instance.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')

    let ready = false
    const onReady = () => {
      if (ready) return
      ready = true
      clearTimeout(fallbackTimer)
      ensure3DBuildings(instance)
      if (!last && points?.length) fitPoints(instance, points, { padding, duration: 0 })
      setMap(instance)
    }
    const applyFallback = () => {
      if (ready) return
      instance.setStyle(FALLBACK_STYLE)
      instance.once('style.load', onReady)
    }
    const fallbackTimer = setTimeout(applyFallback, navigator.onLine ? 10000 : 3000)
    instance.on('load', onReady)
    instance.on('error', (e) => {
      // Une erreur avant le premier chargement = le style lui-même n'a pas pu être lu.
      if (!ready && !instance.isStyleLoaded()) {
        console.warn('Fond de carte indisponible, style de secours', e?.error)
        applyFallback()
      }
    })

    if (remember) {
      instance.on('moveend', () => {
        try {
          localStorage.setItem(
            VIEW_KEY,
            JSON.stringify({
              center: instance.getCenter().toArray(),
              zoom: instance.getZoom(),
              pitch: instance.getPitch(),
              bearing: instance.getBearing(),
            }),
          )
        } catch {
          // stockage indisponible (navigation privée) : on ignore
        }
      })
    }

    return () => {
      clearTimeout(fallbackTimer)
      setMap(null)
      instance.remove()
    }
  }, [containerRef])

  return map
}

// Crée ou met à jour une source GeoJSON.
export function setGeoJSON(map, id, data) {
  const source = map.getSource(id)
  if (source) source.setData(data)
  else map.addSource(id, { type: 'geojson', data })
}

export function toggle3D(map) {
  const is3D = map.getPitch() > 5
  map.easeTo({ pitch: is3D ? 0 : 55, bearing: is3D ? 0 : -15, duration: 600 })
  return !is3D
}

// Cadre la carte sur des points en gardant l'inclinaison et l'orientation en
// cours. MapLibre cadre comme si la carte était à plat : en 3D, le lointain
// rapetisse et le proche déborde. On corrige donc en mesurant où tombent les
// points à l'écran, quelques fois de suite, avant de lancer l'animation.
export function fitPoints(map, points, { padding = 40, maxZoom = 18, duration = 700 } = {}) {
  if (!map || !points?.length) return
  const pad = typeof padding === 'number' ? { top: padding, bottom: padding, left: padding, right: padding } : padding
  const { width, height } = map.getContainer().getBoundingClientRect()
  const box = { l: pad.left, t: pad.top, r: width - pad.right, b: height - pad.bottom }
  if (box.r - box.l < 40 || box.b - box.t < 40) return
  const start = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() }
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const [x, y] of points) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y) }
  const flatCam = map.cameraForBounds([[w, s], [e, n]], { padding: pad, bearing: start.bearing, maxZoom })
  if (!flatCam) return
  // Quelques centaines de points suffisent pour mesurer l'emprise à l'écran.
  const sample = points.length > 400 ? points.filter((_, i) => i % Math.ceil(points.length / 400) === 0) : points
  let cam = { center: flatCam.center, zoom: Math.min(flatCam.zoom, maxZoom) }
  try {
    for (let i = 0; i < 6; i++) {
      map.jumpTo({ ...cam, bearing: start.bearing, pitch: start.pitch })
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
      for (const q of sample) {
        const p = map.project(q)
        l = Math.min(l, p.x); r = Math.max(r, p.x); t = Math.min(t, p.y); b = Math.max(b, p.y)
      }
      const scale = Math.min((box.r - box.l) / Math.max(r - l, 1), (box.b - box.t) / Math.max(b - t, 1))
      const dx = (l + r) / 2 - (box.l + box.r) / 2
      const dy = (t + b) / 2 - (box.t + box.b) / 2
      const mid = map.project(map.getCenter())
      const center = map.unproject([mid.x + dx, mid.y + dy])
      const zoom = Math.min(maxZoom, cam.zoom + Math.log2(scale))
      const done = Math.abs(Math.log2(scale)) < 0.02 && Math.abs(dx) < 2 && Math.abs(dy) < 2
      cam = { center, zoom }
      if (done) break
    }
  } finally {
    map.jumpTo(start)
  }
  map.easeTo({ ...cam, bearing: start.bearing, pitch: start.pitch, duration })
}
