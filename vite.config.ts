import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'KC Academy — Clinical Education Suite',
        short_name: 'KC Academy',
        description:
          'New employee orientation, the AEMT program, field training checklists, FTO shifts, and CE tracking for AMR Kansas City',
        theme_color: '#0b2e4f',
        background_color: '#0b2e4f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // The chart review tool (public/review) is vendored static files, and
        // lib/ alone is 2.2 MB of pdf.js + SheetJS. Precaching pushes that to
        // every device on first load; only admins can open the tab. Excluded
        // here and runtime-cached below instead, so admins keep the offline
        // behaviour and nobody else pays for it.
        globIgnores: ['**/node_modules/**/*', 'review/**/*'],
        runtimeCaching: [
          {
            urlPattern: /\/review\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ems-review-shell',
              // Application shell only — HTML, CSS, JS, the vendored libs. The
              // tool keeps chart data and reviews in IndexedDB, which the
              // Cache API never sees, so no PHI enters the HTTP cache.
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Don't SPA-fallback navigations to real files (slide decks etc.) —
        // without this the service worker serves index.html for /decks/*.pptx
        // and the router's catch-all lands on the dashboard. Mirrors the
        // dotted-path exclusion in vercel.json.
        // The /review/ entry is redundant against the dotted-path rule, but the
        // failure it prevents is bad enough to state twice: an iframe load is a
        // navigation, so a fallback there renders the whole CES shell inside
        // the Review tab.
        navigateFallbackDenylist: [/^\/decks\//, /^\/review\//, /\.[a-z0-9]+$/i],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Keep the framework in its own chunk so app-code changes don't force
        // returning users to re-download React/router across deploys.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
