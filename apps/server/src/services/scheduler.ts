import { Cron } from 'croner'
import { ulid } from 'ulid'
import { desc, eq } from 'drizzle-orm'
import type {
  BackupPayload,
  CreateScheduleRequest,
  RestartPayload,
  Schedule,
  ScheduleRun,
  UpdateScheduleRequest,
} from '@steam-cmd/shared'
import { backupPayloadSchema, restartPayloadSchema } from '@steam-cmd/shared'
import type { Db } from '../db/client.js'
import type { Env } from '../env.js'
import type { Logger } from '../logger.js'
import { backups, schedules, scheduleRuns } from '../db/schema/index.js'
import type { BackupService } from './backup.js'
import type { GameControl, PalRest } from './types.js'
import type { WorldLock } from './world-lock.js'

// Cron-driven restarts + backups. One in-process Cron per enabled row.
// Every job takes the world lock (blocking) so it queues behind manual
// ops instead of colliding; croner's protect:true stops overrun stacking.

interface SchedulerDeps {
  env: Env
  db: Db
  logger: Logger
  gameControl: GameControl
  palRest: PalRest
  backup: BackupService
  worldLock: WorldLock
}

export interface SchedulerService {
  start(): void
  stop(): void
  list(): Schedule[]
  create(req: CreateScheduleRequest): Schedule
  update(id: string, req: UpdateScheduleRequest): Schedule
  remove(id: string): void
  runs(scheduleId: string): ScheduleRun[]
}

