import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/media/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'media.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const media = await db.media.findUnique({
    where: { id },
    include: {
      advertiser: { include: { organization: { select: { name: true } } } },
      playlistItems: { include: { playlist: { select: { id: true, name: true } } } },
    },
  })
  if (!media) return NextResponse.json({ error: 'Media not found' }, { status: 404 })
  return NextResponse.json({ media })
}

// PATCH /api/media/[id] — rename / approve / reject / archive
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { action } = body

  const data: any = {}

  if (action === 'approve') {
    if (!hasPermission(user.role, 'media.approve')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    data.approvalStatus = 'approved'
    data.rejectionReason = null
  } else if (action === 'reject') {
    if (!hasPermission(user.role, 'media.approve')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!body.reason) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })
    data.approvalStatus = 'rejected'
    data.rejectionReason = body.reason
  } else if (action === 'archive') {
    if (!hasPermission(user.role, 'media.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    data.approvalStatus = 'archived'
  } else if (action === 'rename') {
    if (!hasPermission(user.role, 'media.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!body.name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    data.name = body.name
  } else {
    // Generic edit — fall back to allowed fields
    if (!hasPermission(user.role, 'media.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    for (const k of ['name', 'qrUrl', 'resolution', 'durationSec']) {
      if (body[k] !== undefined) data[k] = body[k]
    }
  }

  const media = await db.media.update({ where: { id }, data })

  await auditLog({
    user,
    action: action === 'approve' ? 'media_approve' : action === 'reject' ? 'media_reject' : action === 'archive' ? 'media_archive' : 'media_update',
    entity: 'media',
    entityId: id,
    details: action === 'reject' ? `Rejected: ${body.reason}` : `${action || 'updated'} media "${media.name}"`,
  })

  return NextResponse.json({ media })
}

// DELETE /api/media/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'media.delete')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const media = await db.media.delete({ where: { id } })
  await auditLog({ user, action: 'media_delete', entity: 'media', entityId: id, details: `Deleted media "${media.name}"` })
  return NextResponse.json({ success: true })
}
