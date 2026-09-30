'use client'

import { useState } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import {
  PageHeader, KpiCard, StatusBadge, EmptyState, TableSkeleton, Pagination, ErrorState,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  PlayCircle, CheckCircle2, XCircle, Activity, RefreshCw, Info, Calendar, Film, Monitor, Car,
} from 'lucide-react'
import { formatDateTime, formatNumber } from '@/lib/format'

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
]
const STATUS_OPTIONS = ['completed', 'partial', 'failed']

export function ProofOfPlayView() {
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [campaignFilter, setCampaignFilterRaw] = useState('all')
  const [deviceFilter, setDeviceFilterRaw] = useState('all')
  const [statusFilter, setStatusFilterRaw] = useState('all')
  const [range, setRangeRaw] = useState('7d')
  const [from, setFromRaw] = useState('')
  const [to, setToRaw] = useState('')
  // Reset page on filter changes — done in setters to avoid setState-in-effect lint
  const setCampaignFilter = (v: string) => { setCampaignFilterRaw(v); setPage(1) }
  const setDeviceFilter = (v: string) => { setDeviceFilterRaw(v); setPage(1) }
  const setStatusFilter = (v: string) => { setStatusFilterRaw(v); setPage(1) }
  const setRange = (v: string) => { setRangeRaw(v); setPage(1) }
  const setFrom = (v: string) => { setFromRaw(v); setPage(1) }
  const setTo = (v: string) => { setToRaw(v); setPage(1) }
  const [refreshKey, setRefreshKey] = useState(0)
  const pageSize = 15

  // Only fetch filter options once
  const { data: filterData } = useFetch<any>('/api/proof-of-play?page=1&pageSize=1', {})

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    campaignId: campaignFilter === 'all' ? '' : campaignFilter,
    deviceId: deviceFilter === 'all' ? '' : deviceFilter,
    status: statusFilter === 'all' ? '' : statusFilter,
    range,
    from,
    to,
  }).toString()
  const { data, loading, error, refresh } = useFetch<any>(`/api/proof-of-play?${query}`, { refreshKey })

  const events = data?.events || []
  const total = data?.total || 0
  const summary = data?.summary
  const campaigns = data?.filters?.campaigns || filterData?.filters?.campaigns || []
  const devices = data?.filters?.devices || filterData?.filters?.devices || []

  if (!hasPermission(role, 'proof_of_play.view')) {
    return (
      <div>
        <PageHeader title="Proof of Play" subtitle="Verified playback log" />
        <Alert><AlertDescription>You don't have permission to view Proof of Play.</AlertDescription></Alert>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Proof of Play"
        subtitle="Verified device-side playback events for billing and audit"
        breadcrumbs={[{ label: 'Analytics' }, { label: 'Proof of Play' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <Alert className="mb-4 border-info/30 bg-info/5">
        <Info className="h-4 w-4 text-info" />
        <AlertDescription className="text-xs">
          <strong>Verified Playback</strong> — These are confirmed play events reported by devices. They are <strong>not</strong> guaranteed human impressions; actual audience exposure may vary.
        </AlertDescription>
      </Alert>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard label="Total Verified Plays" value={formatNumber(summary.totalVerifiedPlays, true)} icon={PlayCircle} color="primary" />
          <KpiCard label="Completion Rate" value={`${summary.completionRate.toFixed(1)}%`} icon={CheckCircle2} color="success" hint={`${formatNumber(summary.completed)} completed`} />
          <KpiCard label="Failed Plays" value={formatNumber(summary.failed)} icon={XCircle} color="destructive" hint={`${formatNumber(summary.partial)} partial`} />
          <KpiCard label="Active Devices" value={formatNumber(summary.activeDevices)} icon={Activity} color="info" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-2 mb-4">
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-full lg:w-56"><SelectValue placeholder="All Campaigns" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={deviceFilter} onValueChange={setDeviceFilter}>
          <SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="All Devices" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Devices</SelectItem>
            {devices.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.code}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {range === 'custom' && (
          <>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full lg:w-40" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full lg:w-40" />
          </>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : events.length === 0 ? (
        <Card><CardContent><EmptyState icon={PlayCircle} title="No verified playback events" description="Try adjusting filters or date range" /></CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Timestamp</th>
                    <th className="text-left p-3 font-semibold">Campaign</th>
                    <th className="text-left p-3 font-semibold">Creative</th>
                    <th className="text-left p-3 font-semibold">Device / Vehicle</th>
                    <th className="text-left p-3 font-semibold">Duration</th>
                    <th className="text-left p-3 font-semibold">Completion</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e: any) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(e.timestamp)}</td>
                      <td className="p-3 font-medium truncate max-w-[200px]">{e.campaignName}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="grid place-items-center h-7 w-7 rounded bg-muted shrink-0">
                            <Film className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate max-w-[160px]">{e.creativeName}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{e.creativeType}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="flex items-center gap-1 text-xs"><Monitor className="h-3 w-3 text-muted-foreground" />{e.deviceCode}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Car className="h-3 w-3" />{e.vehicleReg}</p>
                      </td>
                      <td className="p-3 text-xs">{e.durationSec}s</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full ${e.completionPct >= 90 ? 'bg-success' : e.completionPct >= 50 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${e.completionPct}%` }} />
                          </div>
                          <span className="text-xs tabular-nums">{e.completionPct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="p-3"><StatusBadge status={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {events.map((e: any) => (
              <Card key={e.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{e.campaignName}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.creativeName}</p>
                    </div>
                    <StatusBadge status={e.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />{e.deviceCode}</span>
                    <span className="flex items-center gap-1"><Car className="h-3 w-3" />{e.vehicleReg}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{e.durationSec}s</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-muted-foreground">{formatDateTime(e.timestamp)}</span>
                    <span className="text-xs font-semibold tabular-nums">{e.completionPct.toFixed(0)}% complete</span>
                  </div>
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
