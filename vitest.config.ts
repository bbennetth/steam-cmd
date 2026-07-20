import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['{apps,packages}/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    pool: 'forks',
    maxWorkers: Number.isInteger(Number(process.env.VITEST_MAX_FORKS))
      ? Math.max(1, Number(process.env.VITEST_MAX_FORKS))
      : 4,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['apps/**/src/**', 'packages/**/src/**'],
    },
    testTimeout: 30_000,
  },
})
