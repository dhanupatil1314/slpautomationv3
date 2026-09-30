import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/drivers/[id] — driver detail with assigned vehicle + earnings history + payouts
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'drivers.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const driver = await db.driver.findUnique({
    where: { id },
    include: {
      vehicles: {
        include: {
          city: { select: { name: true } },
          device: { select: { id: true, deviceId: true, status: true } },
          screen: { select: { id: true, screenId: true } },
          owner: { select: { id: true, name: true } },
        },
      },
      serviceTickets: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, ticketId: true, problem: true, status: true, priority: true, createdAt: true },
      },
    },
  })

  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const [driverEarnings, payouts] = await Promise.all([
    db.driverEarning.findMany({
      where: { driverId: id },
      orderBy: { month: 'desc' },
      take: 12,
    }),
    db.payout.findMany({
      where: { driverId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  const totalEarnings = driverEarnings.reduce((sum, e) => sum + e.totalAmount, 0)
  const pendingEarnings = driverEarnings
    .filter((e) => e.status === 'pending')
    .reduce((sum, e) => sum + e.totalAmount, 0)
  const paidEarnings = driverEarnings
    .filter((e) => e.status === 'paid')
    .reduce((sum, e) => sum + e.totalAmount, 0)

  return NextResponse.json({
    driver: {
      ...driver,
      earningsHistory: driverEarnings,
      payouts,
      totalEarnings,
      pendingEarnings,
      paidEarnings,
    },
  })
}

// PATCH /api/drivers/[id] — update driver
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'drivers.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const {
    name, mobile, email, photoUrl, city, kycStatus, agreementStatus,
    bankAccount, bankIfsc, upiId, driverScore, status, joiningDate,
  } = body

  if (mobile) {
    const conflict = await db.driver.findFirst({ where: { mobile, NOT: { id } } })
    if (conflict) return NextResponse.json({ error: 'Mobile number already in use' }, { status: 409 })
  }

  const data: any = {}
  if (name !== undefined) data.name = name
  if (mobile !== undefined) data.mobile = mobile
  if (email !== undefined) data.email = email || null
  if (photoUrl !== undefined) data.photoUrl = photoUrl || null
  if (city !== undefined) data.city = city || null
  if (kycStatus !== undefined) data.kycStatus = kycStatus
  if (agreementStatus !== undefined) data.agreementStatus = agreementStatus
  if (bankAccount !== undefined) data.bankAccount = bankAccount || null
  if (bankIfsc !== undefined) data.bankIfsc = bankIfsc || null
  if (upiId !== undefined) data.upiId = upiId || null
  if (driverScore !== undefined) data.driverScore = Number(driverScore)
  if (status !== undefined) data.status = status
  if (joiningDate !== undefined) data.joiningDate = joiningDate ? new Date(joiningDate) : new Date()

  const driver = await db.driver.update({ where: { id }, data })

  await auditLog({
    user,
    action: 'driver_update',
    entity: 'driver',
    entityId: id,
    details: `Updated driver ${driver.name}`,
  })

  return NextResponse.json({ driver })
}
