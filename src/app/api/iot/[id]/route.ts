import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/iot/[id] — SIM detail
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'iot.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const sim = await db.simCard.findUnique({
    where: { id },
    include: { device: { include: { city: true, vehicle: true } } },
  })
  if (!sim) return NextResponse.json({ error: 'SIM not found' }, { status: 404 })
  return NextResponse.json({ sim })
}

// PATCH /api/iot/[id] — update SIM (status, plan, usage, renewal)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'iot.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { status, dataPlan, monthlyAllowanceMb, currentUsageMb, renewalDate, network } = body

  const sim = await db.simCard.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(dataPlan && { dataPlan }),
      ...(monthlyAllowanceMb != null && { monthlyAllowanceMb: parseInt(monthlyAllowanceMb) }),
      ...(currentUsageMb != null && { currentUsageMb: parseInt(currentUsageMb) }),
      ...(renewalDate && { renewalDate: new Date(renewalDate) }),
      ...(network && { network }),
    },
  })

  await auditLog({ user, action: 'sim_update', entity: 'sim', entityId: id, details: `Updated SIM ${sim.iccid}` })
  return NextResponse.json({ sim })
}