export function createScheduler(deps: SchedulerDeps): SchedulerService {
  const { db, logger } = deps
  const jobs = new Map<string, Cron>()

  function rowToSchedule(row: typeof schedules.$inferSelect): Schedule {
    return {
      id: row.id,
      kind: row.kind,
      cron: row.cron,
      timezone: row.timezone,
      enabled: row.enabled,
      payload: row.payload as RestartPayload | BackupPayload,
      lastRunAtMs: row.lastRunAt?.getTime() ?? null,
      lastStatus: row.lastStatus ?? null,
      nextRunAtMs: row.nextRunAt?.getTime() ?? null,
      createdAtMs: row.createdAt.getTime(),
    }
  }

  async function runRestart(payload: RestartPayload): Promise<void> {
    const parsed = restartPayloadSchema.parse(payload)
    // Announce countdown (best-effort; skip if the game/REST is down).
    for (const step of [...parsed.announceSteps].sort((a, b) => b.secondsBefore - a.secondsBefore)) {
      try {
        await deps.palRest.announce(step.message)
      } catch {
        // game down — nothing to announce to.
      }
      await sleep(1000)
    }
    if (parsed.saveBeforeStop) {
      try {
        await deps.palRest.save()
      } catch {
        // cold restart is fine
      }
    }
    // systemctl restart is deterministic — systemd owns the bounce and a
    // clean unit exit won't false-trigger Restart=on-failure.
    await deps.gameControl.restart()
  }

  async function runBackup(payload: BackupPayload): Promise<void> {
    const parsed = backupPayloadSchema.parse(payload)
    await deps.backup.create('scheduled')
    pruneBackups(parsed)
  }

  function pruneBackups(payload: BackupPayload): void {
    const all = db.select().from(backups).orderBy(desc(backups.createdAt)).all()
    if (all.length === 0) return
    const keepIds = new Set<string>()
    // Always keep the most recent successful backup.
    keepIds.add(all[0]!.id)
    if (payload.retention.keepLast) {
      for (const b of all.slice(0, payload.retention.keepLast)) keepIds.add(b.id)
    }
    if (payload.retention.keepDays) {
      const cutoff = Date.now() - payload.retention.keepDays * 24 * 60 * 60 * 1000
      for (const b of all) if (b.createdAt.getTime() >= cutoff) keepIds.add(b.id)
    }
    for (const b of all) {
      if (!keepIds.has(b.id)) {
        try {
          deps.backup.delete(b.id)
        } catch (err) {
          logger.warn('retention prune failed', {
            id: b.id,
            err: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }
  }

  async function execute(scheduleId: string): Promise<void> {
    const row = db.select().from(schedules).where(eq(schedules.id, scheduleId)).get()
    if (!row || !row.enabled) return

    const runId = ulid()
    db.insert(scheduleRuns).values({ id: runId, scheduleId, startedAt: new Date() }).run()
    logger.info('schedule firing', { scheduleId, kind: row.kind })

    const release = await deps.worldLock.acquire(`schedule:${row.kind}:${scheduleId}`)
    let status: 'succeeded' | 'failed' = 'succeeded'
    let detail: string | null = null
    try {
      if (row.kind === 'restart') await runRestart(row.payload as RestartPayload)
      else await runBackup(row.payload as BackupPayload)
    } catch (err) {
      status = 'failed'
      detail = err instanceof Error ? err.message : String(err)
      logger.error('schedule run failed', { scheduleId, kind: row.kind, err: detail })
    } finally {
      release()
    }

    const now = new Date()
    db.update(scheduleRuns)
      .set({ finishedAt: now, status, detail })
      .where(eq(scheduleRuns.id, runId))
      .run()
    db.update(schedules)
      .set({ lastRunAt: now, lastStatus: status, nextRunAt: nextRunOf(scheduleId) })
      .where(eq(schedules.id, scheduleId))
      .run()
  }

  function schedule(row: typeof schedules.$inferSelect): void {
    unschedule(row.id)
    if (!row.enabled) return
    try {
      const job = new Cron(row.cron, { timezone: row.timezone, protect: true }, () => {
        void execute(row.id)
      })
      jobs.set(row.id, job)
      const next = job.nextRun()
      if (next) {
        db.update(schedules).set({ nextRunAt: next }).where(eq(schedules.id, row.id)).run()
      }
    } catch (err) {
      logger.error('invalid cron; schedule disabled', {
        id: row.id,
        cron: row.cron,
        err: err instanceof Error ? err.message : String(err),
      })
    }
  }

  function unschedule(id: string): void {
    jobs.get(id)?.stop()
    jobs.delete(id)
  }

  function nextRunOf(id: string): Date | null {
    return jobs.get(id)?.nextRun() ?? null
  }

  return {
    start() {
      for (const row of db.select().from(schedules).all()) schedule(row)
      logger.info('scheduler started', { jobs: jobs.size })
    },
    stop() {
      for (const job of jobs.values()) job.stop()
      jobs.clear()
    },
    list() {
      return db.select().from(schedules).orderBy(desc(schedules.createdAt)).all().map(rowToSchedule)
    },
    create(req) {
      const id = ulid()
      db.insert(schedules)
        .values({
          id,
          kind: req.kind,
          cron: req.cron,
          timezone: req.timezone,
          enabled: req.enabled,
          payload: req.payload,
        })
        .run()
      const row = db.select().from(schedules).where(eq(schedules.id, id)).get()!
      schedule(row)
      return rowToSchedule(db.select().from(schedules).where(eq(schedules.id, id)).get()!)
    },
    update(id, req) {
      const existing = db.select().from(schedules).where(eq(schedules.id, id)).get()
      if (!existing) throw new Error('schedule not found')
      db.update(schedules)
        .set({
          ...(req.cron !== undefined ? { cron: req.cron } : {}),
          ...(req.timezone !== undefined ? { timezone: req.timezone } : {}),
          ...(req.enabled !== undefined ? { enabled: req.enabled } : {}),
          ...(req.payload !== undefined ? { payload: req.payload } : {}),
        })
        .where(eq(schedules.id, id))
        .run()
      const row = db.select().from(schedules).where(eq(schedules.id, id)).get()!
      schedule(row)
      return rowToSchedule(row)
    },
    remove(id) {
      unschedule(id)
      db.delete(schedules).where(eq(schedules.id, id)).run()
    },
    runs(scheduleId) {
      return db
        .select()
        .from(scheduleRuns)
        .where(eq(scheduleRuns.scheduleId, scheduleId))
        .orderBy(desc(scheduleRuns.startedAt))
        .limit(50)
        .all()
        .map((r) => ({
          id: r.id,
          scheduleId: r.scheduleId,
          startedAtMs: r.startedAt.getTime(),
          finishedAtMs: r.finishedAt?.getTime() ?? null,
          status: r.status ?? null,
          detail: r.detail ?? null,
        }))
    },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
