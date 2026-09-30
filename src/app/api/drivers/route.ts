import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/drivers — paginated, filterable, sortable driver list
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'drivers.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const kycStatus = searchParams.get('kycStatus') || ''
  const city = searchParams.get('city') || ''
  const sortBy = searchParams.get('sortBy') || 'updatedAt'
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

  const where: any = {}
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { mobile: { contains: search } },
      { email: { contains: search } },
    ]
  }
  if (status) where.status = status
  if (kycStatus) where.kycStatus = kycStatus
  if (city) where.city = city

  const sortMap: Record<string, string> = {
    name: 'name',
    driverScore: 'driverScore',
    joiningDate: 'joiningDate',
    status: 'status',
    updatedAt: 'updatedAt',
    createdAt: 'createdAt',
  }
  const sortField = sortMap[sortBy] || 'updatedAt'

  // Earnings for current month (lookup)
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [drivers, total] = await Promise.all([
    db.driver.findMany({
      where,
      include: {
        vehicles: {
          take: 1,
          select: { id: true, registrationNo: true, vehicleType: true, status: true },
        },
      },
      orderBy: { [sortField]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.driver.count({ where }),
  ])

  // Fetch current-month + total earnings per driver (single query grouped)
  const driverIds = drivers.map((d) => d.id)
  const earningsRows = await db.driverEarning.findMany({
    where: { driverId: { in: driverIds } },
    select: { driverId: true, month: true, totalAmount: true, status: true },
  })

  const earningsMap = new Map<string, { currentMonth: number; total: number; pending: number }>()
  for (const d of drivers) earningsMap.set(d.id, { currentMonth: 0, total: 0, pending: 0 })
  for (const e of earningsRows) {
    const slot = earningsMap.get(e.driverId)
    if (!slot) continue
    slot.total += e.totalAmount
    if (e.month === currentMonth) slot.currentMonth += e.totalAmount
    if (e.status === 'pending') slot.pending += e.totalAmount
  }

  return NextResponse.json({
    drivers: drivers.map((d) => {
      const e = earningsMap.get(d.id)!
      const v = d.vehicles[0]
      return {
        id: d.id,
        name: d.name,
        mobile: d.mobile,
        email: d.email,
        photoUrl: d.photoUrl,
        city: d.city || '—',
        kycStatus: d.kycStatus,
        agreementStatus: d.agreementStatus,
        driverScore: d.driverScore,
        status: d.status,
        joiningDate: d.joiningDate,
        vehicleId: v?.id || null,
        vehicleReg: v?.registrationNo || '—',
        vehicleType: v?.vehicleType || null,
        vehicleStatus: v?.status || null,
        currentMonthEarnings: e.currentMonth,
        totalEarnings: e.total,
        pendingEarnings: e.pending,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }
    }),
    total, page, pageSize,
  })
}

// POST /api/drivers — create a new driver
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'drivers.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const {
    name, mobile, email, photoUrl, city, kycStatus, agreementStatus,
    bankAccount, bankIfsc, upiId, driverScore, status, joiningDate,
  } = body

  if (!name || !mobile) {
    return NextResponse.json({ error: 'Name and mobile are required' }, { status: 400 })
  }

  const existing = await db.driver.findUnique({ where: { mobile } })
  if (existing) return NextResponse.json({ error: 'Driver with this mobile already exists' }, { status: 409 })

  const driver = await db.driver.create({
    data: {
      name,
      mobile,
      email: email || null,
      photoUrl: photoUrl || null,
      city: city || null,
      kycStatus: kycStatus || 'pending',
      agreementStatus: agreementStatus || 'pending',
      bankAccount: bankAccount || null,
      bankIfsc: bankIfsc || null,
      upiId: upiId || null,
      driverScore: driverScore !== undefined ? Number(driverScore) : 70,
      status: status || 'active',
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
    },
  })

  await auditLog({
    user,
    action: 'driver_create',
    entity: 'driver',
    entityId: driver.id,
    details: `Created driver ${name} (${mobile})`,
  })

  return NextResponse.json({ driver }, { status: 201 })
}
