import type { Context } from 'hono'
import { ZodError } from 'zod'
import type { HonoApp } from '../context.js'
import { isApiError } from '../errors.js'

// Converts thrown ApiError / ZodError into the standard envelope;
// anything else logs with the request id and returns a bland 500.
export function errorHandler(err: Error, c: Context<HonoApp>): Response {
  if (isApiError(err)) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      err.status,
    )
  }
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: 'validation_failed',
          message: 'Request failed validation.',
          details: { issues: err.issues },
        },
      },
      400,
    )
  }
  const logger = c.get('logger')
  logger?.error('unhandled error', {
    requestId: c.get('requestId'),
    path: c.req.path,
    err: err.message,
    stack: err.stack,
  })
  return c.json({ error: { code: 'internal_error', message: 'Internal error.' } }, 500)
}
