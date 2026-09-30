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
  Wallet, CheckCircle2, Clock, XCircle, RefreshCw, Plus, ArrowLeft, Banknote,
  User, Building2, Calendar, CreditCard, ListChecks, AlertTriangle,
} from 'lucide-react'
import { formatINR, formatDate, formatDateTime } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['pending', 'under_review', 'approved', 'processing', 'paid', 'failed', 'reversed']
const RECIPIENT_TYPES = ['driver', 'owner']
const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'manual', label: 'Manual / Cash' },
]

export function PayoutsView() {
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilterRaw] = useState('all')
  const [recipientTypeFilter, setRecipientTypeFilterRaw] = useState('all')
  const [monthFilter, setMonthFilterRaw] = useState('all')
  const setStatusFilter = (v: string) => { setStatusFilterRaw(v); setPage(1) }
  const setRecipientTypeFilter = (v: string) => { setRecipientTypeFilterRaw(v); setPage(1) }
  const setMonthFilter = (v: string) => { setMonthFilterRaw(v); setPage(1) }
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const pageSize = 15

  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    status: statusFilter === 'all' ? '' : statusFilter,
    recipientType: recipientTypeFilter === 'all' ? '' : recipientTypeFilter,
    month: monthFilter === 'all' ? '' : monthFilter,
    search: debouncedSearch,
  }).toString()
  const { data, loading, error, refresh } = useFetch<any>(`/api/payouts?${query}`, { refreshKey })

  if (!hasPermission(role, 'payouts.view')) {
    return (
      <div>
        <PageHeader title="Payouts" subtitle="Driver & owner payouts ledger" />
        <Card><CardContent><EmptyState icon={Wallet} title="Access restricted" description="You don't have permission to view payouts." /></CardContent></Card>
      </div>
    )
  }

  if (detailId) {
    return <PayoutDetail id={detailId} onBack={() => setDetailId(null)} onChanged={() => setRefreshKey((k) => k + 1)} />
  }

  const payouts = data?.payouts || []
  const total = data?.total || 0
  const summary = data?.summary
  const months = data?.months || []

  return (
    <div>
      <PageHeader
        title="Payouts"
        subtitle="Driver & owner payout ledger"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Payouts' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'payouts.approve') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5" /> New Payout
              </Button>
            )}
          </>
        }
      />

      {/* KPI cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard label="Paid This Month" value={formatINR(summary.totalPaidThisMonth, true)} icon={CheckCircle2} color="success" />
          <KpiCard label="Pending Approval" value={String(summary.pendingApproval)} icon={Clock} color="warning" hint={formatINR(summary.pendingAmount, true)} />
          <KpiCard label="Processing" value={String(summary.processing)} icon={RefreshCw} color="info" hint={formatINR(summary.processingAmount, true)} />
          <KpiCard label="Failed" value={String(summary.failed)} icon={XCircle} color="destructive" hint={formatINR(summary.failedAmount, true)} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-2 mb-4">
        <Input
          placeholder="Search payout ref, recipient name, mobile..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={recipientTypeFilter} onValueChange={setRecipientTypeFilter}>
          <SelectTrigger className="w-full lg:w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Recipients</SelectItem>
            {RECIPIENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {months.map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : payouts.length === 0 ? (
        <Card><CardContent><EmptyState icon={Wallet} title="No payouts found" description="Try adjusting filters or create a new payout" /></CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Payout Ref</th>
                    <th className="text-left p-3 font-semibold">Recipient</th>
                    <th className="text-left p-3 font-semibold">Type</th>
                    <th className="text-left p-3 font-semibold">Month</th>
                    <th className="text-right p-3 font-semibold">Amount</th>
                    <th className="text-left p-3 font-semibold">Method</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">Processed</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p: any) => (
                    <tr
                      key={p.id}
                      onClick={() => setDetailId(p.id)}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-mono text-xs font-medium">{p.payoutRef}</td>
                      <td className="p-3">
                        <p className="font-medium truncate max-w-[160px]">{p.recipientName}</p>
                        <p className="text-xs text-muted-foreground">{p.recipientCity}</p>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="capitalize text-xs">{p.recipientType}</Badge>
                      </td>
                      <td className="p-3 text-xs">{p.month}</td>
                      <td className="p-3 text-right tabular-nums font-semibold">{formatINR(p.amount, true)}</td>
                      <td className="p-3 text-xs capitalize">{p.method.replace(/_/g, ' ')}</td>
                      <td className="p-3"><StatusBadge status={p.status} /></td>
                      <td className="p-3 text-xs text-muted-foreground">{p.processedAt ? formatDate(p.processedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {payouts.map((p: any) => (
              <Card key={p.id} onClick={() => setDetailId(p.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs font-semibold">{p.payoutRef}</p>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.recipientName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{p.recipientType} · {p.month}</p>
                    </div>
                    <p className="font-semibold tabular-nums">{formatINR(p.amount, true)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showCreate && <CreatePayoutDialog months={months} onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); setDetailId(id); setRefreshKey((k) => k + 1) }} />}
    </div>
  )
}

function CreatePayoutDialog({ months, onClose, onCreated }: { months: string[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ recipientType: 'driver', recipientId: '', month: months[0] || new Date().toISOString().slice(0, 7), amount: '', method: 'upi' })
  const [loading, setLoading] = useState(false)

  // Use the payouts-recipients endpoint (only requires payouts.view permission)
  const { data: recipientsData } = useFetch<any>('/api/payouts/recipients')
  const recipients = form.recipientType === 'driver' ? (recipientsData?.drivers || []) : (recipientsData?.owners || [])

  const submit = async () => {
    if (!form.recipientId) return toast.error('Select a recipient')
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Enter a valid amount')
    if (!form.month) return toast.error('Select a month')
    setLoading(true)
    try {
      const payload: any = {
        recipientType: form.recipientType,
        month: form.month,
        amount: parseFloat(form.amount),
        method: form.method,
      }
      if (form.recipientType === 'driver') payload.driverId = form.recipientId
      else payload.ownerId = form.recipientId

      const res = await mutate('/api/payouts', 'POST', payload)
      toast.success('Payout created')
      onCreated(res.payout.id)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create payout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Payout</DialogTitle>
          <DialogDescription>Initiate a new driver or owner payout</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Recipient Type</Label>
              <Select value={form.recipientType} onValueChange={(v) => setForm({ ...form, recipientType: v, recipientId: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECIPIENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Recipient</Label>
            <Select value={form.recipientId} onValueChange={(v) => setForm({ ...form, recipientId: v })}>
              <SelectTrigger><SelectValue placeholder={`Select ${form.recipientType}`} /></SelectTrigger>
              <SelectContent>
                {recipients.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name} · {r.mobile}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="5000" />
            </div>
            <div>
              <Label>Month</Label>
              <Input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create Payout'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PayoutDetail({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const { data, loading, error, refresh } = useFetch<any>(`/api/payouts/${id}`)
  const { user } = useAuth()
  const role = user?.role
  const canApprove = hasPermission(role, 'payouts.approve')

  const p = data?.payout
  const recipient = p?.recipientType === 'driver' ? p.driver : p.owner

  const updateStatus = async (action: string, label: string) => {
    try {
      await mutate(`/api/payouts/${id}`, 'PATCH', { action })
      toast.success(`Payout ${label.toLowerCase()}`)
      refresh()
      onChanged()
    } catch (e: any) {
      toast.error(e.message || `Failed to ${label.toLowerCase()}`)
    }
  }

  return (
    <div>
      <PageHeader
        title={p?.payoutRef || 'Payout Detail'}
        subtitle={p ? `${formatINR(p.amount, true)} · ${p.recipientType} · ${p.month}` : 'Loading...'}
        breadcrumbs={[{ label: 'Payouts', onClick: onBack }, { label: p?.payoutRef || 'Detail' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" /> Back</Button>
          </>
        }
      />

      {error && <ErrorState message={error} onRetry={refresh} />}
      {loading || !p ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground animate-pulse">Loading...</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Payout Summary</CardTitle>
                  <StatusBadge status={p.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <Field label="Payout Ref" value={<span className="font-mono">{p.payoutRef}</span>} />
                  <Field label="Amount" value={<span className="font-bold text-lg">{formatINR(p.amount)}</span>} />
                  <Field label="Recipient Type" value={<Badge variant="outline" className="capitalize">{p.recipientType}</Badge>} />
                  <Field label="Month" value={p.month} />
                  <Field label="Method" value={<span className="capitalize">{p.method.replace(/_/g, ' ')}</span>} />
                  <Field label="Created" value={formatDateTime(p.createdAt)} />
                  <Field label="Processed" value={p.processedAt ? formatDateTime(p.processedAt) : '—'} />
                  <Field label="Status" value={<StatusBadge status={p.status} />} />
                </div>
              </CardContent>
            </Card>

            {/* State machine actions */}
            {canApprove && (
              <Card>
                <CardHeader><CardTitle className="text-base">Actions</CardTitle><CardDescription className="text-xs">Payout state machine</CardDescription></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(p.status === 'pending' || p.status === 'under_review') && (
                      <Button size="sm" variant="default" className="gap-1.5" onClick={() => updateStatus('approve', 'Approved')}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                    )}
                    {p.status === 'approved' && (
                      <>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => updateStatus('process', 'Processing')}>
                          <RefreshCw className="h-3.5 w-3.5" /> Mark Processing
                        </Button>
                        <Button size="sm" variant="default" className="gap-1.5" onClick={() => updateStatus('mark_paid', 'Marked Paid')}>
                          <Banknote className="h-3.5 w-3.5" /> Mark Paid
                        </Button>
                      </>
                    )}
                    {p.status === 'processing' && (
                      <>
                        <Button size="sm" variant="default" className="gap-1.5" onClick={() => updateStatus('mark_paid', 'Marked Paid')}>
                          <Banknote className="h-3.5 w-3.5" /> Mark Paid
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => updateStatus('mark_failed', 'Marked Failed')}>
                          <XCircle className="h-3.5 w-3.5" /> Mark Failed
                        </Button>
                      </>
                    )}
                    {['pending', 'approved', 'processing'].includes(p.status) && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => updateStatus('reject', 'Reversed')}>
                        <AlertTriangle className="h-3.5 w-3.5" /> Reverse
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Payout lifecycle:</p>
                    <div className="flex items-center gap-1 text-xs flex-wrap">
                      {['pending', 'approved', 'processing', 'paid'].map((s, i) => (
                        <span key={s} className="flex items-center gap-1">
                          <span className={cn('px-2 py-0.5 rounded capitalize', p.status === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{s.replace(/_/g, ' ')}</span>
                          {i < 3 && <span className="text-muted-foreground">→</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Recipient</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Name" value={recipient?.name || '—'} />
                <Field label="Mobile" value={recipient?.mobile || '—'} />
                <Field label="City" value={recipient?.city || '—'} />
                <Field label="Email" value={recipient?.email || '—'} />
                {recipient && 'revenueShare' in recipient && recipient.revenueShare != null && (
                  <Field label="Revenue Share" value={`${recipient.revenueShare}%`} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Payment Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Method" value={<span className="capitalize">{p.method.replace(/_/g, ' ')}</span>} />
                <Field label="UPI ID" value={recipient?.upiId || '—'} />
                <Field label="Bank Account" value={recipient?.bankAccount ? `••••${recipient.bankAccount.slice(-4)}` : '—'} />
                <Field label="IFSC" value={recipient?.bankIfsc || '—'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Ledger Entry</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Ref</span><span className="font-mono">{p.payoutRef}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{formatDate(p.createdAt)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{formatINR(p.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={p.status} /></div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
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
