'use client'

import { useState, useEffect } from 'react'
import { useApiQuery, useApiMutation } from '@/lib/hooks'
import { useAuthStore } from '@/store/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/layout/status-badge'
import { Search, Filter, ChevronLeft, ChevronRight, Plus, Navigation, X, Eye, Crosshair, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

export function SchedulesView() {
  const user = useAuthStore(s => s.user)
  const token = useAuthStore(s => s.token)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [activityFilter, setActivityFilter] = useState('')
  const [engineerFilter, setEngineerFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState<any>(null)
  const [sharedHistory, setSharedHistory] = useState<any[]>([])
  const [gpsLoading, setGpsLoading] = useState<string | null>(null)
  const [globalSearch, setGlobalSearch] = useState('')

  useEffect(() => {
    const handler = (e: any) => { setSearch(e.detail); setPage(1) }
    window.addEventListener('globalSearch', handler)
    return () => window.removeEventListener('globalSearch', handler)
  }, [])

  // Fetch filter options
  const { data: filterOpts } = useApiQuery<any>(['schedule-filters'], `/api/schedules/filters`, { enabled: user?.role !== 'ENGINEER' })

  const queryParams = new URLSearchParams({ page: String(page), limit: '20' })
  if (search || globalSearch) queryParams.set('search', search || globalSearch)
  if (statusFilter) queryParams.set('status', statusFilter)
  if (dateFilter) queryParams.set('date', dateFilter)
  if (districtFilter) queryParams.set('district', districtFilter)
  if (regionFilter) queryParams.set('region', regionFilter)
  if (vendorFilter) queryParams.set('vendor', vendorFilter)
  if (activityFilter) queryParams.set('activity', activityFilter)
  if (engineerFilter) queryParams.set('engineerId', engineerFilter)

  const { data, isLoading, refetch } = useApiQuery<any>(['schedules', page, search, statusFilter, dateFilter, districtFilter, regionFilter, vendorFilter, activityFilter, engineerFilter], `/api/schedules?${queryParams}`)
  const deleteMutation = useApiMutation(['schedules'], 'DELETE', '/api/schedules', [['schedules']])
  const updateMutation = useApiMutation(['schedules'], 'PUT', '/api/schedules', [['schedules']])

  const handleStatusChange = (id: string, status: string, remarks?: string) => {
    updateMutation.mutate({ id, status, remarks })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this schedule?')) return
    deleteMutation.mutate({ id })
  }

  const handleGetLocation = async (schedule: any) => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    setGpsLoading(schedule.id)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
      })
      const gpsStr = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`
      const gmapLink = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`
      updateMutation.mutate({ id: schedule.id, remarks: `[GPS: ${gpsStr}] ${schedule.remarks || ''}` }, {
        onSuccess: () => { toast.success(`Location captured: ${gpsStr}`); setShowDetail({ ...schedule, remarks: `[GPS: ${gpsStr}] ${schedule.remarks || ''}` }) }
      })
    } catch (e: any) {
      toast.error(e.message || 'Failed to get location')
    } finally { setGpsLoading(null) }
  }

  const viewDetail = async (schedule: any) => {
    setShowDetail(schedule)
    if (schedule.site?.siteCode) {
      try {
        const res = await fetch(`/api/schedules?siteCode=${schedule.site.siteCode}`, { headers: { authorization: `Bearer ${token}` } })
        const data = await res.json()
        setSharedHistory(data.sharedHistory || [])
      } catch { setSharedHistory([]) }
    }
  }

  const activeFilters = [statusFilter, dateFilter, districtFilter, regionFilter, vendorFilter, activityFilter, engineerFilter].filter(Boolean).length

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
        <div><h1 className='text-2xl font-bold'>Schedules</h1><p className='text-muted-foreground text-sm'>Manage field engineer schedules</p></div>
        {user?.role !== 'ENGINEER' && (
          <Button size='sm' onClick={() => setShowCreate(true)}><Plus className='h-4 w-4 mr-2' />New Schedule</Button>
        )}
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className='p-4'>
          <div className='flex flex-wrap gap-3 items-center'>
            <div className='relative flex-1 min-w-[200px]'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input placeholder='Search engineers, sites, stores...' value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className='pl-9 h-9' />
            </div>
            <Input type='date' value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(1) }} className='w-40 h-9' />
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v === 'ALL' ? '' : v); setPage(1) }}>
              <SelectTrigger className='w-36 h-9'><SelectValue placeholder='All Status' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='ALL'>All Status</SelectItem>
                {['ASSIGNED', 'PENDING', 'COMPLETED', 'HOLD', 'CANCELLED', 'RESCHEDULED'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={showFilters ? 'secondary' : 'outline'} size='sm' className='h-9 gap-1.5' onClick={() => setShowFilters(f => !f)}>
              <Filter className='h-4 w-4' />More Filters{activeFilters > 0 && <Badge variant='default' className='ml-1 h-5 w-5 p-0 text-[10px] flex items-center justify-center'>{activeFilters}</Badge>}
            </Button>
            {(search || statusFilter || dateFilter || activeFilters > 0) && (
              <Button variant='ghost' size='sm' onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter(''); setDistrictFilter(''); setRegionFilter(''); setVendorFilter(''); setActivityFilter(''); setEngineerFilter(''); setPage(1) }}><X className='h-4 w-4 mr-1' />Clear</Button>
            )}
          </div>
          {showFilters && (
            <div className='flex flex-wrap gap-3 items-center mt-3 pt-3 border-t border-border'>
              {user?.role !== 'ENGINEER' && (
                <Select value={engineerFilter} onValueChange={v => { setEngineerFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                  <SelectTrigger className='w-44 h-9'><SelectValue placeholder='All Engineers' /></SelectTrigger>
                  <SelectContent><SelectItem value='ALL'>All Engineers</SelectItem>{(filterOpts?.engineers || []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.engineerCode})</SelectItem>)}</SelectContent>
                </Select>
              )}
              <Select value={districtFilter} onValueChange={v => { setDistrictFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                <SelectTrigger className='w-40 h-9'><SelectValue placeholder='All Districts' /></SelectTrigger>
                <SelectContent><SelectItem value='ALL'>All Districts</SelectItem>{(filterOpts?.districts || []).map((d: string) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={regionFilter} onValueChange={v => { setRegionFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                <SelectTrigger className='w-36 h-9'><SelectValue placeholder='All Regions' /></SelectTrigger>
                <SelectContent><SelectItem value='ALL'>All Regions</SelectItem>{(filterOpts?.regions || []).map((r: string) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={vendorFilter} onValueChange={v => { setVendorFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                <SelectTrigger className='w-36 h-9'><SelectValue placeholder='All Vendors' /></SelectTrigger>
                <SelectContent><SelectItem value='ALL'>All Vendors</SelectItem>{(filterOpts?.vendors || []).map((v: string) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={activityFilter} onValueChange={v => { setActivityFilter(v === 'ALL' ? '' : v); setPage(1) }}>
                <SelectTrigger className='w-40 h-9'><SelectValue placeholder='All Activities' /></SelectTrigger>
                <SelectContent><SelectItem value='ALL'>All Activities</SelectItem>{(filterOpts?.activities || []).map((a: string) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead><tr className='border-b border-border bg-muted/30'>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Date</th>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Engineer</th>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell'>Site</th>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Store</th>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell'>Activity</th>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden xl:table-cell'>Vendor</th>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Status</th>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground text-right'>Actions</th>
              </tr></thead>
              <tbody>
                {isLoading ? Array.from({ length: 8 }).map((_, i) => <tr key={i} className='border-b border-border/50'><td colSpan={8} className='py-4 px-4'><div className='h-4 bg-muted rounded animate-pulse' /></td></tr>) : (data?.schedules || []).map((s: any) => (
                  <tr key={s.id} className='border-b border-border/50 hover:bg-muted/20 transition-colors'>
                    <td className='py-2.5 px-4 text-muted-foreground whitespace-nowrap'>{s.date}</td>
                    <td className='py-2.5 px-4'><div><p className='font-medium'>{s.engineer?.name}</p><p className='text-xs text-muted-foreground'>{s.engineer?.engineerCode}</p></div></td>
                    <td className='py-2.5 px-4 hidden lg:table-cell'><div><p className='font-medium'>{s.site?.siteName || '-'}</p><p className='text-xs text-muted-foreground'>{s.site?.siteCode || ''} {s.site?.district ? `• ${s.site.district}` : ''}</p></div></td>
                    <td className='py-2.5 px-4'><div><p className='font-medium'>{s.store?.storeName || '-'}</p><p className='text-xs text-muted-foreground'>{s.store?.storeCode ? `${s.store.storeCode}` : ''}{s.store?.storeFormat ? ` • ${s.store.storeFormat}` : ''}</p></div></td>
                    <td className='py-2.5 px-4 hidden md:table-cell'>{s.activity || '-'}</td>
                    <td className='py-2.5 px-4 hidden xl:table-cell text-muted-foreground'>{s.vendor || '-'}</td>
                    <td className='py-2.5 px-4'><StatusBadge status={s.status} /></td>
                    <td className='py-2.5 px-4 text-right'>
                      <div className='flex items-center justify-end gap-1'>
                        <Button variant='ghost' size='icon' className='h-7 w-7' onClick={() => viewDetail(s)} title='View details'><Eye className='h-3.5 w-3.5' /></Button>
                        {user?.role === 'ENGINEER' && s.status !== 'COMPLETED' && (
                          <Button variant='ghost' size='icon' className='h-7 w-7 text-emerald-600' onClick={() => handleGetLocation(s)} disabled={gpsLoading === s.id} title='Get GPS Location'>
                            {gpsLoading === s.id ? <div className='h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent' /> : <Crosshair className='h-3.5 w-3.5' />}
                          </Button>
                        )}
                        {s.site?.googleLink && <Button variant='ghost' size='icon' className='h-7 w-7' asChild><a href={s.site.googleLink} target='_blank' rel='noopener noreferrer' title='Navigate'><Navigation className='h-3.5 w-3.5' /></a></Button>}
                        {user?.role === 'ADMIN' && <Button variant='ghost' size='icon' className='h-7 w-7 text-destructive' onClick={() => handleDelete(s.id)} title='Delete'><X className='h-3.5 w-3.5' /></Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isLoading && (!data?.schedules?.length) && <div className='py-12 text-center text-muted-foreground'>No schedules found</div>}
          {data?.pages > 1 && (
            <div className='flex items-center justify-between px-4 py-3 border-t border-border'>
              <p className='text-sm text-muted-foreground'>Page {page} of {data.pages} ({data.total} total)</p>
              <div className='flex gap-1'>
                <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className='h-4 w-4' /></Button>
                <Button variant='outline' size='sm' disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}><ChevronRight className='h-4 w-4' /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className='max-w-lg'>
          {showDetail && (
            <>
              <DialogHeader><DialogTitle>Schedule Detail</DialogTitle></DialogHeader>
              <div className='space-y-3'>
                <div className='grid grid-cols-2 gap-3 text-sm'>
                  <div><p className='text-muted-foreground'>Date</p><p className='font-medium'>{showDetail.date}</p></div>
                  <div><p className='text-muted-foreground'>Status</p><StatusBadge status={showDetail.status} /></div>
                  <div><p className='text-muted-foreground'>Engineer</p><p className='font-medium'>{showDetail.engineer?.name}</p></div>
                  <div><p className='text-muted-foreground'>Activity</p><p className='font-medium'>{showDetail.activity || '-'}</p></div>
                  <div><p className='text-muted-foreground'>Site</p><p className='font-medium'>{showDetail.site?.siteName || '-'} <span className='text-muted-foreground'>({showDetail.site?.siteCode})</span></p></div>
                  <div><p className='text-muted-foreground'>District/Region</p><p className='font-medium'>{showDetail.site?.district || '-'} / {showDetail.site?.region || '-'}</p></div>
                  <div><p className='text-muted-foreground'>Store Code</p><p className='font-medium font-mono'>{showDetail.store?.storeCode || '-'}</p></div>
                  <div><p className='text-muted-foreground'>Store Name</p><p className='font-medium'>{showDetail.store?.storeName || '-'}</p></div>
                  <div><p className='text-muted-foreground'>Store Format</p><p className='font-medium'>{showDetail.store?.storeFormat || '-'}</p></div>
                  <div><p className='text-muted-foreground'>Vendor</p><p className='font-medium'>{showDetail.vendor || '-'}</p></div>
                  <div className='col-span-2'><p className='text-muted-foreground'>Remarks</p><p className='font-medium'>{showDetail.remarks || '-'}</p></div>
                </div>
                <div className='flex gap-2 pt-2 border-t border-border'>
                  {user?.role === 'ENGINEER' && showDetail.status !== 'COMPLETED' && (
                    <Button size='sm' className='flex-1 gap-1.5' onClick={() => handleGetLocation(showDetail)} disabled={gpsLoading === showDetail.id}>
                      {gpsLoading === showDetail.id ? <div className='h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent' /> : <Crosshair className='h-4 w-4' />}
                      Get Location
                    </Button>
                  )}
                  {showDetail.site?.googleLink && (
                    <Button size='sm' variant='outline' className='flex-1 gap-1.5' asChild><a href={showDetail.site.googleLink} target='_blank' rel='noopener noreferrer'><Navigation className='h-4 w-4' />Google Maps</a></Button>
                  )}
                </div>
                {user?.role !== 'ENGINEER' && (
                  <div className='flex gap-2 pt-2 border-t border-border'>
                    {showDetail.status !== 'COMPLETED' && <Button size='sm' onClick={() => { handleStatusChange(showDetail.id, 'COMPLETED'); setShowDetail(null) }}>Mark Complete</Button>}
                    {showDetail.status !== 'HOLD' && <Button size='sm' variant='outline' onClick={() => { handleStatusChange(showDetail.id, 'HOLD'); setShowDetail(null) }}>Put on Hold</Button>}
                    {showDetail.status !== 'CANCELLED' && <Button size='sm' variant='outline' className='text-destructive' onClick={() => { handleStatusChange(showDetail.id, 'CANCELLED'); setShowDetail(null) }}>Cancel</Button>}
                  </div>
                )}
                {user?.role === 'ENGINEER' && showDetail.status !== 'COMPLETED' && (
                  <div className='pt-2 border-t border-border'>
                    <Button size='sm' className='w-full' onClick={() => { handleStatusChange(showDetail.id, 'COMPLETED', 'Completed by engineer'); setShowDetail(null) }}>Complete Site</Button>
                  </div>
                )}
              </div>
              {sharedHistory.length > 0 && (
                <div className='mt-4 pt-4 border-t border-border'>
                  <p className='text-sm font-medium mb-2'>Shared Site History ({sharedHistory.length} visits by other engineers)</p>
                  <div className='max-h-48 overflow-y-auto space-y-2'>
                    {sharedHistory.map((h: any) => (
                      <div key={h.id} className='p-2 rounded-lg bg-muted/30 text-xs'>
                        <div className='flex justify-between'><span className='font-medium'>{h.engineer?.name}</span><span className='text-muted-foreground'>{h.date}</span></div>
                        <p className='text-muted-foreground'>{h.status} {h.remarks ? `- ${h.remarks}` : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <CreateScheduleDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  )
}

function CreateScheduleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [form, setForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), engineerId: '', siteId: '', storeId: '', vendor: '', activity: 'Installation', status: 'ASSIGNED', remarks: '' })
  const mutation = useApiMutation(['schedules'], 'POST', '/api/schedules', [['schedules']])

  const { data: engineers } = useApiQuery<any>(['users-engineers'], '/api/users?role=ENGINEER&limit=100')
  const { data: sites } = useApiQuery<any>(['sites-list'], '/api/sites?limit=100')
  const { data: stores } = useApiQuery<any>(['stores-list'], '/api/stores?limit=100')

  const handleSubmit = () => {
    if (!form.date || !form.engineerId) { toast.error('Date and Engineer are required'); return }
    mutation.mutate(form, { onSuccess: () => { onOpenChange(false); setForm({ date: format(new Date(), 'yyyy-MM-dd'), engineerId: '', siteId: '', storeId: '', vendor: '', activity: 'Installation', status: 'ASSIGNED', remarks: '' }) } })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md'>
        <DialogHeader><DialogTitle>Create Schedule</DialogTitle></DialogHeader>
        <div className='space-y-3'>
          <div className='grid grid-cols-2 gap-3'>
            <div><Label>Date</Label><Input type='date' value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className='mt-1' /></div>
            <div><Label>Activity</Label><Select value={form.activity} onValueChange={v => setForm(f => ({ ...f, activity: v }))}><SelectTrigger className='mt-1'><SelectValue /></SelectTrigger><SelectContent>{['Installation', 'Maintenance', 'Inspection', 'Upgrade', 'Repair', 'Survey', 'Special Project'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div><Label>Engineer</Label><Select value={form.engineerId} onValueChange={v => setForm(f => ({ ...f, engineerId: v }))}><SelectTrigger className='mt-1'><SelectValue placeholder='Select engineer' /></SelectTrigger><SelectContent>{(engineers?.users || []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.engineerCode})</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Site</Label><Select value={form.siteId} onValueChange={v => setForm(f => ({ ...f, siteId: v }))}><SelectTrigger className='mt-1'><SelectValue placeholder='Select site' /></SelectTrigger><SelectContent>{(sites?.sites || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.siteName} ({s.siteCode})</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Store</Label><Select value={form.storeId} onValueChange={v => setForm(f => ({ ...f, storeId: v }))}><SelectTrigger className='mt-1'><SelectValue placeholder='Select store' /></SelectTrigger><SelectContent>{(stores?.stores || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.storeName} ({s.storeCode})</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Vendor</Label><Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} className='mt-1' placeholder='Vendor name' /></div>
          <div><Label>Remarks</Label><Textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className='mt-1' rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>{mutation.isPending ? 'Creating...' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
