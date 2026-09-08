import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/api'

export async function GET(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const notifications = await db.notification.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' }, take: 50,
    })
    const unreadCount = await db.notification.count({ where: { userId: user.userId, read: false } })
    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  const body = await req.json()
  if (body.markAllRead) {
    await db.notification.updateMany({ where: { userId: user.userId, read: false }, data: { read: true } })
  } else if (body.id) {
    await db.notification.update({ where: { id: body.id }, data: { read: true } })
  }
  return NextResponse.json({ success: true })
}