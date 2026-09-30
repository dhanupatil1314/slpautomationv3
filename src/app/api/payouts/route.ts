import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/payouts — list payouts with filters and KPI summary
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'payouts.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
  const status = searchParams.get('status') || ''
  const recipientType = searchParams.get('recipientType') || ''
  const month = searchParams.get('month') || ''
  const search = searchParams.get('search') || ''

  const where: any = {}
  if (status) where.status = status
  if (recipientType) where.recipientType = recipientType
  if (month) where.month = month
  if (search) {
    where.OR = [
      { payoutRef: { contains: search } },
      { driver: { name: { contains: search } } },
      { driver: { mobile: { contains: search } } },
      { owner: { name: { contains: search } } },
      { owner: { mobile: { contains: search } } },
    ]
  }

  const [payouts, total, statusAgg, monthPaidAgg] = await Promise.all([
    db.payout.findMany({
      where,
      include: {
        driver: { select: { id: true, name: true, mobile: true, city: true, upiId: true, bankAccount: true, bankIfsc: true } },
        owner: { select: { id: true, name: true, mobile: true, city: true, upiId: true, bankAccount: true, bankIfsc: true } },
      },
      orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.payout.count({ where }),
    db.payout.groupBy({ by: ['status'], _count: true, _sum: { amount: true } }),
    db.payout.aggregate({
      where: { status: 'paid', month: new Date().toISOString().slice(0, 7) },
      _sum: { amount: true },
    }),
  ])

  const statusMap: Record<string, { count: number; amount: number }> = {}
  statusAgg.forEach((s) => {
    statusMap[s.status] = { count: s._count, amount: s._sum.amount || 0 }
  })

  // Distinct months
  const monthsRaw = await db.payout.findMany({ select: { month: true }, distinct: ['month'], orderBy: { month: 'desc' } })

  return NextResponse.json({
    payouts: payouts.map((p) => {
      const recipient = p.recipientType === 'driver' ? p.driver : p.owner
      return {
        id: p.id,
        payoutRef: p.payoutRef,
        recipientType: p.recipientType,
        recipientId: p.recipientType === 'driver' ? p.driverId : p.ownerId,
        recipientName: recipient?.name || '—',
        recipientMobile: recipient?.mobile,
        recipientCity: recipient?.city,
        recipientUpi: recipient?.upiId,
        recipientBankAccount: recipient?.bankAccount,
        recipientBankIfsc: recipient?.bankIfsc,
        month: p.month,
        amount: p.amount,
        method: p.method,
        status: p.status,
        processedAt: p.processedAt,
        createdAt: p.createdAt,
      }
    }),
    total, page, pageSize,
    summary: {
      totalPaidThisMonth: monthPaidAgg._sum.amount || 0,
      pendingApproval: statusMap['pending']?.count || 0,
      pendingAmount: statusMap['pending']?.amount || 0,
      processing: statusMap['processing']?.count || 0,
      processingAmount: statusMap['processing']?.amount || 0,
      failed: statusMap['failed']?.count || 0,
      failedAmount: statusMap['failed']?.amount || 0,
      approved: statusMap['approved']?.count || 0,
      paid: statusMap['paid']?.count || 0,
    },
    months: monthsRaw.map((m) => m.month),
  })
}

// POST /api/payouts — create a new payout
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'payouts.approve')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { recipientType, driverId, ownerId, month, amount, method } = body

  if (!recipientType || !month || !amount || amount <= 0) {
    return NextResponse.json({ error: 'recipientType, month and amount are required' }, { status: 400 })
  }
  if (recipientType === 'driver' && !driverId) {
    return NextResponse.json({ error: 'driverId is required for driver payouts' }, { status: 400 })
  }
  if (recipientType === 'owner' && !ownerId) {
    return NextResponse.json({ error: 'ownerId is required for owner payouts' }, { status: 400 })
  }

  const count = await db.payout.count()
  const payoutRef = `LKD-PO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`

  const payout = await db.payout.create({
    data: {
      payoutRef,
      recipientType,
      driverId: recipientType === 'driver' ? driverId : null,
      ownerId: recipientType === 'owner' ? ownerId : null,
      month,
      amount: parseFloat(amount),
      method: method || 'upi',
      status: 'pending',
    },
  })

  await auditLog({
    user,
    action: 'payout_create',
    entity: 'payout',
    entityId: payout.id,
    details: `${payoutRef} · ${recipientType} · ₹${amount} · ${month}`,
  })

  return NextResponse.json({ payout }, { status: 201 })
}
