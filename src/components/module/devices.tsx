'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, StatusBadge, EmptyState, TableSkeleton, Pagination, ErrorState } from '@/components/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Monitor, Plus, Search, Download, RefreshCw, Filter, MoreVertical, Signal, Thermometer, HardDrive,
  MemoryStick, Clock, MapPin, Car, Power, AlertTriangle,
} from 'lucide-react'
import { formatINR, formatNumber, timeAgo, secondsToDuration } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['online', 'offline', 'warning', 'maintenance', 'suspended', 'decommissioned']

export function DevicesView() {
  const { openDetail } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('lastHeartbeat')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const pageSize = 15

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search,
    status: statusFilter === 'all' ? '' : statusFilter,
    sortBy,
    sortOrder: 'desc',
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/devices?${query}`, { refreshKey })

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setRefreshKey((k) => k + 1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const devices = data?.devices || []
  const total = data?.total || 0
  const allSelected = devices.length > 0 && selected.size === devices.length

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(devices.map((d: any) => d.id)))
  }

  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleBulkAction = async (action: string) => {
    if (selected.size === 0) return toast.error('Select devices first')
    toast.success(`${action} queued for ${selected.size} device(s)`)
    setSelected(new Set())
  }

  const handleExport = async () => {
    toast.loading('Exporting devices...', { id: 'export' })
    try {
      const params = new URLSearchParams({ search, status: statusFilter === 'all' ? '' : statusFilter })
      window.location.href = `/api/export/devices?${params}`
      toast.success('Export started — check your downloads', { id: 'export' })
    } catch (e: any) {
      toast.error(e.message || 'Export failed', { id: 'export' })
    }
  }

  return (
    <div>
      <PageHeader
        title="Devices"
        subtitle={`${formatNumber(total)} devices in network`}
        breadcrumbs={[{ label: 'Network' }, { label: 'Devices' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleExport()}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            {hasPermission(role, 'devices.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Device
              </Button>
            )}
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by device ID, serial, IMEI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="lastHeartbeat">Last Heartbeat</SelectItem>
            <SelectItem value="deviceId">Device ID</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="installationDate">Install Date</SelectItem>
            <SelectItem value="temperature">Temperature</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2.5 rounded-md bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex-1" />
          {hasPermission(role, 'devices.command') && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleBulkAction('Restart')}><Power className="h-3.5 w-3.5" /> Restart</Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleBulkAction('Sync')}><RefreshCw className="h-3.5 w-3.5" /> Sync</Button>
            </>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleBulkAction('Export')}><Download className="h-3.5 w-3.5" /> Export</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : devices.length === 0 ? (
        <Card><CardContent><EmptyState icon={Monitor} title="No devices found" description="Try adjusting filters or add a new device" /></CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="w-10 p-3"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></th>
                    <th className="text-left p-3 font-semibold">Device</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">Vehicle</th>
                    <th className="text-left p-3 font-semibold">City</th>
                    <th className="text-left p-3 font-semibold">Health</th>
                    <th className="text-left p-3 font-semibold hidden lg:table-cell">Content Sync</th>
                    <th className="text-left p-3 font-semibold">Last Heartbeat</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d: any) => (
                    <tr
                      key={d.id}
                      onClick={() => openDetail('device-detail', d.id)}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggleOne(d.id)} />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={cn('grid place-items-center h-8 w-8 rounded-md shrink-0', statusBg(d.status))}>
                            <Monitor className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{d.deviceId}</p>
                            <p className="text-xs text-muted-foreground truncate">{d.model || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3"><StatusBadge status={d.status} /></td>
                      <td className="p-3">
                        <p className="font-medium">{d.vehicleReg}</p>
                        <p className="text-xs text-muted-foreground">{d.driverName}</p>
                      </td>
                      <td className="p-3">
                        <p className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{d.city}</p>
                        <p className="text-xs text-muted-foreground">{d.zone || '—'}</p>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1" title="Signal"><Signal className="h-3 w-3 text-muted-foreground" />{d.signalStrength ?? '—'}%</span>
                          <span className="flex items-center gap-1" title="Temperature"><Thermometer className="h-3 w-3 text-muted-foreground" />{d.temperature ?? '—'}°C</span>
                          <span className="flex items-center gap-1" title="Storage"><HardDrive className="h-3 w-3 text-muted-foreground" />{d.storageUsage ?? '—'}%</span>
                        </div>
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        <SyncStatusBadge status={d.contentSyncStatus} />
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{timeAgo(d.lastHeartbeat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {devices.map((d: any) => (
              <Card key={d.id} onClick={() => openDetail('device-detail', d.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggleOne(d.id)} onClick={(e) => e.stopPropagation()} />
                      <div className={cn('grid place-items-center h-9 w-9 rounded-md shrink-0', statusBg(d.status))}>
                        <Monitor className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{d.deviceId}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.vehicleReg} · {d.city}</p>
                      </div>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Signal className="h-3 w-3" />{d.signalStrength ?? '—'}%</span>
                    <span className="flex items-center gap-1"><Thermometer className="h-3 w-3" />{d.temperature ?? '—'}°C</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(d.lastHeartbeat)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showAdd && <AddDeviceDialog onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); setRefreshKey((k) => k + 1) }} />}
    </div>
  )
}

function statusBg(status: string) {
  const map: Record<string, string> = {
    online: 'bg-success/15 text-success', offline: 'bg-destructive/15 text-destructive',
    warning: 'bg-warning/15 text-warning-foreground', maintenance: 'bg-muted text-muted-foreground',
    suspended: 'bg-destructive/15 text-destructive', decommissioned: 'bg-muted text-muted-foreground',
  }
  return map[status] || 'bg-muted text-muted-foreground'
}

// Content sync status badge — shows download-and-play sync state
function SyncStatusBadge({ status }: { status?: string }) {
  const s = status || 'synced'
  const map: Record<string, { label: string; color: string; dot: string }> = {
    synced: { label: 'Synced', color: 'text-success bg-success/10 border-success/20', dot: 'bg-success' },
    syncing: { label: 'Syncing', color: 'text-info bg-info/10 border-info/20', dot: 'bg-info animate-pulse' },
    pending: { label: 'Pending', color: 'text-warning-foreground bg-warning/10 border-warning/20', dot: 'bg-warning-foreground' },
    failed: { label: 'Failed', color: 'text-destructive bg-destructive/10 border-destructive/20', dot: 'bg-destructive' },
    offline: { label: 'Offline', color: 'text-muted-foreground bg-muted border-border', dot: 'bg-muted-foreground' },
  }
  const cfg = map[s] || map.synced
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border', cfg.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function AddDeviceDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ deviceId: '', serialNumber: '', imei: '', model: 'LakhirAd Player Pro', cityId: '', zone: '' })
  const [loading, setLoading] = useState(false)
  const { data: cities } = useFetch<any>('/api/cities')

  const submit = async () => {
    if (!form.deviceId || !form.serialNumber || !form.imei) return toast.error('Device ID, Serial and IMEI required')
    setLoading(true)
    try {
      await mutate('/api/devices', 'POST', form)
      toast.success('Device registered successfully')
      onCreated()
    } catch (e: any) {
      toast.error(e.message || 'Failed to register device')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register New Device</DialogTitle>
          <DialogDescription>Add a new media player to the network</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Device ID *</Label><Input value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} placeholder="LKD-0011" /></div>
            <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
          </div>
          <div><Label>Serial Number *</Label><Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="LKD-SN-XXXXXX" /></div>
          <div><Label>IMEI *</Label><Input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} placeholder="15-digit IMEI" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City</Label>
              <Select value={form.cityId} onValueChange={(v) => setForm({ ...form, cityId: v })}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>{cities?.cities?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Zone</Label><Input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} placeholder="Alkapuri" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Registering...' : 'Register Device'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
