'use client'

import { useState } from 'react'
import { useApiQuery, useApiMutation } from '@/lib/hooks'
import { useAuthStore } from '@/store/auth-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Edit, ChevronLeft, ChevronRight, Shield, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

export function UsersView() {
  const user = useAuthStore(s => s.user)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ engineerCode: '', name: '', password: '', phone: '', role: 'ENGINEER', managerId: '' })
  const [showReset, setShowReset] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')

  const qp = new URLSearchParams({ page: String(page), limit: '20', search, role: roleFilter })
  const { data, isLoading } = useApiQuery<any>(['users', page, search, roleFilter], `/api/users?${qp}`)
  const { data: managers } = useApiQuery<any>(['managers'], '/api/users?role=MANAGER&limit=100')
  const createMutation = useApiMutation(['users'], 'POST', '/api/users', [['users']])
  const updateMutation = useApiMutation(['users'], 'PUT', '/api/users', [['users']])

  const openCreate = () => { setForm({ engineerCode: '', name: '', password: '', phone: '', role: 'ENGINEER', managerId: '' }); setEditItem(null); setShowCreate(true) }
  const openEdit = (item: any) => { setForm({ engineerCode: item.engineerCode, name: item.name, password: '', phone: item.phone || '', role: item.role, managerId: item.managerId || '' }); setEditItem(item); setShowCreate(true) }

  const handleSubmit = () => {
    if (!form.engineerCode || !form.name) { toast.error('Code and name are required'); return }
    if (!editItem && !form.password) { toast.error('Password is required for new users'); return }
    const payload: any = { ...form }
    if (editItem) {
      if (newPassword) payload.newPassword = newPassword
      delete payload.password
      updateMutation.mutate({ id: editItem.id, ...payload }, { onSuccess: () => { setShowCreate(false); setNewPassword('') } })
    } else {
      createMutation.mutate(payload, { onSuccess: () => setShowCreate(false) })
    }
  }

  const handleResetPassword = () => {
    if (!newPassword || !showReset) return
    updateMutation.mutate({ id: showReset.id, name: showReset.name, role: showReset.role, newPassword }, { onSuccess: () => { setShowReset(null); setNewPassword(''); toast.success('Password reset successfully') } })
  }

  const roleBadge: Record<string, string> = { ADMIN: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400', MANAGER: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400', ENGINEER: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
        <div><h1 className='text-2xl font-bold'>Users</h1><p className='text-muted-foreground text-sm'>{data?.total || 0} users</p></div>
        {user?.role === 'ADMIN' && <Button size='sm' onClick={openCreate}><Plus className='h-4 w-4 mr-2' />Add User</Button>}
      </div>

      <Card><CardContent className='p-4'>
        <div className='flex flex-wrap gap-3 items-center'>
          <div className='relative flex-1 min-w-[200px]'><Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' /><Input placeholder='Search users...' value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className='pl-9 h-9' /></div>
          <Select value={roleFilter || 'ALL'} onValueChange={v => { setRoleFilter(v === 'ALL' ? '' : v); setPage(1) }}><SelectTrigger className='w-36 h-9'><SelectValue placeholder='All Roles' /></SelectTrigger><SelectContent><SelectItem value='ALL'>All Roles</SelectItem><SelectItem value='ADMIN'>Admin</SelectItem><SelectItem value='MANAGER'>Manager</SelectItem><SelectItem value='ENGINEER'>Engineer</SelectItem></SelectContent></Select>
        </div>
      </CardContent></Card>

      <Card><CardContent className='p-0'>
        <div className='overflow-x-auto'><table className='w-full text-sm'>
          <thead><tr className='border-b border-border bg-muted/30'>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Code</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Name</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground'>Role</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell'>Manager</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell'>Phone</th>
            <th className='text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell'>Status</th>
            <th className='text-right py-3 px-4 font-medium text-muted-foreground'>Actions</th>
          </tr></thead>
          <tbody>
            {isLoading ? Array.from({ length: 6 }).map((_, i) => <tr key={i} className='border-b border-border/50'><td colSpan={7} className='py-4 px-4'><div className='h-4 bg-muted rounded animate-pulse' /></td></tr>) : (data?.users || []).map((u: any) => (
              <tr key={u.id} className='border-b border-border/50 hover:bg-muted/20 transition-colors'>
                <td className='py-2.5 px-4 font-mono text-xs'>{u.engineerCode}</td>
                <td className='py-2.5 px-4 font-medium'>{u.name}</td>
                <td className='py-2.5 px-4'><Badge variant='outline' className={roleBadge[u.role] || ''}>{u.role}</Badge></td>
                <td className='py-2.5 px-4 text-muted-foreground hidden md:table-cell'>{u.manager?.name || '-'}</td>
                <td className='py-2.5 px-4 text-muted-foreground hidden lg:table-cell'>{u.phone || '-'}</td>
                <td className='py-2.5 px-4 hidden lg:table-cell'><Badge variant={u.status === 'ACTIVE' ? 'default' : 'secondary'} className='text-xs'>{u.status}</Badge></td>
                <td className='py-2.5 px-4 text-right'>
                  <div className='flex items-center justify-end gap-1'>
                    <Button variant='ghost' size='icon' className='h-7 w-7' onClick={() => openEdit(u)}><Edit className='h-3.5 w-3.5' /></Button>
                    {user?.role === 'ADMIN' && <Button variant='ghost' size='icon' className='h-7 w-7' onClick={() => { setShowReset(u); setNewPassword('') }}><KeyRound className='h-3.5 w-3.5' /></Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {!isLoading && !data?.users?.length && <div className='py-12 text-center text-muted-foreground'>No users found</div>}
        {data?.pages > 1 && (
          <div className='flex items-center justify-between px-4 py-3 border-t border-border'>
            <p className='text-sm text-muted-foreground'>Page {page} of {data.pages}</p>
            <div className='flex gap-1'><Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className='h-4 w-4' /></Button><Button variant='outline' size='sm' disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}><ChevronRight className='h-4 w-4' /></Button></div>
          </div>
        )}
      </CardContent></Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className='max-w-md'>
          <DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Create'} User</DialogTitle></DialogHeader>
          <div className='space-y-3'>
            <div className='grid grid-cols-2 gap-3'><div><Label>Engineer Code</Label><Input value={form.engineerCode} onChange={e => setForm(f => ({ ...f, engineerCode: e.target.value }))} className='mt-1' disabled={!!editItem} /></div><div><Label>Role</Label><Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}><SelectTrigger className='mt-1'><SelectValue /></SelectTrigger><SelectContent><SelectItem value='ENGINEER'>Engineer</SelectItem><SelectItem value='MANAGER'>Manager</SelectItem><SelectItem value='ADMIN'>Admin</SelectItem></SelectContent></Select></div></div>
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className='mt-1' /></div>
            {!editItem && <div><Label>Password</Label><Input type='password' value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className='mt-1' /></div>}
            {editItem && <div><Label>New Password (leave blank to keep)</Label><Input type='password' value={newPassword} onChange={e => setNewPassword(e.target.value)} className='mt-1' placeholder='Enter new password' /></div>}
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className='mt-1' /></div>
            {(form.role === 'ENGINEER') && <div><Label>Assign to Manager</Label><Select value={form.managerId} onValueChange={v => setForm(f => ({ ...f, managerId: v }))}><SelectTrigger className='mt-1'><SelectValue placeholder='Select manager' /></SelectTrigger><SelectContent>{(managers?.users || []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.engineerCode})</SelectItem>)}</SelectContent></Select></div>}
          </div>
          <DialogFooter><Button variant='outline' onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showReset} onOpenChange={() => setShowReset(null)}>
        <DialogContent className='max-w-sm'>
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <p className='text-sm text-muted-foreground'>Set new password for <strong>{showReset?.name}</strong></p>
          <div><Label>New Password</Label><Input type='password' value={newPassword} onChange={e => setNewPassword(e.target.value)} className='mt-1' /></div>
          <DialogFooter><Button variant='outline' onClick={() => setShowReset(null)}>Cancel</Button><Button onClick={handleResetPassword} disabled={!newPassword || updateMutation.isPending}>Reset</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}