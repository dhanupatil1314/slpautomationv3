import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/api'

export async function GET(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result
  if (user.role === 'ENGINEER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = new URL(req.url).searchParams
  try {
    const where: any = {}
    if (q.get('userId')) where.userId = q.get('userId')
    if (q.get('action')) where.action = q.get('action')
    if (q.get('entity')) where.entity = q.get('entity')
    if (q.get('dateFrom')) where.createdAt = { ...where.createdAt, gte: new Date(q.get('dateFrom')!) }
    if (q.get('dateTo')) where.createdAt = { ...where.createdAt, lte: new Date(q.get('dateTo')!) }

    const page = parseInt(q.get('page') || '1')
    const limit = parseInt(q.get('limit') || '50')

    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, engineerCode: true, role: true } } },
      }),
      db.activityLog.count({ where }),
    ])
    return NextResponse.json({ logs, total, pages: Math.ceil(total / limit) })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load activity logs' }, { status: 500 })
  }
}