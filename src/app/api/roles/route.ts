import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'
import { ROLE_PERMISSIONS, ROLE_LABELS, PERMISSIONS } from '@/lib/rbac'

// GET /api/roles — all roles with permissions grouped
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'roles.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const dbRoles = await db.role.findMany({ orderBy: { name: 'asc' } })

  // Group permissions by module (prefix before '.')
  const moduleGroups: Record<string, string[]> = {}
  for (const p of PERMISSIONS) {
    const mod = p.split('.')[0]
    if (!moduleGroups[mod]) moduleGroups[mod] = []
    moduleGroups[mod].push(p)
  }

  return NextResponse.json({
    roles: dbRoles.map((r) => {
      let perms: string[] = []
      try { perms = JSON.parse(r.permissions) } catch { perms = [] }
      return {
        id: r.id,
        name: r.name,
        label: ROLE_LABELS[r.name] || r.name,
        description: r.description,
        isSystem: r.isSystem,
        permissions: perms,
        permissionCount: perms.length,
      }
    }),
    modules: moduleGroups,
    allPermissions: [...PERMISSIONS],
  })
}

// PUT /api/roles — update permissions for a role (only non-system roles can be edited)
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'roles.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { roleId, permissions } = body
  if (!roleId || !Array.isArray(permissions)) return NextResponse.json({ error: 'roleId and permissions[] required' }, { status: 400 })

  const existing = await db.role.findUnique({ where: { id: roleId } })
  if (!existing) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
  if (existing.isSystem) return NextResponse.json({ error: 'System roles cannot be modified' }, { status: 403 })

  const updated = await db.role.update({
    where: { id: roleId },
    data: { permissions: JSON.stringify(permissions) },
  })

  await auditLog({ user, action: 'role_update', entity: 'role', entityId: roleId, details: `Updated permissions for ${existing.name} (${permissions.length} perms)` })
  return NextResponse.json({ role: updated })
}
