'use client'

import { useState } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, EmptyState, ErrorState } from '@/components/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Bell, BellOff, CheckCheck, RefreshCw, AlertTriangle, Megaphone, Wallet, Wifi, Wrench,
  CircleDollarSign, CalendarClock, Mail, CheckCircle2,
} from 'lucide-react'
import { timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const TYPE_META: Record<string, { icon: any; color: string; bg: string }> = {
  device_offline: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
  campaign_approved: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  campaign_rejected: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
  campaign_ending: { icon: CalendarClock, color: 'text-warning-foreground', bg: 'bg-warning/10' },
  payment_received: { icon: Wallet, color: 'text-success', bg: 'bg-success/10' },
  sim_data_warning: { icon: Wifi, color: 'text-warning-foreground', bg: 'bg-warning/10' },
  service_assigned: { icon: Wrench, color: 'text-info', bg: 'bg-info/10' },
  payout_processed: { icon: CircleDollarSign, color: 'text-success', bg: 'bg-success/10' },
  default: { icon: Bell, color: 'text-primary', bg: 'bg-primary/10' },
}

export function NotificationsView() {
  const { user } = useAuth()
  const role = user?.role
  const [filter, setFilter] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [busy, setBusy] = useState(false)

  const query = new URLSearchParams({
    read: filter === 'unread' ? 'false' : filter === 'read' ? 'true' : '',
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/notifications?${query}`, { refreshKey })

  if (!hasPermission(role, 'notifications.view')) {
    return (
      <div>
        <PageHeader title="Notifications" breadcrumbs={[{ label: 'Administration' }, { label: 'Notifications' }]} />
        <Card><CardContent><EmptyState icon={BellOff} title="No access" description="You don't have permission to view notifications" /></CardContent></Card>
      </div>
    )
  }

  const notifications = data?.notifications || []
  const unread = data?.unreadCount || 0

  const markRead = async (id: string) => {
    setBusy(true)
    try {
      await mutate('/api/notifications', 'POST', { notificationId: id })
      setRefreshKey((k) => k + 1)
    } catch (e: any) {
      toast.error(e.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const markAllRead = async () => {
    setBusy(true)
    try {
      const res = await mutate('/api/notifications', 'POST', { action: 'mark_all_read' })
      toast.success(`Marked ${res.updated} as read`)
      setRefreshKey((k) => k + 1)
    } catch (e: any) {
      toast.error(e.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `You have ${unread} unread notification${unread === 1 ? '' : 's'}` : 'All caught up'}
        breadcrumbs={[{ label: 'Administration' }, { label: 'Notifications' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)} disabled={busy}>
              <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} /> Refresh
            </Button>
            {unread > 0 && (
              <Button size="sm" className="gap-1.5" onClick={markAllRead} disabled={busy}>
                <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Notifications</SelectItem>
            <SelectItem value="unread">Unread Only</SelectItem>
            <SelectItem value="read">Read Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : notifications.length === 0 ? (
        <Card><CardContent><EmptyState icon={unread === 0 ? BellOff : Bell} title={unread === 0 ? 'No notifications' : 'No unread notifications'} description="You're all caught up" /></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => {
            const meta = TYPE_META[n.type] || TYPE_META.default
            return (
              <Card
                key={n.id}
                className={cn('transition-shadow hover:shadow-md', !n.read && 'border-l-4 border-l-primary')}
              >
                <CardContent className="p-3 flex items-start gap-3">
                  <div className={cn('grid place-items-center h-9 w-9 rounded-md shrink-0', meta.bg, meta.color)}>
                    <meta.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!n.read && <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/10">New</Badge>}
                        <span className="text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                    {!n.read && (
                      <Button size="sm" variant="ghost" className="gap-1.5 h-6 mt-2 px-2 text-xs" onClick={() => markRead(n.id)} disabled={busy}>
                        <CheckCheck className="h-3 w-3" /> Mark as read
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
