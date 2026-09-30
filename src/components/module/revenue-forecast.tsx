'use client'

import { useState } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { PageHeader, KpiCard, EmptyState, ErrorState } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, Calendar, Users, RefreshCw,
  ArrowUpRight, ArrowDownRight, Target, BarChart3, PieChart as PieIcon,
} from 'lucide-react'
import { formatINR, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const PIE_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#f59e0b']

export function RevenueForecastView() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading, error } = useFetch<any>('/api/revenue-forecast', { refreshKey })

  if (loading) {
    return (
      <div>
        <PageHeader title="Revenue Forecast" subtitle="Revenue projections and cohort analysis" />
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Revenue Forecast" subtitle="Revenue projections and cohort analysis" />
        <ErrorState message={error || 'Failed to load forecast data'} />
      </div>
    )
  }

  const s = data.summary
  const isGrowing = s.growthRate >= 0

  // Combine historical + forecast for the trend chart
  const trendData = [
    ...data.historical.map((h: any) => ({ ...h, isForecast: false })),
    ...data.forecast,
  ]

  // Revenue split pie data
  const splitData = [
    { name: 'Platform Share', value: data.revenueSplit.platform, fill: '#f97316' },
    { name: 'Driver Share', value: data.revenueSplit.driver, fill: '#22c55e' },
    { name: 'Owner Share', value: data.revenueSplit.owner, fill: '#3b82f6' },
  ].filter((d) => d.value > 0)

  return (
    <div>
      <PageHeader
        title="Revenue Forecast"
        subtitle="Revenue projections, growth trends, and advertiser cohort analysis"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Forecast' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <KpiCard
          label="Growth Rate"
          value={`${isGrowing ? '+' : ''}${s.growthRate}%`}
          icon={isGrowing ? TrendingUp : TrendingDown}
          color={isGrowing ? 'success' : 'destructive'}
          trend={isGrowing ? 'up' : 'down'}
          trendValue={`${Math.abs(s.growthRate)}%`}
        />
        <KpiCard label="Projected Next Month" value={formatINR(s.projectedNextMonth, true)} icon={Target} color="primary" hint="Based on growth rate" />
        <KpiCard label="3-Month Forecast" value={formatINR(s.projectedQuarter, true)} icon={Calendar} color="info" hint="Quarterly projection" />
        <KpiCard label="Avg Monthly Revenue" value={formatINR(s.avgMonthly, true)} icon={DollarSign} color="success" hint="Last 12 months" />
        <KpiCard label="Total Historical" value={formatINR(s.totalHistorical, true)} icon={BarChart3} color="warning" hint="12-month total" />
      </div>

      {/* Growth indicator banner */}
      <Card className={cn('mb-4 border-l-4', isGrowing ? 'border-l-success' : 'border-l-destructive')}>
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className={cn('grid place-items-center h-12 w-12 rounded-lg shrink-0', isGrowing ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
            {isGrowing ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={cn('font-semibold', isGrowing ? 'text-success' : 'text-destructive')}>
              {isGrowing ? 'Revenue is Growing' : 'Revenue is Declining'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isGrowing
                ? `Revenue increased ${s.growthRate}% comparing last 3 months to the previous 3 months. Projected to reach ${formatINR(s.projectedNextMonth, true)} next month.`
                : `Revenue decreased ${Math.abs(s.growthRate)}% comparing last 3 months to the previous 3 months. Action recommended to reverse the trend.`
              }
            </p>
          </div>
          <Badge variant={isGrowing ? 'default' : 'destructive'} className="text-sm">
            {isGrowing ? '+' : ''}{s.growthRate}%
          </Badge>
        </CardContent>
      </Card>

      {/* Revenue trend with forecast */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Revenue Trend & Forecast</CardTitle>
          <CardDescription className="text-xs">12 months historical + 3 months projected (dashed line)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatINR(v, true)} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatINR(v), 'Revenue']} />
              <ReferenceLine x={data.historical[data.historical.length - 1]?.label} stroke="#64748b" strokeDasharray="3 3" label={{ value: '← Historical | Forecast →', position: 'top', fill: '#64748b', fontSize: 10 }} />
              <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} fill="url(#histGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bottom row: Cohort + Revenue split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Advertiser cohorts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Top Advertiser Cohorts</CardTitle>
            <CardDescription className="text-xs">Revenue contribution by advertiser (6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            {data.cohorts?.length === 0 ? (
              <EmptyState icon={Users} title="No cohort data" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.cohorts} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatINR(v, true)} />
                  <YAxis type="category" dataKey="advertiser" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={100} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatINR(v), 'Revenue']} />
                  <Bar dataKey="revenue" fill="#f97316" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {/* Cohort details */}
            <div className="mt-3 pt-3 border-t space-y-2">
              {data.cohorts?.slice(0, 3).map((c: any, i: number) => (
                <div key={c.advertiser} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold text-white" style={{ backgroundColor: PIE_COLORS[i] }}>{i + 1}</span>
                    <span className="font-medium truncate">{c.advertiser}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{c.activeMonths}mo active</span>
                    <span className="font-semibold text-foreground">{formatINR(c.avgMonthly, true)}/mo</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Revenue split pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><PieIcon className="h-4 w-4" /> Revenue Distribution</CardTitle>
            <CardDescription className="text-xs">How gross revenue is split (6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={splitData} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} dataKey="value">
                    {splitData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => formatINR(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {splitData.map((d: any, i: number) => {
                  const pct = data.revenueSplit.gross > 0 ? (d.value / data.revenueSplit.gross) * 100 : 0
                  return (
                    <div key={d.name}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                          {d.name}
                        </span>
                        <span className="font-semibold">{pct.toFixed(1)}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-4">{formatINR(d.value, true)}</p>
                    </div>
                  )
                })}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">Gross Revenue</span>
                    <span className="font-bold text-primary">{formatINR(data.revenueSplit.gross, true)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-muted-foreground">Net Revenue</span>
                    <span className="font-semibold text-success">{formatINR(data.revenueSplit.net, true)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Forecast table */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Monthly Breakdown</CardTitle>
          <CardDescription className="text-xs">Historical and forecasted revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-semibold text-xs">Month</th>
                  <th className="text-right p-2 font-semibold text-xs">Revenue</th>
                  <th className="text-right p-2 font-semibold text-xs hidden md:table-cell">vs Previous</th>
                  <th className="text-center p-2 font-semibold text-xs">Type</th>
                </tr>
              </thead>
              <tbody>
                {trendData.map((m: any, i: number) => {
                  const prev = i > 0 ? trendData[i - 1].revenue : 0
                  const change = prev > 0 ? ((m.revenue - prev) / prev) * 100 : 0
                  return (
                    <tr key={m.month} className={cn('border-b last:border-0', m.isForecast && 'bg-info/5')}>
                      <td className="p-2 font-medium">{m.label} {m.month}</td>
                      <td className="p-2 text-right font-semibold tabular-nums">{formatINR(m.revenue)}</td>
                      <td className="p-2 text-right hidden md:table-cell">
                        {i > 0 && (
                          <span className={cn('text-xs font-medium', change >= 0 ? 'text-success' : 'text-destructive')}>
                            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {m.isForecast ? <Badge variant="outline" className="text-[10px] text-info border-info/30">Forecast</Badge> : <Badge variant="secondary" className="text-[10px]">Historical</Badge>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
