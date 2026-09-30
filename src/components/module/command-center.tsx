'use client'

import { useState, useEffect } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, EmptyState } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Monitor, Activity, AlertTriangle, Megaphone, Wrench, PlayCircle, Radio,
  MapPin, Signal, ArrowUpRight, Lock, CheckCircle,
} from 'lucide-react'
import { formatNumber, formatINR, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

export function CommandCenterView() {
  const { setView, openDetail } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [refreshKey, setRefreshKey] = useState(0)
  const [now, setNow] = useState(new Date())

  // Auto-refresh every 15s for live feel
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1)
      setNow(new Date())
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const { data: dashData, loading: dashLoading } = useFetch<any>('/api/dashboard', { refreshKey })
  const { data: alertsData } = useFetch<any>('/api/alerts?severity=critical&pageSize=8', { refreshKey })
  const { data: serviceData } = useFetch<any>('/api/service?pageSize=8', { refreshKey })

  if (!hasPermission(role, 'command_center.view')) {
    return (
      <div className="min-h-screen -m-4 md:-m-6 bg-zinc-950 text-zinc-100 p-6">
        <PageHeader title="Command Center" />
        <Card className="bg-zinc-900 border-zinc-800"><CardContent><EmptyState icon={Lock} title="Insufficient permissions" /></CardContent></Card>
      </div>
    )
  }

  const k = dashData?.kpis
  const ds = dashData?.deviceStatus
  const onlinePct = k && k.totalDevices > 0 ? Math.round((k.onlineDevices / k.totalDevices) * 100) : 0
  const networkHealthPct = k && k.totalDevices > 0
    ? Math.round((k.onlineDevices * 1.0 + (k.warningDevices || 0) * 0.5) / k.totalDevices * 100)
    : 0

  const alerts = alertsData?.alerts || []
  const tickets = serviceData?.tickets || []
  const mapDevices = dashData?.mapDevices || []

  // City distribution
  const cityStats: Record<string, { total: number; online: number }> = {}
  for (const d of mapDevices) {
    const city = d.city?.name || 'Unknown'
    if (!cityStats[city]) cityStats[city] = { total: 0, online: 0 }
    cityStats[city].total++
    if (d.status === 'online') cityStats[city].online++
  }

  return (
    <div className="min-h-screen -m-4 md:-m-6 bg-zinc-950 text-zinc-100 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-lg bg-primary text-primary-foreground">
              <Radio className="h-5 w-5" />
            </div>
            Network Operations Center
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Real-time fleet monitoring · auto-refresh every 15s</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-zinc-900 border-zinc-700 text-zinc-300 gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            LIVE
          </Badge>
          <span className="text-xs text-zinc-400 tabular-nums">{now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}</span>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-xs font-medium hover:bg-zinc-800"
          >
            <ArrowUpRight className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {dashLoading && !dashData ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 bg-zinc-900 animate-pulse rounded-lg" />)}
        </div>
      ) : (
        <>
          {/* Big KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            <BigKpi label="Total Devices" value={k ? formatNumber(k.totalDevices) : '—'} icon={Monitor} accent="text-zinc-100" />
            <BigKpi label="Online" value={k ? formatNumber(k.onlineDevices) : '—'} icon={Activity} accent="text-emerald-400" sub={k ? `${onlinePct}%` : ''} />
            <BigKpi label="Offline" value={k ? formatNumber(k.offlineDevices) : '—'} icon={AlertTriangle} accent="text-red-400" />
            <BigKpi label="Critical Alerts" value={k ? formatNumber(k.offlineDevices + (ds?.maintenance || 0)) : '—'} icon={AlertTriangle} accent="text-amber-400" />
            <BigKpi label="Active Campaigns" value={k ? formatNumber(k.activeCampaigns) : '—'} icon={Megaphone} accent="text-orange-400" />
            <BigKpi label="Network Health" value={`${networkHealthPct}%`} icon={Signal} accent={networkHealthPct > 85 ? 'text-emerald-400' : networkHealthPct > 60 ? 'text-amber-400' : 'text-red-400'} />
            <BigKpi label="Open Tickets" value={k ? formatNumber(k.openServiceTickets) : '—'} icon={Wrench} accent="text-amber-400" />
            <BigKpi label="Today's Plays" value={k ? formatNumber(k.todayPlays, true) : '—'} icon={PlayCircle} accent="text-orange-400" />
          </div>

          {/* Main grid: map + side panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* City heatmap */}
            <Card className="lg:col-span-2 bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm text-zinc-100 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-orange-400" /> City Heat Map
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">Device distribution by city · online %</CardDescription>
                </div>
                <button onClick={() => setView('live-map')} className="text-xs text-orange-400 hover:underline">Full map →</button>
              </CardHeader>
              <CardContent>
                {Object.keys(cityStats).length === 0 ? (
                  <EmptyState icon={MapPin} title="No device data" />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(cityStats)
                      .sort(([, a], [, b]) => b.total - a.total)
                      .map(([city, stats]) => {
                        const pct = stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0
                        const heat = pct > 85 ? 'bg-emerald-500' : pct > 60 ? 'bg-amber-500' : 'bg-red-500'
                        return (
                          <div key={city} className="p-3 rounded-md bg-zinc-950 border border-zinc-800">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-zinc-200">{city}</span>
                              <span className={cn('text-xs font-bold tabular-nums', pct > 85 ? 'text-emerald-400' : pct > 60 ? 'text-amber-400' : 'text-red-400')}>{pct}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                              <div className={cn('h-full transition-all', heat)} style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[10px] text-zinc-500">
                              <span>{stats.online} online</span>
                              <span>{stats.total} total</span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Critical alerts panel */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-zinc-100 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" /> Critical Alerts
                </CardTitle>
                <button onClick={() => setView('alerts')} className="text-xs text-orange-400 hover:underline">All →</button>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-sm">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                    All systems nominal
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto scrollbar-thin">
                    {alerts.map((a: any) => (
                      <div key={a.id} className="p-2 rounded-md bg-red-500/10 border border-red-500/30">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[9px] uppercase bg-red-500/20 border-red-500/40 text-red-300">
                            {a.type.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-[10px] text-zinc-500">{timeAgo(a.createdAt)}</span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-1 truncate">{a.message}</p>
                        {a.deviceId && a.deviceId !== '—' && (
                          <p className="text-[10px] text-zinc-500 mt-0.5">Device: {a.deviceId}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom row: service tickets + iot status + playback activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Active service tickets */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-zinc-100 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-400" /> Active Service Tickets
                </CardTitle>
                <button onClick={() => setView('service')} className="text-xs text-orange-400 hover:underline">All →</button>
              </CardHeader>
              <CardContent>
                {tickets.length === 0 ? (
                  <div className="text-center py-6 text-zinc-500 text-xs">No active tickets</div>
                ) : (
                  <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
                    {tickets.slice(0, 8).map((t: any) => (
                      <button
                        key={t.id}
                        onClick={() => openDetail('service', t.id)}
                        className="w-full text-left p-2 rounded-md hover:bg-zinc-800 transition-colors border border-zinc-800"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-zinc-200">{t.ticketId}</span>
                          <span className={cn(
                            'text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded',
                            t.priority === 'critical' ? 'bg-red-500/20 text-red-300' :
                            t.priority === 'high' ? 'bg-amber-500/20 text-amber-300' :
                            'bg-zinc-700 text-zinc-300'
                          )}>{t.priority}</span>
                        </div>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{t.problem}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{t.deviceId} · {t.engineerName}</p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Device status pie (textual) */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-100 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" /> Network Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { label: 'Online', value: ds?.online || 0, color: 'bg-emerald-500', text: 'text-emerald-400' },
                    { label: 'Offline', value: ds?.offline || 0, color: 'bg-red-500', text: 'text-red-400' },
                    { label: 'Warning', value: ds?.warning || 0, color: 'bg-amber-500', text: 'text-amber-400' },
                    { label: 'Maintenance', value: ds?.maintenance || 0, color: 'bg-zinc-500', text: 'text-zinc-400' },
                    { label: 'Suspended', value: ds?.suspended || 0, color: 'bg-zinc-600', text: 'text-zinc-500' },
                  ].map((s) => {
                    const total = k?.totalDevices || 1
                    const pct = Math.round((s.value / total) * 100)
                    return (
                      <div key={s.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-zinc-300">{s.label}</span>
                          <span className={cn('text-xs font-semibold tabular-nums', s.text)}>{s.value} · {pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div className={cn('h-full', s.color)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Hourly playback */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-100 flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-orange-400" /> Playback Activity (Today)
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">Hourly verified plays</CardDescription>
              </CardHeader>
              <CardContent>
                {dashData?.hourlyPlays?.length ? (
                  <div className="flex items-end gap-0.5 h-32">
                    {dashData.hourlyPlays.map((h: any, i: number) => {
                      const max = Math.max(...dashData.hourlyPlays.map((x: any) => x.plays), 1)
                      const h_pct = Math.max(2, (h.plays / max) * 100)
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="w-full bg-orange-500/70 group-hover:bg-orange-400 rounded-t transition-colors" style={{ height: `${h_pct}%` }} />
                          <span className="text-[8px] text-zinc-600">{h.hour.split(':')[0]}</span>
                          <span className="absolute -top-5 hidden group-hover:block text-[9px] bg-zinc-800 px-1 py-0.5 rounded text-zinc-200">{formatNumber(h.plays)}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-zinc-500 text-xs">No playback data today</div>
                )}
                <div className="mt-3 pt-3 border-t border-zinc-800 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-zinc-500">Today's Total</p>
                    <p className="font-bold text-zinc-100 tabular-nums">{k ? formatNumber(k.todayPlays) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Monthly Revenue</p>
                    <p className="font-bold text-emerald-400 tabular-nums">{k ? formatINR(k.monthlyRevenue, true) : '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Activity Feed */}
          <Card className="bg-zinc-900 border-zinc-800 col-span-1 lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2 text-zinc-200">
                  <Activity className="h-4 w-4 text-orange-400" /> Live Activity Feed
                </CardTitle>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Real-time
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin">
                {dashData?.recentActivity?.slice(0, 8).map((a: any, i: number) => (
                  <div key={a.id || i} className="flex items-center gap-3 p-2 rounded-md bg-zinc-950/50 hover:bg-zinc-800/50 transition-colors">
                    <div className={cn('grid place-items-center h-7 w-7 rounded-md shrink-0',
                      a.action?.includes('login') ? 'bg-emerald-500/10 text-emerald-400' :
                      a.action?.includes('device') ? 'bg-orange-500/10 text-orange-400' :
                      a.action?.includes('campaign') ? 'bg-blue-500/10 text-blue-400' :
                      a.action?.includes('payout') ? 'bg-purple-500/10 text-purple-400' :
                      'bg-zinc-700/30 text-zinc-400'
                    )}>
                      {a.action?.includes('login') ? <CheckCircle className="h-3.5 w-3.5" /> :
                       a.action?.includes('device') ? <Monitor className="h-3.5 w-3.5" /> :
                       a.action?.includes('campaign') ? <Megaphone className="h-3.5 w-3.5" /> :
                       a.action?.includes('payout') ? <PlayCircle className="h-3.5 w-3.5" /> :
                       <Activity className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-zinc-300">
                        <span className="font-medium text-zinc-100">{a.user}</span>
                        <span className="text-zinc-500"> · {a.action?.replace(/_/g, ' ')}</span>
                      </p>
                      {a.details && <p className="text-[10px] text-zinc-600 truncate">{a.details}</p>}
                    </div>
                    <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(a.createdAt)}</span>
                  </div>
                )) || <div className="text-center py-6 text-zinc-500 text-xs">No recent activity</div>}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function BigKpi({ label, value, icon: Icon, accent, sub }: { label: string; value: string; icon: any; accent: string; sub?: string }) {
  return (
    <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <Icon className={cn('h-4 w-4', accent)} />
        {sub && <span className={cn('text-[10px] font-bold tabular-nums', accent)}>{sub}</span>}
      </div>
      <p className="text-2xl font-bold tabular-nums text-zinc-100">{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  )
}
