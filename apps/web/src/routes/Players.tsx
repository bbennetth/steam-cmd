import { useState } from 'react'
import { api, ApiError } from '../lib/api.js'
import { usePoll } from '../lib/usePoll.js'
import { Badge, Button, Card, inputClass } from '../ui/primitives.js'

export function PlayersPage() {
  const { data, error, refresh } = usePoll(api.players, 5000)
  const [busy, setBusy] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')

  async function act(fn: () => Promise<unknown>, key: string) {
    setBusy(key)
    try {
      await fn()
      await refresh()
    } catch {
      /* surfaced via poll error / no-op */
    } finally {
      setBusy(null)
    }
  }

  const offline = error instanceof ApiError && error.status === 503

  return (
    <div className="space-y-6">
      <Card
        title="Broadcast"
        actions={
          <span className="text-xs text-panel-muted">{data ? `${data.players.length} online` : ''}</span>
        }
      >
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (announce.trim())
              void act(async () => {
                await api.announce(announce.trim())
                setAnnounce('')
              }, 'announce')
          }}
        >
          <input
            className={inputClass}
            placeholder="Message to all players…"
            value={announce}
            onChange={(e) => setAnnounce(e.target.value)}
          />
          <Button variant="primary" disabled={busy === 'announce' || !announce.trim()}>
            Send
          </Button>
        </form>
      </Card>

      <Card title="Players">
        {offline ? (
          <p className="text-sm text-panel-muted">Server is offline — player list unavailable.</p>
        ) : !data || data.players.length === 0 ? (
          <p className="text-sm text-panel-muted">No players online.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-panel-border text-left text-xs uppercase text-panel-muted">
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">Level</th>
                  <th className="pb-2 pr-3">Ping</th>
                  <th className="pb-2 pr-3">User ID</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((p) => (
                  <tr key={p.userId} className="border-b border-panel-border/50">
                    <td className="py-2 pr-3 font-medium">{p.name}</td>
                    <td className="py-2 pr-3">{p.level ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={(p.ping ?? 0) < 80 ? 'good' : 'warn'}>{p.ping ?? '—'} ms</Badge>
                    </td>
                    <td className="mono py-2 pr-3 text-xs text-panel-muted">{p.userId}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          disabled={busy === p.userId}
                          onClick={() => act(() => api.kick(p.userId), p.userId)}
                        >
                          Kick
                        </Button>
                        <Button
                          variant="danger"
                          disabled={busy === p.userId}
                          onClick={() => act(() => api.ban(p.userId), p.userId)}
                        >
                          Ban
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
