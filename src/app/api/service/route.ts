import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/service — list service tickets with filters
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'service.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const priority = searchParams.get('priority') || ''
  const category = searchParams.get('category') || ''
  const assignedEngineerId = searchParams.get('assignedEngineerId') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)

  const where: any = {}
  if (status) where.status = status
  if (priority) where.priority = priority
  if (category) where.category = category
  if (assignedEngineerId) where.assignedEngineerId = assignedEngineerId
  if (search) {
    where.OR = [
      { ticketId: { contains: search } },
      { problem: { contains: search } },
    ]
  }

  // Service engineers only see tickets assigned to them (matched by email or name)
  if (user.role === 'service_engineer') {
    const engineer = await db.fieldEngineer.findFirst({
      where: { OR: [{ email: user.email }, { name: user.name }] },
    })
    if (engineer) where.assignedEngineerId = engineer.id
    else where.assignedEngineerId = 'NONE' // no ticket visible if not linked
  }

  const [tickets, total] = await Promise.all([
    db.serviceTicket.findMany({
      where,
      include: {
        device: { select: { deviceId: true, city: { select: { name: true } } } },
        vehicle: { select: { registrationNo: true } },
        driver: { select: { name: true, mobile: true } },
        assignedEngineer: { select: { name: true, mobile: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.serviceTicket.count({ where }),
  ])

  // Summary
  const summary = {
    open: await db.serviceTicket.count({ where: { status: 'open' } }),
    assigned: await db.serviceTicket.count({ where: { status: 'assigned' } }),
    in_progress: await db.serviceTicket.count({ where: { status: 'in_progress' } }),
    resolved: await db.serviceTicket.count({ where: { status: 'resolved' } }),
    closed: await db.serviceTicket.count({ where: { status: 'closed' } }),
    critical: await db.serviceTicket.count({ where: { priority: 'critical', status: { in: ['open', 'assigned', 'in_progress'] } } }),
    overdue: await db.serviceTicket.count({
      where: { slaDueAt: { lt: new Date() }, status: { in: ['open', 'assigned', 'in_progress'] } },
    }),
  }

  return NextResponse.json({
    tickets: tickets.map((t) => ({
      id: t.id,
      ticketId: t.ticketId,
      problem: t.problem,
      category: t.category,
      priority: t.priority,
      status: t.status,
      slaDueAt: t.slaDueAt,
      resolution: t.resolution,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      deviceId: t.device?.deviceId || '—',
      city: t.device?.city?.name || '—',
      vehicleReg: t.vehicle?.registrationNo || '—',
      driverName: t.driver?.name || '—',
      driverMobile: t.driver?.mobile || '—',
      engineerName: t.assignedEngineer?.name || '—',
      engineerMobile: t.assignedEngineer?.mobile || '—',
      assignedEngineerId: t.assignedEngineerId,
    })),
    total, page, pageSize, summary,
  })
}

// POST /api/service — create a new ticket OR add a comment (with action=comment)
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  // Add a comment to an existing ticket
  if (action === 'comment') {
    if (!hasPermission(user.role, 'service.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { ticketId, note } = body
    if (!ticketId || !note) return NextResponse.json({ error: 'ticketId and note required' }, { status: 400 })

    const comment = await db.serviceComment.create({
      data: {
        ticketId,
        authorId: user.id,
        authorName: user.name,
        note,
      },
    })
    await auditLog({ user, action: 'service_comment', entity: 'service_ticket', entityId: ticketId, details: `Added comment: ${note.slice(0, 80)}` })
    return NextResponse.json({ comment })
  }

  // Create a new ticket
  if (!hasPermission(user.role, 'service.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { problem, deviceId, vehicleId, driverId, category, priority, assignedEngineerId, slaHours } = body
  if (!problem) return NextResponse.json({ error: 'problem description required' }, { status: 400 })

  // Generate ticket ID: TKT-YYYYMMDD-XXX
  const today = new Date()
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const todayCount = await db.serviceTicket.count({ where: { ticketId: { startsWith: `TKT-${dateStr}` } } })
  const ticketId = `TKT-${dateStr}-${String(todayCount + 1).padStart(3, '0')}`

  const slaHoursNum = parseInt(slaHours) || (priority === 'critical' ? 4 : priority === 'high' ? 12 : priority === 'medium' ? 48 : 96)
  const slaDueAt = new Date(Date.now() + slaHoursNum * 3600000)

  const ticket = await db.serviceTicket.create({
    data: {
      ticketId,
      problem,
      deviceId: deviceId || null,
      vehicleId: vehicleId || null,
      driverId: driverId || null,
      category: category || 'hardware',
      priority: priority || 'medium',
      assignedEngineerId: assignedEngineerId || null,
      status: assignedEngineerId ? 'assigned' : 'open',
      slaDueAt,
    },
  })

  await auditLog({ user, action: 'service_ticket_create', entity: 'service_ticket', entityId: ticket.id, details: `Created ${ticketId}: ${problem.slice(0, 80)}` })
  return NextResponse.json({ ticket }, { status: 201 })
}
