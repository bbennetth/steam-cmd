import fs from 'node:fs'
import path from 'node:path'
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import type { HonoApp } from '../context.js'

// Serves the built React SPA in production (WEB_DIST_DIR set). Static
// assets are served directly; any non-/api path falls back to index.html
// so client-side routes deep-link. Registered LAST so it never shadows
// /api/* or the SSE routes.
export function createSpaRoutes(webDistDir: string): Hono<HonoApp> {
  const app = new Hono<HonoApp>()
  const indexHtml = fs.readFileSync(path.join(webDistDir, 'index.html'), 'utf8')

  app.use(
    '/*',
    serveStatic({
      root: path.relative(process.cwd(), webDistDir) || '.',
      // serveStatic joins root + path; we only want it for real files.
    }),
  )

  // SPA fallback for client routes (not /api, not a real asset).
  app.get('/*', (c) => {
    if (c.req.path.startsWith('/api/')) return c.notFound()
    return c.html(indexHtml)
  })

  return app
}
