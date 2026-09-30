'use client'

import { useState } from 'react'
import { useApiQuery, useApiMutation } from '@/lib/hooks'
import { useAuthStore } from '@/store/auth-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, Navigation, Edit, Trash2, ChevronLeft, ChevronRight, Crosshair } from 'lucide-react'
import { toast } from 'sonner'

export function SitesView() {
  const user = useAuthStore(s => s.user)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [form, setForm] = useState({ siteCode: '', siteName: '', address: '', district: '', region: '', vendor: '', latitude: '', longitude: '', googleLink: '' })

  const qp = new URLSearchParams({ page: String(page), limit: '20', search })
  const { data, isLoading } = useApiQuery<any>(['sites', page, search], `/api/sites?${qp}`)
  const createMutation = useApiMutation(['sites'], 'POST', '/api/sites', [['sites']])
  const updateMutation = useApiMutation(['sites'], 'PUT', '/api/sites', [['sites']])
  const deleteMutation = useApiMutation(['sites'], 'DELETE', '/api/sites', [['sites']])

  const openCreate = () => { setForm({ siteCode: '', siteName: '', address: '', district: '', region: '', vendor: '', latitude: '', longitude: '', googleLink: '' }); setEditItem(null); setShowCreate(true) }
  const openEdit = (item: any) => { setForm({ siteCode: item.siteCode, siteName: item.siteName, address: item.address || '', district: item.district || '', region: item.region || '', vendor: item.vendor || '', latitude: item.latitude?.toString() || '', longitude: item.longitude?.toString() || '', googleLink: item.googleLink || '' }); setEditItem(item); setShowCreate(true) }

  const handleGetLocation = async () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    setGpsLoading(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
      })
      setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6), googleLink: `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}` }))
      toast.success(`Location: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`)
    } catch (e: any) { toast.error(e.message || 'Failed to get location') }
    finally { setGpsLoading(false) }
  }

  const handleSubmit = () => {
    if (!form.siteCode || !form.siteName) { toast.error('Site code and name are required'); return }
    const payload = { ...form, latitude: form.latitude ? parseFloat(form.latitude) : null, longitude: form.longitude ? parseFloat(form.longitude) : null }
    if (editItem) { updateMutation.mutate({ id: editItem.id, ...payload }, { onSuccess: () => setShowCreate(false) }) }
    else { createMutation.mutate(payload, { onSuccess: () => setShowCreate(false) }) }
  }

  const handleDelete = (id: string) => { if (!confirm('Delete this site?')) return; deleteMutation.mutate({ id }) }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
        <div><h1 className='text-2xl font-bold'>Sites</h1><p className='text-muted-foreground text-sm'>{data?.total || 0} site locations</p></div>
        <Button size='sm' onClick={openCreate}><Plus className='h-4 w-4 mr-2' />Add Site</Button>
      </div>

      <Card>
        <CardContent className='p-4'>
          <div className='relative max-w-sm'><Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' /><Input placeholder='Search sites...' value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className='pl-9 h-9' /></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead><tr className='border-b border-border bg-muted/30'>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Code</th>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Name</th>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell'>District</th>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell'>Region</th>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden xl:table-cell'>Vendor</th>
                <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell'>Schedules</th>
                <th className='text-right py-3 px-4 font-medium text-muted-foreground'>Actions</th>
              </tr></thead>
              <tbody>
                {isLoading ? Array.from({ length: 6 }).map((_, i) => <tr key={i} className='border-b border-border/50'><td colSpan={7} className='py-4 px-4'><div className='h-4 bg-muted rounded animate-pulse' /></td></tr>) : (data?.sites || []).map((s: any) => (
                  <tr key={s.id} className='border-b border-border/50 hover:bg-muted/20 transition-colors'>
                    <td className='py-2.5 px-4 font-mono text-xs'>{s.siteCode}</td>
                    <td className='py-2.5 px-4 font-medium'>{s.siteName}</td>
                    <td className='py-2.5 px-4 text-muted-foreground hidden md:table-cell'>{s.district || '-'}</td>
                    <td className='py-2.5 px-4 text-muted-foreground hidden lg:table-cell'>{s.region || '-'}</td>
                    <td className='py-2.5 px-4 hidden xl:table-cell'>{s.vendor || '-'}</td>
                    <td className='py-2.5 px-4 hidden lg:table-cell'>{s._count?.schedules || 0}</td>
                    <td className='py-2.5 px-4 text-right'>
                      <div className='flex items-center justify-end gap-1'>
                        {s.googleLink && <Button variant='ghost' size='icon' className='h-7 w-7' asChild><a href={s.googleLink} target='_blank' rel='noopener noreferrer'><Navigation className='h-3.5 w-3.5' /></a></Button>}
                        <Button variant='ghost' size='icon' className='h-7 w-7' onClick={() => openEdit(s)}><Edit className='h-3.5 w-3.5' /></Button>
                        {user?.role === 'ADMIN' && <Button variant='ghost' size='icon' className='h-7 w-7 text-destructive' onClick={() => handleDelete(s.id)}><Trash2 className='h-3.5 w-3.5' /></Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isLoading && !data?.sites?.length && <div className='py-12 text-center text-muted-foreground'>No sites found</div>}
          {data?.pages > 1 && (
            <div className='flex items-center justify-between px-4 py-3 border-t border-border'>
              <p className='text-sm text-muted-foreground'>Page {page} of {data.pages}</p>
              <div className='flex gap-1'><Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className='h-4 w-4' /></Button><Button variant='outline' size='sm' disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}><ChevronRight className='h-4 w-4' /></Button></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className='max-w-md'>
          <DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Add'} Site</DialogTitle></DialogHeader>
          <div className='space-y-3'>
            <div className='grid grid-cols-2 gap-3'>
              <div><Label>Site Code *</Label><Input value={form.siteCode} onChange={e => setForm(f => ({ ...f, siteCode: e.target.value }))} className='mt-1' disabled={!!editItem} /></div>
              <div><Label>Vendor</Label><Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} className='mt-1' /></div>
            </div>
            <div><Label>Site Name *</Label><Input value={form.siteName} onChange={e => setForm(f => ({ ...f, siteName: e.target.value }))} className='mt-1' /></div>
            <div><Label>Address</Label><Textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className='mt-1' rows={2} /></div>
            <div className='grid grid-cols-2 gap-3'>
              <div><Label>District</Label><Input value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} className='mt-1' /></div>
              <div><Label>Region</Label><Input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} className='mt-1' /></div>
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <div><Label>Latitude</Label><Input type='number' step='any' value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} className='mt-1' /></div>
              <div><Label>Longitude</Label><Input type='number' step='any' value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} className='mt-1' /></div>
            </div>
            <Button type='button' variant='outline' className='w-full gap-2' onClick={handleGetLocation} disabled={gpsLoading}>
              {gpsLoading ? <div className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' /> : <Crosshair className='h-4 w-4' />}
              Get Current Location (GPS)
            </Button>
            <div><Label>Google Maps Link</Label><Input value={form.googleLink} onChange={e => setForm(f => ({ ...f, googleLink: e.target.value }))} className='mt-1' placeholder='https://maps.google.com/...' /></div>
          </div>
          <DialogFooter><Button variant='outline' onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
