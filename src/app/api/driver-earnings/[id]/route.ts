import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/driver-earnings/[id] — earning detail with full breakdown
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'earnings.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const earning = await db.driverEarning.findUnique({
    where: { id },
    include: {
      driver: { select: { id: true, name: true, mobile: true, email: true, city: true, driverScore: true, bankAccount: true, bankIfsc: true, upiId: true, status: true, joiningDate: true } },
    },
  })

  if (!earning) return NextResponse.json({ error: 'Earning record not found' }, { status: 404 })

  // Fetch the rule used (current active rule — for transparency)
  const rule = await db.earningRule.findFirst({ where: { isActive: true } }) || await db.earningRule.findFirst()

  return NextResponse.json({ earning, rule })
}

// PATCH /api/driver-earnings/[id] — approve earning
// body: { action: 'approve' | 'reject', note?: string }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'earnings.edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { action } = body

  const earning = await db.driverEarning.findUnique({ where: { id }, include: { driver: true } })
  if (!earning) return NextResponse.json({ error: 'Earning record not found' }, { status: 404 })

  if (action === 'approve') {
    if (earning.status === 'approved' || earning.status === 'paid') {
      return NextResponse.json({ error: 'Earning already approved' }, { status: 400 })
    }
    const updated = await db.driverEarning.update({ where: { id }, data: { status: 'approved' } })
    await auditLog({
      user,
      action: 'earning_approve',
      entity: 'driver_earning',
      entityId: earning.id,
      details: `Approved ₹${earning.totalAmount} for ${earning.driver.name} · ${earning.month}`,
    })
    return NextResponse.json({ earning: updated })
  }

  if (action === 'reject') {
    const updated = await db.driverEarning.update({ where: { id }, data: { status: 'pending' } })
    await auditLog({
      user,
      action: 'earning_reject',
      entity: 'driver_earning',
      entityId: earning.id,
      details: `Rejected ${earning.driver.name} · ${earning.month}`,
    })
    return NextResponse.json({ earning: updated })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
