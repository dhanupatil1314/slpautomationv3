'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, StatusBadge, EmptyState, ErrorState } from '@/components/shared'
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
  Layers, Plus, RefreshCw, Monitor, MapPin, Trash2, Users, Search, X, ChevronRight, CheckCircle2,
} from 'lucide-react'
import { formatNumber, timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const COLOR_OPTIONS = [
  { value: 'primary', label: 'Orange', class: 'bg-primary' },
  { value: 'success', label: 'Green', class: 'bg-success' },
  { value: 'warning', label: 'Amber', class: 'bg-warning' },
  { value: 'info', label: 'Blue', class: 'bg-info' },
  { value: 'destructive', label: 'Red', class: 'bg-destructive' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
]

const COLOR_MAP: Record<string, string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning-foreground border-warning/20',
  info: 'bg-info/10 text-info border-info/20',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  purple: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
}

export function DeviceGroupsView() {
  const { user } = useAuth()
  const role = user?.role
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const { data, loading, error } = useFetch<any>('/api/device-groups', { refreshKey })

  const groups = data?.groups || []

  return (
    <div>
      <PageHeader
        title="Device Groups"
        subtitle="Organize devices into logical groups for easier campaign targeting"
        breadcrumbs={[{ label: 'Network' }, { label: 'Device Groups' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'devices.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5" /> New Group
              </Button>
            )}
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Layers className="h-4 w-4 text-primary" /><span className="text-xs font-semibold uppercase text-muted-foreground">Total Groups</span></div>
          <p className="text-2xl font-bold">{formatNumber(data?.total || 0)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Monitor className="h-4 w-4 text-success" /><span className="text-xs font-semibold uppercase text-muted-foreground">Grouped Devices</span></div>
          <p className="text-2xl font-bold">{formatNumber(groups.reduce((sum: number, g: any) => sum + g.deviceCount, 0))}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><MapPin className="h-4 w-4 text-info" /><span className="text-xs font-semibold uppercase text-muted-foreground">City-based</span></div>
          <p className="text-2xl font-bold">{formatNumber(groups.filter((g: any) => g.city).length)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-warning-foreground" /><span className="text-xs font-semibold uppercase text-muted-foreground">Avg Group Size</span></div>
          <p className="text-2xl font-bold">{data?.total ? Math.round(groups.reduce((s: number, g: any) => s + g.deviceCount, 0) / data.total) : 0}</p>
        </CardContent></Card>
      </div>

      {error && <ErrorState message={error} />}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : groups.length === 0 ? (
        <Card><CardContent><EmptyState icon={Layers} title="No device groups yet" description="Create groups to organize devices by city, zone, or custom criteria for easier campaign targeting" action={hasPermission(role, 'devices.create') && <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" /> New Group</Button>} /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g: any) => (
            <DeviceGroupCard
              key={g.id}
              group={g}
              expanded={expandedGroup === g.id}
              onToggle={() => setExpandedGroup(expandedGroup === g.id ? null : g.id)}
              onDeleted={() => setRefreshKey((k) => k + 1)}
              role={role}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateGroupDialog onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefreshKey((k) => k + 1) }} />}
    </div>
  )
}

function DeviceGroupCard({ group, expanded, onToggle, onDeleted, role }: { group: any; expanded: boolean; onToggle: () => void; onDeleted: () => void; role?: string }) {
  const colorClass = COLOR_MAP[group.color] || COLOR_MAP.primary
  const canDelete = hasPermission(role, 'devices.delete')

  const handleDelete = async () => {
    if (!confirm(`Delete group "${group.name}"? This won't affect the devices.`)) return
    try {
      await mutate(`/api/device-groups/${group.id}`, 'DELETE')
      toast.success(`Group "${group.name}" deleted`)
      onDeleted()
    } catch (e: any) {
      toast.error(e.message || 'Delete failed')
    }
  }

  return (
    <Card className={cn('border-l-4', expanded && 'shadow-md')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={cn('grid place-items-center h-10 w-10 rounded-lg shrink-0', colorClass)}>
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{group.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{group.description || 'No description'}</p>
            </div>
          </div>
          {canDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Badge variant="outline" className="text-[10px] gap-1">
            <Monitor className="h-3 w-3" /> {group.deviceCount} devices
          </Badge>
          {group.city && <Badge variant="outline" className="text-[10px] gap-1"><MapPin className="h-3 w-3" /> {group.city}</Badge>}
          {group.zone && <Badge variant="secondary" className="text-[10px]">{group.zone}</Badge>}
        </div>

        <button onClick={onToggle} className="w-full flex items-center justify-between gap-2 p-2 rounded-md hover:bg-accent transition-colors text-xs font-medium text-muted-foreground">
          <span>{expanded ? 'Hide devices' : `Show ${group.deviceCount} devices`}</span>
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
        </button>

        {expanded && group.devices.length > 0 && (
          <div className="mt-2 space-y-1 border-t pt-2">
            {group.devices.map((d: any) => (
              <div key={d.id} className="flex items-center gap-2 p-1.5 rounded text-xs hover:bg-accent/50 transition-colors">
                <div className={cn('w-1.5 h-1.5 rounded-full', d.status === 'online' ? 'bg-success' : 'bg-destructive')} />
                <span className="font-medium">{d.deviceId}</span>
                <span className="text-muted-foreground truncate flex-1">{d.vehicleReg}</span>
                <span className="text-muted-foreground">{d.city}</span>
              </div>
            ))}
            {group.deviceCount > group.devices.length && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">+ {group.deviceCount - group.devices.length} more...</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CreateGroupDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', city: '', zone: '', color: 'primary' })
  const [loading, setLoading] = useState(false)
  const { data: citiesData } = useFetch<any>('/api/cities')
  const cities = citiesData?.cities || []
  const { data: devicesData } = useFetch<any>('/api/devices?pageSize=100')
  const allDevices = devicesData?.devices || []
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [deviceSearch, setDeviceSearch] = useState('')

  const filteredDevices = allDevices.filter((d: any) =>
    !deviceSearch || d.deviceId.toLowerCase().includes(deviceSearch.toLowerCase()) || d.city.toLowerCase().includes(deviceSearch.toLowerCase())
  )

  const toggleDevice = (id: string) => {
    const next = new Set(selectedDevices)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedDevices(next)
  }

  const submit = async () => {
    if (!form.name) return toast.error('Group name is required')
    setLoading(true)
    try {
      await mutate('/api/device-groups', 'POST', { ...form, deviceIds: Array.from(selectedDevices) })
      toast.success(`Device group "${form.name}" created`)
      onCreated()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> New Device Group</DialogTitle>
          <DialogDescription>Organize devices for easier campaign targeting</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Group Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Vadodara Premium Screens" /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City (optional)</Label>
              <Select value={form.city || 'any'} onValueChange={(v) => setForm({ ...form, city: v === 'any' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Any city" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any city</SelectItem>
                  {cities.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Zone (optional)</Label><Input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} placeholder="e.g. Alkapuri" /></div>
          </div>
          <div>
            <Label>Color Tag</Label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button key={c.value} onClick={() => setForm({ ...form, color: c.value })} className={cn('h-8 w-8 rounded-lg border-2 transition-all', c.class, form.color === c.value ? 'border-foreground scale-110' : 'border-transparent')} title={c.label} />
              ))}
            </div>
          </div>

          {/* Device selection */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <Label>Select Devices ({selectedDevices.size} selected)</Label>
              {selectedDevices.size > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedDevices(new Set())}>Clear</Button>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search devices..." value={deviceSearch} onChange={(e) => setDeviceSearch(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
            <div className="max-h-40 overflow-y-auto scrollbar-thin border rounded-md divide-y">
              {filteredDevices.map((d: any) => (
                <button
                  key={d.id}
                  onClick={() => toggleDevice(d.id)}
                  className={cn('w-full flex items-center gap-2 p-2 text-xs hover:bg-accent transition-colors text-left', selectedDevices.has(d.id) && 'bg-primary/5')}
                >
                  <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0', selectedDevices.has(d.id) ? 'bg-primary border-primary' : 'border-border')}>
                    {selectedDevices.has(d.id) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className="font-medium">{d.deviceId}</span>
                  <span className="text-muted-foreground">{d.city}</span>
                  <span className="text-muted-foreground ml-auto">{d.vehicleReg}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading || !form.name}>{loading ? 'Creating...' : 'Create Group'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
