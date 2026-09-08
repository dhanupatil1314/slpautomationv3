'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { useApiQuery } from '@/lib/hooks'
import { toast } from 'sonner'
import { format } from 'date-fns'

export function ExportView() {
  const user = useAuthStore(s => s.user)
  const token = useAuthStore(s => s.token)
  const [exportFormat, setExportFormat] = useState('XLSX')
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [statusFilter, setStatusFilter] = useState('')
  const [exporting, setExporting] = useState(false)
  const { data: history } = useApiQuery<any>(['exports-history'], '/api/exports')

  const handleExport = async () => {
    setExporting(true)
    try {
      const filters: any = {}
      if (dateFrom) filters.dateFrom = dateFrom
      if (dateTo) filters.dateTo = dateTo
      if (statusFilter) filters.status = statusFilter

      const res = await fetch('/api/exports', {
        method: 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ format: exportFormat, filters }),
      })
      if (!res.ok) { const data = await res.json(); throw new Error(data.error) }

      if (exportFormat === 'CSV') {
        const csv = await res.text()
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${user?.engineerCode || 'export'}_Schedule_${dateFrom}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${user?.engineerCode || 'export'}_Schedule_${dateFrom}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
      }
      toast.success('Export completed successfully')
    } catch (e: any) { toast.error(e.message) }
    finally { setExporting(false) }
  }

  return (
    <div className='space-y-6'>
      <div><h1 className='text-2xl font-bold'>Export Data</h1><p className='text-muted-foreground text-sm'>Download schedules as Excel or CSV</p></div>

      <Card>
        <CardHeader><CardTitle className='text-base'>Export Options</CardTitle><CardDescription>Filter and download your schedule data</CardDescription></CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid sm:grid-cols-3 gap-4'>
            <div><Label>Format</Label><Select value={exportFormat} onValueChange={setExportFormat}><SelectTrigger className='mt-1'><SelectValue /></SelectTrigger><SelectContent><SelectItem value='XLSX'><div className='flex items-center gap-2'><FileSpreadsheet className='h-4 w-4' />Excel (.xlsx)</div></SelectItem><SelectItem value='CSV'><div className='flex items-center gap-2'><FileText className='h-4 w-4' />CSV</div></SelectItem></SelectContent></Select></div>
            <div><Label>From Date</Label><Input type='date' value={dateFrom} onChange={e => setDateFrom(e.target.value)} className='mt-1' /></div>
            <div><Label>To Date</Label><Input type='date' value={dateTo} onChange={e => setDateTo(e.target.value)} className='mt-1' /></div>
          </div>
          <div className='max-w-xs'><Label>Status</Label><Select value={statusFilter || 'ALL'} onValueChange={v => setStatusFilter(v === 'ALL' ? '' : v)}><SelectTrigger className='mt-1'><SelectValue placeholder='All Status' /></SelectTrigger><SelectContent><SelectItem value='ALL'>All Status</SelectItem>{['ASSIGNED', 'PENDING', 'COMPLETED', 'HOLD', 'CANCELLED', 'RESCHEDULED'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <Button onClick={handleExport} disabled={exporting} size='lg'>
            {exporting ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : <Download className='h-4 w-4 mr-2' />}
            {exporting ? 'Exporting...' : 'Export Data'}
          </Button>
        </CardContent>
      </Card>

      {user?.role === 'ENGINEER' && (
        <Card><CardContent className='p-4 text-sm text-muted-foreground'><strong>Note:</strong> As an engineer, you can only export your own assigned schedules.</CardContent></Card>
      )}
    </div>
  )
}
