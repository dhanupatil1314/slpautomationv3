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
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Car, Plus, Search, RefreshCw, MapPin, User, Smartphone, Monitor, Wrench,
  PlayCircle, IndianRupee, Calendar, ArrowLeft, BadgeCheck, Truck,
} from 'lucide-react'
import { formatINR, formatNumber, formatDate, formatDateTime, timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['active', 'pending_installation', 'maintenance', 'suspended', 'inactive']
const VEHICLE_TYPES = [
  { value: 'auto_rickshaw', label: 'Auto Rickshaw' },
  { value: 'taxi', label: 'Taxi' },
  { value: 'bus', label: 'Bus' },
  { value: 'car', label: 'Car' },
]

export function VehiclesView() {
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
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
    vehicleType: typeFilter === 'all' ? '' : typeFilter,
    sortBy,
    sortOrder: 'desc',
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/vehicles?${query}`, { refreshKey })

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setRefreshKey((k) => k + 1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const vehicles = data?.vehicles || []
  const total = data?.total || 0

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle={`${formatNumber(total)} vehicles in network`}
        breadcrumbs={[{ label: 'Network' }, { label: 'Vehicles' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'vehicles.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Vehicle
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by registration, manufacturer, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {VEHICLE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt">Recently Updated</SelectItem>
            <SelectItem value="registrationNo">Registration No</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="vehicleType">Vehicle Type</SelectItem>
            <SelectItem value="installationDate">Install Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : vehicles.length === 0 ? (
        <Card><CardContent><EmptyState icon={Car} title="No vehicles found" description="Try adjusting filters or register a new vehicle" /></CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Registration</th>
                    <th className="text-left p-3 font-semibold">Type</th>
                    <th className="text-left p-3 font-semibold">City</th>
                    <th className="text-left p-3 font-semibold">Driver</th>
                    <th className="text-left p-3 font-semibold">Owner</th>
                    <th className="text-left p-3 font-semibold">Device</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v: any) => (
                    <tr
                      key={v.id}
                      onClick={() => setDetailId(v.id)}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="grid place-items-center h-8 w-8 rounded-md bg-primary/10 text-primary shrink-0">
                            <Car className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{v.registrationNo}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {v.manufacturer ? `${v.manufacturer} ${v.model || ''}`.trim() : '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 capitalize">{v.vehicleType.replace(/_/g, ' ')}</td>
                      <td className="p-3">
                        <p className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{v.city}</p>
                        <p className="text-xs text-muted-foreground">{v.zone || '—'}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-sm">{v.driverName}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-sm">{v.ownerName}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-sm font-mono">{v.deviceIdLabel}</p>
                        {v.deviceStatus && (
                          <p className="text-xs text-muted-foreground">
                            <StatusBadge status={v.deviceStatus} className="!px-1.5 !py-0 !text-[10px]" />
                          </p>
                        )}
                      </td>
                      <td className="p-3"><StatusBadge status={v.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {vehicles.map((v: any) => (
              <Card key={v.id} onClick={() => setDetailId(v.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary shrink-0">
                        <Car className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{v.registrationNo}</p>
                        <p className="text-xs text-muted-foreground truncate capitalize">
                          {v.vehicleType.replace(/_/g, ' ')} · {v.city}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><User className="h-3 w-3" /> {v.driverName}</div>
                    <div className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> {v.deviceIdLabel}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showAdd && (
        <AddVehicleDialog
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); setRefreshKey((k) => k + 1) }}
        />
      )}
      {detailId && (
        <VehicleDetailDialog vehicleId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}

function AddVehicleDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    registrationNo: '',
    vehicleType: 'auto_rickshaw',
    manufacturer: '',
    model: '',
    cityId: '',
    zone: '',
    ownerId: '',
    driverId: '',
    agreementStatus: 'pending',
    status: 'pending_installation',
  })
  const [loading, setLoading] = useState(false)
  const { data: cities } = useFetch<any>('/api/cities')
  const { data: ownersData } = useFetch<any>('/api/owners?pageSize=100')
  const { data: driversData } = useFetch<any>('/api/drivers?pageSize=100')

  const submit = async () => {
    if (!form.registrationNo) return toast.error('Registration number is required')
    setLoading(true)
    try {
      await mutate('/api/vehicles', 'POST', form)
      toast.success('Vehicle registered successfully')
      onCreated()
    } catch (e: any) {
      toast.error(e.message || 'Failed to register vehicle')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Vehicle</DialogTitle>
          <DialogDescription>Add a vehicle to the LakhirAd network</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Registration No *</Label>
              <Input value={form.registrationNo} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} placeholder="GJ06 AB 1234" />
            </div>
            <div>
              <Label>Vehicle Type</Label>
              <Select value={form.vehicleType} onValueChange={(v) => setForm({ ...form, vehicleType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="Bajaj" /></div>
            <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="RE" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>City</Label>
              <Select value={form.cityId} onValueChange={(v) => setForm({ ...form, cityId: v })}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>
                  {cities?.cities?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Zone</Label><Input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} placeholder="Alkapuri" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Owner</Label>
              <Select value={form.ownerId} onValueChange={(v) => setForm({ ...form, ownerId: v })}>
                <SelectTrigger><SelectValue placeholder="Assign owner" /></SelectTrigger>
                <SelectContent>
                  {ownersData?.owners?.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Driver</Label>
              <Select value={form.driverId} onValueChange={(v) => setForm({ ...form, driverId: v })}>
                <SelectTrigger><SelectValue placeholder="Assign driver" /></SelectTrigger>
                <SelectContent>
                  {driversData?.drivers?.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name} · {d.mobile}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Agreement Status</Label>
              <Select value={form.agreementStatus} onValueChange={(v) => setForm({ ...form, agreementStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="signed">Signed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Registering...' : 'Register Vehicle'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VehicleDetailDialog({ vehicleId, onClose }: { vehicleId: string; onClose: () => void }) {
  const { data, loading, error, refresh } = useFetch<any>(`/api/vehicles/${vehicleId}`, {})

  if (loading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
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
          <p className="text-sm text-destructive">{error || 'Vehicle not found'}</p>
          <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const v = data.vehicle
  const earnings = v.earningsSummary || {}

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            {v.registrationNo}
            <StatusBadge status={v.status} />
          </DialogTitle>
          <DialogDescription>
            {v.manufacturer ? `${v.manufacturer} ${v.model || ''}`.trim() : v.vehicleType.replace(/_/g, ' ')} · {v.city?.name || '—'} · {v.zone || '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Plays (30d)" value={formatNumber(earnings.playbackCount30d || 0)} icon={PlayCircle} />
          <StatTile label="Driver Earn (Total)" value={formatINR(earnings.driverEarnings?.reduce((a: number, e: any) => a + e.totalAmount, 0) || 0, true)} icon={IndianRupee} />
          <StatTile label="Owner Earn (Total)" value={formatINR(earnings.ownerEarnings?.reduce((a: number, e: any) => a + e.totalAmount, 0) || 0, true)} icon={IndianRupee} />
          <StatTile label="Installed" value={v.installationDate ? formatDate(v.installationDate) : '—'} icon={Calendar} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Driver / Owner / Device / Screen */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><User className="h-4 w-4" /> Driver & Owner</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm pt-0">
              <Row label="Driver" value={v.driver?.name || '—'} sub={v.driver?.mobile} />
              <Row label="Owner" value={v.owner?.name || '—'} sub={v.owner?.mobile} />
              <Row label="Agreement" value={<StatusBadge status={v.agreementStatus} />} />
              <Row label="Joining" value={v.driver?.joiningDate ? formatDate(v.driver.joiningDate) : '—'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><Smartphone className="h-4 w-4" /> Device & Screen</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm pt-0">
              <Row label="Device" value={v.device?.deviceId || '—'} sub={v.device?.status ? <StatusBadge status={v.device.status} /> : undefined} />
              <Row label="SIM" value={v.device?.sim?.operator || '—'} sub={v.device?.sim?.network} />
              <Row label="Screen" value={v.screen?.screenId || '—'} sub={v.screen ? `${v.screen.size || ''} ${v.screen.resolution || ''}`.trim() : undefined} />
              <Row label="Last Heartbeat" value={v.device?.lastHeartbeat ? timeAgo(v.device.lastHeartbeat) : '—'} />
            </CardContent>
          </Card>
        </div>

        {/* Recent playback */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><PlayCircle className="h-4 w-4" /> Recent Playback</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {v.playbackEvents?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No playback events recorded</p>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="space-y-1.5">
                  {v.playbackEvents?.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-accent/50 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{p.media?.name || 'Unknown creative'}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.campaign?.name || 'House ads'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{timeAgo(p.timestamp)}</p>
                        <StatusBadge status={p.status} className="!text-[10px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Earnings summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-1.5"><IndianRupee className="h-4 w-4" /> Earnings (Recent 6 months)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {(!earnings.driverEarnings?.length && !earnings.ownerEarnings?.length) ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No earnings records yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {earnings.driverEarnings?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Driver Earnings</p>
                    <div className="space-y-1.5">
                      {earnings.driverEarnings.map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs">{e.month}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatINR(e.totalAmount)}</span>
                            <StatusBadge status={e.status} className="!text-[10px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {earnings.ownerEarnings?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Owner Earnings</p>
                    <div className="space-y-1.5">
                      {earnings.ownerEarnings.map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs">{e.month}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatINR(e.totalAmount)}</span>
                            <StatusBadge status={e.status} className="!text-[10px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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

function StatTile({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
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
