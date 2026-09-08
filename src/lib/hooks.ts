'use client'

import { useAuthStore } from '@/store/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCallback } from 'react'

export function useAuthFetch() {
  const token = useAuthStore(s => s.token)

  const fetcher = useCallback(async (url: string, options?: RequestInit) => {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}`, ...options?.headers },
    })
    if (res.status === 401) { useAuthStore.getState().logout(); throw new Error('Unauthorized') }
    if (!res.ok) { const data = await res.json().catch(() => ({ error: 'Request failed' })); throw new Error(data.error) }
    return res
  }, [token])

  return fetcher
}

export function useApiQuery<T>(key: string[], url: string, enabled = true) {
  const fetcher = useAuthFetch()
  return useQuery({
    queryKey: key,
    queryFn: () => fetcher(url).then(r => r.json() as Promise<T>),
    enabled: enabled && !!useAuthStore.getState().token,
  })
}

export function useApiMutation<T = any>(key: string[], method: 'POST' | 'PUT' | 'DELETE', url: string, invalidateKeys?: string[][]) {
  const fetcher = useAuthFetch()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data?: any) => {
      const res = await fetcher(url, { method, body: data ? JSON.stringify(data) : undefined })
      if (res.headers.get('content-type')?.includes('application/json')) return res.json()
      return { success: true }
    },
    onSuccess: () => {
      toast.success('Operation successful')
      if (invalidateKeys) invalidateKeys.forEach(k => qc.invalidateQueries({ queryKey: k }))
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
