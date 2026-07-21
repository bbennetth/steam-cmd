import { Hono } from 'hono'
import {
  announceRequestSchema,
  kickBanRequestSchema,
  unbanRequestSchema,
} from '@rallypoint-cmd/shared'
import type { HonoApp } from '../context.js'
import { errors } from '../errors.js'
import { requireSession } from '../middleware/session.js'

export const playerRoutes = new Hono<HonoApp>()

// Thin proxy over the Palworld REST API — the browser never reaches
// 8212 or sees AdminPassword. Upstream failures surface as 503.

function upstream(err: unknown): never {
  throw errors.upstreamUnavailable(err instanceof Error ? err.message : 'Palworld REST API error')
}

playerRoutes.get('/api/players', requireSession, async (c) => {
  const { palRest } = c.get('services')
  try {
    return c.json({ players: await palRest.players() })
  } catch (err) {
    upstream(err)
  }
})

playerRoutes.post('/api/players/announce', requireSession, async (c) => {
  const { palRest } = c.get('services')
  const body = announceRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) throw errors.validation({ issues: body.error.issues })
  try {
    await palRest.announce(body.data.message)
    return c.json({ ok: true as const })
  } catch (err) {
    upstream(err)
  }
})

playerRoutes.post('/api/players/kick', requireSession, async (c) => {
  const { palRest } = c.get('services')
  const body = kickBanRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) throw errors.validation({ issues: body.error.issues })
  try {
    await palRest.kick(body.data.userId, body.data.message)
    return c.json({ ok: true as const })
  } catch (err) {
    upstream(err)
  }
})

playerRoutes.post('/api/players/ban', requireSession, async (c) => {
  const { palRest } = c.get('services')
  const body = kickBanRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) throw errors.validation({ issues: body.error.issues })
  try {
    await palRest.ban(body.data.userId, body.data.message)
    return c.json({ ok: true as const })
  } catch (err) {
    upstream(err)
  }
})

playerRoutes.post('/api/players/unban', requireSession, async (c) => {
  const { palRest } = c.get('services')
  const body = unbanRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) throw errors.validation({ issues: body.error.issues })
  try {
    await palRest.unban(body.data.userId)
    return c.json({ ok: true as const })
  } catch (err) {
    upstream(err)
  }
})

playerRoutes.post('/api/save', requireSession, async (c) => {
  const { palRest } = c.get('services')
  try {
    await palRest.save()
    return c.json({ ok: true as const })
  } catch (err) {
    upstream(err)
  }
})
