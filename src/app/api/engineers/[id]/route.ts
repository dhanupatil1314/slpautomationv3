import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/engineers/[id] — engineer detail with assigned tickets
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'engineers.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const engineer = await db.fieldEngineer.findUnique({
    where: { id },
    include: {
      serviceTickets: {
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          device: { select: { deviceId: true, city: { select: { name: true } } } },
          vehicle: { select: { registrationNo: true } },
        },
      },
    },
  })

  if (!engineer) return NextResponse.json({ error: 'Engineer not found' }, { status: 404 })

  return NextResponse.json({
    engineer: {
      id: engineer.id,
      name: engineer.name,
      mobile: engineer.mobile,
      email: engineer.email,
      city: engineer.city,
      specialization: engineer.specialization,
      status: engineer.status,
      createdAt: engineer.createdAt,
      tickets: engineer.serviceTickets.map((t) => ({
        id: t.id,
        ticketId: t.ticketId,
        problem: t.problem,
        priority: t.priority,
        status: t.status,
        slaDueAt: t.slaDueAt,
        createdAt: t.createdAt,
        deviceId: t.device?.deviceId || '—',
        city: t.device?.city?.name || '—',
        vehicleReg: t.vehicle?.registrationNo || '—',
      })),
    },
  })
}

// PATCH /api/engineers/[id] — update engineer
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'engineers.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { name, mobile, email, city, specialization, status } = body

  const engineer = await db.fieldEngineer.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(mobile && { mobile }),
      ...(email !== undefined && { email }),
      ...(city !== undefined && { city }),
      ...(specialization && { specialization }),
      ...(status && { status }),
    },
  })

  await auditLog({ user, action: 'engineer_update', entity: 'field_engineer', entityId: id, details: `Updated engineer ${engineer.name}` })
  return NextResponse.json({ engineer })
}
