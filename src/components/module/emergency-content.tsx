'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, StatusBadge, EmptyState, ErrorState, Pagination } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertTriangle, Siren, Megaphone, ShieldAlert, XCircle, CheckCircle2, Clock, Radio, Send, Globe, MapPin, Monitor,
} from 'lucide-react'
import { formatDateTime, timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const PRIORITY_LEVELS = [
  { value: 1, label: 'Emergency', icon: Siren, color: 'destructive', desc: 'Overrides everything' },
  { value: 2, label: 'Government / Public Notice', icon: ShieldAlert, color: 'warning', desc: 'High priority official' },
  { value: 3, label: 'Premium Campaign', icon: Megaphone, color: 'primary', desc: 'Premium ad override' },
  { value: 4, label: 'Standard Campaign', icon: Radio, color: 'info', desc: 'Standard priority' },
  { value: 5, label: 'LakhirAd House Ad', icon: Globe, color: 'default', desc: 'Lowest priority' },
]

export function EmergencyContentView() {
  const { user } = useAuth()
  const role = user?.role
  const [refreshKey, setRefreshKey] = useState(0)
  const [showPush, setShowPush] = useState(false)
  const [page, setPage] = useState(1)
  const { data, loading, error } = useFetch<any>(`/api/emergency-content?page=${page}&pageSize=20`, { refreshKey })

  const canPush = hasPermission(role, 'campaigns.publish')
  const items = data?.items || []
  const activeCount = items.filter((i: any) => i.status === 'active').length
  const expiredCount = items.filter((i: any) => i.status === 'expired').length

  const cancel = async (id: string, title: string) => {
    try {
      await mutate(`/api/emergency-content/${id}`, 'PATCH', { status: 'cancelled' })
      toast.success(`Emergency content "${title}" cancelled`)
      setRefreshKey((k) => k + 1)
    } catch (e: any) {
      toast.error(e.message || 'Failed to cancel')
    }
  }

  return (
    <div>
      <PageHeader
        title="Emergency Content"
        subtitle="Priority-based content override for the entire network"
        breadcrumbs={[{ label: 'Advertising' }, { label: 'Emergency Content' }]}
        actions={
          canPush && (
            <Button className="gap-1.5" onClick={() => setShowPush(true)}>
              <Siren className="h-4 w-4" /> Push Emergency Content
            </Button>
          )
        }
      />

      {/* Warning banner */}
      <Card className="mb-4 border-l-4 border-l-destructive bg-destructive/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">Emergency content overrides normal playlists</p>
            <p className="text-muted-foreground mt-0.5">
              Pushed content will display on targeted devices according to the configured priority and duration, overriding all scheduled campaigns.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Siren className="h-4 w-4 text-destructive" /><span className="text-xs font-semibold uppercase text-muted-foreground">Active</span></div>
          <p className="text-2xl font-bold">{activeCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-muted-foreground" /><span className="text-xs font-semibold uppercase text-muted-foreground">Expired</span></div>
          <p className="text-2xl font-bold">{expiredCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Send className="h-4 w-4 text-primary" /><span className="text-xs font-semibold uppercase text-muted-foreground">Total Pushed</span></div>
          <p className="text-2xl font-bold">{data?.total || 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Globe className="h-4 w-4 text-info" /><span className="text-xs font-semibold uppercase text-muted-foreground">Network Reach</span></div>
          <p className="text-2xl font-bold">10</p>
          <p className="text-xs text-muted-foreground">devices online</p>
        </CardContent></Card>
      </div>

      {/* Priority legend */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Priority Levels</CardTitle><CardDescription className="text-xs">Higher priority overrides lower</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
            {PRIORITY_LEVELS.map((p) => (
              <div key={p.value} className="p-2.5 rounded-md border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <p.icon className={cn('h-4 w-4', `text-${p.color === 'default' ? 'muted-foreground' : p.color}`)} />
                  <span className="text-xs font-semibold">P{p.value}</span>
                </div>
                <p className="text-xs font-medium">{p.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorState message={error} />}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : items.length === 0 ? (
        <Card><CardContent><EmptyState icon={Siren} title="No emergency content pushed" description="Push priority content to override normal playlists across the network" action={canPush && <Button onClick={() => setShowPush(true)}><Siren className="h-4 w-4 mr-2" /> Push Content</Button>} /></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => {
            const priority = PRIORITY_LEVELS.find((p) => p.value === item.priority) || PRIORITY_LEVELS[0]
            const Icon = priority.icon
            const isActive = item.status === 'active'
            const isExpired = new Date(item.expiresAt) < new Date()
            return (
              <Card key={item.id} className={cn('border-l-4', isActive && priority.color === 'destructive' && 'border-l-destructive', isActive && priority.color === 'warning' && 'border-l-warning', isActive && priority.color === 'primary' && 'border-l-primary')}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('grid place-items-center h-10 w-10 rounded-lg shrink-0',
                      priority.color === 'destructive' && 'bg-destructive/10 text-destructive',
                      priority.color === 'warning' && 'bg-warning/10 text-warning-foreground',
                      priority.color === 'primary' && 'bg-primary/10 text-primary',
                      priority.color === 'info' && 'bg-info/10 text-info',
                      priority.color === 'default' && 'bg-muted text-muted-foreground',
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{item.title}</h3>
                        <Badge variant="outline" className="text-[10px]">P{item.priority} · {priority.label}</Badge>
                        <StatusBadge status={isExpired && isActive ? 'expired' : item.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{item.message}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          {item.targetScope === 'all' && <><Globe className="h-3 w-3" /> Entire Network</>}
                          {item.targetScope === 'city' && <><MapPin className="h-3 w-3" /> {item.targetCity}</>}
                          {item.targetScope === 'zone' && <><MapPin className="h-3 w-3" /> {item.targetCity} / {item.targetZone}</>}
                          {item.targetScope === 'device' && <><Monitor className="h-3 w-3" /> Single Device</>}
                        </span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {item.durationMin}min duration</span>
                        <span className="flex items-center gap-1"><Send className="h-3 w-3" /> Pushed {timeAgo(item.pushedAt)}</span>
                        <span>Expires {formatDateTime(item.expiresAt)}</span>
                      </div>
                    </div>
                    {isActive && !isExpired && canPush && (
                      <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => cancel(item.id, item.title)}>
                        <XCircle className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    )}
                    {isActive && isExpired && (
                      <Badge variant="secondary" className="shrink-0"><CheckCircle2 className="h-3 w-3 mr-1" /> Auto-expired</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
          <Pagination page={page} pageSize={20} total={data?.total || 0} onPageChange={setPage} />
        </div>
      )}

      {showPush && <PushEmergencyDialog onClose={() => setShowPush(false)} onPushed={() => { setShowPush(false); setRefreshKey((k) => k + 1) }} />}
    </div>
  )
}

function PushEmergencyDialog({ onClose, onPushed }: { onClose: () => void; onPushed: () => void }) {
  const [form, setForm] = useState({
    title: '', message: '', priority: 1, mediaUrl: '', targetScope: 'all',
    targetCity: '', targetZone: '', targetDeviceId: '', durationMin: 30,
  })
  const [loading, setLoading] = useState(false)
  const { data: citiesData } = useFetch<any>('/api/cities')
  const cities = citiesData?.cities || []

  const submit = async () => {
    if (!form.title || !form.message) return toast.error('Title and message are required')
    setLoading(true)
    try {
      const res = await mutate('/api/emergency-content', 'POST', form)
      toast.success(res.message || 'Emergency content pushed')
      onPushed()
    } catch (e: any) {
      toast.error(e.message || 'Failed to push')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Siren className="h-5 w-5 text-destructive" /> Push Emergency Content</DialogTitle>
          <DialogDescription>This will override normal playlists on targeted devices</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Public Safety Announcement" /></div>
          <div><Label>Message *</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Content to display on screens" rows={3} /></div>
          <div>
            <Label>Priority Level</Label>
            <Select value={String(form.priority)} onValueChange={(v) => setForm({ ...form, priority: parseInt(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY_LEVELS.map((p) => <SelectItem key={p.value} value={String(p.value)}>P{p.value} — {p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Target Scope</Label>
            <Select value={form.targetScope} onValueChange={(v) => setForm({ ...form, targetScope: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Entire Network (all devices)</SelectItem>
                <SelectItem value="city">Specific City</SelectItem>
                <SelectItem value="zone">Specific Zone</SelectItem>
                <SelectItem value="device">Single Device</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.targetScope === 'city' && (
            <div>
              <Label>City</Label>
              <Select value={form.targetCity} onValueChange={(v) => setForm({ ...form, targetCity: v })}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>{cities.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {form.targetScope === 'zone' && (
            <>
              <div>
                <Label>City</Label>
                <Select value={form.targetCity} onValueChange={(v) => setForm({ ...form, targetCity: v })}>
                  <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>{cities.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.targetCity && (
                <div>
                  <Label>Zone</Label>
                  <Select value={form.targetZone} onValueChange={(v) => setForm({ ...form, targetZone: v })}>
                    <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                    <SelectContent>
                      {cities.find((c: any) => c.name === form.targetCity)?.zones?.map((z: string) => <SelectItem key={z} value={z}>{z}</SelectItem>) || []}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
          {form.targetScope === 'device' && (
            <div><Label>Device ID</Label><Input value={form.targetDeviceId} onChange={(e) => setForm({ ...form, targetDeviceId: e.target.value })} placeholder="LKD-0001" /></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Duration (minutes)</Label><Input type="number" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: parseInt(e.target.value) || 30 })} min={1} max={1440} /></div>
            <div><Label>Media URL (optional)</Label><Input value={form.mediaUrl} onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })} placeholder="/uploads/emergency.jpg" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading} className="gap-1.5"><Siren className="h-4 w-4" /> {loading ? 'Pushing...' : 'Push Now'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
