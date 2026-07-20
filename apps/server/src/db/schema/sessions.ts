import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { admins } from './admins.js'

// Panel sessions. The browser holds an opaque bearer (`pws_live_…`) in
// an httpOnly cookie; only sha256(bearer) is stored. This row shape is
// deliberately the same as rallypoint api-kit's app-session store so a
// future Rallypoint ID SSO login can reuse it (adding a sealed RPID
// bearer column) without touching the middleware.
export const sessions = sqliteTable('sessions', {
  idHash: text('id_hash').primaryKey(), // sha256(bearer) hex
  adminId: text('admin_id')
    .notNull()
    .references(() => admins.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  absoluteExpiresAt: integer('absolute_expires_at', { mode: 'timestamp_ms' }).notNull(),
})

export type SessionRow = typeof sessions.$inferSelect
export type SessionInsert = typeof sessions.$inferInsert
