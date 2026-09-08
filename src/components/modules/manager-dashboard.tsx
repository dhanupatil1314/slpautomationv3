'use client'

import { useApiQuery } from '@/lib/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, CalendarDays, CheckCircle2, Clock, Activity, Building2, MapPin } from 'lucide-react'
import { StatusBadge } from '@/components/layout/status-badge'

const cards = [
  { key: 'assignedEngineers', label: 'Assigned Engineers', icon: Users, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' },
  { key: 'todayJobs', label: "Today's Jobs", icon: CalendarDays, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/50' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' },
  { key: 'pending', label: 'Pending', icon: Clock, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/50' },
  { key: 'activeEngineers', label: 'Active Engineers', icon: Activity, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/50' },
  { key: 'totalStores', label: 'Stores', icon: Building2, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50' },
  { key: 'totalSites', label: 'Sites', icon: MapPin, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/50' },
]

export function ManagerDashboard() {
  const { data, isLoading } = useApiQuery<any>(['dashboard'], '/api/dashboard')

  if (isLoading) return <DashboardSkeleton />
  if (!data) return <Card className='p-8 text-center text-muted-foreground'>No data available</Card>

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Manager Dashboard</h1>
        <p className='text-muted-foreground text-sm mt-1'>Team performance and schedule overview</p>
      </div>
      <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4'>
        {cards.map(c => {
          const Icon = c.icon
          return (
            <Card key={c.key} className='hover:shadow-md transition-shadow'>
              <CardHeader className='flex flex-row items-center justify-between pb-2'>
                <CardTitle className='text-xs font-medium text-muted-foreground'>{c.label}</CardTitle>
                <div className={`p-2 rounded-lg ${c.color}`}><Icon className='h-4 w-4' /></div>
              </CardHeader>
              <CardContent><div className='text-2xl font-bold'>{data?.cards?.[c.key] ?? 0}</div></CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className='text-base'>Today's Team Schedules</CardTitle></CardHeader>
        <CardContent>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead><tr className='border-b border-border'>
                <th className='text-left py-2 px-3 font-medium text-muted-foreground'>Engineer</th>
                <th className='text-left py-2 px-3 font-medium text-muted-foreground hidden md:table-cell'>Site</th>
                <th className='text-left py-2 px-3 font-medium text-muted-foreground hidden lg:table-cell'>Store</th>
                <th className='text-left py-2 px-3 font-medium text-muted-foreground'>Activity</th>
                <th className='text-left py-2 px-3 font-medium text-muted-foreground'>Status</th>
              </tr></thead>
              <tbody>
                {(data?.todaySchedules || []).map((s: any) => (
                  <tr key={s.id} className='border-b border-border/50 hover:bg-muted/30 transition-colors'>
                    <td className='py-2.5 px-3 font-medium'>{s.engineer?.name}</td>
                    <td className='py-2.5 px-3 text-muted-foreground hidden md:table-cell'>{s.site?.siteName}</td>
                    <td className='py-2.5 px-3 text-muted-foreground hidden lg:table-cell'>{s.store?.storeName}</td>
                    <td className='py-2.5 px-3'>{s.activity}</td>
                    <td className='py-2.5 px-3'><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
                {(!data?.todaySchedules?.length) && <tr><td colSpan={5} className='py-8 text-center text-muted-foreground'>No schedules for today</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className='text-base'>Team Members</CardTitle></CardHeader>
        <CardContent>
          <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-3'>
            {(data?.engineers || []).map((eng: any) => (
              <div key={eng.id} className='flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors'>
                <div className='w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary'>{eng.name.split(' ').map((n: string) => n[0]).join('')}</div>
                <div><p className='text-sm font-medium'>{eng.name}</p><p className='text-xs text-muted-foreground'>{eng.code}</p></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-8 w-48' />
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {Array.from({ length: 7 }).map((_, i) => <Card key={i}><CardHeader><Skeleton className='h-4 w-24' /></CardHeader><CardContent><Skeleton className='h-8 w-16' /></CardContent></Card>)}
      </div>
      <Card><CardHeader><Skeleton className='h-5 w-40' /></CardHeader><CardContent><Skeleton className='h-48 w-full' /></CardContent></Card>
    </div>
  )
}