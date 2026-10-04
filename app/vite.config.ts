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
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      // The static SEO pages (served from the same domain) must not be shadowed
      // by the SPA navigation fallback for installed-app users. Googlebot never
      // runs the service worker, so this only affects repeat human visitors.
      workbox: {
        navigateFallback: '/index.html',
        // Don't precache the ~107 static SEO pages (they're network-served, not
        // part of the app shell) — keeps the service worker small.
        globIgnores: [
          '**/dispensaries/**',
          '**/neighborhoods/**',
          '**/brands/**',
          '**/nyc/**',
          'sitemap.xml',
          'robots.txt',
        ],
        navigateFallbackDenylist: [
          /^\/dispensaries\//,
          /^\/neighborhoods\//,
          /^\/brands\//,
          /^\/nyc\//,
          /^\/sitemap\.xml$/,
          /^\/robots\.txt$/,
        ],
      },
      manifest: {
        name: 'Sensei — every menu, one sensei',
        short_name: 'Sensei',
        description: 'Every licensed dispensary menu, one calm place. Search by where you are.',
        theme_color: '#0B0B0C',
        background_color: '#F6F5F2',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
