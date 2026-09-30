'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, StatusBadge, EmptyState, TableSkeleton, ErrorState } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Wrench, User, Plus, Search, RefreshCw, Phone, Mail, MapPin, ArrowLeft, CheckCircle2, Clock,
} from 'lucide-react'
import { formatDateTime, timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const SPECIALIZATIONS = ['General', 'Hardware', 'Screen Repair', 'Network', 'Power', 'Software']
const STATUSES = ['active', 'on_leave', 'inactive']

export function EngineersView() {
  const { entityId, openDetail, setView } = useNav()
  const { user } = useAuth()
  const role = user?.role

  if (entityId) return <EngineerDetail engineerId={entityId} />

  return <EngineerList role={role} openDetail={openDetail} setView={setView} />
}

function EngineerList({ role, openDetail, setView }: { role: string | undefined; openDetail: (view: any, id: string) => void; setView: any }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAdd, setShowAdd] = useState(false)

  const query = new URLSearchParams({
    search,
    status: status === 'all' ? '' : status,
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/engineers?${query}`, { refreshKey })

  useEffect(() => {
    const t = setTimeout(() => setRefreshKey((k) => k + 1), 300)
    return () => clearTimeout(t)
  }, [search])

  const engineers = data?.engineers || []

  return (
    <div>
      <PageHeader
        title="Field Engineers"
        subtitle="Manage field service engineers and their assignments"
        breadcrumbs={[{ label: 'Operations' }, { label: 'Engineers' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'engineers.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Engineer
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, mobile, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : engineers.length === 0 ? (
        <Card><CardContent><EmptyState icon={User} title="No engineers found" description="Add a field engineer to get started" /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {engineers.map((e: any) => (
            <Card key={e.id} onClick={() => openDetail('engineers', e.id)} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {e.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">{e.name}</p>
                      <StatusBadge status={e.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">{e.specialization}</p>
                    <div className="flex flex-col gap-0.5 mt-2 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{e.mobile}</span>
                      {e.email && <span className="flex items-center gap-1 text-muted-foreground truncate"><Mail className="h-3 w-3" />{e.email}</span>}
                      {e.city && <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{e.city}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                  <Badge variant="outline" className="text-warning-foreground border-warning/30 bg-warning/10 gap-1">
                    <Clock className="h-3 w-3" /> {e.assignedTicketsCount} Active
                  </Badge>
                  <Badge variant="outline" className="text-success border-success/30 bg-success/10 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {e.resolvedCount} Resolved
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showAdd && <AddEngineerDialog onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); setRefreshKey((k) => k + 1) }} />}
    </div>
  )
}

function EngineerDetail({ engineerId }: { engineerId: string }) {
  const { setView, openDetail } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [refreshKey, setRefreshKey] = useState(0)
  const [editing, setEditing] = useState(false)
  const { data, loading, error } = useFetch<any>(`/api/engineers/${engineerId}`, { refreshKey })

  if (loading) return (
    <div>
      <PageHeader title="Engineer Detail" breadcrumbs={[{ label: 'Engineers', onClick: () => setView('engineers') }]} />
      <div className="space-y-3"><div className="h-32 bg-muted animate-pulse rounded-lg" /><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>
    </div>
  )
  if (error || !data) return (
    <div>
      <PageHeader title="Engineer Detail" breadcrumbs={[{ label: 'Engineers', onClick: () => setView('engineers') }]} />
      <ErrorState message={error || 'Not found'} onRetry={() => setView('engineers')} />
    </div>
  )

  const e = data.engineer

  return (
    <div>
      <PageHeader
        title={e.name}
        subtitle={`${e.specialization} · ${e.city || 'No city'}`}
        breadcrumbs={[{ label: 'Engineers', onClick: () => setView('engineers') }, { label: e.name }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setView('engineers')}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {e.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{e.name}</p>
                <StatusBadge status={e.status} />
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <Row label="Mobile" value={e.mobile} icon={Phone} />
              <Row label="Email" value={e.email || '—'} icon={Mail} />
              <Row label="City" value={e.city || '—'} icon={MapPin} />
              <Row label="Specialization" value={e.specialization} icon={Wrench} />
              <Row label="Joined" value={formatDateTime(e.createdAt)} icon={Clock} />
            </div>
            {hasPermission(role, 'engineers.edit') && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setEditing(true)}>Edit Profile</Button>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Assigned Tickets</CardTitle>
            <CardDescription className="text-xs">{e.tickets.length} tickets handled</CardDescription>
          </CardHeader>
          <CardContent>
            {e.tickets.length === 0 ? (
              <EmptyState icon={Wrench} title="No tickets assigned" />
            ) : (
              <div className="max-h-96 overflow-y-auto scrollbar-thin space-y-1">
                {e.tickets.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => openDetail('service', t.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-accent transition-colors text-left border"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{t.ticketId}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{t.problem}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.deviceId} · {t.city} · {timeAgo(t.createdAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {editing && (
        <EditEngineerDialog engineer={e} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setRefreshKey((k) => k + 1) }} />
      )}
    </div>
  )
}

function Row({ label, value, icon: Icon }: { label: string; value: any; icon?: any }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground flex items-center gap-1.5">{Icon && <Icon className="h-3 w-3" />}{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

function AddEngineerDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', mobile: '', email: '', city: '', specialization: 'General' })
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    if (!form.name || !form.mobile) return toast.error('Name and mobile required')
    setLoading(true)
    try {
      await mutate('/api/engineers', 'POST', form)
      toast.success('Engineer added')
      onCreated()
    } catch (e: any) { toast.error(e.message || 'Failed') } finally { setLoading(false) }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Field Engineer</DialogTitle><DialogDescription>Register a new service engineer</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Mobile *</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="+91 98765 43210" /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div>
            <Label>Specialization</Label>
            <Select value={form.specialization} onValueChange={(v) => setForm({ ...form, specialization: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SPECIALIZATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Adding...' : 'Add Engineer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditEngineerDialog({ engineer, onClose, onSaved }: { engineer: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: engineer.name, mobile: engineer.mobile, email: engineer.email || '',
    city: engineer.city || '', specialization: engineer.specialization, status: engineer.status,
  })
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try {
      await mutate(`/api/engineers/${engineer.id}`, 'PATCH', form)
      toast.success('Engineer updated')
      onSaved()
    } catch (e: any) { toast.error(e.message || 'Failed') } finally { setLoading(false) }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Engineer</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div>
            <Label>Specialization</Label>
            <Select value={form.specialization} onValueChange={(v) => setForm({ ...form, specialization: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SPECIALIZATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
