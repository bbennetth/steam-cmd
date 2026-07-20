import { useCallback, useEffect, useRef, useState } from 'react'

// Poll an async fetcher on an interval, with manual refresh. Keeps the
// last good value while refetching so the UI doesn't flicker.
export function usePoll<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
): { data: T | null; error: Error | null; loading: boolean; refresh: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refresh = useCallback(async () => {
    try {
      setData(await fetcherRef.current())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void refresh()
    const t = setInterval(() => {
      if (active) void refresh()
    }, intervalMs)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [refresh, intervalMs])

  return { data, error, loading, refresh }
}
