'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import {
  PageHeader, StatusBadge, EmptyState, ErrorState, LoadingGrid,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  MapPin, Plus, RefreshCw, ArrowLeft, Building2, Smartphone, Car, Layers,
} from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function LocationsView() {
  const { user } = useAuth()
  const role = user?.role
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null)
  const [showAddCity, setShowAddCity] = useState(false)
  const [showAddZone, setShowAddZone] = useState(false)

  return (
    <div>
      <PageHeader
        title="Locations"
        subtitle={selectedCityId ? 'Zones in this city' : 'Cities in the LakhirAd network'}
        breadcrumbs={[
          { label: 'Network' },
          { label: 'Locations' },
          ...(selectedCityId ? [{ label: 'Zones', onClick: () => setSelectedCityId(null) }] : []),
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'locations.create') && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAddZone(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Zone
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setShowAddCity(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add City
                </Button>
              </>
            )}
          </>
        }
      />

      {!selectedCityId ? (
        <CitiesGrid refreshKey={refreshKey} onSelect={(id) => setSelectedCityId(id)} />
      ) : (
        <CityZonesView
          cityId={selectedCityId}
          refreshKey={refreshKey}
          onBack={() => setSelectedCityId(null)}
        />
      )}

      {showAddCity && (
        <AddCityDialog
          onClose={() => setShowAddCity(false)}
          onCreated={() => { setShowAddCity(false); setRefreshKey((k) => k + 1) }}
        />
      )}
      {showAddZone && (
        <AddZoneDialog
          cityId={selectedCityId || undefined}
          onClose={() => setShowAddZone(false)}
          onCreated={() => { setShowAddZone(false); setRefreshKey((k) => k + 1) }}
        />
      )}
    </div>
  )
}

function CitiesGrid({ refreshKey, onSelect }: { refreshKey: number; onSelect: (id: string) => void }) {
  const { data, loading, error, refresh } = useFetch<any>('/api/locations', { refreshKey })

  if (loading) return <LoadingGrid count={6} className="sm:grid-cols-2 lg:grid-cols-3" />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  const cities = data?.cities || []

  if (cities.length === 0) {
    return (
      <Card><CardContent><EmptyState icon={MapPin} title="No cities configured" description="Add your first city to start building the network" /></CardContent></Card>
    )
  }

  const totalDevices = cities.reduce((sum: number, c: any) => sum + (c.deviceCount || 0), 0)
  const totalZones = cities.reduce((sum: number, c: any) => sum + (c.zoneCount || 0), 0)
  const totalVehicles = cities.reduce((sum: number, c: any) => sum + (c.vehicleCount || 0), 0)

  return (
    <>
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <SummaryTile label="Cities" value={cities.length} icon={Building2} />
        <SummaryTile label="Zones" value={totalZones} icon={Layers} />
        <SummaryTile label="Devices" value={totalDevices} icon={Smartphone} />
      </div>

      {/* City grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cities.map((c: any) => (
          <Card
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="grid place-items-center h-10 w-10 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{c.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{c.state}</p>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <StatBox label="Zones" value={c.zoneCount} />
                <StatBox label="Devices" value={c.deviceCount} />
                <StatBox label="Vehicles" value={c.vehicleCount} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

function CityZonesView({ cityId, refreshKey, onBack }: { cityId: string; refreshKey: number; onBack: () => void }) {
  const { data, loading, error, refresh } = useFetch<any>(`/api/locations?cityId=${cityId}`, { refreshKey })

  if (loading) return <LoadingGrid count={4} className="sm:grid-cols-2 lg:grid-cols-3" />
  if (error || !data) return <ErrorState message={error || 'City not found'} onRetry={refresh} />

  const city = data.city
  const zones = city.zones || []

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> All Cities
        </Button>
      </div>

      {/* City summary */}
      <Card className="mb-4 border-l-4 border-l-primary">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="grid place-items-center h-12 w-12 rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold">{city.name}</h2>
              <p className="text-sm text-muted-foreground">{city.state} · {city.latitude && city.longitude ? `${city.latitude.toFixed(4)}, ${city.longitude.toFixed(4)}` : '—'}</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Zones</p>
                <p className="font-bold">{city.zoneCount}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Devices</p>
                <p className="font-bold">{city.deviceCount}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Vehicles</p>
                <p className="font-bold">{city.vehicleCount}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {zones.length === 0 ? (
        <Card><CardContent><EmptyState icon={MapPin} title="No zones yet" description="Add zones to organize devices within this city" /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((z: any) => (
            <Card key={z.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="grid place-items-center h-10 w-10 rounded-lg bg-primary/10 text-primary shrink-0">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{z.name}</h3>
                      <p className="text-xs text-muted-foreground">{z.radiusKm} km radius</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <StatBox label="Devices" value={z.deviceCount} />
                  <StatBox label="Radius" value={`${z.radiusKm} km`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

function SummaryTile({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="grid place-items-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{formatNumber(value)}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-bold tabular-nums">{value}</p>
    </div>
  )
}

function AddCityDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', state: '', latitude: '', longitude: '' })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name || !form.state) return toast.error('City name and state are required')
    setLoading(true)
    try {
      await mutate('/api/locations', 'POST', { type: 'city', ...form })
      toast.success('City created successfully')
      onCreated()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create city')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New City</DialogTitle>
          <DialogDescription>Create a new city for the LakhirAd network</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>City Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Vadodara" /></div>
          <div><Label>State *</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Gujarat" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Latitude</Label><Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="22.3072" /></div>
            <div><Label>Longitude</Label><Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="73.1812" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create City'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddZoneDialog({ cityId, onClose, onCreated }: { cityId?: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ cityId: cityId || '', name: '', radiusKm: '3' })
  const [loading, setLoading] = useState(false)
  const { data: citiesData } = useFetch<any>('/api/locations')

  // Auto-select first city if not provided
  useEffect(() => {
    if (!form.cityId && citiesData?.cities?.length) {
      setForm((f) => ({ ...f, cityId: citiesData.cities[0].id }))
    }
  }, [citiesData, form.cityId])

  const submit = async () => {
    if (!form.cityId || !form.name) return toast.error('City and zone name are required')
    setLoading(true)
    try {
      await mutate('/api/locations', 'POST', { type: 'zone', ...form })
      toast.success('Zone created successfully')
      onCreated()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create zone')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Zone</DialogTitle>
          <DialogDescription>Create a zone within a city</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>City *</Label>
            <Select value={form.cityId} onValueChange={(v) => setForm({ ...form, cityId: v })} disabled={!!cityId}>
              <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
              <SelectContent>
                {citiesData?.cities?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}, {c.state}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Zone Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alkapuri" /></div>
          <div><Label>Radius (km)</Label><Input type="number" min={0.5} max={50} step={0.5} value={form.radiusKm} onChange={(e) => setForm({ ...form, radiusKm: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create Zone'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
