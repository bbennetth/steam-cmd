// Minimal structured logger — JSON lines to stdout, picked up by
// journald under systemd. No external sink.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
  child(fields: Record<string, unknown>): Logger
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export function buildLogger(minLevel: LogLevel = 'info', base: Record<string, unknown> = {}): Logger {
  const emit = (level: LogLevel, msg: string, fields?: Record<string, unknown>): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...base, ...fields })
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    // eslint-disable-next-line no-console
    else console.log(line)
  }
  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
    child: (fields) => buildLogger(minLevel, { ...base, ...fields }),
  }
}
