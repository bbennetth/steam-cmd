import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Single-admin table (schema allows more for a future multi-user/SSO
// world; v1 seeds exactly one row).
export const admins = sqliteTable('admins', {
  id: text('id').primaryKey(), // ulid
  username: text('username').notNull().unique(),
  // `scrypt$N$r$p$salt$dk` (see auth/password.ts).
  secretHash: text('secret_hash').notNull(),
  // Pepper key version applied to secretHash.
  keyVersion: integer('key_version').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export type AdminRow = typeof admins.$inferSelect
export type AdminInsert = typeof admins.$inferInsert
