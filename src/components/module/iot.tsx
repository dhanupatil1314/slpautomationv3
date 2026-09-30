'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, KpiCard, StatusBadge, EmptyState, TableSkeleton, Pagination, ErrorState } from '@/components/shared'
import { Card, CardContent } from '@/components/ui/card'
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
  Wifi, Smartphone, AlertTriangle, RefreshCw, Plus, Search, CalendarClock, TrendingUp, Ban,
} from 'lucide-react'
import { formatDate, formatNumber } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const OPERATORS = ['jio', 'airtel', 'vi', 'bsnl']
const STATUSES = ['active', 'suspended', 'expired', 'offline']

export function IotView() {
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [operator, setOperator] = useState('all')
  const [status, setStatus] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const pageSize = 15

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search,
    operator: operator === 'all' ? '' : operator,
    status: status === 'all' ? '' : status,
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/iot?${query}`, { refreshKey })

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setRefreshKey((k) => k + 1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const sims = data?.sims || []
  const total = data?.total || 0
  const k = data?.kpis

  const usageColor = (pct: number) =>
    pct >= 80 ? 'text-destructive' : pct >= 60 ? 'text-warning-foreground' : 'text-success'
  const usageBg = (pct: number) =>
    pct >= 80 ? 'bg-destructive' : pct >= 60 ? 'bg-warning' : 'bg-success'

  return (
    <div>
      <PageHeader
        title="IoT / SIM Management"
        subtitle="Monitor and manage cellular connectivity across the network"
        breadcrumbs={[{ label: 'Operations' }, { label: 'IoT / SIMs' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'iot.edit') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" /> Add SIM
              </Button>
            )}
          </>
        }
      />

      {/* KPI cards */}
      {k && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="Active SIMs" value={formatNumber(k.activeCount)} icon={Wifi} color="success" />
          <KpiCard label="Suspended" value={formatNumber(k.suspendedCount)} icon={Ban} color="destructive" />
          <KpiCard label="Offline" value={formatNumber(k.offlineCount)} icon={AlertTriangle} color="warning" />
          <KpiCard label="Expiring <7d" value={formatNumber(k.expiringSoon)} icon={CalendarClock} color="warning" />
          <KpiCard label="High Usage ≥80%" value={formatNumber(k.highUsage)} icon={TrendingUp} color="destructive" />
          <KpiCard label="Total SIMs" value={formatNumber(k.total)} icon={Smartphone} color="primary" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ICCID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={operator} onValueChange={(v) => { setOperator(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Operator" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Operators</SelectItem>
            {OPERATORS.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : sims.length === 0 ? (
        <Card><CardContent><EmptyState icon={Wifi} title="No SIMs found" description="Try adjusting filters or register a new SIM" /></CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">ICCID</th>
                    <th className="text-left p-3 font-semibold">Operator</th>
                    <th className="text-left p-3 font-semibold">Plan</th>
                    <th className="text-left p-3 font-semibold">Usage</th>
                    <th className="text-left p-3 font-semibold">Renewal</th>
                    <th className="text-left p-3 font-semibold">Device</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sims.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                      <td className="p-3">
                        <p className="font-mono text-xs font-medium">{s.iccid}</p>
                        <p className="text-[10px] text-muted-foreground">{s.imei || '—'}</p>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn('w-2 h-2 rounded-full', operatorDot(s.operator))} />
                          <span className="capitalize font-medium">{s.operator}</span>
                        </span>
                        <p className="text-[10px] text-muted-foreground">{s.network}</p>
                      </td>
                      <td className="p-3">
                        <p className="font-medium">{s.dataPlan || '—'}</p>
                        <p className="text-[10px] text-muted-foreground">{formatNumber(s.monthlyAllowanceMb)} MB cap</p>
                      </td>
                      <td className="p-3 w-48">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">{formatNumber(s.currentUsageMb)} MB</span>
                          <span className={cn('text-xs font-semibold', usageColor(s.usagePct))}>{s.usagePct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn('h-full', usageBg(s.usagePct))} style={{ width: `${Math.min(s.usagePct, 100)}%` }} />
                        </div>
                      </td>
                      <td className="p-3 text-xs">{s.renewalDate ? formatDate(s.renewalDate) : '—'}</td>
                      <td className="p-3">
                        {s.device ? (
                          <>
                            <p className="font-medium">{s.device.deviceId}</p>
                            <p className="text-[10px] text-muted-foreground">{s.device.city}</p>
                          </>
                        ) : <span className="text-muted-foreground">Unassigned</span>}
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
            {sims.map((s: any) => (
              <Card key={s.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-medium truncate">{s.iccid}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{s.operator} · {s.network}</p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{s.dataPlan} · {formatNumber(s.currentUsageMb)} MB</span>
                    <span className={cn('text-xs font-semibold', usageColor(s.usagePct))}>{s.usagePct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full', usageBg(s.usagePct))} style={{ width: `${Math.min(s.usagePct, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                    <span>Renewal: {s.renewalDate ? formatDate(s.renewalDate) : '—'}</span>
                    <span>{s.device?.deviceId || 'Unassigned'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showAdd && <AddSimDialog onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); setRefreshKey((k) => k + 1) }} />}
    </div>
  )
}

function operatorDot(op: string) {
  const map: Record<string, string> = {
    jio: 'bg-primary', airtel: 'bg-destructive', vi: 'bg-warning', bsnl: 'bg-success',
  }
  return map[op] || 'bg-muted'
}

function AddSimDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    iccid: '', imei: '', operator: 'jio', network: '4G', dataPlan: '1GB/day',
    monthlyAllowanceMb: '3072', activationDate: '', renewalDate: '',
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.iccid || !form.operator) return toast.error('ICCID and operator required')
    setLoading(true)
    try {
      await mutate('/api/iot', 'POST', form)
      toast.success('SIM registered successfully')
      onCreated()
    } catch (e: any) {
      toast.error(e.message || 'Failed to register SIM')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register New SIM</DialogTitle>
          <DialogDescription>Add a cellular SIM to the inventory</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>ICCID *</Label><Input value={form.iccid} onChange={(e) => setForm({ ...form, iccid: e.target.value })} placeholder="20-digit ICCID" className="font-mono" /></div>
          <div><Label>IMEI</Label><Input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} placeholder="15-digit IMEI" className="font-mono" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Operator</Label>
              <Select value={form.operator} onValueChange={(v) => setForm({ ...form, operator: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OPERATORS.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Network</Label>
              <Select value={form.network} onValueChange={(v) => setForm({ ...form, network: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="4G">4G</SelectItem><SelectItem value="3G">3G</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data Plan</Label><Input value={form.dataPlan} onChange={(e) => setForm({ ...form, dataPlan: e.target.value })} placeholder="1GB/day" /></div>
            <div><Label>Allowance (MB)</Label><Input type="number" value={form.monthlyAllowanceMb} onChange={(e) => setForm({ ...form, monthlyAllowanceMb: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Activation Date</Label><Input type="date" value={form.activationDate} onChange={(e) => setForm({ ...form, activationDate: e.target.value })} /></div>
            <div><Label>Renewal Date</Label><Input type="date" value={form.renewalDate} onChange={(e) => setForm({ ...form, renewalDate: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Registering...' : 'Register SIM'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
