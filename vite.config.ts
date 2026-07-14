import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/owl-192.svg', 'icons/owl-512.svg'],
      manifest: {
        name: 'Ausculto',
        short_name: 'Ausculto',
        description:
          'A free, open-source audiobook reader pairing LibriVox audio with Project Gutenberg text.',
        theme_color: '#1C1C1E',
        background_color: '#1C1C1E',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/owl-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/owl-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          {
            src: '/icons/owl-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Book text and alignments are cached at runtime, not precached —
        // precaching every chapter of 18 books would balloon the install.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        globIgnores: ['books/**', 'alignments/**'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Chapter text JSON served from our own origin
            urlPattern: /\/books\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ausculto-text',
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Cover images from Open Library / archive.org
            urlPattern: /^https:\/\/(covers\.openlibrary\.org|.*\.archive\.org|archive\.org)\/.*\.(jpg|jpeg|png)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ausculto-covers',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Streaming audio — cache what gets played so it replays offline.
            // Range requests are enabled so seeking works from cache.
            urlPattern: /^https:\/\/.*archive\.org\/.*\.mp3$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ausculto-audio',
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js', '@supabase/auth-ui-react', '@supabase/auth-ui-shared'],
        },
      },
    },
  },
});
