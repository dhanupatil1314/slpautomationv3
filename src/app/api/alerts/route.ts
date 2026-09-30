import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/alerts — list alerts with severity/type/acknowledged filters
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'alerts.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const severity = searchParams.get('severity') || ''
  const type = searchParams.get('type') || ''
  const acknowledged = searchParams.get('acknowledged')
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)

  const where: any = {}
  if (severity) where.severity = severity
  if (type) where.type = type
  if (acknowledged === 'true') where.acknowledged = true
  if (acknowledged === 'false') where.acknowledged = false

  const [alerts, total] = await Promise.all([
    db.alert.findMany({
      where,
      include: { device: { select: { deviceId: true, city: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.alert.count({ where }),
  ])

  // KPI summary
  const all = await db.alert.findMany({ select: { severity: true, acknowledged: true } })
  const summary = {
    critical: all.filter((a) => a.severity === 'critical').length,
    warning: all.filter((a) => a.severity === 'warning').length,
    info: all.filter((a) => a.severity === 'info').length,
    unacknowledged: all.filter((a) => !a.acknowledged).length,
    total: all.length,
  }

  return NextResponse.json({
    alerts: alerts.map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      message: a.message,
      acknowledged: a.acknowledged,
      createdAt: a.createdAt,
      deviceId: a.device?.deviceId || '—',
      city: a.device?.city?.name || '—',
    })),
    total, page, pageSize, summary,
  })
}

// POST /api/alerts — acknowledge an alert
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'alerts.acknowledge')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { alertId, action } = body
  if (!alertId) return NextResponse.json({ error: 'alertId required' }, { status: 400 })

  if (action === 'acknowledge_all') {
    const result = await db.alert.updateMany({ where: { acknowledged: false }, data: { acknowledged: true } })
    await auditLog({ user, action: 'alert_acknowledge_all', entity: 'alert', details: `Acknowledged ${result.count} alerts` })
    return NextResponse.json({ acknowledged: result.count })
  }

  const alert = await db.alert.update({
    where: { id: alertId },
    data: { acknowledged: true },
  })
  await auditLog({ user, action: 'alert_acknowledge', entity: 'alert', entityId: alertId, details: `Acknowledged ${alert.type} alert` })
  return NextResponse.json({ alert })
}
