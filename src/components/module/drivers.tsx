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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  User, Plus, Search, RefreshCw, Phone, Mail, MapPin, Car, IndianRupee,
  BadgeCheck, Star, Calendar,
} from 'lucide-react'
import { formatINR, formatNumber, formatDate, timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['active', 'suspended', 'inactive']
const KYC_OPTIONS = ['pending', 'verified', 'rejected']

export function DriversView() {
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [kycFilter, setKycFilter] = useState('all')
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
    kycStatus: kycFilter === 'all' ? '' : kycFilter,
    sortBy,
    sortOrder: 'desc',
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/drivers?${query}`, { refreshKey })

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setRefreshKey((k) => k + 1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const drivers = data?.drivers || []
  const total = data?.total || 0

  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle={`${formatNumber(total)} drivers registered`}
        breadcrumbs={[{ label: 'Network' }, { label: 'Drivers' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'drivers.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Driver
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, mobile, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={kycFilter} onValueChange={(v) => { setKycFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="KYC" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All KYC</SelectItem>
            {KYC_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
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
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="driverScore">Driver Score</SelectItem>
            <SelectItem value="joiningDate">Joining Date</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : drivers.length === 0 ? (
        <Card><CardContent><EmptyState icon={User} title="No drivers found" description="Try adjusting filters or register a new driver" /></CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Driver</th>
                    <th className="text-left p-3 font-semibold">City</th>
                    <th className="text-left p-3 font-semibold">Vehicle</th>
                    <th className="text-left p-3 font-semibold">KYC</th>
                    <th className="text-left p-3 font-semibold w-48">Driver Score</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d: any) => (
                    <tr
                      key={d.id}
                      onClick={() => setDetailId(d.id)}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={cn('text-xs', scoreBg(d.driverScore))}>
                              {initials(d.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{d.name}</p>
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {d.mobile}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{d.city}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-sm font-mono">{d.vehicleReg}</p>
                      </td>
                      <td className="p-3">
                        <StatusBadge status={d.kycStatus} />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Progress value={d.driverScore} className={cn('h-2 flex-1', scoreProgressClass(d.driverScore))} />
                          <span className={cn('text-xs font-semibold tabular-nums w-8 text-right', scoreTextClass(d.driverScore))}>
                            {Math.round(d.driverScore)}
                          </span>
                        </div>
                      </td>
                      <td className="p-3"><StatusBadge status={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {drivers.map((d: any) => (
              <Card key={d.id} onClick={() => setDetailId(d.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className={cn('text-xs', scoreBg(d.driverScore))}>{initials(d.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {d.mobile}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Car className="h-3 w-3" /> {d.vehicleReg}</div>
                    <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {d.city}</div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Progress value={d.driverScore} className={cn('h-2 flex-1', scoreProgressClass(d.driverScore))} />
                    <span className={cn('text-xs font-semibold tabular-nums', scoreTextClass(d.driverScore))}>
                      {Math.round(d.driverScore)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showAdd && (
        <AddDriverDialog
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); setRefreshKey((k) => k + 1) }}
        />
      )}
      {detailId && (
        <DriverDetailDialog driverId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}

function scoreBg(score: number) {
  if (score < 50) return 'bg-destructive/15 text-destructive'
  if (score < 75) return 'bg-warning/15 text-warning-foreground'
  return 'bg-success/15 text-success'
}
function scoreProgressClass(score: number) {
  if (score < 50) return '[&_[data-slot=progress-indicator]]:bg-destructive'
  if (score < 75) return '[&_[data-slot=progress-indicator]]:bg-warning'
  return '[&_[data-slot=progress-indicator]]:bg-success'
}
function scoreTextClass(score: number) {
  if (score < 50) return 'text-destructive'
  if (score < 75) return 'text-warning-foreground'
  return 'text-success'
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function AddDriverDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    email: '',
    city: '',
    kycStatus: 'pending',
    agreementStatus: 'pending',
    upiId: '',
    driverScore: 70,
    status: 'active',
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name || !form.mobile) return toast.error('Name and mobile are required')
    setLoading(true)
    try {
      await mutate('/api/drivers', 'POST', form)
      toast.success('Driver created successfully')
      onCreated()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create driver')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Driver</DialogTitle>
          <DialogDescription>Add a driver to the LakhirAd network</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Full Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rajesh Patel" /></div>
            <div><Label>Mobile *</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="+91 98765 43210" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="rajesh@example.com" /></div>
            <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Vadodara" /></div>
          </div>
          <div><Label>UPI ID</Label><Input value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} placeholder="rajesh@okhdfcbank" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>KYC Status</Label>
              <Select value={form.kycStatus} onValueChange={(v) => setForm({ ...form, kycStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KYC_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Agreement</Label>
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
                <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Initial Driver Score: {form.driverScore}</Label>
            <input
              type="range" min={0} max={100} value={form.driverScore}
              onChange={(e) => setForm({ ...form, driverScore: Number(e.target.value) })}
              className="w-full mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create Driver'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DriverDetailDialog({ driverId, onClose }: { driverId: string; onClose: () => void }) {
  const { data, loading, error, refresh } = useFetch<any>(`/api/drivers/${driverId}`, {})

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
          <p className="text-sm text-destructive">{error || 'Driver not found'}</p>
          <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const d = data.driver
  const score = d.driverScore

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className={cn('text-sm', scoreBg(score))}>{initials(d.name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span>{d.name}</span>
                <StatusBadge status={d.status} />
              </div>
              <p className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> {d.mobile}
                {d.email && <> · <Mail className="h-3 w-3 inline" /> {d.email}</>}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DetailStat label="Current Month" value={formatINR(d.earningsHistory?.find((e: any) => e.month === currentMonthStr())?.totalAmount || 0, true)} icon={IndianRupee} />
          <DetailStat label="Total Earnings" value={formatINR(d.totalEarnings || 0, true)} icon={IndianRupee} />
          <DetailStat label="Pending" value={formatINR(d.pendingEarnings || 0, true)} icon={IndianRupee} />
          <DetailStat label="Joined" value={d.joiningDate ? formatDate(d.joiningDate) : '—'} icon={Calendar} />
        </div>

        {/* Driver score */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><Star className="h-4 w-4" /> Driver Score</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-3">
              <Progress value={score} className={cn('h-3 flex-1', scoreProgressClass(score))} />
              <span className={cn('text-2xl font-bold tabular-nums', scoreTextClass(score))}>{Math.round(score)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {score >= 75 ? 'Excellent — eligible for compliance bonus' : score >= 50 ? 'Average — needs improvement' : 'Below threshold — may affect payouts'}
            </p>
          </CardContent>
        </Card>

        {/* Assigned vehicles */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><Car className="h-4 w-4" /> Assigned Vehicle(s)</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {d.vehicles?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No vehicles assigned</p>
            ) : (
              <div className="space-y-1.5">
                {d.vehicles?.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-accent/50 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Car className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium font-mono truncate">{v.registrationNo}</p>
                        <p className="text-xs text-muted-foreground truncate capitalize">{v.vehicleType.replace(/_/g, ' ')} · {v.city?.name || '—'}</p>
                      </div>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Earnings history */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><IndianRupee className="h-4 w-4" /> Earnings History</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {d.earningsHistory?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No earnings records yet</p>
            ) : (
              <ScrollArea className="max-h-72">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Month</th>
                      <th className="text-right p-2 font-medium">Base</th>
                      <th className="text-right p-2 font-medium">Share</th>
                      <th className="text-right p-2 font-medium">Bonus</th>
                      <th className="text-right p-2 font-medium">Total</th>
                      <th className="text-right p-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.earningsHistory?.map((e: any) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="p-2 font-mono text-xs">{e.month}</td>
                        <td className="p-2 text-right tabular-nums">{formatINR(e.baseAmount, true)}</td>
                        <td className="p-2 text-right tabular-nums">{formatINR(e.revenueShare, true)}</td>
                        <td className="p-2 text-right tabular-nums">{formatINR(e.uptimeBonus + e.campaignBonus + e.complianceBonus, true)}</td>
                        <td className="p-2 text-right tabular-nums font-semibold">{formatINR(e.totalAmount, true)}</td>
                        <td className="p-2 text-right"><StatusBadge status={e.status} className="!text-[10px]" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Payouts */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><BadgeCheck className="h-4 w-4" /> Recent Payouts</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {d.payouts?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No payouts yet</p>
            ) : (
              <div className="space-y-1.5">
                {d.payouts?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-accent/50 text-sm">
                    <div>
                      <p className="font-mono text-xs">{p.payoutRef}</p>
                      <p className="text-xs text-muted-foreground">{p.month} · {timeAgo(p.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatINR(p.amount)}</p>
                      <StatusBadge status={p.status} className="!text-[10px]" />
                    </div>
                  </div>
                ))}
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

function DetailStat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="font-bold mt-1 truncate">{value}</p>
    </div>
  )
}

function currentMonthStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
