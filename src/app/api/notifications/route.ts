import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/notifications — current user's notifications
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'notifications.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const read = searchParams.get('read')
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 100)

  const where: any = { userId: user.id }
  if (read === 'true') where.read = true
  if (read === 'false') where.read = false

  const [notifications, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ])

  return NextResponse.json({
    notifications,
    total,
    unreadCount,
    page,
    pageSize,
  })
}

// POST /api/notifications — mark as read (single or all)
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'notifications.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { notificationId, action } = body

  if (action === 'mark_all_read') {
    const result = await db.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    })
    await auditLog({ user, action: 'notifications_mark_all_read', entity: 'notification', details: `Marked ${result.count} notifications as read` })
    return NextResponse.json({ updated: result.count })
  }

  if (!notificationId) return NextResponse.json({ error: 'notificationId required' }, { status: 400 })
  const updated = await db.notification.update({
    where: { id: notificationId, userId: user.id },
    data: { read: true },
  })
  await auditLog({ user, action: 'notification_mark_read', entity: 'notification', entityId: notificationId, details: `Marked notification as read` })
  return NextResponse.json({ notification: updated })
}
