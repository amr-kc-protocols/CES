import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    // pptxgenjs has a Node-only branch that reads an image from disk or a URL
    // (`await import('node:fs' | 'node:https')`). Nothing in this app can
    // reach it — every image the deck embeds is already a base64 data URL —
    // but esbuild still has to resolve the specifiers to pre-bundle the
    // library, and cannot for a browser target. Left alone, that failure takes
    // down the dev server's whole dependency scan, not just this screen.
    //
    // So the two specifiers are answered with an empty module. Pre-bundling
    // itself must stay ON: pptxgenjs imports jszip as CommonJS, and served
    // un-bundled the browser rejects it for having no default export.
    include: ['pptxgenjs'],
    esbuildOptions: {
      plugins: [
        {
          name: 'cqmp-stub-node-builtins',
          setup(build) {
            build.onResolve({ filter: /^node:(fs|https)$/ }, () => ({
              path: 'cqmp-node-stub',
              namespace: 'cqmp-node-stub',
            }))
            build.onLoad({ filter: /.*/, namespace: 'cqmp-node-stub' }, () => ({
              contents: 'export default {}',
              loader: 'js',
            }))
          },
        },
      ],
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'AMR Kansas Academy — Clinical Education Suite',
        // Home-screen label. iOS truncates around a dozen characters, so the
        // full name goes in `name` and this stays short.
        short_name: 'AMR Academy',
        description:
          'New employee orientation, the AEMT program, field training checklists, FTO shifts, and CE tracking for AMR Kansas City and AMR Wichita',
        // Matches the masthead navy (--navy in src/index.css). This is what
        // iOS tints the status bar with, so a stale value shows as a seam
        // above the header on an installed device.
        theme_color: '#20395a',
        background_color: '#20395a',
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
        // The chart review tools (public/review, public/necessity) are vendored
        // static files, and each carries 2.2 MB of pdf.js + SheetJS in lib/.
        // Precaching pushes 4.4 MB to every device on first load; only admins
        // can open the tab. Excluded here and runtime-cached below instead, so
        // admins keep the offline behaviour and nobody else pays for it.
        globIgnores: ['**/node_modules/**/*', 'review/**/*', 'necessity/**/*'],
        runtimeCaching: [
          {
            urlPattern: /\/(review|necessity)\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ems-review-shell',
              // Application shell only — HTML, CSS, JS, the vendored libs. The
              // tool keeps chart data and reviews in IndexedDB, which the
              // Cache API never sees, so no PHI enters the HTTP cache.
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 90 },
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
        // The dotted-path rule is what keeps the tools working: an iframe load
        // is a navigation, so without it the fallback renders the whole CES
        // shell inside the Review tab. `/review/index.html` and
        // `/necessity/index.html` both carry an extension and are covered.
        //
        // Deliberately NOT a directory-wide `/^\/review\//` entry, tempting as
        // that is to state twice. `/review/necessity` is a real SPA route, and
        // denying the fallback for it would break navigating straight there
        // while offline — the one situation the service worker exists for.
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
          // The PowerPoint writer, in a chunk of its own. Only the CQMP deck
          // imports it, and only when Generate is pressed, so it stays out of
          // every other screen's payload. It IS precached with the rest of the
          // app (~120 KB gzipped) so an administrator can still build the
          // month's deck with no network — which is the point of a PWA.
          'pptx-vendor': ['pptxgenjs'],
        },
      },
    },
  },
})
