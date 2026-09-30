'use client'

import { useState } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import {
  PageHeader, KpiCard, EmptyState, TableSkeleton, Pagination, ErrorState,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  IndianRupee, TrendingUp, Users, Car, Cpu, Cloud, Wrench, CreditCard, Wallet,
  RefreshCw, MapPin, Megaphone, Building2, Download,
} from 'lucide-react'
import { formatINR, formatNumber, formatDate } from '@/lib/format'

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'ytd', label: 'YTD' },
  { value: 'custom', label: 'Custom' },
]
const PIE_COLORS = ['#f97316', '#22c55e', '#ef4444', '#f59e0b', '#64748b']

export function RevenueView() {
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [range, setRangeRaw] = useState('30d')
  const [from, setFromRaw] = useState('')
  const [to, setToRaw] = useState('')
  const [cityFilter, setCityFilterRaw] = useState('all')
  const [campaignFilter, setCampaignFilterRaw] = useState('all')
  // Reset page on filter changes (inline setters avoid setState-in-effect)
  const setRange = (v: string) => { setRangeRaw(v); setPage(1) }
  const setFrom = (v: string) => { setFromRaw(v); setPage(1) }
  const setTo = (v: string) => { setToRaw(v); setPage(1) }
  const setCityFilter = (v: string) => { setCityFilterRaw(v); setPage(1) }
  const setCampaignFilter = (v: string) => { setCampaignFilterRaw(v); setPage(1) }
  const [refreshKey, setRefreshKey] = useState(0)
  const pageSize = 15

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    range,
    from,
    to,
    city: cityFilter === 'all' ? '' : cityFilter,
    campaignId: campaignFilter === 'all' ? '' : campaignFilter,
  }).toString()
  const { data, loading, error, refresh } = useFetch<any>(`/api/revenue?${query}`, { refreshKey })

  // Fetch cities list once for filter (worklog says /api/cities exists)
  const { data: citiesData } = useFetch<any>('/api/cities')
  const cities = citiesData?.cities || data?.filters?.cities || []
  const campaigns = data?.filters?.campaigns || []

  if (!hasPermission(role, 'revenue.view')) {
    return (
      <div>
        <PageHeader title="Revenue" subtitle="Revenue analytics & transactions" />
        <Card><CardContent><EmptyState icon={TrendingUp} title="Access restricted" description="You don't have permission to view revenue." /></CardContent></Card>
      </div>
    )
  }

  const transactions = data?.transactions || []
  const total = data?.total || 0
  const totals = data?.totals
  const trend = data?.trend || []
  const cityBreakdown = data?.cityBreakdown || []

  // Build pie data for revenue split
  const pieData = totals ? [
    { name: 'Platform', value: totals.platformShare, color: '#f97316' },
    { name: 'Owner', value: totals.ownerShare, color: '#22c55e' },
    { name: 'Driver', value: totals.driverShare, color: '#f59e0b' },
    { name: 'IoT Cost', value: totals.iotCost, color: '#ef4444' },
    { name: 'Cloud Cost', value: totals.cloudCost, color: '#64748b' },
  ].filter((d) => d.value > 0) : []

  return (
    <div>
      <PageHeader
        title="Revenue"
        subtitle="Gross revenue, share splits, and operating costs"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Revenue' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              const days = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90
              window.location.href = `/api/export/revenue?days=${days}`
            }}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <KpiCard label="Gross Revenue" value={formatINR(totals.grossRevenue, true)} icon={IndianRupee} color="primary" />
          <KpiCard label="Platform Share" value={formatINR(totals.platformShare, true)} icon={TrendingUp} color="success" hint={`${totals.grossRevenue ? ((totals.platformShare / totals.grossRevenue) * 100).toFixed(1) : 0}%`} />
          <KpiCard label="Driver Share" value={formatINR(totals.driverShare, true)} icon={Users} color="info" />
          <KpiCard label="Owner Share" value={formatINR(totals.ownerShare, true)} icon={Car} color="success" />
          <KpiCard label="Net Revenue" value={formatINR(totals.netRevenue, true)} icon={Wallet} color="primary" hint="After all costs" />
          <KpiCard label="IoT Cost" value={formatINR(totals.iotCost, true)} icon={Cpu} color="destructive" />
          <KpiCard label="Cloud Cost" value={formatINR(totals.cloudCost, true)} icon={Cloud} color="destructive" />
          <KpiCard label="Maintenance" value={formatINR(totals.maintenanceCost, true)} icon={Wrench} color="warning" />
          <KpiCard label="Payment Fees" value={formatINR(totals.paymentFee, true)} icon={CreditCard} color="warning" />
          <KpiCard label="Net Margin" value={totals.grossRevenue > 0 ? `${((totals.netRevenue / totals.grossRevenue) * 100).toFixed(1)}%` : '—'} icon={TrendingUp} color="success" />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue Trend</CardTitle>
            <CardDescription className="text-xs">Last 6 months · INR</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ left: 0, right: 16, top: 8 }}>
                <defs>
                  <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatINR(v, true)} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatINR(v), '']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="gross" name="Gross" stroke="#f97316" strokeWidth={2.5} fill="url(#grossGrad)" />
                <Area type="monotone" dataKey="net" name="Net" stroke="#22c55e" strokeWidth={2.5} fill="url(#netGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue Breakdown</CardTitle>
            <CardDescription className="text-xs">Share split</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No data" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatINR(v), '']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-2 mt-2 text-xs">
                  {pieData.map((d) => (
                    <span key={d.name} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* City chart */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Revenue by City</CardTitle>
          <CardDescription className="text-xs">Gross vs Net per city (top 10)</CardDescription>
        </CardHeader>
        <CardContent>
          {cityBreakdown.length === 0 ? (
            <EmptyState icon={MapPin} title="No city data" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cityBreakdown} margin={{ left: 0, right: 16, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="city" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatINR(v, true)} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: number) => [formatINR(v), '']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="gross" name="Gross" fill="#f97316" radius={[3, 3, 0, 0]} barSize={20} />
                <Bar dataKey="net" name="Net" fill="#22c55e" radius={[3, 3, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-2 mb-4">
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {range === 'custom' && (
          <>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full lg:w-40" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full lg:w-40" />
          </>
        )}
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-full lg:w-48"><SelectValue placeholder="All Cities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-full lg:w-56"><SelectValue placeholder="All Campaigns" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : transactions.length === 0 ? (
        <Card><CardContent><EmptyState icon={TrendingUp} title="No revenue transactions" description="Try adjusting filters or date range" /></CardContent></Card>
      ) : (
        <>
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Date</th>
                    <th className="text-left p-3 font-semibold">Campaign</th>
                    <th className="text-left p-3 font-semibold">Advertiser</th>
                    <th className="text-left p-3 font-semibold">City</th>
                    <th className="text-right p-3 font-semibold">Gross</th>
                    <th className="text-right p-3 font-semibold">Platform</th>
                    <th className="text-right p-3 font-semibold">Driver</th>
                    <th className="text-right p-3 font-semibold">Owner</th>
                    <th className="text-right p-3 font-semibold">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t: any) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(t.recordedAt)}</td>
                      <td className="p-3 truncate max-w-[180px]">{t.campaignName}</td>
                      <td className="p-3 truncate max-w-[160px] text-muted-foreground">{t.advertiserName}</td>
                      <td className="p-3 text-xs"><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{t.city}</span></td>
                      <td className="p-3 text-right tabular-nums font-medium">{formatINR(t.grossRevenue, true)}</td>
                      <td className="p-3 text-right tabular-nums text-primary">{formatINR(t.platformShare, true)}</td>
                      <td className="p-3 text-right tabular-nums text-success">{formatINR(t.driverShare, true)}</td>
                      <td className="p-3 text-right tabular-nums text-success">{formatINR(t.ownerShare, true)}</td>
                      <td className="p-3 text-right tabular-nums font-semibold">{formatINR(t.netRevenue, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="md:hidden space-y-2">
            {transactions.map((t: any) => (
              <Card key={t.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{t.campaignName}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.advertiserName}</p>
                    </div>
                    <p className="font-semibold tabular-nums shrink-0">{formatINR(t.grossRevenue, true)}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{t.city}</span>
                    <span>{formatDate(t.recordedAt)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t text-xs">
                    <div><p className="text-muted-foreground">Platform</p><p className="font-semibold text-primary">{formatINR(t.platformShare, true)}</p></div>
                    <div><p className="text-muted-foreground">Driver</p><p className="font-semibold text-success">{formatINR(t.driverShare, true)}</p></div>
                    <div><p className="text-muted-foreground">Net</p><p className="font-semibold">{formatINR(t.netRevenue, true)}</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
