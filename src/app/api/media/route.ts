import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/media — paginated, filterable, searchable media list
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'media.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '24'), 100)
  const search = searchParams.get('search') || ''
  const type = searchParams.get('type') || ''
  const status = searchParams.get('status') || ''
  const advertiserId = searchParams.get('advertiserId') || ''

  const where: any = {}
  if (search) where.name = { contains: search }
  if (type) where.type = type
  if (status) where.approvalStatus = status
  if (advertiserId) where.advertiserId = advertiserId

  const [media, total] = await Promise.all([
    db.media.findMany({
      where,
      include: {
        advertiser: { select: { id: true, contactName: true, organization: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.media.count({ where }),
  ])

  return NextResponse.json({
    media: media.map((m) => ({
      id: m.id,
      name: m.name,
      fileName: m.fileName,
      fileUrl: m.fileUrl,
      thumbnailUrl: m.thumbnailUrl,
      type: m.type,
      format: m.format,
      sizeBytes: m.sizeBytes,
      resolution: m.resolution,
      durationSec: m.durationSec,
      advertiserId: m.advertiserId,
      advertiserName: m.advertiser?.organization?.name || '—',
      uploadedById: m.uploadedById,
      approvalStatus: m.approvalStatus,
      rejectionReason: m.rejectionReason,
      usageCount: m.usageCount,
      qrUrl: m.qrUrl,
      createdAt: m.createdAt,
    })),
    total, page, pageSize,
  })
}

// POST /api/media — create a media entry (metadata only; file upload abstracted)
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'media.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const {
    name, type, format, resolution, durationSec, advertiserId, qrUrl,
    sizeBytes,
  } = body

  if (!name || !type) {
    return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
  }
  if (!['image', 'video'].includes(type)) {
    return NextResponse.json({ error: 'Type must be image or video' }, { status: 400 })
  }

  // Resolve organization from advertiser (if provided)
  let organizationId: string | null = null
  if (advertiserId) {
    const adv = await db.advertiser.findUnique({ where: { id: advertiserId }, select: { organizationId: true } })
    if (adv) organizationId = adv.organizationId
  }

  // Simulated file URL (in production this would be a CDN/S3 URL after upload)
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const fileUrl = `https://cdn.lakhirad.com/media/${slug}.${format || (type === 'video' ? 'mp4' : 'jpg')}`
  const thumbnailUrl = type === 'video' ? `https://cdn.lakhirad.com/media/${slug}-thumb.jpg` : fileUrl

  const media = await db.media.create({
    data: {
      name,
      fileName: `${slug}.${format || (type === 'video' ? 'mp4' : 'jpg')}`,
      fileUrl,
      thumbnailUrl,
      type,
      format: format || (type === 'video' ? 'mp4' : 'jpg'),
      sizeBytes: Number(sizeBytes) || (type === 'video' ? 15_000_000 : 800_000),
      resolution: resolution || (type === 'video' ? '1920x1080' : '1080x1920'),
      durationSec: Number(durationSec) || (type === 'video' ? 15 : 0),
      advertiserId: advertiserId || null,
      organizationId,
      uploadedById: user.id,
      approvalStatus: 'pending_approval',
      qrUrl: qrUrl || null,
    },
  })

  await auditLog({
    user,
    action: 'media_create',
    entity: 'media',
    entityId: media.id,
    details: `Uploaded media "${name}" (${type}/${format || '—'})`,
  })

  return NextResponse.json({ media }, { status: 201 })
}
