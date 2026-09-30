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
  Receipt, IndianRupee, CheckCircle2, AlertCircle, Clock, RefreshCw, Plus, ArrowLeft,
  CreditCard, Building2, Wallet, RotateCcw,
} from 'lucide-react'
import { formatINR, formatDate, formatDateTime } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['pending', 'paid', 'failed', 'refunded', 'partially_refunded']
const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI', icon: Wallet },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'manual', label: 'Manual / Cash', icon: Receipt },
]

export function BillingView() {
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const pageSize = 15

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    status: statusFilter === 'all' ? '' : statusFilter,
    search: debouncedSearch,
  }).toString()
  const { data, loading, error, refresh } = useFetch<any>(`/api/billing?${query}`, { refreshKey })

  if (!hasPermission(role, 'billing.view')) {
    return (
      <div>
        <PageHeader title="Billing" subtitle="Invoice management" />
        <Card><CardContent><EmptyState icon={Receipt} title="Access restricted" description="You don't have permission to view billing." /></CardContent></Card>
      </div>
    )
  }

  if (detailId) {
    return <InvoiceDetail id={detailId} onBack={() => setDetailId(null)} onChanged={() => setRefreshKey((k) => k + 1)} />
  }

  const invoices = data?.invoices || []
  const total = data?.total || 0
  const summary = data?.summary

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="Invoices, payments, and refunds"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Billing' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'billing.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5" /> New Invoice
              </Button>
            )}
          </>
        }
      />

      {/* KPI cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard label="Total Billed" value={formatINR(summary.totalBilled, true)} icon={Receipt} color="primary" />
          <KpiCard label="Total Paid" value={formatINR(summary.totalPaid, true)} icon={CheckCircle2} color="success" />
          <KpiCard label="Outstanding" value={formatINR(summary.outstanding, true)} icon={Clock} color="warning" />
          <KpiCard label="Overdue" value={formatINR(summary.overdue, true)} icon={AlertCircle} color="destructive" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input
          placeholder="Search invoice #, campaign, advertiser..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : invoices.length === 0 ? (
        <Card><CardContent><EmptyState icon={Receipt} title="No invoices found" description="Try adjusting filters or create a new invoice" /></CardContent></Card>
      ) : (
        <>
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Invoice #</th>
                    <th className="text-left p-3 font-semibold">Advertiser</th>
                    <th className="text-left p-3 font-semibold">Campaign</th>
                    <th className="text-right p-3 font-semibold">Amount</th>
                    <th className="text-right p-3 font-semibold">GST (18%)</th>
                    <th className="text-right p-3 font-semibold">Total</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => (
                    <tr
                      key={inv.id}
                      onClick={() => setDetailId(inv.id)}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-medium font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="p-3 truncate max-w-[180px]">{inv.advertiserName}</td>
                      <td className="p-3 truncate max-w-[180px] text-muted-foreground">{inv.campaignName}</td>
                      <td className="p-3 text-right tabular-nums">{formatINR(inv.amount, true)}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">{formatINR(inv.gst, true)}</td>
                      <td className="p-3 text-right tabular-nums font-semibold">{formatINR(inv.totalAmount, true)}</td>
                      <td className="p-3"><StatusBadge status={inv.status} /></td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDate(inv.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="md:hidden space-y-2">
            {invoices.map((inv: any) => (
              <Card key={inv.id} onClick={() => setDetailId(inv.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs font-semibold">{inv.invoiceNumber}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                  <p className="font-medium mt-1.5 truncate">{inv.advertiserName}</p>
                  <p className="text-xs text-muted-foreground truncate">{inv.campaignName}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Due: {formatDate(inv.dueDate)}</span>
                    <span className="font-semibold tabular-nums">{formatINR(inv.totalAmount, true)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showCreate && <CreateInvoiceDialog onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); setDetailId(id); setRefreshKey((k) => k + 1) }} />}
    </div>
  )
}

function CreateInvoiceDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ advertiserId: '', amount: '', dueDate: '', note: '' })
  const [loading, setLoading] = useState(false)
  const { data: advData } = useFetch<any>('/api/advertisers?pageSize=100')

  const submit = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Enter a valid amount')
    if (!form.advertiserId) return toast.error('Select an advertiser')
    setLoading(true)
    try {
      const res = await mutate('/api/billing', 'POST', {
        advertiserId: form.advertiserId,
        amount: parseFloat(form.amount),
        dueDate: form.dueDate || undefined,
        note: form.note,
      })
      toast.success('Invoice created')
      onCreated(res.invoice.id)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create invoice')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>GST (18%) will be auto-calculated</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Advertiser *</Label>
            <Select value={form.advertiserId} onValueChange={(v) => setForm({ ...form, advertiserId: v })}>
              <SelectTrigger><SelectValue placeholder="Select advertiser" /></SelectTrigger>
              <SelectContent>
                {(advData?.advertisers || []).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.organizationName} — {a.contactName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="25000" />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          {form.amount && (
            <div className="p-3 rounded-md bg-muted/50 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatINR(parseFloat(form.amount) || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span><span className="tabular-nums">{formatINR((parseFloat(form.amount) || 0) * 0.18)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span className="tabular-nums">{formatINR((parseFloat(form.amount) || 0) * 1.18)}</span></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create Invoice'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InvoiceDetail({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const { data, loading, error, refresh } = useFetch<any>(`/api/invoices/${id}`)
  const { user } = useAuth()
  const role = user?.role
  const [showPay, setShowPay] = useState(false)
  const [showRefund, setShowRefund] = useState(false)

  const inv = data?.invoice

  const paidAmount = inv?.payments?.filter((p: any) => p.status === 'success').reduce((a: number, p: any) => a + p.amount, 0) || 0
  const balance = inv ? inv.totalAmount - paidAmount : 0

  return (
    <div>
      <PageHeader
        title={inv?.invoiceNumber || 'Invoice'}
        subtitle={inv ? `${inv.advertiser?.organization?.name || inv.advertiser?.contactName} · ${formatINR(inv.totalAmount, true)}` : 'Loading...'}
        breadcrumbs={[{ label: 'Billing', onClick: onBack }, { label: inv?.invoiceNumber || 'Detail' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" /> Back</Button>
            {hasPermission(role, 'billing.edit') && inv && (
              <>
                {balance > 0 && inv.status !== 'refunded' && (
                  <Button size="sm" className="gap-1.5" onClick={() => setShowPay(true)}><CheckCircle2 className="h-3.5 w-3.5" /> Record Payment</Button>
                )}
                {paidAmount > 0 && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowRefund(true)}><RotateCcw className="h-3.5 w-3.5" /> Refund</Button>
                )}
              </>
            )}
          </>
        }
      />

      {error && <ErrorState message={error} onRetry={refresh} />}
      {loading || !inv ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground animate-pulse">Loading invoice...</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Invoice Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <Field label="Invoice Number" value={inv.invoiceNumber} mono />
                  <Field label="Status" value={<StatusBadge status={inv.status} />} />
                  <Field label="Advertiser" value={inv.advertiser?.organization?.name || inv.advertiser?.contactName || '—'} />
                  <Field label="Campaign" value={inv.campaign?.name || '—'} />
                  <Field label="Issued" value={formatDate(inv.createdAt)} />
                  <Field label="Due Date" value={formatDate(inv.dueDate)} />
                  <Field label="Paid At" value={formatDate(inv.paidAt)} />
                  <Field label="GSTIN" value={inv.advertiser?.organization?.gstin || '—'} />
                </div>
                <div className="mt-4 pt-4 border-t space-y-2">
                  <Row label="Subtotal" value={formatINR(inv.amount)} />
                  <Row label="GST (18%)" value={formatINR(inv.gst)} muted />
                  <Row label="Total" value={formatINR(inv.totalAmount)} bold />
                  <Row label="Paid" value={formatINR(paidAmount)} success />
                  {balance > 0 && inv.status !== 'refunded' && <Row label="Balance Due" value={formatINR(balance)} danger />}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
              <CardContent>
                {inv.payments.length === 0 ? (
                  <EmptyState icon={CreditCard} title="No payments yet" description="Record a payment to mark this invoice as paid" />
                ) : (
                  <div className="space-y-2">
                    {inv.payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-md border">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize text-xs">{p.method.replace(/_/g, ' ')}</Badge>
                            {p.provider && <Badge variant="secondary" className="text-xs capitalize">{p.provider}</Badge>}
                            <StatusBadge status={p.status} />
                          </div>
                          {p.providerRef && <p className="text-xs text-muted-foreground mt-1 font-mono">Ref: {p.providerRef}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(p.createdAt)}</p>
                        </div>
                        <p className="font-semibold tabular-nums">{formatINR(p.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Advertiser</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Organization" value={inv.advertiser?.organization?.name || '—'} />
                <Field label="Contact" value={inv.advertiser?.contactName || '—'} />
                <Field label="Email" value={inv.advertiser?.contactEmail || '—'} />
                <Field label="Phone" value={inv.advertiser?.contactPhone || '—'} />
                <Field label="Address" value={inv.advertiser?.organization?.address || '—'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Payment Provider</CardTitle><CardDescription className="text-xs">Integration-ready</CardDescription></CardHeader>
              <CardContent className="text-xs space-y-2">
                <p className="text-muted-foreground">Supported providers (configurable per payment):</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="capitalize">Razorpay</Badge>
                  <Badge variant="secondary" className="capitalize">Manual</Badge>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground">Methods:</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {PAYMENT_METHODS.map((m) => <Badge key={m.value} variant="outline" className="capitalize text-xs">{m.label}</Badge>)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {showPay && inv && (
        <PaymentDialog
          title="Record Payment"
          subtitle={`Invoice ${inv.invoiceNumber}`}
          defaultAmount={balance}
          onClose={() => setShowPay(false)}
          onSubmit={async (amount, method, provider, providerRef) => {
            try {
              await mutate(`/api/invoices/${id}`, 'PATCH', {
                action: 'mark_paid',
                payment: { amount, method, provider, providerRef },
              })
              toast.success('Payment recorded')
              setShowPay(false)
              refresh()
              onChanged()
            } catch (e: any) { toast.error(e.message || 'Failed') }
          }}
        />
      )}

      {showRefund && inv && (
        <PaymentDialog
          title="Process Refund"
          subtitle={`Refund against ${inv.invoiceNumber}`}
          defaultAmount={paidAmount}
          isRefund
          onClose={() => setShowRefund(false)}
          onSubmit={async (amount, method, provider, providerRef) => {
            try {
              await mutate(`/api/invoices/${id}`, 'PATCH', {
                action: 'refund',
                payment: { amount, method, provider, providerRef },
              })
              toast.success('Refund processed')
              setShowRefund(false)
              refresh()
              onChanged()
            } catch (e: any) { toast.error(e.message || 'Failed') }
          }}
        />
      )}
    </div>
  )
}

function PaymentDialog({ title, subtitle, defaultAmount, isRefund, onClose, onSubmit }: {
  title: string
  subtitle: string
  defaultAmount: number
  isRefund?: boolean
  onClose: () => void
  onSubmit: (amount: number, method: string, provider: string, providerRef: string) => Promise<void>
}) {
  const [amount, setAmount] = useState(String(Math.round(defaultAmount)))
  const [method, setMethod] = useState('manual')
  const [provider, setProvider] = useState('manual')
  const [providerRef, setProviderRef] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return toast.error('Enter a valid amount')
    setLoading(true)
    await onSubmit(amt, method, provider, providerRef)
    setLoading(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="razorpay">Razorpay</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {provider !== 'manual' && (
            <div>
              <Label>Provider Reference</Label>
              <Input value={providerRef} onChange={(e) => setProviderRef(e.target.value)} placeholder="pay_xxxxxx or order id" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading} variant={isRefund ? 'destructive' : 'default'}>
            {loading ? 'Processing...' : isRefund ? 'Process Refund' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-medium mt-0.5', mono && 'font-mono text-sm')}>{value}</p>
    </div>
  )
}

function Row({ label, value, muted, bold, success, danger }: { label: string; value: string; muted?: boolean; bold?: boolean; success?: boolean; danger?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={cn(muted ? 'text-muted-foreground' : 'text-foreground', bold && 'font-semibold')}>{label}</span>
      <span className={cn('tabular-nums', bold && 'font-bold', success && 'text-success', danger && 'text-destructive')}>{value}</span>
    </div>
  )
}
