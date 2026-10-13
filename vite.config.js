import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// Le dépôt calentour.github.io est un site d'organisation GitHub Pages :
// l'application est servie à la racine, la démo dans /demo/.
// VITE_BASE permet de publier la démo dans un sous-dossier (/demo/).
const BASE = process.env.VITE_BASE ?? '/'

// Mode "demo" : Firebase est remplacé par une base locale (src/demo) avec des
// données fictives. Sert de vitrine tant que Firebase n'est pas configuré.
export default defineConfig(({ mode }) => ({
  base: BASE,
  resolve: {
    alias: mode === 'demo'
      ? {
          'firebase/app': fileURLToPath(new URL('./src/demo/app.js', import.meta.url)),
          'firebase/auth': fileURLToPath(new URL('./src/demo/auth.js', import.meta.url)),
          'firebase/firestore': fileURLToPath(new URL('./src/demo/firestore.js', import.meta.url)),
        }
      : {},
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: mode === 'demo' ? 'CalenTour Démo' : 'CalenTour',
        short_name: mode === 'demo' ? 'CalenTour Démo' : 'CalenTour',
        description: 'Le suivi intelligent des tournées de calendriers.',
        lang: 'fr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#f4f5fa',
        theme_color: '#dc2626',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: `${BASE}index.html`,
        // L'application racine ne doit pas intercepter les pages de la démo.
        navigateFallbackDenylist: BASE === '/' ? [/^\/demo\//] : [],
        runtimeCaching: [
          {
            // Style, tuiles vectorielles, polices et sprites OpenFreeMap : la carte
            // déjà consultée reste affichable hors ligne.
            urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 5000, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: mode === 'demo'
          ? { maplibre: ['maplibre-gl'] }
          : { maplibre: ['maplibre-gl'], firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'] },
      },
    },
  },
}))
