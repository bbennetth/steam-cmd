import { useEffect, useRef, useState } from 'react'
import type { LongOp } from '@steam-cmd/shared'
import { api, ApiError } from '../lib/api.js'
import { useSseUpdates } from '../lib/useEventSource.js'
import { Badge, Button, Card, Spinner } from '../ui/primitives.js'

export function UpdatesPage() {
  const [installedBuild, setInstalledBuild] = useState<string | null>(null)
  const [op, setOp] = useState<LongOp | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const running = op?.status === 'running'
  const { log, progress, done, reset } = useSseUpdates('/api/updates/stream', running)
  const logRef = useRef<HTMLDivElement>(null)

  async function refresh() {
    const s = await api.updateState()
    setInstalledBuild(s.installedBuildId)
    setOp(s.op)
  }
  useEffect(() => {
    void refresh()
  }, [])

  // When the stream signals done, refresh the installed build + op state.
  useEffect(() => {
    if (done) void refresh()
  }, [done])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log])

  async function run(kind: 'install' | 'update' | 'validate') {
    setErr(null)
    reset()
    try {
      setOp(await api.runUpdate(kind))
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to start')
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title="SteamCMD"
        actions={
          <span className="text-xs text-panel-muted">
            installed build {installedBuild ?? '—'}
          </span>
        }
      >
        {err && <p className="mb-3 text-sm text-panel-bad">{err}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={running} onClick={() => run(installedBuild ? 'update' : 'install')}>
            {running ? <Spinner /> : null} {installedBuild ? 'Update server' : 'Install server'}
          </Button>
          <Button variant="ghost" disabled={running} onClick={() => run('validate')}>
            Validate files
          </Button>
          {op && (
            <Badge
              tone={op.status === 'succeeded' ? 'good' : op.status === 'failed' ? 'bad' : 'warn'}
            >
              {op.kind}: {op.status}
            </Badge>
          )}
        </div>
        <p className="mt-3 text-xs text-panel-muted">
          Updates stop the server first, run <span className="mono">app_update 2394010 validate</span>,
          then restart it.
        </p>
      </Card>

      {(running || log.length > 0) && (
        <Card title="Progress">
          {progress != null && (
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-xs text-panel-muted">
                <span>Downloading…</span>
                <span>{progress.toFixed(1)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-panel-surface-2">
                <div className="h-full bg-panel-accent transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <div
            ref={logRef}
            className="thin-scroll max-h-80 overflow-auto rounded-lg bg-black/40 p-3"
          >
            <pre className="mono whitespace-pre-wrap break-words text-xs text-panel-text/90">
              {log.join('\n') || 'Waiting for output…'}
            </pre>
          </div>
        </Card>
      )}
    </div>
  )
}
