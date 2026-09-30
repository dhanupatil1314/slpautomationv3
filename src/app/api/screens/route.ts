import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/screens — paginated, filterable, sortable screen list
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'screens.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const orientation = searchParams.get('orientation') || ''
  const sortBy = searchParams.get('sortBy') || 'updatedAt'
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

  const where: any = {}
  if (search) {
    where.OR = [
      { screenId: { contains: search } },
      { model: { contains: search } },
      { serialNumber: { contains: search } },
      { manufacturer: { contains: search } },
    ]
  }
  if (status) where.status = status
  if (orientation) where.orientation = orientation

  const sortMap: Record<string, string> = {
    screenId: 'screenId',
    model: 'model',
    size: 'size',
    installationDate: 'installationDate',
    status: 'status',
    updatedAt: 'updatedAt',
    createdAt: 'createdAt',
  }
  const sortField = sortMap[sortBy] || 'updatedAt'

  const [screens, total] = await Promise.all([
    db.screen.findMany({
      where,
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNo: true,
            city: { select: { name: true } },
            driver: { select: { name: true } },
          },
        },
      },
      orderBy: { [sortField]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.screen.count({ where }),
  ])

  return NextResponse.json({
    screens: screens.map((s) => ({
      id: s.id,
      screenId: s.screenId,
      model: s.model,
      size: s.size,
      resolution: s.resolution,
      orientation: s.orientation,
      brightness: s.brightness,
      manufacturer: s.manufacturer,
      serialNumber: s.serialNumber,
      warranty: s.warranty,
      installationDate: s.installationDate,
      status: s.status,
      vehicleId: s.vehicleId,
      vehicleReg: s.vehicle?.registrationNo || '—',
      vehicleCity: s.vehicle?.city?.name || '—',
      driverName: s.vehicle?.driver?.name || '—',
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
    total, page, pageSize,
  })
}

// POST /api/screens — register a new screen
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'screens.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const {
    screenId, model, size, resolution, orientation, brightness,
    manufacturer, serialNumber, warranty, status, vehicleId, installationDate,
  } = body

  if (!screenId) {
    return NextResponse.json({ error: 'Screen ID is required' }, { status: 400 })
  }

  const existing = await db.screen.findUnique({ where: { screenId } })
  if (existing) return NextResponse.json({ error: 'Screen ID already exists' }, { status: 409 })

  const screen = await db.screen.create({
    data: {
      screenId,
      model: model || null,
      size: size || null,
      resolution: resolution || null,
      orientation: orientation || 'landscape',
      brightness: brightness !== undefined ? Number(brightness) : 80,
      manufacturer: manufacturer || null,
      serialNumber: serialNumber || null,
      warranty: warranty || null,
      status: status || 'active',
      vehicleId: vehicleId || null,
      installationDate: installationDate ? new Date(installationDate) : new Date(),
    },
  })

  await auditLog({
    user,
    action: 'screen_create',
    entity: 'screen',
    entityId: screen.id,
    details: `Registered screen ${screenId}`,
  })

  return NextResponse.json({ screen }, { status: 201 })
}
