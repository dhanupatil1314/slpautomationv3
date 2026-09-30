'use client'

import { useApiQuery, useApiMutation } from '@/lib/hooks'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, CheckCheck, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { format } from 'date-fns'

const typeIcons: Record<string, any> = { INFO: Info, SUCCESS: CheckCircle2, WARNING: AlertTriangle, ERROR: XCircle }
const typeColors: Record<string, string> = { INFO: 'text-sky-600 bg-sky-50 dark:bg-sky-950/50', SUCCESS: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50', WARNING: 'text-orange-600 bg-orange-50 dark:bg-orange-950/50', ERROR: 'text-red-600 bg-red-50 dark:bg-red-950/50' }

export function NotificationsView() {
  const { data, isLoading, refetch } = useApiQuery<any>(['notifications'], '/api/notifications')
  const markRead = useApiMutation(['notifications'], 'PUT', '/api/notifications', [['notifications']])

  const handleMarkAll = () => markRead.mutate({ markAllRead: true })
  const handleMarkOne = (id: string) => markRead.mutate({ id })

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div><h1 className='text-2xl font-bold'>Notifications</h1><p className='text-muted-foreground text-sm'>{data?.unreadCount || 0} unread</p></div>
        {data?.unreadCount > 0 && <Button variant='outline' size='sm' onClick={handleMarkAll}><CheckCheck className='h-4 w-4 mr-2' />Mark all read</Button>}
      </div>
      <div className='space-y-2'>
        {isLoading ? Array.from({ length: 5 }).map((_, i) => <Card key={i}><CardContent className='p-4'><div className='h-4 bg-muted rounded animate-pulse' /></CardContent></Card>) : (data?.notifications || []).map((n: any) => {
          const Icon = typeIcons[n.type] || Info
          return (
            <Card key={n.id} className={`transition-colors ${!n.read ? 'border-l-2 border-l-primary' : 'opacity-70'}`}>
              <CardContent className='p-4'>
                <div className='flex items-start gap-3'>
                  <div className={`p-2 rounded-lg shrink-0 ${typeColors[n.type] || ''}`}><Icon className='h-4 w-4' /></div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center justify-between gap-2'>
                      <p className={`text-sm font-medium ${!n.read ? '' : 'text-muted-foreground'}`}>{n.title}</p>
                      <span className='text-xs text-muted-foreground whitespace-nowrap'>{format(new Date(n.createdAt), 'MMM d, HH:mm')}</span>
                    </div>
                    <p className='text-sm text-muted-foreground mt-0.5'>{n.message}</p>
                  </div>
                  {!n.read && <Button variant='ghost' size='icon' className='h-7 w-7 shrink-0' onClick={() => handleMarkOne(n.id)}><CheckCheck className='h-3.5 w-3.5' /></Button>}
                </div>
              </CardContent>
            </Card>
          )
        })}
        {!isLoading && !data?.notifications?.length && <Card className='p-8 text-center text-muted-foreground'><BellOff className='h-8 w-8 mx-auto mb-2 opacity-50' /><p>No notifications</p></Card>}
      </div>
    </div>
  )
}