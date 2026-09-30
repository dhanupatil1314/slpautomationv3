import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/devices — paginated, filterable, sortable device list
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const city = searchParams.get('city') || ''
  const sortBy = searchParams.get('sortBy') || 'lastHeartbeat'
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

  const where: any = {}
  if (search) {
    where.OR = [
      { deviceId: { contains: search } },
      { serialNumber: { contains: search } },
      { imei: { contains: search } },
    ]
  }
  if (status) where.status = status
  if (city) where.city = { name: city }

  const [devices, total] = await Promise.all([
    db.device.findMany({
      where,
      include: {
        city: { select: { name: true } },
        vehicle: { select: { registrationNo: true, driverId: true, driver: { select: { name: true } }, owner: { select: { name: true } } } },
        sim: { select: { operator: true, currentUsageMb: true, monthlyAllowanceMb: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.device.count({ where }),
  ])

  return NextResponse.json({
    devices: devices.map((d) => ({
      id: d.id, deviceId: d.deviceId, serialNumber: d.serialNumber, imei: d.imei,
      model: d.model, playerVersion: d.playerVersion, androidVersion: d.androidVersion,
      status: d.status, networkType: d.networkType, signalStrength: d.signalStrength,
      temperature: d.temperature, storageUsage: d.storageUsage, ramUsage: d.ramUsage,
      uptimeSeconds: d.uptimeSeconds, lastHeartbeat: d.lastHeartbeat,
      contentSyncStatus: d.contentSyncStatus, contentSyncedAt: d.contentSyncedAt,
      city: d.city?.name || '—', zone: d.zone,
      latitude: d.latitude, longitude: d.longitude,
      vehicleReg: d.vehicle?.registrationNo || '—',
      driverName: d.vehicle?.driver?.name || '—',
      ownerName: d.vehicle?.owner?.name || '—',
      simOperator: d.sim?.operator || '—',
      simUsage: d.sim ? `${((d.sim.currentUsageMb / d.sim.monthlyAllowanceMb) * 100).toFixed(0)}%` : '—',
      installationDate: d.installationDate,
    })),
    total, page, pageSize,
  })
}

// POST /api/devices — register a new device
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { deviceId, serialNumber, imei, model, cityId, zone } = body

  if (!deviceId || !serialNumber || !imei) {
    return NextResponse.json({ error: 'Device ID, serial number and IMEI are required' }, { status: 400 })
  }

  const existing = await db.device.findFirst({
    where: { OR: [{ deviceId }, { serialNumber }, { imei }] },
  })
  if (existing) return NextResponse.json({ error: 'Device with these details already exists' }, { status: 409 })

  const device = await db.device.create({
    data: {
      deviceId, serialNumber, imei, model: model || 'LakhirAd Player Pro',
      playerVersion: '2.4.1', androidVersion: '11',
      cityId: cityId || null, zone: zone || null,
      status: 'offline', installationDate: new Date(),
    },
  })

  await auditLog({ user, action: 'device_create', entity: 'device', entityId: device.id, details: `Created device ${deviceId}` })
  return NextResponse.json({ device }, { status: 201 })
}
