'use client'

import { useApiQuery } from '@/lib/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, UserCheck, MapPin, Building2, CalendarDays, CheckCircle2, Clock, PauseCircle, Upload } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { StatusBadge } from '@/components/layout/status-badge'

const CHART_COLORS = ['#10b981', '#f97316', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6']

const cards = [
  { key: 'totalEngineers', label: 'Total Engineers', icon: Users, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' },
  { key: 'totalManagers', label: 'Total Managers', icon: UserCheck, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/50' },
  { key: 'totalSites', label: 'Total Sites', icon: MapPin, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/50' },
  { key: 'totalStores', label: 'Total Stores', icon: Building2, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/50' },
  { key: 'todayTotal', label: "Today's Total", icon: CalendarDays, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50', nested: 'today.total' },
  { key: 'todayCompleted', label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50', nested: 'today.completed' },
  { key: 'todayPending', label: 'Pending', icon: Clock, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/50', nested: 'today.pending' },
  { key: 'todayHold', label: 'On Hold', icon: PauseCircle, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/50', nested: 'today.hold' },
]

export function AdminDashboard() {
  const { data, isLoading } = useApiQuery<any>(['dashboard'], '/api/dashboard')

  if (isLoading) return <DashboardSkeleton />
  if (!data) return <Card className='p-8 text-center text-muted-foreground'>No dashboard data available</Card>

  const getValue = (c: typeof cards[0]) => {
    if (c.nested) {
      const parts = c.nested.split('.')
      return data?.cards?.[parts[0]]?.[parts[1]] ?? 0
    }
    return data?.cards?.[c.key] ?? 0
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Admin Dashboard</h1>
        <p className='text-muted-foreground text-sm mt-1'>System overview and performance metrics</p>
      </div>
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {cards.map(c => {
          const Icon = c.icon
          const val = getValue(c)
          return (
            <Card key={c.key} className='relative overflow-hidden hover:shadow-md transition-shadow'>
              <CardHeader className='flex flex-row items-center justify-between pb-2'>
                <CardTitle className='text-xs font-medium text-muted-foreground'>{c.label}</CardTitle>
                <div className={`p-2 rounded-lg ${c.color}`}><Icon className='h-4 w-4' /></div>
              </CardHeader>
              <CardContent><div className='text-2xl font-bold'>{val}</div></CardContent>
            </Card>
          )
        })}
      </div>
      <div className='grid md:grid-cols-2 gap-6'>
        <Card>
          <CardHeader><CardTitle className='text-base'>Weekly Completion</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={280}>
              <BarChart data={data?.charts?.dailyCompletion || []}>
                <XAxis dataKey='date' tick={{ fontSize: 11 }} tickFormatter={v => v.split('-').slice(1).join('/')} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey='completed' fill='#10b981' radius={[4, 4, 0, 0]} name='Completed' />
                <Bar dataKey='total' fill='#e2e8f0' radius={[4, 4, 0, 0]} name='Total' />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className='text-base'>Engineer Performance</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={280}>
              <BarChart data={(data?.charts?.engineerPerformance || []).slice(0, 8)} layout='vertical'>
                <XAxis type='number' tick={{ fontSize: 11 }} />
                <YAxis type='category' dataKey='name' width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey='completed' fill='#06b6d4' radius={[0, 4, 4, 0]} name='Completed' />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className='text-base'>District Performance</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={280}>
              <PieChart>
                <Pie data={data?.charts?.districtPerformance || []} cx='50%' cy='50%' innerRadius={60} outerRadius={100} dataKey='total' nameKey='district' label={({ district, percent }) => `${district} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {(data?.charts?.districtPerformance || []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className='text-base'>Recent Imports</CardTitle></CardHeader>
          <CardContent>
            <div className='space-y-3'>
              {(data?.recentImports || []).map((imp: any) => (
                <div key={imp.id} className='flex items-center justify-between py-2 border-b border-border last:border-0'>
                  <div className='flex items-center gap-3'>
                    <div className='p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/50'><Upload className='h-3.5 w-3.5 text-emerald-600' /></div>
                    <div><p className='text-sm font-medium'>{imp.fileName}</p><p className='text-xs text-muted-foreground'>by {imp.uploader?.name}</p></div>
                  </div>
                  <div className='text-right'><p className='text-sm font-medium'>{imp.successCount}/{imp.totalRows}</p><p className='text-xs text-muted-foreground'>{new Date(imp.createdAt).toLocaleDateString()}</p></div>
                </div>
              ))}
              {(!data?.recentImports?.length) && <p className='text-sm text-muted-foreground text-center py-4'>No recent imports</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-8 w-48' />
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {Array.from({ length: 8 }).map((_, i) => <Card key={i}><CardHeader><Skeleton className='h-4 w-24' /></CardHeader><CardContent><Skeleton className='h-8 w-16' /></CardContent></Card>)}
      </div>
      <div className='grid md:grid-cols-2 gap-6'>
        {Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardHeader><Skeleton className='h-5 w-32' /></CardHeader><CardContent><Skeleton className='h-64 w-full' /></CardContent></Card>)}
      </div>
    </div>
  )
}