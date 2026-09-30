import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth, logActivity } from '@/lib/api'

/**
 * Daily Schedule Task API
 *
 * Returns the consolidated daily schedule for ALL engineers with the full
 * detail set required by the Daily Schedule Report (matching the reference
 * Excel format the customer provided).
 *
 * IMPORTANT: This endpoint is intentionally accessible to ALL authenticated
 * users (ADMIN, MANAGER, ENGINEER) so that every user can review the updated
 * daily schedule task list for every engineer and export it.
 */
export async function GET(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result
  const q = new URL(req.url).searchParams

  try {
    const where: any = {}

    // NO role-based filtering here — every authenticated user sees ALL engineers.

    // Date range filters (the schedule.date column is stored as yyyy-MM-dd)
    if (q.get('dateFrom') || q.get('dateTo')) {
      where.date = {}
      if (q.get('dateFrom')) where.date.gte = q.get('dateFrom')
      if (q.get('dateTo')) where.date.lte = q.get('dateTo')
    }
    if (q.get('date')) where.date = q.get('date')

    if (q.get('status')) where.status = q.get('status')
    if (q.get('engineerId')) where.engineerId = q.get('engineerId')
    if (q.get('vertical')) where.vertical = q.get('vertical')
    if (q.get('visitType')) where.visitType = q.get('visitType')
    if (q.get('zone')) where.zone = q.get('zone')
    if (q.get('vendor')) where.vendor = q.get('vendor')
    if (q.get('activity')) where.activity = q.get('activity')

    // Relation-backed filters
    if (q.get('district')) {
      where.OR = [
        { site: { district: q.get('district') } },
        { store: { district: q.get('district') } },
      ]
    }
    if (q.get('region')) {
      where.OR = [
        ...(where.OR || []),
        { site: { region: q.get('region') } },
        { store: { region: q.get('region') } },
      ]
    }
    if (q.get('storeFormat')) where.store = { storeFormat: q.get('storeFormat') }

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
        { callNumber: { contains: search } },
        { problem: { contains: search } },
        { remarks: { contains: search } },
      ]
    }

    const page = parseInt(q.get('page') || '1')
    const limit = parseInt(q.get('limit') || '50')
    const skip = (page - 1) * limit

    const [schedules, total] = await Promise.all([
      db.schedule.findMany({
        where, skip, take: limit, orderBy: [{ date: 'desc' }, { engineer: { name: 'asc' } }],
        include: {
          engineer: { select: { id: true, name: true, engineerCode: true, vertical: true, zone: true, smName: true, projectManager: true, manager: { select: { name: true } } } },
          site: true,
          store: true,
          visits: { orderBy: { visitNumber: 'desc' }, take: 1 },
        },
      }),
      db.schedule.count({ where }),
    ])

    return NextResponse.json({ schedules, total, pages: Math.ceil(total / limit), page })
  } catch (error) {
    console.error('Daily schedule error:', error)
    return NextResponse.json({ error: 'Failed to load daily schedule' }, { status: 500 })
  }
}

/**
 * Create a new daily-schedule entry (with extended fields).
 * Available to ADMIN and MANAGER only.
 */
export async function POST(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  if (user.role === 'ENGINEER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const schedule = await db.schedule.create({
      data: {
        date: body.date,
        engineerId: body.engineerId,
        siteId: body.siteId || null,
        storeId: body.storeId || null,
        vendor: body.vendor || null,
        activity: body.activity || null,
        status: body.status || 'ASSIGNED',
        remarks: body.remarks || null,
        vertical: body.vertical || null,
        callNumber: body.callNumber || null,
        visitType: body.visitType || null,
        problem: body.problem || null,
        callDate: body.callDate || null,
        zone: body.zone || null,
      },
    })
    await logActivity({ userId: user.userId, role: user.role, action: 'CREATE_DAILY_SCHEDULE', entity: 'Schedule', entityId: schedule.id, newValue: JSON.stringify(body) })
    return NextResponse.json(schedule, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create schedule' }, { status: 500 })
  }
}

/**
 * Update an existing daily-schedule entry (including extended fields).
 * Engineers may only update status/remarks of their own entries.
 */
export async function PUT(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const body = await req.json()
    const existing = await db.schedule.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

    if (user.role === 'ENGINEER') {
      if (existing.engineerId !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const allowed = ['status', 'remarks', 'problem', 'callDate']
      const updateData: any = {}
      for (const key of allowed) {
        if (body[key] !== undefined) updateData[key] = body[key]
      }
      const schedule = await db.schedule.update({ where: { id: body.id }, data: updateData })
      await logActivity({ userId: user.userId, role: user.role, action: 'UPDATE_DAILY_SCHEDULE', entity: 'Schedule', entityId: body.id, previousValue: JSON.stringify({ status: existing.status, remarks: existing.remarks }), newValue: JSON.stringify(updateData) })
      return NextResponse.json(schedule)
    }

    const updateData: any = { ...body }
    delete updateData.id
    const schedule = await db.schedule.update({ where: { id: body.id }, data: updateData })
    await logActivity({ userId: user.userId, role: user.role, action: 'UPDATE_DAILY_SCHEDULE', entity: 'Schedule', entityId: body.id, previousValue: JSON.stringify(existing), newValue: JSON.stringify(body) })
    return NextResponse.json(schedule)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update schedule' }, { status: 500 })
  }
}
