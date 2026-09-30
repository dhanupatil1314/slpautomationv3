'use client'

import { useState, useEffect } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { PageHeader, StatusBadge, EmptyState, ErrorState } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import {
  GitCompare, RefreshCw, Search, CheckCircle2, XCircle, PlayCircle, TrendingUp,
  Clock, Monitor, IndianRupee, Activity, Award, Target,
} from 'lucide-react'
import { formatINR, formatNumber, formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const CAMPAIGN_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ec4899']

export function CampaignComparisonView() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [showComparison, setShowComparison] = useState(false)
  const { data: listData, loading: listLoading } = useFetch<any>('/api/campaign-comparison')
  const { data: compData, loading: compLoading } = useFetch<any>(
    showComparison && selectedIds.length >= 2 ? `/api/campaign-comparison?ids=${selectedIds.join(',')}` : null
  )

  const campaigns = listData?.campaigns || []
  const filtered = campaigns.filter((c: any) => !search || c.name.toLowerCase().includes(search.toLowerCase()))

  const toggleCampaign = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id))
    } else if (selectedIds.length < 4) {
      setSelectedIds([...selectedIds, id])
    } else {
      toast.error('Maximum 4 campaigns can be compared')
    }
  }

  const comparison = compData?.comparison || []

  // Chart data for comparison
  const barData = comparison.map((c: any) => ({
    name: c.name.slice(0, 15),
    'Total Plays': c.metrics.totalPlays,
    Completed: c.metrics.completed,
    Failed: c.metrics.failed,
  }))

  const radarData = ['Completion', 'Success', 'Devices', 'Value', 'Activity'].map((metric) => {
    const obj: any = { metric }
    comparison.forEach((c: any) => {
      let val = 0
      if (metric === 'Completion') val = c.metrics.completionRate
      else if (metric === 'Success') val = c.metrics.successRate
      else if (metric === 'Devices') val = Math.min(100, c.metrics.activeDevices * 10)
      else if (metric === 'Value') val = Math.min(100, c.metrics.totalPlays / 10)
      else if (metric === 'Activity') val = Math.min(100, c.metrics.avgPlaysPerDay)
      obj[c.name.slice(0, 10)] = val
    })
    return obj
  })

  return (
    <div>
      <PageHeader
        title="Campaign Comparison"
        subtitle="Side-by-side performance analysis of up to 4 campaigns"
        breadcrumbs={[{ label: 'Playback & Analytics' }, { label: 'Comparison' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setSelectedIds([]); setShowComparison(false) }}>
              <RefreshCw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button size="sm" className="gap-1.5" disabled={selectedIds.length < 2} onClick={() => setShowComparison(true)}>
              <GitCompare className="h-3.5 w-3.5" /> Compare ({selectedIds.length})
            </Button>
          </>
        }
      />

      {!showComparison ? (
        /* Campaign selection */
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Select Campaigns to Compare</CardTitle>
            <CardDescription className="text-xs">Choose 2-4 campaigns with playback data. {selectedIds.length}/4 selected.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/60 text-sm border border-transparent focus:border-primary focus:bg-background focus:outline-none transition-colors"
              />
            </div>
            {listLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={GitCompare} title="No campaigns with playback data" description="Campaigns need playback events to be comparable" />
            ) : (
              <div className="space-y-1">
                {filtered.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => toggleCampaign(c.id)}
                    className={cn('w-full flex items-center gap-3 p-3 rounded-md border transition-colors text-left',
                      selectedIds.includes(c.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50')}
                  >
                    <Checkbox checked={selectedIds.includes(c.id)} onCheckedChange={() => toggleCampaign(c.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.advertiser} · {formatNumber(c.playCount)} plays · {c.deviceCount} devices</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : compLoading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Loading comparison...</CardContent></Card>
      ) : comparison.length === 0 ? (
        <Card><CardContent><EmptyState icon={GitCompare} title="No comparison data" /></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {/* Comparison cards */}
          <div className={cn('grid gap-3', comparison.length === 2 ? 'grid-cols-1 md:grid-cols-2' : comparison.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4')}>
            {comparison.map((c: any, i: number) => (
              <Card key={c.id} className="border-l-4" style={{ borderLeftColor: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length] }}>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm truncate">{c.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{c.advertiser}</p>
                  <div className="mt-3 space-y-2">
                    <MetricRow icon={PlayCircle} label="Total Plays" value={formatNumber(c.metrics.totalPlays)} />
                    <MetricRow icon={CheckCircle2} label="Completion Rate" value={`${c.metrics.completionRate}%`} color="text-success" />
                    <MetricRow icon={TrendingUp} label="Success Rate" value={`${c.metrics.successRate}%`} />
                    <MetricRow icon={Clock} label="Avg Plays/Day" value={formatNumber(c.metrics.avgPlaysPerDay)} />
                    <MetricRow icon={Monitor} label="Active Devices" value={formatNumber(c.metrics.activeDevices)} />
                    <MetricRow icon={IndianRupee} label="Cost/Play" value={c.metrics.costPerPlay > 0 ? formatINR(c.metrics.costPerPlay) : '—'} />
                    <MetricRow icon={Activity} label="Playtime (hrs)" value={formatNumber(c.metrics.totalPlaytimeHours)} />
                    <MetricRow icon={Target} label="Budget" value={formatINR(c.budget, true)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Playback Comparison</CardTitle><CardDescription className="text-xs">Total vs Completed vs Failed plays</CardDescription></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v, true)} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => formatNumber(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Total Plays" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Performance Radar</CardTitle><CardDescription className="text-xs">Multi-dimensional comparison (0-100 scale)</CardDescription></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="metric" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={9} />
                    {comparison.map((c: any, i: number) => (
                      <Radar key={c.id} name={c.name.slice(0, 12)} dataKey={c.name.slice(0, 10)} stroke={CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]} fill={CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Winner highlights */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Performance Leaders</CardTitle><CardDescription className="text-xs">Best performing campaign per metric</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Most Plays', getValue: (c: any) => c.metrics.totalPlays, format: formatNumber },
                  { label: 'Best Completion', getValue: (c: any) => c.metrics.completionRate, format: (v: number) => `${v}%` },
                  { label: 'Most Active Days', getValue: (c: any) => c.metrics.daysActive, format: (v: number) => `${v}d` },
                  { label: 'Best Value', getValue: (c: any) => c.metrics.costPerPlay > 0 ? -c.metrics.costPerPlay : 0, format: (v: number) => v < 0 ? formatINR(-v) : '—' },
                ].map((metric) => {
                  const sorted = [...comparison].sort((a, b) => metric.getValue(b) - metric.getValue(a))
                  const winner = sorted[0]
                  const winnerIdx = comparison.findIndex((c) => c.id === winner.id)
                  return (
                    <div key={metric.label} className="p-3 rounded-lg border bg-card">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{metric.label}</p>
                      <p className="font-bold text-lg mt-1" style={{ color: CAMPAIGN_COLORS[winnerIdx % CAMPAIGN_COLORS.length] }}>
                        {metric.format(metric.getValue(winner))}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{winner.name}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full" onClick={() => setShowComparison(false)}>
            ← Back to Selection
          </Button>
        </div>
      )}
    </div>
  )
}

function MetricRow({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground flex items-center gap-1.5"><Icon className="h-3 w-3" />{label}</span>
      <span className={cn('font-semibold tabular-nums', color)}>{value}</span>
    </div>
  )
}
