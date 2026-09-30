'use client'

import { useState, useEffect, useCallback } from 'react'

// LakhirAd data fetching hook — wraps fetch with loading/error states
export function useFetch<T>(url: string | null, options?: { refreshKey?: number }) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!!url)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!url) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    fetchData()
  }, [fetchData, options?.refreshKey])

  const refresh = useCallback(() => fetchData(), [fetchData])
  return { data, loading, error, refresh, setData }
}

// Mutate helper for POST/PUT/DELETE
export async function mutate(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST', body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`)
  }
  return json
}
