import { useEffect, useState } from 'react'
import type { Schedule, ScheduleKind } from '@rallypoint-cmd/shared'
import { api, ApiError } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import { Badge, Button, Card, Field, inputClass } from '../ui/primitives.js'

export function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setSchedules((await api.schedules()).schedules)
  }
  useEffect(() => {
    void load()
  }, [])

  async function toggle(s: Schedule) {
    setBusy(s.id)
    try {
      await api.updateSchedule(s.id, { enabled: !s.enabled })
      await load()
    } finally {
      setBusy(null)
    }
  }
  async function remove(id: string) {
    if (!confirm('Delete this schedule?')) return
    setBusy(id)
    try {
      await api.deleteSchedule(id)
      await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Schedules">
        {err && <p className="mb-3 text-sm text-panel-bad">{err}</p>}
        {!schedules ? (
          <p className="text-panel-muted">Loading…</p>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-panel-muted">No schedules. Add one below.</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-panel-border bg-panel-surface-2 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Badge tone={s.kind === 'restart' ? 'warn' : 'good'}>{s.kind}</Badge>
                  <span className="mono text-sm">{s.cron}</span>
                  <span className="text-xs text-panel-muted">{s.timezone}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-panel-muted">
                  <span>next: {formatDateTime(s.nextRunAtMs)}</span>
                  <span>
                    last:{' '}
                    {s.lastStatus ? (
                      <Badge tone={s.lastStatus === 'succeeded' ? 'good' : s.lastStatus === 'failed' ? 'bad' : 'muted'}>
                        {s.lastStatus}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </span>
                  <Button variant="ghost" disabled={busy === s.id} onClick={() => toggle(s)}>
                    {s.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="danger" disabled={busy === s.id} onClick={() => remove(s.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <NewSchedule
        onCreated={async () => {
          setErr(null)
          await load()
        }}
        onError={setErr}
      />
    </div>
  )
}

function NewSchedule({
  onCreated,
  onError,
}: {
  onCreated: () => Promise<void>
  onError: (m: string) => void
}) {
  const [kind, setKind] = useState<ScheduleKind>('restart')
  const [cron, setCron] = useState('0 5 * * *')
  const [timezone, setTimezone] = useState('UTC')
  const [keepLast, setKeepLast] = useState(14)
  const [busy, setBusy] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (kind === 'restart') {
        await api.createSchedule({
          kind: 'restart',
          cron,
          timezone,
          enabled: true,
          payload: {
            saveBeforeStop: true,
            announceSteps: [
              { secondsBefore: 300, message: 'Server restart in 5 minutes.' },
              { secondsBefore: 60, message: 'Server restart in 1 minute!' },
            ],
          },
        })
      } else {
        await api.createSchedule({
          kind: 'backup',
          cron,
          timezone,
          enabled: true,
          payload: { retention: { keepLast } },
        })
      }
      await onCreated()
    } catch (e2) {
      onError(e2 instanceof ApiError ? e2.message : 'Failed to create schedule')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="New schedule">
      <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Type">
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as ScheduleKind)}>
            <option value="restart">Restart</option>
            <option value="backup">Backup</option>
          </select>
        </Field>
        <Field label="Cron (m h dom mon dow)">
          <input className={`${inputClass} mono`} value={cron} onChange={(e) => setCron(e.target.value)} />
        </Field>
        <Field label="Timezone">
          <input className={inputClass} value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </Field>
        {kind === 'backup' ? (
          <Field label="Keep last N">
            <input
              className={inputClass}
              type="number"
              min={1}
              value={keepLast}
              onChange={(e) => setKeepLast(parseInt(e.target.value || '1', 10))}
            />
          </Field>
        ) : (
          <div className="flex items-end text-xs text-panel-muted">
            Announces at T-5m and T-1m, saves, then restarts.
          </div>
        )}
        <div className="sm:col-span-2 lg:col-span-4">
          <Button variant="primary" disabled={busy}>
            Add schedule
          </Button>
        </div>
      </form>
    </Card>
  )
}
