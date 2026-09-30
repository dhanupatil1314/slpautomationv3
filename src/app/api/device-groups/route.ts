import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/device-groups — list all device groups with device counts
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const groups = await db.deviceGroup.findMany({
    include: {
      _count: { select: { items: true } },
      items: {
        take: 5,
        include: {
          device: {
            select: {
              id: true, deviceId: true, status: true, city: { select: { name: true } },
              vehicle: { select: { registrationNo: true } },
            },
          },
        },
        orderBy: { addedAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      city: g.city,
      zone: g.zone,
      color: g.color,
      deviceCount: g._count.items,
      devices: g.items.map((i) => ({
        id: i.device.id,
        deviceId: i.device.deviceId,
        status: i.device.status,
        city: i.device.city?.name || '—',
        vehicleReg: i.device.vehicle?.registrationNo || '—',
      })),
    })),
    total: groups.length,
  })
}

// POST /api/device-groups — create a new device group
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, description, city, zone, color, deviceIds } = body

  if (!name) return NextResponse.json({ error: 'Group name is required' }, { status: 400 })

  const group = await db.deviceGroup.create({
    data: {
      name,
      description: description || null,
      city: city || null,
      zone: zone || null,
      color: color || 'primary',
      items: deviceIds?.length
        ? { create: deviceIds.map((deviceId: string) => ({ deviceId })) }
        : undefined,
    },
    include: { _count: { select: { items: true } } },
  })

  await auditLog({ user, action: 'device_group_create', entity: 'device_group', entityId: group.id, details: `Created group "${name}" with ${deviceIds?.length || 0} devices` })

  return NextResponse.json({ group, message: `Device group "${name}" created` }, { status: 201 })
}
