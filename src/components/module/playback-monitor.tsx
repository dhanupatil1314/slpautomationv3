'use client'

import { useState } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useNav } from '@/lib/store'
import { PageHeader, KpiCard, StatusBadge, EmptyState, ErrorState } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  PlayCircle, CheckCircle2, AlertTriangle, XCircle, Activity, RefreshCw,
  TrendingUp, Monitor, Radio, Flame, Zap, Clock,
} from 'lucide-react'
import { formatNumber, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

export function PlaybackMonitorView() {
  const { openDetail } = useNav()
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading, error } = useFetch<any>('/api/playback-monitor', { refreshKey })

  if (loading) {
    return (
      <div>
        <PageHeader title="Playback Monitor" subtitle="Real-time playback activity across the network" />
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Playback Monitor" subtitle="Real-time playback activity across the network" />
        <ErrorState message={error || 'Failed to load playback data'} />
      </div>
    )
  }

  const s = data.summary

  return (
    <div>
      <PageHeader
        title="Playback Monitor"
        subtitle="Real-time playback activity across the network"
        breadcrumbs={[{ label: 'Playback & Analytics' }, { label: 'Live Monitor' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* Live indicator strip */}
      <Card className="mb-4 bg-gradient-to-r from-sidebar to-sidebar/80 text-sidebar-foreground border-sidebar-border">
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
            </span>
            <span className="text-sm font-semibold uppercase tracking-wider">Live Playback</span>
          </div>
          <div className="h-4 w-px bg-sidebar-border shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{formatNumber(s.lastHourTotal)} plays in last hour</span>
          </div>
          <div className="h-4 w-px bg-sidebar-border shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <Clock className="h-4 w-4 text-info" />
            <span className="text-sm font-medium">Avg {formatNumber(s.avgPerHour)}/hr (24h)</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 shrink-0">
            <Flame className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium">{s.failureRate}% failure rate</span>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <KpiCard label="Today's Plays" value={formatNumber(s.todayTotal)} icon={PlayCircle} color="primary" hint="Verified playback" />
        <KpiCard label="Completed" value={formatNumber(s.todayCompleted)} icon={CheckCircle2} color="success" hint={`${s.completionRate}% completion`} />
        <KpiCard label="Partial" value={formatNumber(s.todayPartial)} icon={AlertTriangle} color="warning" />
        <KpiCard label="Failed" value={formatNumber(s.todayFailed)} icon={XCircle} color="destructive" />
        <KpiCard label="Last 24h" value={formatNumber(s.last24hTotal)} icon={Activity} color="info" />
        <KpiCard label="Last Hour" value={formatNumber(s.lastHourTotal)} icon={Zap} color="primary" hint="Live" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Hourly trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> 24-Hour Playback Trend</CardTitle>
            <CardDescription className="text-xs">Plays and failures per hour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.hourlyData}>
                <defs>
                  <linearGradient id="playsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} interval={3} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v, true)} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number, name) => [formatNumber(v), name === 'plays' ? 'Plays' : 'Failures']} />
                <Area type="monotone" dataKey="plays" stroke="#f97316" strokeWidth={2} fill="url(#playsGrad)" />
                <Area type="monotone" dataKey="failures" stroke="#ef4444" strokeWidth={1.5} fill="url(#failGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status Distribution</CardTitle>
            <CardDescription className="text-xs">Today's playback outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            {data.statusDistribution?.length === 0 ? (
              <EmptyState icon={PlayCircle} title="No playback today" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={data.statusDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                      {data.statusDistribution?.map((s: any, i: number) => <Cell key={i} fill={s.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatNumber(v), 'Plays']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {data.statusDistribution?.map((s: any) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                        {s.name}
                      </span>
                      <span className="font-semibold tabular-nums">{formatNumber(s.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active campaigns + Top devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active campaigns */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Radio className="h-4 w-4 text-success" /> Active Campaigns (Live Now)</CardTitle>
            <CardDescription className="text-xs">Campaigns currently playing across the network</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
              {data.activeCampaigns?.length === 0 ? (
                <EmptyState icon={Radio} title="No active campaigns" description="No campaigns are currently live" />
              ) : (
                data.activeCampaigns?.map((c: any, i: number) => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-md border hover:bg-accent/50 transition-colors">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center">#{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{c.name}</span>
                        <Badge variant="default" className="text-[9px] bg-success text-success-foreground">LIVE</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.advertiser} · {c.deviceCount} devices</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums text-primary">{formatNumber(c.lastHourPlays)}</p>
                      <p className="text-[10px] text-muted-foreground">last hour</p>
                    </div>
                    <div className="text-right shrink-0 pl-2 border-l">
                      <p className="text-sm font-semibold tabular-nums">{formatNumber(c.todayPlays)}</p>
                      <p className="text-[10px] text-muted-foreground">today</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top devices */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Monitor className="h-4 w-4" /> Top Performing Devices</CardTitle>
            <CardDescription className="text-xs">Most active devices today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topDevices?.length === 0 ? (
                <EmptyState icon={Monitor} title="No device activity today" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.topDevices} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="deviceId" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={70} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatNumber(v), 'Plays']} />
                    <Bar dataKey="plays" fill="#f97316" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {data.topDevices?.length > 0 && (
                <div className="space-y-1 mt-3 pt-3 border-t">
                  {data.topDevices.slice(0, 3).map((d: any, i: number) => (
                    <button key={i} onClick={() => openDetail('device-detail', d.id)} className="w-full flex items-center justify-between gap-2 p-1.5 rounded hover:bg-accent/50 transition-colors text-left">
                      <span className="flex items-center gap-2 text-xs">
                        <span className="w-4 h-4 rounded-full grid place-items-center text-[9px] font-bold text-white bg-primary">{i + 1}</span>
                        <span className="font-medium">{d.deviceId}</span>
                        <span className="text-muted-foreground">{d.vehicleReg}</span>
                      </span>
                      <span className="text-xs font-bold tabular-nums">{formatNumber(d.plays)} plays</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
