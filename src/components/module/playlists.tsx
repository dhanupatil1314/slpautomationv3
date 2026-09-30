'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import {
  PageHeader, StatusBadge, EmptyState, ErrorState, TableSkeleton, Pagination, KpiCard,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  ListVideo, Plus, Search, RefreshCw, ArrowLeft, ArrowUp, ArrowDown, Trash2,
  Pencil, Film, MapPin, Clock, Layers, CheckCircle2, X,
} from 'lucide-react'
import { formatNumber, secondsToDuration } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['draft', 'active', 'archived']
const PRIORITY_LABELS: Record<number, { label: string; cls: string }> = {
  1: { label: 'P1 — Critical', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  2: { label: 'P2 — High',     cls: 'bg-warning/15 text-warning-foreground border-warning/30' },
  3: { label: 'P3 — Premium',  cls: 'bg-primary/15 text-primary border-primary/30' },
  4: { label: 'P4 — Standard', cls: 'bg-info/15 text-info border-info/30' },
  5: { label: 'P5 — House',    cls: 'bg-muted text-muted-foreground border-border' },
}

export function PlaylistsView() {
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

  const { data, loading, error, refresh } = useFetch<any>(`/api/playlists?${query}`, { refreshKey })

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setRefreshKey((k) => k + 1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const playlists = data?.playlists || []
  const total = data?.total || 0
  const activeCount = playlists.filter((p: any) => p.status === 'active').length
  const totalItems = playlists.reduce((s: number, p: any) => s + p.itemCount, 0)
  const totalDurationSum = playlists.reduce((s: number, p: any) => s + p.totalDuration, 0)

  return (
    <div>
      <PageHeader
        title="Playlists"
        subtitle={`${formatNumber(total)} playlists across the network`}
        breadcrumbs={[{ label: 'Advertising' }, { label: 'Playlists' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'playlists.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" /> New Playlist
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
        <KpiCard label="Total Playlists" value={formatNumber(total)} icon={ListVideo} color="primary" />
        <KpiCard label="Active" value={formatNumber(activeCount)} icon={CheckCircle2} color="success" />
        <KpiCard label="Total Media Items" value={formatNumber(totalItems)} icon={Layers} color="info" />
        <KpiCard label="Total Runtime" value={secondsToDuration(totalDurationSum)} icon={Clock} color="primary" hint="Across all playlists" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search playlists by name..."
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
        <TableSkeleton rows={5} cols={5} />
      ) : playlists.length === 0 ? (
        <Card><CardContent><EmptyState icon={ListVideo} title="No playlists found" description="Create your first playlist to bundle media for campaigns" /></CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Name</th>
                    <th className="text-left p-3 font-semibold">City / Zone</th>
                    <th className="text-left p-3 font-semibold">Items</th>
                    <th className="text-left p-3 font-semibold">Runtime</th>
                    <th className="text-left p-3 font-semibold">Priority</th>
                    <th className="text-left p-3 font-semibold">Campaigns</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {playlists.map((p: any) => (
                    <tr
                      key={p.id}
                      onClick={() => openDetail('playlist-detail', p.id)}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary shrink-0">
                            <ListVideo className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.description || 'No description'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-sm">
                        <p className="flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{p.city}</p>
                        <p className="text-xs text-muted-foreground pl-4">{p.zone}</p>
                      </td>
                      <td className="p-3 font-medium tabular-nums">{p.itemCount}</td>
                      <td className="p-3 tabular-nums text-sm">{secondsToDuration(p.totalDuration)}</td>
                      <td className="p-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', PRIORITY_LABELS[p.priority]?.cls || PRIORITY_LABELS[5].cls)}>
                          {PRIORITY_LABELS[p.priority]?.label || `P${p.priority}`}
                        </span>
                      </td>
                      <td className="p-3 tabular-nums text-sm">{p.campaignCount}</td>
                      <td className="p-3"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {playlists.map((p: any) => (
              <Card key={p.id} onClick={() => openDetail('playlist-detail', p.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary shrink-0">
                        <ListVideo className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{p.city} · {p.zone}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{p.itemCount} items</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{secondsToDuration(p.totalDuration)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showAdd && <CreatePlaylistDialog onClose={() => setShowAdd(false)} onCreated={(id) => { setShowAdd(false); if (id) openDetail('playlist-detail', id); else setRefreshKey((k) => k + 1) }} />}
    </div>
  )
}

// ============ Playlist Builder Detail (view='playlist-detail') ============

export function PlaylistDetailView() {
  const { entityId, setView } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAddMedia, setShowAddMedia] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const { data, loading, error, refresh } = useFetch<any>(entityId ? `/api/playlists/${entityId}` : null, { refreshKey })

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error) return <ErrorState message={error} onRetry={refresh} />
  if (!data?.playlist) return <EmptyState icon={ListVideo} title="Playlist not found" />

  const p = data.playlist
  const canEdit = hasPermission(role, 'playlists.edit')
  const canDelete = hasPermission(role, 'playlists.delete')

  const addItem = async (mediaId: string, durationSec?: number, frequency?: number) => {
    try {
      await mutate(`/api/playlists/${p.id}`, 'POST', { action: 'add', mediaId, durationSec, frequency })
      toast.success('Media added to playlist')
      setShowAddMedia(false)
      setRefreshKey((k) => k + 1)
    } catch (e: any) { toast.error(e.message || 'Failed to add media') }
  }

  const removeItem = async (itemId: string) => {
    try {
      await mutate(`/api/playlists/${p.id}`, 'POST', { action: 'remove', itemId })
      toast.success('Item removed')
      setRefreshKey((k) => k + 1)
    } catch (e: any) { toast.error(e.message || 'Failed to remove item') }
  }

  const moveItem = async (index: number, dir: -1 | 1) => {
    const items = [...p.items]
    const swapWith = index + dir
    if (swapWith < 0 || swapWith >= items.length) return
    // Swap order values then persist
    const a = items[index], b = items[swapWith]
    const reorder = items.map((it: any, i: number) => ({ id: it.id, order: i === index ? b.order : i === swapWith ? a.order : it.order }))
    try {
      await mutate(`/api/playlists/${p.id}`, 'PATCH', { reorder })
      setRefreshKey((k) => k + 1)
    } catch (e: any) { toast.error(e.message || 'Failed to reorder') }
  }

  const deletePlaylist = async () => {
    if (!confirm(`Delete playlist "${p.name}"? This cannot be undone.`)) return
    try {
      await mutate(`/api/playlists/${p.id}`, 'DELETE')
      toast.success('Playlist deleted')
      setView('playlists')
    } catch (e: any) { toast.error(e.message || 'Failed to delete') }
  }

  return (
    <div>
      <PageHeader
        title={p.name}
        subtitle={`${p.items.length} items · ${secondsToDuration(p.totalDuration)} total runtime`}
        breadcrumbs={[
          { label: 'Playlists', onClick: () => setView('playlists') },
          { label: p.name },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setView('playlists')}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            {canEdit && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowEdit(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setShowAddMedia(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Media
                </Button>
              </>
            )}
            {canDelete && (
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={deletePlaylist}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </>
        }
      />

      {/* Header card */}
      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
          <Stat label="Status" value={<StatusBadge status={p.status} />} />
          <Stat label="Priority" value={<span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', PRIORITY_LABELS[p.priority]?.cls)}>{PRIORITY_LABELS[p.priority]?.label || `P${p.priority}`}</span>} />
          <Stat label="City / Zone" value={<span className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{p.city || '—'} · {p.zone || '—'}</span>} />
          <Stat label="Items" value={<span className="tabular-nums">{p.items.length}</span>} />
          <Stat label="Total Runtime" value={<span className="tabular-nums">{secondsToDuration(p.totalDuration)}</span>} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4" /> Playlist Items</CardTitle>
          <span className="text-xs text-muted-foreground">{p.items.length} items · drag-ordered by index</span>
        </CardHeader>
        <CardContent className="p-0">
          {p.items.length === 0 ? (
            <EmptyState
              icon={Film}
              title="Playlist is empty"
              description="Add approved media to build your playlist"
              action={canEdit ? <Button size="sm" className="gap-1.5" onClick={() => setShowAddMedia(true)}><Plus className="h-3.5 w-3.5" /> Add Media</Button> : undefined}
            />
          ) : (
            <div className="divide-y max-h-[60vh] overflow-y-auto">
              {p.items.map((item: any, idx: number) => (
                <div key={item.id} className="flex items-center gap-3 p-3 hover:bg-accent/40">
                  {/* Order + arrows */}
                  <div className="flex flex-col items-center gap-0.5 shrink-0 w-8">
                    <span className="text-xs font-bold text-muted-foreground tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
                    {canEdit && (
                      <div className="flex flex-col">
                        <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-primary disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                        <button onClick={() => moveItem(idx, 1)} disabled={idx === p.items.length - 1} className="text-muted-foreground hover:text-primary disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                      </div>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className={cn(
                    'relative grid place-items-center h-14 w-20 rounded-md shrink-0 bg-gradient-to-br text-primary-foreground',
                    item.media?.type === 'video' ? 'from-primary/80 to-primary' : 'from-success/80 to-success'
                  )}>
                    <Film className="h-5 w-5 opacity-90" />
                    <span className="absolute bottom-0.5 right-0.5 text-[10px] bg-black/40 px-1 rounded uppercase">{item.media?.format || '—'}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.media?.name || 'Unknown media'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.media?.type} · {item.media?.resolution || '—'} · {item.media?.durationSec || 0}s base
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <Badge variant="outline" className="text-[10px] gap-1"><Clock className="h-2.5 w-2.5" />{item.durationSec}s</Badge>
                      <Badge variant="outline" className="text-[10px]">×{item.frequency} freq</Badge>
                      <StatusBadge status={item.media?.approvalStatus || 'approved'} />
                    </div>
                  </div>

                  {/* Computed duration */}
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-xs text-muted-foreground">Effective</p>
                    <p className="font-semibold tabular-nums text-sm">{secondsToDuration(item.durationSec * item.frequency)}</p>
                  </div>

                  {/* Remove */}
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked campaigns */}
      {p.campaigns?.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2"><CardTitle className="text-base">Linked Campaigns ({p.campaigns.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-60 overflow-y-auto">
              {p.campaigns.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 hover:bg-accent/50">
                  <div>
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">Campaign</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showAddMedia && <AddMediaDialog onClose={() => setShowAddMedia(false)} onAdd={addItem} />}
      {showEdit && <EditPlaylistDialog playlist={p} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); setRefreshKey((k) => k + 1) }} />}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1">{value}</div>
    </div>
  )
}

// ============ Create Playlist Dialog ============

function CreatePlaylistDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id?: string) => void }) {
  const [form, setForm] = useState({ name: '', description: '', city: '', zone: '', priority: '4', status: 'draft' })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name) return toast.error('Name is required')
    setLoading(true)
    try {
      const res = await mutate('/api/playlists', 'POST', { ...form, priority: Number(form.priority) })
      toast.success('Playlist created')
      onCreated(res?.playlist?.id)
    } catch (e: any) { toast.error(e.message || 'Failed to create playlist') }
    finally { setLoading(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Playlist</DialogTitle>
          <DialogDescription>Bundles approved media into an ordered sequence for campaigns</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diwali Festival — Vadodara Auto" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes about this playlist" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Vadodara" />
            </div>
            <div>
              <Label>Zone</Label>
              <Input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} placeholder="Alkapuri" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
          <Button onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create Playlist'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Edit Playlist Dialog ============

function EditPlaylistDialog({ playlist, onClose, onSaved }: { playlist: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: playlist.name || '',
    description: playlist.description || '',
    city: playlist.city === '—' ? '' : playlist.city,
    zone: playlist.zone === '—' ? '' : playlist.zone,
    priority: String(playlist.priority || 4),
    status: playlist.status || 'draft',
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name) return toast.error('Name is required')
    setLoading(true)
    try {
      await mutate(`/api/playlists/${playlist.id}`, 'PATCH', { ...form, priority: Number(form.priority) })
      toast.success('Playlist updated')
      onSaved()
    } catch (e: any) { toast.error(e.message || 'Failed to update') }
    finally { setLoading(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Playlist</DialogTitle>
          <DialogDescription>Update playlist metadata</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>Zone</Label>
              <Input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
          <Button onClick={submit} disabled={loading}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Add Media Dialog (picks from approved media) ============

function AddMediaDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (mediaId: string, durationSec?: number, frequency?: number) => void }) {
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [durationSec, setDurationSec] = useState('15')
  const [frequency, setFrequency] = useState('1')
  const [adding, setAdding] = useState(false)

  const query = new URLSearchParams({ pageSize: '60', search, status: 'approved' }).toString()
  const { data, loading } = useFetch<any>(`/api/media?${query}`, { refreshKey })

  useEffect(() => {
    const t = setTimeout(() => setRefreshKey((k) => k + 1), 300)
    return () => clearTimeout(t)
  }, [search])

  const media = data?.media || []
  const selected = media.find((m: any) => m.id === selectedId)

  const submit = async () => {
    if (!selectedId) return toast.error('Select a media to add')
    setAdding(true)
    try {
      await onAdd(selectedId, Number(durationSec), Number(frequency))
    } finally { setAdding(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Media to Playlist</DialogTitle>
          <DialogDescription>Select from approved media assets</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search approved media..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[40vh] overflow-y-auto p-1">
          {loading ? (
            <div className="col-span-full text-center py-8 text-muted-foreground text-sm">Loading media...</div>
          ) : media.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground text-sm">No approved media found</div>
          ) : media.map((m: any) => (
            <button
              key={m.id}
              onClick={() => { setSelectedId(m.id); setDurationSec(String(m.durationSec || 15)) }}
              className={cn(
                'relative text-left rounded-md border-2 overflow-hidden hover:border-primary/60 transition-colors',
                selectedId === m.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'
              )}
            >
              <div className={cn(
                'relative aspect-video grid place-items-center bg-gradient-to-br text-primary-foreground',
                m.type === 'video' ? 'from-primary/80 to-primary' : 'from-success/80 to-success'
              )}>
                <Film className="h-5 w-5 opacity-90" />
                <span className="absolute bottom-1 right-1 text-[10px] bg-black/40 px-1 rounded uppercase">{m.format}</span>
                {selectedId === m.id && (
                  <div className="absolute inset-0 bg-primary/30 grid place-items-center">
                    <CheckCircle2 className="h-6 w-6 text-white drop-shadow" />
                  </div>
                )}
              </div>
              <div className="p-1.5">
                <p className="text-xs font-medium truncate">{m.name}</p>
                <p className="text-[10px] text-muted-foreground">{m.durationSec}s · {m.resolution || '—'}</p>
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="border-t pt-3 grid grid-cols-2 gap-3">
            <div>
              <Label>Duration (sec)</Label>
              <Input type="number" min="1" value={durationSec} onChange={(e) => setDurationSec(e.target.value)} />
            </div>
            <div>
              <Label>Frequency (plays per cycle)</Label>
              <Input type="number" min="1" value={frequency} onChange={(e) => setFrequency(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
          <Button onClick={submit} disabled={!selectedId || adding}>
            {adding ? 'Adding...' : `Add ${selected ? `"${selected.name}"` : 'Media'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
