import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/payouts/recipients — list drivers & owners for payout selection
// Requires payouts.view (so finance_admin can create payouts without needing drivers.view/owners.view)
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'payouts.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [drivers, owners] = await Promise.all([
    db.driver.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, mobile: true, city: true, upiId: true, bankAccount: true },
      orderBy: { name: 'asc' },
    }),
    db.vehicleOwner.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, mobile: true, city: true, upiId: true, bankAccount: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return NextResponse.json({
    drivers: drivers.map((d) => ({ id: d.id, name: d.name, mobile: d.mobile, city: d.city })),
    owners: owners.map((o) => ({ id: o.id, name: o.name, mobile: o.mobile, city: o.city })),
  })
}
