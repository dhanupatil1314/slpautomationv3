import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/service/[id] — ticket detail with comments
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'service.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const ticket = await db.serviceTicket.findUnique({
    where: { id },
    include: {
      device: { select: { deviceId: true, model: true, city: { select: { name: true } }, vehicle: { select: { registrationNo: true } } } },
      vehicle: { select: { registrationNo: true, driver: { select: { name: true, mobile: true } } } },
      driver: { select: { name: true, mobile: true } },
      assignedEngineer: true,
      comments: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  return NextResponse.json({ ticket })
}

// PATCH /api/service/[id] — update ticket status, assign engineer, set resolution
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  const { status, assignedEngineerId, priority, resolution } = body

  // Permission check — assign requires service.assign, others require service.edit
  if (assignedEngineerId !== undefined && !hasPermission(user.role, 'service.assign')) {
    return NextResponse.json({ error: 'Forbidden — service.assign required' }, { status: 403 })
  }
  if ((status !== undefined || priority !== undefined || resolution !== undefined) && !hasPermission(user.role, 'service.edit')) {
    return NextResponse.json({ error: 'Forbidden — service.edit required' }, { status: 403 })
  }

  const updateData: any = {}
  if (status) {
    updateData.status = status
    if (status === 'resolved' || status === 'closed') updateData.resolvedAt = new Date()
  }
  if (assignedEngineerId !== undefined) {
    updateData.assignedEngineerId = assignedEngineerId || null
    if (assignedEngineerId && (!status || status === 'open')) updateData.status = 'assigned'
  }
  if (priority) updateData.priority = priority
  if (resolution !== undefined) updateData.resolution = resolution

  const ticket = await db.serviceTicket.update({ where: { id }, data: updateData })

  await auditLog({
    user,
    action: 'service_ticket_update',
    entity: 'service_ticket',
    entityId: id,
    details: `Updated ${ticket.ticketId}: ${Object.keys(updateData).join(', ')}`,
  })
  return NextResponse.json({ ticket })
}
