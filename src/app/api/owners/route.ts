import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/owners — paginated, filterable, sortable owner list with aggregate earnings
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'owners.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
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
  if (city) where.city = city

  const sortMap: Record<string, string> = {
    name: 'name',
    revenueShare: 'revenueShare',
    status: 'status',
    updatedAt: 'updatedAt',
    createdAt: 'createdAt',
  }
  const sortField = sortMap[sortBy] || 'updatedAt'

  const [owners, total] = await Promise.all([
    db.vehicleOwner.findMany({
      where,
      include: {
        _count: { select: { vehicles: true } },
      },
      orderBy: { [sortField]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.vehicleOwner.count({ where }),
  ])

  // Aggregate earnings + payouts for each owner
  const ownerIds = owners.map((o) => o.id)
  const [earnings, payouts] = await Promise.all([
    db.ownerEarning.findMany({
      where: { ownerId: { in: ownerIds } },
      select: { ownerId: true, totalAmount: true, status: true },
    }),
    db.payout.findMany({
      where: { ownerId: { in: ownerIds } },
      select: { ownerId: true, amount: true, status: true },
    }),
  ])

  const earningsMap = new Map<string, { total: number; pending: number }>()
  const payoutsMap = new Map<string, { paid: number; pending: number }>()
  for (const o of owners) {
    earningsMap.set(o.id, { total: 0, pending: 0 })
    payoutsMap.set(o.id, { paid: 0, pending: 0 })
  }
  for (const e of earnings) {
    const slot = earningsMap.get(e.ownerId)
    if (!slot) continue
    slot.total += e.totalAmount
    if (e.status === 'pending') slot.pending += e.totalAmount
  }
  for (const p of payouts) {
    const slot = payoutsMap.get(p.ownerId)
    if (!slot) continue
    if (p.status === 'paid') slot.paid += p.amount
    else if (p.status === 'pending' || p.status === 'under_review' || p.status === 'approved' || p.status === 'processing') slot.pending += p.amount
  }

  return NextResponse.json({
    owners: owners.map((o) => {
      const e = earningsMap.get(o.id)!
      const p = payoutsMap.get(o.id)!
      return {
        id: o.id,
        name: o.name,
        mobile: o.mobile,
        email: o.email,
        address: o.address,
        city: o.city || '—',
        bankAccount: o.bankAccount,
        bankIfsc: o.bankIfsc,
        upiId: o.upiId,
        revenueShare: o.revenueShare,
        status: o.status,
        vehicleCount: o._count.vehicles,
        totalEarnings: e.total,
        pendingEarnings: e.pending,
        paidAmount: p.paid,
        pendingPayout: p.pending,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      }
    }),
    total, page, pageSize,
  })
}

// POST /api/owners — create a new vehicle owner
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'owners.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const {
    name, mobile, email, address, city, bankAccount, bankIfsc, upiId,
    revenueShare, status,
  } = body

  if (!name || !mobile) {
    return NextResponse.json({ error: 'Name and mobile are required' }, { status: 400 })
  }

  const owner = await db.vehicleOwner.create({
    data: {
      name,
      mobile,
      email: email || null,
      address: address || null,
      city: city || null,
      bankAccount: bankAccount || null,
      bankIfsc: bankIfsc || null,
      upiId: upiId || null,
      revenueShare: revenueShare !== undefined ? Number(revenueShare) : 40,
      status: status || 'active',
    },
  })

  await auditLog({
    user,
    action: 'owner_create',
    entity: 'vehicle_owner',
    entityId: owner.id,
    details: `Created vehicle owner ${name} (${mobile})`,
  })

  return NextResponse.json({ owner }, { status: 201 })
}
