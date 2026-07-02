import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.{test,spec}.ts'],
    setupFiles: ['tests/unit/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      // src/pages/** are DOM-heavy integration surfaces (forms, routing, live API calls) —
      // exercised end-to-end by Playwright (tests/e2e/*.spec.ts) in a real browser, which is
      // stronger verification for this kind of code than a jsdom simulation would be.
      // src/main.ts is bootstrap wiring only, analogous to backend/src/api/app.ts's exclusion.
      exclude: ['src/pages/**', 'src/main.ts', 'src/vite-env.d.ts'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
