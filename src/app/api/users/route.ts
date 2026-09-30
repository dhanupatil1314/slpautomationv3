import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hashPassword } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'
import { ROLE_LABELS } from '@/lib/rbac'

// GET /api/users — list users
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'users.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const role = searchParams.get('role') || ''
  const status = searchParams.get('status') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)

  const where: any = { deletedAt: null }
  if (role) where.role = role
  if (status) where.status = status
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ]
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, phone: true, role: true, organizationId: true,
        status: true, lastLoginAt: true, createdAt: true,
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.user.count({ where }),
  ])

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
      roleLabel: ROLE_LABELS[u.role] || u.role,
      organization: u.organization?.name || '—',
      status: u.status, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
    })),
    total, page, pageSize,
  })
}

// POST /api/users — create user (with password hashing)
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'users.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, email, phone, role, organizationId, password, status } = body
  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: 'Name, email, password and role required' }, { status: 400 })
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

  const passwordHash = await hashPassword(password)
  const newUser = await db.user.create({
    data: {
      name, email, phone: phone || null, role,
      organizationId: organizationId || null,
      passwordHash, status: status || 'active',
    },
    select: { id: true, name: true, email: true, role: true },
  })

  await auditLog({ user, action: 'user_create', entity: 'user', entityId: newUser.id, details: `Created user ${email} (${role})` })
  return NextResponse.json({ user: newUser }, { status: 201 })
}
