'use client'

import { useState } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useNav } from '@/lib/store'
import { PageHeader, KpiCard, StatusBadge, EmptyState, ErrorState } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ComposedChart, Line, Area,
} from 'recharts'
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Target,
  RefreshCw, DollarSign, Flame, Clock, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { formatINR, formatNumber, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  on_track: { label: 'On Track', color: 'text-success', bg: 'bg-success/10 border-success/20', icon: CheckCircle2 },
  over_budget: { label: 'Over Budget', color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20', icon: AlertTriangle },
  under_spending: { label: 'Under Spending', color: 'text-warning-foreground', bg: 'bg-warning/10 border-warning/20', icon: TrendingDown },
  completed: { label: 'Completed', color: 'text-info', bg: 'bg-info/10 border-info/20', icon: CheckCircle2 },
  not_started: { label: 'Not Started', color: 'text-muted-foreground', bg: 'bg-muted border-border', icon: Clock },
}

const BAR_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#64748b']

export function BudgetTrackingView() {
  const { openDetail } = useNav()
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading, error } = useFetch<any>('/api/budget-tracking', { refreshKey })

  if (loading) {
    return (
      <div>
        <PageHeader title="Budget Tracking" subtitle="Campaign budget utilization and burn rate analysis" />
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Budget Tracking" subtitle="Campaign budget utilization and burn rate analysis" />
        <ErrorState message={error || 'Failed to load budget data'} />
      </div>
    )
  }

  const s = data.summary
  const campaigns = data.campaigns || []

  // Chart data: budget vs spent per campaign (top 8)
  const chartData = campaigns.slice(0, 8).map((c: any) => ({
    name: c.name.slice(0, 12),
    Budget: c.budget,
    Spent: c.amountSpent,
    Projected: c.projectedTotalSpend,
  }))

  return (
    <div>
      <PageHeader
        title="Budget Tracking"
        subtitle="Campaign budget utilization, burn rate, and projected spend analysis"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Budget Tracking' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <KpiCard label="Total Budget" value={formatINR(s.totalBudget, true)} icon={Wallet} color="primary" />
        <KpiCard label="Total Spent" value={formatINR(s.totalSpent, true)} icon={DollarSign} color="info" hint={`${s.overallUtilizationPct}% utilized`} />
        <KpiCard label="Remaining" value={formatINR(s.totalRemaining, true)} icon={Target} color="success" />
        <KpiCard label="On Track" value={formatNumber(s.onTrackCount)} icon={CheckCircle2} color="success" hint="Budget healthy" />
        <KpiCard label="Over Budget" value={formatNumber(s.overBudgetCount)} icon={AlertTriangle} color="destructive" hint="Needs attention" />
        <KpiCard label="Under Spending" value={formatNumber(s.underSpendingCount)} icon={TrendingDown} color="warning" hint="Below pace" />
      </div>

      {/* Overall utilization bar */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Overall Budget Utilization</CardTitle>
          <CardDescription className="text-xs">Aggregate spend across {s.totalCampaigns} tracked campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold tabular-nums">{formatINR(s.totalSpent)}</span>
            <span className="text-sm text-muted-foreground">of {formatINR(s.totalBudget)}</span>
          </div>
          <div className="relative h-6 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all',
                s.overallUtilizationPct > 90 ? 'bg-destructive' :
                s.overallUtilizationPct > 75 ? 'bg-warning' : 'bg-success'
              )}
              style={{ width: `${Math.min(100, s.overallUtilizationPct)}%` }}
            />
            <div className="absolute inset-0 grid place-items-center">
              <span className="text-xs font-bold text-white drop-shadow">{s.overallUtilizationPct}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>Remaining: <span className="font-semibold text-foreground">{formatINR(s.totalRemaining)}</span></span>
            <span>{s.totalCampaigns} campaigns tracked</span>
          </div>
        </CardContent>
      </Card>

      {/* Budget vs Spent chart */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><BarChart className="h-4 w-4" /> Budget vs Actual Spend</CardTitle>
          <CardDescription className="text-xs">Top campaigns by budget — showing Budget, Spent, and Projected total</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyState icon={BarChart} title="No budget data" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatINR(v, true)} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => formatINR(v)} />
                <Bar dataKey="Budget" fill="#64748b" radius={[4, 4, 0, 0]} barSize={20} opacity={0.4} />
                <Bar dataKey="Spent" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20} />
                <Line dataKey="Projected" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Overspenders + Underspenders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Top overspenders */}
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive"><ArrowUpRight className="h-4 w-4" /> At Risk — Over Budget</CardTitle>
            <CardDescription className="text-xs">Campaigns projected to exceed budget</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topOverspenders?.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">No campaigns over budget</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.topOverspenders?.map((c: any) => (
                  <div key={c.id} className="p-2.5 rounded-md border border-destructive/20 bg-destructive/5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-sm truncate flex-1">{c.name}</span>
                      <Badge variant="destructive" className="text-[10px]">+{c.projectedOvershootPct}%</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Burn: {formatINR(c.dailyBurnRate, true)}/day</span>
                      <span className="text-destructive font-semibold">Over by {formatINR(c.projectedOvershoot, true)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top underspenders */}
        <Card className="border-l-4 border-l-warning">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-warning-foreground"><ArrowDownRight className="h-4 w-4" /> Under Spending</CardTitle>
            <CardDescription className="text-xs">Campaigns spending below pace</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topUnderspenders?.length === 0 ? (
              <div className="text-center py-6">
                <Target className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">All campaigns on pace</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.topUnderspenders?.map((c: any) => {
                  const gap = c.timeProgressPct - c.budgetUtilizationPct
                  return (
                    <div key={c.id} className="p-2.5 rounded-md border border-warning/20 bg-warning/5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium text-sm truncate flex-1">{c.name}</span>
                        <Badge variant="outline" className="text-[10px] text-warning-foreground">{gap.toFixed(0)}% gap</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Time: {c.timeProgressPct.toFixed(0)}% · Spend: {c.budgetUtilizationPct.toFixed(0)}%</span>
                        <span className="text-warning-foreground font-semibold">{formatINR(c.budgetRemaining, true)} left</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full campaign budget table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Campaign Budget Details</CardTitle>
          <CardDescription className="text-xs">Click any campaign to view full detail</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-semibold text-xs">Campaign</th>
                  <th className="text-right p-2 font-semibold text-xs">Budget</th>
                  <th className="text-right p-2 font-semibold text-xs hidden md:table-cell">Spent</th>
                  <th className="text-center p-2 font-semibold text-xs">Utilization</th>
                  <th className="text-center p-2 font-semibold text-xs hidden lg:table-cell">Burn Rate</th>
                  <th className="text-center p-2 font-semibold text-xs hidden lg:table-cell">Projected</th>
                  <th className="text-center p-2 font-semibold text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c: any) => {
                  const cfg = STATUS_CONFIG[c.budgetStatus] || STATUS_CONFIG.on_track
                  const StatusIcon = cfg.icon
                  return (
                    <tr key={c.id} onClick={() => openDetail('campaign-detail', c.id)} className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors">
                      <td className="p-2">
                        <p className="font-medium truncate max-w-[150px]">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.advertiser}</p>
                      </td>
                      <td className="p-2 text-right font-semibold tabular-nums">{formatINR(c.budget, true)}</td>
                      <td className="p-2 text-right tabular-nums hidden md:table-cell">{formatINR(c.amountSpent, true)}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-[60px]">
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={cn('h-full rounded-full',
                                c.budgetUtilizationPct > 90 ? 'bg-destructive' :
                                c.budgetUtilizationPct > 75 ? 'bg-warning' : 'bg-success'
                              )} style={{ width: `${Math.min(100, c.budgetUtilizationPct)}%` }} />
                            </div>
                          </div>
                          <span className="text-xs font-medium tabular-nums w-8 text-right">{c.budgetUtilizationPct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="p-2 text-center text-xs tabular-nums hidden lg:table-cell">
                        <span className="flex items-center justify-center gap-1"><Flame className="h-3 w-3 text-primary" />{formatINR(c.dailyBurnRate, true)}</span>
                      </td>
                      <td className="p-2 text-center text-xs tabular-nums hidden lg:table-cell">
                        <span className={c.projectedOvershoot > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                          {formatINR(c.projectedTotalSpend, true)}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <Badge variant="outline" className={cn('text-[10px] gap-1', cfg.color, cfg.bg)}>
                          <StatusIcon className="h-2.5 w-2.5" />
                          {cfg.label}
                        </Badge>
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
