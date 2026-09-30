'use client'

import { useState } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission, ROLE_LABELS } from '@/lib/rbac'
import { PageHeader, EmptyState, ErrorState, LoadingGrid } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Shield, ShieldCheck, Lock, Check, Save, RefreshCw } from 'lucide-react'
import { Fragment } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function RolesView() {
  const { user } = useAuth()
  const role = user?.role
  const [refreshKey, setRefreshKey] = useState(0)
  const [savingRole, setSavingRole] = useState<string | null>(null)
  const [localPerms, setLocalPerms] = useState<Record<string, Set<string>>>({})

  const { data, loading, error } = useFetch<any>('/api/roles', { refreshKey })

  if (loading) {
    return (
      <div>
        <PageHeader title="Roles & Permissions" breadcrumbs={[{ label: 'Administration' }, { label: 'Roles' }]} />
        <LoadingGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-4" count={8} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Roles & Permissions" breadcrumbs={[{ label: 'Administration' }, { label: 'Roles' }]} />
        <ErrorState message={error || 'Failed to load roles'} onRetry={() => setRefreshKey((k) => k + 1)} />
      </div>
    )
  }

  const canEdit = hasPermission(role, 'roles.edit')
  const roles = data.roles as any[]
  const modules = data.modules as Record<string, string[]>
  const moduleNames = Object.keys(modules).sort()

  // Get effective permissions for a role (combining DB or local edits)
  const getRolePerms = (roleId: string, defaultPerms: string[]): Set<string> => {
    if (localPerms[roleId]) return localPerms[roleId]
    return new Set(defaultPerms)
  }

  const togglePerm = (roleId: string, perm: string, currentlyHas: boolean) => {
    setLocalPerms((prev) => {
      const next = { ...prev }
      const set = new Set(next[roleId] || roles.find((r) => r.id === roleId)?.permissions || [])
      if (currentlyHas) set.delete(perm)
      else set.add(perm)
      next[roleId] = set
      return next
    })
  }

  const saveRole = async (roleId: string) => {
    const perms = Array.from(localPerms[roleId] || [])
    setSavingRole(roleId)
    try {
      await mutate('/api/roles', 'PUT', { roleId, permissions: perms })
      toast.success('Permissions updated')
      setLocalPerms((prev) => { const n = { ...prev }; delete n[roleId]; return n })
      setRefreshKey((k) => k + 1)
    } catch (e: any) {
      toast.error(e.message || 'Failed to update')
    } finally {
      setSavingRole(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="8 system roles with granular module-level permissions"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Roles & Permissions' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <Tabs defaultValue="cards">
        <TabsList className="mb-4">
          <TabsTrigger value="cards">Role Cards</TabsTrigger>
          <TabsTrigger value="matrix">Permission Matrix</TabsTrigger>
        </TabsList>

        {/* Role Cards View */}
        <TabsContent value="cards">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {roles.map((r: any) => {
              const perms = r.permissions as string[]
              // Group perms by module for display
              const grouped: Record<string, string[]> = {}
              perms.forEach((p: string) => {
                const m = p.split('.')[0]
                if (!grouped[m]) grouped[m] = []
                grouped[m].push(p.split('.')[1])
              })

              return (
                <Card key={r.id} className={cn('flex flex-col', r.isSystem && 'border-l-4 border-l-primary')}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={cn('grid place-items-center h-9 w-9 rounded-lg', r.isSystem ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                          {r.isSystem ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                        </div>
                        <div>
                          <CardTitle className="text-sm">{r.label}</CardTitle>
                          <CardDescription className="text-xs">{r.description}</CardDescription>
                        </div>
                      </div>
                      {r.isSystem && <Badge variant="outline" className="text-[10px] gap-1"><Lock className="h-2.5 w-2.5" /> System</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-xs text-muted-foreground mb-2">{r.permissionCount} permissions granted</p>
                    <div className="space-y-1.5 flex-1 max-h-60 overflow-y-auto scrollbar-thin">
                      {Object.entries(grouped).length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No permissions</p>
                      ) : (
                        Object.entries(grouped)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([mod, actions]) => (
                            <div key={mod} className="flex items-start gap-2 text-xs">
                              <span className="font-mono font-semibold text-muted-foreground capitalize w-20 shrink-0">{mod}</span>
                              <div className="flex flex-wrap gap-1">
                                {actions.map((a) => (
                                  <Badge key={a} variant="outline" className="text-[9px] py-0 h-4">{a}</Badge>
                                ))}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Permission Matrix */}
        <TabsContent value="matrix">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Permission Matrix</CardTitle>
                <CardDescription className="text-xs">
                  {canEdit ? 'Toggle permissions for non-system roles. System roles are read-only.' : 'Read-only — you do not have permission to edit roles.'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-semibold min-w-[180px]">Permission</th>
                      {roles.map((r: any) => (
                        <th key={r.id} className="p-2 font-semibold text-center min-w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px]">{r.label}</span>
                            {r.isSystem && <Lock className="h-2.5 w-2.5 text-muted-foreground" />}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {moduleNames.map((mod) => (
                      <Fragment key={`mod-${mod}`}>
                        <tr className="bg-muted/30">
                          <td colSpan={roles.length + 1} className="p-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                            {mod}
                          </td>
                        </tr>
                        {modules[mod].map((perm) => (
                          <tr key={perm} className="border-b last:border-0 hover:bg-accent/30">
                            <td className="p-2 font-mono text-xs">{perm.split('.')[1]}</td>
                            {roles.map((r: any) => {
                              const permSet = getRolePerms(r.id, r.permissions)
                              const has = permSet.has(perm)
                              const editable = canEdit && !r.isSystem
                              return (
                                <td key={r.id} className="p-2 text-center">
                                  {editable ? (
                                    <Checkbox
                                      checked={has}
                                      onCheckedChange={() => togglePerm(r.id, perm, has)}
                                      className="mx-auto"
                                    />
                                  ) : has ? (
                                    <Check className="h-4 w-4 text-success mx-auto" />
                                  ) : (
                                    <span className="text-muted-foreground/40">—</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Save bar */}
              {canEdit && Object.keys(localPerms).length > 0 && (
                <div className="mt-4 p-3 rounded-md bg-primary/5 border border-primary/20 flex items-center gap-3">
                  <span className="text-sm font-medium">{Object.keys(localPerms).length} role(s) with unsaved changes</span>
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => setLocalPerms({})}>Discard</Button>
                  {Object.entries(localPerms).map(([roleId, perms]) => {
                    const r = roles.find((x) => x.id === roleId)
                    if (!r) return null
                    return (
                      <Button key={roleId} size="sm" className="gap-1.5" onClick={() => saveRole(roleId)} disabled={savingRole === roleId}>
                        <Save className="h-3.5 w-3.5" /> Save {r.label} ({perms.size})
                      </Button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {roles.length === 0 && (
        <Card><CardContent><EmptyState icon={Shield} title="No roles defined" /></CardContent></Card>
      )}
    </div>
  )
}
