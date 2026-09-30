'use client'

import { useState, useEffect } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import {
  PageHeader, StatusBadge, EmptyState, ErrorState, TableSkeleton, KpiCard,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Monitor, RefreshCw, CheckCircle2, Lock, AlertOctagon, PlayCircle, MapPin, Ban, Calculator, TrendingUp, Sparkles,
} from 'lucide-react'
import { formatNumber, formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'

const AVAILABILITY_OPTIONS = [
  { value: 'all', label: 'All Availability' },
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved (Active Campaign)' },
  { value: 'maintenance', label: 'Maintenance / Suspended' },
  { value: 'offline', label: 'Offline' },
]

export function InventoryView() {
  const { user } = useAuth()
  const role = user?.role
  const [cityFilter, setCityFilter] = useState('all')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [availability, setAvailability] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)

  // When city changes, reset zone filter inline (avoids setState-in-effect)
  const onCityChange = (v: string) => {
    setCityFilter(v)
    setZoneFilter('all')
  }

  const query = new URLSearchParams({
    city: cityFilter === 'all' ? '' : cityFilter,
    zone: zoneFilter === 'all' ? '' : zoneFilter,
    availability: availability === 'all' ? '' : availability,
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/inventory?${query}`, { refreshKey })
  const { data: citiesData } = useFetch<any>('/api/cities')

  if (!hasPermission(role, 'inventory.view')) {
    return (
      <div>
        <PageHeader title="Inventory" breadcrumbs={[{ label: 'Advertising' }, { label: 'Inventory' }]} />
        <Card><CardContent><EmptyState icon={Ban} title="Access denied" description="You don't have permission to view inventory." /></CardContent></Card>
      </div>
    )
  }

  const summary = data?.summary || { total: 0, available: 0, reserved: 0, maintenance: 0, offline: 0 }
  const byCity = data?.byCity || []
  const byZone = data?.byZone || []
  const byVehicleType = data?.byVehicleType || []
  const devices = data?.devices || []
  const pct = (n: number) => summary.total > 0 ? Math.round((n / summary.total) * 100) : 0

  const cities = citiesData?.cities || []
  const selectedCityObj = cities.find((c: any) => c.name === cityFilter)
  const zones = selectedCityObj?.zones || []

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle={`${formatNumber(summary.total)} screens across the network`}
        breadcrumbs={[{ label: 'Advertising' }, { label: 'Inventory' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5 mb-4">
        <KpiCard label="Total Screens" value={formatNumber(summary.total)} icon={Monitor} color="primary" />
        <KpiCard label="Available" value={formatNumber(summary.available)} icon={CheckCircle2} color="success" hint={`${pct(summary.available)}% of fleet`} />
        <KpiCard label="Reserved" value={formatNumber(summary.reserved)} icon={PlayCircle} color="info" hint={`${pct(summary.reserved)}% on active campaigns`} />
        <KpiCard label="Maintenance" value={formatNumber(summary.maintenance)} icon={Lock} color="warning" hint={`${pct(summary.maintenance)}% of fleet`} />
        <KpiCard label="Offline" value={formatNumber(summary.offline)} icon={AlertOctagon} color="destructive" hint={`${pct(summary.offline)}% of fleet`} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Select value={cityFilter} onValueChange={onCityChange}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="City" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {cityFilter !== 'all' && (
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Zone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map((z: any) => <SelectItem key={z.name} value={z.name}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={availability} onValueChange={setAvailability}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Availability" /></SelectTrigger>
          <SelectContent>
            {AVAILABILITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : (
        <Tabs defaultValue="byCity">
          <TabsList className="mb-4 flex flex-wrap h-auto">
            <TabsTrigger value="byCity">By City ({byCity.length})</TabsTrigger>
            {cityFilter !== 'all' && <TabsTrigger value="byZone">By Zone ({byZone.length})</TabsTrigger>}
            <TabsTrigger value="byType">By Vehicle Type</TabsTrigger>
            <TabsTrigger value="devices">Devices ({devices.length})</TabsTrigger>
            <TabsTrigger value="pricing" className="gap-1.5"><Calculator className="h-3.5 w-3.5" /> Pricing Calculator</TabsTrigger>
          </TabsList>

          {/* By City */}
          <TabsContent value="byCity">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Inventory by City</CardTitle></CardHeader>
              <CardContent className="p-0">
                {byCity.length === 0 ? (
                  <EmptyState icon={MapPin} title="No devices match filters" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="text-left p-3 font-semibold">City</th>
                          <th className="text-left p-3 font-semibold">Total</th>
                          <th className="text-left p-3 font-semibold">Available</th>
                          <th className="text-left p-3 font-semibold">Reserved</th>
                          <th className="text-left p-3 font-semibold">Maintenance</th>
                          <th className="text-left p-3 font-semibold">Offline</th>
                          <th className="text-left p-3 font-semibold">Availability</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byCity.map((c: any) => {
                          const pctAvail = c.total > 0 ? (c.available / c.total) * 100 : 0
                          return (
                            <tr key={c.city} className="border-b last:border-0 hover:bg-accent/40 cursor-pointer" onClick={() => onCityChange(c.city === '—' ? 'all' : c.city)}>
                              <td className="p-3 font-medium flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                {c.city}
                              </td>
                              <td className="p-3 tabular-nums font-medium">{c.total}</td>
                              <td className="p-3 tabular-nums text-success">{c.available}</td>
                              <td className="p-3 tabular-nums text-info">{c.reserved}</td>
                              <td className="p-3 tabular-nums text-warning-foreground">{c.maintenance}</td>
                              <td className="p-3 tabular-nums text-destructive">{c.offline}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[80px]">
                                    <div className="h-full bg-success" style={{ width: `${pctAvail}%` }} />
                                  </div>
                                  <span className="text-xs text-muted-foreground tabular-nums">{pctAvail.toFixed(0)}%</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* By Zone */}
          {cityFilter !== 'all' && (
            <TabsContent value="byZone">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Inventory by Zone in {cityFilter}</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {byZone.length === 0 ? (
                    <EmptyState icon={MapPin} title="No zones found" />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                      {byZone.map((z: any) => {
                        const pctAvail = z.total > 0 ? (z.available / z.total) * 100 : 0
                        return (
                          <div key={z.zone} className="border rounded-md p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-sm">{z.zone}</p>
                              <span className="text-xs text-muted-foreground">{z.total} devices</span>
                            </div>
                            <div className="grid grid-cols-4 gap-1 text-center text-xs mb-2">
                              <div><p className="text-success font-semibold tabular-nums">{z.available}</p><p className="text-[10px] text-muted-foreground">Avail</p></div>
                              <div><p className="text-info font-semibold tabular-nums">{z.reserved}</p><p className="text-[10px] text-muted-foreground">Res</p></div>
                              <div><p className="text-warning-foreground font-semibold tabular-nums">{z.maintenance}</p><p className="text-[10px] text-muted-foreground">Maint</p></div>
                              <div><p className="text-destructive font-semibold tabular-nums">{z.offline}</p><p className="text-[10px] text-muted-foreground">Off</p></div>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-success" style={{ width: `${pctAvail}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* By Vehicle Type */}
          <TabsContent value="byType">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Screens by Vehicle Type</CardTitle></CardHeader>
              <CardContent className="p-4">
                {byVehicleType.length === 0 ? (
                  <EmptyState icon={Monitor} title="No devices match filters" />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {byVehicleType.map((t: any) => {
                      const pctT = summary.total > 0 ? (t.count / summary.total) * 100 : 0
                      return (
                        <div key={t.type} className="border rounded-md p-4 text-center">
                          <p className="text-2xl font-bold tabular-nums text-primary">{t.count}</p>
                          <p className="text-xs text-muted-foreground capitalize mt-1">{t.type.replace('_', ' ')}</p>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-primary" style={{ width: `${pctT}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">{pctT.toFixed(1)}% of fleet</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Devices list */}
          <TabsContent value="devices">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Device-level Inventory ({devices.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                {devices.length === 0 ? (
                  <EmptyState icon={Monitor} title="No devices match filters" />
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="text-left p-3 font-semibold">Device</th>
                            <th className="text-left p-3 font-semibold">City / Zone</th>
                            <th className="text-left p-3 font-semibold">Vehicle</th>
                            <th className="text-left p-3 font-semibold">Status</th>
                            <th className="text-left p-3 font-semibold">Availability</th>
                            <th className="text-left p-3 font-semibold">Active Campaign</th>
                          </tr>
                        </thead>
                        <tbody>
                          {devices.map((d: any) => (
                            <tr key={d.id} className="border-b last:border-0 hover:bg-accent/40">
                              <td className="p-3 font-medium">{d.deviceId}</td>
                              <td className="p-3 text-xs">{d.city}<br /><span className="text-muted-foreground">{d.zone}</span></td>
                              <td className="p-3 text-xs capitalize">{d.vehicleType.replace('_', ' ')}<br /><span className="text-muted-foreground">{d.registrationNo}</span></td>
                              <td className="p-3"><StatusBadge status={d.status} /></td>
                              <td className="p-3"><AvailabilityBadge state={d.availabilityState} /></td>
                              <td className="p-3 text-xs">
                                {d.activeCampaign ? (
                                  <span>
                                    <p className="font-medium truncate">{d.activeCampaign.name}</p>
                                    <StatusBadge status={d.activeCampaign.status} />
                                  </span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y">
                      {devices.map((d: any) => (
                        <div key={d.id} className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{d.deviceId}</p>
                              <p className="text-xs text-muted-foreground truncate">{d.city} · {d.zone}</p>
                            </div>
                            <AvailabilityBadge state={d.availabilityState} />
                          </div>
                          {d.activeCampaign && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              On: <span className="font-medium text-foreground">{d.activeCampaign.name}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Calculator */}
          <TabsContent value="pricing">
            <PricingCalculator cities={data?.byCity?.map((c:any) => c.city) || []} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function AvailabilityBadge({ state }: { state: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    available:   { cls: 'bg-success/15 text-success border-success/30',                  label: 'Available' },
    reserved:    { cls: 'bg-info/15 text-info border-info/30',                            label: 'Reserved' },
    maintenance: { cls: 'bg-warning/15 text-warning-foreground border-warning/30',        label: 'Maintenance' },
    offline:     { cls: 'bg-destructive/15 text-destructive border-destructive/30',       label: 'Offline' },
  }
  const m = map[state] || map.available
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border', m.cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {m.label}
    </span>
  )
}

// Dynamic Pricing Calculator — calculates campaign price based on multiple factors
function PricingCalculator({ cities }: { cities: string[] }) {
  const [city, setCity] = useState(cities[0] || 'Vadodara')
  const [deviceCount, setDeviceCount] = useState(10)
  const [days, setDays] = useState(7)
  const [frequencyPerHour, setFrequencyPerHour] = useState(4)
  const [peakHours, setPeakHours] = useState(true)
  const [festivalMultiplier, setFestivalMultiplier] = useState(1.0)
  const [priceData, setPriceData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const calculate = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        city, deviceCount: String(deviceCount), days: String(days),
        frequencyPerHour: String(frequencyPerHour), peakHours: String(peakHours),
        festivalMultiplier: String(festivalMultiplier),
      })
      const r = await fetch(`/api/pricing?${params}`)
      const d = await r.json()
      setPriceData(d)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(calculate, 300)
    return () => clearTimeout(t)
  }, [city, deviceCount, days, frequencyPerHour, peakHours, festivalMultiplier])

  const fmt = (v: number) => formatINR(v)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Inputs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" /> Campaign Price Calculator</CardTitle>
          <CardDescription className="text-xs">Dynamic pricing based on city, volume, duration, and demand</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Target City</Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(cities.length ? cities : ['Vadodara', 'Ahmedabad', 'Surat', 'Pune', 'Indore']).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Number of Devices</Label>
              <Input type="number" value={deviceCount} onChange={(e) => setDeviceCount(Math.max(1, parseInt(e.target.value) || 1))} min={1} max={10000} />
              {deviceCount >= 100 && <p className="text-[10px] text-success mt-1">Bulk discount: 35% off</p>}
              {deviceCount >= 50 && deviceCount < 100 && <p className="text-[10px] text-success mt-1">Bulk discount: 25% off</p>}
              {deviceCount >= 20 && deviceCount < 50 && <p className="text-[10px] text-success mt-1">Bulk discount: 15% off</p>}
              {deviceCount >= 10 && deviceCount < 20 && <p className="text-[10px] text-success mt-1">Bulk discount: 8% off</p>}
            </div>
            <div>
              <Label>Duration (days)</Label>
              <Input type="number" value={days} onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))} min={1} max={365} />
              {days >= 30 && <p className="text-[10px] text-success mt-1">Duration discount: 15% off</p>}
              {days >= 14 && days < 30 && <p className="text-[10px] text-success mt-1">Duration discount: 10% off</p>}
              {days >= 7 && days < 14 && <p className="text-[10px] text-success mt-1">Duration discount: 5% off</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Frequency (plays/hour)</Label>
              <Input type="number" value={frequencyPerHour} onChange={(e) => setFrequencyPerHour(Math.max(1, parseInt(e.target.value) || 1))} min={1} max={60} />
            </div>
            <div>
              <Label>Festival Multiplier</Label>
              <Select value={String(festivalMultiplier)} onValueChange={(v) => setFestivalMultiplier(parseFloat(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1.0">Normal (1.0x)</SelectItem>
                  <SelectItem value="1.2">Weekend (1.2x)</SelectItem>
                  <SelectItem value="1.5">Festival (1.5x)</SelectItem>
                  <SelectItem value="2.0">Diwali/Peak (2.0x)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-md border">
            <div>
              <Label className="cursor-pointer">Peak Hours (9am–9pm)</Label>
              <p className="text-xs text-muted-foreground">Premium pricing for high-traffic hours</p>
            </div>
            <Switch checked={peakHours} onCheckedChange={setPeakHours} />
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Price Breakdown</CardTitle>
          <CardDescription className="text-xs">Real-time calculation based on selected parameters</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !priceData ? (
            <div className="space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-6 bg-muted animate-pulse rounded" />)}</div>
          ) : (
            <div className="space-y-3">
              {/* Big total */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estimated Campaign Price</p>
                <p className="text-3xl font-bold text-primary mt-1">{fmt(priceData.breakdown.finalPrice)}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Badge variant="outline" className="text-[10px]">{priceData.summary.totalPlays.toLocaleString('en-IN')} plays</Badge>
                  <Badge variant="outline" className="text-[10px]">₹{priceData.summary.pricePerPlay}/play</Badge>
                  <Badge variant="outline" className="text-[10px]">{fmt(priceData.summary.pricePerDay)}/day</Badge>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-1.5 text-sm">
                <PriceRow label="Base price" value={fmt(priceData.breakdown.basePrice)} />
                {priceData.breakdown.cityAdjustment > 0 && (
                  <PriceRow label="Metro city premium" value={`+${fmt(priceData.breakdown.cityAdjustment)}`} color="text-warning-foreground" />
                )}
                {priceData.breakdown.peakPremium > 0 && (
                  <PriceRow label="Peak hours premium" value={`+${fmt(priceData.breakdown.peakPremium)}`} color="text-warning-foreground" />
                )}
                {priceData.breakdown.festivalAdjustment > 0 && (
                  <PriceRow label="Festival multiplier" value={`+${fmt(priceData.breakdown.festivalAdjustment)}`} color="text-warning-foreground" />
                )}
                {priceData.breakdown.bulkSavings > 0 && (
                  <PriceRow label="Bulk discount" value={`−${fmt(priceData.breakdown.bulkSavings)}`} color="text-success" />
                )}
                {priceData.breakdown.durationSavings > 0 && (
                  <PriceRow label="Duration discount" value={`−${fmt(priceData.breakdown.durationSavings)}`} color="text-success" />
                )}
                <div className="border-t pt-2 mt-2">
                  <PriceRow label="Subtotal" value={fmt(priceData.breakdown.finalPrice)} bold />
                  <PriceRow label="GST (18%)" value={fmt(priceData.breakdown.gst)} />
                  <PriceRow label="Total (incl. GST)" value={fmt(priceData.breakdown.totalWithGst)} bold color="text-primary" />
                </div>
              </div>

              {/* Multipliers */}
              <div className="pt-3 border-t">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Applied Multipliers</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">City: {priceData.calculation.cityMultiplier}x</Badge>
                  <Badge variant="secondary" className="text-[10px]">Volume: {priceData.calculation.bulkDiscount}x</Badge>
                  <Badge variant="secondary" className="text-[10px]">Duration: {priceData.calculation.durationDiscount}x</Badge>
                  <Badge variant="secondary" className="text-[10px]">Peak: {priceData.calculation.peakMultiplier}x</Badge>
                  <Badge variant="secondary" className="text-[10px]">Festival: {priceData.calculation.festivalMultiplier}x</Badge>
                </div>
              </div>

              {/* Savings highlight */}
              {priceData.summary.effectiveSavings > 0 && (
                <div className="p-3 rounded-md bg-success/10 border border-success/20 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-success" />
                  <p className="text-sm text-success font-medium">You save {fmt(priceData.summary.effectiveSavings)} with bulk & duration discounts!</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PriceRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn('text-muted-foreground', bold && 'font-semibold text-foreground')}>{label}</span>
      <span className={cn('font-medium tabular-nums', bold && 'font-bold', color)}>{value}</span>
    </div>
  )
}
