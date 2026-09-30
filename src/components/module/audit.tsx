'use client'

import { useState, useEffect } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, EmptyState, TableSkeleton, Pagination, ErrorState } from '@/components/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  History, Search, RefreshCw, Lock, ShieldAlert, User, Globe, Clock,
} from 'lucide-react'
import { formatDateTime, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

export function AuditView() {
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const pageSize = 50

  const query = new URLSearchParams({
    page: String(page), pageSize: String(pageSize),
    search, action: action === 'all' ? '' : action,
    startDate, endDate,
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/audit?${query}`, { refreshKey })

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setRefreshKey((k) => k + 1) }, 400)
    return () => clearTimeout(t)
  }, [search, action, startDate, endDate])

  if (!hasPermission(role, 'audit.view')) {
    return (
      <div>
        <PageHeader title="Audit Logs" breadcrumbs={[{ label: 'Administration' }, { label: 'Audit Logs' }]} />
        <Card><CardContent><EmptyState icon={Lock} title="Insufficient permissions" description="You don't have permission to view audit logs" /></CardContent></Card>
      </div>
    )
  }

  const logs = data?.logs || []
  const total = data?.total || 0
  const actionCounts = data?.actionCounts || []

  // Build action filter dropdown from observed actions
  const observedActions = actionCounts.map((a: any) => a.action)

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Immutable record of all sensitive system actions"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Audit Logs' }]}
        actions={
          <>
            <Badge variant="outline" className="gap-1 text-warning-foreground border-warning/30 bg-warning/10">
              <Lock className="h-3 w-3" /> Immutable
            </Badge>
            <button onClick={() => setRefreshKey((k) => k + 1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </>
        }
      />

      {/* Top action summary chips */}
      {actionCounts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {actionCounts.slice(0, 10).map((a: any) => (
            <button
              key={a.action}
              onClick={() => setAction(action === a.action ? 'all' : a.action)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                action === a.action
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card hover:bg-accent border-border'
              )}
            >
              <span className="capitalize">{a.action.replace(/_/g, ' ')}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1">{a.count}</Badge>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search action, entity, user..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Action Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {observedActions.map((a: string) => <SelectItem key={a} value={a} className="capitalize">{a.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full sm:w-40" />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full sm:w-40" />
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={10} cols={5} />
      ) : logs.length === 0 ? (
        <Card><CardContent><EmptyState icon={History} title="No audit logs found" description="Try adjusting filters" /></CardContent></Card>
      ) : (
        <>
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">User</th>
                    <th className="text-left p-3 font-semibold">Action</th>
                    <th className="text-left p-3 font-semibold">Entity</th>
                    <th className="text-left p-3 font-semibold">Details</th>
                    <th className="text-left p-3 font-semibold">IP</th>
                    <th className="text-left p-3 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l: any) => (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px] bg-primary/10 text-primary">{l.user?.[0]?.toUpperCase() || 'S'}</AvatarFallback></Avatar>
                          <div>
                            <p className="font-medium text-xs">{l.user}</p>
                            {l.userRole && <p className="text-[10px] text-muted-foreground capitalize">{l.userRole.replace(/_/g, ' ')}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px] capitalize gap-1">
                          {actionIcon(l.action)}{l.action.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs">
                        <p className="font-medium capitalize">{l.entity || '—'}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{l.entityId?.slice(-8) || ''}</p>
                      </td>
                      <td className="p-3 max-w-sm">
                        <p className="text-xs truncate text-muted-foreground">{l.details || '—'}</p>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground font-mono">{l.ipAddress || '—'}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        <p>{timeAgo(l.createdAt)}</p>
                        <p className="text-[10px]">{formatDateTime(l.createdAt)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="md:hidden space-y-2">
            {logs.map((l: any) => (
              <Card key={l.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="text-[10px] bg-primary/10 text-primary">{l.user?.[0]?.toUpperCase() || 'S'}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-xs truncate">{l.user}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(l.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] capitalize">{l.action.replace(/_/g, ' ')}</Badge>
                        <span className="text-[10px] text-muted-foreground capitalize">{l.entity}</span>
                      </div>
                    </div>
                  </div>
                  {l.details && <p className="text-xs text-muted-foreground mb-1">{l.details}</p>}
                  {l.ipAddress && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{l.ipAddress}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}

function actionIcon(action: string) {
  if (action.includes('login') || action.includes('logout')) return <User className="h-2.5 w-2.5" />
  if (action.includes('delete') || action.includes('remove')) return <ShieldAlert className="h-2.5 w-2.5" />
  return <Clock className="h-2.5 w-2.5" />
}
