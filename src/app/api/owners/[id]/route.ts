import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/owners/[id] — owner detail with vehicles list + earnings + payouts
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'owners.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const owner = await db.vehicleOwner.findUnique({
    where: { id },
    include: {
      vehicles: {
        include: {
          city: { select: { name: true } },
          driver: { select: { id: true, name: true } },
          device: { select: { id: true, deviceId: true, status: true } },
        },
        orderBy: { registrationNo: 'asc' },
      },
    },
  })

  if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

  const [ownerEarnings, payouts] = await Promise.all([
    db.ownerEarning.findMany({
      where: { ownerId: id },
      orderBy: { month: 'desc' },
      take: 12,
    }),
    db.payout.findMany({
      where: { ownerId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  const totalEarnings = ownerEarnings.reduce((sum, e) => sum + e.totalAmount, 0)
  const pendingEarnings = ownerEarnings
    .filter((e) => e.status === 'pending')
    .reduce((sum, e) => sum + e.totalAmount, 0)
  const paidAmount = payouts
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0)
  const pendingPayout = payouts
    .filter((p) => p.status !== 'paid' && p.status !== 'failed' && p.status !== 'reversed')
    .reduce((sum, p) => sum + p.amount, 0)

  return NextResponse.json({
    owner: {
      ...owner,
      vehicles: owner.vehicles.map((v) => ({
        id: v.id,
        registrationNo: v.registrationNo,
        vehicleType: v.vehicleType,
        manufacturer: v.manufacturer,
        model: v.model,
        city: v.city?.name || '—',
        zone: v.zone,
        driverName: v.driver?.name || '—',
        driverId: v.driverId,
        deviceId: v.device?.deviceId || '—',
        deviceStatus: v.device?.status || null,
        status: v.status,
        agreementStatus: v.agreementStatus,
      })),
      earningsHistory: ownerEarnings,
      payouts,
      totalEarnings,
      pendingEarnings,
      paidAmount,
      pendingPayout,
    },
  })
}

// PATCH /api/owners/[id] — update owner
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'owners.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const {
    name, mobile, email, address, city, bankAccount, bankIfsc, upiId,
    revenueShare, status,
  } = body

  const data: any = {}
  if (name !== undefined) data.name = name
  if (mobile !== undefined) data.mobile = mobile
  if (email !== undefined) data.email = email || null
  if (address !== undefined) data.address = address || null
  if (city !== undefined) data.city = city || null
  if (bankAccount !== undefined) data.bankAccount = bankAccount || null
  if (bankIfsc !== undefined) data.bankIfsc = bankIfsc || null
  if (upiId !== undefined) data.upiId = upiId || null
  if (revenueShare !== undefined) data.revenueShare = Number(revenueShare)
  if (status !== undefined) data.status = status

  const owner = await db.vehicleOwner.update({ where: { id }, data })

  await auditLog({
    user,
    action: 'owner_update',
    entity: 'vehicle_owner',
    entityId: id,
    details: `Updated owner ${owner.name}`,
  })

  return NextResponse.json({ owner })
}
