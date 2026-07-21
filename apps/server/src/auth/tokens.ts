import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { PANEL_TOKEN_PREFIXES } from '@rallypoint-cmd/shared'

// Opaque bearer tokens (rallypoint convention): `<prefix><base64url(256-bit)>`,
// stored only as sha256 hex.

export function generateSessionToken(): string {
  return `${PANEL_TOKEN_PREFIXES.session}${randomBytes(32).toString('base64url')}`
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url')
}
