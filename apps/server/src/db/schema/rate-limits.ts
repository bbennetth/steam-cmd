import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Fixed-window rate limiting (mirrors id-api's rate_limits pattern).
// One row per (bucket, key, window); stale windows are pruned lazily.
export const rateLimits = sqliteTable(
  'rate_limits',
  {
    bucket: text('bucket').notNull(),
    key: text('key').notNull(),
    windowStartMs: integer('window_start_ms').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.key] })],
)

export type RateLimitRow = typeof rateLimits.$inferSelect
