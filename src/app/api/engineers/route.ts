import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/engineers — list field engineers with ticket stats
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'engineers.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''
  const city = searchParams.get('city') || ''
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 100)

  const where: any = {}
  if (status) where.status = status
  if (city) where.city = { contains: city }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { mobile: { contains: search } },
      { email: { contains: search } },
    ]
  }

  const [engineers, total] = await Promise.all([
    db.fieldEngineer.findMany({
      where,
      include: {
        serviceTickets: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.fieldEngineer.count({ where }),
  ])

  return NextResponse.json({
    engineers: engineers.map((e) => ({
      id: e.id,
      name: e.name,
      mobile: e.mobile,
      email: e.email,
      city: e.city,
      specialization: e.specialization,
      status: e.status,
      createdAt: e.createdAt,
      assignedTicketsCount: e.serviceTickets.filter((t) => ['open', 'assigned', 'in_progress'].includes(t.status)).length,
      resolvedCount: e.serviceTickets.filter((t) => ['resolved', 'closed'].includes(t.status)).length,
      totalHandled: e.serviceTickets.length,
    })),
    total, page, pageSize,
  })
}

// POST /api/engineers — create a new field engineer
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'engineers.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, mobile, email, city, specialization } = body
  if (!name || !mobile) return NextResponse.json({ error: 'Name and mobile required' }, { status: 400 })

  const existing = await db.fieldEngineer.findFirst({ where: { mobile } })
  if (existing) return NextResponse.json({ error: 'Engineer with this mobile already exists' }, { status: 409 })

  const engineer = await db.fieldEngineer.create({
    data: {
      name, mobile,
      email: email || null,
      city: city || null,
      specialization: specialization || 'General',
      status: 'active',
    },
  })

  await auditLog({ user, action: 'engineer_create', entity: 'field_engineer', entityId: engineer.id, details: `Created engineer ${name}` })
  return NextResponse.json({ engineer }, { status: 201 })
}
