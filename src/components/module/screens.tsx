'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import {
  PageHeader, StatusBadge, EmptyState, TableSkeleton, Pagination, ErrorState,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Monitor, Plus, Search, RefreshCw, Smartphone, Sun, RotateCcw, Car, MapPin, User,
  Calendar, Ruler,
} from 'lucide-react'
import { formatNumber, formatDate, timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['active', 'inactive', 'maintenance', 'faulty']
const ORIENTATION_OPTIONS = ['landscape', 'portrait']

export function ScreensView() {
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [orientationFilter, setOrientationFilter] = useState('all')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const pageSize = 15

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search,
    status: statusFilter === 'all' ? '' : statusFilter,
    orientation: orientationFilter === 'all' ? '' : orientationFilter,
    sortBy,
    sortOrder: 'desc',
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/screens?${query}`, { refreshKey })

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setRefreshKey((k) => k + 1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const screens = data?.screens || []
  const total = data?.total || 0

  return (
    <div>
      <PageHeader
        title="Screens"
        subtitle={`${formatNumber(total)} screens deployed`}
        breadcrumbs={[{ label: 'Network' }, { label: 'Screens' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'screens.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Screen
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by screen ID, model, serial, manufacturer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={orientationFilter} onValueChange={(v) => { setOrientationFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Orientation" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orientations</SelectItem>
            {ORIENTATION_OPTIONS.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}
          </SelectContent>
        </Select>
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
            <SelectItem value="updatedAt">Recently Updated</SelectItem>
            <SelectItem value="screenId">Screen ID</SelectItem>
            <SelectItem value="model">Model</SelectItem>
            <SelectItem value="installationDate">Install Date</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : screens.length === 0 ? (
        <Card><CardContent><EmptyState icon={Monitor} title="No screens found" description="Try adjusting filters or register a new screen" /></CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Screen ID</th>
                    <th className="text-left p-3 font-semibold">Size / Resolution</th>
                    <th className="text-left p-3 font-semibold">Orientation</th>
                    <th className="text-left p-3 font-semibold w-40">Brightness</th>
                    <th className="text-left p-3 font-semibold">Vehicle</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {screens.map((s: any) => (
                    <tr
                      key={s.id}
                      onClick={() => setDetailId(s.id)}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="grid place-items-center h-8 w-8 rounded-md bg-primary/10 text-primary shrink-0">
                            <Monitor className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium font-mono truncate">{s.screenId}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.model || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="text-sm">{s.size || '—'}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s.resolution || '—'}</p>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 text-sm capitalize">
                          <RotateCcw className={cn('h-3 w-3 text-muted-foreground', s.orientation === 'portrait' && 'rotate-90')} />
                          {s.orientation}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Progress value={s.brightness} className="h-2 flex-1" />
                          <span className="text-xs tabular-nums w-8 text-right">{s.brightness}%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="text-sm font-mono">{s.vehicleReg}</p>
                        <p className="text-xs text-muted-foreground">{s.vehicleCity}</p>
                      </td>
                      <td className="p-3"><StatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {screens.map((s: any) => (
              <Card key={s.id} onClick={() => setDetailId(s.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary shrink-0">
                        <Monitor className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium font-mono truncate">{s.screenId}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.size || '—'} · {s.resolution || '—'}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 capitalize"><RotateCcw className={cn('h-3 w-3', s.orientation === 'portrait' && 'rotate-90')} /> {s.orientation}</div>
                    <div className="flex items-center gap-1"><Sun className="h-3 w-3" /> {s.brightness}%</div>
                    <div className="flex items-center gap-1"><Car className="h-3 w-3" /> {s.vehicleReg}</div>
                    <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.vehicleCity}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showAdd && (
        <AddScreenDialog
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); setRefreshKey((k) => k + 1) }}
        />
      )}
      {detailId && (
        <ScreenDetailDialog screenId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}

function AddScreenDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    screenId: '',
    model: '',
    size: '',
    resolution: '1920x1080',
    orientation: 'landscape',
    brightness: 80,
    manufacturer: '',
    serialNumber: '',
    warranty: '',
    status: 'active',
    vehicleId: '',
  })
  const [loading, setLoading] = useState(false)
  const { data: vehiclesData } = useFetch<any>('/api/vehicles?pageSize=100&status=active')

  const submit = async () => {
    if (!form.screenId) return toast.error('Screen ID is required')
    setLoading(true)
    try {
      await mutate('/api/screens', 'POST', form)
      toast.success('Screen registered successfully')
      onCreated()
    } catch (e: any) {
      toast.error(e.message || 'Failed to register screen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Screen</DialogTitle>
          <DialogDescription>Add a display screen to the inventory</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Screen ID *</Label><Input value={form.screenId} onChange={(e) => setForm({ ...form, screenId: e.target.value })} placeholder="SCR-0011" /></div>
            <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="LakhirAd Display 15.6" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Size</Label><Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder='15.6"' /></div>
            <div><Label>Resolution</Label><Input value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} placeholder="1920x1080" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="Samsung" /></div>
            <div><Label>Serial Number</Label><Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="SN-XXXXXXX" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Orientation</Label>
              <Select value={form.orientation} onValueChange={(v) => setForm({ ...form, orientation: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORIENTATION_OPTIONS.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Brightness: {form.brightness}%</Label>
              <input
                type="range" min={0} max={100} value={form.brightness}
                onChange={(e) => setForm({ ...form, brightness: Number(e.target.value) })}
                className="w-full mt-2"
              />
            </div>
          </div>
          <div><Label>Warranty</Label><Input value={form.warranty} onChange={(e) => setForm({ ...form, warranty: e.target.value })} placeholder="24 months" /></div>
          <div>
            <Label>Mount on Vehicle</Label>
            <Select value={form.vehicleId} onValueChange={(v) => setForm({ ...form, vehicleId: v })}>
              <SelectTrigger><SelectValue placeholder="Select vehicle (optional)" /></SelectTrigger>
              <SelectContent>
                {vehiclesData?.vehicles?.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.registrationNo} · {v.driverName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Registering...' : 'Register Screen'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScreenDetailDialog({ screenId, onClose }: { screenId: string; onClose: () => void }) {
  const { data, loading, error, refresh } = useFetch<any>(`/api/screens/${screenId}`, {})

  if (loading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="space-y-3 py-6">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-32 bg-muted animate-pulse rounded" />
            <div className="h-48 bg-muted animate-pulse rounded" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (error || !data) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Error</DialogTitle></DialogHeader>
          <p className="text-sm text-destructive">{error || 'Screen not found'}</p>
          <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const s = data.screen

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            <span className="font-mono">{s.screenId}</span>
            <StatusBadge status={s.status} />
          </DialogTitle>
          <DialogDescription>
            {s.manufacturer ? `${s.manufacturer} ` : ''}{s.model || 'Display'} · {s.size || '—'} · {s.resolution || '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DetailStat label="Size" value={s.size || '—'} icon={Ruler} />
          <DetailStat label="Orientation" value={<span className="capitalize">{s.orientation}</span>} icon={RotateCcw} />
          <DetailStat label="Brightness" value={`${s.brightness}%`} icon={Sun} />
          <DetailStat label="Installed" value={s.installationDate ? formatDate(s.installationDate) : '—'} icon={Calendar} />
        </div>

        {/* Specs */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Specifications</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm pt-0">
            <Row label="Manufacturer" value={s.manufacturer || '—'} />
            <Row label="Model" value={s.model || '—'} />
            <Row label="Serial Number" value={<span className="font-mono">{s.serialNumber || '—'}</span>} />
            <Row label="Resolution" value={<span className="font-mono">{s.resolution || '—'}</span>} />
            <Row label="Orientation" value={<span className="capitalize">{s.orientation}</span>} />
            <Row label="Brightness" value={`${s.brightness}%`} />
            <Row label="Warranty" value={s.warranty || '—'} />
          </CardContent>
        </Card>

        {/* Mounted vehicle */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><Car className="h-4 w-4" /> Mounted Vehicle</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {s.vehicle ? (
              <div className="space-y-2 text-sm">
                <Row label="Registration" value={<span className="font-mono">{s.vehicle.registrationNo}</span>} />
                <Row label="City" value={s.vehicle.city?.name || '—'} />
                <Row label="Driver" value={s.vehicle.driver?.name || '—'} sub={s.vehicle.driver?.mobile} />
                <Row label="Owner" value={s.vehicle.owner?.name || '—'} sub={s.vehicle.owner?.mobile} />
                {s.vehicle.device && (
                  <Row label="Device" value={<span className="font-mono">{s.vehicle.device.deviceId}</span>} sub={<StatusBadge status={s.vehicle.device.status} className="!text-[10px]" />} />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Not mounted on any vehicle</p>
            )}
          </CardContent>
        </Card>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailStat({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="font-bold mt-1 truncate">{value}</p>
    </div>
  )
}

function Row({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <div className="font-medium">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  )
}
