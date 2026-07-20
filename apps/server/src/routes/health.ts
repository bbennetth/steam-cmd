import { Hono } from 'hono'
import type { HonoApp } from '../context.js'

export const healthRoutes = new Hono<HonoApp>()

healthRoutes.get('/api/health', (c) =>
  c.json({ ok: true as const, version: c.get('env').PANEL_VERSION, mode: c.get('env').PANEL_MODE }),
)
