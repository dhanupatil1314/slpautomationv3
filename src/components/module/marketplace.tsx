'use client'

import { useState, useEffect } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { PageHeader, StatusBadge, EmptyState, ErrorState, KpiCard } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Store, Search, MapPin, Monitor, TrendingUp, CheckCircle2, Clock, Filter, IndianRupee, ShoppingBag,
} from 'lucide-react'
import { formatINR, formatNumber } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function MarketplaceView() {
  const { setView } = useNav()
  const { user } = useAuth()
  const [city, setCity] = useState('')
  const [zone, setZone] = useState('')
  const [minPrice, setMinPrice] = useState('0')
  const [maxPrice, setMaxPrice] = useState('100000')
  const [sortBy, setSortBy] = useState('value')
  const [refreshKey, setRefreshKey] = useState(0)

  const query = new URLSearchParams({
    city, zone, minPrice, maxPrice, sortBy,
  }).toString()

  const { data, loading, error } = useFetch<any>(`/api/marketplace?${query}`, { refreshKey })
  const inventory = data?.inventory || []
  const summary = data?.summary

  return (
    <div>
      <PageHeader
        title="Inventory Marketplace"
        subtitle="Browse available advertising screens and book inventory for your campaigns"
        breadcrumbs={[{ label: 'Advertising' }, { label: 'Marketplace' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
            <Filter className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* KPI cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard label="Total Screens" value={formatNumber(summary.totalScreens)} icon={Monitor} color="primary" />
          <KpiCard label="Available Now" value={formatNumber(summary.available)} icon={CheckCircle2} color="success" hint="Ready to book" />
          <KpiCard label="Reserved" value={formatNumber(summary.reserved)} icon={Clock} color="warning" hint="On active campaigns" />
          <KpiCard label="Avg Weekly Price" value={formatINR(summary.avgWeeklyPrice, true)} icon={IndianRupee} color="info" />
        </div>
      )}

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Any city" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Zone</Label>
              <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Any zone" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Min Price (₹/wk)</Label>
              <Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Max Price (₹/wk)</Label>
              <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="value">Best Value</SelectItem>
                  <SelectItem value="city">City (A-Z)</SelectItem>
                  <SelectItem value="availability">Availability</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorState message={error} />}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : inventory.length === 0 ? (
        <Card><CardContent><EmptyState icon={Store} title="No inventory matches your filters" description="Try adjusting price range or city filters" /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {inventory.map((item: any) => (
            <MarketplaceCard key={item.id} item={item} onBook={() => { toast.success('Redirecting to campaign wizard...'); setView('campaign-wizard') }} />
          ))}
        </div>
      )}
    </div>
  )
}

function MarketplaceCard({ item, onBook }: { item: any; onBook: () => void }) {
  const isAvailable = item.availability === 'available'
  return (
    <Card className={cn('overflow-hidden hover:shadow-lg transition-all hover:-translate-y-0.5', !isAvailable && 'opacity-75')}>
      {/* Header strip with availability */}
      <div className={cn('h-1.5', isAvailable ? 'bg-success' : 'bg-warning')} />

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn('grid place-items-center h-9 w-9 rounded-lg shrink-0', isAvailable ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning-foreground')}>
              <Monitor className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{item.deviceId}</p>
              <p className="text-xs text-muted-foreground truncate">{item.vehicleReg}</p>
            </div>
          </div>
          <Badge variant={isAvailable ? 'default' : 'secondary'} className={cn('text-[10px] shrink-0', isAvailable ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground')}>
            {isAvailable ? 'Available' : 'Reserved'}
          </Badge>
        </div>

        {/* Location info */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2 text-xs">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{item.city}</span>
            {item.zone && <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{item.zone}</span></>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Signal: {item.signal ?? '—'}%</span>
            <span>·</span>
            <span className="capitalize">{item.vehicleType.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-md bg-muted/50 mb-3">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Daily</p>
            <p className="text-sm font-bold tabular-nums">{formatINR(item.pricing.daily, true)}</p>
          </div>
          <div className="text-center border-l border-r">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Weekly</p>
            <p className="text-sm font-bold tabular-nums text-primary">{formatINR(item.pricing.weekly, true)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Monthly</p>
            <p className="text-sm font-bold tabular-nums">{formatINR(item.pricing.monthly, true)}</p>
          </div>
        </div>

        {item.activeCampaign && (
          <div className="text-xs text-muted-foreground mb-3 p-2 rounded bg-warning/5 border border-warning/20">
            <Clock className="h-3 w-3 inline mr-1" />
            Reserved by: <span className="font-medium">{item.activeCampaign.name}</span>
            {item.activeCampaign.endDate && <> until {new Date(item.activeCampaign.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</>}
          </div>
        )}

        {/* Action */}
        <Button
          className="w-full gap-1.5"
          size="sm"
          disabled={!isAvailable}
          onClick={onBook}
        >
          {isAvailable ? <><ShoppingBag className="h-3.5 w-3.5" /> Book This Screen</> : <><Clock className="h-3.5 w-3.5" /> Currently Reserved</>}
        </Button>
      </CardContent>
    </Card>
  )
}
