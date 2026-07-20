import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import type { HonoApp } from '../context.js'
import { errors } from '../errors.js'
import { hashToken } from '../auth/tokens.js'
import { sessions, admins } from '../db/schema/index.js'

// Touch lastSeenAt at most once per 5 minutes per session.
const TOUCH_INTERVAL_MS = 5 * 60 * 1000

export const requireSession: MiddlewareHandler<HonoApp> = async (c, next) => {
  const env = c.get('env')
  const db = c.get('db')

  const bearer = getCookie(c, env.SESSION_COOKIE_NAME)
  if (!bearer) throw errors.sessionRequired()

  const idHash = hashToken(bearer)
  const row = db
    .select({
      idHash: sessions.idHash,
      adminId: sessions.adminId,
      lastSeenAt: sessions.lastSeenAt,
      absoluteExpiresAt: sessions.absoluteExpiresAt,
      username: admins.username,
    })
    .from(sessions)
    .innerJoin(admins, eq(admins.id, sessions.adminId))
    .where(eq(sessions.idHash, idHash))
    .get()

  if (!row) throw errors.sessionRequired()
  const now = Date.now()
  if (row.absoluteExpiresAt.getTime() <= now) {
    db.delete(sessions).where(eq(sessions.idHash, idHash)).run()
    throw errors.sessionRequired()
  }

  if (now - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    db.update(sessions).set({ lastSeenAt: new Date(now) }).where(eq(sessions.idHash, idHash)).run()
  }

  c.set('session', {
    adminId: row.adminId,
    username: row.username,
    idHash,
    expiresAtMs: row.absoluteExpiresAt.getTime(),
  })
  await next()
}
