import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ServerLifecycle } from '@rallypoint-cmd/shared'
import { api, ApiError } from '../lib/api.js'
import { usePoll } from '../lib/usePoll.js'
import { formatBytes, formatUptime } from '../lib/format.js'
import { Badge, Button, Card, Spinner, Stat } from '../ui/primitives.js'

const LIFECYCLE: Record<ServerLifecycle, { tone: 'good' | 'bad' | 'warn' | 'muted'; label: string }> = {
  active: { tone: 'good', label: 'Running' },
  activating: { tone: 'warn', label: 'Starting' },
  deactivating: { tone: 'warn', label: 'Stopping' },
  inactive: { tone: 'muted', label: 'Stopped' },
  failed: { tone: 'bad', label: 'Failed' },
  not_installed: { tone: 'muted', label: 'Not installed' },
}

export function DashboardPage() {
  const { data: status, refresh } = usePoll(api.status, 3000)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function power(action: 'start' | 'stop' | 'restart') {
    setBusy(action)
    setErr(null)
    try {
      await api.power(action)
      await refresh()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  if (!status)
    return (
      <div className="flex items-center gap-2 text-panel-muted">
        <Spinner /> Loading status…
      </div>
    )

  const lc = LIFECYCLE[status.lifecycle]
  const running = status.lifecycle === 'active'
  const installed = status.lifecycle !== 'not_installed'
  const metrics = status.rest.metrics

  return (
    <div className="space-y-6">
      {status.pendingRestart && (
        <div className="flex items-center justify-between rounded-lg border border-panel-warn/40 bg-panel-warn/10 px-4 py-3 text-sm text-panel-warn">
          <span>Settings changed — restart the server to apply them.</span>
          <Button variant="warn" disabled={busy !== null} onClick={() => power('restart')}>
            Restart now
          </Button>
        </div>
      )}

      {!installed && (
        <Card title="Palworld is not installed">
          <div className="flex items-center justify-between">
            <p className="text-sm text-panel-muted">
              No dedicated server found on disk. Install it via SteamCMD to get started.
            </p>
            <Link to="/updates">
              <Button variant="primary">Install server</Button>
            </Link>
          </div>
        </Card>
      )}

      <Card
        title={
          <span className="flex items-center gap-3">
            Server
            <Badge tone={lc.tone}>
              {running && <span className="h-1.5 w-1.5 rounded-full bg-panel-good" />}
              {lc.label}
            </Badge>
          </span>
        }
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={!installed || running || busy !== null}
              onClick={() => power('start')}
            >
              {busy === 'start' ? <Spinner /> : '▶'} Start
            </Button>
            <Button
              variant="ghost"
              disabled={!running || busy !== null}
              onClick={() => power('restart')}
            >
              {busy === 'restart' ? <Spinner /> : '↻'} Restart
            </Button>
            <Button
              variant="danger"
              disabled={!running || busy !== null}
              onClick={() => power('stop')}
            >
              {busy === 'stop' ? <Spinner /> : '■'} Stop
            </Button>
          </div>
        }
      >
        {err && <p className="mb-3 text-sm text-panel-bad">{err}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Players"
            value={metrics ? `${metrics.currentplayernum}/${metrics.maxplayernum}` : '—'}
          />
          <Stat label="Server FPS" value={metrics ? metrics.serverfps : '—'} />
          <Stat
            label="Uptime"
            value={formatUptime(metrics?.uptime)}
            sub={status.rest.info?.version}
          />
          <Stat
            label="Memory"
            value={formatBytes(status.systemd.memoryCurrentBytes)}
            sub={`build ${status.buildId ?? '—'}`}
          />
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="World">
          <dl className="space-y-2 text-sm">
            <Row k="Name" v={status.rest.info?.servername ?? '—'} />
            <Row k="World ID" v={status.world.id ?? '—'} mono />
            <Row k="Version" v={status.rest.info?.version ?? '—'} />
            <Row k="systemd" v={`${status.systemd.activeState} / ${status.systemd.subState}`} />
            <Row k="REST API" v={status.rest.reachable ? 'reachable' : 'unreachable'} />
          </dl>
        </Card>

        <Card title="Storage">
          <div className="space-y-3">
            {status.disks.length === 0 && <p className="text-sm text-panel-muted">No disk data.</p>}
            {status.disks.map((d) => {
              const used = d.totalBytes - d.freeBytes
              const pct = d.totalBytes ? Math.round((used / d.totalBytes) * 100) : 0
              return (
                <div key={d.mount}>
                  <div className="mb-1 flex justify-between text-xs text-panel-muted">
                    <span>{d.label}</span>
                    <span>
                      {formatBytes(d.freeBytes)} free of {formatBytes(d.totalBytes)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-panel-surface-2">
                    <div
                      className={`h-full ${pct > 90 ? 'bg-panel-bad' : pct > 75 ? 'bg-panel-warn' : 'bg-panel-accent'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-panel-muted">{k}</dt>
      <dd className={`truncate text-right ${mono ? 'mono text-xs' : ''}`}>{v}</dd>
    </div>
  )
}
