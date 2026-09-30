'use client'

import { useState } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import {
  PageHeader, KpiCard, EmptyState, ErrorState,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Megaphone, Monitor, Network, RefreshCw, TrendingUp, CheckCircle2, XCircle,
  Activity, MapPin, Signal, Thermometer, HardDrive, MemoryStick, Clock, QrCode,
} from 'lucide-react'
import { formatINR, formatNumber, secondsToDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
] as const

const PIE_COLORS = ['#f97316', '#22c55e', '#ef4444', '#f59e0b', '#64748b', '#a855f7']

export function AnalyticsView() {
  const { user } = useAuth()
  const role = user?.role
  const [range, setRange] = useState<typeof RANGE_OPTIONS[number]['value']>('7d')
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading, error, refresh } = useFetch<any>(`/api/analytics?range=${range}`, { refreshKey })

  if (!hasPermission(role, 'analytics.view')) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Network performance insights" />
        <Card><CardContent><EmptyState icon={TrendingUp} title="Access restricted" description="You don't have permission to view analytics." /></CardContent></Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Performance insights across campaigns, devices, and the network"
        breadcrumbs={[{ label: 'Insights' }, { label: 'Analytics' }]}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-md bg-muted">
              {RANGE_OPTIONS.map((r) => (
                <Button
                  key={r.value}
                  size="sm"
                  variant={range === r.value ? 'default' : 'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={() => setRange(r.value)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading || !data ? (
        <Card><CardContent className="p-12"><div className="animate-pulse text-muted-foreground text-center">Loading analytics...</div></CardContent></Card>
      ) : (
        <Tabs defaultValue="campaigns" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="campaigns" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Campaigns</TabsTrigger>
            <TabsTrigger value="devices" className="gap-1.5"><Monitor className="h-3.5 w-3.5" /> Devices</TabsTrigger>
            <TabsTrigger value="network" className="gap-1.5"><Network className="h-3.5 w-3.5" /> Network</TabsTrigger>
            <TabsTrigger value="qr" className="gap-1.5"><QrCode className="h-3.5 w-3.5" /> QR Scans</TabsTrigger>
          </TabsList>

          {/* CAMPAIGN ANALYTICS */}
          <TabsContent value="campaigns" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Active Campaigns" value={formatNumber(data.campaignAnalytics.length)} icon={Megaphone} color="primary" />
              <KpiCard label="Total Verified Plays" value={formatNumber(data.campaignAnalytics.reduce((a: number, c: any) => a + c.verified, 0), true)} icon={CheckCircle2} color="success" />
              <KpiCard label="Total Failed" value={formatNumber(data.campaignAnalytics.reduce((a: number, c: any) => a + c.failed, 0), true)} icon={XCircle} color="destructive" />
              <KpiCard label="Total Spend" value={formatINR(data.campaignAnalytics.reduce((a: number, c: any) => a + c.spend, 0), true)} icon={TrendingUp} color="info" />
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Scheduled vs Verified vs Failed</CardTitle>
                <CardDescription className="text-xs">Top campaigns in selected range</CardDescription>
              </CardHeader>
              <CardContent>
                {data.campaignAnalytics.length === 0 ? (
                  <EmptyState icon={Megaphone} title="No campaign data" description="No playback events in selected range" />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={data.campaignAnalytics} margin={{ left: 0, right: 16, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v, true)} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatNumber(v), '']} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="scheduled" name="Scheduled" fill="#64748b" radius={[3, 3, 0, 0]} barSize={14} />
                      <Bar dataKey="verified" name="Verified" fill="#f97316" radius={[3, 3, 0, 0]} barSize={14} />
                      <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[3, 3, 0, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Campaign Performance Table</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left p-3 font-semibold">Campaign</th>
                        <th className="text-right p-3 font-semibold">Scheduled</th>
                        <th className="text-right p-3 font-semibold">Verified</th>
                        <th className="text-right p-3 font-semibold">Failed</th>
                        <th className="text-right p-3 font-semibold">Completion</th>
                        <th className="text-right p-3 font-semibold">Devices</th>
                        <th className="text-right p-3 font-semibold">Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.campaignAnalytics.map((c: any) => (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                          <td className="p-3 font-medium truncate max-w-[220px]">{c.name}</td>
                          <td className="p-3 text-right tabular-nums">{formatNumber(c.scheduled)}</td>
                          <td className="p-3 text-right tabular-nums">{formatNumber(c.verified)}</td>
                          <td className="p-3 text-right tabular-nums text-destructive">{formatNumber(c.failed)}</td>
                          <td className="p-3 text-right">
                            <span className={cn('font-semibold tabular-nums', c.completionRate >= 90 ? 'text-success' : c.completionRate >= 70 ? 'text-warning' : 'text-destructive')}>
                              {c.completionRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3 text-right tabular-nums">{formatNumber(c.activeDevices)}</td>
                          <td className="p-3 text-right tabular-nums">{formatINR(c.spend, true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DEVICE ANALYTICS */}
          <TabsContent value="devices" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total Devices" value={formatNumber(data.deviceAnalytics.summary.totalDevices)} icon={Monitor} color="primary" />
              <KpiCard label="Online Rate" value={`${data.deviceAnalytics.summary.onlineRate.toFixed(1)}%`} icon={Activity} color="success" hint={`${data.deviceAnalytics.summary.onlineDevices} online`} />
              <KpiCard label="Avg Signal" value={`${data.deviceAnalytics.summary.avgSignal.toFixed(0)}%`} icon={Signal} color="info" />
              <KpiCard label="Avg Temperature" value={`${data.deviceAnalytics.summary.avgTemperature.toFixed(1)}°C`} icon={Thermometer} color="warning" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Uptime vs Downtime</CardTitle>
                  <CardDescription className="text-xs">Network availability</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={[
                      { name: 'Uptime', value: data.deviceAnalytics.summary.onlineRate, fill: '#22c55e' },
                      { name: 'Downtime', value: data.deviceAnalytics.summary.downtimeRate, fill: '#ef4444' },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [`${v.toFixed(1)}%`, '']} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={56} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Device Health Averages</CardTitle></CardHeader>
                <CardContent className="space-y-3 pt-2">
                  <HealthRow icon={Signal} label="Avg Signal Strength" value={data.deviceAnalytics.summary.avgSignal} suffix="%" />
                  <HealthRow icon={Thermometer} label="Avg Temperature" value={data.deviceAnalytics.summary.avgTemperature} suffix="°C" max={80} warn={60} danger={70} />
                  <HealthRow icon={HardDrive} label="Avg Storage Usage" value={data.deviceAnalytics.summary.avgStorage} suffix="%" warn={70} danger={85} />
                  <HealthRow icon={MemoryStick} label="Avg RAM Usage" value={data.deviceAnalytics.summary.avgRam} suffix="%" warn={70} danger={85} />
                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Avg Uptime</span>
                    <span className="font-semibold tabular-nums">{secondsToDuration(data.deviceAnalytics.summary.totalUptimeSeconds / Math.max(data.deviceAnalytics.summary.totalDevices, 1))}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Device Playback Health</CardTitle><CardDescription className="text-xs">Top devices by play volume</CardDescription></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left p-3 font-semibold">Device</th>
                        <th className="text-left p-3 font-semibold">City</th>
                        <th className="text-right p-3 font-semibold">Total Plays</th>
                        <th className="text-right p-3 font-semibold">Completed</th>
                        <th className="text-right p-3 font-semibold">Failed</th>
                        <th className="text-right p-3 font-semibold">Health</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.deviceAnalytics.devices.map((d: any) => (
                        <tr key={d.id} className="border-b last:border-0 hover:bg-accent/50">
                          <td className="p-3 font-medium">{d.code}</td>
                          <td className="p-3 text-muted-foreground"><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{d.city}</span></td>
                          <td className="p-3 text-right tabular-nums">{formatNumber(d.total)}</td>
                          <td className="p-3 text-right tabular-nums text-success">{formatNumber(d.completed)}</td>
                          <td className="p-3 text-right tabular-nums text-destructive">{formatNumber(d.failed)}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className={cn('h-full', d.healthPct >= 90 ? 'bg-success' : d.healthPct >= 70 ? 'bg-warning' : 'bg-destructive')} style={{ width: `${d.healthPct}%` }} />
                              </div>
                              <span className="tabular-nums text-xs font-semibold">{d.healthPct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NETWORK ANALYTICS */}
          <TabsContent value="network" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total Devices" value={formatNumber(data.network.totalDevices)} icon={Monitor} color="primary" />
              <KpiCard label="Online Rate" value={`${data.network.onlineRate.toFixed(1)}%`} icon={Activity} color="success" />
              <KpiCard label="Total Plays" value={formatNumber(data.network.totalPlays, true)} icon={CheckCircle2} color="info" />
              <KpiCard label="Avg Uptime" value={secondsToDuration(data.network.avgUptimeSeconds)} icon={Clock} color="warning" />
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Network Plays Trend</CardTitle>
                <CardDescription className="text-xs">Daily total & verified plays</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data.network.trend} margin={{ left: 0, right: 16, top: 8 }}>
                    <defs>
                      <linearGradient id="playsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="verifiedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v, true)} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatNumber(v), '']} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="plays" name="Total Plays" stroke="#f97316" strokeWidth={2.5} fill="url(#playsGrad)" />
                    <Area type="monotone" dataKey="verified" name="Verified" stroke="#22c55e" strokeWidth={2.5} fill="url(#verifiedGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">City-wise Performance</CardTitle>
                <CardDescription className="text-xs">Top cities by play volume</CardDescription>
              </CardHeader>
              <CardContent>
                {data.network.cityPerformance.length === 0 ? (
                  <EmptyState icon={MapPin} title="No city data" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.network.cityPerformance} margin={{ left: 0, right: 16, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="city" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v, true)} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatNumber(v), '']} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="completed" name="Completed" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} barSize={28} />
                      <Bar dataKey="failed" name="Failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* QR SCAN ANALYTICS */}
          <TabsContent value="qr" className="space-y-4">
            <QrScanAnalytics />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

// QR Scan Analytics sub-component
function QrScanAnalytics() {
  const { data, loading } = useFetch<any>('/api/qr/stats?days=14')

  if (loading || !data) {
    return <Card><CardContent className="p-12"><div className="animate-pulse text-muted-foreground text-center">Loading QR scan data...</div></CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Scans" value={formatNumber(data.totalScans)} icon={QrCode} color="primary" />
        <KpiCard label="Unique Media" value={formatNumber(data.byMedia?.length || 0)} icon={Megaphone} color="info" />
        <KpiCard label="Avg Daily" value={formatNumber(Math.round(data.totalScans / 14))} icon={TrendingUp} color="success" />
        <KpiCard label="14-Day Trend" value={data.dailyTrend?.[data.dailyTrend.length-1]?.scans > data.dailyTrend?.[0]?.scans ? '↑ Up' : '→ Stable'} icon={Activity} color="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Daily Scan Trend</CardTitle><CardDescription className="text-xs">Last 14 days</CardDescription></CardHeader>
          <CardContent>
            {data.dailyTrend?.length === 0 || data.totalScans === 0 ? (
              <EmptyState icon={QrCode} title="No QR scans yet" description="Scans will appear here when users scan campaign QR codes" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.dailyTrend}>
                  <defs>
                    <linearGradient id="qrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatNumber(v), 'Scans']} />
                  <Area type="monotone" dataKey="scans" stroke="#f97316" strokeWidth={2.5} fill="url(#qrGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Megaphone className="h-4 w-4" /> Scans by Media</CardTitle><CardDescription className="text-xs">Top scanned QR codes</CardDescription></CardHeader>
          <CardContent>
            {data.byMedia?.length === 0 ? (
              <EmptyState icon={QrCode} title="No media scans" />
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                {data.byMedia?.map((m: any, i: number) => {
                  const maxScans = data.byMedia[0]?.scans || 1
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-6 text-muted-foreground">#{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(m.scans / maxScans) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm font-bold tabular-nums shrink-0">{m.scans}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Scans</CardTitle><CardDescription className="text-xs">Last 20 QR scan events</CardDescription></CardHeader>
        <CardContent>
          {data.recent?.length === 0 ? (
            <EmptyState icon={QrCode} title="No recent scans" />
          ) : (
            <div className="max-h-72 overflow-y-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-semibold text-xs">Media</th>
                    <th className="text-left p-2 font-semibold text-xs hidden sm:table-cell">URL</th>
                    <th className="text-left p-2 font-semibold text-xs hidden md:table-cell">IP</th>
                    <th className="text-right p-2 font-semibold text-xs">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent?.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="p-2 font-medium truncate max-w-[120px]">{s.mediaName}</td>
                      <td className="p-2 text-xs text-muted-foreground truncate max-w-[150px] hidden sm:table-cell">{s.url}</td>
                      <td className="p-2 text-xs text-muted-foreground hidden md:table-cell">{s.ipAddress || '—'}</td>
                      <td className="p-2 text-xs text-muted-foreground text-right">{new Date(s.timestamp).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function HealthRow({ icon: Icon, label, value, suffix, max = 100, warn = 70, danger = 85 }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  suffix: string
  max?: number
  warn?: number
  danger?: number
}) {
  const pct = Math.min((value / max) * 100, 100)
  const color = value >= danger ? 'bg-destructive' : value >= warn ? 'bg-warning' : 'bg-success'
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-muted-foreground flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>
        <span className="font-semibold tabular-nums">{value.toFixed(1)}{suffix}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
