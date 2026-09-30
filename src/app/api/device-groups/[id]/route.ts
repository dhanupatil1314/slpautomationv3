import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/device-groups/[id] — group detail with all devices
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const group = await db.deviceGroup.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          device: {
            select: {
              id: true, deviceId: true, status: true, model: true,
              city: { select: { name: true } },
              vehicle: { select: { registrationNo: true, driver: { select: { name: true } } } },
              lastHeartbeat: true, signalStrength: true, temperature: true,
            },
          },
        },
        orderBy: { addedAt: 'desc' },
      },
    },
  })

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  return NextResponse.json({
    group: {
      ...group,
      devices: group.items.map((i) => i.device),
    },
  })
}

// PATCH /api/device-groups/[id] — update group (add/remove devices)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { name, description, color, addDeviceIds, removeDeviceIds } = body

  const group = await db.deviceGroup.findUnique({ where: { id } })
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  // Update metadata
  if (name || description !== undefined || color) {
    await db.deviceGroup.update({
      where: { id },
      data: { ...(name && { name }), ...(description !== undefined && { description }), ...(color && { color }) },
    })
  }

  // Add devices
  if (addDeviceIds?.length) {
    await db.deviceGroupItem.createMany({
      data: addDeviceIds.map((deviceId: string) => ({ groupId: id, deviceId })),
      skipDuplicates: true,
    })
    await auditLog({ user, action: 'device_group_add', entity: 'device_group', entityId: id, details: `Added ${addDeviceIds.length} devices to group` })
  }

  // Remove devices
  if (removeDeviceIds?.length) {
    await db.deviceGroupItem.deleteMany({
      where: { groupId: id, deviceId: { in: removeDeviceIds } },
    })
    await auditLog({ user, action: 'device_group_remove', entity: 'device_group', entityId: id, details: `Removed ${removeDeviceIds.length} devices from group` })
  }

  return NextResponse.json({ message: 'Group updated' })
}

// DELETE /api/device-groups/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.delete')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await db.deviceGroup.delete({ where: { id } })
  await auditLog({ user, action: 'device_group_delete', entity: 'device_group', entityId: id })

  return NextResponse.json({ success: true })
}
