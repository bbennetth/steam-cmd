import { useEffect, useRef, useState } from 'react'

// Subscribe to an SSE endpoint. Buffers the last `max` lines of a given
// event name. Auto-reconnects (EventSource does this natively). `enabled`
// lets callers pause the stream (e.g. only stream the console tab when open).
export function useSseLines(
  url: string,
  eventName: string,
  opts: { enabled?: boolean; max?: number } = {},
): { lines: string[]; connected: boolean; clear: () => void } {
  const { enabled = true, max = 1000 } = opts
  const [lines, setLines] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const bufferRef = useRef<string[]>([])

  useEffect(() => {
    if (!enabled) return
    const es = new EventSource(url, { withCredentials: true })
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.addEventListener(eventName, (ev) => {
      const data = (ev as MessageEvent).data as string
      const next = [...bufferRef.current, data]
      if (next.length > max) next.splice(0, next.length - max)
      bufferRef.current = next
      setLines(next)
    })
    return () => es.close()
  }, [url, eventName, enabled, max])

  return {
    lines,
    connected,
    clear: () => {
      bufferRef.current = []
      setLines([])
    },
  }
}

// Generic multi-event SSE subscription for the updates stream (log +
// progress + done). Returns the latest of each.
export function useSseUpdates(url: string, enabled: boolean) {
  const [log, setLog] = useState<string[]>([])
  const [progress, setProgress] = useState<number | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const bufRef = useRef<string[]>([])

  useEffect(() => {
    if (!enabled) return
    setDone(null)
    const es = new EventSource(url, { withCredentials: true })
    const onLog = (ev: MessageEvent) => {
      const next = [...bufRef.current, ev.data as string]
      if (next.length > 2000) next.splice(0, next.length - 2000)
      bufRef.current = next
      setLog(next)
    }
    es.addEventListener('log', onLog as EventListener)
    es.addEventListener('progress', (ev) => setProgress(Number((ev as MessageEvent).data)))
    es.addEventListener('done', (ev) => setDone((ev as MessageEvent).data as string))
    return () => es.close()
  }, [url, enabled])

  return { log, progress, done, reset: () => {
    bufRef.current = []
    setLog([])
    setProgress(null)
    setDone(null)
  } }
}
