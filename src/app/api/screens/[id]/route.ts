import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/screens/[id] — screen detail with mounted vehicle
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'screens.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const screen = await db.screen.findUnique({
    where: { id },
    include: {
      vehicle: {
        include: {
          city: { select: { name: true } },
          driver: { select: { id: true, name: true, mobile: true } },
          owner: { select: { id: true, name: true, mobile: true } },
          device: { select: { id: true, deviceId: true, status: true, lastHeartbeat: true } },
        },
      },
    },
  })

  if (!screen) return NextResponse.json({ error: 'Screen not found' }, { status: 404 })

  return NextResponse.json({ screen })
}

// PATCH /api/screens/[id] — update screen
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'screens.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const {
    screenId, model, size, resolution, orientation, brightness,
    manufacturer, serialNumber, warranty, status, vehicleId, installationDate,
  } = body

  if (screenId) {
    const conflict = await db.screen.findFirst({ where: { screenId, NOT: { id } } })
    if (conflict) return NextResponse.json({ error: 'Screen ID already in use' }, { status: 409 })
  }

  const data: any = {}
  if (screenId !== undefined) data.screenId = screenId
  if (model !== undefined) data.model = model || null
  if (size !== undefined) data.size = size || null
  if (resolution !== undefined) data.resolution = resolution || null
  if (orientation !== undefined) data.orientation = orientation
  if (brightness !== undefined) data.brightness = Number(brightness)
  if (manufacturer !== undefined) data.manufacturer = manufacturer || null
  if (serialNumber !== undefined) data.serialNumber = serialNumber || null
  if (warranty !== undefined) data.warranty = warranty || null
  if (status !== undefined) data.status = status
  if (vehicleId !== undefined) data.vehicleId = vehicleId || null
  if (installationDate !== undefined) data.installationDate = installationDate ? new Date(installationDate) : new Date()

  const screen = await db.screen.update({ where: { id }, data })

  await auditLog({
    user,
    action: 'screen_update',
    entity: 'screen',
    entityId: id,
    details: `Updated screen ${screen.screenId}`,
  })

  return NextResponse.json({ screen })
}
