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
        name: 'AMR Clinical Education Suite',
        short_name: 'CES',
        description:
          'Kansas CE Deadline Tracker and New Hire Academy builder for AMR Clinical Education',
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
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Don't SPA-fallback navigations to real files (slide decks etc.) —
        // without this the service worker serves index.html for /decks/*.pptx
        // and the router's catch-all lands on the dashboard. Mirrors the
        // dotted-path exclusion in vercel.json.
        navigateFallbackDenylist: [/^\/decks\//, /\.[a-z0-9]+$/i],
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
