'use client'

import { useState, useMemo, useEffect } from 'react'
import { useApiQuery, useAuthFetch } from '@/lib/hooks'
import { useAuthStore } from '@/store/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge } from '@/components/layout/status-badge'
import {
  Search, Filter, ChevronLeft, ChevronRight, Download, X, Eye, Loader2,
  FileSpreadsheet, CalendarRange, Users, RefreshCw, ClipboardList
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

const STATUS_OPTIONS = ['ASSIGNED', 'PENDING', 'COMPLETED', 'HOLD', 'CANCELLED', 'RESCHEDULED']
const VISIT_TYPES = ['Project', 'Service', 'Absent', 'Installation', 'Maintenance', 'Inspection', 'Survey']

export function DailyScheduleView() {
  const user = useAuthStore(s => s.user)
  const token = useAuthStore(s => s.token)
  const authFetch = useAuthFetch()

  // Filter state
  const [search, setSearch] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [engineerFilter, setEngineerFilter] = useState('')
  const [verticalFilter, setVerticalFilter] = useState('')
  const [visitTypeFilter, setVisitTypeFilter] = useState('')
  const [zoneFilter, setZoneFilter] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [activityFilter, setActivityFilter] = useState('')
  const [storeFormatFilter, setStoreFormatFilter] = useState('')
  const [showFilters, setShowFilters] = useState(true)
  const [showDetail, setShowDetail] = useState<any>(null)
  const [exporting, setExporting] = useState(false)
  const [groupByEngineer, setGroupByEngineer] = useState(false)

  useEffect(() => {
    const handler = (e: any) => { setGlobalSearch(e.detail); setPage(1) }
    window.addEventListener('globalSearch', handler)
    return () => window.removeEventListener('globalSearch', handler)
  }, [])

  // Fetch filter options (all engineers — no role filtering)
  const { data: filterOpts, refetch: refetchFilters } = useApiQuery<any>(
    ['daily-schedule-filters'],
    '/api/daily-schedule/filters',
    true
  )

  // Build query string
  const queryParams = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search || globalSearch) p.set('search', search || globalSearch)
    if (dateFrom) p.set('dateFrom', dateFrom)
    if (dateTo) p.set('dateTo', dateTo)
    if (statusFilter) p.set('status', statusFilter)
    if (engineerFilter) p.set('engineerId', engineerFilter)
    if (verticalFilter) p.set('vertical', verticalFilter)
    if (visitTypeFilter) p.set('visitType', visitTypeFilter)
    if (zoneFilter) p.set('zone', zoneFilter)
    if (districtFilter) p.set('district', districtFilter)
    if (regionFilter) p.set('region', regionFilter)
    if (vendorFilter) p.set('vendor', vendorFilter)
    if (activityFilter) p.set('activity', activityFilter)
    if (storeFormatFilter) p.set('storeFormat', storeFormatFilter)
    return p.toString()
  }, [page, limit, search, globalSearch, dateFrom, dateTo, statusFilter, engineerFilter, verticalFilter, visitTypeFilter, zoneFilter, districtFilter, regionFilter, vendorFilter, activityFilter, storeFormatFilter])

  const { data, isLoading, refetch } = useApiQuery<any>(
    ['daily-schedule', queryParams],
    `/api/daily-schedule?${queryParams}`,
    true
  )

  const activeFilters = [
    statusFilter, engineerFilter, verticalFilter, visitTypeFilter, zoneFilter,
    districtFilter, regionFilter, vendorFilter, activityFilter, storeFormatFilter,
    dateFrom, dateTo,
  ].filter(Boolean).length

  const clearAll = () => {
    setSearch(''); setGlobalSearch(''); setStatusFilter(''); setEngineerFilter('')
    setVerticalFilter(''); setVisitTypeFilter(''); setZoneFilter(''); setDistrictFilter('')
    setRegionFilter(''); setVendorFilter(''); setActivityFilter(''); setStoreFormatFilter('')
    setDateFrom(''); setDateTo(''); setPage(1)
  }

  const handleExport = async () => {
    if (!dateFrom && !dateTo) {
      toast.info('Tip: set a From/To date range to scope the export.')
    }
    setExporting(true)
    try {
      const filters: any = {}
      if (search || globalSearch) filters.search = search || globalSearch
      if (dateFrom) filters.dateFrom = dateFrom
      if (dateTo) filters.dateTo = dateTo
      if (statusFilter) filters.status = statusFilter
      if (engineerFilter) filters.engineerId = engineerFilter
      if (verticalFilter) filters.vertical = verticalFilter
      if (visitTypeFilter) filters.visitType = visitTypeFilter
      if (zoneFilter) filters.zone = zoneFilter
      if (districtFilter) filters.district = districtFilter
      if (regionFilter) filters.region = regionFilter
      if (vendorFilter) filters.vendor = vendorFilter
      if (activityFilter) filters.activity = activityFilter
      if (storeFormatFilter) filters.storeFormat = storeFormatFilter

      const res = await authFetch('/api/daily-schedule/export', {
        method: 'POST',
        body: JSON.stringify({ filters, groupByEngineer }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      a.download = match ? match[1] : `Daily_Schedule_Report_${format(new Date(), 'yyyyMMdd')}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Excel export downloaded')
    } catch (e: any) {
      toast.error(e.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const schedules = data?.schedules || []
  const total = data?.total || 0
  const pages = data?.pages || 0

  // Quick stats
  const stats = useMemo(() => {
    const completed = schedules.filter((s: any) => s.status === 'COMPLETED').length
    const pending = schedules.filter((s: any) => s.status === 'PENDING').length
    const assigned = schedules.filter((s: any) => s.status === 'ASSIGNED').length
    const hold = schedules.filter((s: any) => s.status === 'HOLD').length
    const engineers = new Set(schedules.map((s: any) => s.engineer?.id).filter(Boolean)).size
    return { completed, pending, assigned, hold, engineers, total }
  }, [schedules])

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold flex items-center gap-2'>
            <ClipboardList className='h-6 w-6 text-primary' />
            Daily Schedule Task
          </h1>
          <p className='text-muted-foreground text-sm'>
            Updated daily schedule with full details for all engineers — visible to every user.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={() => { refetch(); refetchFilters() }} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size='sm' onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : <Download className='h-4 w-4 mr-2' />}
            {exporting ? 'Exporting...' : 'Export Excel'}
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3'>
        <StatCard label='Total Tasks' value={stats.total} icon={<ClipboardList className='h-4 w-4' />} tone='default' />
        <StatCard label='Engineers' value={stats.engineers} icon={<Users className='h-4 w-4' />} tone='blue' />
        <StatCard label='Assigned' value={stats.assigned} icon={<FileSpreadsheet className='h-4 w-4' />} tone='sky' />
        <StatCard label='Pending' value={stats.pending} icon={<CalendarRange className='h-4 w-4' />} tone='orange' />
        <StatCard label='On Hold' value={stats.hold} icon={<CalendarRange className='h-4 w-4' />} tone='amber' />
        <StatCard label='Completed' value={stats.completed} icon={<FileSpreadsheet className='h-4 w-4' />} tone='emerald' />
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className='p-4'>
          <div className='flex flex-wrap gap-3 items-center'>
            <div className='relative flex-1 min-w-[200px]'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search engineer, store, call no, problem...'
                value={search || globalSearch}
                onChange={e => { setSearch(e.target.value); setGlobalSearch(''); setPage(1) }}
                className='pl-9 h-9'
              />
            </div>
            <div className='flex items-center gap-1.5'>
              <Label className='text-xs text-muted-foreground whitespace-nowrap'>From</Label>
              <Input type='date' value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} className='w-40 h-9' />
            </div>
            <div className='flex items-center gap-1.5'>
              <Label className='text-xs text-muted-foreground whitespace-nowrap'>To</Label>
              <Input type='date' value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} className='w-40 h-9' />
            </div>
            <Select value={statusFilter || 'ALL'} onValueChange={v => { setStatusFilter(v === 'ALL' ? '' : v); setPage(1) }}>
              <SelectTrigger className='w-36 h-9'><SelectValue placeholder='All Status' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='ALL'>All Status</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={showFilters ? 'secondary' : 'outline'} size='sm' className='h-9 gap-1.5' onClick={() => setShowFilters(f => !f)}>
              <Filter className='h-4 w-4' />More Filters
              {activeFilters > 0 && <Badge variant='default' className='ml-1 h-5 w-5 p-0 text-[10px] flex items-center justify-center'>{activeFilters}</Badge>}
            </Button>
            {activeFilters > 0 && (
              <Button variant='ghost' size='sm' onClick={clearAll}><X className='h-4 w-4 mr-1' />Clear</Button>
            )}
          </div>

          {showFilters && (
            <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border'>
              <div>
                <Label className='text-xs'>Engineer</Label>
                <Select value={engineerFilter || 'ALL'} onValueChange={v => { setEngineerFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                  <SelectTrigger className='mt-1 h-9'><SelectValue placeholder='All Engineers' /></SelectTrigger>
                  <SelectContent className='max-h-72'>
                    <SelectItem value='ALL'>All Engineers</SelectItem>
                    {(filterOpts?.engineers || []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.engineerCode})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className='text-xs'>Vertical</Label>
                <Select value={verticalFilter || 'ALL'} onValueChange={v => { setVerticalFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                  <SelectTrigger className='mt-1 h-9'><SelectValue placeholder='All Verticals' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ALL'>All Verticals</SelectItem>
                    {(filterOpts?.verticals || []).map((v: string) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className='text-xs'>Visit Type</Label>
                <Select value={visitTypeFilter || 'ALL'} onValueChange={v => { setVisitTypeFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                  <SelectTrigger className='mt-1 h-9'><SelectValue placeholder='All Visit Types' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ALL'>All Visit Types</SelectItem>
                    {(filterOpts?.visitTypes?.length ? filterOpts.visitTypes : VISIT_TYPES).map((v: string) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className='text-xs'>Zone</Label>
                <Select value={zoneFilter || 'ALL'} onValueChange={v => { setZoneFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                  <SelectTrigger className='mt-1 h-9'><SelectValue placeholder='All Zones' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ALL'>All Zones</SelectItem>
                    {(filterOpts?.zones || []).map((z: string) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className='text-xs'>District / City</Label>
                <Select value={districtFilter || 'ALL'} onValueChange={v => { setDistrictFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                  <SelectTrigger className='mt-1 h-9'><SelectValue placeholder='All Districts' /></SelectTrigger>
                  <SelectContent className='max-h-72'>
                    <SelectItem value='ALL'>All Districts</SelectItem>
                    {(filterOpts?.districts || []).map((d: string) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className='text-xs'>State / Region</Label>
                <Select value={regionFilter || 'ALL'} onValueChange={v => { setRegionFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                  <SelectTrigger className='mt-1 h-9'><SelectValue placeholder='All Regions' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ALL'>All Regions</SelectItem>
                    {(filterOpts?.regions || []).map((r: string) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className='text-xs'>Store Format</Label>
                <Select value={storeFormatFilter || 'ALL'} onValueChange={v => { setStoreFormatFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                  <SelectTrigger className='mt-1 h-9'><SelectValue placeholder='All Formats' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ALL'>All Formats</SelectItem>
                    {(filterOpts?.storeFormats || []).map((f: string) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className='text-xs'>Vendor</Label>
                <Select value={vendorFilter || 'ALL'} onValueChange={v => { setVendorFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                  <SelectTrigger className='mt-1 h-9'><SelectValue placeholder='All Vendors' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ALL'>All Vendors</SelectItem>
                    {(filterOpts?.vendors || []).map((v: string) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className='text-xs'>Activity / Category</Label>
                <Select value={activityFilter || 'ALL'} onValueChange={v => { setActivityFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                  <SelectTrigger className='mt-1 h-9'><SelectValue placeholder='All Activities' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ALL'>All Activities</SelectItem>
                    {(filterOpts?.activities || []).map((a: string) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className='flex items-end gap-2 col-span-1'>
                <label className='flex items-center gap-2 text-xs cursor-pointer h-9'>
                  <Checkbox checked={groupByEngineer} onCheckedChange={(v) => setGroupByEngineer(v === true)} />
                  <span>Group export by engineer (one sheet per engineer)</span>
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-border bg-muted/30'>
                  <th className='text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap'>Sr No</th>
                  <th className='text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap'>Schedule Date</th>
                  <th className='text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap'>Engineer</th>
                  <th className='text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell'>Vertical</th>
                  <th className='text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap'>Category</th>
                  <th className='text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap hidden 2xl:table-cell'>Project Manager</th>
                  <th className='text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell'>Call Number</th>
                  <th className='text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap'>Store</th>
                  <th className='text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell'>City / State</th>
                  <th className='text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell'>Store Format</th>
                  <th className='text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell'>Visit Type</th>
                  <th className='text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap'>Status</th>
                  <th className='text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap hidden 2xl:table-cell'>Zone</th>
                  <th className='text-right py-3 px-3 font-medium text-muted-foreground whitespace-nowrap'>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className='border-b border-border/50'>
                      <td colSpan={14} className='py-3 px-3'><div className='h-4 bg-muted rounded animate-pulse' /></td>
                    </tr>
                  ))
                ) : schedules.length === 0 ? (
                  <tr>
                    <td colSpan={14} className='py-12 text-center text-muted-foreground'>
                      No schedule tasks found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  schedules.map((s: any, idx: number) => {
                    const city = s.store?.district || s.site?.district || '-'
                    const state = s.store?.region || s.site?.region || '-'
                    return (
                      <tr key={s.id} className='border-b border-border/50 hover:bg-muted/20 transition-colors'>
                        <td className='py-2.5 px-3 text-muted-foreground'>{(page - 1) * limit + idx + 1}</td>
                        <td className='py-2.5 px-3 text-muted-foreground whitespace-nowrap'>{s.date}</td>
                        <td className='py-2.5 px-3'>
                          <div><p className='font-medium'>{s.engineer?.name}</p><p className='text-xs text-muted-foreground'>{s.engineer?.engineerCode}</p></div>
                        </td>
                        <td className='py-2.5 px-3 hidden xl:table-cell'>
                          {s.vertical || s.engineer?.vertical ? <Badge variant='outline' className='text-xs'>{s.vertical || s.engineer?.vertical}</Badge> : '-'}
                        </td>
                        <td className='py-2.5 px-3'>{s.activity || '-'}</td>
                        <td className='py-2.5 px-3 hidden 2xl:table-cell text-muted-foreground'>
                          {s.engineer?.projectManager || s.engineer?.manager?.name || '-'}
                        </td>
                        <td className='py-2.5 px-3 hidden lg:table-cell'>
                          {s.callNumber ? <span className='font-mono text-xs'>{s.callNumber}</span> : '-'}
                        </td>
                        <td className='py-2.5 px-3'>
                          <div>
                            <p className='font-medium'>{s.store?.storeName || s.site?.siteName || '-'}</p>
                            <p className='text-xs text-muted-foreground'>{s.store?.storeCode || s.site?.siteCode || ''}</p>
                          </div>
                        </td>
                        <td className='py-2.5 px-3 hidden md:table-cell text-muted-foreground whitespace-nowrap'>
                          {city} / {state}
                        </td>
                        <td className='py-2.5 px-3 hidden xl:table-cell'>{s.store?.storeFormat || '-'}</td>
                        <td className='py-2.5 px-3 hidden lg:table-cell'>
                          {s.visitType ? <Badge variant='secondary' className='text-xs'>{s.visitType}</Badge> : '-'}
                        </td>
                        <td className='py-2.5 px-3'><StatusBadge status={s.status} /></td>
                        <td className='py-2.5 px-3 hidden 2xl:table-cell text-muted-foreground'>{s.zone || s.engineer?.zone || '-'}</td>
                        <td className='py-2.5 px-3 text-right'>
                          <Button variant='ghost' size='icon' className='h-7 w-7' onClick={() => setShowDetail(s)} title='View details'>
                            <Eye className='h-3.5 w-3.5' />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className='flex items-center justify-between px-4 py-3 border-t border-border flex-wrap gap-2'>
              <p className='text-sm text-muted-foreground'>
                Page {page} of {pages} • {total} total tasks
              </p>
              <div className='flex gap-1'>
                <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className='h-4 w-4' /></Button>
                <Button variant='outline' size='sm' disabled={page >= pages} onClick={() => setPage(p => p + 1)}><ChevronRight className='h-4 w-4' /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          {showDetail && (
            <>
              <DialogHeader><DialogTitle>Schedule Task Detail</DialogTitle></DialogHeader>
              <div className='space-y-3'>
                <div className='grid grid-cols-2 gap-3 text-sm'>
                  <DetailItem label='Schedule Date' value={showDetail.date} />
                  <DetailItem label='Status' value={<StatusBadge status={showDetail.status} />} />
                  <DetailItem label='Engineer Name' value={showDetail.engineer?.name} />
                  <DetailItem label='Engineer Code' value={showDetail.engineer?.engineerCode} />
                  <DetailItem label='Vertical' value={showDetail.vertical || showDetail.engineer?.vertical} />
                  <DetailItem label='Category / Activity' value={showDetail.activity} />
                  <DetailItem label='Project Manager' value={showDetail.engineer?.projectManager || showDetail.engineer?.manager?.name} />
                  <DetailItem label='SM Name' value={showDetail.engineer?.smName} />
                  <DetailItem label='Call Number' value={showDetail.callNumber} mono />
                  <DetailItem label='Call Date' value={showDetail.callDate} />
                  <DetailItem label='Visit Type' value={showDetail.visitType} />
                  <DetailItem label='Zone' value={showDetail.zone || showDetail.engineer?.zone} />
                  <DetailItem label='Store Code' value={showDetail.store?.storeCode} mono />
                  <DetailItem label='Store Name' value={showDetail.store?.storeName} />
                  <DetailItem label='Store Format' value={showDetail.store?.storeFormat} />
                  <DetailItem label='City / District' value={showDetail.store?.district || showDetail.site?.district} />
                  <DetailItem label='State / Region' value={showDetail.store?.region || showDetail.site?.region} />
                  <DetailItem label='Site Code' value={showDetail.site?.siteCode} mono />
                  <DetailItem label='Site Name' value={showDetail.site?.siteName} />
                  <DetailItem label='Vendor' value={showDetail.vendor} />
                </div>
                <div className='pt-2 border-t border-border'>
                  <p className='text-muted-foreground text-sm mb-1'>Problem</p>
                  <p className='text-sm'>{showDetail.problem || '-'}</p>
                </div>
                <div className='pt-2 border-t border-border'>
                  <p className='text-muted-foreground text-sm mb-1'>Comment / Remarks</p>
                  <p className='text-sm'>{showDetail.remarks || '-'}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  const toneClasses: Record<string, string> = {
    default: 'bg-card text-card-foreground border-border',
    blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
    sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
    orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  }
  return (
    <Card className={`${toneClasses[tone] || toneClasses.default} border`}>
      <CardContent className='p-3 flex items-center gap-3'>
        <div className='flex items-center justify-center h-9 w-9 rounded-lg bg-background/50 shrink-0'>{icon}</div>
        <div className='min-w-0'>
          <p className='text-xs text-muted-foreground truncate'>{label}</p>
          <p className='text-lg font-bold leading-tight'>{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function DetailItem({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div>
      <p className='text-muted-foreground'>{label}</p>
      <p className={`font-medium ${mono ? 'font-mono text-xs' : ''}`}>{value || '-'}</p>
    </div>
  )
}
