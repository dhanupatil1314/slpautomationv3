import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/vehicles — paginated, filterable, sortable vehicle list
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'vehicles.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const vehicleType = searchParams.get('vehicleType') || ''
  const cityId = searchParams.get('cityId') || ''
  const sortBy = searchParams.get('sortBy') || 'updatedAt'
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

  const where: any = {}
  if (search) {
    where.OR = [
      { registrationNo: { contains: search } },
      { manufacturer: { contains: search } },
      { model: { contains: search } },
    ]
  }
  if (status) where.status = status
  if (vehicleType) where.vehicleType = vehicleType
  if (cityId) where.cityId = cityId

  const sortMap: Record<string, string> = {
    registrationNo: 'registrationNo',
    status: 'status',
    vehicleType: 'vehicleType',
    installationDate: 'installationDate',
    updatedAt: 'updatedAt',
    createdAt: 'createdAt',
  }
  const sortField = sortMap[sortBy] || 'updatedAt'

  const [vehicles, total] = await Promise.all([
    db.vehicle.findMany({
      where,
      include: {
        city: { select: { name: true } },
        owner: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
        device: { select: { id: true, deviceId: true, status: true, lastHeartbeat: true } },
        screen: { select: { id: true, screenId: true } },
      },
      orderBy: { [sortField]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.vehicle.count({ where }),
  ])

  return NextResponse.json({
    vehicles: vehicles.map((v) => ({
      id: v.id,
      registrationNo: v.registrationNo,
      vehicleType: v.vehicleType,
      manufacturer: v.manufacturer,
      model: v.model,
      city: v.city?.name || '—',
      cityId: v.cityId,
      zone: v.zone,
      ownerId: v.ownerId,
      ownerName: v.owner?.name || '—',
      driverId: v.driverId,
      driverName: v.driver?.name || '—',
      deviceId: v.device?.id || null,
      deviceIdLabel: v.device?.deviceId || '—',
      deviceStatus: v.device?.status || null,
      deviceLastHeartbeat: v.device?.lastHeartbeat || null,
      screenId: v.screen?.id || null,
      screenIdLabel: v.screen?.screenId || '—',
      agreementStatus: v.agreementStatus,
      status: v.status,
      installationDate: v.installationDate,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    })),
    total, page, pageSize,
  })
}

// POST /api/vehicles — register a new vehicle
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'vehicles.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const {
    registrationNo, vehicleType, manufacturer, model, cityId, zone,
    ownerId, driverId, agreementStatus, status, installationDate,
  } = body

  if (!registrationNo) {
    return NextResponse.json({ error: 'Registration number is required' }, { status: 400 })
  }

  const existing = await db.vehicle.findUnique({ where: { registrationNo } })
  if (existing) return NextResponse.json({ error: 'Vehicle with this registration number already exists' }, { status: 409 })

  const vehicle = await db.vehicle.create({
    data: {
      registrationNo,
      vehicleType: vehicleType || 'auto_rickshaw',
      manufacturer: manufacturer || null,
      model: model || null,
      cityId: cityId || null,
      zone: zone || null,
      ownerId: ownerId || null,
      driverId: driverId || null,
      agreementStatus: agreementStatus || 'pending',
      status: status || 'pending_installation',
      installationDate: installationDate ? new Date(installationDate) : null,
    },
  })

  await auditLog({
    user,
    action: 'vehicle_create',
    entity: 'vehicle',
    entityId: vehicle.id,
    details: `Created vehicle ${registrationNo} (${vehicleType || 'auto_rickshaw'})`,
  })

  return NextResponse.json({ vehicle }, { status: 201 })
}
