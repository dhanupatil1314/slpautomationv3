import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/earning-rules — fetch the active earning rule (configurable earning engine)
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'earnings.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get the active rule (or first rule if no explicit active)
  const rule = await db.earningRule.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  }) || await db.earningRule.findFirst({ orderBy: { updatedAt: 'desc' } })

  if (!rule) {
    return NextResponse.json({ error: 'No earning rule configured' }, { status: 404 })
  }

  return NextResponse.json({ rule })
}

// PATCH /api/earning-rules — update the active earning rule
// IMPORTANT: Earning amounts must NEVER be hardcoded — always come from this config.
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'settings.edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const allowed = [
    'platformShare', 'ownerShare', 'driverShare', 'baseParticipation',
    'uptimeBonus', 'campaignBonus', 'complianceBonus', 'servicePenalty', 'isActive', 'name',
  ]
  const data: any = {}
  for (const k of allowed) {
    if (body[k] !== undefined) {
      if (typeof body[k] === 'number') data[k] = parseFloat(body[k])
      else data[k] = body[k]
    }
  }

  // Validate shares sum to 100
  if (data.platformShare && data.ownerShare && data.driverShare) {
    const sum = data.platformShare + data.ownerShare + data.driverShare
    if (Math.abs(sum - 100) > 0.1) {
      return NextResponse.json({ error: 'Platform + Owner + Driver shares must total 100%' }, { status: 400 })
    }
  }

  let rule = await db.earningRule.findFirst({ where: { isActive: true } })
  if (!rule) rule = await db.earningRule.findFirst({ orderBy: { updatedAt: 'desc' } })
  if (!rule) {
    // Create default if none exists
    rule = await db.earningRule.create({ data: { name: 'Default', ...data } })
  } else {
    rule = await db.earningRule.update({ where: { id: rule.id }, data })
  }

  await auditLog({
    user,
    action: 'earning_rule_update',
    entity: 'earning_rule',
    entityId: rule.id,
    details: `Updated: ${Object.keys(data).join(', ')}`,
  })

  return NextResponse.json({ rule })
}
