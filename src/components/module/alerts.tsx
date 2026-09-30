'use client'

import { useState } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, KpiCard, StatusBadge, EmptyState, TableSkeleton, Pagination, ErrorState } from '@/components/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertTriangle, AlertCircle, Info, Bell, CheckCheck, RefreshCw, Check, Monitor,
} from 'lucide-react'
import { formatDateTime, timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const TYPES = ['device_offline', 'high_temperature', 'low_storage', 'sim_data_warning', 'playback_failure']
const SEVERITIES = ['info', 'warning', 'critical']

const SEVERITY_META: Record<string, { icon: any; color: string; bg: string }> = {
  critical: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  warning: { icon: AlertTriangle, color: 'text-warning-foreground', bg: 'bg-warning/10' },
  info: { icon: Info, color: 'text-info', bg: 'bg-info/10' },
}

export function AlertsView() {
  const { openDetail } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [severity, setSeverity] = useState('all')
  const [type, setType] = useState('all')
  const [acknowledged, setAcknowledged] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const pageSize = 20

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    severity: severity === 'all' ? '' : severity,
    type: type === 'all' ? '' : type,
    acknowledged,
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/alerts?${query}`, { refreshKey })

  const alerts = data?.alerts || []
  const total = data?.total || 0
  const s = data?.summary

  const acknowledge = async (alertId: string) => {
    setBusy(true)
    try {
      await mutate('/api/alerts', 'POST', { alertId })
      toast.success('Alert acknowledged')
      setRefreshKey((k) => k + 1)
    } catch (e: any) {
      toast.error(e.message || 'Failed to acknowledge')
    } finally {
      setBusy(false)
    }
  }

  const acknowledgeAll = async () => {
    setBusy(true)
    try {
      const res = await mutate('/api/alerts', 'POST', { action: 'acknowledge_all' })
      toast.success(`Acknowledged ${res.acknowledged} alerts`)
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
        title="Alerts"
        subtitle="System-generated alerts from devices, SIMs, and playback"
        breadcrumbs={[{ label: 'Operations' }, { label: 'Alerts' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)} disabled={busy}>
              <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} /> Refresh
            </Button>
            {hasPermission(role, 'alerts.acknowledge') && s && s.unacknowledged > 0 && (
              <Button size="sm" className="gap-1.5" onClick={acknowledgeAll} disabled={busy}>
                <CheckCheck className="h-3.5 w-3.5" /> Ack All ({s.unacknowledged})
              </Button>
            )}
          </>
        }
      />

      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Critical" value={s.critical} icon={AlertCircle} color="destructive" />
          <KpiCard label="Warning" value={s.warning} icon={AlertTriangle} color="warning" />
          <KpiCard label="Info" value={s.info} icon={Info} color="info" />
          <KpiCard label="Unacknowledged" value={s.unacknowledged} icon={Bell} color="primary" />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Select value={severity} onValueChange={(v) => { setSeverity(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            {SEVERITIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={acknowledged} onValueChange={(v) => { setAcknowledged(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="false">Unacknowledged</SelectItem>
            <SelectItem value="true">Acknowledged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : alerts.length === 0 ? (
        <Card><CardContent><EmptyState icon={AlertTriangle} title="No alerts found" description="All clear — or adjust filters" /></CardContent></Card>
      ) : (
        <>
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Severity</th>
                    <th className="text-left p-3 font-semibold">Type</th>
                    <th className="text-left p-3 font-semibold">Message</th>
                    <th className="text-left p-3 font-semibold">Device</th>
                    <th className="text-left p-3 font-semibold">Created</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    {hasPermission(role, 'alerts.acknowledge') && <th className="text-right p-3 font-semibold">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a: any) => {
                    const meta = SEVERITY_META[a.severity]
                    return (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                        <td className="p-3">
                          <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold capitalize', meta.bg, meta.color)}>
                            <meta.icon className="h-3.5 w-3.5" />{a.severity}
                          </span>
                        </td>
                        <td className="p-3"><Badge variant="outline" className="capitalize text-[10px]">{a.type.replace(/_/g, ' ')}</Badge></td>
                        <td className="p-3 max-w-md"><p className="truncate">{a.message}</p></td>
                        <td className="p-3">
                          <button
                            onClick={() => a.deviceId !== '—' && openDetail('device-detail', a.deviceId)}
                            className="font-medium text-primary hover:underline"
                          >
                            {a.deviceId}
                          </button>
                          <p className="text-[10px] text-muted-foreground">{a.city}</p>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</td>
                        <td className="p-3">
                          {a.acknowledged ? (
                            <Badge variant="outline" className="text-success border-success/30 bg-success/10">Acknowledged</Badge>
                          ) : (
                            <Badge variant="outline" className="text-warning-foreground border-warning/30 bg-warning/10">Pending</Badge>
                          )}
                        </td>
                        {hasPermission(role, 'alerts.acknowledge') && (
                          <td className="p-3 text-right">
                            {!a.acknowledged && (
                              <Button size="sm" variant="ghost" className="gap-1.5 h-7" onClick={() => acknowledge(a.id)} disabled={busy}>
                                <Check className="h-3.5 w-3.5" /> Ack
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="md:hidden space-y-2">
            {alerts.map((a: any) => {
              const meta = SEVERITY_META[a.severity]
              return (
                <Card key={a.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn('grid place-items-center h-8 w-8 rounded-md', meta.bg, meta.color)}>
                          <meta.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold capitalize">{a.severity} · {a.type.replace(/_/g, ' ')}</p>
                          <p className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</p>
                        </div>
                      </div>
                      {a.acknowledged ? (
                        <Badge variant="outline" className="text-success border-success/30 bg-success/10 text-[10px]">Ack</Badge>
                      ) : (
                        <Badge variant="outline" className="text-warning-foreground border-warning/30 bg-warning/10 text-[10px]">Pending</Badge>
                      )}
                    </div>
                    <p className="text-sm">{a.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Monitor className="h-3 w-3" /> {a.deviceId} · {a.city}
                      </span>
                      {!a.acknowledged && hasPermission(role, 'alerts.acknowledge') && (
                        <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => acknowledge(a.id)} disabled={busy}>
                          <Check className="h-3.5 w-3.5" /> Acknowledge
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
