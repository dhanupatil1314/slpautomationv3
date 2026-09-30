'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, KpiCard, StatusBadge, EmptyState, TableSkeleton, Pagination, ErrorState } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Wrench, Plus, Search, RefreshCw, Clock, AlertTriangle, CheckCircle2, Car,
  MessageSquare, ArrowRightCircle, Settings, ArrowLeft, Send,
} from 'lucide-react'
import { formatDateTime, timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const PRIORITIES = ['low', 'medium', 'high', 'critical']
const CATEGORIES = ['hardware', 'software', 'network', 'screen', 'power']
const STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed']

export function ServiceView() {
  const { entityId, openDetail, setView } = useNav()
  const { user } = useAuth()
  const role = user?.role

  // Detail view when entityId present
  if (entityId) return <ServiceTicketDetail ticketId={entityId} />

  return <ServiceList role={role} openDetail={openDetail} setView={setView} />
}

function ServiceList({ role, openDetail }: { role: string | undefined; openDetail: (view: any, id: string) => void; setView: any }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [category, setCategory] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const pageSize = 15

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search,
    status: status === 'all' ? '' : status,
    priority: priority === 'all' ? '' : priority,
    category: category === 'all' ? '' : category,
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/service?${query}`, { refreshKey })

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setRefreshKey((k) => k + 1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const tickets = data?.tickets || []
  const total = data?.total || 0
  const s = data?.summary

  return (
    <div>
      <PageHeader
        title="Service Tickets"
        subtitle="Field service request tracking with SLA monitoring"
        breadcrumbs={[{ label: 'Operations' }, { label: 'Service Tickets' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'service.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5" /> New Ticket
              </Button>
            )}
          </>
        }
      />

      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="Open" value={s.open} icon={Wrench} color="warning" />
          <KpiCard label="Assigned" value={s.assigned} icon={ArrowRightCircle} color="info" />
          <KpiCard label="In Progress" value={s.in_progress} icon={Settings} color="info" />
          <KpiCard label="Resolved" value={s.resolved} icon={CheckCircle2} color="success" />
          <KpiCard label="Critical Open" value={s.critical} icon={AlertTriangle} color="destructive" />
          <KpiCard label="Overdue" value={s.overdue} icon={Clock} color="destructive" />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by ticket ID or problem..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : tickets.length === 0 ? (
        <Card><CardContent><EmptyState icon={Wrench} title="No tickets found" description="Create a new service ticket to get started" /></CardContent></Card>
      ) : (
        <>
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Ticket</th>
                    <th className="text-left p-3 font-semibold">Problem</th>
                    <th className="text-left p-3 font-semibold">Device</th>
                    <th className="text-left p-3 font-semibold">Priority</th>
                    <th className="text-left p-3 font-semibold">Engineer</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t: any) => {
                    const sla = slaStatus(t.slaDueAt, t.status)
                    return (
                      <tr key={t.id} onClick={() => openDetail('service', t.id)} className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors">
                        <td className="p-3">
                          <p className="font-mono text-xs font-semibold">{t.ticketId}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{t.category}</p>
                        </td>
                        <td className="p-3 max-w-xs"><p className="truncate">{t.problem}</p></td>
                        <td className="p-3">
                          <p className="font-medium">{t.deviceId}</p>
                          <p className="text-[10px] text-muted-foreground">{t.city} · {t.vehicleReg}</p>
                        </td>
                        <td className="p-3"><PriorityBadge priority={t.priority} /></td>
                        <td className="p-3">
                          <p className="text-xs">{t.engineerName}</p>
                          {t.engineerMobile !== '—' && <p className="text-[10px] text-muted-foreground">{t.engineerMobile}</p>}
                        </td>
                        <td className="p-3"><StatusBadge status={t.status} /></td>
                        <td className="p-3">
                          {t.status === 'resolved' || t.status === 'closed' ? (
                            <span className="text-xs text-muted-foreground">Closed</span>
                          ) : (
                            <span className={cn('text-xs font-medium', sla.color)}>{sla.label}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="md:hidden space-y-2">
            {tickets.map((t: any) => {
              const sla = slaStatus(t.slaDueAt, t.status)
              return (
                <Card key={t.id} onClick={() => openDetail('service', t.id)} className="cursor-pointer hover:shadow-md">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold">{t.ticketId}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{t.category} · {t.city}</p>
                      </div>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <p className="text-sm truncate mb-2">{t.problem}</p>
                    <div className="flex items-center justify-between text-xs">
                      <StatusBadge status={t.status} />
                      {(t.status !== 'resolved' && t.status !== 'closed') && (
                        <span className={cn('font-medium', sla.color)}>{sla.label}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showCreate && <CreateTicketDialog onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefreshKey((k) => k + 1) }} />}
    </div>
  )
}

function ServiceTicketDetail({ ticketId }: { ticketId: string }) {
  const { setView, openDetail } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [refreshKey, setRefreshKey] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const { data, loading, error } = useFetch<any>(`/api/service/${ticketId}`, { refreshKey })

  if (loading) return (
    <div>
      <PageHeader title="Ticket Detail" breadcrumbs={[{ label: 'Service', onClick: () => setView('service') }]} />
      <div className="space-y-3"><div className="h-32 bg-muted animate-pulse rounded-lg" /><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>
    </div>
  )
  if (error || !data) return (
    <div>
      <PageHeader title="Ticket Detail" breadcrumbs={[{ label: 'Service', onClick: () => setView('service') }]} />
      <ErrorState message={error || 'Ticket not found'} onRetry={() => setView('service')} />
    </div>
  )

  const t = data.ticket
  const sla = slaStatus(t.slaDueAt, t.status)

  const update = async (patch: any) => {
    setBusy(true)
    try {
      await mutate(`/api/service/${ticketId}`, 'PATCH', patch)
      toast.success('Ticket updated')
      setRefreshKey((k) => k + 1)
    } catch (e: any) {
      toast.error(e.message || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const addComment = async () => {
    if (!comment.trim()) return
    setBusy(true)
    try {
      await mutate('/api/service', 'POST', { action: 'comment', ticketId, note: comment })
      setComment('')
      setRefreshKey((k) => k + 1)
      toast.success('Comment added')
    } catch (e: any) {
      toast.error(e.message || 'Failed to add comment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t.ticketId}
        subtitle={t.problem}
        breadcrumbs={[{ label: 'Service', onClick: () => setView('service') }, { label: t.ticketId }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setView('service')}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        }
      />

      {/* Status banner */}
      <Card className={cn('mb-4 border-l-4', sla.border)}>
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className={cn('grid place-items-center h-12 w-12 rounded-lg', sla.iconBg)}>
            <Wrench className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold">{t.ticketId}</h2>
              <StatusBadge status={t.status} />
              <PriorityBadge priority={t.priority} />
              <Badge variant="outline" className="capitalize text-[10px]">{t.category}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{t.problem}</p>
          </div>
          {t.status !== 'resolved' && t.status !== 'closed' && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">SLA Due</p>
              <p className={cn('font-semibold text-sm', sla.color)}>{formatDateTime(t.slaDueAt)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: ticket info */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ticket Info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Created" value={formatDateTime(t.createdAt)} />
              <Row label="Updated" value={formatDateTime(t.updatedAt)} />
              <Row label="Resolved" value={t.resolvedAt ? formatDateTime(t.resolvedAt) : '—'} />
              {t.resolution && <Row label="Resolution" value={t.resolution} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Device / Vehicle / Driver</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {t.device && (
                <button onClick={() => openDetail('device-detail', t.device.deviceId)} className="block text-left w-full hover:bg-accent p-2 rounded-md">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <span className="font-medium">{t.device.deviceId}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6">{t.device.city?.name} · {t.device.vehicle?.registrationNo || '—'}</p>
                </button>
              )}
              {t.vehicle && (
                <div className="p-2">
                  <p className="text-xs text-muted-foreground">Vehicle</p>
                  <p className="font-medium">{t.vehicle.registrationNo}</p>
                </div>
              )}
              {t.driver && (
                <div className="p-2">
                  <p className="text-xs text-muted-foreground">Driver</p>
                  <p className="font-medium">{t.driver.name}</p>
                  <p className="text-xs text-muted-foreground">{t.driver.mobile}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assign / Status / Priority */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Manage</CardTitle><CardDescription className="text-xs">Assign engineer / change status</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {hasPermission(role, 'service.assign') && (
                <EngineerAssign currentId={t.assignedEngineerId} onChange={(id) => update({ assignedEngineerId: id })} disabled={busy} />
              )}
              {hasPermission(role, 'service.edit') && (
                <>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={t.status} onValueChange={(v) => update({ status: v })} disabled={busy}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Select value={t.priority} onValueChange={(v) => update({ priority: v })} disabled={busy}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: comments */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comments & Notes</CardTitle>
            <CardDescription className="text-xs">{t.comments?.length || 0} comments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto scrollbar-thin space-y-3 mb-4">
              {t.comments?.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No comments yet" description="Be the first to add a note" />
              ) : (
                t.comments?.map((c: any) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="text-xs">{c.authorName?.[0]?.toUpperCase() || 'S'}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{c.authorName}</span>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.note}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {hasPermission(role, 'service.edit') && (
              <div className="flex items-end gap-2 pt-3 border-t">
                <div className="flex-1">
                  <Textarea
                    placeholder="Add a comment or update note..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <Button onClick={addComment} disabled={busy || !comment.trim()} className="gap-1.5">
                  <Send className="h-4 w-4" /> Send
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function EngineerAssign({ currentId, onChange, disabled }: { currentId: string | null; onChange: (id: string) => void; disabled: boolean }) {
  const { data } = useFetch<any>('/api/engineers?status=active')
  const engineers = data?.engineers || []
  return (
    <div>
      <Label className="text-xs">Assigned Engineer</Label>
      <Select value={currentId || 'unassigned'} onValueChange={(v) => onChange(v === 'unassigned' ? '' : v)} disabled={disabled}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="Assign to..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">— Unassign —</SelectItem>
          {engineers.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name} · {e.city || '—'}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function CreateTicketDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    problem: '', category: 'hardware', priority: 'medium',
    deviceId: '', vehicleId: '', driverId: '', assignedEngineerId: '', slaHours: '',
  })
  const [loading, setLoading] = useState(false)
  const { data: engineersData } = useFetch<any>('/api/engineers?status=active')

  const submit = async () => {
    if (!form.problem) return toast.error('Problem description required')
    setLoading(true)
    try {
      await mutate('/api/service', 'POST', form)
      toast.success('Ticket created')
      onCreated()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create ticket')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Service Ticket</DialogTitle>
          <DialogDescription>Open a field service request</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Problem Description *</Label><Textarea value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} placeholder="Describe the issue..." rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Device ID</Label><Input value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} placeholder="optional" /></div>
            <div><Label>Vehicle Reg</Label><Input value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} placeholder="optional" /></div>
          </div>
          <div>
            <Label>Assign Engineer</Label>
            <Select value={form.assignedEngineerId || 'unassigned'} onValueChange={(v) => setForm({ ...form, assignedEngineerId: v === 'unassigned' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Leave unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">— Unassigned —</SelectItem>
                {engineersData?.engineers?.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name} · {e.city || '—'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>SLA Hours (optional, defaults by priority)</Label><Input type="number" value={form.slaHours} onChange={(e) => setForm({ ...form, slaHours: e.target.value })} placeholder="e.g. 12" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create Ticket'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    critical: 'bg-destructive/15 text-destructive border-destructive/30',
    high: 'bg-warning/15 text-warning-foreground border-warning/30',
    medium: 'bg-info/15 text-info border-info/30',
    low: 'bg-muted text-muted-foreground border-border',
  }
  return <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize', map[priority])}>
    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />{priority}
  </span>
}

function slaStatus(dueAt: string | null, status: string): { label: string; color: string; border: string; iconBg: string } {
  if (!dueAt || status === 'resolved' || status === 'closed') {
    return { label: '—', color: 'text-muted-foreground', border: 'border-l-muted', iconBg: 'bg-muted text-muted-foreground' }
  }
  const due = new Date(dueAt)
  const now = new Date()
  const hoursLeft = (due.getTime() - now.getTime()) / 3600000
  if (hoursLeft < 0) return { label: `Overdue ${Math.abs(hoursLeft).toFixed(0)}h`, color: 'text-destructive', border: 'border-l-destructive', iconBg: 'bg-destructive/15 text-destructive' }
  if (hoursLeft < 12) return { label: `${hoursLeft.toFixed(0)}h left`, color: 'text-warning-foreground', border: 'border-l-warning', iconBg: 'bg-warning/15 text-warning-foreground' }
  return { label: `${hoursLeft.toFixed(0)}h left`, color: 'text-success', border: 'border-l-success', iconBg: 'bg-success/15 text-success' }
}
