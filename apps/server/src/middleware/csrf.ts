import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { HonoApp } from '../context.js'
import { errors } from '../errors.js'
import { constantTimeEqual, generateCsrfToken } from '../auth/tokens.js'

// Double-submit CSRF: GET /api/csrf sets a JS-readable cookie and
// returns the token; every state-changing request must echo it in the
// X-CSRF-Token header. The session cookie being httpOnly + this check
// covers cross-site POSTs even where SameSite falls short.

export function csrfIssueHandler(c: Context<HonoApp>): Response {
  const env = c.get('env')
  let token = getCookie(c, env.CSRF_COOKIE_NAME)
  if (!token) {
    token = generateCsrfToken()
    setCookie(c, env.CSRF_COOKIE_NAME, token, {
      path: '/',
      sameSite: 'Lax',
      secure: env.COOKIE_SECURE,
      // NOT httpOnly — the SPA reads it to set the header.
      httpOnly: false,
      maxAge: 60 * 60 * 24,
    })
  }
  return c.json({ token })
}

export function requireCsrf(): MiddlewareHandler<HonoApp> {
  return async (c, next) => {
    const method = c.req.method.toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      await next()
      return
    }
    const env = c.get('env')
    const cookie = getCookie(c, env.CSRF_COOKIE_NAME)
    const header = c.req.header('x-csrf-token')
    if (!cookie || !header || !constantTimeEqual(cookie, header)) {
      throw errors.csrfInvalid()
    }
    await next()
  }
}
