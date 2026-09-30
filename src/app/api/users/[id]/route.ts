import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hashPassword } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/users/[id] — user detail with login activity
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'users.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const u = await db.user.findUnique({
    where: { id, deletedAt: null },
    select: {
      id: true, name: true, email: true, phone: true, role: true, status: true,
      avatarUrl: true, organizationId: true, lastLoginAt: true, lastLoginIp: true,
      createdAt: true, updatedAt: true,
      organization: { select: { name: true, type: true } },
      loginActivities: { take: 20, orderBy: { createdAt: 'desc' } },
      auditLogs: { take: 10, orderBy: { createdAt: 'desc' }, select: { action: true, entity: true, createdAt: true, details: true } },
    },
  })

  if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ user: u })
}

// PATCH /api/users/[id] — update user (supports password reset)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'users.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { name, email, phone, role, organizationId, status, password } = body

  const data: any = {}
  if (name) data.name = name
  if (email) data.email = email
  if (phone !== undefined) data.phone = phone || null
  if (role) data.role = role
  if (organizationId !== undefined) data.organizationId = organizationId || null
  if (status) data.status = status
  if (password) data.passwordHash = await hashPassword(password)

  const updated = await db.user.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true } })

  await auditLog({
    user,
    action: password ? 'user_password_reset' : 'user_update',
    entity: 'user',
    entityId: id,
    details: `Updated user ${updated.email}${password ? ' (password reset)' : ''}`,
  })
  return NextResponse.json({ user: updated })
}

// DELETE /api/users/[id] — soft delete user
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'users.delete')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (user.id === id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

  const updated = await db.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'suspended' } })

  await auditLog({ user, action: 'user_delete', entity: 'user', entityId: id, details: `Soft-deleted user ${updated.email}` })
  return NextResponse.json({ success: true })
}
