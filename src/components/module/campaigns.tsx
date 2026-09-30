'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import {
  PageHeader, StatusBadge, EmptyState, ErrorState, TableSkeleton, Pagination, KpiCard,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Megaphone, Plus, Search, RefreshCw, ArrowLeft, Calendar, Clock, Wallet, Monitor,
  CheckCircle2, XCircle, PlayCircle, Pause, StopCircle, Send, History, Users,
  Film, MapPin, Layers, IndianRupee, Download,
} from 'lucide-react'
import { formatINR, formatNumber, formatDate, formatDateTime, timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = [
  'draft', 'submitted', 'under_review', 'approved', 'rejected',
  'payment_pending', 'scheduled', 'live', 'paused', 'completed', 'cancelled',
]
const PRIORITY_LABELS: Record<number, { label: string; cls: string }> = {
  1: { label: 'Emergency',  cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  2: { label: 'Government', cls: 'bg-warning/15 text-warning-foreground border-warning/30' },
  3: { label: 'Premium',    cls: 'bg-primary/15 text-primary border-primary/30' },
  4: { label: 'Standard',   cls: 'bg-info/15 text-info border-info/30' },
  5: { label: 'House',      cls: 'bg-muted text-muted-foreground border-border' },
}

export function CampaignsView() {
  const { openDetail, setView } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [advertiserFilter, setAdvertiserFilter] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const pageSize = 12

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search,
    status: statusFilter === 'all' ? '' : statusFilter,
    advertiserId: advertiserFilter === 'all' ? '' : advertiserFilter,
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/campaigns?${query}`, { refreshKey })
  const { data: advertisersData } = useFetch<any>('/api/advertisers?pageSize=100')

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setRefreshKey((k) => k + 1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const campaigns = data?.campaigns || []
  const total = data?.total || 0
  const liveCount = campaigns.filter((c: any) => c.status === 'live').length
  const pendingApproval = campaigns.filter((c: any) => ['submitted', 'under_review'].includes(c.status)).length
  const totalBudget = campaigns.reduce((s: number, c: any) => s + (c.budget || 0), 0)

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle={`${formatNumber(total)} campaigns across all advertisers`}
        breadcrumbs={[{ label: 'Advertising' }, { label: 'Campaigns' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              const params = new URLSearchParams({ status: statusFilter === 'all' ? '' : statusFilter, advertiserId: advertiserFilter === 'all' ? '' : advertiserFilter })
              window.location.href = `/api/export/campaigns?${params}`
              toast.success('Export started — check your downloads')
            }}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            {hasPermission(role, 'campaigns.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setView('campaign-wizard')}>
                <Plus className="h-3.5 w-3.5" /> New Campaign
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
        <KpiCard label="Total Campaigns" value={formatNumber(total)} icon={Megaphone} color="primary" />
        <KpiCard label="Live Now" value={formatNumber(liveCount)} icon={PlayCircle} color="success" />
        <KpiCard label="Pending Approval" value={formatNumber(pendingApproval)} icon={Clock} color="warning" />
        <KpiCard label="Total Budget" value={formatINR(totalBudget, true)} icon={Wallet} color="primary" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search campaigns..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={advertiserFilter} onValueChange={(v) => { setAdvertiserFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Advertiser" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Advertisers</SelectItem>
            {(advertisersData?.advertisers || []).map((a: any) => (
              <SelectItem key={a.id} value={a.id}>{a.organizationName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : campaigns.length === 0 ? (
        <Card><CardContent><EmptyState icon={Megaphone} title="No campaigns found" description="Try adjusting filters or create a new campaign via the wizard" /></CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Campaign</th>
                    <th className="text-left p-3 font-semibold">Advertiser</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">Priority</th>
                    <th className="text-left p-3 font-semibold">Date Range</th>
                    <th className="text-left p-3 font-semibold">Devices</th>
                    <th className="text-left p-3 font-semibold">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c: any) => (
                    <tr
                      key={c.id}
                      onClick={() => openDetail('campaign-detail', c.id)}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary shrink-0">
                            <Megaphone className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.playlistName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 truncate max-w-[180px]">{c.advertiserName}</td>
                      <td className="p-3"><StatusBadge status={c.status} /></td>
                      <td className="p-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', PRIORITY_LABELS[c.priority]?.cls)}>
                          {PRIORITY_LABELS[c.priority]?.label || `P${c.priority}`}
                        </span>
                      </td>
                      <td className="p-3 text-xs">
                        <p className="flex items-center gap-1"><Calendar className="h-3 w-3 text-muted-foreground" />{formatDate(c.startDate)}</p>
                        <p className="text-muted-foreground pl-4">→ {formatDate(c.endDate)}</p>
                      </td>
                      <td className="p-3 tabular-nums">{c.deviceCount}/{c.targetDeviceCount || c.deviceCount}</td>
                      <td className="p-3 font-medium tabular-nums">{formatINR(c.budget, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {campaigns.map((c: any) => (
              <Card key={c.id} onClick={() => openDetail('campaign-detail', c.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary shrink-0">
                        <Megaphone className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.advertiserName}</p>
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(c.startDate)}</span>
                    <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />{c.deviceCount} dev</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatINR(c.budget, true)}</span>
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

// ============ Campaign Detail (view='campaign-detail') ============

export function CampaignDetailView() {
  const { entityId, setView } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [tab, setTab] = useState('overview')
  const [refreshKey, setRefreshKey] = useState(0)
  const [rejectDialog, setRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [addDeviceDialog, setAddDeviceDialog] = useState(false)

  const { data, loading, error, refresh } = useFetch<any>(entityId ? `/api/campaigns/${entityId}` : null, { refreshKey })

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error) return <ErrorState message={error} onRetry={refresh} />
  if (!data?.campaign) return <EmptyState icon={Megaphone} title="Campaign not found" />

  const c = data.campaign
  const stats = c.playbackStats || { total: 0, avgCompletion: 0, statusCounts: {} }

  const sendAction = async (action: string, reason?: string) => {
    setActionLoading(action)
    try {
      await mutate(`/api/campaigns/${c.id}`, 'POST', { action, reason })
      toast.success(`Campaign ${action}d successfully`)
      setRefreshKey((k) => k + 1)
    } catch (e: any) { toast.error(e.message || 'Action failed') }
    finally { setActionLoading(null) }
  }

  const onRejectConfirm = async () => {
    if (!rejectReason) return toast.error('Reason is required to reject')
    setRejectDialog(false)
    await sendAction('reject', rejectReason)
    setRejectReason('')
  }

  const removeDevice = async (deviceId: string) => {
    try {
      await mutate(`/api/campaigns/${c.id}`, 'POST', { action: 'remove_device', deviceId })
      toast.success('Device removed')
      setRefreshKey((k) => k + 1)
    } catch (e: any) { toast.error(e.message || 'Failed to remove device') }
  }

  const addDevice = async (deviceId: string) => {
    try {
      await mutate(`/api/campaigns/${c.id}`, 'POST', { action: 'add_device', deviceId })
      toast.success('Device added')
      setAddDeviceDialog(false)
      setRefreshKey((k) => k + 1)
    } catch (e: any) { toast.error(e.message || 'Failed to add device') }
  }

  return (
    <div>
      <PageHeader
        title={c.name}
        subtitle={`${c.advertiser?.organization?.name || c.advertiser?.contactName} · ${formatINR(c.budget)} budget`}
        breadcrumbs={[
          { label: 'Campaigns', onClick: () => setView('campaigns') },
          { label: c.name },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setView('campaigns')}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            {/* Context-dependent action buttons */}
            {c.status === 'draft' && hasPermission(role, 'campaigns.edit') && (
              <Button size="sm" className="gap-1.5" disabled={actionLoading === 'submit'} onClick={() => sendAction('submit')}>
                <Send className="h-3.5 w-3.5" /> Submit for Approval
              </Button>
            )}
            {['submitted', 'under_review'].includes(c.status) && hasPermission(role, 'campaigns.approve') && (
              <>
                <Button size="sm" className="gap-1.5" disabled={actionLoading === 'approve'} onClick={() => sendAction('approve')}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setRejectDialog(true)}>
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </Button>
              </>
            )}
            {c.status === 'approved' && hasPermission(role, 'campaigns.publish') && (
              <Button size="sm" className="gap-1.5" disabled={actionLoading === 'publish'} onClick={() => sendAction('publish')}>
                <PlayCircle className="h-3.5 w-3.5" /> Publish
              </Button>
            )}
            {c.status === 'live' && hasPermission(role, 'campaigns.publish') && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={actionLoading === 'pause'} onClick={() => sendAction('pause')}>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={actionLoading === 'complete'} onClick={() => sendAction('complete')}>
                  <StopCircle className="h-3.5 w-3.5" /> Complete
                </Button>
              </>
            )}
            {!['cancelled', 'completed'].includes(c.status) && hasPermission(role, 'campaigns.edit') && (
              <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={actionLoading === 'cancel'} onClick={() => { if (confirm('Cancel this campaign?')) sendAction('cancel') }}>
                Cancel
              </Button>
            )}
          </>
        }
      />

      {c.rejectionReason && (
        <Card className="mb-4 border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 text-sm text-destructive">
            <strong>Rejection reason:</strong> {c.rejectionReason}
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="devices">Devices ({c.devices?.length || 0})</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="approval">Approval History</TabsTrigger>
          <TabsTrigger value="playback">Playback Stats</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Campaign Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Status" value={<StatusBadge status={c.status} />} />
                <Row label="Priority" value={<span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', PRIORITY_LABELS[c.priority]?.cls)}>{PRIORITY_LABELS[c.priority]?.label}</span>} />
                <Row label="Frequency" value={`${c.frequencyPerHour} plays/hr`} />
                <Row label="Playlist" value={c.playlist?.name || '—'} />
                <Row label="Created" value={formatDateTime(c.createdAt)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Budget & Spend</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Budget" value={<span className="tabular-nums">{formatINR(c.budget)}</span>} />
                <Row label="Price Quoted" value={<span className="tabular-nums">{formatINR(c.priceQuoted)}</span>} />
                <Row label="Amount Paid" value={<span className="tabular-nums text-success">{formatINR(c.amountPaid)}</span>} />
                <Row label="Outstanding" value={<span className="tabular-nums text-destructive">{formatINR(Math.max(0, c.priceQuoted - c.amountPaid))}</span>} />
                {c.invoices?.length > 0 && <Row label="Invoices" value={`${c.invoices.length} invoice(s)`} />}
              </CardContent>
            </Card>
          </div>

          {/* Targeting */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Targeting</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <TargetBox label="Target Cities" value={c.targetCities || '—'} icon={MapPin} />
              <TargetBox label="Target Zones" value={c.targetZones || '—'} icon={MapPin} />
              <TargetBox label="Target Devices" value={String(c.targetDeviceCount || c.devices?.length || 0)} icon={Monitor} />
              <TargetBox label="Selected Devices" value={String(c.devices?.length || 0)} icon={Users} />
            </CardContent>
          </Card>

          {/* Playlist preview */}
          {c.playlist && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4" /> Playlist: {c.playlist.name}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-60 overflow-y-auto">
                  {c.playlist.items?.map((item: any, i: number) => (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 text-sm">
                      <span className="text-xs font-bold text-muted-foreground w-6 tabular-nums">{i + 1}.</span>
                      <div className={cn(
                        'grid place-items-center h-8 w-12 rounded shrink-0 bg-gradient-to-br',
                        item.media?.type === 'video' ? 'from-primary/70 to-primary text-primary-foreground' : 'from-success/70 to-success text-success-foreground'
                      )}>
                        <Film className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.media?.name}</p>
                        <p className="text-xs text-muted-foreground">{item.durationSec}s · ×{item.frequency}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Devices */}
        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Assigned Devices ({c.devices?.length || 0})</CardTitle>
              {hasPermission(role, 'campaigns.edit') && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddDeviceDialog(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Device
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {c.devices?.length === 0 ? (
                <EmptyState icon={Monitor} title="No devices assigned" description="Add devices to this campaign" />
              ) : (
                <div className="divide-y">
                  {c.devices?.map((cd: any) => (
                    <div key={cd.id} className="flex items-center justify-between gap-3 p-3 hover:bg-accent/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary shrink-0">
                          <Monitor className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{cd.device.deviceId}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {cd.device.city?.name || '—'} · {cd.device.zone || '—'} · {cd.device.vehicle?.registrationNo || '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={cd.device.status} />
                        <Badge variant="outline" className="text-[10px] capitalize">{cd.status}</Badge>
                        {hasPermission(role, 'campaigns.edit') && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeDevice(cd.device.id)}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Campaign Schedule</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <Row label="Start Date" value={formatDate(c.startDate)} />
                <Row label="End Date" value={formatDate(c.endDate)} />
                <Row label="Daily Start Time" value={c.startTime || '—'} />
                <Row label="Daily End Time" value={c.endTime || '—'} />
                <Row label="Frequency / Hour" value={`${c.frequencyPerHour} plays`} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-2">Active Days</p>
                <div className="grid grid-cols-7 gap-1">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => {
                    const active = c.daysOfWeek ? c.daysOfWeek.split(',').map((s: string) => s.trim()).includes(String(i)) : true
                    return (
                      <div key={d} className={cn(
                        'text-center text-[11px] font-semibold py-1.5 rounded border',
                        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'
                      )}>{d[0]}</div>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{c.daysOfWeek ? 'Specific days selected' : 'Runs every day'}</p>
              </div>
            </CardContent>
          </Card>

          {c.schedules?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Schedule Blocks ({c.schedules.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {c.schedules.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(s.startDate)} → {formatDate(s.endDate)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{s.startTime} – {s.endTime}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Approval history */}
        <TabsContent value="approval" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Approval Timeline</CardTitle></CardHeader>
            <CardContent className="p-0">
              {c.approvalHistory?.length === 0 ? (
                <EmptyState icon={History} title="No history yet" />
              ) : (
                <div className="p-4 space-y-3">
                  {c.approvalHistory?.map((h: any, i: number) => (
                    <div key={h.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'grid place-items-center h-8 w-8 rounded-full border-2 shrink-0',
                          ['approve', 'publish', 'submit'].includes(h.action) ? 'bg-success/15 text-success border-success/40' :
                          ['reject', 'cancel', 'pause'].includes(h.action) ? 'bg-destructive/15 text-destructive border-destructive/40' :
                          'bg-muted text-muted-foreground border-border'
                        )}>
                          {['approve', 'publish'].includes(h.action) && <CheckCircle2 className="h-4 w-4" />}
                          {['reject', 'cancel'].includes(h.action) && <XCircle className="h-4 w-4" />}
                          {h.action === 'submit' && <Send className="h-4 w-4" />}
                          {h.action === 'pause' && <Pause className="h-4 w-4" />}
                          {h.action === 'complete' && <StopCircle className="h-4 w-4" />}
                          {!['approve', 'publish', 'submit', 'reject', 'cancel', 'pause', 'complete'].includes(h.action) && <History className="h-4 w-4" />}
                        </div>
                        {i < c.approvalHistory.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm capitalize">{h.action.replace('_', ' ')}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{h.note}</p>
                        {h.byUser && (
                          <p className="text-xs text-muted-foreground mt-1">by {h.byUser.name} ({h.byUser.role})</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Playback stats */}
        <TabsContent value="playback" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total Plays" value={formatNumber(stats.total)} icon={PlayCircle} color="primary" />
            <KpiCard label="Avg Completion" value={`${stats.avgCompletion?.toFixed(1) || 0}%`} icon={CheckCircle2} color="success" />
            <KpiCard label="Completed" value={formatNumber(stats.statusCounts?.completed || 0)} icon={CheckCircle2} color="success" />
            <KpiCard label="Failed" value={formatNumber(stats.statusCounts?.failed || 0)} icon={XCircle} color="destructive" />
          </div>

          {stats.total > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Completion Distribution</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: 'completed', label: 'Completed', color: 'bg-success' },
                  { key: 'partial', label: 'Partial', color: 'bg-warning' },
                  { key: 'failed', label: 'Failed', color: 'bg-destructive' },
                ].map(({ key, label, color }) => {
                  const count = stats.statusCounts?.[key] || 0
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>{label}</span>
                        <span className="text-muted-foreground tabular-nums">{count} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full', color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Recent Playback Events</CardTitle></CardHeader>
            <CardContent className="p-0">
              {c.playbackEvents?.length === 0 ? (
                <EmptyState icon={PlayCircle} title="No playback events yet" description="Events will appear once the campaign starts broadcasting" />
              ) : (
                <div className="divide-y max-h-96 overflow-y-auto">
                  {c.playbackEvents?.map((ev: any) => (
                    <div key={ev.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{ev.media?.name || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">{ev.device?.deviceId} · {ev.device?.city?.name || '—'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{timeAgo(ev.timestamp)}</p>
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          <Progress value={ev.completionPct} className="h-1.5 w-16" />
                          <span className="text-[10px] tabular-nums text-muted-foreground">{ev.completionPct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <StatusBadge status={ev.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {rejectDialog && (
        <Dialog open onOpenChange={setRejectDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reject Campaign</DialogTitle>
              <DialogDescription>Provide a reason for rejecting &ldquo;{c.name}&rdquo;. The advertiser will see this feedback.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Creative needs to be re-exported with proper safe area" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={onRejectConfirm} disabled={actionLoading === 'reject'}>Reject Campaign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {addDeviceDialog && (
        <AddDeviceDialog onClose={() => setAddDeviceDialog(false)} onAdd={addDevice} existingIds={(c.devices || []).map((cd: any) => cd.device.id)} />
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

function TargetBox({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="border rounded-md p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="font-medium truncate">{value}</p>
    </div>
  )
}

// ============ Add Device Dialog ============

function AddDeviceDialog({ onClose, onAdd, existingIds }: { onClose: () => void; onAdd: (deviceId: string) => void; existingIds: string[] }) {
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)

  const query = new URLSearchParams({
    pageSize: '50',
    search,
    city: cityFilter === 'all' ? '' : cityFilter,
  }).toString()
  const { data, loading } = useFetch<any>(`/api/devices?${query}`, { refreshKey })
  const { data: citiesData } = useFetch<any>('/api/cities')

  useEffect(() => {
    const t = setTimeout(() => setRefreshKey((k) => k + 1), 300)
    return () => clearTimeout(t)
  }, [search])

  const devices = (data?.devices || []).filter((d: any) => !existingIds.includes(d.id))

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Devices to Campaign</DialogTitle>
          <DialogDescription>Choose from online or warning devices</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search devices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="City" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {(citiesData?.cities || []).map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-[40vh] overflow-y-auto space-y-1">
          {loading ? <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div> :
           devices.length === 0 ? <div className="text-center py-8 text-sm text-muted-foreground">No devices available</div> :
           devices.map((d: any) => (
            <button
              key={d.id}
              onClick={() => onAdd(d.id)}
              className="w-full flex items-center gap-2 p-2 rounded-md border hover:bg-accent/50 text-left transition-colors"
            >
              <div className="grid place-items-center h-8 w-8 rounded bg-primary/10 text-primary shrink-0">
                <Monitor className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{d.deviceId}</p>
                <p className="text-xs text-muted-foreground truncate">{d.city} · {d.zone || '—'} · {d.vehicleReg}</p>
              </div>
              <StatusBadge status={d.status} />
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
