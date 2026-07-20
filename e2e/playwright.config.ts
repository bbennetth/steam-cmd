import { defineConfig, devices } from '@playwright/test'

// Drives the real built panel in mock mode (fake game/steamcmd/rest/backup
// services over a temp sandbox) — no LXC or real Palworld needed. The
// webServer builds the SPA and boots the Hono server serving it.
//
// NOTE: run locally (`npm run e2e`), not in a restricted sandbox — the
// server binds a TCP port.
const PORT = 18099
const ROOT = new URL('..', import.meta.url).pathname

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build --workspace=@steam-cmd/web && npx tsx apps/server/src/server.ts`,
    cwd: ROOT,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PANEL_MODE: 'mock',
      PANEL_PORT: String(PORT),
      PANEL_ADMIN_PASSWORD: 'e2e-password-1234',
      PANEL_PASSWORD_PEPPER: 'e2e-pepper-0123456789abcdef0123',
      COOKIE_SECURE: 'false',
      NODE_ENV: 'production',
      WEB_DIST_DIR: `${ROOT}/apps/web/dist`,
    },
  },
})
