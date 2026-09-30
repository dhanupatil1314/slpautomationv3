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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Users, Plus, Search, RefreshCw, Phone, Mail, MapPin, Car, IndianRupee,
  BadgeCheck, Wallet, Percent,
} from 'lucide-react'
import { formatINR, formatNumber, formatDate, timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['active', 'suspended', 'inactive']

export function OwnersView() {
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
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
    sortBy,
    sortOrder: 'desc',
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/owners?${query}`, { refreshKey })

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setRefreshKey((k) => k + 1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const owners = data?.owners || []
  const total = data?.total || 0

  return (
    <div>
      <PageHeader
        title="Vehicle Owners"
        subtitle={`${formatNumber(total)} owners in network`}
        breadcrumbs={[{ label: 'Network' }, { label: 'Owners' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'owners.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Owner
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
            <SelectItem value="revenueShare">Revenue Share</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : owners.length === 0 ? (
        <Card><CardContent><EmptyState icon={Users} title="No owners found" description="Try adjusting filters or register a new owner" /></CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Owner</th>
                    <th className="text-left p-3 font-semibold">City</th>
                    <th className="text-right p-3 font-semibold">Vehicles</th>
                    <th className="text-right p-3 font-semibold">Share</th>
                    <th className="text-right p-3 font-semibold">Total Earn</th>
                    <th className="text-right p-3 font-semibold">Pending Payout</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {owners.map((o: any) => (
                    <tr
                      key={o.id}
                      onClick={() => setDetailId(o.id)}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials(o.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{o.name}</p>
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {o.mobile}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{o.city}</p>
                      </td>
                      <td className="p-3 text-right tabular-nums">{o.vehicleCount}</td>
                      <td className="p-3 text-right tabular-nums">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Percent className="h-3 w-3 text-muted-foreground" />
                          {o.revenueShare}%
                        </span>
                      </td>
                      <td className="p-3 text-right tabular-nums font-medium">{formatINR(o.totalEarnings, true)}</td>
                      <td className="p-3 text-right tabular-nums">
                        {o.pendingPayout > 0 ? (
                          <span className="text-warning-foreground font-medium">{formatINR(o.pendingPayout, true)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3"><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {owners.map((o: any) => (
              <Card key={o.id} onClick={() => setDetailId(o.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(o.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{o.name}</p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {o.mobile}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Vehicles</p>
                      <p className="font-semibold">{o.vehicleCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Share</p>
                      <p className="font-semibold">{o.revenueShare}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Earned</p>
                      <p className="font-semibold">{formatINR(o.totalEarnings, true)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showAdd && (
        <AddOwnerDialog
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); setRefreshKey((k) => k + 1) }}
        />
      )}
      {detailId && (
        <OwnerDetailDialog ownerId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function AddOwnerDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    email: '',
    city: '',
    address: '',
    bankAccount: '',
    bankIfsc: '',
    upiId: '',
    revenueShare: 40,
    status: 'active',
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name || !form.mobile) return toast.error('Name and mobile are required')
    setLoading(true)
    try {
      await mutate('/api/owners', 'POST', form)
      toast.success('Owner created successfully')
      onCreated()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create owner')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Owner</DialogTitle>
          <DialogDescription>Add a vehicle owner to the LakhirAd network</DialogDescription>
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
          <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Alkapuri, Vadodara" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Bank Account</Label><Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} placeholder="123456789012" /></div>
            <div><Label>Bank IFSC</Label><Input value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value })} placeholder="HDFC0001234" /></div>
          </div>
          <div><Label>UPI ID</Label><Input value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} placeholder="rajesh@okhdfcbank" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Revenue Share % ({form.revenueShare}%)</Label>
              <input
                type="range" min={0} max={100} value={form.revenueShare}
                onChange={(e) => setForm({ ...form, revenueShare: Number(e.target.value) })}
                className="w-full mt-2"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create Owner'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OwnerDetailDialog({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const { data, loading, error, refresh } = useFetch<any>(`/api/owners/${ownerId}`, {})

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
          <p className="text-sm text-destructive">{error || 'Owner not found'}</p>
          <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const o = data.owner

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-sm bg-primary/10 text-primary">{initials(o.name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span>{o.name}</span>
                <StatusBadge status={o.status} />
              </div>
              <p className="text-sm font-normal text-muted-foreground flex items-center gap-1 flex-wrap">
                <Phone className="h-3 w-3" /> {o.mobile}
                {o.email && <> · <Mail className="h-3 w-3 inline" /> {o.email}</>}
                {o.city && <> · <MapPin className="h-3 w-3 inline" /> {o.city}</>}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DetailStat label="Vehicles" value={String(o.vehicles?.length || 0)} icon={Car} />
          <DetailStat label="Revenue Share" value={`${o.revenueShare}%`} icon={Percent} />
          <DetailStat label="Total Earned" value={formatINR(o.totalEarnings || 0, true)} icon={IndianRupee} />
          <DetailStat label="Pending Payout" value={formatINR(o.pendingPayout || 0, true)} icon={Wallet} />
        </div>

        {/* Vehicles list */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><Car className="h-4 w-4" /> Vehicles ({o.vehicles?.length || 0})</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {o.vehicles?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No vehicles owned</p>
            ) : (
              <div className="space-y-1.5">
                {o.vehicles?.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-accent/50 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Car className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium font-mono truncate">{v.registrationNo}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {v.driverName} · {v.city} · {v.deviceId}
                        </p>
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
            {o.earningsHistory?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No earnings records yet</p>
            ) : (
              <ScrollArea className="max-h-72">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Month</th>
                      <th className="text-right p-2 font-medium">Revenue Share</th>
                      <th className="text-right p-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.earningsHistory?.map((e: any) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="p-2 font-mono text-xs">{e.month}</td>
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
            {o.payouts?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No payouts yet</p>
            ) : (
              <div className="space-y-1.5">
                {o.payouts?.map((p: any) => (
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
