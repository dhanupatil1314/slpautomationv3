'use client'

import { useFetch } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { PageHeader, KpiCard, StatusBadge, EmptyState, LoadingGrid, ErrorState } from '@/components/shared'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Monitor, Activity, AlertTriangle, Megaphone, Building2, Car, User, PlayCircle,
  TrendingUp, Wallet, Wrench, Plus, Upload, ListMusic, Radio, MapPin, Signal, Clock,
} from 'lucide-react'
import { formatINR, formatNumber, timeAgo, statusColor } from '@/lib/format'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { hasPermission } from '@/lib/rbac'

const PIE_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#64748b', '#a855f7']

export function DashboardView() {
  const { data, loading, error } = useFetch<any>('/api/dashboard')
  const { setView } = useNav()
  const { user } = useAuth()
  const role = user?.role

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Real-time network overview" />
        <LoadingGrid className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" count={12} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Real-time network overview" />
        <ErrorState message={error || 'Failed to load dashboard data'} onRetry={() => window.location.reload()} />
      </div>
    )
  }

  const k = data.kpis

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${user?.name}. Here's your network at a glance.`}
        actions={
          <Button onClick={() => setView('command-center')} className="gap-2">
            <Radio className="h-4 w-4" /> Command Center
          </Button>
        }
      />

      {/* Live network status strip */}
      <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-gradient-to-r from-sidebar to-sidebar/80 text-sidebar-foreground border border-sidebar-border overflow-x-auto scrollbar-thin">
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider">Live</span>
          <span className="text-xs text-sidebar-foreground/60">{new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</span>
        </div>
        <div className="h-4 w-px bg-sidebar-border shrink-0" />
        <div className="flex items-center gap-1.5 shrink-0">
          <Activity className="h-3.5 w-3.5 text-success" />
          <span className="text-xs font-medium">{formatNumber(k.onlineDevices)} online</span>
          <span className="text-xs text-sidebar-foreground/60">({k.totalDevices ? ((k.onlineDevices / k.totalDevices) * 100).toFixed(1) : 0}%)</span>
        </div>
        <div className="h-4 w-px bg-sidebar-border shrink-0" />
        <div className="flex items-center gap-1.5 shrink-0">
          <PlayCircle className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">{formatNumber(k.todayPlays, true)} plays today</span>
        </div>
        <div className="h-4 w-px bg-sidebar-border shrink-0" />
        <div className="flex items-center gap-1.5 shrink-0">
          <Megaphone className="h-3.5 w-3.5 text-info" />
          <span className="text-xs font-medium">{formatNumber(k.activeCampaigns)} active campaigns</span>
        </div>
        {k.offlineDevices > 0 && (
          <>
            <div className="h-4 w-px bg-sidebar-border shrink-0" />
            <div className="flex items-center gap-1.5 shrink-0">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs font-medium">{formatNumber(k.offlineDevices)} offline</span>
            </div>
          </>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 shrink-0">
          <TrendingUp className="h-3.5 w-3.5 text-success" />
          <span className="text-xs font-medium">{formatINR(k.monthlyRevenue, true)} this month</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Total Devices" value={formatNumber(k.totalDevices)} icon={Monitor} color="primary" hint="Across all cities" sparkData={data.deviceStatus7Day?.map((d:any)=>d.online+d.offline)||[]} />
        <KpiCard label="Online" value={formatNumber(k.onlineDevices)} icon={Activity} color="success" trend="up" trendValue={`${k.totalDevices ? ((k.onlineDevices / k.totalDevices) * 100).toFixed(1) : 0}%`} sparkData={data.deviceStatus7Day?.map((d:any)=>d.online)||[]} />
        <KpiCard label="Offline" value={formatNumber(k.offlineDevices)} icon={AlertTriangle} color="destructive" sparkData={data.deviceStatus7Day?.map((d:any)=>d.offline)||[]} />
        <KpiCard label="Warning" value={formatNumber(k.warningDevices)} icon={AlertTriangle} color="warning" />
        <KpiCard label="Active Campaigns" value={formatNumber(k.activeCampaigns)} icon={Megaphone} color="info" />
        <KpiCard label="Active Advertisers" value={formatNumber(k.activeAdvertisers)} icon={Building2} color="primary" />
        <KpiCard label="Active Vehicles" value={formatNumber(k.activeVehicles)} icon={Car} color="success" />
        <KpiCard label="Active Drivers" value={formatNumber(k.activeDrivers)} icon={User} color="info" />
        <KpiCard label="Today's Plays" value={formatNumber(k.todayPlays, true)} icon={PlayCircle} color="primary" hint="Verified playback" sparkData={data.hourlyPlays?.map((h:any)=>h.plays)||[]} />
        <KpiCard label="Monthly Revenue" value={formatINR(k.monthlyRevenue, true)} icon={TrendingUp} color="success" trend="up" trendValue="12%" sparkData={data.revenueByMonth?.map((r:any)=>r.revenue)||[]} />
        <KpiCard label="Pending Payouts" value={formatNumber(k.pendingPayouts)} icon={Wallet} color="warning" />
        <KpiCard label="Open Tickets" value={formatNumber(k.openServiceTickets)} icon={Wrench} color="destructive" />
      </div>

      {/* Quick actions */}
      {hasPermission(role, 'devices.create') && (
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { label: 'Add Device', view: 'devices' as const, icon: Plus, perm: 'devices.create' },
            { label: 'Add Vehicle', view: 'vehicles' as const, icon: Plus, perm: 'vehicles.create' },
            { label: 'Add Driver', view: 'drivers' as const, icon: Plus, perm: 'drivers.create' },
            { label: 'Add Advertiser', view: 'advertisers' as const, icon: Plus, perm: 'advertisers.create' },
            { label: 'Upload Media', view: 'media' as const, icon: Upload, perm: 'media.create' },
            { label: 'Create Playlist', view: 'playlists' as const, icon: ListMusic, perm: 'playlists.create' },
            { label: 'Create Campaign', view: 'campaign-wizard' as const, icon: Plus, perm: 'campaigns.create' },
            { label: 'Service Ticket', view: 'service' as const, icon: Wrench, perm: 'service.create' },
          ].filter((a) => hasPermission(role, a.perm)).map((a) => (
            <Button key={a.label} variant="outline" size="sm" className="gap-1.5" onClick={() => setView(a.view)}>
              <a.icon className="h-3.5 w-3.5" /> {a.label}
            </Button>
          ))}
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Device status pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Device Status</CardTitle>
            <CardDescription className="text-xs">Current network distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Online', value: data.deviceStatus.online },
                    { name: 'Offline', value: data.deviceStatus.offline },
                    { name: 'Warning', value: data.deviceStatus.warning },
                    { name: 'Maintenance', value: data.deviceStatus.maintenance },
                    { name: 'Suspended', value: data.deviceStatus.suspended },
                  ].filter((d) => d.value > 0)}
                  cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value"
                >
                  {[0,1,2,3,4].map((i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs">
              {['Online', 'Offline', 'Warning', 'Maintenance', 'Suspended'].map((label, i) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-muted-foreground">{label}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue Trend</CardTitle>
            <CardDescription className="text-xs">Last 6 months · INR</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.revenueByMonth}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatINR(v, true)} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  formatter={(v: number) => [formatINR(v), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Campaign performance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Campaign Performance</CardTitle>
            <CardDescription className="text-xs">Top 5 by verified plays (7 days)</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topCampaigns.length === 0 ? (
              <EmptyState icon={Megaphone} title="No campaign data" description="Playback data will appear here once campaigns go live" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.topCampaigns} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v, true)} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatNumber(v), 'Plays']} />
                  <Bar dataKey="plays" fill="#f97316" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Ad playback hourly */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Ad Playback Today</CardTitle>
            <CardDescription className="text-xs">Hourly verified plays</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.hourlyPlays}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval={1} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v, true)} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatNumber(v), 'Plays']} />
                <Line type="monotone" dataKey="plays" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3, fill: '#f97316' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: offline list + alerts + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Offline devices */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Offline / Warning Devices</CardTitle>
              <CardDescription className="text-xs">Requires immediate attention</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setView('devices')}>View all</Button>
          </CardHeader>
          <CardContent>
            {data.offlineList.length === 0 ? (
              <EmptyState icon={Activity} title="All devices healthy" description="No offline or warning devices" />
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
                {data.offlineList.map((d: any) => (
                  <button
                    key={d.id}
                    onClick={() => setView('device-detail', d.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-accent transition-colors text-left"
                  >
                    <div className={cn('grid place-items-center h-9 w-9 rounded-md shrink-0', statusColor(d.status))}>
                      <Monitor className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{d.deviceId}</span>
                        <StatusBadge status={d.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-0.5"><Car className="h-3 w-3" />{d.vehicleReg}</span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{d.city}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground flex items-center gap-0.5 justify-end">
                        <Clock className="h-3 w-3" /> {timeAgo(d.lastHeartbeat)}
                      </p>
                      {d.signal != null && <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end mt-0.5"><Signal className="h-3 w-3" />{d.signal}%</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Critical alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Critical Alerts
            </CardTitle>
            <CardDescription className="text-xs">Unacknowledged</CardDescription>
          </CardHeader>
          <CardContent>
            {data.criticalAlerts.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="No critical alerts" description="All systems nominal" />
            ) : (
              <ScrollArea className="h-72">
                <div className="space-y-2">
                  {data.criticalAlerts.map((a: any) => (
                    <div key={a.id} className="p-2.5 rounded-md border border-destructive/30 bg-destructive/5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="destructive" className="text-[10px] uppercase">{a.type.replace(/_/g, ' ')}</Badge>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
                      </div>
                      <p className="text-xs mt-1.5">{a.message}</p>
                      {a.deviceId && <p className="text-[10px] text-muted-foreground mt-1">Device: {a.deviceId}</p>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
          <CardDescription className="text-xs">System audit trail</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <EmptyState icon={Activity} title="No recent activity" />
          ) : (
            <div className="space-y-1">
              {data.recentActivity.map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className="grid place-items-center h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                    {l.user?.[0]?.toUpperCase() || 'S'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{l.user}</span>
                      <span className="text-muted-foreground"> · {l.action.replace(/_/g, ' ')}</span>
                      {l.entity && <span className="text-muted-foreground"> · {l.entity}</span>}
                    </p>
                    {l.details && <p className="text-xs text-muted-foreground truncate">{l.details}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(l.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
