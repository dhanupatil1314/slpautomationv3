import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/vehicles/[id] — vehicle detail with full relations + recent playback + earnings summary
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'vehicles.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const vehicle = await db.vehicle.findUnique({
    where: { id },
    include: {
      city: true,
      owner: true,
      driver: true,
      device: {
        include: {
          sim: { select: { operator: true, network: true, currentUsageMb: true, monthlyAllowanceMb: true } },
        },
      },
      screen: true,
      playbackEvents: {
        take: 15,
        orderBy: { timestamp: 'desc' },
        include: {
          campaign: { select: { id: true, name: true, advertiser: { select: { name: true } } } },
          media: { select: { id: true, name: true, thumbnailUrl: true } },
        },
      },
      serviceTickets: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { assignedEngineer: { select: { name: true } } },
      },
    },
  })

  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

  // Compute earnings summary (current month)
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  let driverEarnings: any[] = []
  let ownerEarnings: any[] = []
  if (vehicle.driverId) {
    driverEarnings = await db.driverEarning.findMany({
      where: { driverId: vehicle.driverId },
      orderBy: { month: 'desc' },
      take: 6,
    })
  }
  if (vehicle.ownerId) {
    ownerEarnings = await db.ownerEarning.findMany({
      where: { ownerId: vehicle.ownerId },
      orderBy: { month: 'desc' },
      take: 6,
    })
  }

  // Playback stats (last 30 days)
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const playbackCount = await db.playbackEvent.count({
    where: { vehicleId: id, timestamp: { gte: since } },
  })

  return NextResponse.json({
    vehicle: {
      ...vehicle,
      earningsSummary: {
        currentMonth,
        playbackCount30d: playbackCount,
        driverEarnings,
        ownerEarnings,
      },
    },
  })
}

// PATCH /api/vehicles/[id] — update vehicle
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'vehicles.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const {
    registrationNo, vehicleType, manufacturer, model, cityId, zone,
    ownerId, driverId, agreementStatus, status, installationDate,
  } = body

  // Uniqueness check if registration changes
  if (registrationNo) {
    const conflict = await db.vehicle.findFirst({
      where: { registrationNo, NOT: { id } },
    })
    if (conflict) return NextResponse.json({ error: 'Registration number already in use' }, { status: 409 })
  }

  const data: any = {}
  if (registrationNo !== undefined) data.registrationNo = registrationNo
  if (vehicleType !== undefined) data.vehicleType = vehicleType
  if (manufacturer !== undefined) data.manufacturer = manufacturer
  if (model !== undefined) data.model = model
  if (cityId !== undefined) data.cityId = cityId || null
  if (zone !== undefined) data.zone = zone
  if (ownerId !== undefined) data.ownerId = ownerId || null
  if (driverId !== undefined) data.driverId = driverId || null
  if (agreementStatus !== undefined) data.agreementStatus = agreementStatus
  if (status !== undefined) data.status = status
  if (installationDate !== undefined) data.installationDate = installationDate ? new Date(installationDate) : null

  const vehicle = await db.vehicle.update({ where: { id }, data })

  await auditLog({
    user,
    action: 'vehicle_update',
    entity: 'vehicle',
    entityId: id,
    details: `Updated vehicle ${vehicle.registrationNo}`,
  })

  return NextResponse.json({ vehicle })
}
