'use client'

import { useState } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { PageHeader, KpiCard, EmptyState, ErrorState } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'
import {
  Trophy, RefreshCw, TrendingUp, Users, DollarSign, PlayCircle, Award,
  Medal, Crown, Star, Building2, Target,
} from 'lucide-react'
import { formatINR, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const TIER_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  platinum: { label: 'Platinum', icon: Crown, color: 'text-purple-600', bg: 'bg-purple-500/10 border-purple-500/20' },
  gold: { label: 'Gold', icon: Medal, color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20' },
  silver: { label: 'Silver', icon: Award, color: 'text-zinc-500', bg: 'bg-zinc-400/10 border-zinc-400/20' },
  bronze: { label: 'Bronze', icon: Star, color: 'text-orange-700', bg: 'bg-orange-600/10 border-orange-600/20' },
}

const RANK_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ec4899']

export function LeaderboardView() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading, error } = useFetch<any>('/api/leaderboard', { refreshKey })

  if (loading) {
    return (
      <div>
        <PageHeader title="Advertiser Leaderboard" subtitle="Top performing advertisers by revenue and engagement" />
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Advertiser Leaderboard" subtitle="Top performing advertisers by revenue and engagement" />
        <ErrorState message={error || 'Failed to load leaderboard'} />
      </div>
    )
  }

  const s = data.summary
  const leaderboard = data.leaderboard || []

  // Top 3 podium
  const podium = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)

  // Chart data
  const chartData = leaderboard.slice(0, 10).map((r: any) => ({
    name: r.name.slice(0, 12),
    Spend: r.totalSpend,
    Plays: r.totalPlays,
    Score: r.performanceScore,
  }))

  return (
    <div>
      <PageHeader
        title="Advertiser Leaderboard"
        subtitle="Top performing advertisers ranked by spend, campaigns, and playback reach"
        breadcrumbs={[{ label: 'Advertising' }, { label: 'Leaderboard' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Advertisers" value={formatNumber(s.totalAdvertisers)} icon={Users} color="primary" />
        <KpiCard label="Total Spend" value={formatINR(s.totalSpend, true)} icon={DollarSign} color="success" />
        <KpiCard label="Total Campaigns" value={formatNumber(s.totalCampaigns)} icon={TrendingUp} color="info" />
        <KpiCard label="Total Plays" value={formatNumber(s.totalPlays, true)} icon={PlayCircle} color="warning" />
      </div>

      {/* Podium — Top 3 */}
      {podium.length >= 3 && (
        <Card className="mb-4 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Top 3 Advertisers</CardTitle>
            <CardDescription className="text-xs">Platinum tier — highest performing advertisers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* #2 */}
              <PodiumCard entry={podium[1]} rank={2} />
              {/* #1 — center, elevated */}
              <PodiumCard entry={podium[0]} rank={1} elevated />
              {/* #3 */}
              <PodiumCard entry={podium[2]} rank={3} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance chart */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><BarChart className="h-4 w-4" /> Performance Comparison</CardTitle>
          <CardDescription className="text-xs">Top 10 advertisers by spend and playback</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatINR(v, true)} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number, name) => name === 'Spend' ? [formatINR(v), 'Spend'] : [formatNumber(v), name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Spend" fill="#f97316" radius={[4, 4, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category breakdown */}
      {data.byCategory?.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Spend by Category</CardTitle>
            <CardDescription className="text-xs">Advertiser categories ranked by total spend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.byCategory.map((cat: any, i: number) => {
                const maxSpend = data.byCategory[0].spend || 1
                const pct = (cat.spend / maxSpend) * 100
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: RANK_COLORS[i % RANK_COLORS.length] }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium truncate">{cat.category}</span>
                        <span className="text-sm font-bold tabular-nums">{formatINR(cat.spend, true)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: RANK_COLORS[i % RANK_COLORS.length] }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{cat.count} advertisers · avg {formatINR(cat.avgSpend, true)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full leaderboard table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4" /> Full Leaderboard</CardTitle>
          <CardDescription className="text-xs">All ranked advertisers with performance scores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-center p-2 font-semibold text-xs w-12">Rank</th>
                  <th className="text-left p-2 font-semibold text-xs">Advertiser</th>
                  <th className="text-center p-2 font-semibold text-xs">Tier</th>
                  <th className="text-right p-2 font-semibold text-xs">Spend</th>
                  <th className="text-center p-2 font-semibold text-xs hidden md:table-cell">Campaigns</th>
                  <th className="text-center p-2 font-semibold text-xs hidden md:table-cell">Active</th>
                  <th className="text-right p-2 font-semibold text-xs hidden lg:table-cell">Plays</th>
                  <th className="text-center p-2 font-semibold text-xs">Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r: any) => {
                  const tier = TIER_CONFIG[r.tier] || TIER_CONFIG.bronze
                  const TierIcon = tier.icon
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                      <td className="p-2 text-center">
                        <span className={cn('inline-grid place-items-center h-7 w-7 rounded-full font-bold text-xs',
                          r.rank === 1 ? 'bg-amber-500 text-white' :
                          r.rank === 2 ? 'bg-zinc-400 text-white' :
                          r.rank === 3 ? 'bg-orange-700 text-white' : 'bg-muted text-muted-foreground'
                        )}>
                          {r.rank}
                        </span>
                      </td>
                      <td className="p-2">
                        <p className="font-medium truncate max-w-[150px]">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.category}</p>
                      </td>
                      <td className="p-2 text-center">
                        <Badge variant="outline" className={cn('text-[10px] gap-1', tier.color, tier.bg)}>
                          <TierIcon className="h-2.5 w-2.5" />
                          {tier.label}
                        </Badge>
                      </td>
                      <td className="p-2 text-right font-semibold tabular-nums">{formatINR(r.totalSpend, true)}</td>
                      <td className="p-2 text-center tabular-nums hidden md:table-cell">{r.campaignCount}</td>
                      <td className="p-2 text-center hidden md:table-cell">
                        {r.activeCampaigns > 0 ? <Badge variant="default" className="text-[9px] bg-success text-success-foreground">{r.activeCampaigns} live</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="p-2 text-right tabular-nums hidden lg:table-cell">{formatNumber(r.totalPlays, true)}</td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-10">
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, r.performanceScore)}%` }} />
                            </div>
                          </div>
                          <span className="text-xs font-bold tabular-nums w-6">{r.performanceScore}</span>
                        </div>
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

function PodiumCard({ entry, rank, elevated }: { entry: any; rank: number; elevated?: boolean }) {
  const rankConfig = {
    1: { color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30', icon: Crown, label: '1st Place', medal: '🥇' },
    2: { color: 'text-zinc-400', bg: 'bg-zinc-400/10 border-zinc-400/30', icon: Medal, label: '2nd Place', medal: '🥈' },
    3: { color: 'text-orange-700', bg: 'bg-orange-700/10 border-orange-700/30', icon: Award, label: '3rd Place', medal: '🥉' },
  }
  const cfg = rankConfig[rank as keyof typeof rankConfig]
  const Icon = cfg.icon

  return (
    <div className={cn('p-4 rounded-lg border-2 text-center relative', cfg.bg, elevated && 'md:-translate-y-4 md:scale-105 shadow-lg')}>
      {elevated && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl">👑</div>}
      <div className="text-3xl mb-1">{cfg.medal}</div>
      <Icon className={cn('h-8 w-8 mx-auto mb-2', cfg.color)} />
      <h3 className="font-bold text-sm truncate">{entry.name}</h3>
      <p className="text-xs text-muted-foreground mb-3">{entry.category}</p>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Spend</span>
          <span className="font-bold tabular-nums">{formatINR(entry.totalSpend, true)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Campaigns</span>
          <span className="font-semibold tabular-nums">{entry.campaignCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Plays</span>
          <span className="font-semibold tabular-nums">{formatNumber(entry.totalPlays, true)}</span>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t">
        <span className={cn('text-lg font-bold', cfg.color)}>{entry.performanceScore}</span>
        <span className="text-[10px] text-muted-foreground ml-1">pts</span>
      </div>
    </div>
  )
}
