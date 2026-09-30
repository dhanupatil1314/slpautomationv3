'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import {
  PageHeader, KpiCard, StatusBadge, EmptyState, TableSkeleton, Pagination, ErrorState,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Wallet, TrendingUp, Activity, CheckCircle2, RefreshCw, ArrowLeft, User, Calendar,
  Percent, Award, AlertCircle, Settings, Coins, Shield, Plus, Megaphone,
} from 'lucide-react'
import { formatINR, formatDate, formatNumber } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['pending', 'approved', 'paid']

export function DriverEarningsView() {
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [driverFilter, setDriverFilterRaw] = useState('all')
  const [monthFilter, setMonthFilterRaw] = useState('all')
  const [statusFilter, setStatusFilterRaw] = useState('all')
  const setDriverFilter = (v: string) => { setDriverFilterRaw(v); setPage(1) }
  const setMonthFilter = (v: string) => { setMonthFilterRaw(v); setPage(1) }
  const setStatusFilter = (v: string) => { setStatusFilterRaw(v); setPage(1) }
  const [refreshKey, setRefreshKey] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [showRecalculate, setShowRecalculate] = useState(false)
  const [showRule, setShowRule] = useState(false)
  const pageSize = 15

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    driverId: driverFilter === 'all' ? '' : driverFilter,
    month: monthFilter === 'all' ? '' : monthFilter,
    status: statusFilter === 'all' ? '' : statusFilter,
  }).toString()
  const { data, loading, error, refresh } = useFetch<any>(`/api/driver-earnings?${query}`, { refreshKey })

  if (!hasPermission(role, 'earnings.view')) {
    return (
      <div>
        <PageHeader title="Driver Earnings" subtitle="Earning engine & payouts" />
        <Card><CardContent><EmptyState icon={Wallet} title="Access restricted" description="You don't have permission to view earnings." /></CardContent></Card>
      </div>
    )
  }

  if (detailId) {
    return <EarningDetail id={detailId} onBack={() => setDetailId(null)} onChanged={() => setRefreshKey((k) => k + 1)} />
  }

  const earnings = data?.earnings || []
  const total = data?.total || 0
  const totals = data?.totals
  const rule = data?.rule
  const drivers = data?.filters?.drivers || []
  const months = data?.filters?.months || []

  return (
    <div>
      <PageHeader
        title="Driver Earnings"
        subtitle="Earning engine, breakdown & approvals"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Driver Earnings' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowRule(true)}>
              <Settings className="h-3.5 w-3.5" /> Earning Rules
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'earnings.edit') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowRecalculate(true)}>
                <Plus className="h-3.5 w-3.5" /> Recalculate
              </Button>
            )}
          </>
        }
      />

      {/* Active earning rule banner */}
      {rule && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/15 text-primary">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Active Earning Rule: {rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Driver Share: <span className="font-medium text-foreground">{rule.driverShare}%</span> ·
                    Owner: <span className="font-medium text-foreground">{rule.ownerShare}%</span> ·
                    Platform: <span className="font-medium text-foreground">{rule.platformShare}%</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline">Base ₹{rule.baseParticipation}</Badge>
                <Badge variant="outline">Uptime Bonus ₹{rule.uptimeBonus}</Badge>
                <Badge variant="outline">Campaign ₹{rule.campaignBonus}</Badge>
                <Badge variant="outline">Compliance ₹{rule.complianceBonus}</Badge>
                <Badge variant="outline">Penalty ₹{rule.servicePenalty}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard label="Total Earnings" value={formatINR(totals.totalAmount, true)} icon={Wallet} color="primary" />
          <KpiCard label="Base Participation" value={formatINR(totals.baseAmount, true)} icon={Coins} color="info" />
          <KpiCard label="Revenue Share" value={formatINR(totals.revenueShare, true)} icon={TrendingUp} color="success" />
          <KpiCard label="Avg Uptime" value={`${totals.avgUptime.toFixed(1)}%`} icon={Activity} color="warning" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Select value={driverFilter} onValueChange={setDriverFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="All Drivers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Drivers</SelectItem>
            {drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Months" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {months.map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : earnings.length === 0 ? (
        <Card><CardContent><EmptyState icon={Wallet} title="No earning records" description="Try adjusting filters or recalculate earnings" /></CardContent></Card>
      ) : (
        <>
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Driver</th>
                    <th className="text-left p-3 font-semibold">Month</th>
                    <th className="text-right p-3 font-semibold">Active Days</th>
                    <th className="text-right p-3 font-semibold">Uptime</th>
                    <th className="text-right p-3 font-semibold">Base</th>
                    <th className="text-right p-3 font-semibold">Revenue Share</th>
                    <th className="text-right p-3 font-semibold">Bonuses</th>
                    <th className="text-right p-3 font-semibold">Total</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((e: any) => (
                    <tr
                      key={e.id}
                      onClick={() => setDetailId(e.id)}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <p className="font-medium">{e.driverName}</p>
                        <p className="text-xs text-muted-foreground">{e.driverCity}</p>
                      </td>
                      <td className="p-3 text-xs">{e.month}</td>
                      <td className="p-3 text-right tabular-nums">{e.activeDays}</td>
                      <td className="p-3 text-right tabular-nums">{e.screenUptimePct.toFixed(1)}%</td>
                      <td className="p-3 text-right tabular-nums">{formatINR(e.baseAmount, true)}</td>
                      <td className="p-3 text-right tabular-nums">{formatINR(e.revenueShare, true)}</td>
                      <td className="p-3 text-right tabular-nums text-success">
                        +{formatINR(e.uptimeBonus + e.campaignBonus + e.complianceBonus, true)}
                        {e.servicePenalty > 0 && <span className="text-destructive"> -{formatINR(e.servicePenalty, true)}</span>}
                      </td>
                      <td className="p-3 text-right tabular-nums font-semibold">{formatINR(e.totalAmount, true)}</td>
                      <td className="p-3"><StatusBadge status={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="md:hidden space-y-2">
            {earnings.map((e: any) => (
              <Card key={e.id} onClick={() => setDetailId(e.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{e.driverName}</p>
                      <p className="text-xs text-muted-foreground">{e.month} · {e.activeDays} days</p>
                    </div>
                    <StatusBadge status={e.status} />
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Uptime: {e.screenUptimePct.toFixed(1)}%</span>
                    <span className="font-semibold tabular-nums">{formatINR(e.totalAmount, true)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showRecalculate && (
        <RecalculateDialog
          drivers={drivers}
          months={months}
          onClose={() => setShowRecalculate(false)}
          onDone={() => { setShowRecalculate(false); setRefreshKey((k) => k + 1) }}
        />
      )}

      {showRule && (
        <EarningRuleDialog onClose={() => setShowRule(false)} onSaved={() => { setShowRule(false); setRefreshKey((k) => k + 1) }} />
      )}
    </div>
  )
}

function RecalculateDialog({ drivers, months, onClose, onDone }: {
  drivers: any[]
  months: string[]
  onClose: () => void
  onDone: () => void
}) {
  const [driverId, setDriverId] = useState('')
  const [month, setMonth] = useState(months[0] || new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!driverId) return toast.error('Select a driver')
    if (!month) return toast.error('Select a month')
    setLoading(true)
    try {
      const res = await mutate('/api/driver-earnings', 'POST', { driverId, month })
      toast.success(`Earnings recalculated: ${formatINR(res.earning.totalAmount)}`)
      onDone()
    } catch (e: any) {
      toast.error(e.message || 'Failed to recalculate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recalculate Earnings</DialogTitle>
          <DialogDescription>Recompute using the active earning rule</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Driver *</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
              <SelectContent>
                {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Month (YYYY-MM)</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Uses the active rule from /api/earning-rules — never hardcoded.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Calculating...' : 'Recalculate'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EarningRuleDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data, loading: ruleLoading } = useFetch<any>('/api/earning-rules')
  const { user } = useAuth()
  const canEdit = hasPermission(user?.role, 'settings.edit')
  const [form, setForm] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data?.rule && !form) setForm(data.rule)
  }, [data, form])

  const submit = async () => {
    if (!form) return
    setSaving(true)
    try {
      await mutate('/api/earning-rules', 'PATCH', {
        platformShare: parseFloat(form.platformShare),
        ownerShare: parseFloat(form.ownerShare),
        driverShare: parseFloat(form.driverShare),
        baseParticipation: parseFloat(form.baseParticipation),
        uptimeBonus: parseFloat(form.uptimeBonus),
        campaignBonus: parseFloat(form.campaignBonus),
        complianceBonus: parseFloat(form.complianceBonus),
        servicePenalty: parseFloat(form.servicePenalty),
      })
      toast.success('Earning rule updated')
      onSaved()
    } catch (e: any) {
      toast.error(e.message || 'Failed to update rule')
    } finally {
      setSaving(false)
    }
  }

  const shareSum = form ? (parseFloat(form.platformShare) || 0) + (parseFloat(form.ownerShare) || 0) + (parseFloat(form.driverShare) || 0) : 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Earning Rule Configuration</DialogTitle>
          <DialogDescription>
            The configurable earning engine — all driver payouts derive from these values.
          </DialogDescription>
        </DialogHeader>
        {ruleLoading || !form ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">Loading...</div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Revenue Share Split (must total 100%)</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Platform %</Label>
                  <Input type="number" value={form.platformShare} disabled={!canEdit} onChange={(e) => setForm({ ...form, platformShare: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Owner %</Label>
                  <Input type="number" value={form.ownerShare} disabled={!canEdit} onChange={(e) => setForm({ ...form, ownerShare: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Driver %</Label>
                  <Input type="number" value={form.driverShare} disabled={!canEdit} onChange={(e) => setForm({ ...form, driverShare: e.target.value })} />
                </div>
              </div>
              <p className={cn('text-xs mt-1', Math.abs(shareSum - 100) < 0.1 ? 'text-success' : 'text-destructive')}>
                Total: {shareSum.toFixed(1)}% {Math.abs(shareSum - 100) < 0.1 ? '✓' : '(must be 100%)'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Base Participation (₹)</Label>
                <Input type="number" value={form.baseParticipation} disabled={!canEdit} onChange={(e) => setForm({ ...form, baseParticipation: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Uptime Bonus (₹)</Label>
                <Input type="number" value={form.uptimeBonus} disabled={!canEdit} onChange={(e) => setForm({ ...form, uptimeBonus: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Campaign Bonus (₹)</Label>
                <Input type="number" value={form.campaignBonus} disabled={!canEdit} onChange={(e) => setForm({ ...form, campaignBonus: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Compliance Bonus (₹)</Label>
                <Input type="number" value={form.complianceBonus} disabled={!canEdit} onChange={(e) => setForm({ ...form, complianceBonus: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="text-[11px] text-muted-foreground">Service Penalty (₹)</Label>
                <Input type="number" value={form.servicePenalty} disabled={!canEdit} onChange={(e) => setForm({ ...form, servicePenalty: e.target.value })} />
              </div>
            </div>
            {!canEdit && <p className="text-xs text-muted-foreground">Read-only — you need settings.edit permission to modify.</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {canEdit && <Button onClick={submit} disabled={saving || !form}>{saving ? 'Saving...' : 'Save Rule'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EarningDetail({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const { data, loading, error, refresh } = useFetch<any>(`/api/driver-earnings/${id}`)
  const { user } = useAuth()
  const role = user?.role
  const canApprove = hasPermission(role, 'earnings.edit')

  const e = data?.earning
  const rule = data?.rule
  const bonuses = e ? (e.uptimeBonus + e.campaignBonus + e.complianceBonus) : 0

  const handleApprove = async () => {
    try {
      await mutate(`/api/driver-earnings/${id}`, 'PATCH', { action: 'approve' })
      toast.success('Earning approved')
      refresh()
      onChanged()
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve')
    }
  }

  return (
    <div>
      <PageHeader
        title={e ? `${e.driver.name} · ${e.month}` : 'Earning Detail'}
        subtitle={e ? `${formatINR(e.totalAmount)} · ${e.status}` : 'Loading...'}
        breadcrumbs={[{ label: 'Driver Earnings', onClick: onBack }, { label: 'Detail' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" /> Back</Button>
            {canApprove && e && e.status === 'pending' && (
              <Button size="sm" className="gap-1.5" onClick={handleApprove}><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>
            )}
          </>
        }
      />

      {error && <ErrorState message={error} onRetry={refresh} />}
      {loading || !e ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground animate-pulse">Loading...</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Earning breakdown */}
            <Card>
              <CardHeader><CardTitle className="text-base">Earning Breakdown</CardTitle><CardDescription className="text-xs">Computed using active earning rule</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <BreakdownRow icon={Coins} label="Base Participation" value={e.baseAmount} hint={rule ? `₹${rule.baseParticipation} (rule)` : ''} />
                  <BreakdownRow icon={Percent} label="Revenue Share" value={e.revenueShare} hint={rule ? `${rule.driverShare}% of ad revenue (rule)` : ''} positive />
                  <BreakdownRow icon={Activity} label="Uptime Bonus" value={e.uptimeBonus} hint={`${e.screenUptimePct.toFixed(1)}% uptime`} positive />
                  <BreakdownRow icon={MegaphoneIcon} label="Campaign Bonus" value={e.campaignBonus} positive />
                  <BreakdownRow icon={Award} label="Compliance Bonus" value={e.complianceBonus} positive />
                  {e.servicePenalty > 0 && <BreakdownRow icon={AlertCircle} label="Service Penalty" value={-e.servicePenalty} negative />}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold">Total Earnings</span>
                    <span className="text-2xl font-bold tabular-nums">{formatINR(e.totalAmount)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Base + Revenue Share + Bonuses − Penalty</p>
                </div>
              </CardContent>
            </Card>

            {/* Performance metrics */}
            <Card>
              <CardHeader><CardTitle className="text-base">Performance Metrics</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Metric label="Active Days" value={String(e.activeDays)} icon={Calendar} />
                  <Metric label="Screen Uptime" value={`${e.screenUptimePct.toFixed(1)}%`} icon={Activity} />
                  <Metric label="Driver Score" value={String(e.driver.driverScore)} icon={Award} />
                  <Metric label="Total Bonuses" value={formatINR(bonuses, true)} icon={TrendingUp} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Driver</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Name" value={e.driver.name} />
                <Field label="Mobile" value={e.driver.mobile} />
                <Field label="City" value={e.driver.city || '—'} />
                <Field label="Status" value={<StatusBadge status={e.driver.status} />} />
                <Field label="Joining Date" value={formatDate(e.driver.joiningDate)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Payment Info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="UPI ID" value={e.driver.upiId || '—'} />
                <Field label="Bank Account" value={e.driver.bankAccount ? `••••${e.driver.bankAccount.slice(-4)}` : '—'} />
                <Field label="IFSC" value={e.driver.bankIfsc || '—'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Status</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current</span>
                  <StatusBadge status={e.status} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{formatDate(e.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function BreakdownRow({ icon: Icon, label, value, hint, positive, negative }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  hint?: string
  positive?: boolean
  negative?: boolean
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-md hover:bg-accent/50">
      <div className={cn(
        'grid place-items-center h-8 w-8 rounded-md shrink-0',
        positive ? 'bg-success/15 text-success' : negative ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span className={cn(
        'font-semibold tabular-nums',
        positive && 'text-success', negative && 'text-destructive'
      )}>
        {value < 0 ? '−' : positive ? '+' : ''}{formatINR(Math.abs(value), true)}
      </span>
    </div>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="p-3 rounded-md border">
      <Icon className="h-4 w-4 text-muted-foreground mb-1.5" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums mt-0.5">{value}</p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  )
}

function MegaphoneIcon({ className }: { className?: string }) {
  return <Megaphone className={className} />
}
