import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { PALWORLD_APP_ID } from '@steam-cmd/shared'
import type { Env } from '../env.js'
import type { Logger } from '../logger.js'
import type { OpSink, SteamCmd } from './types.js'
import { PAL_APP_MANIFEST } from './constants.js'

// Real SteamCMD driver. Progress lines look like:
//   Update state (0x61) downloading, progress: 42.17 (8842919 of 20971520)
const PROGRESS_RE = /progress:\s*(\d+(?:\.\d+)?)/
// Definitive per-app result lines — SteamCMD prints one of these:
//   Success! App '2394010' fully installed.
//   Error! App '2394010' state is 0x... after update job.
const SUCCESS_RE = /Success! App/i
const ERROR_RE = /Error! App/i

// SteamCMD's process exit code is notoriously unreliable: it can exit 0
// on a failed app update, and non-zero after a benign self-update. The
// per-app "Success!/Error!" line is authoritative, so prefer it and only
// fall back to the exit code when SteamCMD said nothing definitive.
// Pure + exported for unit testing.
export function decideSteamcmdOutcome(o: {
  code: number | null
  sawSuccess: boolean
  sawError: boolean
  lastErrorLine: string | null
}): { ok: true } | { ok: false; message: string } {
  if (o.sawError) return { ok: false, message: o.lastErrorLine ?? 'SteamCMD reported an error' }
  if (o.sawSuccess) return { ok: true }
  if (o.code === 0) return { ok: true }
  return { ok: false, message: `SteamCMD exited with code ${o.code} without reporting success` }
}

export function createRealSteamCmd(env: Env, logger: Logger): SteamCmd {
  return {
    run(kind, sink: OpSink): Promise<void> {
      return new Promise((resolve, reject) => {
        const args = [
          `+force_install_dir`,
          env.PAL_DIR,
          '+login',
          'anonymous',
          '+app_update',
          String(PALWORLD_APP_ID),
          ...(kind === 'validate' || kind === 'install' ? ['validate'] : []),
          '+quit',
        ]
        sink.line(`$ steamcmd ${args.join(' ')}`)
        const child = spawn(env.STEAMCMD_BIN, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: path.dirname(env.STEAMCMD_BIN),
        })
        let sawSuccess = false
        let sawError = false
        let lastErrorLine: string | null = null
        const wire = (stream: NodeJS.ReadableStream): void => {
          createInterface({ input: stream }).on('line', (line) => {
            sink.line(line)
            const m = line.match(PROGRESS_RE)
            if (m) sink.progress(Number(m[1]))
            if (SUCCESS_RE.test(line)) sawSuccess = true
            if (ERROR_RE.test(line)) {
              sawError = true
              lastErrorLine = line.trim()
            }
          })
        }
        wire(child.stdout)
        wire(child.stderr)
        child.on('error', (err) => {
          logger.error('steamcmd spawn failed', { err: err.message })
          reject(new Error(`steamcmd failed to start: ${err.message}`))
        })
        child.on('exit', (code) => {
          const outcome = decideSteamcmdOutcome({ code, sawSuccess, sawError, lastErrorLine })
          if (outcome.ok) {
            sink.progress(100)
            resolve()
          } else {
            logger.error('steamcmd failed', { code, message: outcome.message })
            reject(new Error(outcome.message))
          }
        })
      })
    },

    installedBuildId(): Promise<string | null> {
      try {
        const acf = fs.readFileSync(path.join(env.PAL_DIR, PAL_APP_MANIFEST), 'utf8')
        const m = acf.match(/"buildid"\s+"(\d+)"/)
        return Promise.resolve(m?.[1] ?? null)
      } catch {
        return Promise.resolve(null)
      }
    },
  }
}
