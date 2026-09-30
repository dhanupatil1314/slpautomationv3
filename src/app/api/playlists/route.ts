import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/playlists — list playlists
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'playlists.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const city = searchParams.get('city') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 200)

  const where: any = {}
  if (search) where.name = { contains: search }
  if (status) where.status = status
  if (city) where.city = city

  const [playlists, total] = await Promise.all([
    db.playlist.findMany({
      where,
      include: {
        _count: { select: { items: true, campaigns: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.playlist.count({ where }),
  ])

  return NextResponse.json({
    playlists: playlists.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      city: p.city || '—',
      zone: p.zone || '—',
      totalDuration: p.totalDuration,
      priority: p.priority,
      status: p.status,
      itemCount: p._count.items,
      campaignCount: p._count.campaigns,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    total, page, pageSize,
  })
}

// POST /api/playlists — create playlist
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'playlists.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, description, city, zone, priority, status } = body
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const playlist = await db.playlist.create({
    data: {
      name,
      description: description || null,
      city: city || null,
      zone: zone || null,
      priority: Number(priority) || 5,
      status: status || 'draft',
    },
  })

  await auditLog({ user, action: 'playlist_create', entity: 'playlist', entityId: playlist.id, details: `Created playlist "${name}"` })
  return NextResponse.json({ playlist }, { status: 201 })
}
