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

    // Engineers only see their own schedules
    if (user.role === 'ENGINEER') {
      where.engineerId = user.userId
    }
    // Managers see their team's schedules
    if (user.role === 'MANAGER') {
      const teamIds = (await db.user.findMany({ where: { managerId: user.userId }, select: { id: true } })).map(e => e.id)
      where.engineerId = { in: [...teamIds, user.userId] }
    }

    if (q.get('date')) where.date = q.get('date')
    if (q.get('dateFrom')) where.date = { ...where.date, gte: q.get('dateFrom') }
    if (q.get('dateTo')) where.date = { ...where.date, lte: q.get('dateTo') }
    if (q.get('status')) where.status = q.get('status')
    if (q.get('engineerId')) where.engineerId = q.get('engineerId')
    if (q.get('siteId')) where.siteId = q.get('siteId')
    if (q.get('storeId')) where.storeId = q.get('storeId')
    if (q.get('district')) where.site = { ...where.site, district: q.get('district') }
    if (q.get('region')) where.site = { ...where.site, region: q.get('region') }
    if (q.get('vendor')) where.vendor = q.get('vendor')
    if (q.get('activity')) where.activity = q.get('activity')
    if (q.get('search')) {
      const search = q.get('search')!
      where.OR = [
        { engineer: { name: { contains: search } } },
        { engineer: { engineerCode: { contains: search } } },
        { site: { siteName: { contains: search } } },
        { site: { siteCode: { contains: search } } },
        { store: { storeName: { contains: search } } },
        { store: { storeCode: { contains: search } } },
        { vendor: { contains: search } },
        { activity: { contains: search } },
      ]
    }

    const page = parseInt(q.get('page') || '1')
    const limit = parseInt(q.get('limit') || '20')
    const skip = (page - 1) * limit

    const [schedules, total] = await Promise.all([
      db.schedule.findMany({
        where, skip, take: limit, orderBy: { date: 'desc' },
        include: { engineer: { select: { id: true, name: true, engineerCode: true } }, site: true, store: true, visits: { orderBy: { visitNumber: 'desc' }, take: 1 } },
      }),
      db.schedule.count({ where }),
    ])

    // Shared site info
    if (q.get('siteCode')) {
      const site = await db.site.findUnique({ where: { siteCode: q.get('siteCode')! } })
      if (site) {
        const sharedSchedules = await db.schedule.findMany({
          where: { siteId: site.id, engineerId: { not: user.userId } },
          include: { engineer: { select: { name: true, engineerCode: true } }, visits: true },
          orderBy: { date: 'desc' }, take: 50,
        })
        return NextResponse.json({ schedules, total, pages: Math.ceil(total / limit), sharedHistory: sharedSchedules })
      }
    }

    return NextResponse.json({ schedules, total, pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('Schedules error:', error)
    return NextResponse.json({ error: 'Failed to load schedules' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  if (user.role === 'ENGINEER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const schedule = await db.schedule.create({
      data: {
        date: body.date, engineerId: body.engineerId, siteId: body.siteId, storeId: body.storeId,
        vendor: body.vendor, activity: body.activity, status: body.status || 'ASSIGNED', remarks: body.remarks,
        vertical: body.vertical, callNumber: body.callNumber, visitType: body.visitType,
        problem: body.problem, callDate: body.callDate, zone: body.zone,
      },
    })
    await logActivity({ userId: user.userId, role: user.role, action: 'CREATE_SCHEDULE', entity: 'Schedule', entityId: schedule.id, newValue: JSON.stringify(body) })
    return NextResponse.json(schedule, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create schedule' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const body = await req.json()
    const existing = await db.schedule.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

    // Engineers can only update status and remarks of their own
    if (user.role === 'ENGINEER') {
      if (existing.engineerId !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const allowed = ['status', 'remarks']
      const updateData: any = {}
      for (const key of allowed) {
        if (body[key] !== undefined) updateData[key] = body[key]
      }
      const schedule = await db.schedule.update({ where: { id: body.id }, data: updateData })
      await logActivity({ userId: user.userId, role: user.role, action: 'UPDATE_SCHEDULE', entity: 'Schedule', entityId: body.id, previousValue: JSON.stringify({ status: existing.status, remarks: existing.remarks }), newValue: JSON.stringify(updateData) })
      return NextResponse.json(schedule)
    }

    const schedule = await db.schedule.update({ where: { id: body.id }, data: body })
    await logActivity({ userId: user.userId, role: user.role, action: 'UPDATE_SCHEDULE', entity: 'Schedule', entityId: body.id, previousValue: JSON.stringify(existing), newValue: JSON.stringify(body) })
    return NextResponse.json(schedule)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update schedule' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  await db.schedule.delete({ where: { id } })
  await logActivity({ userId: user.userId, role: user.role, action: 'DELETE_SCHEDULE', entity: 'Schedule', entityId: id })
  return NextResponse.json({ success: true })
}
