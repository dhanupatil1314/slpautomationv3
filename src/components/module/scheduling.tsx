'use client'

import { useState } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import {
  PageHeader, StatusBadge, EmptyState, ErrorState, TableSkeleton, KpiCard,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  CalendarDays, ChevronLeft, ChevronRight, Megaphone, Monitor, Clock, Ban, Sparkles,
} from 'lucide-react'
import { formatNumber, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Deterministic color palette per advertiser (no indigo/blue per brand rules)
const COLORS = [
  'from-orange-500 to-orange-600',
  'from-emerald-500 to-emerald-600',
  'from-rose-500 to-rose-600',
  'from-amber-500 to-amber-600',
  'from-teal-500 to-teal-600',
  'from-fuchsia-500 to-fuchsia-600',
  'from-lime-500 to-lime-600',
  'from-cyan-500 to-cyan-600',
  'from-yellow-500 to-yellow-600',
  'from-pink-500 to-pink-600',
]

function colorFor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return COLORS[hash % COLORS.length]
}

export function SchedulingView() {
  const { openDetail } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [advertiserFilter, setAdvertiserFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [weekOffset, setWeekOffset] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  // Compute current week window based on offset
  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() + weekOffset * 7)
  const dayIdx = (baseDate.getDay() + 6) % 7 // Mon=0
  const weekStart = new Date(baseDate)
  weekStart.setDate(baseDate.getDate() - dayIdx)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const startStr = weekStart.toISOString().slice(0, 10)
  const endStr = weekEnd.toISOString().slice(0, 10)

  const query = new URLSearchParams({
    start: startStr,
    end: endStr,
    advertiserId: advertiserFilter === 'all' ? '' : advertiserFilter,
    city: cityFilter === 'all' ? '' : cityFilter,
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/scheduling?${query}`, { refreshKey })
  const { data: advertisersData } = useFetch<any>('/api/advertisers?pageSize=100')
  const { data: citiesData } = useFetch<any>('/api/cities')

  if (!hasPermission(role, 'scheduling.view')) {
    return (
      <div>
        <PageHeader title="Scheduling" breadcrumbs={[{ label: 'Advertising' }, { label: 'Scheduling' }]} />
        <Card><CardContent><EmptyState icon={Ban} title="Access denied" description="You don't have permission to view scheduling." /></CardContent></Card>
      </div>
    )
  }

  const campaigns = data?.campaigns || []
  const days = data?.range?.days || []
  const liveCount = campaigns.filter((c: any) => c.status === 'live').length
  const scheduledCount = campaigns.filter((c: any) => c.status === 'scheduled').length
  const totalDevices = campaigns.reduce((s: number, c: any) => s + c.deviceCount, 0)

  // Format week label
  const weekLabel = `${formatDate(weekStart)} – ${formatDate(weekEnd)}`
  const isThisWeek = weekOffset === 0

  return (
    <div>
      <PageHeader
        title="Scheduling"
        subtitle={`${formatNumber(campaigns.length)} campaigns scheduled this week`}
        breadcrumbs={[{ label: 'Advertising' }, { label: 'Scheduling' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
            <CalendarDays className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
        <KpiCard label="Scheduled Campaigns" value={formatNumber(campaigns.length)} icon={Megaphone} color="primary" />
        <KpiCard label="Live Now" value={formatNumber(liveCount)} icon={Megaphone} color="success" />
        <KpiCard label="Scheduled (Future)" value={formatNumber(scheduledCount)} icon={CalendarDays} color="info" />
        <KpiCard label="Total Devices Booked" value={formatNumber(totalDevices)} icon={Monitor} color="primary" />
      </div>

      {/* Week navigation + filters */}
      <div className="flex flex-col lg:flex-row gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} disabled={isThisWeek}>
            This Week
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)} className="gap-1.5">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2 hidden sm:inline">{weekLabel}</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 flex-1 lg:justify-end">
          <Select value={advertiserFilter} onValueChange={setAdvertiserFilter}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Advertiser" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Advertisers</SelectItem>
              {(advertisersData?.advertisers || []).map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.organizationName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="City" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {(citiesData?.cities || []).map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={5} cols={8} />
      ) : campaigns.length === 0 ? (
        <Card><CardContent><EmptyState icon={CalendarDays} title="No campaigns scheduled" description="No campaigns fall within this week. Try a different week or filter." /></CardContent></Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weekly Schedule — {weekLabel}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold sticky left-0 bg-muted/50 z-10 min-w-[240px]">Campaign</th>
                    {days.map((d: string, i: number) => {
                      const date = new Date(d + 'T12:00:00')
                      const isToday = d === new Date().toISOString().slice(0, 10)
                      return (
                        <th key={d} className="p-2 text-center min-w-[110px]">
                          <div className={cn(
                            'flex flex-col items-center gap-0.5 py-1 px-2 rounded-md',
                            isToday && 'bg-primary/10 text-primary'
                          )}>
                            <span className="text-xs font-semibold uppercase">{DAY_LABELS[i]}</span>
                            <span className={cn('text-sm font-bold tabular-nums', isToday && 'text-primary')}>{date.getDate()}</span>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c: any) => {
                    const color = colorFor(c.id)
                    return (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="p-3 sticky left-0 bg-background z-10 border-r">
                          <button
                            onClick={() => openDetail('campaign-detail', c.id)}
                            className="flex items-center gap-2 text-left hover:text-primary transition-colors min-w-0"
                          >
                            <div className={cn('w-1 h-9 rounded-full bg-gradient-to-b shrink-0', color)} />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{c.name}</p>
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                {c.advertiserName} · <Monitor className="h-3 w-3" />{c.deviceCount}
                              </p>
                            </div>
                          </button>
                          <div className="mt-1 flex items-center gap-1.5 ml-3">
                            <StatusBadge status={c.status} />
                            {c.startTime && c.endTime && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />{c.startTime}–{c.endTime}
                              </span>
                            )}
                          </div>
                        </td>
                        {c.dayFlags.map((on: boolean, i: number) => (
                          <td key={i} className="p-1.5 text-center align-middle">
                            {on ? (
                              <button
                                onClick={() => openDetail('campaign-detail', c.id)}
                                className={cn(
                                  'block w-full py-2 px-1 rounded-md text-white text-[10px] font-medium bg-gradient-to-br hover:opacity-90 transition-opacity',
                                  color
                                )}
                                title={`${c.name} — ${c.startTime || 'All day'} to ${c.endTime || 'All day'}`}
                              >
                                <span className="block leading-tight">{c.startTime || 'All'}</span>
                                <span className="block leading-tight opacity-80">{c.endTime || 'day'}</span>
                              </button>
                            ) : (
                              <span className="block py-2 text-muted-foreground/30">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      {!loading && campaigns.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2"><CardTitle className="text-base">Campaign Legend</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {campaigns.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => openDetail('campaign-detail', c.id)}
                  className="flex items-center gap-2 p-2 rounded-md border hover:bg-accent/40 text-left"
                >
                  <div className={cn('w-3 h-3 rounded-sm bg-gradient-to-br shrink-0', colorFor(c.id))} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{c.advertiserName}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Festival Calendar — Indian festivals & special events */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Festival & Special Event Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Upcoming Indian festivals and events — ideal for premium campaign scheduling. High-traffic periods with elevated ad engagement.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {INDIAN_FESTIVALS.filter(f => new Date(f.date) >= new Date(Date.now() - 7 * 86400000)).slice(0, 6).map((f) => {
              const daysUntil = Math.ceil((new Date(f.date).getTime() - Date.now()) / 86400000)
              const isUpcoming = daysUntil > 0
              const isToday = daysUntil === 0
              return (
                <div key={f.name} className={cn('p-3 rounded-lg border', isToday ? 'border-primary bg-primary/5' : isUpcoming && daysUntil <= 7 ? 'border-warning/30 bg-warning/5' : 'border-border')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm flex items-center gap-1.5">
                        <span>{f.icon}</span>
                        {f.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(f.date)}</p>
                    </div>
                    {isToday ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">TODAY</span>
                    ) : isUpcoming ? (
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', daysUntil <= 7 ? 'bg-warning/15 text-warning-foreground' : 'bg-muted text-muted-foreground')}>
                        {daysUntil}d away
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Past</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{f.desc}</p>
                  <div className="flex items-center gap-2 mt-2 text-[11px]">
                    <span className="text-primary font-semibold">Peak hours:</span>
                    <span className="text-muted-foreground">{f.peakHours}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Indian festival calendar data (2025-2026)
const INDIAN_FESTIVALS = [
  { name: 'Diwali', date: '2026-11-10', icon: '🪔', desc: 'Festival of Lights — highest ad spend period', peakHours: '6:00 PM - 11:00 PM' },
  { name: 'Navratri', date: '2026-10-16', icon: '🪕', desc: 'Nine nights — Garba events, fashion & jewellery ads', peakHours: '7:00 PM - 12:00 AM' },
  { name: 'Dussehra', date: '2026-10-24', icon: '🏹', desc: 'Victory of good over evil — family & auto ads', peakHours: '6:00 PM - 10:00 PM' },
  { name: 'Christmas', date: '2026-12-25', icon: '🎄', desc: 'Christmas Day — gifting & dining campaigns', peakHours: '11:00 AM - 9:00 PM' },
  { name: 'New Year', date: '2027-01-01', icon: '🎉', desc: 'New Year — resolutions, fitness, lifestyle', peakHours: '10:00 AM - 11:00 PM' },
  { name: 'Republic Day', date: '2026-01-26', icon: '🇮🇳', desc: 'National pride — patriotic & government ads', peakHours: '8:00 AM - 8:00 PM' },
  { name: 'Holi', date: '2027-03-14', icon: '🎨', desc: 'Festival of Colors — FMCG & beverage ads', peakHours: '10:00 AM - 6:00 PM' },
  { name: 'Akshaya Tritiya', date: '2026-05-10', icon: '💎', desc: 'Gold buying festival — premium jewellery ads', peakHours: '10:00 AM - 9:00 PM' },
  { name: 'Eid al-Fitr', date: '2026-04-10', icon: '🌙', desc: 'Eid celebrations — fashion & food campaigns', peakHours: '11:00 AM - 10:00 PM' },
  { name: 'Independence Day', date: '2026-08-15', icon: '🇮🇳', desc: 'National holiday — patriotic & sales campaigns', peakHours: '8:00 AM - 8:00 PM' },
  { name: 'Ganesh Chaturthi', date: '2026-09-15', icon: '🙏', desc: 'Ganesh festival — home & decoration ads', peakHours: '6:00 PM - 10:00 PM' },
  { name: 'Raksha Bandhan', date: '2026-08-19', icon: '🧵', desc: 'Sibling festival — gifting & sweets campaigns', peakHours: '10:00 AM - 9:00 PM' },
]
