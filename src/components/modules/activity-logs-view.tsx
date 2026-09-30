'use client'

import { useState } from 'react'
import { useApiQuery } from '@/lib/hooks'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

export function ActivityLogsView() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const qp = new URLSearchParams({ page: String(page), limit: '50' })
  if (search) qp.set('action', search)

  const { data, isLoading } = useApiQuery<any>(['activity-logs', page, search], `/api/activity-logs?${qp}`)

  const actionColors: Record<string, string> = {
    LOGIN: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400',
    CREATE_SCHEDULE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    UPDATE_SCHEDULE: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
    DELETE_SCHEDULE: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
    IMPORT_SCHEDULE: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400',
    EXPORT_SCHEDULE: 'bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-400',
  }

  return (
    <div className='space-y-4'>
      <div><h1 className='text-2xl font-bold'>Activity Logs</h1><p className='text-muted-foreground text-sm'>{data?.total || 0} recorded actions</p></div>
      <Card><CardContent className='p-4'><div className='relative max-w-sm'><Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' /><Input placeholder='Filter by action...' value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className='pl-9 h-9' /></div></CardContent></Card>
      <Card><CardContent className='p-0'>
        <div className='overflow-x-auto'><table className='w-full text-sm'>
          <thead><tr className='border-b border-border bg-muted/30'>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Timestamp</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground'>User</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Action</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell'>Entity</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell'>IP Address</th>
          </tr></thead>
          <tbody>
            {isLoading ? Array.from({ length: 10 }).map((_, i) => <tr key={i} className='border-b border-border/50'><td colSpan={5} className='py-4 px-4'><div className='h-4 bg-muted rounded animate-pulse' /></td></tr>) : (data?.logs || []).map((l: any) => (
              <tr key={l.id} className='border-b border-border/50 hover:bg-muted/20 transition-colors'>
                <td className='py-2.5 px-4 text-muted-foreground whitespace-nowrap text-xs'>{format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm')}</td>
                <td className='py-2.5 px-4'><div><p className='font-medium text-sm'>{l.user?.name}</p><p className='text-xs text-muted-foreground'>{l.user?.engineerCode}</p></div></td>
                <td className='py-2.5 px-4'><Badge variant='outline' className={`text-xs ${actionColors[l.action] || ''}`}>{l.action}</Badge></td>
                <td className='py-2.5 px-4 text-muted-foreground hidden md:table-cell'>{l.entity || '-'}</td>
                <td className='py-2.5 px-4 text-muted-foreground font-mono text-xs hidden lg:table-cell'>{l.ipAddress || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {!isLoading && !data?.logs?.length && <div className='py-12 text-center text-muted-foreground'>No activity logs found</div>}
        {data?.pages > 1 && (
          <div className='flex items-center justify-between px-4 py-3 border-t border-border'>
            <p className='text-sm text-muted-foreground'>Page {page} of {data.pages}</p>
            <div className='flex gap-1'><Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className='h-4 w-4' /></Button><Button variant='outline' size='sm' disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}><ChevronRight className='h-4 w-4' /></Button></div>
          </div>
        )}
      </CardContent></Card>
    </div>
  )
}