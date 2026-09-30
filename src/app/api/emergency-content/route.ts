import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/emergency-content — list all emergency content pushes
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)

  const where: any = {}
  if (status) where.status = status

  const [items, total] = await Promise.all([
    db.emergencyContent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.emergencyContent.count({ where }),
  ])

  return NextResponse.json({ items, total, page, pageSize })
}

// POST /api/emergency-content — create and push emergency content
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'campaigns.publish'))
    return NextResponse.json({ error: 'Forbidden — requires campaign publish permission' }, { status: 403 })

  const body = await request.json()
  const { title, message, priority, mediaUrl, targetScope, targetCity, targetZone, targetDeviceId, durationMin } = body

  if (!title || !message) {
    return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })
  }

  const duration = durationMin || 30
  const now = new Date()
  const expiresAt = new Date(now.getTime() + duration * 60000)

  const content = await db.emergencyContent.create({
    data: {
      title,
      message,
      priority: priority || 1,
      mediaUrl: mediaUrl || null,
      targetScope: targetScope || 'all',
      targetCity: targetCity || null,
      targetZone: targetZone || null,
      targetDeviceId: targetDeviceId || null,
      durationMin: duration,
      status: 'active',
      createdBy: user.id,
      expiresAt,
      pushedAt: now,
    },
  })

  // Count affected devices based on scope
  let affectedDevices = 0
  if (targetScope === 'all') {
    affectedDevices = await db.device.count({ where: { status: { in: ['online', 'warning'] } } })
  } else if (targetScope === 'city' && targetCity) {
    affectedDevices = await db.device.count({ where: { city: { name: targetCity }, status: { in: ['online', 'warning'] } } })
  } else if (targetScope === 'device' && targetDeviceId) {
    affectedDevices = 1
  }

  await auditLog({
    user,
    action: 'emergency_content_push',
    entity: 'emergency_content',
    entityId: content.id,
    details: `Pushed "${title}" to ${targetScope}${targetCity ? `/${targetCity}` : ''} — ${affectedDevices} devices, priority ${priority || 1}`,
  })

  return NextResponse.json({ content, affectedDevices, message: `Emergency content pushed to ${affectedDevices} device(s)` }, { status: 201 })
}
