import { EventEmitter } from 'node:events'
import { ulid } from 'ulid'
import type { LongOp, LongOpKind } from '@steam-cmd/shared'
import type { OpSink } from './types.js'

const LINE_BUFFER_MAX = 1000

// Singleton runner for long operations (steamcmd install/update,
// restore). A POST triggers the op; SSE streams only subscribe. One op
// at a time — a second start() throws while one is running, which routes
// surface as 409.

export type LongOpEvent = 'line' | 'progress' | 'done'

export class LongOpConflictError extends Error {
  constructor(readonly running: LongOp) {
    super(`operation ${running.kind} is already running`)
    this.name = 'LongOpConflictError'
  }
}

export class LongOpRunner {
  private op: LongOp | null = null
  private lines: string[] = []
  private emitter = new EventEmitter()

  constructor() {
    // SSE subscribers come and go; don't warn at 11 tabs.
    this.emitter.setMaxListeners(100)
  }

  current(): LongOp | null {
    return this.op ? { ...this.op } : null
  }

  buffer(): readonly string[] {
    return this.lines
  }

  subscribe(event: LongOpEvent, cb: (payload: string | number | LongOp) => void): () => void {
    this.emitter.on(event, cb)
    return () => this.emitter.off(event, cb)
  }

  // Kicks off `fn` and returns the op record immediately; completion is
  // observed via the `done` event / current().
  start(kind: LongOpKind, fn: (sink: OpSink) => Promise<void>): LongOp {
    if (this.op?.status === 'running') throw new LongOpConflictError(this.op)
    const op: LongOp = {
      id: ulid(),
      kind,
      status: 'running',
      startedAtMs: Date.now(),
      finishedAtMs: null,
      progressPct: null,
      error: null,
    }
    this.op = op
    this.lines = []

    const sink: OpSink = {
      line: (text) => {
        this.lines.push(text)
        if (this.lines.length > LINE_BUFFER_MAX) this.lines.shift()
        this.emitter.emit('line', text)
      },
      progress: (pct) => {
        if (this.op) this.op.progressPct = Math.max(0, Math.min(100, pct))
        this.emitter.emit('progress', pct)
      },
    }

    void fn(sink)
      .then(() => {
        if (this.op) {
          this.op.status = 'succeeded'
          this.op.finishedAtMs = Date.now()
        }
      })
      .catch((err: unknown) => {
        if (this.op) {
          this.op.status = 'failed'
          this.op.finishedAtMs = Date.now()
          this.op.error = err instanceof Error ? err.message : String(err)
        }
      })
      .finally(() => {
        if (this.op) this.emitter.emit('done', { ...this.op })
      })

    return { ...op }
  }
}
