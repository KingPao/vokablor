import { defineConfig, devices } from '@playwright/test';

// `http://localhost` is treated as a secure context by browsers (service workers work),
// so E2E tests don't need self-signed TLS locally — production always goes through the
// Caddy/Traefik reverse proxy with real HTTPS (docker/Caddyfile), per plan.md.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      // Backend, pointed at the same throwaway MySQL instance the Vitest suite uses
      // (backend/tests/setup.ts) — offline.spec.ts needs real login/vocabulary calls.
      command: 'npm run dev',
      cwd: '../backend',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      env: {
        MYSQL_HOST: '127.0.0.1',
        MYSQL_PORT: '3307',
        MYSQL_DATABASE: 'vokablor_test',
        MYSQL_USER: 'vokablor',
        MYSQL_PASSWORD: 'testpass',
        SESSION_SECRET: 'e2e-session-secret-value-long-enough',
        API_KEY_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=',
        PORT: '3000',
        // Plain HTTP locally — see middleware/session.ts cookiesRequireHttps().
        COOKIE_SECURE: 'false',
      },
    },
    {
      command: 'npm run preview',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-android', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-ios', use: { ...devices['iPhone 14'] } },
  ],
});
