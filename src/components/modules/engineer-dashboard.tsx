'use client'

import { useState } from 'react'
import { useApiQuery, useApiMutation } from '@/lib/hooks'
import { useAuthStore } from '@/store/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CalendarDays, Clock, CheckCircle2, Eye, Navigation, Download, MapPin, Building2, PlayCircle, Crosshair } from 'lucide-react'
import { StatusBadge } from '@/components/layout/status-badge'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

const cards = [
  { key: 'todaySchedule', label: "Today's Schedule", icon: CalendarDays, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/50' },
  { key: 'pendingSites', label: 'Pending Sites', icon: Clock, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/50' },
  { key: 'completedSites', label: 'Completed Sites', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' },
  { key: 'totalVisits', label: 'Total Visits', icon: Eye, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/50' },
  { key: 'nearestSite', label: 'Nearest Site', icon: MapPin, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50' },
]

export function EngineerDashboard() {
  const { data, isLoading } = useApiQuery<any>(['dashboard'], '/api/dashboard')
  const user = useAuthStore(s => s.user)
  const [gpsLoading, setGpsLoading] = useState<string | null>(null)

  const completeMutation = useApiMutation(['dashboard'], 'PUT', '/api/schedules', [['dashboard']])

  const handleComplete = (schedule: any) => {
    completeMutation.mutate({ id: schedule.id, status: 'COMPLETED', remarks: schedule.remarks || 'Completed by engineer' })
  }

  const handleGetLocation = async (schedule: any) => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    setGpsLoading(schedule.id)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
      })
      const gpsStr = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`
      completeMutation.mutate({ id: schedule.id, remarks: `[GPS: ${gpsStr}] ${schedule.remarks || ''}` }, {
        onSuccess: () => toast.success(`Location captured: ${gpsStr}`),
      })
    } catch (e: any) { toast.error(e.message || 'Failed to get location') }
    finally { setGpsLoading(null) }
  }

  const handleExport = () => {
    const token = useAuthStore.getState().token
    fetch('/api/exports', { method: 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ format: 'XLSX', filters: { date: new Date().toISOString().split('T')[0] } }) })
      .then(r => { if (r.ok) return r.blob(); throw new Error('Export failed') })
      .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${user?.engineerCode || 'export'}_Schedule.xlsx`; a.click(); URL.revokeObjectURL(url); toast.success('Schedule exported') })
      .catch(e => toast.error(e.message))
  }

  if (isLoading) return <DashboardSkeleton />
  if (!data) return <Card className='p-8 text-center text-muted-foreground'>No data available</Card>

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold'>My Dashboard</h1>
          <p className='text-muted-foreground text-sm mt-1'>Welcome back, {user?.name}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={handleExport}><Download className='h-4 w-4 mr-2' />Export Schedule</Button>
        </div>
      </div>

      <div className='grid grid-cols-2 md:grid-cols-5 gap-4'>
        {cards.map(c => {
          const Icon = c.icon
          let val = data?.cards?.[c.key] ?? 0
          if (c.key === 'nearestSite' && data?.nearestSite) val = data.nearestSite.siteName?.substring(0, 20) || 'N/A'
          return (
            <Card key={c.key} className='hover:shadow-md transition-shadow'>
              <CardHeader className='flex flex-row items-center justify-between pb-2'>
                <CardTitle className='text-xs font-medium text-muted-foreground'>{c.label}</CardTitle>
                <div className={`p-2 rounded-lg ${c.color}`}><Icon className='h-4 w-4' /></div>
              </CardHeader>
              <CardContent><div className={`${c.key === 'nearestSite' ? 'text-sm' : 'text-2xl'} font-bold truncate`}>{val}</div></CardContent>
            </Card>
          )
        })}
      </div>

      <div>
        <h2 className='text-lg font-semibold mb-3'>Today's Schedule</h2>
        {(!data?.todaySchedules?.length) ? (
          <Card className='p-8 text-center text-muted-foreground'>No schedules for today</Card>
        ) : (
          <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {data.todaySchedules.map((s: any) => (
              <Card key={s.id} className='hover:shadow-md transition-shadow'>
                <CardHeader className='pb-3'>
                  <div className='flex items-start justify-between'>
                    <div className='min-w-0 flex-1'>
                      <CardTitle className='text-sm font-semibold truncate'>{s.site?.siteName || 'Unknown Site'}</CardTitle>
                      <p className='text-xs text-muted-foreground mt-0.5'>{s.site?.siteCode} {s.site?.district ? `• ${s.site.district}` : ''}</p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                </CardHeader>
                <CardContent className='space-y-2'>
                  <div className='space-y-1.5'>
                    <div className='flex items-center gap-2 text-sm'><Building2 className='h-3.5 w-3.5 text-muted-foreground shrink-0' /><div className='min-w-0'><span className='truncate block'>{s.store?.storeName || 'N/A'}</span></div></div>
                    {s.store?.storeCode && <p className='text-xs text-muted-foreground pl-5.5'>{s.store.storeCode}{s.store?.storeFormat ? ` • ${s.store.storeFormat}` : ''}</p>}
                    <div className='flex items-center gap-2 text-sm'><PlayCircle className='h-3.5 w-3.5 text-muted-foreground shrink-0' /><span className='text-muted-foreground'>{s.activity || '-'}</span></div>
                  </div>
                  <div className='flex gap-1.5 pt-1'>
                    {s.status !== 'COMPLETED' && (
                      <Button size='sm' variant='outline' className='flex-1 h-8 text-xs gap-1' onClick={() => handleGetLocation(s)} disabled={gpsLoading === s.id}>
                        {gpsLoading === s.id ? <div className='h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent' /> : <Crosshair className='h-3.5 w-3.5' />}
                        Location
                      </Button>
                    )}
                    {s.status !== 'COMPLETED' && (
                      <Button size='sm' className='flex-1 h-8 text-xs' onClick={() => handleComplete(s)} disabled={completeMutation.isPending}>
                        <CheckCircle2 className='h-3.5 w-3.5 mr-1' />Complete
                      </Button>
                    )}
                    {s.site?.googleLink && (
                      <Button size='sm' variant='outline' className='flex-1 h-8 text-xs' asChild>
                        <a href={s.site.googleLink} target='_blank' rel='noopener noreferrer'><Navigation className='h-3.5 w-3.5 mr-1' />Navigate</a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-8 w-48' />
      <div className='grid grid-cols-2 md:grid-cols-5 gap-4'>
        {Array.from({ length: 5 }).map((_, i) => <Card key={i}><CardHeader><Skeleton className='h-4 w-20' /></CardHeader><CardContent><Skeleton className='h-8 w-12' /></CardContent></Card>)}
      </div>
      <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-4'>
        {Array.from({ length: 6 }).map((_, i) => <Card key={i}><CardHeader><Skeleton className='h-4 w-32' /></CardHeader><CardContent className='space-y-2'><Skeleton className='h-4 w-full' /><Skeleton className='h-4 w-full' /><Skeleton className='h-8 w-full' /></CardContent></Card>)}
      </div>
    </div>
  )
}
