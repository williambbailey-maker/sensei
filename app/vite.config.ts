import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Head icons; the manifest icons are precached automatically.
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      // The static SEO pages (served from the same domain) must not be shadowed
      // by the SPA navigation fallback for installed-app users. Googlebot never
      // runs the service worker, so this only affects repeat human visitors.
      workbox: {
        // Cache version. Bump the suffix to make installed apps drop their
        // old precache (cleanupOutdatedCaches deletes it) and refetch, e.g.
        // when the app icon changes. v2: S-bullet icon set.
        cacheId: 'sensei-v2',
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // Don't precache the static SEO and legal pages (they're network-served, not
        // part of the app shell) — keeps the service worker small.
        globIgnores: [
          '**/dispensaries/**',
          '**/neighborhoods/**',
          '**/brands/**',
          '**/nyc/**',
          '**/terms/**',
          '**/privacy/**',
          '**/about/**',
          'sitemap.xml',
          'robots.txt',
        ],
        navigateFallbackDenylist: [
          /^\/dispensaries\//,
          /^\/neighborhoods\//,
          /^\/brands\//,
          /^\/nyc\//,
          /^\/terms\//,
          /^\/privacy\//,
          /^\/about\//,
          /^\/sitemap\.xml$/,
          /^\/robots\.txt$/,
        ],
      },
      manifest: {
        name: 'Sensei — every menu, one sensei',
        short_name: 'Sensei',
        description: 'Every licensed dispensary menu, one calm place. Search by where you are.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
