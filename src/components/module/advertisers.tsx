'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, StatusBadge, EmptyState, TableSkeleton, Pagination, ErrorState, KpiCard } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Building2, Plus, Search, RefreshCw, Phone, Mail, Tag, Wallet, ArrowLeft,
  Megaphone, Film, FileText, MapPin, CreditCard,
} from 'lucide-react'
import { formatINR, formatNumber, formatDate } from '@/lib/format'
import { toast } from 'sonner'

const STATUS_OPTIONS = ['active', 'suspended', 'inactive']
const CATEGORY_OPTIONS = [
  'restaurant', 'jewellery', 'education', 'real_estate', 'fashion',
  'automotive', 'healthcare', 'electronics', 'travel', 'finance', 'other',
]

export function AdvertisersView() {
  const { openDetail } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const pageSize = 12

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search,
    status: statusFilter === 'all' ? '' : statusFilter,
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/advertisers?${query}`, { refreshKey })

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setRefreshKey((k) => k + 1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const advertisers = data?.advertisers || []
  const total = data?.total || 0

  // Top-level KPIs (computed client-side from current page)
  const totalSpend = advertisers.reduce((s: number, a: any) => s + a.totalSpend, 0)
  const totalCampaigns = advertisers.reduce((s: number, a: any) => s + a.campaignCount, 0)
  const activeCount = advertisers.filter((a: any) => a.status === 'active').length

  return (
    <div>
      <PageHeader
        title="Advertisers"
        subtitle={`${formatNumber(total)} advertisers registered`}
        breadcrumbs={[{ label: 'Advertising' }, { label: 'Advertisers' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'advertisers.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Advertiser
              </Button>
            )}
          </>
        }
      />

      {/* KPI row */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
        <KpiCard label="Total Advertisers" value={formatNumber(total)} icon={Building2} color="primary" />
        <KpiCard label="Active" value={formatNumber(activeCount)} icon={Megaphone} color="success" />
        <KpiCard label="Campaigns" value={formatNumber(totalCampaigns)} icon={Film} color="info" />
        <KpiCard label="Total Spend" value={formatINR(totalSpend, true)} icon={Wallet} color="primary" hint="From paid invoices" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by org, contact, email..."
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
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : advertisers.length === 0 ? (
        <Card><CardContent><EmptyState icon={Building2} title="No advertisers found" description="Try adjusting filters or add a new advertiser" /></CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Organization</th>
                    <th className="text-left p-3 font-semibold">Contact</th>
                    <th className="text-left p-3 font-semibold">Category</th>
                    <th className="text-left p-3 font-semibold">Campaigns</th>
                    <th className="text-left p-3 font-semibold">Total Spend</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {advertisers.map((a: any) => (
                    <tr
                      key={a.id}
                      onClick={() => openDetail('advertiser-detail', a.id)}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary shrink-0">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{a.organizationName}</p>
                            <p className="text-xs text-muted-foreground truncate">{a.contactName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3 text-muted-foreground" />{a.contactPhone}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground truncate"><Mail className="h-3 w-3" />{a.contactEmail}</p>
                      </td>
                      <td className="p-3"><span className="inline-flex items-center gap-1 text-xs"><Tag className="h-3 w-3 text-muted-foreground" />{a.category}</span></td>
                      <td className="p-3 font-medium">{formatNumber(a.campaignCount)}</td>
                      <td className="p-3 font-medium tabular-nums">{formatINR(a.totalSpend, true)}</td>
                      <td className="p-3"><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {advertisers.map((a: any) => (
              <Card key={a.id} onClick={() => openDetail('advertiser-detail', a.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary shrink-0">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{a.organizationName}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.contactName} · {a.category}</p>
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{a.contactPhone}</span>
                    <span className="flex items-center gap-1"><Megaphone className="h-3 w-3" />{formatNumber(a.campaignCount)} campaigns</span>
                  </div>
                  <div className="mt-2 text-sm font-semibold tabular-nums">{formatINR(a.totalSpend, true)} spend</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showAdd && <AddAdvertiserDialog onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); setRefreshKey((k) => k + 1) }} />}
    </div>
  )
}

// ============ Detail view (rendered when view='advertiser-detail') ============

export function AdvertiserDetailView() {
  const { entityId, setView } = useNav()
  const [tab, setTab] = useState('overview')
  const { data, loading, error, refresh } = useFetch<any>(entityId ? `/api/advertisers/${entityId}` : null)

  if (loading) return <TableSkeleton rows={4} cols={4} />
  if (error) return <ErrorState message={error} onRetry={refresh} />
  if (!data?.advertiser) return <EmptyState icon={Building2} title="Advertiser not found" />

  const a = data.advertiser
  return (
    <div>
      <PageHeader
        title={a.organization.name}
        subtitle={`Advertiser since ${formatDate(a.createdAt)}`}
        breadcrumbs={[
          { label: 'Advertisers', onClick: () => setView('advertisers') },
          { label: a.organization.name },
        ]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setView('advertisers')}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns ({a.campaigns.length})</TabsTrigger>
          <TabsTrigger value="media">Media ({a.media.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({a.invoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Contact Information</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Contact Person" value={a.contactName} />
                <Row label="Phone" value={a.contactPhone} />
                <Row label="Email" value={a.contactEmail} />
                <Row label="Category" value={a.category || '—'} />
                <Row label="Status" value={<StatusBadge status={a.status} />} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Billing</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Billing Address" value={a.billingAddress || '—'} />
                <Row label="Credit Limit" value={formatINR(a.creditLimit)} />
                <Row label="GSTIN" value={a.organization.gstin || '—'} />
                <Row label="PAN" value={a.organization.pan || '—'} />
                <Row label="Website" value={a.organization.website || '—'} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardContent className="p-0">
              {a.campaigns.length === 0 ? (
                <EmptyState icon={Megaphone} title="No campaigns yet" />
              ) : (
                <div className="divide-y">
                  {a.campaigns.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-3 hover:bg-accent/50">
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(c.startDate)} → {formatDate(c.endDate)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm tabular-nums">{formatINR(c.budget, true)}</span>
                        <StatusBadge status={c.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media">
          <Card>
            <CardContent className="p-0">
              {a.media.length === 0 ? (
                <EmptyState icon={Film} title="No media uploaded" />
              ) : (
                <div className="divide-y">
                  {a.media.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between p-3 hover:bg-accent/50">
                      <div className="flex items-center gap-2">
                        <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary">
                          <Film className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{m.name}</p>
                          <p className="text-xs text-muted-foreground uppercase">{m.type} · {m.format || '—'} · {m.durationSec}s</p>
                        </div>
                      </div>
                      <StatusBadge status={m.approvalStatus} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="p-0">
              {a.invoices.length === 0 ? (
                <EmptyState icon={FileText} title="No invoices yet" />
              ) : (
                <div className="divide-y">
                  {a.invoices.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 hover:bg-accent/50">
                      <div>
                        <p className="font-medium text-sm">{inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">Issued {formatDate(inv.createdAt)} · Due {formatDate(inv.dueDate)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm tabular-nums">{formatINR(inv.totalAmount)}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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

function AddAdvertiserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    organizationName: '', contactName: '', contactPhone: '', contactEmail: '',
    category: 'restaurant', billingAddress: '', creditLimit: '50000', status: 'active',
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.organizationName || !form.contactName || !form.contactPhone || !form.contactEmail) {
      return toast.error('Organization, contact name, phone and email are required')
    }
    setLoading(true)
    try {
      await mutate('/api/advertisers', 'POST', form)
      toast.success('Advertiser created successfully')
      onCreated()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create advertiser')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Advertiser</DialogTitle>
          <DialogDescription>Register a new advertiser organization</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Organization Name *</Label>
            <Input value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} placeholder="Acme Ads Pvt Ltd" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contact Name *</Label>
              <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Ravi Sharma" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone *</Label>
              <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+91 98765 43210" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="ravi@acmeads.com" />
            </div>
          </div>
          <div>
            <Label>Billing Address</Label>
            <Textarea rows={2} value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} placeholder="Street, City, State, PIN" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Credit Limit (₹)</Label>
              <Input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
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
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create Advertiser'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
