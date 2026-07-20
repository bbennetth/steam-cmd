import type { MiddlewareHandler } from 'hono'
import { ulid } from 'ulid'
import type { HonoApp } from '../context.js'

export const requestId: MiddlewareHandler<HonoApp> = async (c, next) => {
  const id = ulid()
  c.set('requestId', id)
  c.header('X-Request-Id', id)
  await next()
}
