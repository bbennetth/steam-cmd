import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { Db } from './client.js'

// Applies the drizzle-kit-generated SQL under apps/server/drizzle.
// Called at boot (server.ts) and by the provisioner; idempotent.
export function runMigrations(db: Db): void {
  const here = path.dirname(fileURLToPath(import.meta.url))
  // src/db → ../../drizzle (works from dist/db → ../../drizzle too, since
  // the folder is shipped alongside dist).
  const candidates = [
    path.resolve(here, '../../drizzle'),
    path.resolve(here, '../../../drizzle'),
  ]
  const migrationsFolder = candidates.find((p) => fs.existsSync(p))
  if (!migrationsFolder) {
    throw new Error(`drizzle migrations folder not found (looked in: ${candidates.join(', ')})`)
  }
  migrate(db, { migrationsFolder })
}
