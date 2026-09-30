'use client'

import { useState, useMemo } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, EmptyState, ErrorState } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Map as MapIcon, Search, RefreshCw, Navigation, X, Signal, Wifi, Thermometer,
  MapPin, Car, User, Clock, Monitor, Crosshair, Layers,
} from 'lucide-react'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_DOT: Record<string, { color: string; ring: string; label: string }> = {
  online: { color: 'bg-emerald-500', ring: 'ring-emerald-500/30', label: 'Online' },
  offline: { color: 'bg-red-500', ring: 'ring-red-500/30', label: 'Offline' },
  warning: { color: 'bg-amber-500', ring: 'ring-amber-500/30', label: 'Warning' },
  reserved: { color: 'bg-sky-500', ring: 'ring-sky-500/30', label: 'Reserved' },
  maintenance: { color: 'bg-zinc-400', ring: 'ring-zinc-400/30', label: 'Maintenance' },
  suspended: { color: 'bg-rose-600', ring: 'ring-rose-600/30', label: 'Suspended' },
  selected: { color: 'bg-purple-500', ring: 'ring-purple-500/30', label: 'Selected' },
}

export function LiveMapView() {
  const { openDetail } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('all')
  const [zone, setZone] = useState('')
  const [status, setStatus] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const query = new URLSearchParams({
    search,
    city: city === 'all' ? '' : city,
    zone,
    status: status === 'all' ? '' : status,
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/devices/map?${query}`, { refreshKey })

  const devices = data?.devices || []
  const bounds = data?.bounds
  const cities = data?.cities || []
  const summary = data?.summary

  // Normalize lat/lng to viewport percentages (with padding)
  const positions = useMemo(() => {
    if (!bounds || devices.length === 0) return []
    const padLat = Math.max(0.05, (bounds.maxLat - bounds.minLat) * 0.1)
    const padLng = Math.max(0.05, (bounds.maxLng - bounds.minLng) * 0.1)
    const latRange = (bounds.maxLat - bounds.minLat) + padLat * 2 || 1
    const lngRange = (bounds.maxLng - bounds.minLng) + padLng * 2 || 1
    return devices.map((d: any) => {
      // Invert Y because lat goes up but screen Y goes down
      const x = ((d.longitude - bounds.minLng + padLng) / lngRange) * 100
      const y = (1 - (d.latitude - bounds.minLat + padLat) / latRange) * 100
      return { ...d, x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) }
    })
  }, [devices, bounds])

  const selectedDevice = positions.find((d: any) => d.id === selectedId)

  if (!hasPermission(role, 'devices.view')) {
    return (
      <div>
        <PageHeader title="Live Map" breadcrumbs={[{ label: 'Operations' }, { label: 'Live Map' }]} />
        <Card><CardContent><EmptyState icon={MapIcon} title="Insufficient permissions" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Live Device Map"
        subtitle="Real-time geographic view of all network devices"
        breadcrumbs={[{ label: 'Operations' }, { label: 'Live Map' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by device ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="City" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Zone..." value={zone} onChange={(e) => setZone(e.target.value)} className="w-full sm:w-32" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {/* Summary bar */}
      {summary && (
        <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
          <span className="text-muted-foreground">{summary.total} devices shown</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{summary.online} online</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{summary.offline} offline</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{summary.warning} warning</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-400" />{summary.maintenance} maintenance</span>
        </div>
      )}

      {/* City density heatmap */}
      {data?.devices && data.devices.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><MapIcon className="h-4 w-4" /> City Density Heatmap</CardTitle>
            <CardDescription className="text-xs">Device concentration and status by city</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const cityMap = new Map<string, { total: number; online: number; offline: number; warning: number }>()
              for (const d of data.devices) {
                const c = (typeof d.city === 'string' ? d.city : d.city?.name) || 'Unknown'
                if (!cityMap.has(c)) cityMap.set(c, { total: 0, online: 0, offline: 0, warning: 0 })
                const m = cityMap.get(c)!
                m.total++
                if (d.status === 'online') m.online++
                else if (d.status === 'offline') m.offline++
                else if (d.status === 'warning') m.warning++
              }
              const cities = Array.from(cityMap.entries()).map(([city, stats]) => ({ city, ...stats, onlinePct: stats.total > 0 ? (stats.online / stats.total) * 100 : 0 }))
              const maxTotal = Math.max(...cities.map((c) => c.total), 1)
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {cities.sort((a, b) => b.total - a.total).map((c) => {
                    const intensity = c.total / maxTotal
                    return (
                      <div key={c.city} className="p-3 rounded-lg border relative overflow-hidden" style={{ backgroundColor: `rgba(249, 115, 22, ${intensity * 0.15 + 0.05})` }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm">{c.city}</span>
                          <Badge variant="secondary" className="text-[10px]">{c.total}</Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" />Online</span>
                            <span className="font-semibold tabular-nums">{c.online}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" />Offline</span>
                            <span className="font-semibold tabular-nums">{c.offline}</span>
                          </div>
                          {c.warning > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" />Warning</span>
                              <span className="font-semibold tabular-nums">{c.warning}</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-success rounded-full" style={{ width: `${c.onlinePct}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{c.onlinePct.toFixed(0)}% online</p>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card><CardContent className="h-[600px] grid place-items-center"><div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></CardContent></Card>
      ) : positions.length === 0 ? (
        <Card><CardContent><EmptyState icon={MapIcon} title="No devices on map" description="Adjust filters to see devices" /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Map */}
          <Card className="lg:col-span-3 overflow-hidden">
            <CardContent className="p-0">
              <div
                className="relative w-full bg-zinc-950 overflow-hidden"
                style={{ height: '600px', backgroundImage: gridBackground() }}
              >
                {/* Lat/Lng gridlines */}
                <div className="absolute inset-0 pointer-events-none">
                  {[20, 40, 60, 80].map((p) => (
                    <div key={`h-${p}`} className="absolute left-0 right-0 border-t border-zinc-800/40" style={{ top: `${p}%` }} />
                  ))}
                  {[20, 40, 60, 80].map((p) => (
                    <div key={`v-${p}`} className="absolute top-0 bottom-0 border-l border-zinc-800/40" style={{ left: `${p}%` }} />
                  ))}
                </div>

                {/* Coordinate labels */}
                <div className="absolute top-2 left-2 text-[10px] text-zinc-600 font-mono">
                  Lat: {bounds ? `${bounds.maxLat.toFixed(2)}°N` : '—'}
                </div>
                <div className="absolute bottom-2 left-2 text-[10px] text-zinc-600 font-mono">
                  Lat: {bounds ? `${bounds.minLat.toFixed(2)}°N` : '—'}
                </div>
                <div className="absolute top-2 right-2 text-[10px] text-zinc-600 font-mono">
                  Lng: {bounds ? `${bounds.maxLng.toFixed(2)}°E` : '—'}
                </div>
                <div className="absolute bottom-2 right-2 text-[10px] text-zinc-600 font-mono">
                  Lng: {bounds ? `${bounds.minLng.toFixed(2)}°E` : '—'}
                </div>

                {/* Device markers */}
                {positions.map((d: any) => {
                  const isSelected = d.id === selectedId
                  const dot = isSelected ? STATUS_DOT.selected : STATUS_DOT[d.status] || STATUS_DOT.online
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedId(isSelected ? null : d.id)}
                      className="absolute group z-10"
                      style={{
                        left: `${d.x}%`,
                        top: `${d.y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      title={d.deviceId}
                    >
                      {/* Pulse for selected */}
                      {isSelected && (
                        <span className={cn('absolute inline-flex h-6 w-6 rounded-full opacity-75 animate-ping', dot.color)} style={{ left: '-6px', top: '-6px' }} />
                      )}
                      {/* Online pulse */}
                      {d.status === 'online' && !isSelected && (
                        <span className="absolute inline-flex h-3 w-3 rounded-full bg-emerald-500 opacity-40 animate-ping" style={{ left: '0px', top: '0px' }} />
                      )}
                      <span
                        className={cn(
                          'block h-3 w-3 rounded-full ring-2 transition-transform hover:scale-150',
                          dot.color, dot.ring
                        )}
                      />
                      {/* Hover label */}
                      <span className="absolute left-1/2 -translate-x-1/2 -top-7 hidden group-hover:block whitespace-nowrap text-[10px] bg-zinc-900 border border-zinc-700 text-zinc-100 px-1.5 py-0.5 rounded">
                        {d.deviceId}
                      </span>
                    </button>
                  )
                })}

                {/* Selected device popup */}
                {selectedDevice && (
                  <div
                    className="absolute z-20 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl text-zinc-100"
                    style={{
                      left: `${Math.min(75, Math.max(5, selectedDevice.x))}%`,
                      top: `${Math.min(80, Math.max(5, selectedDevice.y + 5))}%`,
                    }}
                  >
                    <div className="flex items-center justify-between p-2 border-b border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-3.5 w-3.5 text-orange-400" />
                        <span className="font-mono text-xs font-semibold">{selectedDevice.deviceId}</span>
                      </div>
                      <button onClick={() => setSelectedId(null)} className="text-zinc-500 hover:text-zinc-200"><X className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="p-2 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <StatusBadge status={selectedDevice.status} />
                        <button
                          onClick={() => openDetail('device-detail', selectedDevice.id)}
                          className="text-orange-400 hover:underline text-[10px]"
                        >View detail →</button>
                      </div>
                      <Row label="Vehicle" value={selectedDevice.vehicleReg} icon={Car} />
                      <Row label="Driver" value={selectedDevice.driverName} icon={User} />
                      <Row label="City / Zone" value={`${selectedDevice.city} · ${selectedDevice.zone || '—'}`} icon={MapPin} />
                      <Row label="GPS" value={`${selectedDevice.latitude.toFixed(4)}, ${selectedDevice.longitude.toFixed(4)}`} icon={Crosshair} />
                      <Row label="Network" value={selectedDevice.networkType || '—'} icon={Wifi} />
                      <Row label="Signal" value={selectedDevice.signalStrength != null ? `${selectedDevice.signalStrength}%` : '—'} icon={Signal} />
                      <Row label="Temperature" value={selectedDevice.temperature != null ? `${selectedDevice.temperature}°C` : '—'} icon={Thermometer} />
                      <Row label="Last Heartbeat" value={timeAgo(selectedDevice.lastHeartbeat)} icon={Clock} />
                      <Row label="Campaign" value={selectedDevice.currentCampaignId || 'None active'} icon={Layers} />
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div className="absolute top-12 right-2 bg-zinc-900/95 border border-zinc-800 rounded-md p-2 space-y-1 text-[10px]">
                  <p className="font-semibold text-zinc-400 uppercase tracking-wide mb-1">Legend</p>
                  {[
                    { key: 'online', label: 'Online' },
                    { key: 'offline', label: 'Offline' },
                    { key: 'warning', label: 'Warning' },
                    { key: 'selected', label: 'Selected' },
                    { key: 'maintenance', label: 'Maintenance' },
                  ].map((l) => (
                    <div key={l.key} className="flex items-center gap-1.5">
                      <span className={cn('w-2 h-2 rounded-full', STATUS_DOT[l.key]?.color)} />
                      <span className="text-zinc-300">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Side panel: device list */}
          <Card className="lg:col-span-1">
            <CardContent className="p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {positions.length} Devices
              </p>
              <div className="space-y-1 max-h-[560px] overflow-y-auto scrollbar-thin">
                {positions.map((d: any) => {
                  const dot = d.id === selectedId ? STATUS_DOT.selected : STATUS_DOT[d.status] || STATUS_DOT.online
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
                      className={cn(
                        'w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors border',
                        d.id === selectedId ? 'bg-primary/5 border-primary/30' : 'border-transparent hover:bg-accent'
                      )}
                    >
                      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dot.color)} />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-medium truncate">{d.deviceId}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{d.city} · {d.vehicleReg}</p>
                      </div>
                      <Navigation className="h-3 w-3 text-muted-foreground shrink-0" />
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, icon: Icon }: { label: string; value: any; icon?: any }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-zinc-500 flex items-center gap-1">{Icon && <Icon className="h-3 w-3" />}{label}</span>
      <span className="font-medium text-zinc-200 text-right text-[11px]">{value}</span>
    </div>
  )
}

function gridBackground(): string {
  // Subtle grid pattern using CSS gradients
  return `
    linear-gradient(rgba(24, 24, 27, 0.5) 1px, transparent 1px),
    linear-gradient(90deg, rgba(24, 24, 27, 0.5) 1px, transparent 1px),
    radial-gradient(circle at 30% 40%, rgba(249, 115, 22, 0.05), transparent 50%),
    radial-gradient(circle at 70% 60%, rgba(34, 197, 94, 0.04), transparent 50%)
  `.replace(/\s+/g, ' ')
}
