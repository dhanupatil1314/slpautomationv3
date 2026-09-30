'use client'

import { useState } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useNav } from '@/lib/store'
import { PageHeader, StatusBadge, EmptyState, ErrorState, KpiCard } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts'
import {
  Heart, Activity, Signal, Thermometer, HardDrive, MemoryStick, RefreshCw,
  TrendingUp, TrendingDown, Award, AlertTriangle, MapPin, Monitor, ChevronRight,
} from 'lucide-react'
import { formatNumber, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#84cc16', C: '#f59e0b', D: '#f97316', F: '#ef4444',
}

const SCORE_COLORS: Record<string, string> = {
  excellent: '#22c55e', good: '#84cc16', fair: '#f59e0b', poor: '#f97316', critical: '#ef4444',
}

export function FleetHealthView() {
  const { openDetail } = useNav()
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading, error } = useFetch<any>('/api/fleet-health', { refreshKey })

  if (loading) {
    return (
      <div>
        <PageHeader title="Fleet Health" subtitle="Device health scoring across the network" />
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Fleet Health" subtitle="Device health scoring across the network" />
        <ErrorState message={error || 'Failed to load fleet health data'} />
      </div>
    )
  }

  const s = data.summary
  const avgScore = s.avgScore
  const scoreColor = avgScore >= 90 ? 'excellent' : avgScore >= 75 ? 'good' : avgScore >= 60 ? 'fair' : avgScore >= 40 ? 'poor' : 'critical'

  return (
    <div>
      <PageHeader
        title="Fleet Health Score"
        subtitle="Comprehensive device health scoring across the network"
        breadcrumbs={[{ label: 'Operations' }, { label: 'Fleet Health' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* Top row: Score gauge + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Score gauge */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> Fleet Health Score</CardTitle>
            <CardDescription className="text-xs">Weighted across all {s.totalDevices} devices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="65%" outerRadius="100%" data={[{ score: avgScore, fill: SCORE_COLORS[scoreColor] }]} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar background={{ fill: 'hsl(var(--muted))' }} dataKey="score" cornerRadius={10} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <p className="text-4xl font-bold tabular-nums" style={{ color: SCORE_COLORS[scoreColor] }}>{avgScore}</p>
                  <p className="text-xs text-muted-foreground">out of 100</p>
                  <Badge className="mt-1 text-xs" style={{ backgroundColor: GRADE_COLORS[s.grade] + '20', color: GRADE_COLORS[s.grade], border: `1px solid ${GRADE_COLORS[s.grade]}40` }}>
                    Grade {s.grade}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="Total Devices" value={formatNumber(s.totalDevices)} icon={Monitor} color="primary" />
          <KpiCard label="Grade A Devices" value={formatNumber(s.gradeDistribution?.A || 0)} icon={Award} color="success" hint="90+ score" />
          <KpiCard label="Grade B Devices" value={formatNumber(s.gradeDistribution?.B || 0)} icon={TrendingUp} color="success" hint="75-89 score" />
          <KpiCard label="Grade C Devices" value={formatNumber(s.gradeDistribution?.C || 0)} icon={Activity} color="warning" hint="60-74 score" />
          <KpiCard label="Grade D Devices" value={formatNumber(s.gradeDistribution?.D || 0)} icon={AlertTriangle} color="warning" hint="40-59 score" />
          <KpiCard label="Grade F Devices" value={formatNumber(s.gradeDistribution?.F || 0)} icon={AlertTriangle} color="destructive" hint="<40 score" />
        </div>
      </div>

      {/* Grade distribution chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Grade Distribution</CardTitle><CardDescription className="text-xs">Devices by health grade</CardDescription></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { grade: 'A (90+)', count: s.gradeDistribution?.A || 0, fill: GRADE_COLORS.A },
                { grade: 'B (75-89)', count: s.gradeDistribution?.B || 0, fill: GRADE_COLORS.B },
                { grade: 'C (60-74)', count: s.gradeDistribution?.C || 0, fill: GRADE_COLORS.C },
                { grade: 'D (40-59)', count: s.gradeDistribution?.D || 0, fill: GRADE_COLORS.D },
                { grade: 'F (<40)', count: s.gradeDistribution?.F || 0, fill: GRADE_COLORS.F },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="grade" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatNumber(v), 'Devices']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                  {GRADE_COLORS && null}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* City-wise health */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Health by City</CardTitle><CardDescription className="text-xs">Average score per city</CardDescription></CardHeader>
          <CardContent>
            {data.byCity?.length === 0 ? (
              <EmptyState icon={MapPin} title="No city data" />
            ) : (
              <div className="space-y-3">
                {data.byCity?.map((c: any) => (
                  <div key={c.city} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{c.city}</span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: c.avgScore >= 75 ? '#22c55e' : c.avgScore >= 60 ? '#f59e0b' : '#ef4444' }}>{c.avgScore}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${c.avgScore}%`, backgroundColor: c.avgScore >= 75 ? '#22c55e' : c.avgScore >= 60 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{c.deviceCount} devices</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Worst offenders + Top performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Worst offenders */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4 text-destructive" /> Worst Offenders</CardTitle>
            <CardDescription className="text-xs">Devices needing immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.worstOffenders?.map((d: any, i: number) => (
                <DeviceHealthRow key={d.id} device={d} rank={i + 1} onClick={() => openDetail('device-detail', d.id)} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top performers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4 text-success" /> Top Performers</CardTitle>
            <CardDescription className="text-xs">Healthiest devices in the fleet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topPerformers?.map((d: any, i: number) => (
                <DeviceHealthRow key={d.id} device={d} rank={i + 1} onClick={() => openDetail('device-detail', d.id)} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full device list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">All Devices — Health Breakdown</CardTitle>
          <CardDescription className="text-xs">Click any device to view full detail</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-semibold text-xs">Device</th>
                  <th className="text-left p-2 font-semibold text-xs hidden md:table-cell">City</th>
                  <th className="text-center p-2 font-semibold text-xs">Score</th>
                  <th className="text-center p-2 font-semibold text-xs">Grade</th>
                  <th className="text-center p-2 font-semibold text-xs hidden lg:table-cell">Heartbeat</th>
                  <th className="text-center p-2 font-semibold text-xs hidden lg:table-cell">Signal</th>
                  <th className="text-center p-2 font-semibold text-xs hidden lg:table-cell">Temp</th>
                  <th className="text-center p-2 font-semibold text-xs hidden xl:table-cell">Storage</th>
                  <th className="text-center p-2 font-semibold text-xs hidden xl:table-cell">RAM</th>
                  <th className="text-center p-2 font-semibold text-xs hidden xl:table-cell">Sync</th>
                </tr>
              </thead>
              <tbody>
                {data.devices?.map((d: any) => (
                  <tr key={d.id} onClick={() => openDetail('device-detail', d.id)} className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GRADE_COLORS[d.grade] }} />
                        <span className="font-medium">{d.deviceId}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{d.vehicleReg}</p>
                    </td>
                    <td className="p-2 hidden md:table-cell text-muted-foreground">{d.city}</td>
                    <td className="p-2 text-center"><span className="font-bold tabular-nums" style={{ color: GRADE_COLORS[d.grade] }}>{d.score}</span></td>
                    <td className="p-2 text-center"><Badge style={{ backgroundColor: GRADE_COLORS[d.grade] + '20', color: GRADE_COLORS[d.grade], border: `1px solid ${GRADE_COLORS[d.grade]}40` }} className="text-[10px]">{d.grade}</Badge></td>
                    <td className="p-2 text-center hidden lg:table-cell"><ScoreBar value={d.breakdown.heartbeat} max={40} /></td>
                    <td className="p-2 text-center hidden lg:table-cell"><ScoreBar value={d.breakdown.signal} max={20} /></td>
                    <td className="p-2 text-center hidden lg:table-cell"><ScoreBar value={d.breakdown.temperature} max={15} /></td>
                    <td className="p-2 text-center hidden xl:table-cell"><ScoreBar value={d.breakdown.storage} max={10} /></td>
                    <td className="p-2 text-center hidden xl:table-cell"><ScoreBar value={d.breakdown.ram} max={5} /></td>
                    <td className="p-2 text-center hidden xl:table-cell"><ScoreBar value={d.breakdown.sync} max={10} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DeviceHealthRow({ device, rank, onClick }: { device: any; rank: number; onClick: () => void }) {
  const color = GRADE_COLORS[device.grade] || '#64748b'
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-2.5 rounded-md border hover:bg-accent/50 transition-colors text-left group">
      <span className="text-xs font-bold text-muted-foreground w-5 text-center">#{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{device.deviceId}</span>
          <Badge style={{ backgroundColor: color + '20', color, border: `1px solid ${color}40` }} className="text-[10px]">{device.grade}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{device.vehicleReg} · {device.city}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-lg tabular-nums" style={{ color }}>{device.score}</p>
        <p className="text-[10px] text-muted-foreground">/ 100</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
    </button>
  )
}

function ScoreBar({ value, max }: { value: number; max: number }) {
  const pct = (value / max) * 100
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">{value}/{max}</span>
    </div>
  )
}
