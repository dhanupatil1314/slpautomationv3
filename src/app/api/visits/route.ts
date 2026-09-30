import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth, logActivity } from '@/lib/api'

export async function GET(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result
  const q = new URL(req.url).searchParams

  try {
    const where: any = {}
    if (user.role === 'ENGINEER') where.engineerId = user.userId
    if (user.role === 'MANAGER') {
      const teamIds = (await db.user.findMany({ where: { managerId: user.userId }, select: { id: true } })).map(e => e.id)
      where.engineerId = { in: [...teamIds, user.userId] }
    }
    if (q.get('scheduleId')) where.scheduleId = q.get('scheduleId')
    if (q.get('engineerId')) where.engineerId = q.get('engineerId')
    if (q.get('dateFrom')) where.checkInTime = { ...where.checkInTime, gte: new Date(q.get('dateFrom')!) }
    if (q.get('dateTo')) where.checkInTime = { ...where.checkInTime, lte: new Date(q.get('dateTo')!) }

    const visits = await db.visit.findMany({
      where, orderBy: { checkInTime: 'desc' }, take: parseInt(q.get('limit') || '50'),
      include: { engineer: { select: { name: true, engineerCode: true } }, schedule: { include: { site: true, store: true } } },
    })
    return NextResponse.json({ visits })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load visits' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const body = await req.json()
    // Get next visit number
    const lastVisit = await db.visit.findFirst({ where: { scheduleId: body.scheduleId }, orderBy: { visitNumber: 'desc' } })
    const visitNumber = (lastVisit?.visitNumber || 0) + 1

    const visit = await db.visit.create({
      data: {
        scheduleId: body.scheduleId, engineerId: user.userId, visitNumber,
        status: 'IN_PROGRESS', remarks: body.remarks, gps: body.gps,
      },
    })
    await logActivity({ userId: user.userId, role: user.role, action: 'CHECK_IN', entity: 'Visit', entityId: visit.id, newValue: JSON.stringify(body) })
    return NextResponse.json(visit, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create visit' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const body = await req.json()
    const visit = await db.visit.update({
      where: { id: body.id },
      data: { checkOutTime: body.checkOutTime ? new Date(body.checkOutTime) : new Date(), status: body.status || 'COMPLETED', remarks: body.remarks },
    })
    await logActivity({ userId: user.userId, role: user.role, action: 'CHECK_OUT', entity: 'Visit', entityId: body.id })
    return NextResponse.json(visit)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update visit' }, { status: 500 })
  }
}