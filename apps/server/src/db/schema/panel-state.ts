import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Small key/value store for panel flags that outlive a process restart
// (pendingRestart, last-applied ini mtime, etc.).
export const panelState = sqliteTable('panel_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export type PanelStateRow = typeof panelState.$inferSelect
