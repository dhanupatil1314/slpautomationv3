'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission, ROLE_LABELS } from '@/lib/rbac'
import { PageHeader, StatusBadge, EmptyState, TableSkeleton, Pagination, ErrorState } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Users, Plus, Search, RefreshCw, Mail, Phone, Building2, ArrowLeft, KeyRound, Shield,
  Clock, LogIn, AlertTriangle,
} from 'lucide-react'
import { formatDateTime, timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const ROLES = Object.keys(ROLE_LABELS).filter((r) => r !== 'viewer')
const STATUSES = ['active', 'suspended', 'invited']

export function UsersView() {
  const { entityId, openDetail, setView } = useNav()
  const { user } = useAuth()
  const role = user?.role

  if (entityId) return <UserDetail userId={entityId} />

  return <UserList role={role} openDetail={openDetail} setView={setView} />
}

function UserList({ role, openDetail, setView }: { role: string | undefined; openDetail: (view: any, id: string) => void; setView: any }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const pageSize = 20

  const query = new URLSearchParams({
    page: String(page), pageSize: String(pageSize),
    search, role: roleFilter === 'all' ? '' : roleFilter,
    status: statusFilter === 'all' ? '' : statusFilter,
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/users?${query}`, { refreshKey })

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setRefreshKey((k) => k + 1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const users = data?.users || []
  const total = data?.total || 0

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage CMS user accounts, roles, and access"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Users' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'users.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" /> Add User
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : users.length === 0 ? (
        <Card><CardContent><EmptyState icon={Users} title="No users found" /></CardContent></Card>
      ) : (
        <>
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">User</th>
                    <th className="text-left p-3 font-semibold">Role</th>
                    <th className="text-left p-3 font-semibold">Organization</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id} onClick={() => openDetail('users', u.id)} className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-primary/10 text-primary">{u.name?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
                          <div>
                            <p className="font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3"><RoleBadge role={u.role} /></td>
                      <td className="p-3 text-muted-foreground">{u.organization}</td>
                      <td className="p-3"><StatusBadge status={u.status} /></td>
                      <td className="p-3 text-xs text-muted-foreground">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="md:hidden space-y-2">
            {users.map((u: any) => (
              <Card key={u.id} onClick={() => openDetail('users', u.id)} className="cursor-pointer hover:shadow-md">
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/10 text-primary">{u.name?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{u.name}</p>
                      <StatusBadge status={u.status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <div className="mt-1"><RoleBadge role={u.role} /></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showAdd && <AddUserDialog onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); setRefreshKey((k) => k + 1) }} />}
    </div>
  )
}

function UserDetail({ userId }: { userId: string }) {
  const { setView } = useNav()
  const { user: currentUser } = useAuth()
  const role = currentUser?.role
  const [refreshKey, setRefreshKey] = useState(0)
  const [editing, setEditing] = useState(false)
  const [resettingPw, setResettingPw] = useState(false)
  const { data, loading, error } = useFetch<any>(`/api/users/${userId}`, { refreshKey })

  if (loading) return (
    <div>
      <PageHeader title="User Detail" breadcrumbs={[{ label: 'Users', onClick: () => setView('users') }]} />
      <div className="space-y-3"><div className="h-32 bg-muted animate-pulse rounded-lg" /><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>
    </div>
  )
  if (error || !data) return (
    <div>
      <PageHeader title="User Detail" breadcrumbs={[{ label: 'Users', onClick: () => setView('users') }]} />
      <ErrorState message={error || 'Not found'} onRetry={() => setView('users')} />
    </div>
  )

  const u = data.user
  const canEdit = hasPermission(role, 'users.edit')
  const canDelete = hasPermission(role, 'users.delete')

  const handleDelete = async () => {
    if (!confirm('Soft-delete this user? They will be suspended and unable to log in.')) return
    try {
      await mutate(`/api/users/${userId}`, 'DELETE')
      toast.success('User deleted')
      setView('users')
    } catch (e: any) { toast.error(e.message || 'Failed') }
  }

  return (
    <div>
      <PageHeader
        title={u.name}
        subtitle={u.email}
        breadcrumbs={[{ label: 'Users', onClick: () => setView('users') }, { label: u.name }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setView('users')}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            {canEdit && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}><Shield className="h-3.5 w-3.5" /> Edit</Button>}
            {canEdit && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setResettingPw(true)}><KeyRound className="h-3.5 w-3.5" /> Reset Password</Button>}
            {canDelete && <Button size="sm" variant="destructive" onClick={handleDelete}>Delete</Button>}
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/10 text-primary text-xl">{u.name?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold">{u.name}</h2>
              <StatusBadge status={u.status} />
              <RoleBadge role={u.role} />
            </div>
            <p className="text-sm text-muted-foreground">{u.email} · {u.phone || 'No phone'}</p>
            <p className="text-xs text-muted-foreground mt-1">{u.organization?.name || 'No organization'}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList className="mb-4"><TabsTrigger value="profile">Profile</TabsTrigger><TabsTrigger value="activity">Login Activity</TabsTrigger><TabsTrigger value="audit">Audit Trail</TabsTrigger></TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Profile Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Row label="Full Name" value={u.name} icon={Users} />
              <Row label="Email" value={u.email} icon={Mail} />
              <Row label="Phone" value={u.phone || '—'} icon={Phone} />
              <Row label="Role" value={<RoleBadge role={u.role} />} icon={Shield} />
              <Row label="Organization" value={u.organization?.name || '—'} icon={Building2} />
              <Row label="Status" value={<StatusBadge status={u.status} />} />
              <Row label="Created" value={formatDateTime(u.createdAt)} icon={Clock} />
              <Row label="Last Login" value={u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'} icon={LogIn} />
              <Row label="Last Login IP" value={u.lastLoginIp || '—'} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Login Activity</CardTitle><CardDescription className="text-xs">Recent login attempts</CardDescription></CardHeader>
            <CardContent>
              {u.loginActivities?.length === 0 ? (
                <EmptyState icon={LogIn} title="No login activity" />
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto scrollbar-thin">
                  {u.loginActivities?.map((l: any) => (
                    <div key={l.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
                      <LogIn className={cn('h-4 w-4', l.success ? 'text-success' : 'text-destructive')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs">{l.success ? 'Successful login' : 'Failed attempt'}</p>
                        <p className="text-[10px] text-muted-foreground">{l.ip || '—'} · {l.userAgent?.slice(0, 60) || '—'}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(l.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Actions</CardTitle><CardDescription className="text-xs">Last 10 actions performed by this user</CardDescription></CardHeader>
            <CardContent>
              {u.auditLogs?.length === 0 ? (
                <EmptyState icon={Clock} title="No actions recorded" />
              ) : (
                <div className="space-y-1">
                  {u.auditLogs?.map((l: any) => (
                    <div key={l.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
                      <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{l.action.replace(/_/g, ' ')}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{l.details || l.entity || '—'}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(l.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editing && <EditUserDialog user={u} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setRefreshKey((k) => k + 1) }} />}
      {resettingPw && <ResetPasswordDialog userId={u.id} email={u.email} onClose={() => setResettingPw(false)} />}
    </div>
  )
}

function Row({ label, value, icon: Icon }: { label: string; value: any; icon?: any }) {
  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-accent/40">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">{Icon && <Icon className="h-3 w-3" />}{label}</span>
      <span className="font-medium text-right text-sm">{value}</span>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    super_admin: 'bg-primary/15 text-primary border-primary/30',
    ops_admin: 'bg-success/15 text-success border-success/30',
    ads_manager: 'bg-warning/15 text-warning-foreground border-warning/30',
    finance_admin: 'bg-info/15 text-info border-info/30',
    service_engineer: 'bg-muted text-muted-foreground border-border',
    advertiser: 'bg-muted text-muted-foreground border-border',
    vehicle_owner: 'bg-muted text-muted-foreground border-border',
    driver: 'bg-muted text-muted-foreground border-border',
  }
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border', map[role] || 'bg-muted text-muted-foreground border-border')}>{ROLE_LABELS[role] || role}</span>
}

function AddUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', role: 'viewer', organizationId: '', password: '', status: 'active',
  })
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    if (!form.name || !form.email || !form.password || !form.role) return toast.error('Name, email, password, role required')
    setLoading(true)
    try {
      await mutate('/api/users', 'POST', form)
      toast.success('User created')
      onCreated()
    } catch (e: any) { toast.error(e.message || 'Failed') } finally { setLoading(false) }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add User</DialogTitle><DialogDescription>Create a new CMS user account</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div>
            <Label>Role *</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Organization ID (optional)</Label><Input value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} placeholder="cuid..." /></div>
          <div><Label>Password *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create User'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditUserDialog({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: user.name, email: user.email, phone: user.phone || '',
    role: user.role, organizationId: user.organizationId || '', status: user.status,
  })
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try {
      await mutate(`/api/users/${user.id}`, 'PATCH', form)
      toast.success('User updated')
      onSaved()
    } catch (e: any) { toast.error(e.message || 'Failed') } finally { setLoading(false) }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Organization ID</Label><Input value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} /></div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ userId, email, onClose }: { userId: string; email: string; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    if (password.length < 6) return toast.error('Password must be at least 6 characters')
    setLoading(true)
    try {
      await mutate(`/api/users/${userId}`, 'PATCH', { password })
      toast.success('Password reset successfully')
      onClose()
    } catch (e: any) { toast.error(e.message || 'Failed') } finally { setLoading(false) }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Reset Password</DialogTitle><DialogDescription>Set a new password for {email}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>New Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
