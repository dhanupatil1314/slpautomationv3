'use client'

import { useApiQuery } from '@/lib/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import { TrendingUp, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

const COLORS = ['#10b981', '#f97316', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e']

export function AnalyticsView() {
  const { data, isLoading } = useApiQuery<any>(['analytics'], '/api/analytics')

  if (isLoading) return <AnalyticsSkeleton />
  if (!data) return <Card className='p-8 text-center text-muted-foreground'>No analytics data</Card>

  const s = data.summary

  return (
    <div className='space-y-6'>
      <div><h1 className='text-2xl font-bold'>Performance Analytics</h1><p className='text-muted-foreground text-sm'>Comprehensive performance metrics and trends</p></div>

      <div className='grid grid-cols-2 md:grid-cols-6 gap-4'>
        {[
          { label: 'Total', value: s.total, icon: TrendingUp, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/50' },
          { label: 'Completed', value: s.completed, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' },
          { label: 'Pending', value: s.pending, icon: Clock, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/50' },
          { label: 'Hold', value: s.hold, icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/50' },
          { label: 'Cancelled', value: s.cancelled, icon: AlertTriangle, color: 'text-red-600 bg-red-50 dark:bg-red-950/50' },
          { label: 'Rate', value: `${s.completionRate}%`, icon: TrendingUp, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/50' },
        ].map(c => {
          const Icon = c.icon
          return (
            <Card key={c.label}><CardHeader className='flex flex-row items-center justify-between pb-2'><CardTitle className='text-xs font-medium text-muted-foreground'>{c.label}</CardTitle><div className={`p-2 rounded-lg ${c.color}`}><Icon className='h-4 w-4' /></div></CardHeader><CardContent><div className='text-xl font-bold'>{c.value}</div></CardContent></Card>
          )
        })}
      </div>

      <div className='grid md:grid-cols-2 gap-6'>
        <Card><CardHeader><CardTitle className='text-base'>Daily Trend (30 days)</CardTitle></CardHeader><CardContent>
          <ResponsiveContainer width='100%' height={280}>
            <LineChart data={data.dailyTrend}>
              <CartesianGrid strokeDasharray='3 3' className='stroke-border' />
              <XAxis dataKey='date' tick={{ fontSize: 10 }} tickFormatter={v => v.split('-').slice(1).join('/')} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type='monotone' dataKey='completed' stroke='#10b981' strokeWidth={2} dot={false} name='Completed' />
              <Line type='monotone' dataKey='total' stroke='#e2e8f0' strokeWidth={2} dot={false} name='Total' />
            </LineChart>
          </ResponsiveContainer>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className='text-base'>Engineer Performance</CardTitle></CardHeader><CardContent>
          <ResponsiveContainer width='100%' height={280}>
            <BarChart data={data.engineerPerformance} layout='vertical'>
              <XAxis type='number' tick={{ fontSize: 11 }} />
              <YAxis type='category' dataKey='name' width={90} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey='completed' fill='#10b981' radius={[0, 4, 4, 0]} name='Completed' />
              <Bar dataKey='pending' fill='#f97316' radius={[0, 4, 4, 0]} name='Pending' />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className='text-base'>District Performance</CardTitle></CardHeader><CardContent>
          <ResponsiveContainer width='100%' height={280}>
            <BarChart data={data.districtPerformance}>
              <XAxis dataKey='district' tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey='total' fill='#06b6d4' radius={[4, 4, 0, 0]} name='Total' />
              <Bar dataKey='completed' fill='#10b981' radius={[4, 4, 0, 0]} name='Completed' />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className='text-base'>Vendor Performance</CardTitle></CardHeader><CardContent>
          <ResponsiveContainer width='100%' height={280}>
            <PieChart>
              <Pie data={data.vendorPerformance} cx='50%' cy='50%' innerRadius={60} outerRadius={100} dataKey='total' nameKey='vendor' label={({ vendor, percent }) => `${vendor} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {(data.vendorPerformance || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent></Card>

        <Card className='md:col-span-2'><CardHeader><CardTitle className='text-base'>Store Performance</CardTitle></CardHeader><CardContent>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead><tr className='border-b border-border'><th className='text-left py-2 px-3 font-medium text-muted-foreground'>Store</th><th className='text-left py-2 px-3 font-medium text-muted-foreground'>Code</th><th className='text-right py-2 px-3 font-medium text-muted-foreground'>Total</th><th className='text-right py-2 px-3 font-medium text-muted-foreground'>Completed</th><th className='text-right py-2 px-3 font-medium text-muted-foreground'>Rate</th></tr></thead>
              <tbody>
                {(data.storePerformance || []).map((sp: any) => (
                  <tr key={sp.code} className='border-b border-border/50'><td className='py-2 px-3'>{sp.name}</td><td className='py-2 px-3 font-mono text-xs'>{sp.code}</td><td className='py-2 px-3 text-right'>{sp.total}</td><td className='py-2 px-3 text-right'>{sp.completed}</td><td className='py-2 px-3 text-right font-medium text-emerald-600'>{sp.rate}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      </div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-8 w-48' />
      <div className='grid grid-cols-2 md:grid-cols-6 gap-4'>{Array.from({ length: 6 }).map((_, i) => <Card key={i}><CardHeader><Skeleton className='h-4 w-16' /></CardHeader><CardContent><Skeleton className='h-8 w-12' /></CardContent></Card>)}</div>
      <div className='grid md:grid-cols-2 gap-6'>{Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardHeader><Skeleton className='h-5 w-32' /></CardHeader><CardContent><Skeleton className='h-64 w-full' /></CardContent></Card>)}</div>
    </div>
  )
}