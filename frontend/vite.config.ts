import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const apiProxy = { '/api': { target: 'http://localhost:3000', changeOrigin: true } };

export default defineConfig({
  server: { proxy: apiProxy },
  // `vite preview` (used by Playwright E2E, playwright.config.ts) does not inherit
  // `server.proxy` — it needs its own entry to reach the backend.
  preview: { proxy: apiProxy },
  plugins: [
    VitePWA({
      // public/manifest.json is the canonical, hand-authored manifest (PWA Requirements in
      // plan.md); this plugin only adds the service worker + precache, not manifest generation.
      manifest: false,
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Vocabulary/progress review must work offline (Constitution Principle V); AI
        // speaking/conversation/reading-source calls stay network-only and fail with a
        // clear message (frontend/src/services/api-client.ts OfflineError).
        runtimeCaching: [
          {
            urlPattern: /^\/api\/(languages\/[^/]+\/vocabulary|languages\/[^/]+\/progress)/,
            handler: 'NetworkFirst',
            options: { cacheName: 'vokablor-vocabulary-progress' },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
});
