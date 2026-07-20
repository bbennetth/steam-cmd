import { Hono } from 'hono'
import { createScheduleRequestSchema, updateScheduleRequestSchema } from '@steam-cmd/shared'
import type { HonoApp } from '../context.js'
import { errors } from '../errors.js'
import { requireSession } from '../middleware/session.js'

export const scheduleRoutes = new Hono<HonoApp>()

scheduleRoutes.get('/api/schedules', requireSession, (c) => {
  return c.json({ schedules: c.get('services').scheduler.list() })
})

scheduleRoutes.post('/api/schedules', requireSession, async (c) => {
  const body = createScheduleRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) throw errors.validation({ issues: body.error.issues })
  const schedule = c.get('services').scheduler.create(body.data)
  c.get('logger').info('schedule created', { id: schedule.id, kind: schedule.kind })
  return c.json(schedule, 201)
})

scheduleRoutes.patch('/api/schedules/:id', requireSession, async (c) => {
  const body = updateScheduleRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) throw errors.validation({ issues: body.error.issues })
  try {
    return c.json(c.get('services').scheduler.update(c.req.param('id'), body.data))
  } catch {
    throw errors.notFound('Schedule')
  }
})

scheduleRoutes.delete('/api/schedules/:id', requireSession, (c) => {
  c.get('services').scheduler.remove(c.req.param('id'))
  return c.json({ ok: true as const })
})

scheduleRoutes.get('/api/schedules/:id/runs', requireSession, (c) => {
  return c.json({ runs: c.get('services').scheduler.runs(c.req.param('id')) })
})
