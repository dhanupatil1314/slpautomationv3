'use client'

import { useApiQuery } from '@/lib/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/layout/status-badge'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin } from 'lucide-react'
import { format } from 'date-fns'

export function VisitsView() {
  const { data, isLoading } = useApiQuery<any>(['visits'], '/api/visits?limit=50')

  return (
    <div className='space-y-4'>
      <div><h1 className='text-2xl font-bold'>Visit History</h1><p className='text-muted-foreground text-sm'>Track all engineer site visits</p></div>
      <Card><CardContent className='p-0'>
        <div className='overflow-x-auto'><table className='w-full text-sm'>
          <thead><tr className='border-b border-border bg-muted/30'>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Date</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Engineer</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell'>Site</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Visit #</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell'>Check-In</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell'>Check-Out</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Status</th>
          </tr></thead>
          <tbody>
            {isLoading ? Array.from({ length: 8 }).map((_, i) => <tr key={i} className='border-b border-border/50'><td colSpan={7} className='py-4 px-4'><div className='h-4 bg-muted rounded animate-pulse' /></td></tr>) : (data?.visits || []).map((v: any) => (
              <tr key={v.id} className='border-b border-border/50 hover:bg-muted/20 transition-colors'>
                <td className='py-2.5 px-4 text-muted-foreground whitespace-nowrap'>{format(new Date(v.checkInTime), 'yyyy-MM-dd')}</td>
                <td className='py-2.5 px-4'><div><p className='font-medium'>{v.engineer?.name}</p><p className='text-xs text-muted-foreground'>{v.engineer?.engineerCode}</p></div></td>
                <td className='py-2.5 px-4 hidden md:table-cell'>{v.schedule?.site?.siteName || '-'}</td>
                <td className='py-2.5 px-4'><Badge variant='outline' className='text-xs'>#{v.visitNumber}</Badge></td>
                <td className='py-2.5 px-4 text-muted-foreground hidden lg:table-cell'>{format(new Date(v.checkInTime), 'h:mm a')}</td>
                <td className='py-2.5 px-4 text-muted-foreground hidden lg:table-cell'>{v.checkOutTime ? format(new Date(v.checkOutTime), 'h:mm a') : '-'}</td>
                <td className='py-2.5 px-4'><StatusBadge status={v.status === 'COMPLETED' ? 'COMPLETED' : v.status === 'IN_PROGRESS' ? 'PENDING' : 'CANCELLED'} /></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {!isLoading && !data?.visits?.length && <div className='py-12 text-center text-muted-foreground'>No visits found</div>}
      </CardContent></Card>
    </div>
  )
}